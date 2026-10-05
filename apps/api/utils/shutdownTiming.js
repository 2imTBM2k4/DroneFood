import { smtpTimeouts } from "./smtpTimeouts.js";

const DB_SHUTDOWN_MARGIN_MS = 5000;

export const shutdownDeadlineMs = (env = process.env) => {
  const timeouts = smtpTimeouts(env);
  const minimum = timeouts.connectionTimeout
    + timeouts.greetingTimeout
    + timeouts.socketTimeout
    + DB_SHUTDOWN_MARGIN_MS;
  const configured = Number(env.SERVER_SHUTDOWN_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0
    ? Math.max(configured, minimum)
    : minimum;
};

