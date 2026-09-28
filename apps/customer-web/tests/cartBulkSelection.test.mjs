import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const cartIndexUrl = new URL("../src/pages/Cart/CartIndex.jsx", import.meta.url);
const storeContextUrl = new URL("../src/context/StoreContext.jsx", import.meta.url);

test("cart index supports accessible multi-select deletion with confirmation", async () => {
  const [cartSource, contextSource] = await Promise.all([
    readFile(cartIndexUrl, "utf8"),
    readFile(storeContextUrl, "utf8"),
  ]);

  assert.match(cartSource, /const \[selectedCartIds, setSelectedCartIds\] = useState/);
  assert.match(cartSource, /type="checkbox"/);
  assert.match(cartSource, /aria-label=\{`Select cart for/);
  assert.match(cartSource, /aria-modal="true"/);
  assert.match(cartSource, /clearCarts\(\[\.\.\.selectedCartIds\]\)/);
  assert.match(contextSource, /const clearCarts = async/);
  assert.match(contextSource, /Promise\.allSettled/);
  assert.match(contextSource, /clearCarts,/);
});
