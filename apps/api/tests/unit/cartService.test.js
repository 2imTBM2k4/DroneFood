import { describe, it, expect } from "vitest";
import { User, Food, Cart, Restaurant } from "../../models/index.cjs";
import * as cartService from "../../services/cartService.js";
import bcrypt from "bcrypt";

/** Convenience: the line for a given dish, ignoring options. */
const lineFor = (result, food) =>
  result.items.find((item) => item.foodId === food._id.toString());

describe("cartService", () => {
  let user, restaurant, food1, food2, food3, foodWithOptions;

  beforeEach(async () => {
    user = await User.create({
      name: "Cart User",
      email: "cart@test.com",
      password: await bcrypt.hash("pass123", 10),
    });

    restaurant = await Restaurant.create({
      name: "Restaurant A",
      owner: user._id,
      address: "123 St",
      phone: "0123",
      email: "resta@test.com",
      isLocked: false,
    });

    const restaurant2 = await Restaurant.create({
      name: "Restaurant B",
      owner: user._id,
      address: "456 St",
      phone: "0456",
      email: "restb@test.com",
      isLocked: false,
    });

    food1 = await Food.create({
      name: "Pho",
      description: "Vietnamese soup",
      price: 5,
      image: "pho.jpg",
      category: "soup",
      restaurantId: restaurant._id,
    });

    food2 = await Food.create({
      name: "Bun Bo",
      description: "Spicy noodle",
      price: 6,
      image: "bunbo.jpg",
      category: "noodle",
      restaurantId: restaurant._id,
    });

    food3 = await Food.create({
      name: "Pizza",
      description: "Italian pizza",
      price: 12,
      image: "pizza.jpg",
      category: "pizza",
      restaurantId: restaurant2._id,
    });

    foodWithOptions = await Food.create({
      name: "Banh Mi",
      description: "Baguette sandwich",
      price: 10,
      image: "banhmi.jpg",
      category: "sandwich",
      restaurantId: restaurant._id,
      optionGroups: [
        {
          name: "Size",
          type: "single",
          required: true,
          min: 1,
          max: 1,
          options: [
            { name: "Regular", priceDelta: 0 },
            { name: "Large", priceDelta: 3 },
          ],
        },
        {
          name: "Extras",
          type: "multi",
          required: false,
          min: 0,
          max: 2,
          options: [
            { name: "Egg", priceDelta: 1 },
            { name: "Pate", priceDelta: 2 },
            { name: "Chili", priceDelta: 0 },
          ],
        },
      ],
    });
  });

  describe("getCart", () => {
    it("should return empty cart for new user", async () => {
      const result = await cartService.getCart(user._id);
      expect(result.success).toBe(true);
      expect(result.items).toEqual([]);
      expect(result.subtotal).toBe(0);
    });

    it("should return cart with items", async () => {
      await cartService.addToCart(user._id, food1._id.toString());
      const result = await cartService.getCart(user._id);
      expect(result.success).toBe(true);
      expect(result.items).toHaveLength(1);
      expect(lineFor(result, food1).quantity).toBe(1);
      expect(result.restaurantId).toBe(restaurant._id.toString());
    });
  });

  describe("addToCart", () => {
    it("should add item to empty cart", async () => {
      const result = await cartService.addToCart(
        user._id,
        food1._id.toString()
      );
      expect(result.success).toBe(true);
      expect(lineFor(result, food1).quantity).toBe(1);
      expect(result.subtotal).toBe(5);
    });

    it("should increment quantity when adding same item", async () => {
      await cartService.addToCart(user._id, food1._id.toString());
      const result = await cartService.addToCart(
        user._id,
        food1._id.toString()
      );
      expect(result.items).toHaveLength(1);
      expect(lineFor(result, food1).quantity).toBe(2);
    });

    it("should allow adding items from same restaurant", async () => {
      await cartService.addToCart(user._id, food1._id.toString());
      const result = await cartService.addToCart(
        user._id,
        food2._id.toString()
      );
      expect(result.success).toBe(true);
      expect(result.items).toHaveLength(2);
    });

    it("should reject items from different restaurant", async () => {
      await cartService.addToCart(user._id, food1._id.toString());
      await expect(
        cartService.addToCart(user._id, food3._id.toString())
      ).rejects.toThrow();
    });

    it("should throw for non-existent food", async () => {
      const fakeId = "507f1f77bcf86cd799439011";
      await expect(cartService.addToCart(user._id, fakeId)).rejects.toThrow(
        "Food not found"
      );
    });
  });

  describe("addToCart with options", () => {
    it("should price the selected options server-side", async () => {
      const result = await cartService.addToCart(
        user._id,
        foodWithOptions._id.toString(),
        1,
        [
          { groupName: "Size", optionName: "Large" },
          { groupName: "Extras", optionName: "Egg" },
        ]
      );
      // 10 base + 3 large + 1 egg
      expect(result.items[0].unitPrice).toBe(14);
      expect(result.subtotal).toBe(14);
    });

    it("should ignore any priceDelta the client sends", async () => {
      const result = await cartService.addToCart(
        user._id,
        foodWithOptions._id.toString(),
        1,
        [{ groupName: "Size", optionName: "Large", priceDelta: -100 }]
      );
      expect(result.items[0].unitPrice).toBe(13);
      expect(result.items[0].selectedOptions[0].priceDelta).toBe(3);
    });

    it("should keep different option sets as separate lines", async () => {
      await cartService.addToCart(user._id, foodWithOptions._id.toString(), 1, [
        { groupName: "Size", optionName: "Regular" },
      ]);
      const result = await cartService.addToCart(
        user._id,
        foodWithOptions._id.toString(),
        1,
        [{ groupName: "Size", optionName: "Large" }]
      );
      expect(result.items).toHaveLength(2);
      expect(result.subtotal).toBe(10 + 13);
    });

    it("should merge lines whose options match regardless of order", async () => {
      await cartService.addToCart(user._id, foodWithOptions._id.toString(), 1, [
        { groupName: "Size", optionName: "Large" },
        { groupName: "Extras", optionName: "Egg" },
      ]);
      const result = await cartService.addToCart(
        user._id,
        foodWithOptions._id.toString(),
        1,
        [
          { groupName: "Extras", optionName: "Egg" },
          { groupName: "Size", optionName: "Large" },
        ]
      );
      expect(result.items).toHaveLength(1);
      expect(result.items[0].quantity).toBe(2);
    });

    it("should reject a missing required group", async () => {
      await expect(
        cartService.addToCart(user._id, foodWithOptions._id.toString(), 1, [])
      ).rejects.toThrow('"Size" is required');
    });

    it("should reject two picks in a single-choice group", async () => {
      await expect(
        cartService.addToCart(user._id, foodWithOptions._id.toString(), 1, [
          { groupName: "Size", optionName: "Regular" },
          { groupName: "Size", optionName: "Large" },
        ])
      ).rejects.toThrow('Pick only one option in "Size"');
    });

    it("should reject exceeding a multi group's max", async () => {
      await expect(
        cartService.addToCart(user._id, foodWithOptions._id.toString(), 1, [
          { groupName: "Size", optionName: "Regular" },
          { groupName: "Extras", optionName: "Egg" },
          { groupName: "Extras", optionName: "Pate" },
          { groupName: "Extras", optionName: "Chili" },
        ])
      ).rejects.toThrow('Pick at most 2 option(s) in "Extras"');
    });

    it("should reject an option that isn't on the menu", async () => {
      await expect(
        cartService.addToCart(user._id, foodWithOptions._id.toString(), 1, [
          { groupName: "Size", optionName: "Enormous" },
        ])
      ).rejects.toThrow('"Enormous" is not an option in "Size"');
    });

    it("should reject a group the dish doesn't have", async () => {
      await expect(
        cartService.addToCart(user._id, foodWithOptions._id.toString(), 1, [
          { groupName: "Sauce", optionName: "Ketchup" },
        ])
      ).rejects.toThrow('Unknown option group "Sauce"');
    });

    it("should store the kitchen note", async () => {
      const result = await cartService.addToCart(
        user._id,
        food1._id.toString(),
        1,
        [],
        "No coriander"
      );
      expect(result.items[0].note).toBe("No coriander");
    });
  });

  describe("updateLine", () => {
    it("should set the quantity outright", async () => {
      const added = await cartService.addToCart(user._id, food1._id.toString());
      const result = await cartService.updateLine(
        user._id,
        added.items[0].lineKey,
        7
      );
      expect(result.items[0].quantity).toBe(7);
      expect(result.subtotal).toBe(35);
    });

    it("should drop the line when quantity hits 0", async () => {
      const added = await cartService.addToCart(user._id, food1._id.toString());
      const result = await cartService.updateLine(
        user._id,
        added.items[0].lineKey,
        0
      );
      expect(result.items).toHaveLength(0);
    });

    it("should throw for an unknown line", async () => {
      await cartService.addToCart(user._id, food1._id.toString());
      await expect(
        cartService.updateLine(user._id, "nope", 2)
      ).rejects.toThrow("Line not in cart");
    });

    it("should throw when cart not found", async () => {
      const fakeUserId = "507f1f77bcf86cd799439011";
      await expect(
        cartService.updateLine(fakeUserId, "nope", 1)
      ).rejects.toThrow("Cart not found");
    });
  });

  describe("removeLine", () => {
    it("should remove the whole line whatever its quantity", async () => {
      const added = await cartService.addToCart(
        user._id,
        food1._id.toString(),
        5
      );
      const result = await cartService.removeLine(
        user._id,
        added.items[0].lineKey
      );
      expect(result.items).toHaveLength(0);
      expect(result.subtotal).toBe(0);
    });

    it("should leave other lines alone", async () => {
      const added = await cartService.addToCart(user._id, food1._id.toString());
      await cartService.addToCart(user._id, food2._id.toString());
      const result = await cartService.removeLine(
        user._id,
        added.items[0].lineKey
      );
      expect(result.items).toHaveLength(1);
      expect(lineFor(result, food2)).toBeDefined();
    });

    it("should throw for an unknown line", async () => {
      await cartService.addToCart(user._id, food1._id.toString());
      await expect(
        cartService.removeLine(user._id, "nope")
      ).rejects.toThrow("Line not in cart");
    });
  });

  describe("clearCart", () => {
    it("should clear all items", async () => {
      await cartService.addToCart(user._id, food1._id.toString());
      await cartService.addToCart(user._id, food2._id.toString());

      const result = await cartService.clearCart(user._id);
      expect(result.success).toBe(true);

      const cart = await cartService.getCart(user._id);
      expect(cart.items).toEqual([]);
    });
  });
});
