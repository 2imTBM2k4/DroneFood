import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const cartIndexUrl = new URL("../src/pages/Cart/CartIndex.jsx", import.meta.url);
const cartDetailUrl = new URL("../src/pages/Cart/Cart.jsx", import.meta.url);

test("web cart list and detail render the restaurant avatar with a fallback", async () => {
  const [indexSource, detailSource] = await Promise.all([
    readFile(cartIndexUrl, "utf8"),
    readFile(cartDetailUrl, "utf8"),
  ]);

  for (const source of [indexSource, detailSource]) {
    assert.match(source, /restaurantImageUrl\(url, restaurantImage\)/);
    assert.match(source, /restaurant_list\.find/);
    assert.match(source, /cart-restaurant-avatar/);
    assert.match(source, /Ảnh cửa hàng/);
    assert.match(source, /<Store /);
  }
});
