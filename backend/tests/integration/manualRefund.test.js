import { describe, expect, it } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import app from "../../app.js";
import { Order, RefundRequest } from "../../models/index.cjs";
import { createAdmin, createRestaurantOwner, createUser, generateToken } from "../helpers.js";

const findAudit = async (action, targetId) => {
  const AuditLog = (await import("../../models/auditLogModel.cjs")).default;
  return AuditLog.findOne({ action, targetId }).lean();
};

const address = {
  fullName: "Test Customer", address: "123 Test Street", city: "Ho Chi Minh City",
  state: "District 1", country: "Vietnam", zipCode: "700000", phone: "0900000000", lat: 10.77, lng: 106.7,
};

const createPaidPayosOrder = async () => {
  const customer = await createUser();
  const { restaurant } = await createRestaurantOwner();
  const order = await Order.create({
    user: customer._id, restaurantId: restaurant._id, shippingAddress: address,
    orderItems: [{ product: new mongoose.Types.ObjectId(), name: "Test food", quantity: 1, price: 50000 }],
    totalPrice: 60000, itemsPrice: 50000, shippingPrice: 10000,
    paymentMethod: "PAYOS", isPaid: true, paidAt: new Date(), orderStatus: "pending",
  });
  return { customer, order };
};

describe("manual PayOS refunds", () => {
  it("locks the paid order while an owner-requested refund awaits an admin", async () => {
    const { customer, order } = await createPaidPayosOrder();
    const token = generateToken(customer._id);
    const body = {
      orderId: order._id.toString(), reason: "Không còn nhu cầu",
      bank: { bankName: "Vietcombank", accountNumber: "123456789", accountHolder: "NGUYEN VAN A" },
    };
    const created = await request(app).post("/api/refunds/request").set("Authorization", `Bearer ${token}`).send(body);
    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe("requested");
    expect(created.body.data.amount).toBe(60000);
    expect((await Order.findById(order._id)).orderStatus).toBe("refund_pending");
    const audit = await findAudit("refund_requested", order._id);
    expect(audit).toBeTruthy();
    expect(String(audit.actor)).toBe(String(customer._id));
    expect(audit.targetType).toBe("order");
    expect(String(audit.metadata.refundRequestId)).toBe(created.body.data._id);

    const duplicate = await request(app).post("/api/refunds/request").set("Authorization", `Bearer ${token}`).send(body);
    expect(duplicate.status).toBe(409);
  });

  it("requires an admin to record the manual transfer before cancelling", async () => {
    const { customer, order } = await createPaidPayosOrder();
    const admin = await createAdmin();
    const refund = await RefundRequest.create({
      order: order._id, customer: customer._id, amount: order.totalPrice, reason: "No longer needed",
      bank: { bankName: "ACB", accountNumber: "123456789", accountHolder: "NGUYEN VAN A" },
    });
    await Order.findByIdAndUpdate(order._id, { orderStatus: "refund_pending", refundStatus: "requested" });

    const denied = await request(app).post(`/api/refunds/${refund._id}/mark-paid`).set("Authorization", `Bearer ${generateToken(customer._id)}`).send({ transferReference: "MB123" });
    expect(denied.status).toBe(403);

    const paid = await request(app).post(`/api/refunds/${refund._id}/mark-paid`).set("Authorization", `Bearer ${generateToken(admin._id)}`).send({ transferReference: "MB123" });
    expect(paid.status).toBe(200);
    expect((await RefundRequest.findById(refund._id)).status).toBe("paid");
    const cancelled = await Order.findById(order._id);
    expect(cancelled.orderStatus).toBe("cancelled");
    expect(cancelled.refundStatus).toBe("paid");
    const audit = await findAudit("manual_refund_paid", order._id);
    expect(audit).toBeTruthy();
    expect(String(audit.actor)).toBe(String(admin._id));
    expect(audit.targetType).toBe("order");
    expect(String(audit.metadata.refundRequestId)).toBe(String(refund._id));
    expect(audit.metadata.transferReference).toBe("MB123");
  });

  it("allows a customer to correct details and resubmit after an admin rejects a request", async () => {
    const { customer, order } = await createPaidPayosOrder();
    const admin = await createAdmin();
    const token = generateToken(customer._id);
    const body = {
      orderId: order._id.toString(), reason: "No longer needed",
      bank: { bankName: "ACB", accountNumber: "123456789", accountHolder: "NGUYEN VAN A" },
    };
    const created = await request(app).post("/api/refunds/request").set("Authorization", `Bearer ${token}`).send(body);
    const rejected = await request(app).post(`/api/refunds/${created.body.data._id}/reject`)
      .set("Authorization", `Bearer ${generateToken(admin._id)}`)
      .send({ adminNote: "Please verify account information" });
    expect(rejected.status).toBe(200);
    expect((await Order.findById(order._id)).orderStatus).toBe("pending");
    const audit = await findAudit("manual_refund_rejected", order._id);
    expect(audit).toBeTruthy();
    expect(String(audit.actor)).toBe(String(admin._id));
    expect(audit.targetType).toBe("order");
    expect(String(audit.metadata.refundRequestId)).toBe(created.body.data._id);

    const resubmitted = await request(app).post("/api/refunds/request").set("Authorization", `Bearer ${token}`).send({
      ...body,
      bank: { ...body.bank, accountNumber: "987654321" },
    });
    expect(resubmitted.status).toBe(201);
    expect(resubmitted.body.data.status).toBe("requested");
    expect((await RefundRequest.findById(created.body.data._id)).bank.accountNumber).toBe("987654321");
  });

  it("accepts refund details for a legacy paid PayOS order cancelled because no shipper was available", async () => {
    const { customer, order } = await createPaidPayosOrder();
    await Order.findByIdAndUpdate(order._id, {
      orderStatus: "cancelled",
      cancellationCode: "NO_SHIPPER_AVAILABLE",
      reason: "No shipper accepted this order",
    });

    const response = await request(app).post("/api/refunds/request")
      .set("Authorization", `Bearer ${generateToken(customer._id)}`)
      .send({
        orderId: order._id.toString(),
        reason: "Please return the payment",
        bank: { bankName: "ACB", accountNumber: "123456789", accountHolder: "NGUYEN VAN A" },
      });

    expect(response.status).toBe(201);
    expect((await Order.findById(order._id)).orderStatus).toBe("refund_pending");
  });

  it("accepts refund details for an old preparing order whose shipper search expired", async () => {
    const { customer, order } = await createPaidPayosOrder();
    await Order.findByIdAndUpdate(order._id, {
      orderStatus: "preparing",
      deliveryMethod: "shipper",
      shipperAssignmentStatus: "expired",
    });

    const response = await request(app).post("/api/refunds/request")
      .set("Authorization", `Bearer ${generateToken(customer._id)}`)
      .send({
        orderId: order._id.toString(),
        reason: "No shipper was found",
        bank: { bankName: "ACB", accountNumber: "123456789", accountHolder: "NGUYEN VAN A" },
      });

    expect(response.status).toBe(201);
    expect((await Order.findById(order._id)).orderStatus).toBe("refund_pending");
  });
});
