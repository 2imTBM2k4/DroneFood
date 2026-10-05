import { beforeEach, describe, it, expect, vi } from "vitest";
import bcrypt from "bcrypt";
import { AccountEmailJob, User, ShipperProfile } from "../../models/index.cjs";
import * as userService from "../../services/userService.js";
import { processNextAccountEmailJob } from "../../services/accountEmailOutboxService.js";

const sendEmailMock = vi.hoisted(() => vi.fn());

vi.mock("../../utils/sendEmail.js", () => ({
  default: sendEmailMock,
}));

const resetTokenFromLastEmail = async () => {
  const job = await AccountEmailJob.findOne({ event: "password.reset_requested" })
    .sort({ createdAt: -1 })
    .select("+html");
  const html = job?.html || "";
  const match = html.match(/\/reset-password\/([a-f0-9]{64})/);
  if (!match) throw new Error("Reset token was not present in mocked email");
  return match[1];
};

const verificationTokenFromLastEmail = async (purpose = "registration") => {
  const event = purpose === "email_change"
    ? "email.change_verification_requested"
    : "email.verification_requested";
  const job = await AccountEmailJob.findOne({ event })
    .sort({ createdAt: -1 })
    .select("+html");
  const html = job?.html || "";
  const match = html.match(/\/verify-email\/([a-f0-9]{64})/);
  if (!match) throw new Error("Verification token was not present in mocked email");
  return match[1];
};

describe("userService", () => {
  beforeEach(() => {
    sendEmailMock.mockReset();
    sendEmailMock.mockResolvedValue({ messageId: "test-message" });
  });

  describe("registerUser", () => {
    it("should register a new user successfully", async () => {
      const result = await userService.registerUser({
        name: "John",
        email: "john@test.com",
        password: "password123",
      });

      expect(result.success).toBe(true);
      expect(result.verificationRequired).toBe(true);
      expect(result.token).toBeUndefined();

      const user = await User.findOne({ email: "john@test.com" });
      expect(user).not.toBeNull();
      expect(user.name).toBe("John");
      expect(user.emailVerified).toBe(false);
      const emailJob = await AccountEmailJob.findOne({ event: "email.verification_requested" })
        .select("+to +subject");
      expect(emailJob.to).toBe("john@test.com");
      expect(emailJob.subject).toBe("Xác minh tài khoản Drone Food");
    });

    it("should reject duplicate email", async () => {
      await userService.registerUser({
        name: "John",
        email: "dup@test.com",
        password: "password123",
      });

      await expect(
        userService.registerUser({
          name: "John2",
          email: "dup@test.com",
          password: "password123",
        })
      ).rejects.toThrow("User already exists");
    });

    it("should reject invalid email", async () => {
      await expect(
        userService.registerUser({
          name: "John",
          email: "not-an-email",
          password: "password123",
        })
      ).rejects.toThrow("valid email");
    });

    it("should reject short password", async () => {
      await expect(
        userService.registerUser({
          name: "John",
          email: "john2@test.com",
          password: "short",
        })
      ).rejects.toThrow("strong password");
    });

    it("should hash the password", async () => {
      await userService.registerUser({
        name: "John",
        email: "hash@test.com",
        password: "password123",
      });

      const user = await User.findOne({ email: "hash@test.com" }).select(
        "+password"
      );
      expect(user.password).not.toBe("password123");
      const isMatch = await bcrypt.compare("password123", user.password);
      expect(isMatch).toBe(true);
    });

    it("should register restaurant owner with restaurant", async () => {
      const result = await userService.registerUser({
        name: "Owner",
        email: "owner@test.com",
        password: "password123",
        role: "restaurant_owner",
        restaurantName: "My Restaurant",
        address: "123 Test St",
        phone: "0123456789",
      });

      expect(result.success).toBe(true);
      const user = await User.findOne({ email: "owner@test.com" });
      expect(user.role).toBe("restaurant_owner");
      expect(user.restaurantId).toBeDefined();
    });

    it("creates a pending shipper profile without an invalid empty GPS point", async () => {
      await userService.registerUser({
        name: "Shipper",
        email: "shipper-register@test.com",
        password: "password123",
        phone: "0901234567",
        role: "shipper",
      });

      const shipper = await User.findOne({ email: "shipper-register@test.com" });
      const profile = await ShipperProfile.findOne({ user: shipper._id });
      expect(profile.approvalStatus).toBe("pending");
      expect(profile.currentLocation).toBeUndefined();
    });

    it("does not roll back registration when the verification email fails", async () => {
      const result = await userService.registerUser({
        name: "Mail Failure",
        email: "mail-failure@test.com",
        password: "password123",
      });

      expect(result.success).toBe(true);
      sendEmailMock.mockRejectedValueOnce(Object.assign(new Error("smtp unavailable"), { code: "ETIMEDOUT" }));
      await processNextAccountEmailJob();
      expect(await User.findOne({ email: "mail-failure@test.com" })).not.toBeNull();
      expect(await AccountEmailJob.findOne({ event: "email.verification_requested", status: "failed" })).not.toBeNull();
    });
  });

  describe("loginUser", () => {
    beforeEach(async () => {
      await userService.registerUser({
        name: "Login User",
        email: "login@test.com",
        password: "password123",
      });
      await User.updateOne({ email: "login@test.com" }, { emailVerified: true });
    });

    it("should login with correct credentials", async () => {
      const result = await userService.loginUser({
        email: "login@test.com",
        password: "password123",
      });

      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
      expect(result.user.email).toBe("login@test.com");
    });

    it("should reject login when email is unverified", async () => {
      await User.updateOne({ email: "login@test.com" }, { emailVerified: false });
      await expect(
        userService.loginUser({
          email: "login@test.com",
          password: "password123",
        })
      ).rejects.toMatchObject({
        statusCode: 403,
        code: "EMAIL_VERIFICATION_REQUIRED",
      });
    });

    it("should reject non-existent email", async () => {
      await expect(
        userService.loginUser({
          email: "nouser@test.com",
          password: "password123",
        })
      ).rejects.toThrow("doesn't exist");
    });

    it("should reject wrong password", async () => {
      await expect(
        userService.loginUser({
          email: "login@test.com",
          password: "wrongpassword",
        })
      ).rejects.toThrow("Invalid credentials");
    });

    it("should reject locked account", async () => {
      const user = await User.findOne({ email: "login@test.com" });
      await User.findByIdAndUpdate(user._id, { locked: true });

      await expect(
        userService.loginUser({
          email: "login@test.com",
          password: "password123",
        })
      ).rejects.toThrow("locked");
    });
  });

  describe("lockUser", () => {
    // lockUser records who performed the action, so it takes the actor first.
    const adminActor = {
      _id: "507f1f77bcf86cd799439099",
      email: "admin@test.com",
      role: "admin",
    };

    it("should lock a user", async () => {
      const user = await User.create({
        name: "Lock Me",
        email: "lockme@test.com",
        password: await bcrypt.hash("pass123", 10),
      });

      const result = await userService.lockUser(adminActor, user._id, true);
      expect(result.success).toBe(true);

      const updated = await User.findById(user._id);
      expect(updated.locked).toBe(true);
    });

    it("should unlock a user", async () => {
      const user = await User.create({
        name: "Unlock Me",
        email: "unlockme@test.com",
        password: await bcrypt.hash("pass123", 10),
        locked: true,
      });

      const result = await userService.lockUser(adminActor, user._id, false);
      expect(result.success).toBe(true);

      const updated = await User.findById(user._id);
      expect(updated.locked).toBe(false);
    });

    it("should throw for non-existent user", async () => {
      const fakeId = "507f1f77bcf86cd799439011";
      await expect(userService.lockUser(adminActor, fakeId, true)).rejects.toThrow(
        "not found"
      );
    });
  });

  describe("updateUserAddress", () => {
    it("should update address with valid data", async () => {
      const user = await User.create({
        name: "Address User",
        email: "addr@test.com",
        password: await bcrypt.hash("pass123", 10),
      });

      const result = await userService.updateUserAddress(user._id, {
        fullName: "Address User",
        phone: "0123456789",
        address: "456 New St",
        city: "New City",
        state: "TS",
        country: "VN",
        zipCode: "70000",
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it("should throw for non-existent user", async () => {
      const fakeId = "507f1f77bcf86cd799439011";
      await expect(
        userService.updateUserAddress(fakeId, {
          fullName: "Test",
          address: "123 St",
          city: "City",
        })
      ).rejects.toThrow("not found");
    });
  });

  describe("deleteUser", () => {
    it("should delete existing user", async () => {
      const user = await User.create({
        name: "Delete Me",
        email: "delete@test.com",
        password: await bcrypt.hash("pass123", 10),
      });

      const result = await userService.deleteUser(user._id);
      expect(result.success).toBe(true);

      const deleted = await User.findById(user._id);
      expect(deleted).toBeNull();
    });

    it("should throw for non-existent user", async () => {
      const fakeId = "507f1f77bcf86cd799439011";
      await expect(userService.deleteUser(fakeId)).rejects.toThrow("not found");
    });
  });

  describe("password security", () => {
    it("returns the same generic forgot-password response for existing and unknown accounts", async () => {
      await userService.registerUser({
        name: "Recovery User",
        email: "recovery@test.com",
        password: "password123",
      });
      sendEmailMock.mockClear();

      const existingStartedAt = Date.now();
      const existing = await userService.forgotPassword("recovery@test.com");
      const existingDuration = Date.now() - existingStartedAt;
      const unknownStartedAt = Date.now();
      const unknown = await userService.forgotPassword("unknown@test.com");
      const unknownDuration = Date.now() - unknownStartedAt;

      expect(existing).toEqual(unknown);
      expect(existingDuration).toBeGreaterThanOrEqual(8);
      expect(unknownDuration).toBeGreaterThanOrEqual(8);
      expect(existing.message).toContain("Nếu email này tồn tại");
      expect(sendEmailMock).not.toHaveBeenCalled();
      const emailJob = await AccountEmailJob.findOne({ event: "password.reset_requested" })
        .select("+to +subject +html");
      expect(emailJob.to).toBe("recovery@test.com");
      expect(emailJob.subject).toBe("Đặt lại mật khẩu Drone Food");
      expect(emailJob.html).toContain("http://account-security.test/reset-password/");
    });

    it("rejects an expired reset token", async () => {
      const rawToken = "a".repeat(64);
      const crypto = await import("crypto");
      const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
      await User.create({
        name: "Expired User",
        email: "expired@test.com",
        password: await bcrypt.hash("password123", 10),
        resetPasswordToken: hashedToken,
        resetPasswordExpires: new Date(Date.now() - 1000),
      });

      await expect(userService.resetPassword(rawToken, "newpassword123"))
        .rejects.toThrow("hết hạn");
    });

    it("consumes a reset token once and invalidates the stored refresh token", async () => {
      await userService.registerUser({
        name: "Single Use",
        email: "single-use@test.com",
        password: "password123",
      });
      await User.updateOne({ email: "single-use@test.com" }, { emailVerified: true });
      const session = await userService.loginUser({
        email: "single-use@test.com",
        password: "password123",
      });
      await userService.forgotPassword("single-use@test.com");
      const rawToken = await resetTokenFromLastEmail();

      const result = await userService.resetPassword(rawToken, "newpassword123");
      expect(result.success).toBe(true);
      await expect(userService.resetPassword(rawToken, "anotherpassword123"))
        .rejects.toThrow("đã được sử dụng");
      await expect(userService.verifyResetToken(rawToken))
        .rejects.toThrow("đã được sử dụng");
      await expect(userService.refreshAccessToken(session.refreshToken))
        .rejects.toThrow("Invalid refresh token");
    });

    it("invalidates the stored refresh token after authenticated password change", async () => {
      await userService.registerUser({
        name: "Change User",
        email: "change@test.com",
        password: "password123",
      });
      await User.updateOne({ email: "change@test.com" }, { emailVerified: true });
      const session = await userService.loginUser({
        email: "change@test.com",
        password: "password123",
      });
      const user = await User.findOne({ email: "change@test.com" });

      await expect(userService.refreshAccessToken(session.refreshToken))
        .resolves.toEqual(expect.objectContaining({ success: true }));
      await userService.changePassword(user._id, "password123", "newpassword123");
      await expect(userService.refreshAccessToken(session.refreshToken))
        .rejects.toThrow("Invalid refresh token");
    });

    it("keeps changed and reset passwords when alert emails fail", async () => {
      await userService.registerUser({
        name: "Alert Failure",
        email: "alert-failure@test.com",
        password: "password123",
      });
      await User.updateOne({ email: "alert-failure@test.com" }, { emailVerified: true });
      const session = await userService.loginUser({
        email: "alert-failure@test.com",
        password: "password123",
      });
      const user = await User.findOne({ email: "alert-failure@test.com" });
      await AccountEmailJob.deleteMany({});

      await expect(userService.changePassword(user._id, "password123", "changedpassword123"))
        .resolves.toEqual(expect.objectContaining({ success: true }));
      sendEmailMock.mockRejectedValueOnce(Object.assign(new Error("smtp unavailable"), { code: "ETIMEDOUT" }));
      await processNextAccountEmailJob();
      let stored = await User.findById(user._id).select("+password");
      expect(await bcrypt.compare("changedpassword123", stored.password)).toBe(true);
      expect(await AccountEmailJob.findOne({ event: "password.changed", status: "failed" })).not.toBeNull();

      await userService.forgotPassword("alert-failure@test.com");
      const rawToken = await resetTokenFromLastEmail();
      sendEmailMock.mockRejectedValueOnce(Object.assign(new Error("smtp unavailable"), { code: "ETIMEDOUT" }));
      await processNextAccountEmailJob();
      await expect(userService.resetPassword(rawToken, "resetpassword123"))
        .resolves.toEqual(expect.objectContaining({ success: true }));
      sendEmailMock.mockRejectedValueOnce(Object.assign(new Error("smtp unavailable"), { code: "ETIMEDOUT" }));
      await processNextAccountEmailJob();
      stored = await User.findById(user._id).select("+password");
      expect(await bcrypt.compare("resetpassword123", stored.password)).toBe(true);
      expect(await AccountEmailJob.findOne({ event: "password.reset_succeeded", status: "failed" })).not.toBeNull();
      expect(session.refreshToken).toBeDefined();
    });

    it("allows exactly one concurrent reset and records one success notification", async () => {
      await userService.registerUser({
        name: "Concurrent Reset",
        email: "concurrent-reset@test.com",
        password: "password123",
      });
      await userService.forgotPassword("concurrent-reset@test.com");
      const rawToken = await resetTokenFromLastEmail();
      const candidates = ["winner-password-a", "winner-password-b"];

      const results = await Promise.allSettled(candidates.map((password) =>
        userService.resetPassword(rawToken, password)
      ));

      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
      const winnerIndex = results.findIndex((result) => result.status === "fulfilled");
      const stored = await User.findOne({ email: "concurrent-reset@test.com" })
        .select("+password +resetPasswordToken +resetPasswordExpires +authVersion");
      expect(await bcrypt.compare(candidates[winnerIndex], stored.password)).toBe(true);
      expect(stored.resetPasswordToken).toBeNull();
      expect(stored.resetPasswordExpires).toBeNull();
      expect(stored.authVersion).toBe(1);
      expect(await AccountEmailJob.countDocuments({ event: "password.reset_succeeded" })).toBe(1);
    });
  });

  describe("email verification and change", () => {
    it("verifies registration email and enables login", async () => {
      await userService.registerUser({
        name: "Verify Me",
        email: "verify-me@test.com",
        password: "password123",
      });
      const rawToken = await verificationTokenFromLastEmail("registration");

      const result = await userService.verifyEmail(rawToken);
      expect(result.success).toBe(true);
      expect(result.type).toBe("registration");

      const user = await User.findOne({ email: "verify-me@test.com" });
      expect(user.emailVerified).toBe(true);
      expect(user.emailVerifiedAt).toBeInstanceOf(Date);

      // Now login succeeds
      const loginRes = await userService.loginUser({
        email: "verify-me@test.com",
        password: "password123",
      });
      expect(loginRes.success).toBe(true);
      expect(loginRes.token).toBeDefined();

      // Welcome email queued
      expect(await AccountEmailJob.findOne({ event: "account.welcome", userId: user._id })).not.toBeNull();

      // Reusing token throws EMAIL_VERIFICATION_ALREADY_USED
      await expect(userService.verifyEmail(rawToken)).rejects.toMatchObject({
        statusCode: 400,
        code: "EMAIL_VERIFICATION_ALREADY_USED",
      });
    });

    it("rejects expired or invalid email verification token", async () => {
      await expect(userService.verifyEmail("invalid-token-123")).rejects.toMatchObject({
        statusCode: 400,
        code: "EMAIL_VERIFICATION_INVALID_OR_EXPIRED",
      });
    });

    it("resends verification email for unverified user", async () => {
      await userService.registerUser({
        name: "Resend User",
        email: "resend-user@test.com",
        password: "password123",
      });
      await AccountEmailJob.deleteMany({});

      const res = await userService.resendEmailVerification("resend-user@test.com");
      expect(res.success).toBe(true);
      expect(await AccountEmailJob.findOne({ event: "email.verification_requested" })).not.toBeNull();
    });

    it("handles email change request and verification", async () => {
      await userService.registerUser({
        name: "Change Email User",
        email: "original@test.com",
        password: "password123",
      });
      await User.updateOne({ email: "original@test.com" }, { emailVerified: true });
      const user = await User.findOne({ email: "original@test.com" });

      // Request email change
      const reqResult = await userService.requestEmailChange(
        user._id,
        "password123",
        "new-email@test.com"
      );
      expect(reqResult.success).toBe(true);
      expect(reqResult.verificationRequired).toBe(true);

      const updatedUser = await User.findById(user._id).select("+pendingEmail");
      expect(updatedUser.pendingEmail).toBe("new-email@test.com");

      // Verify email change token
      const rawToken = await verificationTokenFromLastEmail("email_change");
      const verifyResult = await userService.verifyEmail(rawToken);
      expect(verifyResult.success).toBe(true);
      expect(verifyResult.type).toBe("email_change");

      const finalUser = await User.findById(user._id).select("+pendingEmail +authVersion");
      expect(finalUser.email).toBe("new-email@test.com");
      expect(finalUser.pendingEmail).toBeFalsy();
      expect(finalUser.authVersion).toBe(1);
    });
  });
});
