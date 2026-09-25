import { describe, it, expect } from "vitest";
import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";
import { User } from "../../models/index.cjs";
import { protect, optionalAuth } from "../../middleware/auth.js";
import { createUser, generateToken } from "../helpers.js";

const createTestApp = (middleware) => {
  const app = express();
  app.use(express.json());
  app.get("/test", middleware, (req, res) => {
    res.json({ success: true, user: req.user || null });
  });
  return app;
};

describe("auth middleware", () => {
  describe("protect", () => {
    const app = createTestApp(protect);

    it("should allow request with valid Bearer token", async () => {
      const user = await createUser({ email: "protect1@test.com" });
      const token = generateToken(user._id);

      const res = await request(app)
        .get("/test")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user).toBeDefined();
    });

    it("should allow request with token header", async () => {
      const user = await createUser({ email: "protect2@test.com" });
      const token = generateToken(user._id);

      const res = await request(app).get("/test").set("token", token);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should reject request without token", async () => {
      const res = await request(app).get("/test");
      expect(res.status).toBe(401);
    });

    it("should reject invalid token", async () => {
      const res = await request(app)
        .get("/test")
        .set("Authorization", "Bearer invalid.token.here");

      expect(res.status).toBe(401);
    });

    it("should reject token for deleted user", async () => {
      const user = await createUser({ email: "deleted@test.com" });
      const token = generateToken(user._id);
      await User.findByIdAndDelete(user._id);

      const res = await request(app)
        .get("/test")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it("should reject locked user", async () => {
      const user = await createUser({
        email: "locked@test.com",
        locked: true,
      });
      const token = generateToken(user._id);

      const res = await request(app)
        .get("/test")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it("should reject token signed with wrong secret", async () => {
      const user = await createUser({ email: "wrongsecret@test.com" });
      const badToken = jwt.sign({ id: user._id }, "wrong-secret");

      const res = await request(app)
        .get("/test")
        .set("Authorization", `Bearer ${badToken}`);

      expect(res.status).toBe(401);
    });
  });

  describe("optionalAuth", () => {
    const app = createTestApp(optionalAuth);

    it("should set user when valid token provided", async () => {
      const user = await createUser({ email: "optional1@test.com" });
      const token = generateToken(user._id);

      const res = await request(app)
        .get("/test")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.user).not.toBeNull();
    });

    it("should continue without user when no token", async () => {
      const res = await request(app).get("/test");

      expect(res.status).toBe(200);
      expect(res.body.user).toBeNull();
    });

    it("should continue without user when invalid token", async () => {
      const res = await request(app)
        .get("/test")
        .set("Authorization", "Bearer bad-token");

      expect(res.status).toBe(200);
      expect(res.body.user).toBeNull();
    });

    it("should skip locked user silently", async () => {
      const user = await createUser({
        email: "optlocked@test.com",
        locked: true,
      });
      const token = generateToken(user._id);

      const res = await request(app)
        .get("/test")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.user).toBeNull();
    });
  });
});
