import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../services/shipperRouteService.js", () => ({
  shouldRefreshLiveRoute: vi.fn(() => true),
  fetchLiveShipperRoute: vi.fn(async ({ origin }) => ({
    origin,
    geometry: [[origin.lng, origin.lat], [106.705, 10.78]],
    durationSeconds: 480,
    generatedAt: new Date("2026-09-17T08:00:00.000Z"),
  })),
}));

import { Order, ShipperProfile, ShipperDeposit } from "../../models/index.cjs";
import { createRestaurantOwner, createUser } from "../helpers.js";
import * as shipperService from "../../services/shipperService.js";
import * as orderService from "../../services/orderService.js";

const point = (lng, lat) => ({ type: "Point", coordinates: [lng, lat] });
const routeService = await import("../../services/shipperRouteService.js");

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
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(routeService.shouldRefreshLiveRoute).mockReturnValue(true);
    vi.mocked(routeService.fetchLiveShipperRoute).mockImplementation(async ({ origin }) => ({
      origin,
      geometry: [[origin.lng, origin.lat], [106.705, 10.78]],
      durationSeconds: 480,
      generatedAt: new Date("2026-09-17T08:00:00.000Z"),
    }));
  });

  it("persists a projected route while keeping a live delivery GPS point fresh", async () => {
    const { restaurant } = await createRestaurantOwner();
    const customer = await createUser({ email: "customer-route-update@test.com" });
    const shipper = await makeShipper("route-update");
    const order = await makeOrder(customer._id, restaurant._id, {
      orderStatus: "delivering",
      shipperId: shipper._id,
      shipperAssignmentStatus: "picked_up",
      shipperPickedUpAt: new Date(),
      shippingAddress: { fullName: "Customer", address: "A", city: "HCM", state: "HCM", country: "VN", phone: "0900000000", lat: 10.78, lng: 106.705 },
    });
    await ShipperProfile.findOneAndUpdate({ user: shipper._id }, { $set: { status: "delivering", currentOrder: order._id } });

    const result = await shipperService.updateLocation(shipper._id, { lat: 10.7784, lng: 106.7012 });
    const saved = await Order.findById(order._id).lean();

    expect(result.data.currentLocation.coordinates).toEqual([106.7012, 10.7784]);
    expect(routeService.fetchLiveShipperRoute).toHaveBeenCalledWith(expect.objectContaining({
      origin: { lat: 10.7784, lng: 106.7012 },
      destination: expect.objectContaining({ lat: 10.78, lng: 106.705 }),
    }));
    expect(saved.liveShipperRoute).toMatchObject({
      origin: { lat: 10.7784, lng: 106.7012 },
      geometry: [[106.7012, 10.7784], [106.705, 10.78]],
      durationSeconds: 480,
    });
  });

  it("keeps GPS updates available when route calculation fails", async () => {
    const { restaurant } = await createRestaurantOwner();
    const customer = await createUser({ email: "customer-route-failure@test.com" });
    const shipper = await makeShipper("route-failure");
    const priorRoute = {
      origin: { lat: 10.7769, lng: 106.7009 },
      geometry: [[106.7009, 10.7769], [106.705, 10.78]],
      durationSeconds: 510,
      generatedAt: new Date("2026-09-17T07:59:00.000Z"),
    };
    const order = await makeOrder(customer._id, restaurant._id, {
      orderStatus: "delivering",
      shipperId: shipper._id,
      shipperAssignmentStatus: "picked_up",
      shipperPickedUpAt: new Date(),
      shippingAddress: { fullName: "Customer", address: "A", city: "HCM", state: "HCM", country: "VN", phone: "0900000000", lat: 10.78, lng: 106.705 },
      liveShipperRoute: priorRoute,
    });
    await ShipperProfile.findOneAndUpdate({ user: shipper._id }, { $set: { status: "delivering", currentOrder: order._id } });
    vi.mocked(routeService.fetchLiveShipperRoute).mockRejectedValueOnce(new Error("provider unavailable"));

    const result = await shipperService.updateLocation(shipper._id, { lat: 10.7784, lng: 106.7012 });
    const saved = await Order.findById(order._id).lean();

    expect(result.data.currentLocation.coordinates).toEqual([106.7012, 10.7784]);
    expect(saved.liveShipperRoute.geometry).toEqual(priorRoute.geometry);
  });

  it("blocks pickup outside the restaurant geofence and allows it within 200 metres", async () => {
    const { restaurant } = await createRestaurantOwner();
    const customer = await createUser({ email: "customer-pickup-geofence@test.com" });
    const shipper = await makeShipper("pickup-geofence", [106.7009, 10.7805]);
    const order = await makeOrder(customer._id, restaurant._id, {
      orderStatus: "preparing",
      shipperId: shipper._id,
      shipperAssignmentStatus: "accepted",
    });
    await ShipperProfile.findOneAndUpdate({ user: shipper._id }, { $set: { status: "assigned", currentOrder: order._id } });

    await expect(shipperService.pickupOrder(shipper, order._id)).rejects.toThrow(
      "Vị trí của bạn chưa gần quán. Hãy đến trong phạm vi 200 m để xác nhận lấy hàng."
    );

    await ShipperProfile.findOneAndUpdate({ user: shipper._id }, {
      $set: { currentLocation: point(restaurant.lng, restaurant.lat), locationUpdatedAt: new Date() },
    });
    await expect(shipperService.pickupOrder(shipper, order._id)).resolves.toMatchObject({ success: true });
    const pickedUp = await Order.findById(order._id);
    expect(pickedUp.orderStatus).toBe("delivering");
    expect(pickedUp.shipperAssignmentStatus).toBe("picked_up");
  });

  it("requires customer proximity before arriving and arrival before completion", async () => {
    const { restaurant } = await createRestaurantOwner();
    const customer = await createUser({ email: "customer-arrival-geofence@test.com" });
    const shipper = await makeShipper("arrival-geofence", [106.7009, 10.7769]);
    const order = await makeOrder(customer._id, restaurant._id, {
      orderStatus: "delivering",
      shipperId: shipper._id,
      shipperAssignmentStatus: "picked_up",
      shipperPickedUpAt: new Date(),
      shippingAddress: { fullName: "Customer", address: "A", city: "HCM", state: "HCM", country: "VN", phone: "0900000000", lat: 10.79, lng: 106.72 },
    });
    await ShipperProfile.findOneAndUpdate({ user: shipper._id }, { $set: { status: "delivering", currentOrder: order._id } });

    await expect(shipperService.arriveAtDelivery(shipper, order._id)).rejects.toThrow(
      "Vị trí của bạn chưa gần điểm giao. Hãy đến trong phạm vi 200 m để xác nhận đã tới điểm giao."
    );
    await expect(shipperService.completeOrder(shipper, order._id)).rejects.toThrow(
      "Cannot complete before confirming arrival at the delivery point"
    );

    await ShipperProfile.findOneAndUpdate({ user: shipper._id }, {
      $set: { currentLocation: point(106.72, 10.79), locationUpdatedAt: new Date() },
    });
    await expect(shipperService.arriveAtDelivery(shipper, order._id)).resolves.toMatchObject({ success: true });
    const arrived = await Order.findById(order._id);
    expect(arrived.orderStatus).toBe("arrived_at_delivery");
    expect(arrived.shipperAssignmentStatus).toBe("arrived");
    expect(arrived.shipperArrivedAt).toBeTruthy();
  });

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
