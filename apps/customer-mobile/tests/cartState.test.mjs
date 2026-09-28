import assert from "node:assert/strict";
import test from "node:test";
import {
  getCartBadgeCount,
  getCartCardMeta,
  selectRestaurantCart,
} from "../src/cart/cartState.ts";

test("badge is number of restaurant carts", () => {
  assert.equal(getCartBadgeCount([{ cartId: "a" }, { cartId: "b" }]), 2);
});

test("selects only the viewed restaurant cart", () => {
  assert.equal(
    selectRestaurantCart([{ cartId: "a", restaurant: { id: "r1" } }], "r1")?.cartId,
    "a"
  );
});

test("closed card shows quantity and closed copy only", () => {
  assert.deepEqual(
    getCartCardMeta({ itemCount: 2, restaurant: { isOpen: false } }),
    ["2 món", "Quán đang đóng cửa"]
  );
});

test("missing address omits eta and distance", () => {
  assert.deepEqual(getCartCardMeta({ itemCount: 3 }), ["3 món"]);
});
