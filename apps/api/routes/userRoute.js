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
  requestEmailChange,
  confirmEmailChange,
  requestPhoneChange,
  confirmPhoneChange,
  changePassword,
  updateAvatar,
  forgotPassword,
  resetPassword,
  refreshToken,
  getUserTransactions,
  verifyEmail,
  resendVerification,
} from "../controllers/userController.js";

import { protect, authorize } from "../middleware/auth.js";
import validate from "../middleware/validate.js";
import { requireTurnstile, requireTurnstileAfterLoginFailures } from "../middleware/requireTurnstile.js";
import { uploadMiddleware } from "../config/multer.js";
import {
  registerSchema,
  loginSchema,
  updateAddressSchema,
  reverseGeocodeQuerySchema,
  geocodeAddressQuerySchema,
  updateProfileSchema,
  requestEmailChangeSchema,
  confirmEmailChangeSchema,
  requestPhoneChangeSchema,
  confirmPhoneChangeSchema,
  changePasswordSchema,
  lockUserSchema,
  updateByAdminSchema,
  deleteUserSchema,
  statsQuerySchema,
  verifyEmailSchema,
  resendVerificationSchema,
} from "../validations/userValidation.js";
import rateLimit from "express-rate-limit";

const createAuthLimiter = () => rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "test" ? 1000 : 10,
  message: { success: false, message: "Too many attempts, please try again after 15 minutes" },
});

const loginLimiter = createAuthLimiter();
const registerLimiter = createAuthLimiter();
const recoveryLimiter = createAuthLimiter();
const refreshLimiter = createAuthLimiter();
const verificationLimiter = createAuthLimiter();

const userRouter = express.Router();

// ============ PUBLIC ROUTES ============
userRouter.post("/register", registerLimiter, validate(registerSchema), requireTurnstile("register"), registerUser);
userRouter.post("/login", loginLimiter, validate(loginSchema), requireTurnstileAfterLoginFailures, loginUser);
userRouter.post("/logout", logoutUser);
userRouter.post("/forgot-password", recoveryLimiter, forgotPassword);
userRouter.post("/reset-password", recoveryLimiter, resetPassword);
userRouter.post("/verify-email", verificationLimiter, validate(verifyEmailSchema), verifyEmail);
userRouter.post("/resend-verification", verificationLimiter, validate(resendVerificationSchema), resendVerification);
userRouter.post("/refresh-token", refreshLimiter, refreshToken);

// ============ PROTECTED ROUTES ============
userRouter.get("/me", protect, getMe);
userRouter.get("/transactions", protect, getUserTransactions);
userRouter.get("/reverse-geocode", protect, validate(reverseGeocodeQuerySchema, "query"), reverseGeocode);
userRouter.get("/geocode", protect, validate(geocodeAddressQuerySchema, "query"), geocodeUserAddress);
userRouter.put("/update-address", protect, validate(updateAddressSchema), updateUserAddress);
userRouter.put("/profile", protect, validate(updateProfileSchema), updateProfile);
userRouter.post("/request-email-change", protect, recoveryLimiter, validate(requestEmailChangeSchema), requestEmailChange);
userRouter.post("/confirm-email-change", protect, recoveryLimiter, validate(confirmEmailChangeSchema), confirmEmailChange);
userRouter.post("/request-phone-change", protect, recoveryLimiter, validate(requestPhoneChangeSchema), requestPhoneChange);
userRouter.post("/confirm-phone-change", protect, recoveryLimiter, validate(confirmPhoneChangeSchema), confirmPhoneChange);
userRouter.put("/change-password", protect, validate(changePasswordSchema), changePassword);
userRouter.put("/avatar", protect, uploadMiddleware.single("avatar"), updateAvatar);

// ============ ADMIN ROUTES ============
userRouter.get("/list", protect, authorize("admin"), listUsers);
userRouter.get("/stats", protect, authorize("admin"), validate(statsQuerySchema, "query"), getStats);
userRouter.post("/lock", protect, authorize("admin"), validate(lockUserSchema), lockUser);
userRouter.put("/update-by-admin", protect, authorize("admin"), validate(updateByAdminSchema), updateUserByAdmin);
userRouter.delete("/delete", protect, authorize("admin"), validate(deleteUserSchema), deleteUser);

export default userRouter;
