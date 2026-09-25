import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../app.js";

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("Request Context & Correlation ID Middleware", () => {
  it("generates a new UUID v4 requestId when client does not supply one", async () => {
    const res = await request(app).get("/api/health");

    expect(res.headers["x-request-id"]).toBeDefined();
    expect(res.headers["x-request-id"]).toMatch(UUID_V4_REGEX);
  });

  it("propagates client X-Request-Id header into response", async () => {
    const customTraceId = "client-trace-id-abc-123";
    const res = await request(app)
      .get("/api/health")
      .set("X-Request-Id", customTraceId);

    expect(res.headers["x-request-id"]).toBe(customTraceId);
  });

  it("propagates client X-Correlation-Id header into response as X-Request-Id", async () => {
    const customCorrelationId = "correlation-trace-xyz-789";
    const res = await request(app)
      .get("/api/health")
      .set("X-Correlation-Id", customCorrelationId);

    expect(res.headers["x-request-id"]).toBe(customCorrelationId);
  });

  it("attaches X-Request-Id header to 404 responses", async () => {
    const res = await request(app).get("/api/non-existent-endpoint-for-test");

    expect(res.status).toBe(404);
    expect(res.headers["x-request-id"]).toBeDefined();
    expect(res.headers["x-request-id"]).toMatch(UUID_V4_REGEX);
  });

  it("attaches X-Request-Id header to 400 validation error responses", async () => {
    const res = await request(app)
      .post("/api/user/login")
      .send({});

    expect(res.status).toBe(400);
    expect(res.headers["x-request-id"]).toBeDefined();
  });
});
