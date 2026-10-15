import mongoose from "mongoose";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../app.js";
import { Branch, Cart, Merchant, Order, Restaurant, User } from "../../models/index.cjs";
import AuditLog from "../../models/auditLogModel.cjs";
import { createAdmin, createFood, createRestaurantOwner, createUser, generateToken } from "../helpers.js";

const profile = {
  address: { text: "1 Đồng Khởi, Q1", lat: 10.775, lng: 106.701 },
  contactName: "Nguyễn Liên Hệ",
  contactPhone: "0901234567",
  handoverNotes: "Bàn giao tại sân thượng, gọi trước khi đến.",
};

const send = (method, path, user, body) => request(app)[method](path)
  .set("Authorization", `Bearer ${generateToken(user._id)}`).send(body);

const submit = (branch, user, body = profile) => send("post", `/api/branch/${branch._id}/drone-application`, user, body);
const decide = (branch, admin, submissionId, decision = "approved", reason = "Đã kiểm tra vị trí bàn giao") =>
  send("post", `/api/branch/${branch._id}/drone-application/decision`, admin, { submissionId, decision, reason });
const toggle = (branch, user, enabled) => send("patch", `/api/branch/${branch._id}/drone-delivery`, user, { enabled });

// These assertions fail if approval is bypassed, transitions lose their compare-and-set
// guard, or public branch responses expose the private application.
describe("Drone delivery application", () => {
  let owner, manager, outsider, admin, merchant, branch;
  beforeEach(async () => {
    owner = await createUser({ role: "merchant_owner" });
    manager = await createUser({ role: "branch_manager" });
    outsider = await createUser();
    admin = await createAdmin();
    merchant = await Merchant.create({ name: "Nhà hàng", slug: "drone-approval", ownerUserId: owner._id, status: "active" });
    branch = await Branch.create({ merchantId: merchant._id, name: "Chi nhánh", code: "MAIN", status: "active", isOpen: true, address: profile.address, managerUserIds: [manager._id] });
  });

  it("blocks enabling before approval even when the stored legacy toggle was true", async () => {
    await Branch.updateOne({ _id: branch._id }, { droneDeliveryEnabled: true });
    const res = await toggle(branch, owner, true);
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it.each(["owner", "manager"])("allows the assigned %s to submit and read the profile", async (actor) => {
    const user = actor === "owner" ? owner : manager;
    const res = await submit(branch, user);
    expect(res.status).toBe(201);
    expect(res.body.data.droneDeliveryApplication.status).toBe("pending");
    expect(res.body.data.droneDeliveryApplication.contactPhone).toBe(profile.contactPhone);
    expect(res.body.data.droneDeliveryEnabled).toBe(false);
    const read = await send("get", `/api/branch/${branch._id}/drone-application`, user);
    expect(read.status).toBe(200);
    expect(read.body.data.droneDeliveryApplication.handoverNotes).toBe(profile.handoverNotes);
  });

  it("denies an outsider both submission and private reading", async () => {
    expect((await submit(branch, outsider)).status).toBe(403);
    expect((await send("get", `/api/branch/${branch._id}/drone-application`, outsider)).status).toBe(403);
    const stored = await Branch.findById(branch._id).select("+droneDeliveryApplication");
    expect(stored.droneDeliveryApplication?.status || "not_registered").toBe("not_registered");
  });

  it.each(["body", "query"])("denies manager assignment using another merchant ID in %s", async (source) => {
    const attacker = await createUser({ role: "merchant_owner" });
    const attackerMerchant = await Merchant.create({ name: "Other restaurant", slug: "other-drone-owner", ownerUserId: attacker._id, status: "active" });
    await submit(branch, owner);
    const body = { userIds: [String(attacker._id)] };
    const suffix = source === "query" ? `?merchantId=${attackerMerchant._id}` : "";
    if (source === "body") body.merchantId = String(attackerMerchant._id);
    const result = await send("post", `/api/branch/${branch._id}/managers${suffix}`, attacker, body);
    expect(result.status).toBe(403);
    const stored = await Branch.findById(branch._id);
    expect(stored.managerUserIds.map(String)).toEqual([String(manager._id)]);
    expect((await send("get", `/api/branch/${branch._id}/drone-application`, attacker)).status).toBe(403);
    expect((await submit(branch, attacker)).status).toBe(403);
    expect((await toggle(branch, attacker, false)).status).toBe(403);
  });

  it.each(["owner", "admin"])("retains legitimate manager assignment by %s", async (actor) => {
    const user = actor === "owner" ? owner : admin;
    const result = await send("post", `/api/branch/${branch._id}/managers`, user, { userIds: [String(outsider._id)] });
    expect(result.status).toBe(200);
    const stored = await Branch.findById(branch._id);
    expect(stored.managerUserIds.map(String)).toEqual([String(outsider._id)]);
    expect((await send("get", `/api/branch/${branch._id}/drone-application`, outsider)).status).toBe(200);
  });

  it("allows only one simultaneous submission and rejects editing pending or approved profiles", async () => {
    const results = await Promise.all([submit(branch, owner), submit(branch, manager)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    const accepted = results.find((r) => r.status === 201);
    expect((await submit(branch, owner, { ...profile, contactName: "Changed" })).status).toBe(409);
    expect((await decide(branch, admin, accepted.body.data.droneDeliveryApplication.submissionId)).status).toBe(200);
    expect((await submit(branch, manager)).status).toBe(409);
    expect(await AuditLog.countDocuments({ action: "branch.drone_application_submitted", branchId: branch._id })).toBe(1);
  });

  it("requires administrator, reason and the current submission for decisions", async () => {
    const application = (await submit(branch, owner)).body.data.droneDeliveryApplication;
    expect((await decide(branch, owner, application.submissionId)).status).toBe(403);
    expect((await decide(branch, manager, application.submissionId)).status).toBe(403);
    expect((await decide(branch, admin, application.submissionId, "approved", " ")).status).toBe(400);
    expect((await decide(branch, admin, new mongoose.Types.ObjectId().toString())).status).toBe(409);
  });

  it("records only one simultaneous decision and approval does not enable service", async () => {
    const application = (await submit(branch, owner)).body.data.droneDeliveryApplication;
    const results = await Promise.all([
      decide(branch, admin, application.submissionId),
      decide(branch, admin, application.submissionId, "rejected", "Vị trí chưa phù hợp"),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const branchAfter = await Branch.findById(branch._id).select("+droneDeliveryApplication");
    expect(branchAfter.droneDeliveryEnabled).toBe(false);
    expect(["approved", "rejected"]).toContain(branchAfter.droneDeliveryApplication.status);
    const logs = await AuditLog.find({ branchId: branch._id, action: { $in: ["branch.drone_application_approved", "branch.drone_application_rejected"] } });
    expect(logs).toHaveLength(1);
    expect(logs[0].reason).toBeTruthy();
    expect(String(logs[0].metadata.submissionId)).toBe(application.submissionId);
  });

  it("can correct rejected application, rejects stale decision and retains approval when disabled", async () => {
    const first = (await submit(branch, owner)).body.data.droneDeliveryApplication;
    expect((await decide(branch, admin, first.submissionId, "rejected", "Cần mô tả rõ lối vào")).status).toBe(200);
    const secondRes = await submit(branch, manager, { ...profile, handoverNotes: "Lối vào sân thượng phía đông" });
    expect(secondRes.status).toBe(201);
    const second = secondRes.body.data.droneDeliveryApplication;
    expect(second.submissionId).not.toBe(first.submissionId);
    expect(second.reviewReason).toBe("");
    expect((await decide(branch, admin, first.submissionId)).status).toBe(409);
    const approved = await decide(branch, admin, second.submissionId);
    expect(approved.status).toBe(200);
    expect(approved.body.data.droneDeliveryEnabled).toBe(false);
    expect((await toggle(branch, manager, true)).status).toBe(200);
    const disabled = await toggle(branch, owner, false);
    expect(disabled.status).toBe(200);
    const read = await send("get", `/api/branch/${branch._id}/drone-application`, owner);
    expect(read.body.data.droneDeliveryApplication.status).toBe("approved");
    expect((await toggle(branch, owner, true)).status).toBe(200);
  });

  it.each([
    { ...profile, address: { ...profile.address, lat: 91 } },
    { ...profile, address: { text: "Valid address", lng: 106.7 } },
    { ...profile, contactName: " " },
    { ...profile, contactPhone: "abc" },
    { ...profile, handoverNotes: " " },
    { ...profile, status: "approved", droneDeliveryEnabled: true },
  ])("rejects invalid or client-controlled application fields %#", async (body) => {
    expect((await submit(branch, owner, body)).status).toBe(400);
  });

  it("does not expose private application through public detail, list, merchant or nearby data", async () => {
    expect((await submit(branch, owner)).status).toBe(201);
    const paths = [
      `/api/branch/${branch._id}`,
      `/api/branch/list?merchantId=${merchant._id}`,
      `/api/merchant/${merchant.slug}/public`,
      "/api/branch/nearby?lat=10.775&lng=106.701",
    ];
    for (const path of paths) {
      const res = await request(app).get(path);
      expect(res.status).toBe(200);
      const json = JSON.stringify(res.body);
      expect(json).not.toContain("droneDeliveryApplication");
      expect(json).not.toContain(profile.contactName);
      expect(json).not.toContain(profile.handoverNotes);
    }
  });

  it("lists private applications only for assigned users and administrators", async () => {
    await submit(branch, owner);
    for (const actor of [owner, manager]) {
      const res = await send("get", "/api/branch/managed", actor);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].droneDeliveryApplication.contactName).toBe(profile.contactName);
    }
    expect((await send("get", "/api/branch/managed", outsider)).body.data).toEqual([]);
    expect((await send("get", "/api/branch/admin/list", outsider)).status).toBe(403);
    const adminList = await send("get", "/api/branch/admin/list?applicationStatus=pending", admin);
    expect(adminList.status).toBe(200);
    expect(adminList.body.data[0].droneDeliveryApplication.status).toBe("pending");
  });

  it("does not grant approval through general create or update APIs", async () => {
    const body = { droneDeliveryEnabled: true, droneDeliveryApplication: { status: "approved" } };
    expect((await send("put", `/api/branch/${branch._id}`, owner, body)).status).toBe(400);
    expect((await send("post", "/api/branch", owner, { merchantId: String(merchant._id), name: "New Branch", code: "NEW", address: "1 Address", ...body })).status).toBe(400);
  });
});

const shippingAddress = { fullName: "Customer", phone: "0901111111", address: "2 Đồng Khởi", city: "HCM", state: "HCM", country: "VN", lat: 10.776, lng: 106.702 };

describe("Drone checkout eligibility", () => {
  let owner, restaurant, customer, branch, admin, cart;
  beforeEach(async () => {
    ({ owner, restaurant } = await createRestaurantOwner());
    customer = await createUser();
    admin = await createAdmin();
    const managed = await send("get", "/api/branch/managed", owner);
    branch = managed.body.data[0];
    const food = await createFood(restaurant._id, { price: 50000 });
    cart = await Cart.create({ userId: customer._id, restaurantId: restaurant._id, items: [{ lineKey: String(food._id), foodId: food._id, quantity: 1 }] });
  });
  const checkout = (user, cart, endpoint, extra = {}) => send("post", `/api/order/${endpoint}`, user, {
    cartId: String(cart._id), cartVersion: cart.__v, address: shippingAddress, deliveryMethod: "drone",
    ...(endpoint === "place" && { paymentMethod: "VNPAY" }), ...extra,
  });

  it.each(["quote", "place"])("blocks legacy %s without any mapped branch or approved application", async (endpoint) => {
    await Branch.deleteMany({});
    await Merchant.deleteMany({});
    const res = await checkout(customer, cart, endpoint);
    expect(res.status).toBe(403);
    expect(await Order.countDocuments()).toBe(0);
    expect(await Cart.findById(cart._id)).not.toBeNull();
  });

  it.each(["not_registered", "pending", "rejected", "approved"])("blocks both checkout endpoints for %s without an approved and enabled service", async (status) => {
    await Branch.updateOne({ _id: branch._id }, { "droneDeliveryApplication.status": status, droneDeliveryEnabled: status !== "approved" });
    for (const endpoint of ["quote", "place"]) {
      const res = await checkout(customer, cart, endpoint);
      expect(res.status).toBe(403);
    }
    expect(await Order.countDocuments()).toBe(0);
  });

  it("supports approved and enabled legacy quote/place, and disabling leaves received orders intact", async () => {
    const submitted = await submit(branch, owner);
    expect((await decide(branch, admin, submitted.body.data.droneDeliveryApplication.submissionId)).status).toBe(200);
    expect((await toggle(branch, owner, true)).status).toBe(200);
    const quote = await checkout(customer, cart, "quote");
    expect(quote.status).toBe(200);
    const placed = await checkout(customer, cart, "place", { restaurantId: String(restaurant._id) });
    expect(placed.status, JSON.stringify(placed.body)).toBe(200);
    const order = await Order.findById(placed.body.orderId);
    expect(String(order.branchId)).toBe(branch._id);
    expect((await toggle(branch, owner, false)).status).toBe(200);
    const after = await Order.findById(order._id);
    expect(after.deliveryMethod).toBe("drone");
    expect(after.orderStatus).toBe(order.orderStatus);
    expect((await checkout(customer, cart, "quote")).status).toBe(403);
    expect((await checkout(customer, cart, "place")).status).toBe(403);
  });

  it("uses the same eligibility for branch carts and prevents replacing the cart location", async () => {
    await Cart.updateOne({ _id: cart._id }, { $set: { branchId: branch._id, merchantId: restaurant._id }, $unset: { restaurantId: 1 } });
    for (const endpoint of ["quote", "place"]) expect((await checkout(customer, cart, endpoint)).status).toBe(403);
    const other = await createRestaurantOwner();
    expect((await checkout(customer, cart, "place", { restaurantId: String(other.restaurant._id) })).status).toBe(400);
    const submitted = await submit(branch, owner);
    await decide(branch, admin, submitted.body.data.droneDeliveryApplication.submissionId);
    await toggle(branch, owner, true);
    expect((await checkout(customer, cart, "quote")).status).toBe(200);
    expect((await checkout(customer, cart, "place")).status).toBe(200);
  });

  it("continues assigning a drone to an already received order after service is disabled", async () => {
    const { assignDroneToOrder } = await import("../../services/droneService.js");
    const { Hub, Drone } = await import("../../models/index.cjs");
    const hub = await Hub.create({ name: "Hub", code: "ACCEPTED", location: { type: "Point", coordinates: [106.7, 10.77] }, status: "active" });
    const drone = await Drone.create({ hubId: hub._id, droneCode: "ACCEPTED-1", status: "available", batteryLevel: 95 });
    const submitted = await submit(branch, owner);
    await decide(branch, admin, submitted.body.data.droneDeliveryApplication.submissionId);
    await toggle(branch, owner, true);
    const placed = await checkout(customer, cart, "place");
    const order = await Order.findById(placed.body.orderId);
    order.isPaid = true; order.orderStatus = "pending"; await order.save();
    await toggle(branch, owner, false);
    const result = await assignDroneToOrder(order._id, drone._id, admin);
    expect(result.success).toBe(true);
    const after = await Order.findById(order._id);
    expect(after.deliveryMethod).toBe("drone");
    expect(String(after.droneId)).toBe(String(drone._id));
  });

  it("keeps shipper checkout available without drone approval", async () => {
    const address = { ...shippingAddress, lat: restaurant.lat, lng: restaurant.lng };
    expect((await checkout(customer, cart, "quote", { deliveryMethod: "shipper", address })).status).toBe(200);
    expect((await checkout(customer, cart, "place", { deliveryMethod: "shipper", paymentMethod: "COD", address })).status).toBe(200);
  });

  it("checks the mapped branch and merchant operational state even through restaurantId", async () => {
    await Branch.updateOne({ _id: branch._id }, { droneDeliveryEnabled: true, "droneDeliveryApplication.status": "approved", status: "locked" });
    for (const endpoint of ["quote", "place"]) expect((await checkout(customer, cart, endpoint)).status).toBe(403);
    await Branch.updateOne({ _id: branch._id }, { status: "active" });
    await Merchant.updateOne({ _id: restaurant._id }, { status: "suspended" });
    for (const endpoint of ["quote", "place"]) expect((await checkout(customer, cart, endpoint)).status).toBe(403);
  });
});

describe("Legacy independent restaurant compatibility", () => {
  it("maps only the requesting owner's restaurant without changing IDs, roles or old data", async () => {
    const { owner, restaurant } = await createRestaurantOwner();
    const other = await createRestaurantOwner();
    const food = await createFood(restaurant._id);
    const res = await send("get", "/api/branch/managed", owner);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.data).toHaveLength(1);
    const branch = res.body.data[0];
    expect(branch.code).toBe("MAIN");
    expect(branch.merchantId._id || branch.merchantId).toBe(String(restaurant._id));
    expect(branch.droneDeliveryEnabled).toBe(false);
    expect(branch.droneDeliveryApplication.status).toBe("not_registered");
    expect(await Merchant.countDocuments()).toBe(1);
    expect(await Branch.countDocuments()).toBe(1);
    expect(await Merchant.findById(other.restaurant._id)).toBeNull();
    expect((await User.findById(owner._id)).role).toBe("restaurant_owner");
    expect(await Restaurant.findById(restaurant._id)).not.toBeNull();
    const { Food } = await import("../../models/index.cjs");
    expect(String((await Food.findById(food._id)).restaurantId)).toBe(String(restaurant._id));
    const again = await send("get", "/api/branch/managed", owner);
    expect(again.body.data[0]._id).toBe(branch._id);
    expect(await Branch.countDocuments()).toBe(1);
    expect((await submit({ _id: branch._id }, owner)).status).toBe(201);
  });
});
