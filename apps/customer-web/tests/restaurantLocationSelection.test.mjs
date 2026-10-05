import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const navbarUrl = new URL("../src/components/Navbar/Navbar.jsx", import.meta.url);
const contextUrl = new URL("../src/context/StoreContext.jsx", import.meta.url);
const nearbyHookUrl = new URL("../src/hooks/useNearbyRestaurants.js", import.meta.url);

test("navbar location selection refreshes nearby restaurants without becoming a checkout id", async () => {
  const [navbarSource, contextSource, hookSource] = await Promise.all([
    readFile(navbarUrl, "utf8"),
    readFile(contextUrl, "utf8"),
    readFile(nearbyHookUrl, "utf8"),
  ]);

  assert.match(navbarSource, /setRestaurantLocationId\(nextLocationId\)/);
  assert.match(navbarSource, /fetchRestaurantList\(\)/);
  assert.match(hookSource, /\[liveLocation, restaurantLocationId, user\]/);
  assert.match(contextSource, /params: activeAddressId \? \{ addressEntryId: activeAddressId \}/);
  assert.doesNotMatch(contextSource, /addressEntryId: restaurantLocationId/);
});
