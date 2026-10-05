import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(process.cwd());

test("mobile auth and settings expose password recovery and change flows", () => {
  const app = fs.readFileSync(path.join(root, "App.tsx"), "utf8");
  const auth = fs.readFileSync(path.join(root, "src/screens/auth/AuthScreen.tsx"), "utf8");
  const profile = fs.readFileSync(path.join(root, "src/screens/profile/ProfileScreen.tsx"), "utf8");
  const client = fs.readFileSync(path.join(root, "src/api/client.ts"), "utf8");
  const input = fs.readFileSync(path.join(root, "src/components/common/Input.tsx"), "utf8");

  assert.match(auth, /handleForgotPassword/);
  assert.match(auth, /autoComplete="email"/);
  assert.match(auth, /style=\{styles\.errorBox\} accessibilityRole="alert"/);
  assert.match(profile, /Bảo mật tài khoản/);
  assert.match(profile, /autoComplete="current-password"/);
  assert.match(profile, /autoComplete="new-password"/);
  assert.match(client, /\/api\/user\/forgot-password/);
  assert.match(client, /\/api\/user\/change-password/);
  assert.match(input, /accessibilityState=\{\{ selected: !hidePassword \}\}/);
  assert.match(input, /minWidth:\s*48/);
  assert.match(input, /minHeight:\s*48/);
  assert.match(app, /await userApi\.changePassword\(currentPassword, newPassword\);\s*await handleLogout\(\);/);
});

test("all mobile clients clear their local session after a password change", () => {
  const restaurant = fs.readFileSync(path.join(root, "../restaurant-mobile/src/application/RestaurantApp.tsx"), "utf8");
  const restaurantAuth = fs.readFileSync(path.join(root, "../restaurant-mobile/src/screens/auth/AuthScreen.tsx"), "utf8");
  const shipper = fs.readFileSync(path.join(root, "../shipper-mobile/src/application/ShipperApp.tsx"), "utf8");

  assert.match(restaurant, /await authApi\.changePassword\(currentPassword, newPassword\);\s*await handleLogout\(\);/);
  assert.match(shipper, /await axios\.put\(`\$\{API_URL\}\/api\/user\/change-password`[\s\S]*?await logout\(\);/);
  assert.match(restaurantAuth, /accessibilityRole="tab"/);
  assert.match(restaurantAuth, /accessibilityState=\{\{ selected: mode === "login" \}\}/);
  assert.match(shipper, /accessibilityState=\{\{ disabled: Boolean\(disabled\) \}\}/);
  assert.match(shipper, /style=\{styles\.securityBackButton\}/);
  assert.match(shipper, /securityBackButton:\s*\{\s*minWidth:\s*48,\s*minHeight:\s*48/);
});
