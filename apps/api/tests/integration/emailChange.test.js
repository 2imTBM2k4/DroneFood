import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import app from "../../app.js";
import { createUser, generateToken } from "../helpers.js";
import { User } from "../../models/index.cjs";

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
});
