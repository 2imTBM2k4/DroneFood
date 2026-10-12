import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../app.js";
import { createUser, generateToken } from "../helpers.js";
import { User } from "../../models/index.cjs";

describe("Phone Change with Password & Email OTP verification", () => {
  it("should reject request-phone-change with wrong password", async () => {
    const user = await createUser({
      name: "Test User",
      email: "phone_test1@test.com",
      password: "password123",
      phone: "0912345678",
    });
    const token = generateToken(user._id);

    const res = await request(app)
      .post("/api/user/request-phone-change")
      .set("Authorization", `Bearer ${token}`)
      .send({
        newPhone: "0987654321",
        currentPassword: "wrongpassword",
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("Mật khẩu hiện tại không đúng");
  });

  it("should reject request-phone-change if new phone is same as current phone", async () => {
    const user = await createUser({
      name: "Test User",
      email: "phone_test2@test.com",
      password: "password123",
      phone: "0912345678",
    });
    const token = generateToken(user._id);

    const res = await request(app)
      .post("/api/user/request-phone-change")
      .set("Authorization", `Bearer ${token}`)
      .send({
        newPhone: "0912345678",
        currentPassword: "password123",
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("Số điện thoại mới phải khác số điện thoại hiện tại");
  });

  it("should successfully request phone change, store OTP and confirm change", async () => {
    const user = await createUser({
      name: "Test User",
      email: "phone_test3@test.com",
      password: "password123",
      phone: "0912345678",
    });
    const token = generateToken(user._id);

    const reqRes = await request(app)
      .post("/api/user/request-phone-change")
      .set("Authorization", `Bearer ${token}`)
      .send({
        newPhone: "0988776655",
        currentPassword: "password123",
      });

    expect(reqRes.status).toBe(200);
    expect(reqRes.body.success).toBe(true);

    const updatedUserInDb = await User.findById(user._id).select("+pendingPhone +phoneVerificationOtp");
    expect(updatedUserInDb.pendingPhone).toBe("0988776655");
    expect(updatedUserInDb.phoneVerificationOtp).toBeDefined();

    // Try wrong OTP
    const wrongOtpRes = await request(app)
      .post("/api/user/confirm-phone-change")
      .set("Authorization", `Bearer ${token}`)
      .send({ otp: "000000" });

    expect(wrongOtpRes.status).toBe(400);
    expect(wrongOtpRes.body.success).toBe(false);

    // Test with correct OTP
    const crypto = await import("crypto");
    const testOtp = "654321";
    const hashedOtp = crypto.createHash("sha256").update(testOtp).digest("hex");
    await User.findByIdAndUpdate(user._id, { phoneVerificationOtp: hashedOtp });

    const confirmRes = await request(app)
      .post("/api/user/confirm-phone-change")
      .set("Authorization", `Bearer ${token}`)
      .send({ otp: testOtp });

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.success).toBe(true);
    expect(confirmRes.body.data.phone).toBe("0988776655");

    // Verify DB state
    const finalUser = await User.findById(user._id).select("+pendingPhone +phoneVerificationOtp");
    expect(finalUser.phone).toBe("0988776655");
    expect(finalUser.pendingPhone).toBeNull();
    expect(finalUser.phoneVerificationOtp).toBeNull();
  });
});
