import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../app.js";
import { OrderReview } from "../../models/index.cjs";
import { createFood, createOrder, createRestaurantOwner, createUser, generateToken } from "../helpers.js";

const completedShipperOrder = async (customerId, restaurantId) => {
  const shipper = await createUser({ role: "shipper", name: "Test Shipper" });
  const order = await createOrder(customerId, restaurantId, {
    orderStatus: "delivered", isDelivered: true, deliveryMethod: "shipper", shipperId: shipper._id,
  });
  return { order, foodId: order.orderItems[0].product, shipper };
};

const reviewPath = (orderId, type, targetId) =>
  `/api/order-reviews/${orderId}/${type}/${targetId}`;

describe("Order review API", () => {
  it("requires the shipper decision before a food review and stores a food comment", async () => {
    const customer = await createUser();
    const { restaurant } = await createRestaurantOwner();
    const { order, foodId, shipper } = await completedShipperOrder(customer._id, restaurant._id);
    const token = generateToken(customer._id);

    const beforeShipper = await request(app)
      .post(reviewPath(order._id, "food", foodId))
      .set("Authorization", `Bearer ${token}`)
      .send({ outcome: "rated", rating: 5, comment: "Món ngon" });
    expect(beforeShipper.status).toBe(409);

    const skipShipper = await request(app)
      .post(reviewPath(order._id, "shipper", shipper._id))
      .set("Authorization", `Bearer ${token}`)
      .send({ outcome: "skipped" });
    expect(skipShipper.status).toBe(201);
    expect(skipShipper.body.data.reviewFlow.nextTarget).toMatchObject({ targetType: "food", targetId: foodId.toString() });

    const foodReview = await request(app)
      .post(reviewPath(order._id, "food", foodId))
      .set("Authorization", `Bearer ${token}`)
      .send({ outcome: "rated", rating: 4, comment: "Món ngon" });
    expect(foodReview.status).toBe(201);
    expect(foodReview.body.data.reviewFlow.complete).toBe(true);

    const reviews = await OrderReview.find({ order: order._id }).lean();
    expect(reviews).toHaveLength(2);
    expect(reviews.find((review) => review.targetType === "food")).toMatchObject({ outcome: "rated", rating: 4, comment: "Món ngon", restaurant: restaurant._id });
  });

  it("rejects a second food decision and derives the restaurant score from food ratings", async () => {
    const customer = await createUser();
    const { restaurant } = await createRestaurantOwner();
    const { order, foodId, shipper } = await completedShipperOrder(customer._id, restaurant._id);
    const token = generateToken(customer._id);

    await request(app).post(reviewPath(order._id, "shipper", shipper._id)).set("Authorization", `Bearer ${token}`).send({ outcome: "rated", rating: 5 });
    await request(app).post(reviewPath(order._id, "food", foodId)).set("Authorization", `Bearer ${token}`).send({ outcome: "rated", rating: 5, comment: "Đáng thử" });

    const duplicate = await request(app)
      .post(reviewPath(order._id, "food", foodId))
      .set("Authorization", `Bearer ${token}`)
      .send({ outcome: "skipped" });
    expect(duplicate.status).toBe(409);

    const restaurants = await request(app).get("/api/restaurant/list");
    const listed = restaurants.body.data.find((item) => item._id === restaurant._id.toString());
    expect(listed).toMatchObject({ averageRating: 5, ratingCount: 1 });

    const reviews = await request(app).get(`/api/order-reviews/food/${foodId}`);
    expect(reviews.body.data).toMatchObject({ averageRating: 5, ratingCount: 1 });
    expect(reviews.body.data.reviews[0]).toMatchObject({ comment: "Đáng thử" });
  });

  it("offers food reviews directly after a completed drone delivery", async () => {
    const customer = await createUser();
    const { restaurant } = await createRestaurantOwner();
    const order = await createOrder(customer._id, restaurant._id, {
      orderStatus: "delivered", isDelivered: true, deliveryMethod: "drone",
    });
    const token = generateToken(customer._id);

    const orders = await request(app).get("/api/order/userorders").set("Authorization", `Bearer ${token}`);
    expect(orders.body.data[0].reviewFlow.nextTarget).toMatchObject({ targetType: "food" });
    expect(orders.body.data[0].reviewFlow.targets).toHaveLength(1);
  });

  it("requires a decision for each distinct dish in its original order", async () => {
    const customer = await createUser();
    const { restaurant } = await createRestaurantOwner();
    const { order, foodId, shipper } = await completedShipperOrder(customer._id, restaurant._id);
    const secondFood = await createFood(restaurant._id, { name: "Second dish" });
    order.orderItems.push({ product: secondFood._id, name: secondFood.name, quantity: 1, price: secondFood.price, image: secondFood.image });
    await order.save();
    const token = generateToken(customer._id);

    await request(app).post(reviewPath(order._id, "shipper", shipper._id)).set("Authorization", `Bearer ${token}`).send({ outcome: "rated", rating: 4 });
    const tooSoon = await request(app).post(reviewPath(order._id, "food", secondFood._id)).set("Authorization", `Bearer ${token}`).send({ outcome: "skipped" });
    expect(tooSoon.status).toBe(409);

    await request(app).post(reviewPath(order._id, "food", foodId)).set("Authorization", `Bearer ${token}`).send({ outcome: "rated", rating: 4, comment: "Ổn" });
    const lastDish = await request(app).post(reviewPath(order._id, "food", secondFood._id)).set("Authorization", `Bearer ${token}`).send({ outcome: "skipped" });
    expect(lastDish.status).toBe(201);
    expect(lastDish.body.data.reviewFlow.complete).toBe(true);
  });
});
