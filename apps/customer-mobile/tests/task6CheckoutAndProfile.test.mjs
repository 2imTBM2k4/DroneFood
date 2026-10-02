import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = path.resolve(process.cwd());

test("Task 6: Checkout and Profile Screens Architecture & Design System Adherence", async (t) => {
  const checkoutSrc = fs.readFileSync(
    path.join(ROOT, "src/screens/checkout/CheckoutScreen.tsx"),
    "utf8"
  );
  const profileSrc = fs.readFileSync(
    path.join(ROOT, "src/screens/profile/ProfileScreen.tsx"),
    "utf8"
  );
  const addressModalSrc = fs.readFileSync(
    path.join(ROOT, "src/components/address/AddressBookModal.tsx"),
    "utf8"
  );
  const addressEditorSrc = fs.readFileSync(
    path.join(ROOT, "src/components/address/AddressEditorModal.tsx"),
    "utf8"
  );
  const optionGroupSrc = fs.readFileSync(
    path.join(ROOT, "src/components/food/OptionGroupModal.tsx"),
    "utf8"
  );

  await t.test("CheckoutScreen removes GlassSurface and uses flat cards", () => {
    assert.ok(!checkoutSrc.includes("GlassSurface"), "CheckoutScreen must not use GlassSurface");
    assert.ok(checkoutSrc.includes("sectionCard"), "CheckoutScreen must use sectionCard styling");
    assert.ok(checkoutSrc.includes("checkoutFooter"), "CheckoutScreen must have checkoutFooter");
  });

  await t.test("ProfileScreen removes GlassSurface and uses flat cards with 8px grid", () => {
    assert.ok(!profileSrc.includes("GlassSurface"), "ProfileScreen must not use GlassSurface");
    assert.ok(profileSrc.includes("userCard"), "ProfileScreen must have flat userCard");
    assert.ok(profileSrc.includes("menuGroupCard"), "ProfileScreen must have flat menuGroupCard");
    assert.ok(profileSrc.includes("minHeight: 68") || profileSrc.includes("minHeight: 44"), "Menu items must have accessible touch heights");
  });

  await t.test("AddressBookModal adheres to design tokens without deprecated colors", () => {
    assert.ok(!addressModalSrc.includes("colors.droneBlue"), "AddressBookModal must not use deprecated droneBlue");
    assert.ok(addressModalSrc.includes("minHeight: 44"), "Action buttons must meet >=44pt touch minimum");
  });

  await t.test("AddressEditorModal uses pill buttons and >=44pt touch targets", () => {
    assert.ok(addressEditorSrc.includes("minHeight: 44"), "GPS and preset buttons must meet >=44pt touch minimum");
    assert.ok(addressEditorSrc.includes("radius.pill"), "Action buttons use pill geometry");
  });

  await t.test("OptionGroupModal option rows and quantity buttons meet >=44pt touch targets", () => {
    assert.ok(optionGroupSrc.includes("minHeight: 44"), "Option rows must have minHeight: 44");
    assert.ok(optionGroupSrc.includes("width: 44") && optionGroupSrc.includes("height: 44"), "Quantity stepper buttons must be 44x44");
  });
});
