import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import app from "../../app.js";
import { LoginAttempt, User } from "../../models/index.cjs";
import { isCaptchaRequired } from "../../services/loginAttemptService.js";
import { verifyTurnstile } from "../../services/turnstileService.js";

vi.mock("../../services/turnstileService.js", () => ({
  verifyTurnstile: vi.fn(),
}));

const originalTurnstileEnabled = process.env.TURNSTILE_ENABLED;
const email = "turnstile-user@test.com";
const ip = "203.0.113.80";

const createUser = async () => {
  await request(app).post("/api/user/register").send({
    name: "Turnstile User",
    email,
    password: "password123",
    turnstileToken: "register-token",
  });
  await User.updateOne({ email }, { isEmailVerified: true });
};

const login = (payload = {}) =>
  request(app)
    .post("/api/user/login")
    .set("X-Forwarded-For", ip)
    .send({ email, password: "password123", ...payload });

const captchaError = () => Object.assign(
  new Error("Không thể xác minh bạn là người dùng hợp lệ."),
  { statusCode: 403, code: "CAPTCHA_VERIFICATION_FAILED" }
);

describe("Turnstile auth API", () => {
  beforeEach(() => {
    process.env.TURNSTILE_ENABLED = "true";
    verifyTurnstile.mockImplementation(({ token }) => {
      if (!token) throw captchaError();
    });
  });

  afterEach(() => {
    verifyTurnstile.mockReset();
    if (originalTurnstileEnabled === undefined) delete process.env.TURNSTILE_ENABLED;
    else process.env.TURNSTILE_ENABLED = originalTurnstileEnabled;
  });

  it("does not create an account when registration Turnstile verification fails", async () => {
    verifyTurnstile.mockImplementation(() => {
      throw captchaError();
    });

    const response = await request(app).post("/api/user/register").send({
      name: "Blocked User",
      email: "blocked-turnstile@test.com",
      password: "password123",
      turnstileToken: "bad-token",
    });

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      success: false,
      code: "CAPTCHA_VERIFICATION_FAILED",
    });
    await expect(User.findOne({ email: "blocked-turnstile@test.com" })).resolves.toBeNull();
  });

  it("passes the registration token to Turnstile before creating an account", async () => {
    const response = await request(app).post("/api/user/register").send({
      name: "Verified User",
      email: "verified-turnstile@test.com",
      password: "password123",
      turnstileToken: "valid-register-token",
    });

    expect(response.status).toBe(200);
    expect(verifyTurnstile).toHaveBeenCalledWith(expect.objectContaining({
      token: "valid-register-token",
      expectedAction: "register",
    }));
  });

  it("requires a token before checking credentials after five failures", async () => {
    await createUser();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await login({ password: "wrongpassword" });
      expect(response.status).toBe(401);
    }

    const response = await login();

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      success: false,
      code: "CAPTCHA_VERIFICATION_FAILED",
      captchaRequired: true,
    });
  });

  it("allows a verified login and clears both failure counters", async () => {
    await createUser();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await login({ password: "wrongpassword" });
    }

    const response = await login({ turnstileToken: "valid-login-token" });

    expect(response.status).toBe(200);
    expect(verifyTurnstile).toHaveBeenCalledWith(expect.objectContaining({
      token: "valid-login-token",
      expectedAction: "login",
    }));
    await expect(isCaptchaRequired({ email, ip })).resolves.toBe(false);
  });

  it("clears counters after a correct password even when portal authorization fails", async () => {
    await createUser();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await login({ password: "wrongpassword" });
    }

    const response = await login({ portal: "admin", turnstileToken: "valid-login-token" });

    expect(response.status).toBe(403);
    await expect(LoginAttempt.countDocuments()).resolves.toBe(0);
  });

  it("returns the same generic error for an unknown email and a wrong password", async () => {
    await createUser();
    const wrongPassword = await login({ password: "wrongpassword" });
    const unknownUser = await request(app)
      .post("/api/user/login")
      .set("X-Forwarded-For", "203.0.113.81")
      .send({ email: "missing-turnstile@test.com", password: "password123" });

    expect(wrongPassword.body).toMatchObject({ code: "INVALID_CREDENTIALS" });
    expect(unknownUser.body).toMatchObject({
      code: "INVALID_CREDENTIALS",
      message: wrongPassword.body.message,
    });
  });
});
