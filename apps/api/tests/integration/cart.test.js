import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../app.js";
import { Cart, Food, Restaurant } from "../../models/index.cjs";
import { createUser, generateToken } from "../helpers.js";

describe("Cart API", () => {
  let user, token, restaurant1, restaurant2, food1, food2, foodOtherRestaurant, foodWithOptions;

  const addItem = (body) =>
    request(app)
      .post("/api/cart/add")
      .set("Authorization", `Bearer ${token}`)
      .send(body);

  beforeEach(async () => {
    user = await createUser({ email: "cartapi@test.com" });
    token = generateToken(user._id);

    restaurant1 = await Restaurant.create({
      name: "Rest 1",
      owner: user._id,
      address: "123 St",
      phone: "0123",
      email: "r1@test.com",
      isLocked: false,
      lat: 10.7769,
      lng: 106.7009,
      openingHours: { openTime: "00:00", closeTime: "00:00" },
    });

    restaurant2 = await Restaurant.create({
      name: "Rest 2",
      owner: user._id,
      address: "456 St",
      phone: "0456",
      email: "r2@test.com",
      isLocked: false,
      isOpen: false,
      lat: 10.7869,
      lng: 106.7109,
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

  describe("GET /api/cart", () => {
    it("should return an empty cart list", async () => {
      const res = await request(app)
        .get("/api/cart")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.carts).toEqual([]);
      expect(res.body.cartCount).toBe(0);
    });

    it("should require authentication", async () => {
      const res = await request(app).get("/api/cart");
      expect(res.status).toBe(401);
    });

    it("should list independent restaurant carts newest first", async () => {
      const first = await addItem({ itemId: food1._id.toString(), quantity: 2 });
      const second = await addItem({ itemId: foodOtherRestaurant._id.toString() });

      expect(first.body.cartId).not.toBe(second.body.cartId);
      const res = await request(app)
        .get("/api/cart")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.cartCount).toBe(2);
      expect(res.body.carts.map((cart) => cart.cartId)).toEqual([
        second.body.cartId,
        first.body.cartId,
      ]);
      expect(res.body.carts.map((cart) => cart.itemCount).sort()).toEqual([1, 2]);
      expect(res.body.carts[0].restaurant.isOpen).toBe(false);
      expect(res.body.carts[0].distanceKm).toBeNull();
      expect(res.body.carts[0].etaMin).toBeNull();
      expect(res.body.carts[0]).not.toHaveProperty("subtotal");
    });

    it("should calculate distance and ETA from a selected address", async () => {
      user.addressBook.push({
        label: "Nhà",
        recipient: user.name,
        phone: "0900000000",
        address: "1 Test Street",
        city: "Ho Chi Minh City",
        state: "Ho Chi Minh City",
        country: "Việt Nam",
        lat: 10.7769,
        lng: 106.7009,
        isDefault: true,
      });
      await user.save();
      await addItem({ itemId: food1._id.toString() });

      const res = await request(app)
        .get(`/api/cart?addressEntryId=${user.addressBook[0]._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.carts[0].distanceKm).toBe(0);
      expect(res.body.carts[0].etaMin).toBe(10);
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

    it("should create a different cart for another restaurant", async () => {
      const first = await addItem({ itemId: food1._id.toString() });
      const second = await addItem({ itemId: foodOtherRestaurant._id.toString() });

      expect(second.status).toBe(200);
      expect(second.body.cartId).not.toBe(first.body.cartId);
      expect(await Cart.countDocuments({ userId: user._id })).toBe(2);
    });

    it("should preserve both simultaneous additions to a new cart", async () => {
      const [first, second] = await Promise.all([
        addItem({ itemId: food1._id.toString() }),
        addItem({ itemId: food1._id.toString() }),
      ]);

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      const detail = await request(app)
        .get(`/api/cart/${first.body.cartId}`)
        .set("Authorization", `Bearer ${token}`);
      expect(detail.body.items[0].quantity).toBe(2);
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

  describe("cart authorization", () => {
    it("should not expose another user's cart", async () => {
      const added = await addItem({ itemId: food1._id.toString() });
      const other = await createUser({ email: "other-cart@test.com" });
      const res = await request(app)
        .get(`/api/cart/${added.body.cartId}`)
        .set("Authorization", `Bearer ${generateToken(other._id)}`);

      expect(res.status).toBe(404);
    });

    it("should not edit, remove from, or clear another user's cart", async () => {
      const added = await addItem({ itemId: food1._id.toString() });
      const other = await createUser({ email: "other-cart-mutations@test.com" });
      const otherAuth = `Bearer ${generateToken(other._id)}`;
      const { lineKey } = added.body.items[0];

      const [updated, removed, cleared] = await Promise.all([
        request(app)
          .post(`/api/cart/${added.body.cartId}/update-line`)
          .set("Authorization", otherAuth)
          .send({ lineKey, quantity: 2 }),
        request(app)
          .post(`/api/cart/${added.body.cartId}/remove-line`)
          .set("Authorization", otherAuth)
          .send({ lineKey }),
        request(app)
          .delete(`/api/cart/${added.body.cartId}`)
          .set("Authorization", otherAuth),
      ]);

      expect([updated.status, removed.status, cleared.status]).toEqual([404, 404, 404]);
      expect((await Cart.findById(added.body.cartId)).items[0].quantity).toBe(1);
    });
  });

  describe("POST /api/cart/update-line", () => {
    it("should set the quantity outright", async () => {
      const added = await addItem({ itemId: food1._id.toString() });
      const { lineKey } = added.body.items[0];

      const res = await request(app)
        .post(`/api/cart/${added.body.cartId}/update-line`)
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
        .post(`/api/cart/${added.body.cartId}/update-line`)
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
        .post(`/api/cart/${added.body.cartId}/remove-line`)
        .set("Authorization", `Bearer ${token}`)
        .send({ lineKey });

      expect(res.body.success).toBe(true);
      expect(res.body.items).toHaveLength(0);
    });
  });

  describe("POST /api/cart/clear", () => {
    it("should clear all items", async () => {
      const added = await addItem({ itemId: food1._id.toString() });

      const res = await request(app)
        .delete(`/api/cart/${added.body.cartId}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.body.success).toBe(true);

      const getRes = await request(app)
        .get("/api/cart")
        .set("Authorization", `Bearer ${token}`);

      expect(getRes.body.carts).toEqual([]);
    });
  });
});
