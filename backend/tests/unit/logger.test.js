import { describe, it, expect } from "vitest";
import { Writable } from "stream";
import { createLogger, REDACTED_PATHS } from "../../utils/logger.js";

const createTestLoggerWithStream = (options = {}) => {
  let output = "";
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      output += chunk.toString();
      callback();
    },
  });

  const logger = createLogger({
    level: "debug",
    ...options,
  }, stream);

  return {
    logger,
    getLog: () => (output ? JSON.parse(output.trim().split("\n").pop()) : null),
    getAllLogs: () =>
      output
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line)),
  };
};

describe("Structured Logger (Pino)", () => {
  it("includes all expected sensitive field patterns in REDACTED_PATHS", () => {
    expect(REDACTED_PATHS).toContain("password");
    expect(REDACTED_PATHS).toContain("*.password");
    expect(REDACTED_PATHS).toContain("token");
    expect(REDACTED_PATHS).toContain("*.token");
    expect(REDACTED_PATHS).toContain("refreshToken");
    expect(REDACTED_PATHS).toContain("authorization");
    expect(REDACTED_PATHS).toContain("accountNumber");
    expect(REDACTED_PATHS).toContain("bankAccountNumber");
    expect(REDACTED_PATHS).toContain("apiKey");
    expect(REDACTED_PATHS).toContain("secret");
  });

  it("redacts sensitive fields in logged objects", () => {
    const { logger, getLog } = createTestLoggerWithStream();

    logger.info({
      password: "SuperSecretPassword123!",
      token: "jwt-token-sample",
      refreshToken: "refresh-token-sample",
      accountNumber: "9876543210",
      bankAccountNumber: "1234567890",
      secret: "payos-api-secret",
      apiKey: "payos-api-key",
      user: {
        id: "user-123",
        name: "Test User",
        password: "nestedPassword",
      },
    }, "User login attempt");

    const log = getLog();
    expect(log).toBeDefined();
    expect(log.msg).toBe("User login attempt");
    expect(log.password).toBe("[REDACTED]");
    expect(log.token).toBe("[REDACTED]");
    expect(log.refreshToken).toBe("[REDACTED]");
    expect(log.accountNumber).toBe("[REDACTED]");
    expect(log.bankAccountNumber).toBe("[REDACTED]");
    expect(log.secret).toBe("[REDACTED]");
    expect(log.apiKey).toBe("[REDACTED]");
    expect(log.user.password).toBe("[REDACTED]");
    expect(log.user.name).toBe("Test User");
    expect(log.user.id).toBe("user-123");
  });

  it("creates a child logger that attaches correlation context to all log entries", () => {
    const { logger, getLog } = createTestLoggerWithStream();
    const requestId = "req-test-uuid-456";
    const child = logger.child({ requestId, service: "order-service" });

    child.info({ orderId: "order-999" }, "Processing order");

    const log = getLog();
    expect(log).toBeDefined();
    expect(log.requestId).toBe("req-test-uuid-456");
    expect(log.service).toBe("order-service");
    expect(log.orderId).toBe("order-999");
    expect(log.msg).toBe("Processing order");
  });

  it("supports silent level in test environments", () => {
    let output = "";
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        output += chunk.toString();
        callback();
      },
    });

    const silentLogger = createLogger({ level: "silent" }, stream);
    silentLogger.info("This should not be written to output");

    expect(output).toBe("");
  });
});
