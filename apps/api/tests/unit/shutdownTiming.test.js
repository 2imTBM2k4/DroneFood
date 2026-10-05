import { describe, expect, it } from "vitest";
import { shutdownDeadlineMs } from "../../utils/shutdownTiming.js";

describe("graceful shutdown timing", () => {
  it("never forces exit before the configured SMTP budget and DB margin", () => {
    expect(shutdownDeadlineMs({
      SMTP_CONNECTION_TIMEOUT_MS: "1000",
      SMTP_GREETING_TIMEOUT_MS: "2000",
      SMTP_SOCKET_TIMEOUT_MS: "60000",
      SERVER_SHUTDOWN_TIMEOUT_MS: "10000",
    })).toBe(68000);
  });

  it("honors a longer explicit server shutdown deadline", () => {
    expect(shutdownDeadlineMs({
      SMTP_CONNECTION_TIMEOUT_MS: "1000",
      SMTP_GREETING_TIMEOUT_MS: "1000",
      SMTP_SOCKET_TIMEOUT_MS: "2000",
      SERVER_SHUTDOWN_TIMEOUT_MS: "30000",
    })).toBe(30000);
  });
});

