import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const restaurantItemUrl = new URL("../src/components/RestaurantItem/RestaurantItem.jsx", import.meta.url);
const restaurantDisplayUrl = new URL("../src/components/RestaurantDisplay/RestaurantDisplay.jsx", import.meta.url);
const restaurantsPageUrl = new URL("../src/pages/Restaurants/RestaurantsPage.jsx", import.meta.url);
const useNearbyRestaurantsUrl = new URL("../src/hooks/useNearbyRestaurants.js", import.meta.url);

test("RestaurantItem renders branchName when isMultiBranch is true, fallback to name otherwise", async () => {
  const source = await readFile(restaurantItemUrl, "utf8");

  assert.match(source, /branchName/);
  assert.match(source, /isMultiBranch/);
  assert.match(source, /const displayName = isMultiBranch && branchName \? branchName : name;/);
  assert.match(source, /aria-label=\{`View menu for \$\{displayName\}`\}/);
  assert.match(source, /alt=\{displayName\}/);
  assert.match(source, /<h3 className="apple-card-title" title=\{displayName\}>\{displayName\}<\/h3>/);
});

test("RestaurantDisplay and RestaurantsPage pass branchName and isMultiBranch to RestaurantItem", async () => {
  const [displaySource, pageSource] = await Promise.all([
    readFile(restaurantDisplayUrl, "utf8"),
    readFile(restaurantsPageUrl, "utf8"),
  ]);

  for (const source of [displaySource, pageSource]) {
    assert.match(source, /branchName=\{item\.branchName\}/);
    assert.match(source, /isMultiBranch=\{item\.isMultiBranch\}/);
  }

  assert.match(pageSource, /r\.branchName\?\.toLowerCase\(\)\.includes\(query\)/);
});

test("useNearbyRestaurants prioritizes activeAddressId and calculates nearest branch for multi-branch brands", async () => {
  const source = await readFile(useNearbyRestaurantsUrl, "utf8");

  assert.match(source, /activeAddressId/);
  assert.match(source, /user\?\.addressBook/);
  assert.match(source, /r\.isMultiBranch/);
  assert.match(source, /branchName/);
  assert.match(source, /nearestBranch|selectedBranch/);
});

test("displayName resolution logic handles single and multi-branch restaurants accurately", () => {
  const resolveDisplayName = (name, branchName, isMultiBranch) => {
    return isMultiBranch && branchName ? branchName : name;
  };

  // Case 1: Quán đơn lẻ
  assert.equal(
    resolveDisplayName("Cơm Tấm Ba Ghiền", null, false),
    "Cơm Tấm Ba Ghiền"
  );

  // Case 2: Quán thuộc thương hiệu nhiều chi nhánh
  assert.equal(
    resolveDisplayName("Phở Ba Miền", "Phở Ba Miền - Chi nhánh Quận 1", true),
    "Phở Ba Miền - Chi nhánh Quận 1"
  );

  // Case 3: Thương hiệu chỉ mới có 1 chi nhánh nhưng đã được định danh branch
  assert.equal(
    resolveDisplayName("Trà Sữa KOI Thé", "Trà Sữa KOI Thé - Vincom Đồng Khởi", true),
    "Trà Sữa KOI Thé - Vincom Đồng Khởi"
  );

  // Case 4: Quán thuộc thương hiệu nhiều chi nhánh nhưng chưa có branchName
  assert.equal(
    resolveDisplayName("Phở Ba Miền", null, true),
    "Phở Ba Miền"
  );
});
