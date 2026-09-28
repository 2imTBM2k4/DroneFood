import { describe, expect, it } from "vitest";
import migration from "../../seeds/migrateMultiRestaurantCarts.cjs";

describe("multi-restaurant cart migration", () => {
  it("derives one restaurant from a consistent legacy cart", () => {
    const cart = {
      items: [
        { foodId: { restaurantId: "restaurant-a" } },
        { foodId: { restaurantId: "restaurant-a" } },
      ],
    };

    expect(migration.classifyLegacyCart(cart)).toEqual({
      status: "ready",
      restaurantId: "restaurant-a",
    });
  });

  it("preserves an inconsistent legacy cart for manual review", () => {
    const cart = {
      items: [
        { foodId: { restaurantId: "restaurant-a" } },
        { foodId: { restaurantId: "restaurant-b" } },
      ],
    };

    expect(migration.classifyLegacyCart(cart).status).toBe("inconsistent");
  });

  it("classifies carts with no valid food as empty", () => {
    expect(
      migration.classifyLegacyCart({ items: [{ foodId: null }] }).status
    ).toBe("empty");
  });
});
