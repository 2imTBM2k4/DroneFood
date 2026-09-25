import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../app.js";
import { Food, Restaurant } from "../../models/index.cjs";
import { createUser, generateToken } from "../helpers.js";

describe("Cart API", () => {
  let user, token, food1, food2, foodOtherRestaurant, foodWithOptions;

  const addItem = (body) =>
    request(app)
      .post("/api/cart/add")
      .set("Authorization", `Bearer ${token}`)
      .send(body);

  beforeEach(async () => {
    user = await createUser({ email: "cartapi@test.com" });
    token = generateToken(user._id);

    const restaurant1 = await Restaurant.create({
      name: "Rest 1",
      owner: user._id,
      address: "123 St",
      phone: "0123",
      email: "r1@test.com",
      isLocked: false,
    });

    const restaurant2 = await Restaurant.create({
      name: "Rest 2",
      owner: user._id,
      address: "456 St",
      phone: "0456",
      email: "r2@test.com",
      isLocked: false,
    });

    food1 = await Food.create({
      name: "Food 1",
      description: "Desc 1",
      price: 10,
      image: "f1.jpg",
      category: "cat1",
      restaurantId: restaurant1._id,
    });

    food2 = await Food.create({
      name: "Food 2",
      description: "Desc 2",
      price: 15,
      image: "f2.jpg",
      category: "cat1",
      restaurantId: restaurant1._id,
    });

    foodOtherRestaurant = await Food.create({
      name: "Food 3",
      description: "Desc 3",
      price: 20,
      image: "f3.jpg",
      category: "cat2",
      restaurantId: restaurant2._id,
    });

    foodWithOptions = await Food.create({
      name: "Food 4",
      description: "Desc 4",
      price: 10,
      image: "f4.jpg",
      category: "cat1",
      restaurantId: restaurant1._id,
      optionGroups: [
        {
          name: "Size",
          type: "single",
          required: true,
          min: 1,
          max: 1,
          options: [
            { name: "Regular", priceDelta: 0 },
            { name: "Large", priceDelta: 5 },
          ],
        },
      ],
    });
  });

  describe("GET /api/cart/get", () => {
    it("should return empty cart", async () => {
      const res = await request(app)
        .get("/api/cart/get")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.items).toEqual([]);
      expect(res.body.subtotal).toBe(0);
    });

    it("should require authentication", async () => {
      const res = await request(app).get("/api/cart/get");
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/cart/add", () => {
    it("should add item to cart", async () => {
      const res = await addItem({ itemId: food1._id.toString() });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].quantity).toBe(1);
      expect(res.body.subtotal).toBe(10);
    });

    it("should increment quantity for same item", async () => {
      await addItem({ itemId: food1._id.toString() });
      const res = await addItem({ itemId: food1._id.toString() });

      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].quantity).toBe(2);
    });

    it("should allow multiple items from same restaurant", async () => {
      await addItem({ itemId: food1._id.toString() });
      const res = await addItem({ itemId: food2._id.toString() });

      expect(res.body.success).toBe(true);
      expect(res.body.items).toHaveLength(2);
    });

    it("should reject items from different restaurant", async () => {
      await addItem({ itemId: food1._id.toString() });
      const res = await addItem({ itemId: foodOtherRestaurant._id.toString() });

      expect(res.body.success).toBe(false);
    });

    it("should return 400 when itemId is missing", async () => {
      const res = await addItem({});
      expect(res.status).toBe(400);
    });

    it("should keep different option picks as separate lines", async () => {
      await addItem({
        itemId: foodWithOptions._id.toString(),
        selectedOptions: [{ groupName: "Size", optionName: "Regular" }],
      });
      const res = await addItem({
        itemId: foodWithOptions._id.toString(),
        selectedOptions: [{ groupName: "Size", optionName: "Large" }],
      });

      expect(res.body.items).toHaveLength(2);
      expect(res.body.subtotal).toBe(25);
    });

    it("should reject a missing required option group", async () => {
      const res = await addItem({ itemId: foodWithOptions._id.toString() });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should ignore a client-supplied priceDelta and use the menu's", async () => {
      // validate() runs with stripUnknown, so the field never reaches the
      // service; the surcharge always comes from the dish in the database.
      const res = await addItem({
        itemId: foodWithOptions._id.toString(),
        selectedOptions: [
          { groupName: "Size", optionName: "Large", priceDelta: -100 },
        ],
      });

      expect(res.status).toBe(200);
      expect(res.body.items[0].unitPrice).toBe(15);
      expect(res.body.items[0].selectedOptions[0].priceDelta).toBe(5);
    });
  });

  describe("POST /api/cart/update-line", () => {
    it("should set the quantity outright", async () => {
      const added = await addItem({ itemId: food1._id.toString() });
      const { lineKey } = added.body.items[0];

      const res = await request(app)
        .post("/api/cart/update-line")
        .set("Authorization", `Bearer ${token}`)
        .send({ lineKey, quantity: 4 });

      expect(res.body.success).toBe(true);
      expect(res.body.items[0].quantity).toBe(4);
      expect(res.body.subtotal).toBe(40);
    });

    it("should drop the line at quantity 0", async () => {
      const added = await addItem({ itemId: food1._id.toString() });
      const { lineKey } = added.body.items[0];

      const res = await request(app)
        .post("/api/cart/update-line")
        .set("Authorization", `Bearer ${token}`)
        .send({ lineKey, quantity: 0 });

      expect(res.body.items).toHaveLength(0);
    });
  });

  describe("POST /api/cart/remove-line", () => {
    it("should remove the whole line in one request", async () => {
      const added = await addItem({ itemId: food1._id.toString(), quantity: 5 });
      const { lineKey } = added.body.items[0];

      const res = await request(app)
        .post("/api/cart/remove-line")
        .set("Authorization", `Bearer ${token}`)
        .send({ lineKey });

      expect(res.body.success).toBe(true);
      expect(res.body.items).toHaveLength(0);
    });
  });

  describe("POST /api/cart/clear", () => {
    it("should clear all items", async () => {
      await addItem({ itemId: food1._id.toString() });

      const res = await request(app)
        .post("/api/cart/clear")
        .set("Authorization", `Bearer ${token}`);

      expect(res.body.success).toBe(true);

      const getRes = await request(app)
        .get("/api/cart/get")
        .set("Authorization", `Bearer ${token}`);

      expect(getRes.body.items).toEqual([]);
    });
  });
});
