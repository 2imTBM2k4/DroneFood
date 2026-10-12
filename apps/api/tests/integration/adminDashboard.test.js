import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../app.js";
import {
  AuditLog,
  Branch,
  Merchant,
  Order,
  OrderReview,
  ShipperProfile,
} from "../../models/index.cjs";
import { createAdmin, createUser, generateToken } from "../helpers.js";

const shippingAddress = {
  fullName: "Khách thử nghiệm",
  address: "12 Nguyễn Huệ, Quận 1",
  city: "Hồ Chí Minh",
  state: "Hồ Chí Minh",
  country: "VN",
  phone: "0900000000",
};

describe("Admin operational dashboard API", () => {
  let adminToken;
  let merchant;
  let branch;
  let customer;

  const createBranchOrder = async (overrides = {}) =>
    Order.create({
      user: customer._id,
      merchantId: merchant._id,
      branchId: branch._id,
      orderItems: [],
      shippingAddress,
      paymentMethod: "COD",
      totalPrice: 100000,
      deliveryMethod: "shipper",
      shipperAssignmentStatus: "unassigned",
      orderStatus: "pending",
      ...overrides,
    });

  beforeEach(async () => {
    const admin = await createAdmin();
    adminToken = generateToken(admin._id);
    customer = await createUser();
    const owner = await createUser({ role: "merchant_owner" });
    merchant = await Merchant.create({
      name: "Quán Quận 1",
      slug: `quan-q1-${Date.now()}-${Math.random()}`,
      ownerUserId: owner._id,
      status: "active",
    });
    branch = await Branch.create({
      merchantId: merchant._id,
      name: "Chi nhánh Quận 1",
      code: `Q1${Date.now()}`.slice(-10),
      address: { text: "12 Nguyễn Huệ, Quận 1" },
      isOpen: true,
      status: "active",
    });
  });

  it("returns a real, region-filtered operational snapshot for admins", async () => {
    const delivered = await createBranchOrder({
      orderStatus: "delivered",
      isDelivered: true,
      deliveredAt: new Date(),
      totalPrice: 120000,
    });
    const cancelled = await createBranchOrder({
      orderStatus: "cancelled",
      reason: "No shipper accepted this order within 15 minutes.",
      cancellationCode: "NO_SHIPPER_AVAILABLE",
    });
    const waiting = await createBranchOrder();
    await Order.collection.updateOne(
      { _id: waiting._id },
      { $set: { createdAt: new Date(Date.now() - 20 * 60 * 1000) } },
    );
    await AuditLog.create({
      actorRole: "user",
      action: "order.status_changed",
      targetType: "order",
      targetId: cancelled._id,
      reason: "No shipper accepted this order within 15 minutes.",
    });
    await OrderReview.create({
      order: delivered._id,
      reviewer: customer._id,
      targetType: "food",
      target: delivered._id,
      restaurant: null,
      outcome: "rated",
      rating: 2,
      comment: "Giao trễ",
    });

    const shipperUser = await createUser({ role: "shipper" });
    await ShipperProfile.create({
      user: shipperUser._id,
      approvalStatus: "approved",
      status: "available",
    });
    const pendingShipper = await createUser({ role: "shipper", name: "Tài xế chờ duyệt" });
    await ShipperProfile.create({ user: pendingShipper._id, approvalStatus: "pending" });

    const response = await request(app)
      .get("/api/admin/dashboard?period=today&region=district-1")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.source).toBe("api");
    expect(response.body.data.filters).toEqual({ period: "today", region: "district-1" });
    expect(response.body.data.kpis.orders).toMatchObject({ total: 3, successful: 1, cancelled: 1 });
    expect(response.body.data.kpis.gmv.value).toBe(120000);
    expect(response.body.data.kpis.unassignedOrders.value).toBe(1);
    expect(response.body.data.kpis.driversOnline).toMatchObject({ online: 1, total: 1 });
    expect(response.body.data.kpis.merchantsOnline).toMatchObject({ online: 1, total: 1 });
    expect(response.body.data.actions.unassignedOrders).toHaveLength(1);
    expect(response.body.data.actions.recentCancellations[0]).toMatchObject({
      orderId: cancelled._id.toString(),
      cancelledBy: "Hệ thống",
    });
    expect(response.body.data.actions.complaints[0]).toMatchObject({
      orderId: delivered._id.toString(),
      rating: 2,
      content: "Giao trễ",
    });
    expect(response.body.data.hourlyOrders).toHaveLength(24);
    expect(response.body.data.trend7d).toHaveLength(7);
  });

  it("requires an admin token", async () => {
    const response = await request(app).get("/api/admin/dashboard");
    expect(response.status).toBe(401);
  });
});
