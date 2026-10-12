import express from "express";
import rateLimit from "express-rate-limit";
import * as merchantController from "../controllers/merchantController.js";
import { protect, authorize } from "../middleware/auth.js";
import requireMerchantAccess from "../middleware/requireMerchantAccess.cjs";
import validate from "../middleware/validate.js";
import {
  registerMerchantSchema,
  updateMerchantSchema,
  suspendMerchantSchema,
  listMerchantsQuerySchema,
} from "../validations/merchantValidation.js";

const merchantRouter = express.Router();

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "test" ? 1000 : 10,
  keyGenerator: (req) => req.user?._id?.toString?.() || req.ip,
  validate: { keyGeneratorIpFallback: false },
  message: {
    success: false,
    message: "Quá nhiều yêu cầu đăng ký, vui lòng thử lại sau 15 phút",
  },
});

merchantRouter.post(
  "/register",
  protect,
  registerLimiter,
  validate(registerMerchantSchema),
  merchantController.register
);

merchantRouter.get(
  "/:slug/public",
  merchantController.getPublic
);

merchantRouter.get(
  "/me",
  protect,
  authorize("merchant_owner", "admin"),
  merchantController.getMe
);

merchantRouter.get(
  "/list",
  protect,
  authorize("admin"),
  validate(listMerchantsQuerySchema, "query"),
  merchantController.list
);

merchantRouter.put(
  "/:id",
  protect,
  authorize("merchant_owner", "admin"),
  requireMerchantAccess,
  validate(updateMerchantSchema),
  merchantController.update
);

merchantRouter.post(
  "/:id/approve",
  protect,
  authorize("admin"),
  merchantController.approve
);

merchantRouter.post(
  "/:id/suspend",
  protect,
  authorize("admin"),
  validate(suspendMerchantSchema),
  merchantController.suspend
);

export default merchantRouter;
