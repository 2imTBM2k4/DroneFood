import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const cartCssUrl = new URL("../src/pages/Cart/Cart.css", import.meta.url);

test("restaurant cart cards use the theme-aware canvas surface", async () => {
  const source = await readFile(cartCssUrl, "utf8");
  const cardRule = source.match(/\.cart-group-card\s*\{(?<body>[\s\S]*?)\}/)?.groups?.body;
  const selectedRule = source.match(/\.cart-group-row\.is-selected \.cart-group-card\s*\{(?<body>[\s\S]*?)\}/)?.groups?.body;

  assert.ok(cardRule, "cart group card rule must exist");
  assert.match(cardRule, /background:\s*var\(--apple-canvas\)/);
  assert.ok(selectedRule, "selected cart group card rule must exist");
  assert.match(selectedRule, /background:\s*color-mix\([^;]*var\(--apple-canvas\)\)/);
  assert.doesNotMatch(`${cardRule}\n${selectedRule}`, /var\(--apple-surface/);
});
