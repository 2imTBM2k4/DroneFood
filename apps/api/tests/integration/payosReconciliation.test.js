import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import app from "../../app.js";
import { Cart, Notification, Order } from "../../models/index.cjs";
import { createOrder, createRestaurantOwner, createUser, generateToken } from "../helpers.js";
import * as orderService from "../../services/orderService.js";

const gateway = vi.hoisted(() => ({ get: vi.fn(), verify: vi.fn(), cancel: vi.fn(), dispatch: vi.fn() }));
vi.mock("@payos/node", () => ({
  PayOS: class {
    paymentRequests = { get: gateway.get, cancel: gateway.cancel };
    webhooks = { verify: gateway.verify };
  },
}));
vi.mock("../../services/droneService.js", () => ({ dispatchPaidDroneOrder: gateway.dispatch }));

let savedEnv;
let customer;
let order;
const envKeys = ["PAYOS_CLIENT_ID", "PAYOS_API_KEY", "PAYOS_CHECKSUM_KEY"];
const link = (overrides = {}) => ({
  id: "link-test", orderCode: 1760000000123451, amount: 60000,
  amountPaid: 60000, amountRemaining: 0, status: "PAID",
  transactions: [{ reference: "bank-ref", transactionDateTime: "2026-10-15T09:00:00+07:00", amount: 60000 }],
  ...overrides,
});
const event = (overrides = {}) => ({
  orderCode: order.payosOrderCode, amount: 60000, code: "00", paymentLinkId: "link-test",
  reference: "bank-ref", transactionDateTime: "2026-10-15T09:00:00+07:00", ...overrides,
});
const verify = (user = customer, body = {}) => request(app).post("/api/order/verify")
  .set("Authorization", `Bearer ${generateToken(user._id)}`).send({ orderId: String(order._id), ...body });
const webhook = () => request(app).post("/api/order/payos/webhook").send({ signed: "test" });

beforeEach(async () => {
  savedEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  envKeys.forEach((key) => { process.env[key] = "test-only"; });
  vi.resetAllMocks();
  customer = await createUser();
  const { restaurant } = await createRestaurantOwner();
  order = await createOrder(customer._id, restaurant._id, {
    totalPrice: 60000, paymentMethod: "PAYOS", orderStatus: "pending_payment",
    deliveryMethod: "drone", payosOrderCode: 1760000000123451, payosPaymentLinkId: "link-test",
  });
  gateway.get.mockResolvedValue(link());
  gateway.verify.mockImplementation(async () => event());
});
afterEach(() => {
  envKeys.forEach((key) => {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  });
  app.set("io", undefined);
});

describe("PayOS confirmation and reconciliation", () => {
  it("recovers a paid order without a webhook and notifies once", async () => {
    const result = await verify();
    expect(result.status).toBe(200);
    expect(result.body.success).toBe(true);
    expect(await Order.findById(order._id)).toMatchObject({ isPaid: true, orderStatus: "pending" });
    expect(await Notification.countDocuments({ type: "payment.confirmed" })).toBe(1);
    expect(await Notification.countDocuments({ type: "order.new" })).toBe(1);
    expect(gateway.dispatch).toHaveBeenCalledTimes(1);
    const again = await verify();
    expect(again.body.success).toBe(true);
    expect(gateway.get).toHaveBeenCalledTimes(1);
    expect(gateway.dispatch).toHaveBeenCalledTimes(1);
  });

  it("allows only one first settlement when webhook and reconciliation race", async () => {
    // Delay the external boundary so both requests can read the unpaid order.
    const respond = async (value) => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      return value;
    };
    gateway.get.mockImplementation(() => respond(link()));
    gateway.verify.mockImplementation(() => respond(event()));
    const responses = await Promise.all([verify(), webhook()]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(responses[0].body.success).toBe(true);
    expect((await Order.findById(order._id)).isPaid).toBe(true);
    expect(gateway.dispatch).toHaveBeenCalledTimes(1);
    expect(await Notification.countDocuments({ type: "payment.confirmed" })).toBe(1);
    await webhook();
    expect(gateway.dispatch).toHaveBeenCalledTimes(1);
  }, 15000);

  it("does not dispatch twice for concurrent signed webhooks", async () => {
    await Promise.all([webhook(), webhook(), webhook()]);
    expect((await Order.findById(order._id)).isPaid).toBe(true);
    expect(gateway.dispatch).toHaveBeenCalledTimes(1);
  });

  it.each(["PENDING", "UNDERPAID", "PROCESSING", "CANCELLED", "EXPIRED", "FAILED"])("does not settle provider state %s", async (status) => {
    gateway.get.mockResolvedValue(link({ status }));
    const response = await verify(customer, { status: "PAID" });
    expect(response.body.success).toBe(false);
    expect((await Order.findById(order._id)).isPaid).toBe(false);
    expect(gateway.dispatch).not.toHaveBeenCalled();
  });

  it.each([
    { id: "wrong-link" }, { orderCode: 1234 }, { amount: 59999 },
    { amountPaid: 59999, amountRemaining: 1 }, { amount: NaN }, { amountPaid: NaN },
    { amountRemaining: -1 },
  ])("rejects mismatching or incomplete payment evidence %j", async (overrides) => {
    gateway.get.mockResolvedValue(link(overrides));
    const response = await verify();
    expect(response.body.success).toBe(false);
    expect((await Order.findById(order._id)).isPaid).toBe(false);
  });

  it("does not query PayOS for a VNPay order", async () => {
    await Order.updateOne({ _id: order._id }, { paymentMethod: "VNPAY" });
    expect((await verify()).body.success).toBe(false);
    expect(gateway.get).not.toHaveBeenCalled();
  });

  it("does not query or redispatch an already paid order", async () => {
    await Order.updateOne({ _id: order._id }, { isPaid: true, orderStatus: "pending" });
    expect((await verify()).body.success).toBe(true);
    expect(gateway.get).not.toHaveBeenCalled();
    expect(gateway.dispatch).not.toHaveBeenCalled();
    expect(await Notification.countDocuments()).toBe(0);
  });

  it.each(["refund_pending", "delivered"])("records late money without reopening %s", async (orderStatus) => {
    await Order.updateOne({ _id: order._id }, { orderStatus });
    expect((await webhook()).status).toBe(200);
    expect(await Order.findById(order._id)).toMatchObject({ isPaid: true, orderStatus });
    expect(gateway.dispatch).not.toHaveBeenCalled();
    expect(await Notification.countDocuments({ type: "order.new" })).toBe(0);
    expect(await Notification.countDocuments({ type: "payment.confirmed" })).toBe(1);
  });

  it.each([{ amount: 59999 }, { amount: null }, { orderCode: "1760000000123451" }])("rejects invalid signed webhook evidence %j", async (overrides) => {
    gateway.verify.mockResolvedValueOnce(event(overrides));
    expect((await webhook()).status).toBe(400);
    expect(await Order.findById(order._id)).toMatchObject({ isPaid: false, orderStatus: "pending_payment" });
    expect(gateway.dispatch).not.toHaveBeenCalled();
    expect(await Notification.countDocuments()).toBe(0);
  });

  it("does not apply a delayed response to a different payment attempt", async () => {
    gateway.get.mockImplementation(async () => {
      await Order.updateOne({ _id: order._id }, { payosOrderCode: 1760000000123452, payosPaymentLinkId: "replacement-link" });
      return link();
    });
    expect((await verify()).status).toBe(400);
    expect(await Order.findById(order._id)).toMatchObject({ isPaid: false, orderStatus: "pending_payment", payosPaymentLinkId: "replacement-link" });
    expect(gateway.dispatch).not.toHaveBeenCalled();
  });

  it("starts the shipper assignment window once when reconciliation recovers payment", async () => {
    await Order.updateOne({ _id: order._id }, { deliveryMethod: "shipper" });
    const before = Date.now();
    expect((await verify()).body.success).toBe(true);
    const paid = await Order.findById(order._id);
    expect(paid.shipperAssignmentStatus).toBe("unassigned");
    expect(paid.shipperAssignmentDeadlineAt.getTime()).toBeGreaterThanOrEqual(before + 600000);
    expect(paid.shipperAssignmentDeadlineAt.getTime()).toBeLessThanOrEqual(Date.now() + 600000);
    await webhook();
    expect((await Order.findById(order._id)).shipperAssignmentDeadlineAt).toEqual(paid.shipperAssignmentDeadlineAt);
    expect(await Notification.countDocuments({ type: "order.new" })).toBe(1);
    expect(gateway.dispatch).not.toHaveBeenCalled();
  });

  it("checks ownership before asking PayOS", async () => {
    const stranger = await createUser();
    expect((await verify(stranger)).status).toBe(403);
    expect(gateway.get).not.toHaveBeenCalled();
  });

  it("requires authentication", async () => {
    expect((await request(app).post("/api/order/verify").send({ orderId: String(order._id) })).status).toBe(401);
    expect(gateway.get).not.toHaveBeenCalled();
  });

  it.each([{ paymentMethod: "COD" }, { orderStatus: "cancelled" }, { payosOrderCode: undefined, payosPaymentLinkId: null }])("does not query ineligible orders %j", async (changes) => {
    if ("payosOrderCode" in changes) await Order.updateOne({ _id: order._id }, { $unset: { payosOrderCode: 1 }, $set: { payosPaymentLinkId: null } });
    else await Order.updateOne({ _id: order._id }, changes);
    expect((await verify()).body.success).toBe(false);
    expect(gateway.get).not.toHaveBeenCalled();
  });

  it("keeps the order unpaid when provider/signature verification fails", async () => {
    gateway.get.mockRejectedValue(new Error("provider-secret-must-not-leak"));
    const response = await verify();
    expect(response.body.success).toBe(false);
    expect(JSON.stringify(response.body)).not.toContain("provider-secret");
    expect(await Order.findById(order._id)).toMatchObject({ isPaid: false, orderStatus: "pending_payment" });
  });

  it("rejects a webhook with a wrong link or invalid signature", async () => {
    gateway.verify.mockResolvedValueOnce(event({ paymentLinkId: "wrong" }));
    expect((await webhook()).status).toBe(400);
    gateway.verify.mockRejectedValueOnce(new Error("invalid signature"));
    expect((await webhook()).status).toBe(400);
    expect((await Order.findById(order._id)).isPaid).toBe(false);
  });

  it("records late money without resurrecting or dispatching a cancelled order", async () => {
    await Order.updateOne({ _id: order._id }, { orderStatus: "cancelled", dronePhase: "cancelled" });
    expect((await webhook()).status).toBe(200);
    expect(await Order.findById(order._id)).toMatchObject({ isPaid: true, orderStatus: "cancelled", dronePhase: "cancelled" });
    expect(gateway.dispatch).not.toHaveBeenCalled();
    expect(await Notification.countDocuments({ type: "order.new" })).toBe(0);
  });

  it("emits the update event consumed by an open customer detail page", async () => {
    const emit = vi.fn();
    app.set("io", { to: () => ({ emit }) });
    await verify();
    expect(emit).toHaveBeenCalledWith("orderStatusUpdated", expect.objectContaining({ orderId: String(order._id) }));
  });

  it("does not restart the shipper deadline for duplicate confirmations", async () => {
    await Order.updateOne({ _id: order._id }, { deliveryMethod: "shipper" });
    await orderService.handlePayosWebhook({});
    const paid = await Order.findById(order._id);
    await orderService.handlePayosWebhook({});
    expect((await Order.findById(order._id)).shipperAssignmentDeadlineAt).toEqual(paid.shipperAssignmentDeadlineAt);
  });

  it("does not delete newly added cart quantities when confirmation repeats", async () => {
    const item = order.orderItems[0];
    const cart = await Cart.create({ userId: customer._id, restaurantId: order.restaurantId, items: [{ lineKey: String(item.product), foodId: item.product, quantity: 3 }] });
    await Order.updateOne({ _id: order._id }, { sourceCartId: cart._id, sourceCartVersion: cart.__v + 1, sourceCartItems: [{ lineKey: String(item.product), quantity: 1 }] });
    await verify();
    await webhook();
    expect((await Cart.findById(cart._id)).items[0].quantity).toBe(2);
  });

  it("does not claim cancellation if PayOS cannot cancel the link", async () => {
    gateway.cancel.mockRejectedValue(new Error("network down"));
    await expect(orderService.updateStatus(customer, { orderId: String(order._id), status: "cancelled", reason: "Changed mind" })).rejects.toThrow();
    expect((await Order.findById(order._id)).orderStatus).toBe("pending_payment");
  });

  it("cancels only after the gateway confirms a matching unpaid link", async () => {
    gateway.cancel.mockResolvedValue(link({ status: "CANCELLED", amountPaid: 0, amountRemaining: 60000 }));
    const result = await orderService.updateStatus(customer, { orderId: String(order._id), status: "cancelled", reason: "Changed mind" });
    expect(result.success).toBe(true);
    expect(await Order.findById(order._id)).toMatchObject({ isPaid: false, orderStatus: "cancelled", dronePhase: "cancelled" });
    expect(gateway.cancel).toHaveBeenCalledWith("link-test", "Changed mind", expect.objectContaining({ timeout: 8000, maxRetries: 0 }));
    expect(gateway.dispatch).not.toHaveBeenCalled();
  });

  it("does not overwrite payment confirmed while gateway cancellation was in flight", async () => {
    gateway.cancel.mockImplementation(async () => {
      await orderService.handlePayosWebhook({});
      return link({ status: "CANCELLED", amountPaid: 0, amountRemaining: 60000 });
    });
    await expect(orderService.updateStatus(customer, { orderId: String(order._id), status: "cancelled", reason: "Changed mind" })).rejects.toMatchObject({ statusCode: 409 });
    expect(await Order.findById(order._id)).toMatchObject({ isPaid: true, orderStatus: "pending" });
    expect(gateway.dispatch).toHaveBeenCalledTimes(1);
  });

  it("preserves cancellation when a verification response arrives later", async () => {
    gateway.cancel.mockResolvedValue(link({ status: "CANCELLED", amountPaid: 0, amountRemaining: 60000 }));
    gateway.get.mockImplementation(async () => {
      await orderService.updateStatus(customer, { orderId: String(order._id), status: "cancelled", reason: "Changed mind" });
      return link();
    });
    const result = await verify();
    expect(result.body.success).toBe(true);
    expect(await Order.findById(order._id)).toMatchObject({ isPaid: true, orderStatus: "cancelled", dronePhase: "cancelled" });
    expect(gateway.dispatch).not.toHaveBeenCalled();
    expect(await Notification.countDocuments({ type: "order.new" })).toBe(0);
    expect(await Notification.countDocuments({ type: "payment.confirmed" })).toBe(1);
  });

  it.each([
    { status: "CANCELLED", amountPaid: 10000 },
    { status: "CANCELLED", amountPaid: 0, id: "wrong-link" },
    { status: "PENDING", amountPaid: 0 },
  ])("does not cancel with unsafe gateway evidence %j", async (overrides) => {
    gateway.cancel.mockResolvedValue(link(overrides));
    await expect(orderService.updateStatus(customer, { orderId: String(order._id), status: "cancelled", reason: "Changed mind" })).rejects.toThrow();
    expect(await Order.findById(order._id)).toMatchObject({ isPaid: false, orderStatus: "pending_payment" });
  });

  it("does not cancel a gateway-paid order even before webhook arrival", async () => {
    gateway.cancel.mockResolvedValue(link());
    await expect(orderService.updateStatus(customer, { orderId: String(order._id), status: "cancelled", reason: "Changed mind" })).rejects.toThrow();
    expect((await Order.findById(order._id)).orderStatus).toBe("pending_payment");
  });
});
