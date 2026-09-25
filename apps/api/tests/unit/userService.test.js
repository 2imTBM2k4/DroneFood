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
      expect(result.token).toBeDefined();

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
});
