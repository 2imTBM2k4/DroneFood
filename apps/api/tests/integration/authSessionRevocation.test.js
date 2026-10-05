import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../../app.js";
import { authenticateSocket } from "../../middleware/socketAuth.js";
import { AccountEmailJob, User } from "../../models/index.cjs";
import { createAccessToken } from "../../utils/authTokens.js";

const registerAndAuthenticate = async (email) => {
  await request(app).post("/api/user/register").send({
    name: "Session User",
    email,
    password: "password123",
  });
  const user = await User.findOneAndUpdate(
    { email },
    { emailVerified: true },
    { new: true }
  ).select("+authVersion");
  const token = createAccessToken(user);
  return { user, token };
};

describe("password changes revoke issued sessions", () => {
  afterEach(() => app.set("io", null));

  it("rejects a pre-change access JWT over HTTP and keeps new JWTs at 30 minutes", async () => {
    const disconnectSockets = vi.fn();
    const inRoom = vi.fn(() => ({ disconnectSockets }));
    app.set("io", { in: inRoom });
    const { token: oldToken } = await registerAndAuthenticate("http-session@test.com");

    const changed = await request(app)
      .put("/api/user/change-password")
      .set("Authorization", `Bearer ${oldToken}`)
      .send({ currentPassword: "password123", newPassword: "newpassword123" });
    expect(changed.status).toBe(200);
    expect(changed.body.sessionUserId).toBeUndefined();
    expect(inRoom).toHaveBeenCalledWith(`user_session_${jwt.decode(oldToken).id}`);
    expect(disconnectSockets).toHaveBeenCalledWith(true);
    const rejected = await request(app)
      .get("/api/user/me")
      .set("Authorization", `Bearer ${oldToken}`);
    expect(rejected.status).toBe(401);

    const loggedIn = await request(app).post("/api/user/login").send({
      email: "http-session@test.com",
      password: "newpassword123",
    });
    const decoded = jwt.decode(loggedIn.body.token);
    expect(decoded.exp - decoded.iat).toBe(30 * 60);
  });

  it("rejects a pre-change access JWT in Socket.IO authentication", async () => {
    const { token: oldToken } = await registerAndAuthenticate("socket-session@test.com");
    await request(app)
      .put("/api/user/change-password")
      .set("Authorization", `Bearer ${oldToken}`)
      .send({ currentPassword: "password123", newPassword: "newpassword123" });

    const socket = { handshake: { auth: { token: oldToken }, headers: {} } };
    const error = await new Promise((resolve) => authenticateSocket(socket, resolve));
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("Unauthorized");
    expect(socket.user).toBeUndefined();
  });

  it("rejects a pre-reset access JWT over HTTP", async () => {
    const { token: oldToken } = await registerAndAuthenticate("reset-session@test.com");
    await request(app).post("/api/user/forgot-password").send({ email: "reset-session@test.com" });
    const job = await AccountEmailJob.findOne({ event: "password.reset_requested" })
      .select("+html");
    const resetToken = job.html.match(/\/reset-password\/([a-f0-9]{64})/)?.[1];
    expect(resetToken).toHaveLength(64);

    const reset = await request(app).post("/api/user/reset-password").send({
      token: resetToken,
      password: "resetpassword123",
    });
    expect(reset.status).toBe(200);

    const rejected = await request(app)
      .get("/api/user/me")
      .set("Authorization", `Bearer ${oldToken}`);
    expect(rejected.status).toBe(401);
  });
});
