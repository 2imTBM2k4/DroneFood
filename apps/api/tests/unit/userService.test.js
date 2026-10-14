import { describe, it, expect } from "vitest";
import bcrypt from "bcrypt";
import { User, ShipperProfile } from "../../models/index.cjs";
import * as userService from "../../services/userService.js";

describe("userService", () => {
  describe("registerUser", () => {
    it("should register a new user successfully", async () => {
      const result = await userService.registerUser({
        name: "John",
        email: "john@test.com",
        password: "password123",
      });

      expect(result.success).toBe(true);
      expect(result.requiresVerification).toBe(true);
      expect(result.token).toBeUndefined();

      const user = await User.findOne({ email: "john@test.com" });
      expect(user).not.toBeNull();
      expect(user.name).toBe("John");
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
  });

  describe("loginUser", () => {
    beforeEach(async () => {
      await userService.registerUser({
        name: "Login User",
        email: "login@test.com",
        password: "password123",
      });
      await User.updateOne({ email: "login@test.com" }, { isEmailVerified: true });
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

    it("should reject login if email is not verified", async () => {
      await User.updateOne({ email: "login@test.com" }, { isEmailVerified: false });

      await expect(
        userService.loginUser({
          email: "login@test.com",
          password: "password123",
        })
      ).rejects.toThrow("chưa được kích hoạt");
    });

    it("returns the generic credential error for a non-existent email", async () => {
      await expect(
        userService.loginUser({
          email: "nouser@test.com",
          password: "password123",
        })
      ).rejects.toMatchObject({
        message: "Invalid credentials",
        code: "INVALID_CREDENTIALS",
      });
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

    it("should enforce portal role restrictions", async () => {
      // unlock the test user
      const testUser = await User.findOne({ email: "login@test.com" });
      await User.findByIdAndUpdate(testUser._id, { locked: false, role: "user" });

      // Customer trying to login to admin portal -> reject
      await expect(
        userService.loginUser({
          email: "login@test.com",
          password: "password123",
          portal: "admin",
        })
      ).rejects.toThrow("Quản trị");

      // Customer trying to login to restaurant portal -> reject
      await expect(
        userService.loginUser({
          email: "login@test.com",
          password: "password123",
          portal: "restaurant",
        })
      ).rejects.toThrow("Nhà hàng");

      // Customer logging into customer portal -> allow
      const customerLogin = await userService.loginUser({
        email: "login@test.com",
        password: "password123",
        portal: "customer",
      });
      expect(customerLogin.success).toBe(true);

      // Now create an admin user
      await User.create({
        name: "Admin User",
        email: "adminportal@test.com",
        password: await bcrypt.hash("password123", 10),
        role: "admin",
        isEmailVerified: true,
      });

      // Admin trying to login to customer portal -> reject
      await expect(
        userService.loginUser({
          email: "adminportal@test.com",
          password: "password123",
          portal: "customer",
        })
      ).rejects.toThrow("Khách hàng");

      // Admin trying to login to restaurant portal -> reject
      await expect(
        userService.loginUser({
          email: "adminportal@test.com",
          password: "password123",
          portal: "restaurant",
        })
      ).rejects.toThrow("Nhà hàng");

      // Admin logging into admin portal -> allow
      const adminLogin = await userService.loginUser({
        email: "adminportal@test.com",
        password: "password123",
        portal: "admin",
      });
      expect(adminLogin.success).toBe(true);

      // Now create a restaurant owner
      await User.create({
        name: "Rest Owner",
        email: "restportal@test.com",
        password: await bcrypt.hash("password123", 10),
        role: "restaurant_owner",
        isEmailVerified: true,
      });

      // Restaurant owner trying to login to customer portal -> reject
      await expect(
        userService.loginUser({
          email: "restportal@test.com",
          password: "password123",
          portal: "customer",
        })
      ).rejects.toThrow("Khách hàng");

      // Restaurant owner trying to login to admin portal -> reject
      await expect(
        userService.loginUser({
          email: "restportal@test.com",
          password: "password123",
          portal: "admin",
        })
      ).rejects.toThrow("Quản trị");

      // Restaurant owner logging into restaurant portal -> allow
      const restLogin = await userService.loginUser({
        email: "restportal@test.com",
        password: "password123",
        portal: "restaurant",
      });
      expect(restLogin.success).toBe(true);
    });
  });

  describe("verifyEmail & resendVerification", () => {
    it("should verify email with valid token", async () => {
      const reg = await userService.registerUser({
        name: "Verify Me",
        email: "verifyme@test.com",
        password: "password123",
      });
      expect(reg.requiresVerification).toBe(true);

      const user = await User.findOne({ email: "verifyme@test.com" }).select(
        "+emailVerificationToken +emailVerificationTokenExpires"
      );
      expect(user.isEmailVerified).toBe(false);

      // Verify with invalid token
      await expect(userService.verifyEmail("invalid-token")).rejects.toThrow(
        "không hợp lệ hoặc đã hết hạn"
      );

      // To verify with valid token, let's create a known raw token
      const rawToken = "mytesttoken12345678901234567890";
      const crypto = await import("crypto");
      const hashed = crypto.createHash("sha256").update(rawToken).digest("hex");
      await User.updateOne(
        { email: "verifyme@test.com" },
        { emailVerificationToken: hashed, emailVerificationTokenExpires: new Date(Date.now() + 3600000) }
      );

      const verifyResult = await userService.verifyEmail(rawToken);
      expect(verifyResult.success).toBe(true);

      const updated = await User.findOne({ email: "verifyme@test.com" });
      expect(updated.isEmailVerified).toBe(true);
    });

    it("should resend verification email for unverified user", async () => {
      await userService.registerUser({
        name: "Resend User",
        email: "resend@test.com",
        password: "password123",
      });

      const res = await userService.resendVerification("resend@test.com");
      expect(res.success).toBe(true);
      expect(res.message).toContain("Liên kết kích hoạt");
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
});
