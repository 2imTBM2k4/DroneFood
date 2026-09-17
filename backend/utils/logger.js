import pino from "pino";

export const REDACTED_PATHS = [
  // Authentication & Session secrets
  "authorization",
  "headers.authorization",
  'headers["authorization"]',
  "req.headers.authorization",
  'req.headers["authorization"]',
  "cookie",
  "headers.cookie",
  'headers["cookie"]',
  "req.headers.cookie",
  'req.headers["cookie"]',
  "token",
  "*.token",
  "refreshToken",
  "*.refreshToken",
  "accessToken",
  "*.accessToken",
  "password",
  "*.password",
  "newPassword",
  "currentPassword",
  "confirmPassword",
  // Financial secrets & Banking credentials
  "accountNumber",
  "*.accountNumber",
  "bankAccountNumber",
  "*.bankAccountNumber",
  "encryptedAccountNumber",
  "*.encryptedAccountNumber",
  "secret",
  "*.secret",
  "apiKey",
  "*.apiKey",
  "apiSecret",
  "*.apiSecret",
  "signature",
  "*.signature",
  "checksum",
  "*.checksum",
  'headers["x-payos-signature"]',
  'req.headers["x-payos-signature"]',
  // GPS raw privacy
  "rawGps",
  "*.rawGps",
  "coords",
  "*.coords",
];

export const createLogger = (options = {}, destination) => {
  const isTest = process.env.NODE_ENV === "test";
  const defaultLevel = isTest ? (process.env.LOG_LEVEL || "silent") : (process.env.LOG_LEVEL || "info");

  const opts = {
    level: options.level || defaultLevel,
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
    redact: {
      paths: REDACTED_PATHS,
      censor: "[REDACTED]",
    },
    ...options,
  };

  return destination ? pino(opts, destination) : pino(opts);
};

export const logger = createLogger();

export default logger;
