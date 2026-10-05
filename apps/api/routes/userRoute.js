import express from "express";
import {
  registerUser,
  loginUser,
  lockUser,
  getMe,
  reverseGeocode,
  geocodeUserAddress,
  updateUserAddress,
  listUsers,
  updateUserByAdmin,
  deleteUser,
  getStats,
  logoutUser,
  updateProfile,
  changePassword,
  updateAvatar,
  forgotPassword,
  resetPassword,
  verifyResetToken,
  refreshToken,
  resendEmailVerification,
  requestEmailChange,
  verifyEmail,
  getUserTransactions,
} from "../controllers/userController.js";

import { protect, authorize } from "../middleware/auth.js";
import validate from "../middleware/validate.js";
import { uploadMiddleware } from "../config/multer.js";
import {
  registerSchema,
  loginSchema,
  updateAddressSchema,
  reverseGeocodeQuerySchema,
  geocodeAddressQuerySchema,
  updateProfileSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  resendEmailVerificationSchema,
  requestEmailChangeSchema,
  lockUserSchema,
  updateByAdminSchema,
  deleteUserSchema,
  statsQuerySchema,
} from "../validations/userValidation.js";
import rateLimit from "express-rate-limit";

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: "Too many attempts, please try again after 15 minutes" },
});

const verificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Vui lòng chờ trước khi yêu cầu thêm email xác minh." },
});

const userRouter = express.Router();

// ============ PUBLIC ROUTES ============
userRouter.post("/register", authLimiter, validate(registerSchema), registerUser);
userRouter.post("/login", authLimiter, validate(loginSchema), loginUser);
userRouter.post("/logout", logoutUser);
userRouter.post("/forgot-password", authLimiter, validate(forgotPasswordSchema), forgotPassword);
userRouter.get("/verify-reset-token/:token", authLimiter, verifyResetToken);
userRouter.post("/reset-password", authLimiter, validate(resetPasswordSchema), resetPassword);
userRouter.post("/refresh-token", authLimiter, refreshToken);
userRouter.post("/resend-verification", verificationLimiter, validate(resendEmailVerificationSchema), resendEmailVerification);
userRouter.post("/verify-email", verificationLimiter, validate(verifyEmailSchema), verifyEmail);

// ============ PROTECTED ROUTES ============
userRouter.get("/me", protect, getMe);
userRouter.get("/transactions", protect, getUserTransactions);
userRouter.get("/reverse-geocode", protect, validate(reverseGeocodeQuerySchema, "query"), reverseGeocode);
userRouter.get("/geocode", protect, validate(geocodeAddressQuerySchema, "query"), geocodeUserAddress);
userRouter.put("/update-address", protect, validate(updateAddressSchema), updateUserAddress);
userRouter.put("/profile", protect, validate(updateProfileSchema), updateProfile);
userRouter.put("/request-email-change", protect, verificationLimiter, validate(requestEmailChangeSchema), requestEmailChange);
userRouter.put("/change-password", protect, validate(changePasswordSchema), changePassword);
userRouter.put("/avatar", protect, uploadMiddleware.single("avatar"), updateAvatar);

// ============ ADMIN ROUTES ============
userRouter.get("/list", protect, authorize("admin"), listUsers);
userRouter.get("/stats", protect, authorize("admin"), validate(statsQuerySchema, "query"), getStats);
userRouter.post("/lock", protect, authorize("admin"), validate(lockUserSchema), lockUser);
userRouter.put("/update-by-admin", protect, authorize("admin"), validate(updateByAdminSchema), updateUserByAdmin);
userRouter.delete("/delete", protect, authorize("admin"), validate(deleteUserSchema), deleteUser);

export default userRouter;
