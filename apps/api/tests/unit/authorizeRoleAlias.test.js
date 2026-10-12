import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { authorize, ROLE_ALIASES } from "../../middleware/auth.js";

const createRoleTestApp = (...roles) => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    const roleHeader = req.headers["x-test-role"];
    if (roleHeader) {
      req.user = { _id: "507f1f77bcf86cd799439011", role: roleHeader };
    }
    next();
  });
  app.get("/test", authorize(...roles), (req, res) => {
    res.json({ success: true });
  });
  return app;
};

describe("authorize middleware role alias", () => {
  it("defines bidirectional aliases between restaurant_owner and merchant_owner", () => {
    expect(ROLE_ALIASES.restaurant_owner).toContain("merchant_owner");
    expect(ROLE_ALIASES.merchant_owner).toContain("restaurant_owner");
  });

  describe("authorize('restaurant_owner')", () => {
    const app = createRoleTestApp("restaurant_owner");

    it("allows restaurant_owner role", async () => {
      const res = await request(app).get("/test").set("x-test-role", "restaurant_owner");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("allows merchant_owner role via alias", async () => {
      const res = await request(app).get("/test").set("x-test-role", "merchant_owner");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("rejects user role with 403", async () => {
      const res = await request(app).get("/test").set("x-test-role", "user");
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it("rejects shipper role with 403", async () => {
      const res = await request(app).get("/test").set("x-test-role", "shipper");
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it("rejects unauthenticated request with 403", async () => {
      const res = await request(app).get("/test");
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe("authorize('merchant_owner')", () => {
    const app = createRoleTestApp("merchant_owner");

    it("allows merchant_owner role", async () => {
      const res = await request(app).get("/test").set("x-test-role", "merchant_owner");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("allows restaurant_owner role via alias", async () => {
      const res = await request(app).get("/test").set("x-test-role", "restaurant_owner");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("rejects user role with 403", async () => {
      const res = await request(app).get("/test").set("x-test-role", "user");
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });
});
