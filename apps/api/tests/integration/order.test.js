import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../app.js";
import { Order, ShipperProfile } from "../../models/index.cjs";
import { emitCustomerShipperLocation } from "../../utils/orderRealtime.js";
import {
  createUser,
  createAdmin,
  createRestaurantOwner,
  createFood,
  createOrder,
  generateToken,
} from "../helpers.js";

const ADDRESS = {
  fullName: "Test User",
  address: "123 Test St",
  city: "HCM",
  state: "HCM",
  country: "VN",
  zipCode: "70000",
  phone: "0123456789",
  lat: 10.7769,
  lng: 106.7009,
};

describe("Order API", () => {
  describe("POST /api/order/place", () => {
    it("should place a COD shipper order from the server-side cart", async () => {
      const { restaurant } = await createRestaurantOwner();
      const user = await createUser({ email: "orderer@test.com" });
      const token = generateToken(user._id);
      const food = await createFood(restaurant._id);

      await request(app)
        .post("/api/cart/add")
        .set("Authorization", `Bearer ${token}`)
        .send({ itemId: food._id.toString(), quantity: 2 });

      const res = await request(app)
        .post("/api/order/place")
        .set("Authorization", `Bearer ${token}`)
        .send({ address: ADDRESS, paymentMethod: "COD", deliveryMethod: "shipper" });

      expect(res.body.success).toBe(true);
      expect(res.body.orderId).toBeDefined();

      const order = await Order.findById(res.body.orderId);
      expect(order.paymentMethod).toBe("COD");
      expect(order.orderStatus).toBe("pending");
      expect(order.restaurantId.toString()).toBe(restaurant._id.toString());
      expect(order.currency).toBe("VND");
      expect(order.deliveryMethod).toBe("shipper");
      expect(order.shippingPrice).toBe(0);
      expect(order.totalPrice).toBe(food.price * 2);
    });

    it("should ignore a client-supplied amount and price from the cart", async () => {
      const { restaurant } = await createRestaurantOwner();
      const user = await createUser({ email: "cheapskate@test.com" });
      const token = generateToken(user._id);
      const food = await createFood(restaurant._id);

      await request(app)
        .post("/api/cart/add")
        .set("Authorization", `Bearer ${token}`)
        .send({ itemId: food._id.toString(), quantity: 1 });

      const res = await request(app)
        .post("/api/order/place")
        .set("Authorization", `Bearer ${token}`)
        .send({
          address: ADDRESS,
          paymentMethod: "COD",
          deliveryMethod: "shipper",
          amount: 0.01,
          items: [{ _id: food._id, name: "Free lunch", quantity: 1, price: 0 }],
        });

      const order = await Order.findById(res.body.orderId);
      expect(order.totalPrice).toBe(food.price);
      expect(order.orderItems[0].name).toBe(food.name);
    });

    it("should carry the selected options and note onto the order", async () => {
      const { restaurant } = await createRestaurantOwner();
      const user = await createUser({ email: "optionorder@test.com" });
      const token = generateToken(user._id);
      const food = await createFood(restaurant._id);

      food.optionGroups = [
        {
          name: "Size",
          type: "single",
          required: true,
          min: 1,
          max: 1,
          options: [
            { name: "Regular", priceDelta: 0 },
            { name: "Large", priceDelta: 4 },
          ],
        },
      ];
      await food.save();

      await request(app)
        .post("/api/cart/add")
        .set("Authorization", `Bearer ${token}`)
        .send({
          itemId: food._id.toString(),
          quantity: 1,
          selectedOptions: [{ groupName: "Size", optionName: "Large" }],
          note: "Extra napkins",
        });

      const res = await request(app)
        .post("/api/order/place")
        .set("Authorization", `Bearer ${token}`)
      .send({ address: ADDRESS, paymentMethod: "COD", deliveryMethod: "shipper" });

      const order = await Order.findById(res.body.orderId);
      expect(order.orderItems[0].selectedOptions).toHaveLength(1);
      expect(order.orderItems[0].selectedOptions[0].optionName).toBe("Large");
      expect(order.orderItems[0].selectedOptions[0].priceDelta).toBe(4);
      expect(order.orderItems[0].note).toBe("Extra napkins");
      expect(order.orderItems[0].price).toBe(food.price + 4);
      expect(order.totalPrice).toBe(food.price + 4);
    });

    it("should reject order with an empty cart", async () => {
      const user = await createUser({ email: "noitems@test.com" });
      const token = generateToken(user._id);

      const res = await request(app)
        .post("/api/order/place")
        .set("Authorization", `Bearer ${token}`)
        .send({ address: ADDRESS, paymentMethod: "COD", deliveryMethod: "drone" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should reject order without address", async () => {
      const user = await createUser({ email: "noaddr@test.com" });
      const token = generateToken(user._id);

      const res = await request(app)
        .post("/api/order/place")
        .set("Authorization", `Bearer ${token}`)
        .send({ paymentMethod: "COD" });

      expect(res.status).toBe(400);
    });

    it("should require authentication", async () => {
      const res = await request(app).post("/api/order/place").send({});
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/order/userorders", () => {
    it("should return user orders", async () => {
      const { restaurant } = await createRestaurantOwner();
      const user = await createUser({ email: "myorders@test.com" });
      const token = generateToken(user._id);

      await createOrder(user._id, restaurant._id);
      await createOrder(user._id, restaurant._id);

      const res = await request(app)
        .get("/api/order/userorders")
        .set("Authorization", `Bearer ${token}`);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
    });

    it("should not return other users orders", async () => {
      const { restaurant } = await createRestaurantOwner();
      const user1 = await createUser({ email: "user1orders@test.com" });
      const user2 = await createUser({ email: "user2orders@test.com" });

      await createOrder(user1._id, restaurant._id);

      const token2 = generateToken(user2._id);
      const res = await request(app)
        .get("/api/order/userorders")
        .set("Authorization", `Bearer ${token2}`);

      expect(res.body.data).toHaveLength(0);
    });
  });

  describe("GET /api/order/:id/customer-detail", () => {
    it("should return the authenticated customer's order detail", async () => {
      const { restaurant } = await createRestaurantOwner();
      const user = await createUser({ email: "customer-detail@test.com" });
      const token = generateToken(user._id);
      const order = await createOrder(user._id, restaurant._id);

      const res = await request(app)
        .get(`/api/order/${order._id}/customer-detail`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id).toBe(order._id.toString());
      expect(res.body.data.restaurantId.name).toBe(restaurant.name);
      expect(res.body.data.orderItems[0].product).toBeTruthy();
    });

    it("should not reveal another customer's order", async () => {
      const { restaurant } = await createRestaurantOwner();
      const owner = await createUser({ email: "detail-owner@test.com" });
      const otherUser = await createUser({ email: "detail-other@test.com" });
      const order = await createOrder(owner._id, restaurant._id);

      const res = await request(app)
        .get(`/api/order/${order._id}/customer-detail`)
        .set("Authorization", `Bearer ${generateToken(otherUser._id)}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it("returns a shipper GPS point only after the shipper picked up the order", async () => {
      const { restaurant } = await createRestaurantOwner();
      const customer = await createUser({ email: "customer-live-tracking@test.com" });
      const shipper = await createUser({ role: "shipper", email: "shipper-live-tracking@test.com" });
      const order = await createOrder(customer._id, restaurant._id, {
        deliveryMethod: "shipper",
        shipperId: shipper._id,
        shipperAssignmentStatus: "picked_up",
        shipperPickedUpAt: new Date(),
        orderStatus: "delivering",
        liveShipperRoute: {
          origin: { lat: 10.7784, lng: 106.7012 },
          geometry: [[106.7012, 10.7784], [106.702, 10.779]],
          durationSeconds: 480,
          generatedAt: new Date("2026-09-16T08:00:00.000Z"),
        },
      });
      await ShipperProfile.create({
        user: shipper._id,
        status: "delivering",
        approvalStatus: "approved",
        currentOrder: order._id,
        currentLocation: { type: "Point", coordinates: [106.7012, 10.7784] },
        locationUpdatedAt: new Date("2026-09-16T08:00:00.000Z"),
      });

      const res = await request(app)
        .get(`/api/order/${order._id}/customer-detail`)
        .set("Authorization", `Bearer ${generateToken(customer._id)}`);

      expect(res.status).toBe(200);
      expect(res.body.data.tracking).toEqual({
        location: { lat: 10.7784, lng: 106.7012 },
        updatedAt: "2026-09-16T08:00:00.000Z",
        route: {
          origin: { lat: 10.7784, lng: 106.7012 },
          geometry: [[106.7012, 10.7784], [106.702, 10.779]],
          durationSeconds: 480,
          generatedAt: "2026-09-16T08:00:00.000Z",
        },
      });
    });

    it("stores a valid current live shipper route snapshot", async () => {
      const { restaurant } = await createRestaurantOwner();
      const customer = await createUser({ email: "route-schema@test.com" });
      const order = await createOrder(customer._id, restaurant._id, {
        liveShipperRoute: {
          origin: { lat: 10.7784, lng: 106.7012 },
          geometry: [[106.7012, 10.7784], [106.702, 10.779]],
          durationSeconds: 480,
          generatedAt: new Date("2026-09-17T08:00:00.000Z"),
        },
      });

      expect(order.liveShipperRoute.geometry).toEqual([[106.7012, 10.7784], [106.702, 10.779]]);
      expect(order.liveShipperRoute.durationSeconds).toBe(480);
    });

    it("keeps GPS tracking available after the shipper arrives at the delivery point", async () => {
      const { restaurant } = await createRestaurantOwner();
      const customer = await createUser({ email: "customer-arrival-tracking@test.com" });
      const shipper = await createUser({ role: "shipper", email: "shipper-arrival-tracking@test.com" });
      const order = await createOrder(customer._id, restaurant._id, {
        deliveryMethod: "shipper",
        shipperId: shipper._id,
        shipperAssignmentStatus: "arrived",
        shipperArrivedAt: new Date(),
        orderStatus: "arrived_at_delivery",
        liveShipperRoute: {
          origin: { lat: 10.7784, lng: 106.7012 },
          geometry: [[106.7012, 10.7784], [106.702, 10.779]],
          durationSeconds: 480,
          generatedAt: new Date("2026-09-16T08:00:00.000Z"),
        },
      });
      await ShipperProfile.create({
        user: shipper._id,
        status: "delivering",
        approvalStatus: "approved",
        currentOrder: order._id,
        currentLocation: { type: "Point", coordinates: [106.7012, 10.7784] },
        locationUpdatedAt: new Date("2026-09-16T08:00:00.000Z"),
      });

      const res = await request(app)
        .get(`/api/order/${order._id}/customer-detail`)
        .set("Authorization", `Bearer ${generateToken(customer._id)}`);

      expect(res.status).toBe(200);
      expect(res.body.data.tracking.location).toEqual({ lat: 10.7784, lng: 106.7012 });
      expect(res.body.data.tracking.route.durationSeconds).toBe(480);
    });

    it("returns a provider-safe route-unavailable status while retaining the allowed GPS point", async () => {
      const { restaurant } = await createRestaurantOwner();
      const customer = await createUser({ email: "customer-route-unavailable@test.com" });
      const shipper = await createUser({ role: "shipper", email: "shipper-route-unavailable@test.com" });
      const order = await createOrder(customer._id, restaurant._id, {
        deliveryMethod: "shipper",
        shipperId: shipper._id,
        shipperAssignmentStatus: "picked_up",
        shipperPickedUpAt: new Date(),
        orderStatus: "delivering",
        // This old provider route remains in storage for refresh decisions but
        // must not be presented as current after a failed refresh.
        liveShipperRoute: {
          origin: { lat: 10.7784, lng: 106.7012 },
          geometry: [[106.7012, 10.7784], [106.702, 10.779]],
          durationSeconds: 480,
          generatedAt: new Date("2026-09-16T08:00:00.000Z"),
        },
        liveShipperRouteStatus: "unavailable",
      });
      await ShipperProfile.create({
        user: shipper._id,
        status: "delivering",
        approvalStatus: "approved",
        currentOrder: order._id,
        currentLocation: { type: "Point", coordinates: [106.7012, 10.7784] },
        locationUpdatedAt: new Date("2026-09-16T08:00:00.000Z"),
      });

      const res = await request(app)
        .get(`/api/order/${order._id}/customer-detail`)
        .set("Authorization", `Bearer ${generateToken(customer._id)}`);

      expect(res.status).toBe(200);
      expect(res.body.data.tracking).toEqual({
        location: { lat: 10.7784, lng: 106.7012 },
        updatedAt: "2026-09-16T08:00:00.000Z",
        routeStatus: "unavailable",
      });
      expect(JSON.stringify(res.body.data.tracking)).not.toContain("TRACKASIA_KEY");
    });

    it("does not return a shipper GPS point before pickup or after delivery", async () => {
      const { restaurant } = await createRestaurantOwner();
      const customer = await createUser({ email: "customer-private-tracking@test.com" });
      const shipper = await createUser({ role: "shipper", email: "shipper-private-tracking@test.com" });
      const order = await createOrder(customer._id, restaurant._id, {
        deliveryMethod: "shipper",
        shipperId: shipper._id,
        shipperAssignmentStatus: "accepted",
        orderStatus: "preparing",
      });
      await ShipperProfile.create({
        user: shipper._id,
        status: "assigned",
        approvalStatus: "approved",
        currentOrder: order._id,
        currentLocation: { type: "Point", coordinates: [106.7012, 10.7784] },
        locationUpdatedAt: new Date(),
      });

      const res = await request(app)
        .get(`/api/order/${order._id}/customer-detail`)
        .set("Authorization", `Bearer ${generateToken(customer._id)}`);

      expect(res.status).toBe(200);
      expect(res.body.data.tracking).toBeUndefined();
    });

    it("emits a GPS update only to the owner of an actively delivered order", async () => {
      const { restaurant } = await createRestaurantOwner();
      const customer = await createUser({ email: "customer-location-event@test.com" });
      const shipper = await createUser({ role: "shipper", email: "shipper-location-event@test.com" });
      const order = await createOrder(customer._id, restaurant._id, {
        deliveryMethod: "shipper",
        shipperId: shipper._id,
        shipperAssignmentStatus: "picked_up",
        shipperPickedUpAt: new Date(),
        orderStatus: "delivering",
        liveShipperRoute: {
          origin: { lat: 10.7784, lng: 106.7012 },
          geometry: [[106.7012, 10.7784], [106.702, 10.779]],
          durationSeconds: 480,
          generatedAt: new Date("2026-09-16T08:00:00.000Z"),
        },
      });
      const profile = await ShipperProfile.create({
        user: shipper._id,
        status: "delivering",
        approvalStatus: "approved",
        currentOrder: order._id,
        currentLocation: { type: "Point", coordinates: [106.7012, 10.7784] },
        locationUpdatedAt: new Date("2026-09-16T08:00:00.000Z"),
      });
      const emissions = [];
      const io = { to: (room) => ({ emit: (event, payload) => emissions.push({ room, event, payload }) }) };

      await emitCustomerShipperLocation(io, shipper._id, profile);

      expect(emissions).toEqual([{
        room: `customer_${customer._id}`,
        event: "shipperLocationUpdated",
        payload: {
          orderId: order._id.toString(),
          location: { lat: 10.7784, lng: 106.7012 },
          updatedAt: "2026-09-16T08:00:00.000Z",
          route: {
            origin: { lat: 10.7784, lng: 106.7012 },
            geometry: [[106.7012, 10.7784], [106.702, 10.779]],
            durationSeconds: 480,
            generatedAt: "2026-09-16T08:00:00.000Z",
          },
        },
      }]);

      await Order.findByIdAndUpdate(order._id, { $set: { orderStatus: "delivered" } });
      await emitCustomerShipperLocation(io, shipper._id, profile);
      expect(emissions).toHaveLength(1);
    });

    it("emits a location-only provider-safe route failure update", async () => {
      const { restaurant } = await createRestaurantOwner();
      const customer = await createUser({ email: "customer-route-failure-event@test.com" });
      const shipper = await createUser({ role: "shipper", email: "shipper-route-failure-event@test.com" });
      const order = await createOrder(customer._id, restaurant._id, {
        deliveryMethod: "shipper",
        shipperId: shipper._id,
        shipperAssignmentStatus: "picked_up",
        shipperPickedUpAt: new Date(),
        orderStatus: "delivering",
        liveShipperRoute: {
          origin: { lat: 10.7784, lng: 106.7012 },
          geometry: [[106.7012, 10.7784], [106.702, 10.779]],
          durationSeconds: 480,
          generatedAt: new Date("2026-09-16T08:00:00.000Z"),
        },
        liveShipperRouteStatus: "unavailable",
      });
      const profile = await ShipperProfile.create({
        user: shipper._id,
        status: "delivering",
        approvalStatus: "approved",
        currentOrder: order._id,
        currentLocation: { type: "Point", coordinates: [106.7012, 10.7784] },
        locationUpdatedAt: new Date("2026-09-16T08:00:00.000Z"),
      });
      const emissions = [];
      const io = { to: (room) => ({ emit: (event, payload) => emissions.push({ room, event, payload }) }) };

      await emitCustomerShipperLocation(io, shipper._id, profile);

      expect(emissions).toEqual([{
        room: `customer_${customer._id}`,
        event: "shipperLocationUpdated",
        payload: {
          orderId: order._id.toString(),
          location: { lat: 10.7784, lng: 106.7012 },
          updatedAt: "2026-09-16T08:00:00.000Z",
          routeStatus: "unavailable",
        },
      }]);
      expect(JSON.stringify(emissions)).not.toContain("TRACKASIA_KEY");
      expect(JSON.stringify(emissions)).not.toContain("106.702");
    });

    it("should return not found for an invalid order id", async () => {
      const user = await createUser({ email: "invalid-detail-id@test.com" });

      const res = await request(app)
        .get("/api/order/not-an-order-id/customer-detail")
        .set("Authorization", `Bearer ${generateToken(user._id)}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe("GET /api/order/list", () => {
    it("should allow admin to list all orders", async () => {
      const admin = await createAdmin();
      const token = generateToken(admin._id);
      const { restaurant } = await createRestaurantOwner();

      await createOrder(admin._id, restaurant._id);

      const res = await request(app)
        .get("/api/order/list")
        .set("Authorization", `Bearer ${token}`);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it("should reject regular user", async () => {
      const user = await createUser({ email: "notadmin@test.com" });
      const token = generateToken(user._id);

      const res = await request(app)
        .get("/api/order/list")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe("POST /api/order/status", () => {
    it("should allow admin to update order status when a reason is given", async () => {
      const admin = await createAdmin();
      const token = generateToken(admin._id);
      const { restaurant } = await createRestaurantOwner();
      const order = await createOrder(admin._id, restaurant._id);

      const res = await request(app)
        .post("/api/order/status")
        .set("Authorization", `Bearer ${token}`)
        .send({
          orderId: order._id.toString(),
          status: "preparing",
          reason: "Customer called to confirm by phone",
        });

      expect(res.body.success).toBe(true);

      const updated = await Order.findById(order._id);
      expect(updated.orderStatus).toBe("preparing");
    });

    it("should reject an admin status change with no reason", async () => {
      const admin = await createAdmin();
      const token = generateToken(admin._id);
      const { restaurant } = await createRestaurantOwner();
      const order = await createOrder(admin._id, restaurant._id);

      const res = await request(app)
        .post("/api/order/status")
        .set("Authorization", `Bearer ${token}`)
        .send({ orderId: order._id.toString(), status: "preparing" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);

      // The order must be untouched when the override is refused.
      const untouched = await Order.findById(order._id);
      expect(untouched.orderStatus).toBe("pending");
    });

    it("should write an audit entry for an admin override", async () => {
      const AuditLog = (await import("../../models/auditLogModel.cjs")).default;
      const admin = await createAdmin();
      const token = generateToken(admin._id);
      const { restaurant } = await createRestaurantOwner();
      const order = await createOrder(admin._id, restaurant._id);

      await request(app)
        .post("/api/order/status")
        .set("Authorization", `Bearer ${token}`)
        .send({
          orderId: order._id.toString(),
          status: "preparing",
          reason: "Merchant confirmed by phone",
        });

      const entry = await AuditLog.findOne({ targetId: order._id });
      expect(entry).toBeTruthy();
      expect(entry.action).toBe("order.status_overridden_by_admin");
      expect(entry.reason).toBe("Merchant confirmed by phone");
      expect(entry.metadata.from).toBe("pending");
      expect(entry.metadata.to).toBe("preparing");
    });

    it("should require orderId and status", async () => {
      const admin = await createAdmin();
      const token = generateToken(admin._id);

      const res = await request(app)
        .post("/api/order/status")
        .set("Authorization", `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it("should require reason for cancellation by restaurant owner", async () => {
      const { owner, restaurant } = await createRestaurantOwner();
      const token = generateToken(owner._id);
      const order = await createOrder(owner._id, restaurant._id);

      const res = await request(app)
        .post("/api/order/status")
        .set("Authorization", `Bearer ${token}`)
        .send({ orderId: order._id.toString(), status: "cancelled" });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/[Rr]eason/);
    });

    it("should not let a customer cancel after a shipper has accepted the order", async () => {
      const { restaurant } = await createRestaurantOwner();
      const customer = await createUser({ email: "cancel-after-shipper@test.com" });
      const shipper = await createUser({ role: "shipper", email: "assigned-for-cancel@test.com" });
      const order = await createOrder(customer._id, restaurant._id, {
        deliveryMethod: "shipper",
        shipperId: shipper._id,
        shipperAssignmentStatus: "accepted",
      });

      const res = await request(app)
        .post("/api/order/status")
        .set("Authorization", `Bearer ${generateToken(customer._id)}`)
        .send({ orderId: order._id.toString(), status: "cancelled", reason: "Đổi ý" });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect((await Order.findById(order._id)).orderStatus).toBe("pending");
    });
  });
});
