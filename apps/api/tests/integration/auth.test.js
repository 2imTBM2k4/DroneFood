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
      expect(res.body.token).toBeDefined();
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
