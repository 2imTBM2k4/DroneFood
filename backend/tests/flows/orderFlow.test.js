import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../app.js";
import { Order, Restaurant, ShipperDeposit, ShipperEarningsWallet, ShipperProfile, WalletTransaction } from "../../models/index.cjs";
import { createFood, createRestaurantOwner, createUser, generateToken } from "../helpers.js";
import * as shipperService from "../../services/shipperService.js";

const address = {
  fullName: "Customer", address: "1 Nguyen Hue", city: "HCM", state: "HCM", country: "VN", zipCode: "70000",
  phone: "0900000000", lat: 10.7769, lng: 106.7009,
};
const point = { type: "Point", coordinates: [106.7009, 10.7769] };

const makeShipper = async () => {
  const shipper = await createUser({ role: "shipper", email: "phase-shipper@test.com" });
  await ShipperProfile.create({ user: shipper._id, approvalStatus: "approved", status: "available", currentLocation: point, locationUpdatedAt: new Date() });
  await ShipperDeposit.create({ shipper: shipper._id, balance: 500000 });
  return shipper;
};

describe("Phase 1 payment and shipper settlement flow", () => {
  it("rejects COD with drone delivery", async () => {
    const { restaurant } = await createRestaurantOwner();
    const customer = await createUser({ email: "cod-drone@test.com" });
    const food = await createFood(restaurant._id, { price: 100000 });
    const token = generateToken(customer._id);
    await request(app).post("/api/cart/add").set("Authorization", `Bearer ${token}`).send({ itemId: food._id.toString() });

    const response = await request(app)
      .post("/api/order/place")
      .set("Authorization", `Bearer ${token}`)
      .send({ address, paymentMethod: "COD", deliveryMethod: "drone" });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/COD.*shipper/i);
  });

  it("settles a COD user → shipper → restaurant → customer flow with ledger entries", async () => {
    const { owner, restaurant } = await createRestaurantOwner();
    const customer = await createUser({ email: "cod-flow@test.com" });
    const shipper = await makeShipper();
    const food = await createFood(restaurant._id, { price: 300000 });
    const customerToken = generateToken(customer._id);

    await request(app).post("/api/cart/add").set("Authorization", `Bearer ${customerToken}`).send({ itemId: food._id.toString() });
    const placed = await request(app)
      .post("/api/order/place")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ address, paymentMethod: "COD", deliveryMethod: "shipper" });
    expect(placed.body.success).toBe(true);

    const orderId = placed.body.orderId;
    await shipperService.acceptOrder(shipper, orderId);
    await request(app).post("/api/order/status").set("Authorization", `Bearer ${generateToken(owner._id)}`)
      .send({ orderId, status: "preparing" }).expect(200);
    await shipperService.pickupOrder(shipper, orderId);
    await shipperService.arriveAtDelivery(shipper, orderId);
    await shipperService.completeOrder(shipper, orderId);

    const [order, updatedRestaurant, earnings, transactions] = await Promise.all([
      Order.findById(orderId), Restaurant.findById(restaurant._id),
      ShipperEarningsWallet.findOne({ shipper: shipper._id }), WalletTransaction.find({ orderId }),
    ]);
    expect(order.orderStatus).toBe("delivered");
    expect(order.isPaid).toBe(true);
    expect(order.codReservationStatus).toBe("released");
    expect(updatedRestaurant.balance).toBe(240000);
    expect(earnings.balance).toBe(-300000);
    expect(earnings.reservedCodLiability).toBe(0);
    expect(transactions.map((entry) => entry.transactionType).sort()).toEqual([
      "restaurant_order_settlement", "shipper_cod_collection",
    ]);
  });

  it("settles 85% of the delivery fee to a shipper for a prepaid delivery", async () => {
    const { restaurant } = await createRestaurantOwner();
    const customer = await createUser({ email: "vnpay-flow@test.com" });
    const shipper = await makeShipper();
    const order = await Order.create({
      user: customer._id, restaurantId: restaurant._id,
      orderItems: [{ product: restaurant._id, name: "Food", quantity: 1, price: 300000 }],
      shippingAddress: address, paymentMethod: "VNPAY", isPaid: true, paidAt: new Date(),
      itemsPrice: 300000, shippingPrice: 20000, totalPrice: 320000, deliveryMethod: "shipper",
      pickupLocation: point, shipperAssignmentStatus: "unassigned", shipperAssignmentDeadlineAt: new Date(Date.now() + 600000),
      financialSnapshot: {
        restaurantSharePercent: 80, platformFoodCommissionPercent: 20,
        shipperDeliverySharePercent: 85, platformDeliverySharePercent: 15,
        restaurantPayoutAmount: 240000, shipperOnlineEarningsAmount: 17000, codLiabilityAmount: 303000,
      },
    });

    await shipperService.acceptOrder(shipper, order._id);
    await Order.updateOne({ _id: order._id }, { $set: { orderStatus: "preparing" } });
    await shipperService.pickupOrder(shipper, order._id);
    await shipperService.arriveAtDelivery(shipper, order._id);
    await shipperService.completeOrder(shipper, order._id);

    const earnings = await ShipperEarningsWallet.findOne({ shipper: shipper._id });
    expect(earnings.balance).toBe(17000);
    expect((await Restaurant.findById(restaurant._id)).balance).toBe(240000);
  });
});
