import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../app.js";
import { Restaurant } from "../../models/index.cjs";
import { createFood, createRestaurantOwner } from "../helpers.js";

describe("Food discovery API", () => {
  it("intersects restaurant, Vietnamese text, category and inclusive price filters", async () => {
    const { owner, restaurant } = await createRestaurantOwner();
    const otherRestaurant = await Restaurant.create({
      name: "Other", owner: owner._id, address: "Other street", phone: "0123456789", email: "other@example.com", isLocked: false,
    });
    const exact = await createFood(restaurant._id, { name: "Cơm gà", description: "Cơm nóng", category: "Cơm", price: 50000 });
    await createFood(restaurant._id, { name: "Cơm bò", description: "Cơm", category: "Cơm", price: 70000 });
    await createFood(restaurant._id, { name: "Gà nướng", description: "Thơm", category: "Nướng", price: 50000 });
    await createFood(otherRestaurant._id, { name: "Cơm gà", description: "Cơm nóng", category: "Cơm", price: 50000 });

    const response = await request(app).get("/api/food/list").query({
      restaurantId: restaurant._id.toString(), q: "cƠm", category: "Cơm", minPrice: 50000, maxPrice: 50000, sort: "price_asc",
    });

    expect(response.status).toBe(200);
    expect(response.body.data.map((food) => food._id)).toEqual([exact._id.toString()]);
    expect(response.body.pagination).toMatchObject({ page: 1, limit: 20, total: 1, totalPages: 1 });
  });

  it("paginates with deterministic sorting and rejects invalid query contracts", async () => {
    const { restaurant } = await createRestaurantOwner();
    const first = await createFood(restaurant._id, { name: "Bún", price: 30000 });
    const second = await createFood(restaurant._id, { name: "Phở", price: 30000 });
    await createFood(restaurant._id, { name: "Cơm", price: 40000 });

    const page = await request(app).get("/api/food/list").query({ restaurantId: restaurant._id.toString(), sort: "price_asc", page: 1, limit: 2 });
    expect(page.status).toBe(200);
    expect(page.body.data.map((food) => food._id)).toEqual([first._id.toString(), second._id.toString()]);
    expect(page.body.pagination).toMatchObject({ total: 3, totalPages: 2 });

    const badRange = await request(app).get("/api/food/list").query({ minPrice: 2, maxPrice: 1 });
    const badSort = await request(app).get("/api/food/list").query({ sort: "latest" });
    expect(badRange.status).toBe(400);
    expect(badSort.status).toBe(400);
  });
});
