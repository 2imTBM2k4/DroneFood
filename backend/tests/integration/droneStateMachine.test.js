import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../../app.js";
import { Order } from "../../models/index.cjs";
import Drone from "../../models/droneModel.cjs";
import {
  createUser,
  createAdmin,
  createRestaurantOwner,
  createOrder,
  generateToken,
} from "../helpers.js";

describe("Drone Delivery State Machine & Safety Reassign", () => {
  let admin, adminToken;
  let owner, restaurant, ownerToken;
  let customer, customerToken;

  beforeEach(async () => {
    admin = await createAdmin();
    adminToken = generateToken(admin._id);

    const restSetup = await createRestaurantOwner();
    owner = restSetup.owner;
    restaurant = restSetup.restaurant;
    ownerToken = generateToken(owner._id);

    customer = await createUser({ email: "customer-drone@test.com" });
    customerToken = generateToken(customer._id);
  });

  it("dispatches available drone atomically upon paid order and sets phase to assigned", async () => {
    const drone = await Drone.create({
      droneCode: "DRONE-01",
      status: "available",
      batteryLevel: 85,
    });

    const order = await createOrder(customer._id, restaurant._id, {
      deliveryMethod: "drone",
      paymentMethod: "VNPAY",
      isPaid: true,
      orderStatus: "pending",
    });

    const { dispatchPaidDroneOrder } = await import("../../services/droneService.js");
    const dispatchRes = await dispatchPaidDroneOrder(order._id);

    expect(dispatchRes.success).toBe(true);
    expect(dispatchRes.droneDispatched).toBe(true);
    expect(String(dispatchRes.droneId)).toBe(String(drone._id));

    const updatedOrder = await Order.findById(order._id);
    expect(updatedOrder.dronePhase).toBe("assigned");
    expect(String(updatedOrder.droneId)).toBe(String(drone._id));
    expect(updatedOrder.qrCode).toBeNull(); // QR code is NOT generated at assignment!

    const updatedDrone = await Drone.findById(drone._id);
    expect(updatedDrone.status).toBe("delivering");
    expect(String(updatedDrone.currentOrder)).toBe(String(order._id));
  });

  it("sets phase to fallback_pending_customer_consent when no suitable drone is available", async () => {
    // Drone with low battery (<30%) cannot fly
    await Drone.create({
      droneCode: "DRONE-LOW",
      status: "available",
      batteryLevel: 20,
    });

    const order = await createOrder(customer._id, restaurant._id, {
      deliveryMethod: "drone",
      paymentMethod: "VNPAY",
      isPaid: true,
      orderStatus: "pending",
    });

    const { dispatchPaidDroneOrder } = await import("../../services/droneService.js");
    const dispatchRes = await dispatchPaidDroneOrder(order._id);

    expect(dispatchRes.success).toBe(true);
    expect(dispatchRes.droneDispatched).toBe(false);
    expect(dispatchRes.fallbackPrompt).toBe(true);

    const updatedOrder = await Order.findById(order._id);
    expect(updatedOrder.dronePhase).toBe("fallback_pending_customer_consent");
    expect(updatedOrder.droneId).toBeNull();
    expect(updatedOrder.droneFallbackDeadlineAt).toBeDefined();
    // Do NOT automatically convert to shipper before consent
    expect(updatedOrder.deliveryMethod).toBe("drone");
    expect(updatedOrder.shipperId).toBeNull();
  });

  it("handles preflight check pass and fail flows properly", async () => {
    const drone = await Drone.create({
      droneCode: "DRONE-02",
      status: "delivering",
      batteryLevel: 90,
    });

    const order = await createOrder(customer._id, restaurant._id, {
      deliveryMethod: "drone",
      paymentMethod: "VNPAY",
      isPaid: true,
      orderStatus: "pending",
      droneId: drone._id,
      dronePhase: "assigned",
    });

    // 1. Preflight check pass
    const passRes = await request(app)
      .post("/api/drone/preflight")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        orderId: order._id.toString(),
        passed: true,
        checklist: { rotors: "ok", sensors: "ok", gps: "ok" },
      });

    expect(passRes.status).toBe(200);
    expect(passRes.body.success).toBe(true);
    expect(passRes.body.phase).toBe("en_route_to_restaurant");

    let updatedOrder = await Order.findById(order._id);
    expect(updatedOrder.dronePhase).toBe("en_route_to_restaurant");
    expect(updatedOrder.dronePreflightStatus).toBe("passed");

    // 2. Preflight check fail on another order -> Drone must go to maintenance, NOT available
    const droneFail = await Drone.create({
      droneCode: "DRONE-FAIL",
      status: "delivering",
      batteryLevel: 90,
    });
    const orderFail = await createOrder(customer._id, restaurant._id, {
      deliveryMethod: "drone",
      paymentMethod: "VNPAY",
      isPaid: true,
      orderStatus: "pending",
      droneId: droneFail._id,
      dronePhase: "assigned",
    });

    const failRes = await request(app)
      .post("/api/drone/preflight")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        orderId: orderFail._id.toString(),
        passed: false,
        checklist: { rotors: "damaged" },
        notes: "Motor #3 sensor fault",
      });

    expect(failRes.status).toBe(200);
    expect(failRes.body.success).toBe(false);
    expect(failRes.body.phase).toBe("preflight_failed");

    const updatedDroneFail = await Drone.findById(droneFail._id);
    expect(updatedDroneFail.status).toBe("maintenance"); // Must be maintenance!
  });

  it("blocks restaurant handover if drone has not arrived, and generates QR once arrived", async () => {
    const drone = await Drone.create({
      droneCode: "DRONE-03",
      status: "delivering",
      batteryLevel: 95,
    });

    const order = await createOrder(customer._id, restaurant._id, {
      deliveryMethod: "drone",
      paymentMethod: "VNPAY",
      isPaid: true,
      orderStatus: "preparing",
      droneId: drone._id,
      dronePhase: "en_route_to_restaurant",
    });

    // Try handover while drone is still en route to restaurant -> MUST FAIL 409
    const earlyHandover = await request(app)
      .post("/api/drone/handover")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ orderId: order._id.toString() });

    expect(earlyHandover.status).toBe(409);

    // Drone arrives at restaurant
    const arriveRes = await request(app)
      .post("/api/drone/arrived-restaurant")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ orderId: order._id.toString() });

    expect(arriveRes.status).toBe(200);
    expect(arriveRes.body.phase).toBe("awaiting_restaurant_handover");

    // Now restaurant handover succeeds -> QR code created and activated!
    const handoverSuccess = await request(app)
      .post("/api/drone/handover")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ orderId: order._id.toString() });

    expect(handoverSuccess.status).toBe(200);
    expect(handoverSuccess.body.success).toBe(true);
    expect(handoverSuccess.body.data.qrCode).toBeDefined();
    expect(handoverSuccess.body.data.dronePhase).toBe("en_route_to_customer");

    const finishedOrder = await Order.findById(order._id);
    expect(finishedOrder.qrCode).toBeTruthy();
    expect(finishedOrder.dronePhase).toBe("en_route_to_customer");
    expect(finishedOrder.orderStatus).toBe("delivering");
  });

  it("rejects reassigning drone with 409 when in flight, puts faulty drone in maintenance, and resets QR", async () => {
    const drone1 = await Drone.create({
      droneCode: "DRONE-FLYING",
      status: "delivering",
      batteryLevel: 80,
    });
    const drone2 = await Drone.create({
      droneCode: "DRONE-SPARE",
      status: "available",
      batteryLevel: 90,
    });

    const order = await createOrder(customer._id, restaurant._id, {
      deliveryMethod: "drone",
      paymentMethod: "VNPAY",
      isPaid: true,
      orderStatus: "delivering",
      droneId: drone1._id,
      dronePhase: "en_route_to_customer",
      qrCode: "OLDQR123456",
    });

    // 1. Attempt reassign while flying en_route_to_customer -> MUST REJECT WITH 409
    const flyingReassignRes = await request(app)
      .post("/api/drone/reassign")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        orderId: order._id.toString(),
        droneId: drone2._id.toString(),
        reason: "Mid-air battery alert",
      });

    expect(flyingReassignRes.status).toBe(409);
    expect(flyingReassignRes.body.message).toContain("đang bay");

    // 2. Reassign when safe (e.g., at assigned phase before takeoff)
    order.dronePhase = "assigned";
    await order.save();

    const safeReassignRes = await request(app)
      .post("/api/drone/reassign")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        orderId: order._id.toString(),
        droneId: drone2._id.toString(),
        reason: "Pre-takeoff motor glitch",
      });

    expect(safeReassignRes.status).toBe(200);
    expect(safeReassignRes.body.success).toBe(true);

    // Old drone MUST be set to MAINTENANCE, not available!
    const oldDrone = await Drone.findById(drone1._id);
    expect(oldDrone.status).toBe("maintenance");

    // New drone is assigned, old QR is invalidated (null), and phase reset to assigned
    const updatedOrder = await Order.findById(order._id);
    expect(String(updatedOrder.droneId)).toBe(String(drone2._id));
    expect(updatedOrder.qrCode).toBeNull();
    expect(updatedOrder.dronePhase).toBe("assigned");
  });

  it("handles fallback consent: cancels old drone order, initiates refund, customer creates new shipper order", async () => {
    const order = await createOrder(customer._id, restaurant._id, {
      deliveryMethod: "drone",
      paymentMethod: "PAYOS",
      isPaid: true,
      orderStatus: "pending",
      dronePhase: "fallback_pending_customer_consent",
      droneFallbackDeadlineAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    // Customer accepts fallback to shipper
    const consentRes = await request(app)
      .post("/api/drone/fallback-consent")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        orderId: order._id.toString(),
        consent: "accept_shipper",
      });

    expect(consentRes.status).toBe(200);
    expect(consentRes.body.success).toBe(true);
    expect(consentRes.body.data.orderStatus).toBe("cancelled");
    expect(consentRes.body.data.dronePhase).toBe("cancelled");
    expect(consentRes.body.data.refundStatus).toBe("requested");
    expect(consentRes.body.data.canOrderShipperNew).toBe(true);

    const cancelledOrder = await Order.findById(order._id);
    expect(cancelledOrder.orderStatus).toBe("cancelled");
    expect(cancelledOrder.dronePhase).toBe("cancelled");
    expect(cancelledOrder.deliveryMethod).toBe("drone"); // The original order remains a drone order, but cancelled!
  });
});
