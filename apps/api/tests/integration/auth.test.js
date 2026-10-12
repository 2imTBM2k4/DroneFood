import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../app.js";
import { User } from "../../models/index.cjs";
import { createUser, generateToken } from "../helpers.js";

describe("Auth API", () => {
  describe("POST /api/user/register", () => {
    it("should register a new user", async () => {
      const res = await request(app).post("/api/user/register").send({
        name: "New User",
        email: "newuser@test.com",
        password: "password123",
      });

      expect(res.body.success).toBe(true);
      expect(res.body.requiresVerification).toBe(true);
      expect(res.body.token).toBeUndefined();
    });

    it("should reject duplicate email", async () => {
      await request(app).post("/api/user/register").send({
        name: "User1",
        email: "same@test.com",
        password: "password123",
      });

      const res = await request(app).post("/api/user/register").send({
        name: "User2",
        email: "same@test.com",
        password: "password123",
      });

      expect(res.body.success).toBe(false);
    });

    it("should reject invalid email", async () => {
      const res = await request(app).post("/api/user/register").send({
        name: "User",
        email: "bad-email",
        password: "password123",
      });

      expect(res.body.success).toBe(false);
    });

    it("should reject short password", async () => {
      const res = await request(app).post("/api/user/register").send({
        name: "User",
        email: "valid@test.com",
        password: "short",
      });

      expect(res.body.success).toBe(false);
    });
  });

  describe("POST /api/user/login", () => {
    beforeEach(async () => {
      await request(app).post("/api/user/register").send({
        name: "Login User",
        email: "loginuser@test.com",
        password: "password123",
      });
      await User.updateOne({ email: "loginuser@test.com" }, { isEmailVerified: true });
    });

    it("should login with valid credentials", async () => {
      const res = await request(app).post("/api/user/login").send({
        email: "loginuser@test.com",
        password: "password123",
      });

      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.role).toBe("user");
    });

    it("should reject login if email is not verified", async () => {
      await User.updateOne({ email: "loginuser@test.com" }, { isEmailVerified: false });
      const res = await request(app).post("/api/user/login").send({
        email: "loginuser@test.com",
        password: "password123",
      });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.isUnverified).toBe(true);
    });

    it("should reject wrong password", async () => {
      const res = await request(app).post("/api/user/login").send({
        email: "loginuser@test.com",
        password: "wrongpass123",
      });

      expect(res.body.success).toBe(false);
    });

    it("should reject non-existent user", async () => {
      const res = await request(app).post("/api/user/login").send({
        email: "nobody@test.com",
        password: "password123",
      });

      expect(res.body.success).toBe(false);
    });
  });

  describe("POST /api/user/verify-email & /api/user/resend-verification", () => {
    it("should verify user email via API", async () => {
      await request(app).post("/api/user/register").send({
        name: "Verify API User",
        email: "verifyapi@test.com",
        password: "password123",
      });

      const rawToken = "integtesttoken1234567890123456";
      const crypto = await import("crypto");
      const hashed = crypto.createHash("sha256").update(rawToken).digest("hex");
      await User.updateOne(
        { email: "verifyapi@test.com" },
        { emailVerificationToken: hashed, emailVerificationTokenExpires: new Date(Date.now() + 3600000) }
      );

      const res = await request(app).post("/api/user/verify-email").send({
        token: rawToken,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const user = await User.findOne({ email: "verifyapi@test.com" });
      expect(user.isEmailVerified).toBe(true);
    });

    it("should resend verification link via API", async () => {
      await request(app).post("/api/user/register").send({
        name: "Resend API User",
        email: "resendapi@test.com",
        password: "password123",
      });

      const res = await request(app).post("/api/user/resend-verification").send({
        email: "resendapi@test.com",
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("GET /api/user/me", () => {
    it("should return user profile with valid token", async () => {
      const user = await createUser({ email: "me@test.com" });
      const token = generateToken(user._id);

      const res = await request(app)
        .get("/api/user/me")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should reject request without token", async () => {
      const res = await request(app).get("/api/user/me");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("should reject invalid token", async () => {
      const res = await request(app)
        .get("/api/user/me")
        .set("Authorization", "Bearer invalid-token");

      expect(res.status).toBe(401);
    });

    it("should reject locked user", async () => {
      const user = await createUser({ email: "locked@test.com", locked: true });
      const token = generateToken(user._id);

      const res = await request(app)
        .get("/api/user/me")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });
});
