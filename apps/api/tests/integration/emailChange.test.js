import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import app from "../../app.js";
import { createUser, generateToken } from "../helpers.js";
import { User, Restaurant } from "../../models/index.cjs";

describe("Email Change with Password & OTP verification", () => {
  it("should reject request-email-change with wrong password", async () => {
    const user = await createUser({ name: "Test User", email: "origin@test.com", password: "password123" });
    const token = generateToken(user._id);

    const res = await request(app)
      .post("/api/user/request-email-change")
      .set("Authorization", `Bearer ${token}`)
      .send({
        newEmail: "dest@test.com",
        currentPassword: "wrongpassword",
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("Mật khẩu hiện tại không đúng");
  });

  it("should reject request-email-change if new email is same as current", async () => {
    const user = await createUser({ name: "Test User", email: "same@test.com", password: "password123" });
    const token = generateToken(user._id);

    const res = await request(app)
      .post("/api/user/request-email-change")
      .set("Authorization", `Bearer ${token}`)
      .send({
        newEmail: "same@test.com",
        currentPassword: "password123",
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("Email mới phải khác email hiện tại");
  });

  it("should successfully request email change, store OTP and confirm change", async () => {
    const user = await createUser({ name: "Test User", email: "before@test.com", password: "password123" });
    const token = generateToken(user._id);

    const reqRes = await request(app)
      .post("/api/user/request-email-change")
      .set("Authorization", `Bearer ${token}`)
      .send({
        newEmail: "after@test.com",
        currentPassword: "password123",
      });

    expect(reqRes.status).toBe(200);
    expect(reqRes.body.success).toBe(true);

    // Retrieve pending OTP from DB to simulate user entering code received in email
    const updatedUserInDb = await User.findById(user._id).select("+pendingEmail +emailVerificationOtp");
    expect(updatedUserInDb.pendingEmail).toBe("after@test.com");
    expect(updatedUserInDb.emailVerificationOtp).toBeDefined();

    // Try wrong OTP first
    const wrongOtpRes = await request(app)
      .post("/api/user/confirm-email-change")
      .set("Authorization", `Bearer ${token}`)
      .send({ otp: "000000" });

    expect(wrongOtpRes.status).toBe(400);
    expect(wrongOtpRes.body.success).toBe(false);

    // Now test with correct OTP by hashing simulation
    // Let's set a known OTP directly to test confirm
    const crypto = await import("crypto");
    const testOtp = "123456";
    const hashedOtp = crypto.createHash("sha256").update(testOtp).digest("hex");
    await User.findByIdAndUpdate(user._id, { emailVerificationOtp: hashedOtp });

    const confirmRes = await request(app)
      .post("/api/user/confirm-email-change")
      .set("Authorization", `Bearer ${token}`)
      .send({ otp: testOtp });

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.success).toBe(true);
    expect(confirmRes.body.data.email).toBe("after@test.com");

    // Verify DB state
    const finalUser = await User.findById(user._id).select("+pendingEmail +emailVerificationOtp");
    expect(finalUser.email).toBe("after@test.com");
    expect(finalUser.pendingEmail).toBeNull();
    expect(finalUser.emailVerificationOtp).toBeNull();
  });

  describe("Cập nhật email hồ sơ qua PUT /api/user/profile và đăng nhập lại bằng email mới", () => {
    it("cho phép đổi email tài khoản nhà hàng, đồng bộ restaurant và đăng nhập lại thành công bằng email mới", async () => {
      const initialEmail = `owner-before-${Date.now()}@test.com`;
      const newEmail = `owner-after-${Date.now()}@test.com`;

      const user = await createUser({
        name: "Chủ Quán",
        email: initialEmail,
        password: "password123",
        role: "restaurant_owner",
      });

      const restaurant = await Restaurant.create({
        name: "Nhà Hàng Cơm Tấm",
        email: initialEmail,
        phone: "0901234567",
        address: "123 Nguyễn Huệ",
        owner: user._id,
        isLocked: false,
      });

      user.restaurantId = restaurant._id;
      await user.save();

      const token = generateToken(user._id);

      // 1. Cập nhật email qua PUT /api/user/profile
      const updateRes = await request(app)
        .put("/api/user/profile")
        .set("Authorization", `Bearer ${token}`)
        .send({ email: newEmail });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.success).toBe(true);
      expect(updateRes.body.data.email).toBe(newEmail);

      // 2. Kiểm tra trong DB: User.email đã được cập nhật
      const userInDb = await User.findById(user._id);
      expect(userInDb.email).toBe(newEmail);

      // 3. Kiểm tra Restaurant.email cũng được tự động đồng bộ
      const restInDb = await Restaurant.findById(restaurant._id);
      expect(restInDb.email).toBe(newEmail);

      // 4. Đăng nhập lại với email mới và mật khẩu cũ -> Thành công
      const loginNewRes = await request(app)
        .post("/api/user/login")
        .send({
          email: newEmail,
          password: "password123",
          portal: "restaurant",
        });

      expect(loginNewRes.status).toBe(200);
      expect(loginNewRes.body.success).toBe(true);
      expect(loginNewRes.body.token).toBeDefined();

      // 5. Đăng nhập lại bằng email cũ -> Thất bại 401
      const loginOldRes = await request(app)
        .post("/api/user/login")
        .send({
          email: initialEmail,
          password: "password123",
          portal: "restaurant",
        });

      expect(loginOldRes.status).toBe(401);
      expect(loginOldRes.body.success).toBe(false);
    });

    it("từ chối đổi email nếu email mới đã được tài khoản khác sử dụng", async () => {
      const emailA = `user-a-${Date.now()}@test.com`;
      const emailB = `user-b-${Date.now()}@test.com`;

      const userA = await createUser({
        name: "User A",
        email: emailA,
        password: "password123",
      });

      const userB = await createUser({
        name: "User B",
        email: emailB,
        password: "password123",
      });

      const tokenB = generateToken(userB._id);

      // User B cố tình đổi sang email của User A
      const updateRes = await request(app)
        .put("/api/user/profile")
        .set("Authorization", `Bearer ${tokenB}`)
        .send({ email: emailA });

      expect(updateRes.status).toBe(409);
      expect(updateRes.body.success).toBe(false);
      expect(updateRes.body.message).toContain("đã được sử dụng");
    });
  });
});
