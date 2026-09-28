import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const cartIndexUrl = new URL("../src/screens/cart/CartIndexScreen.tsx", import.meta.url);
const cartDetailUrl = new URL("../src/screens/cart/CartScreen.tsx", import.meta.url);
const appUrl = new URL("../App.tsx", import.meta.url);

test("mobile cart list and detail render the restaurant avatar with a fallback", async () => {
  const [indexSource, detailSource] = await Promise.all([
    readFile(cartIndexUrl, "utf8"),
    readFile(cartDetailUrl, "utf8"),
  ]);

  for (const source of [indexSource, detailSource]) {
    assert.match(source, /resolveMediaUrl\(cart(?:\?|)\.restaurant\.image\)/);
    assert.match(source, /styles\.restaurantAvatarFallback/);
    assert.match(source, /name="store"/);
    assert.match(source, /accessibilityLabel=\{`Ảnh cửa hàng/);
  }
});

test("mobile cart data falls back to the matching restaurant image", async () => {
  const appSource = await readFile(appUrl, "utf8");

  assert.match(appSource, /restaurantImageById\.get\(String\(cart\.restaurant\.id\)\)/);
  assert.match(appSource, /carts=\{cartSummariesWithRestaurantImages\}/);
  assert.match(appSource, /cart=\{cartWithRestaurantImage\}/);
});
