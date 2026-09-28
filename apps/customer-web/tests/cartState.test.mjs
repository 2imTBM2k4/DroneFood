import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCheckoutPayload,
  cartCount,
  cartForRestaurant,
  cartMeta,
} from "../src/lib/cartState.js";

test("badge counts restaurant carts", () => {
  assert.equal(cartCount([{ cartId: "a" }, { cartId: "b" }]), 2);
});

test("restaurant pages select only their own cart", () => {
  const carts = [
    { cartId: "a", restaurant: { id: "r1" } },
    { cartId: "b", restaurant: { id: "r2" } },
  ];
  assert.equal(cartForRestaurant(carts, "r2")?.cartId, "b");
  assert.equal(cartForRestaurant(carts, "missing"), null);
});

test("missing address omits eta and distance", () => {
  assert.deepEqual(
    cartMeta({ itemCount: 3, etaMin: null, distanceKm: null }),
    ["3 món"]
  );
});

test("closed restaurant replaces delivery metadata", () => {
  assert.deepEqual(
    cartMeta({ itemCount: 3, restaurant: { isOpen: false } }),
    ["3 món", "Quán đang đóng cửa"]
  );
});

test("quote and place payloads retain selected cart identity", () => {
  assert.deepEqual(
    buildCheckoutPayload("cart-a", 4, { deliveryMethod: "shipper" }),
    { cartId: "cart-a", cartVersion: 4, deliveryMethod: "shipper" }
  );
});
