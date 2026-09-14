import { describe, expect, it } from "vitest";
import { Order, ShipperProfile, ShipperDeposit } from "../../models/index.cjs";
import { createRestaurantOwner, createUser } from "../helpers.js";
import * as shipperService from "../../services/shipperService.js";
import * as orderService from "../../services/orderService.js";

const point = (lng, lat) => ({ type: "Point", coordinates: [lng, lat] });

const makeShipper = async (suffix, coordinates = [106.7009, 10.7769]) => {
  const user = await createUser({ role: "shipper", email: `shipper-${suffix}@test.com` });
  await ShipperProfile.create({
    user: user._id,
    approvalStatus: "approved",
    status: "available",
    currentLocation: point(...coordinates),
    locationUpdatedAt: new Date(),
  });
  await ShipperDeposit.create({ user: user._id, shipper: user._id, balance: 350000 });
  return user;
};

const makeOrder = async (userId, restaurantId, overrides = {}) =>
  Order.create({
    user: userId,
    restaurantId,
    orderItems: [{ product: restaurantId, name: "Food", quantity: 1, price: 50000 }],
    shippingAddress: { fullName: "Customer", address: "A", city: "HCM", state: "HCM", country: "VN", phone: "0900000000" },
    paymentMethod: "COD",
    itemsPrice: 50000,
    shippingPrice: 5000,
    totalPrice: 55000,
    deliveryMethod: "shipper",
    pickupLocation: point(106.701, 10.777),
    shipperAssignmentStatus: "unassigned",
    shipperAssignmentDeadlineAt: new Date(Date.now() + 15 * 60 * 1000),
    financialSnapshot: {
      restaurantSharePercent: 80,
      platformFoodCommissionPercent: 20,
      shipperDeliverySharePercent: 85,
      platformDeliverySharePercent: 15,
      restaurantPayoutAmount: 40000,
      shipperOnlineEarningsAmount: 4250,
      codLiabilityAmount: 50750,
    },
    ...overrides,
  });

describe("Shipper dispatch", () => {
  it("exposes unassigned shipper orders within 5 km of the pickup", async () => {
    const { restaurant } = await createRestaurantOwner();
    const customer = await createUser({ email: "customer-near@test.com" });
    const shipper = await makeShipper("near");
    const near = await makeOrder(customer._id, restaurant._id);
    const withinFiveKm = await makeOrder(customer._id, restaurant._id, { pickupLocation: point(106.701, 10.817) });
    await makeOrder(customer._id, restaurant._id, { pickupLocation: point(106.701, 10.823) });

    const result = await shipperService.availableOrders(shipper._id);
    expect(result.data.map((order) => String(order._id))).toEqual([String(near._id), String(withinFiveKm._id)]);
  });

  it("keeps finding and accepting a shipper after the restaurant starts preparing", async () => {
    const { restaurant } = await createRestaurantOwner();
    const customer = await createUser({ email: "customer-preparing@test.com" });
    const shipper = await makeShipper("preparing");
    const order = await makeOrder(customer._id, restaurant._id, { orderStatus: "preparing" });

    const offers = await shipperService.availableOrders(shipper._id);
    expect(offers.data.map((item) => String(item._id))).toContain(String(order._id));

    await shipperService.acceptOrder(shipper, order._id);
    const accepted = await Order.findById(order._id);
    expect(accepted.orderStatus).toBe("preparing");
    expect(accepted.shipperAssignmentStatus).toBe("accepted");
  });

  it("atomically lets only one available shipper accept an order", async () => {
    const { restaurant } = await createRestaurantOwner();
    const customer = await createUser({ email: "customer-race@test.com" });
    const order = await makeOrder(customer._id, restaurant._id);
    const first = await makeShipper("first");
    const second = await makeShipper("second");

    const attempts = await Promise.allSettled([
      shipperService.acceptOrder(first, order._id),
      shipperService.acceptOrder(second, order._id),
    ]);
    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.status === "rejected")).toHaveLength(1);

    const claimed = await Order.findById(order._id);
    expect(claimed.shipperAssignmentStatus).toBe("accepted");
    expect([String(first._id), String(second._id)]).toContain(String(claimed.shipperId));
  });

  it("expires only overdue unassigned shipper orders", async () => {
    const { restaurant } = await createRestaurantOwner();
    const customer = await createUser({ email: "customer-expire@test.com" });
    const overdue = await makeOrder(customer._id, restaurant._id, {
      orderStatus: "preparing",
      shipperAssignmentDeadlineAt: new Date(Date.now() - 1),
    });
    const active = await makeOrder(customer._id, restaurant._id);

    const result = await shipperService.expireUnacceptedOrders();
    expect(result.cancelledCount).toBe(1);
    expect((await Order.findById(overdue._id)).cancellationCode).toBe("NO_SHIPPER_AVAILABLE");
    expect((await Order.findById(active._id)).orderStatus).toBe("pending");
  });

  it("keeps a paid PayOS order pending and lets its customer continue searching after timeout", async () => {
    const { restaurant } = await createRestaurantOwner();
    const customer = await createUser({ email: "customer-continue-search@test.com" });
    const order = await makeOrder(customer._id, restaurant._id, {
      paymentMethod: "PAYOS",
      isPaid: true,
      paidAt: new Date(),
      shipperAssignmentDeadlineAt: new Date(Date.now() - 1),
    });

    await shipperService.expireUnacceptedOrders();
    const timedOut = await Order.findById(order._id);
    expect(timedOut.orderStatus).toBe("pending");
    expect(timedOut.shipperAssignmentStatus).toBe("expired");

    const result = await shipperService.extendSearch(customer, order._id);
    expect(result.data.shipperAssignmentStatus).toBe("unassigned");
    expect(result.data.shipperAssignmentDeadlineAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("normalizes an old paid shipper order without assignment fields into the customer-decision state", async () => {
    const { restaurant } = await createRestaurantOwner();
    const customer = await createUser({ email: "customer-legacy-timeout@test.com" });
    const legacy = await makeOrder(customer._id, restaurant._id, {
      paymentMethod: "PAYOS",
      isPaid: true,
      paidAt: new Date(),
      orderStatus: "preparing",
      shipperAssignmentStatus: "not_applicable",
      shipperAssignmentDeadlineAt: null,
    });

    await shipperService.expireUnacceptedOrders();
    const updated = await Order.findById(legacy._id);
    expect(updated.orderStatus).toBe("pending");
    expect(updated.shipperAssignmentStatus).toBe("expired");
    expect(updated.cancellationCode).toBe("NO_SHIPPER_AVAILABLE");
  });

  it("requires a shipper to accept before the restaurant starts preparing", async () => {
    const { owner, restaurant } = await createRestaurantOwner();
    const customer = await createUser({ email: "customer-wait-shipper@test.com" });
    const order = await makeOrder(customer._id, restaurant._id);

    await expect(orderService.updateStatus(owner, {
      orderId: order._id,
      status: "preparing",
    })).rejects.toThrow("Wait for a shipper");
  });

  it("keeps the restaurant from marking a shipper order as picked up", async () => {
    const { owner, restaurant } = await createRestaurantOwner();
    const customer = await createUser({ email: "customer-handover@test.com" });
    const order = await makeOrder(customer._id, restaurant._id, { orderStatus: "preparing" });

    await expect(orderService.updateStatus(owner, {
      orderId: order._id,
      status: "delivering",
    })).rejects.toThrow("assigned shipper");
  });

  it("repairs an older shipper account that has no profile", async () => {
    const orphan = await createUser({ role: "shipper", email: "shipper-orphan@test.com" });

    const result = await shipperService.me(orphan._id);

    expect(result.data.user.toString()).toBe(orphan._id.toString());
    expect(result.data.approvalStatus).toBe("pending");
  });
});
