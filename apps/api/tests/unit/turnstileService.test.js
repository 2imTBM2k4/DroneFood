import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyTurnstile } from "../../services/turnstileService.js";

const originalEnv = { ...process.env };

const successfulResponse = (overrides = {}) => ({
  success: true,
  action: "register",
  hostname: "dronefood.io.vn",
  ...overrides,
});

describe("turnstileService", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...originalEnv };
  });

  it("accepts a successful verification for the configured hostname and action", async () => {
    process.env.TURNSTILE_ENABLED = "true";
    process.env.TURNSTILE_SECRET_KEY = "test-secret";
    process.env.TURNSTILE_EXPECTED_HOSTNAMES = "dronefood.io.vn,restaurant.dronefood.io.vn";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => successfulResponse(),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      verifyTurnstile({
        token: "token",
        expectedAction: "register",
        remoteIp: "203.0.113.10",
      })
    ).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("rejects a missing token while enabled without calling Cloudflare", async () => {
    process.env.TURNSTILE_ENABLED = "true";
    process.env.TURNSTILE_SECRET_KEY = "test-secret";
    process.env.TURNSTILE_EXPECTED_HOSTNAMES = "dronefood.io.vn";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(verifyTurnstile({ expectedAction: "register" })).rejects.toMatchObject({
      statusCode: 403,
      code: "CAPTCHA_VERIFICATION_FAILED",
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a verification with a wrong action", async () => {
    process.env.TURNSTILE_ENABLED = "true";
    process.env.TURNSTILE_SECRET_KEY = "test-secret";
    process.env.TURNSTILE_EXPECTED_HOSTNAMES = "dronefood.io.vn";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => successfulResponse({ action: "login" }),
    }));

    await expect(verifyTurnstile({ token: "token", expectedAction: "register" })).rejects.toMatchObject({
      statusCode: 403,
      code: "CAPTCHA_VERIFICATION_FAILED",
    });
  });

  it("rejects a verification for an unconfigured hostname", async () => {
    process.env.TURNSTILE_ENABLED = "true";
    process.env.TURNSTILE_SECRET_KEY = "test-secret";
    process.env.TURNSTILE_EXPECTED_HOSTNAMES = "dronefood.io.vn";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => successfulResponse({ hostname: "attacker.example" }),
    }));

    await expect(verifyTurnstile({ token: "token", expectedAction: "register" })).rejects.toMatchObject({
      statusCode: 403,
      code: "CAPTCHA_VERIFICATION_FAILED",
    });
  });

  it("fails closed when enabled configuration is incomplete", async () => {
    process.env.TURNSTILE_ENABLED = "true";
    delete process.env.TURNSTILE_SECRET_KEY;
    process.env.TURNSTILE_EXPECTED_HOSTNAMES = "dronefood.io.vn";

    await expect(verifyTurnstile({ token: "token", expectedAction: "register" })).rejects.toMatchObject({
      statusCode: 503,
      code: "TURNSTILE_CONFIGURATION_ERROR",
    });
  });

  it("does not verify remotely while disabled", async () => {
    process.env.TURNSTILE_ENABLED = "false";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(verifyTurnstile({ expectedAction: "register" })).resolves.toBeUndefined();

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
