import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import app from "../../app.js";
import { AuditLog, ExpoPushToken, User } from "../../models/index.cjs";
import { createUser, generateToken } from "../helpers.js";

const emailSpy = vi.hoisted(() => ({
  send: vi.fn(),
}));

vi.mock("../../utils/sendEmail.js", () => ({
  default: emailSpy.send,
}));

describe("Account, Password & Device Lifecycle Business Flows (Group 3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Flow 16: Forgot & Reset Password Lifecycle with Secure Tokens", () => {
    it("manages token generation, email dispatch, invalid token rejection, reset and credential validation", async () => {
      const email = "forgot-flow@test.com";
      const oldPassword = "OriginalPass123";
      const newPassword = "NewSecretPass456";

      const user = await createUser({
        email,
        password: oldPassword,
        name: "Test Forgot User",
      });

      // Step 1: User requests password reset
      const forgotRes = await request(app)
        .post("/api/user/forgot-password")
        .send({ email });

      expect(forgotRes.status).toBe(200);
      expect(forgotRes.body.success).toBe(true);
      expect(emailSpy.send).toHaveBeenCalledTimes(1);

      const emailPayload = emailSpy.send.mock.calls[0][0];
      expect(emailPayload.to).toBe(email);
      expect(emailPayload.subject).toContain("Password Reset");

      // Extract 64-char hex reset token from email HTML link
      const match = emailPayload.html.match(/\/reset-password\/([a-f0-9]{64})/);
      expect(match).not.toBeNull();
      const resetToken = match[1];

      // Verify DB contains hashed token and 15-min expiry
      const userWithToken = await User.findById(user._id).select("+resetPasswordToken +resetPasswordExpires");
      expect(userWithToken.resetPasswordToken).toBeDefined();
      expect(userWithToken.resetPasswordExpires.getTime()).toBeGreaterThan(Date.now());

      // Step 2: Attempting to reset with invalid token is rejected
      const invalidTokenRes = await request(app)
        .post("/api/user/reset-password")
        .send({ token: "invalid-token-12345", password: newPassword });

      expect(invalidTokenRes.status).toBe(400);
      expect(invalidTokenRes.body.message).toMatch(/Invalid or expired reset token/i);

      // Step 3: Attempting to reset with password too short (< 8 chars) is rejected
      const shortPassRes = await request(app)
        .post("/api/user/reset-password")
        .send({ token: resetToken, password: "short" });

      expect(shortPassRes.status).toBe(400);
      expect(shortPassRes.body.message).toMatch(/at least 8 characters/i);

      // Step 4: Reset with valid token and strong password succeeds
      const resetRes = await request(app)
        .post("/api/user/reset-password")
        .send({ token: resetToken, password: newPassword });

      expect(resetRes.status).toBe(200);
      expect(resetRes.body.success).toBe(true);

      // Verify token fields are cleared in database
      const userAfterReset = await User.findById(user._id).select("+resetPasswordToken +resetPasswordExpires");
      expect(userAfterReset.resetPasswordToken).toBeNull();
      expect(userAfterReset.resetPasswordExpires).toBeNull();

      // Step 5: Old password fails to login
      const oldLoginRes = await request(app)
        .post("/api/user/login")
        .send({ email, password: oldPassword });

      expect(oldLoginRes.status).toBe(401);
      expect(oldLoginRes.body.success).toBe(false);

      // Step 6: New password logs in successfully
      const newLoginRes = await request(app)
        .post("/api/user/login")
        .send({ email, password: newPassword });

      expect(newLoginRes.status).toBe(200);
      expect(newLoginRes.body.success).toBe(true);
      expect(newLoginRes.body.token).toBeDefined();
    });
  });

  describe("Flow 17: Change Password Security & Duplicate Password Prevention", () => {
    it("enforces current password verification, rejects identical new password, and creates audit log", async () => {
      const email = "change-flow@test.com";
      const currentPassword = "CurrentPass123";
      const brandNewPassword = "BrandNewPass789";

      const user = await createUser({
        email,
        password: currentPassword,
        name: "Test Change User",
      });
      const token = generateToken(user._id);

      // Step 1: Wrong current password is rejected
      const wrongCurrentRes = await request(app)
        .put("/api/user/change-password")
        .set("Authorization", `Bearer ${token}`)
        .send({
          currentPassword: "WrongPassword999",
          newPassword: brandNewPassword,
        });

      expect(wrongCurrentRes.status).toBe(400);
      expect(wrongCurrentRes.body.message).toContain("Mật khẩu hiện tại không đúng");

      // Step 2: New password identical to current password is rejected
      const samePassRes = await request(app)
        .put("/api/user/change-password")
        .set("Authorization", `Bearer ${token}`)
        .send({
          currentPassword,
          newPassword: currentPassword,
        });

      expect(samePassRes.status).toBe(400);
      expect(samePassRes.body.message).toContain("Mật khẩu mới phải khác mật khẩu hiện tại");

      // Step 3: Valid password change succeeds
      const changeRes = await request(app)
        .put("/api/user/change-password")
        .set("Authorization", `Bearer ${token}`)
        .send({
          currentPassword,
          newPassword: brandNewPassword,
        });

      expect(changeRes.status).toBe(200);
      expect(changeRes.body.success).toBe(true);

      // Step 4: Verify audit log was recorded
      const audit = await AuditLog.findOne({
        targetId: user._id,
        action: "password.changed",
      });
      expect(audit).not.toBeNull();
      expect(audit.category).toBe("password");

      // Step 5: Verify login with new password works
      const loginRes = await request(app)
        .post("/api/user/login")
        .send({ email, password: brandNewPassword });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.token).toBeDefined();
    });
  });

  describe("Flow 18: Address Book Lifecycle, Single Default Invariant & Max Limits", () => {
    it("handles creation, default setting, default-delete protection, update and removal", async () => {
      const user = await createUser({ email: "addressbook-flow@test.com", name: "Le Hoang Nam" });
      const token = generateToken(user._id);

      const homeAddress = {
        label: "Nhà Riêng",
        phone: "0901234567",
        address: "123 Lê Lợi, Phường Bến Nghé, Quận 1",
        city: "Hồ Chí Minh",
        state: "Hồ Chí Minh",
        country: "Việt Nam",
        zipCode: "70000",
        lat: 10.7769,
        lng: 106.7009,
      };

      const officeAddress = {
        label: "Văn Phòng",
        phone: "0909876543",
        address: "456 Nguyễn Thị Minh Khai, Phường 5, Quận 3",
        city: "Hồ Chí Minh",
        state: "Hồ Chí Minh",
        country: "Việt Nam",
        zipCode: "70000",
        lat: 10.7725,
        lng: 106.6892,
      };

      // Step 1: Add first address -> automatically becomes default
      const addHomeRes = await request(app)
        .post("/api/address-book")
        .set("Authorization", `Bearer ${token}`)
        .send(homeAddress);

      expect(addHomeRes.status).toBe(201);
      expect(addHomeRes.body.success).toBe(true);
      expect(addHomeRes.body.data.isDefault).toBe(true);
      const homeId = addHomeRes.body.data.id;

      // Step 2: Add second address -> isDefault is false
      const addOfficeRes = await request(app)
        .post("/api/address-book")
        .set("Authorization", `Bearer ${token}`)
        .send({ ...officeAddress, isDefault: false });

      expect(addOfficeRes.status).toBe(201);
      expect(addOfficeRes.body.data.isDefault).toBe(false);
      const officeId = addOfficeRes.body.data.id;

      // Step 3: List address book
      const listRes = await request(app)
        .get("/api/address-book")
        .set("Authorization", `Bearer ${token}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data).toHaveLength(2);

      // Step 4: Safety guard - Deleting the default address is blocked with 409 Conflict
      const deleteDefaultRes = await request(app)
        .delete(`/api/address-book/${homeId}`)
        .set("Authorization", `Bearer ${token}`);

      expect(deleteDefaultRes.status).toBe(409);
      expect(deleteDefaultRes.body.message).toMatch(/default address must be changed before deletion/i);

      // Step 5: Set office as default -> office becomes default, home is no longer default
      const setDefaultRes = await request(app)
        .put(`/api/address-book/${officeId}/default`)
        .set("Authorization", `Bearer ${token}`);

      expect(setDefaultRes.status).toBe(200);
      const updatedEntries = setDefaultRes.body.data;
      const officeUpdated = updatedEntries.find((e) => e.id === officeId);
      const homeUpdated = updatedEntries.find((e) => e.id === homeId);
      expect(officeUpdated.isDefault).toBe(true);
      expect(homeUpdated.isDefault).toBe(false);

      // Step 6: Update home address details
      const updateRes = await request(app)
        .patch(`/api/address-book/${homeId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          label: "Nhà Bố Mẹ",
          phone: "0901112233",
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.label).toBe("Nhà Bố Mẹ");
      expect(updateRes.body.data.phone).toBe("0901112233");

      // Step 7: Delete home address (now non-default) -> succeeds
      const deleteHomeRes = await request(app)
        .delete(`/api/address-book/${homeId}`)
        .set("Authorization", `Bearer ${token}`);

      expect(deleteHomeRes.status).toBe(200);
      expect(deleteHomeRes.body.data).toHaveLength(1);
      expect(deleteHomeRes.body.data[0].id).toBe(officeId);
    });
  });

  describe("Flow 19: Push Token Management & Multi-Platform Registration", () => {
    it("registers push token, handles idempotent upserts, validates format, and unregisters on logout", async () => {
      const user = await createUser({ email: "pushtoken-flow@test.com" });
      const token = generateToken(user._id);
      const expoToken = "ExponentPushToken[AbCdEf1234567890abcdef1234567890]";

      // Step 1: Register Android device push token
      const regRes = await request(app)
        .post("/api/push-tokens/register")
        .set("Authorization", `Bearer ${token}`)
        .send({
          token: expoToken,
          platform: "android",
        });

      expect(regRes.status).toBe(200);
      expect(regRes.body.success).toBe(true);
      expect(regRes.body.data.registered).toBe(true);

      // Verify token persisted in DB
      const savedToken = await ExpoPushToken.findOne({ token: expoToken });
      expect(savedToken).not.toBeNull();
      expect(savedToken.platform).toBe("android");
      expect(savedToken.user.toString()).toBe(user._id.toString());

      // Step 2: Idempotent re-registration does not throw duplicate errors
      const reRegRes = await request(app)
        .post("/api/push-tokens/register")
        .set("Authorization", `Bearer ${token}`)
        .send({
          token: expoToken,
          platform: "android",
        });

      expect(reRegRes.status).toBe(200);
      expect(reRegRes.body.data.registered).toBe(true);
      const count = await ExpoPushToken.countDocuments({ token: expoToken });
      expect(count).toBe(1);

      // Step 3: Invalid token format is rejected with 400 Bad Request
      const badTokenRes = await request(app)
        .post("/api/push-tokens/register")
        .set("Authorization", `Bearer ${token}`)
        .send({
          token: "invalid-raw-token",
          platform: "android",
        });

      expect(badTokenRes.status).toBe(400);
      expect(badTokenRes.body.message).toMatch(/Invalid Expo push token/i);

      // Step 4: Unregister token on logout
      const unregRes = await request(app)
        .post("/api/push-tokens/unregister")
        .set("Authorization", `Bearer ${token}`)
        .send({ token: expoToken });

      expect(unregRes.status).toBe(200);
      expect(unregRes.body.data.unregistered).toBe(true);

      // Verify token was deleted from DB
      const afterUnreg = await ExpoPushToken.findOne({ token: expoToken });
      expect(afterUnreg).toBeNull();
    });
  });
});
