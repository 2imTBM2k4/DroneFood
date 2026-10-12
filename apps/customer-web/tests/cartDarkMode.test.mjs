import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const cartCssUrl = new URL("../src/pages/Cart/Cart.css", import.meta.url);

test("cart group cards use the defined canvas token in dark mode", async () => {
  const source = await readFile(cartCssUrl, "utf8");
  const cardRule = source.match(/\.cart-group-card \{([\s\S]*?)\n\}/)?.[1] || "";
  const selectedRule = source.match(/\.cart-group-row\.is-selected \.cart-group-card \{([\s\S]*?)\n\}/)?.[1] || "";

  assert.match(cardRule, /background:\s*var\(--apple-canvas\);/);
  assert.match(selectedRule, /var\(--apple-canvas\)/);
  assert.doesNotMatch(cardRule, /--apple-surface/);
  assert.doesNotMatch(selectedRule, /--apple-surface/);
});
