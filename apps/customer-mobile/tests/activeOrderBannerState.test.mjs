import assert from "node:assert/strict";
import test from "node:test";

import {
  buildActiveOrderBannerContent,
  shouldShowActiveOrderBanner,
  floatingSurfaceForScreen,
} from "../src/components/navigation/activeOrderBannerState.ts";

test("shows the active-order banner only on the Explore screen", () => {
  assert.equal(shouldShowActiveOrderBanner("home", "preparing"), true);
  assert.equal(shouldShowActiveOrderBanner("restaurant", "preparing"), false);
  assert.equal(shouldShowActiveOrderBanner("orders", "delivering"), false);
  assert.equal(shouldShowActiveOrderBanner("home", "delivered"), false);
});

test("uses exactly one route-appropriate floating surface", () => {
  assert.equal(floatingSurfaceForScreen("home", true, true), "active-order");
  assert.equal(floatingSurfaceForScreen("home", false, true), null);
  assert.equal(floatingSurfaceForScreen("restaurant", true, true), "restaurant-cart");
  assert.equal(floatingSurfaceForScreen("cart", true, true), null);
});

test("builds compact banner content with only order and status lines", () => {
  const content = buildActiveOrderBannerContent({
    orderId: "order-abc123",
    orderStatus: "delivering",
    deliveryMethod: "drone",
  });

  assert.deepEqual(content, {
    orderLine: "ĐƠN #ABC123",
    statusLine: "Drone đang bay đến bạn",
    icon: "drone",
  });
  assert.equal("subtitle" in content, false);
});
