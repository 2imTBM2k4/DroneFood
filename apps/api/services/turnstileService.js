import AppError from "../utils/AppError.js";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const isEnabled = () => process.env.TURNSTILE_ENABLED === "true";

const configuredHostnames = () =>
  (process.env.TURNSTILE_EXPECTED_HOSTNAMES || "")
    .split(",")
    .map((hostname) => hostname.trim().toLowerCase())
    .filter(Boolean);

const createError = (message, statusCode, code) => {
  const error = new AppError(message, statusCode);
  error.code = code;
  return error;
};

export const verifyTurnstile = async ({ token, expectedAction, remoteIp }) => {
  if (!isEnabled()) return;

  const secret = process.env.TURNSTILE_SECRET_KEY;
  const hostnames = configuredHostnames();
  if (!secret || hostnames.length === 0) {
    throw createError(
      "Turnstile is not configured correctly.",
      503,
      "TURNSTILE_CONFIGURATION_ERROR"
    );
  }

  if (!token || typeof token !== "string") {
    throw createError(
      "Không thể xác minh bạn là người dùng hợp lệ.",
      403,
      "CAPTCHA_VERIFICATION_FAILED"
    );
  }

  let verification;
  try {
    const body = new URLSearchParams({
      secret,
      response: token,
      ...(remoteIp ? { remoteip: remoteIp } : {}),
    });
    const response = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!response.ok) {
      throw new Error(`Turnstile response status: ${response.status}`);
    }
    verification = await response.json();
  } catch {
    throw createError(
      "Không thể xác minh bạn là người dùng hợp lệ.",
      403,
      "CAPTCHA_VERIFICATION_FAILED"
    );
  }

  const verifiedHostname = String(verification?.hostname || "").toLowerCase();
  if (
    verification?.success !== true ||
    verification?.action !== expectedAction ||
    !hostnames.includes(verifiedHostname)
  ) {
    throw createError(
      "Không thể xác minh bạn là người dùng hợp lệ.",
      403,
      "CAPTCHA_VERIFICATION_FAILED"
    );
  }
};
