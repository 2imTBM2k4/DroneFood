import { describe, expect, it } from "vitest";
import LoginAttempt from "../../models/loginAttemptModel.cjs";
import {
  clearLoginAttempts,
  isCaptchaRequired,
  recordFailedLogin,
} from "../../services/loginAttemptService.js";

const email = "Person@Example.com";
const ip = "203.0.113.10";

const recordFailures = async (input, count = 5) => {
  for (let index = 0; index < count; index += 1) {
    await recordFailedLogin(input);
  }
};

describe("loginAttemptService", () => {
  it("does not require CAPTCHA for fresh email and IP subjects", async () => {
    await expect(isCaptchaRequired({ email, ip })).resolves.toBe(false);
  });

  it("requires CAPTCHA after five failures for both the email and IP", async () => {
    await recordFailures({ email, ip });

    await expect(isCaptchaRequired({ email, ip })).resolves.toBe(true);
  });

  it("requires CAPTCHA when one email reaches the threshold across changing IPs", async () => {
    for (let index = 1; index <= 5; index += 1) {
      await recordFailedLogin({ email, ip: `203.0.113.${index}` });
    }

    await expect(isCaptchaRequired({ email, ip: "203.0.113.99" })).resolves.toBe(true);
  });

  it("requires CAPTCHA when one IP reaches the threshold across different emails", async () => {
    for (let index = 1; index <= 5; index += 1) {
      await recordFailedLogin({ email: `person-${index}@example.com`, ip });
    }

    await expect(isCaptchaRequired({ email: "new-person@example.com", ip })).resolves.toBe(true);
  });

  it("clears both attempt subjects after a successful login", async () => {
    await recordFailures({ email, ip });

    await clearLoginAttempts({ email, ip });

    await expect(isCaptchaRequired({ email, ip })).resolves.toBe(false);
  });

  it("does not require CAPTCHA for an attempt record that has expired", async () => {
    await LoginAttempt.create({
      subjectType: "email",
      subjectKey: email.toLowerCase(),
      failureCount: 5,
      expiresAt: new Date(Date.now() - 1_000),
    });

    await expect(isCaptchaRequired({ email, ip })).resolves.toBe(false);
  });
});
