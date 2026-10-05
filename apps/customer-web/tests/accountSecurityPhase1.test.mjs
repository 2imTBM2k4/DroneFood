import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(process.cwd());

test("password recovery UI is localized and accessible", () => {
  const login = fs.readFileSync(path.join(root, "src/components/LoginPopup/LoginPopup.jsx"), "utf8");
  const reset = fs.readFileSync(path.join(root, "src/pages/ResetPassword/ResetPassword.jsx"), "utf8");

  assert.match(login, /Nếu .* tồn tại trong hệ thống/);
  assert.match(login, /htmlFor="forgot-email"/);
  assert.match(login, /autoComplete="email"/);
  assert.match(login, /<button type="button" className="apple-text-link apple-text-link-button" onClick=\{switchToForgot\}>/);
  assert.match(reset, /htmlFor="new-password"/);
  assert.match(reset, /autoComplete="new-password"/);
  assert.match(reset, /role="alert"/);
  assert.match(reset, /role="status" aria-live="polite"/);
  assert.match(reset, /aria-pressed=\{showPassword\}/);
  assert.match(reset, /quay lại ứng dụng Drone Food bạn đang sử dụng/);
  assert.doesNotMatch(reset, /Về trang chủ để đăng nhập/);
});

test("all web clients clear their local session after a password change", () => {
  const customer = fs.readFileSync(path.join(root, "src/pages/Profile/Profile.jsx"), "utf8");
  const admin = fs.readFileSync(path.join(root, "../admin-web/src/pages/Security/Security.jsx"), "utf8");
  const restaurant = fs.readFileSync(path.join(root, "../restaurant-web/src/pages/Security/Security.jsx"), "utf8");

  assert.match(customer, /logoutCustomer\(\);\s*setShowLogin\(true\);/);
  assert.match(admin, /toast\.success\([\s\S]*?logout\(\);/);
  assert.match(restaurant, /toast\.success\([\s\S]*?logout\(\);/);
});
