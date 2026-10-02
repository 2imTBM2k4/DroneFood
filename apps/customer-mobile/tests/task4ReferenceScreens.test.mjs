import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = path.resolve(process.cwd());

test("Task 4: Reference Screens Architecture & Design System Adherence", async (t) => {
  const homeScreenSrc = fs.readFileSync(
    path.join(ROOT, "src/screens/home/HomeScreen.tsx"),
    "utf8"
  );
  const foodCardSrc = fs.readFileSync(
    path.join(ROOT, "src/components/food/FoodCard.tsx"),
    "utf8"
  );
  const restDetailSrc = fs.readFileSync(
    path.join(ROOT, "src/screens/restaurant/RestaurantDetailScreen.tsx"),
    "utf8"
  );
  const cartScreenSrc = fs.readFileSync(
    path.join(ROOT, "src/screens/cart/CartScreen.tsx"),
    "utf8"
  );
  const cartIndexSrc = fs.readFileSync(
    path.join(ROOT, "src/screens/cart/CartIndexScreen.tsx"),
    "utf8"
  );

  await t.test("HomeScreen removes GlassSurface and uses flat cards with LinearGradient scrim", () => {
    assert.ok(!homeScreenSrc.includes("GlassSurface"), "HomeScreen must not use GlassSurface");
    assert.ok(homeScreenSrc.includes("LinearGradient"), "HomeScreen must use LinearGradient for banner scrim");
    assert.ok(homeScreenSrc.includes('variant="glass"'), "HomeScreen banner must have glass action button");
    assert.ok(homeScreenSrc.includes("FilterChip"), "HomeScreen must use FilterChip for categories");
  });

  await t.test("FoodCard uses flat card styling, system typography, and 44x44 touch targets", () => {
    assert.ok(!foodCardSrc.includes("GlassSurface"), "FoodCard must not use GlassSurface");
    assert.ok(!foodCardSrc.includes("fontFamily"), "FoodCard must not specify custom fontFamily");
    assert.ok(foodCardSrc.includes("width: 44") && foodCardSrc.includes("height: 44"), "FoodCard add button must meet >=44x44 touch target");
    assert.ok(foodCardSrc.includes("colors.primary"), "FoodCard price uses Action Blue primary");
  });

  await t.test("RestaurantDetailScreen uses LinearGradient scrim and flat category chips", () => {
    assert.ok(!restDetailSrc.includes("GlassSurface"), "RestaurantDetailScreen must not use GlassSurface");
    assert.ok(restDetailSrc.includes("LinearGradient"), "RestaurantDetailScreen must use LinearGradient on hero banner");
    assert.ok(restDetailSrc.includes("FilterChip"), "RestaurantDetailScreen must use FilterChip");
  });

  await t.test("CartScreen uses flat item cards, InfoRow order summary, and Action Blue checkout button", () => {
    assert.ok(!cartScreenSrc.includes("GlassSurface"), "CartScreen must not use GlassSurface");
    assert.ok(cartScreenSrc.includes("InfoRow"), "CartScreen must use InfoRow for bill breakdown");
    assert.ok(cartScreenSrc.includes("onProceedCheckout"), "CartScreen must have checkout trigger action");
    assert.ok(cartScreenSrc.includes("qtyButton"), "CartScreen must have stepper quantity buttons");
  });

  await t.test("CartIndexScreen uses flat restaurant cards and clean empty state", () => {
    assert.ok(!cartIndexSrc.includes("GlassSurface"), "CartIndexScreen must not use GlassSurface");
    assert.ok(cartIndexSrc.includes("emptyCard") || cartIndexSrc.includes("emptyTitle"), "CartIndexScreen must have clear empty state");
    assert.ok(cartIndexSrc.includes("cartCard"), "CartIndexScreen must render restaurant cart cards");
  });
});
