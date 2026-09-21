import { describe, expect, it } from "vitest";
import mongoose from "mongoose";
import request from "supertest";
import app from "../../app.js";
import { Order, RefundRequest, ShipperProfile } from "../../models/index.cjs";
import { createRestaurantOwner, createUser, generateToken } from "../helpers.js";

const address = {
  fullName: "Test Customer", address: "123 Test Street", city: "Ho Chi Minh City",
  state: "District 1", country: "Vietnam", zipCode: "700000", phone: "0900000000",
};

const createOrder = (customerId, restaurantId, overrides = {}) => Order.create({
  user: customerId,
  restaurantId,
  orderItems: [{ product: new mongoose.Types.ObjectId(), name: "Test food", quantity: 1, price: 50000 }],
  shippingAddress: address,
  totalPrice: 60000,
  itemsPrice: 50000,
  shippingPrice: 10000,
  paymentMethod: "PAYOS",
  isPaid: true,
  paidAt: new Date(),
  orderStatus: "delivered",
  ...overrides,
});

describe("mobile history APIs", () => {
  it("returns only the signed-in customer's completed PayOS payments and refunds", async () => {
    const customer = await createUser({ email: "history-customer@test.com" });
    const otherCustomer = await createUser({ email: "history-other@test.com" });
    const { restaurant } = await createRestaurantOwner();
    const order = await createOrder(customer._id, restaurant._id, { payosOrderCode: 123456 });
    await createOrder(otherCustomer._id, restaurant._id, { payosOrderCode: 123457 });
    await RefundRequest.create({
      order: order._id,
      customer: customer._id,
      amount: 60000,
      reason: "Không còn nhu cầu",
      bank: { bankName: "ACB", accountHolder: "TEST CUSTOMER", accountNumberLast4: "6789" },
      status: "paid",
    });

    const response = await request(app)
      .get("/api/user/transactions")
      .set("Authorization", `Bearer ${generateToken(customer._id)}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.transactions).toHaveLength(2);
    expect(response.body.data.transactions.map((item) => item.transactionType).sort())
      .toEqual(["payos_payment", "payos_refund"]);
    expect(JSON.stringify(response.body)).not.toContain(String(otherCustomer._id));
  });

  it("returns only completed deliveries assigned to the signed-in shipper", async () => {
    const { restaurant } = await createRestaurantOwner();
    const customer = await createUser({ email: "history-order-customer@test.com", phone: "0900000000" });
    const shipper = await createUser({ role: "shipper", email: "history-shipper@test.com" });
    const otherShipper = await createUser({ role: "shipper", email: "history-other-shipper@test.com" });
    await ShipperProfile.create({ user: shipper._id, approvalStatus: "approved", status: "offline" });

    const delivered = await createOrder(customer._id, restaurant._id, {
      shipperId: shipper._id,
      deliveryMethod: "shipper",
      shipperAssignmentStatus: "completed",
      deliveredAt: new Date(),
    });
    await createOrder(customer._id, restaurant._id, {
      shipperId: shipper._id,
      deliveryMethod: "shipper",
      shipperAssignmentStatus: "picked_up",
      orderStatus: "delivering",
    });
    await createOrder(customer._id, restaurant._id, {
      shipperId: otherShipper._id,
      deliveryMethod: "shipper",
      shipperAssignmentStatus: "completed",
    });

    const response = await request(app)
      .get("/api/shippers/me/orders/history")
      .set("Authorization", `Bearer ${generateToken(shipper._id)}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.map((item) => item._id)).toEqual([String(delivered._id)]);
    expect(response.body.data[0].user).toMatchObject({ name: customer.name, phone: customer.phone });
  });

  it("labels a zero-payable voucher settlement as a zero-cash voucher payment, not a PayOS payment", async () => {
    const customer = await createUser({ email: "voucher-history-customer@test.com" });
    const { restaurant } = await createRestaurantOwner();
    const order = await createOrder(customer._id, restaurant._id, {
      totalPrice: 0,
      discountAmount: 60000,
      paymentResult: { id: "voucher_zero_payable", status: "ZERO_PAYABLE_VOUCHER", update_time: new Date().toISOString() },
    });

    const response = await request(app)
      .get("/api/user/transactions")
      .set("Authorization", `Bearer ${generateToken(customer._id)}`);

    expect(response.status).toBe(200);
    expect(response.body.data.transactions).toContainEqual(expect.objectContaining({
      _id: `order_${order._id}`,
      transactionType: "voucher_payment",
      paymentMethod: "VOUCHER",
      amount: 0,
      title: `Thanh toán bằng voucher - Đơn #${order._id.toString().slice(-6).toUpperCase()}`,
    }));
  });
});
