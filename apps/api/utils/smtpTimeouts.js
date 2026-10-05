const positiveNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const smtpTimeouts = (env = process.env) => ({
  connectionTimeout: positiveNumber(env.SMTP_CONNECTION_TIMEOUT_MS, 10000),
  greetingTimeout: positiveNumber(env.SMTP_GREETING_TIMEOUT_MS, 10000),
  socketTimeout: positiveNumber(env.SMTP_SOCKET_TIMEOUT_MS, 20000),
});

