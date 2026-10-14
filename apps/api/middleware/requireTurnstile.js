import { isCaptchaRequired } from "../services/loginAttemptService.js";
import { verifyTurnstile } from "../services/turnstileService.js";

export const requireTurnstile = (expectedAction, { required = true } = {}) => {
  return async (req, res, next) => {
    try {
      const shouldVerify = typeof required === "function"
        ? await required(req)
        : required;

      if (!shouldVerify) return next();

      await verifyTurnstile({
        token: req.body?.turnstileToken,
        expectedAction,
        remoteIp: req.ip,
      });
      return next();
    } catch (error) {
      if (expectedAction === "login") error.captchaRequired = true;
      return next(error);
    }
  };
};

export const requireTurnstileAfterLoginFailures = requireTurnstile("login", {
  required: (req) => isCaptchaRequired({ email: req.body?.email, ip: req.ip }),
});
