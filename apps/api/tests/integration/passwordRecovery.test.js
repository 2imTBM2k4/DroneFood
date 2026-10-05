import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import app from "../../app.js";
import { AccountEmailJob, User } from "../../models/index.cjs";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import * as userService from "../../services/userService.js";

const sendEmailMock = vi.hoisted(() => vi.fn().mockResolvedValue({ messageId: "test" }));

vi.mock("../../utils/sendEmail.js", () => ({
  default: sendEmailMock,
}));

describe("Password recovery API", () => {
  it("queues recovery without requiring MongoDB transactions", async () => {
    const original = {
      host: mongoose.connection.host,
      port: mongoose.connection.port,
      database: mongoose.connection.name,
      replicaSet: mongoose.connection.getClient().options.replicaSet,
    };
    const originalUri = `mongodb://${original.host}:${original.port}/${original.database}?replicaSet=${encodeURIComponent(original.replicaSet)}`;
    const standalone = await MongoMemoryServer.create();
    await mongoose.disconnect();

    try {
      await mongoose.connect(standalone.getUri());
      await userService.registerUser({
        name: "Standalone Mongo User",
        email: "standalone-mongo@test.com",
        password: "password123",
      });
      await expect(userService.forgotPassword("standalone-mongo@test.com"))
        .resolves.toEqual(expect.objectContaining({ success: true }));
      const storedUser = await User.findOne({ email: "standalone-mongo@test.com" })
        .select("+resetPasswordToken +resetPasswordExpires");
      expect(storedUser.resetPasswordToken).toMatch(/^[a-f0-9]{64}$/);
      expect(storedUser.resetPasswordExpires).toBeInstanceOf(Date);
      expect(await AccountEmailJob.countDocuments({
        event: "password.reset_requested",
        status: "queued",
      })).toBe(1);
    } finally {
      await mongoose.disconnect();
      await standalone.stop();
      await mongoose.connect(originalUri);
    }
  });

  it("uses an identical response for existing and unknown emails", async () => {
    await request(app).post("/api/user/register").send({
      name: "Recovery User",
      email: "api-recovery@test.com",
      password: "password123",
    });
    sendEmailMock.mockClear();

    const existing = await request(app)
      .post("/api/user/forgot-password")
      .send({ email: "api-recovery@test.com" });
    const unknown = await request(app)
      .post("/api/user/forgot-password")
      .send({ email: "not-registered@test.com" });

    expect(existing.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(existing.body).toEqual(unknown.body);
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(await AccountEmailJob.countDocuments({ event: "password.reset_requested" })).toBe(1);
  });

  it("validates forgot-password and reset-password bodies", async () => {
    const forgot = await request(app)
      .post("/api/user/forgot-password")
      .send({ email: "not-an-email" });
    const reset = await request(app)
      .post("/api/user/reset-password")
      .send({ token: "bad-token", password: "short" });

    expect(forgot.status).toBe(400);
    expect(forgot.body.success).toBe(false);
    expect(reset.status).toBe(400);
    expect(reset.body.success).toBe(false);
  });
});
