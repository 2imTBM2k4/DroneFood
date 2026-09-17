import crypto from "crypto";
import { logger } from "../utils/logger.js";

export const requestContext = (req, res, next) => {
  const requestId =
    req.headers["x-request-id"] ||
    req.headers["x-correlation-id"] ||
    crypto.randomUUID();

  req.id = requestId;
  res.setHeader("X-Request-Id", requestId);

  req.log = logger.child({ requestId });

  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs =
      Math.round((Number(process.hrtime.bigint() - start) / 1e6) * 100) / 100;

    const logData = {
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode: res.statusCode,
      durationMs,
    };

    if (req.user) {
      logData.userId = req.user._id || req.user.id;
      logData.role = req.user.role;
    }

    const contentLength = res.get("content-length");
    if (contentLength) {
      logData.contentLength = Number(contentLength);
    }

    if (res.statusCode >= 500) {
      req.log.error(logData, "HTTP request failed with server error");
    } else if (res.statusCode >= 400) {
      req.log.warn(logData, "HTTP request finished with client error");
    } else {
      req.log.info(logData, "HTTP request completed");
    }
  });

  next();
};

export default requestContext;
