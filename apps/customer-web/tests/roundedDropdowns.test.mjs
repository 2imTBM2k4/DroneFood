import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const roundedSelectUrl = new URL("../src/components/RoundedSelect/RoundedSelect.jsx", import.meta.url);
const roundedSelectCssUrl = new URL("../src/components/RoundedSelect/RoundedSelect.css", import.meta.url);
const navbarUrl = new URL("../src/components/Navbar/Navbar.jsx", import.meta.url);
const restaurantsUrl = new URL("../src/pages/Restaurants/RestaurantsPage.jsx", import.meta.url);

test("location and restaurant filters use the shared rounded dropdown", async () => {
  const [selectSource, selectCss, navbarSource, restaurantsSource] = await Promise.all([
    readFile(roundedSelectUrl, "utf8"),
    readFile(roundedSelectCssUrl, "utf8"),
    readFile(navbarUrl, "utf8"),
    readFile(restaurantsUrl, "utf8"),
  ]);

  assert.match(selectSource, /role="combobox"/);
  assert.match(selectSource, /role="listbox"/);
  assert.match(selectSource, /role="option"/);
  assert.match(selectSource, /event\.key === "ArrowDown"/);
  assert.match(selectCss, /border-radius: 18px/);
  assert.match(selectCss, /focus-visible/);
  assert.equal(navbarSource.includes("<select"), false);
  assert.equal(restaurantsSource.includes("<select"), false);
  assert.match(navbarSource, /<RoundedSelect/);
  assert.match(restaurantsSource, /<RoundedSelect/);
});
