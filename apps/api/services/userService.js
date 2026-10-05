import crypto from "crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import validator from "validator";
import fs from "fs";
import { v2 as cloudinary } from "cloudinary";
import * as userRepo from "../repositories/userRepository.js";
import * as restaurantRepo from "../repositories/restaurantRepository.js";
import AppError from "../utils/AppError.js";
import { isZeroPayableVoucherOrder } from "../utils/zeroPayableVoucher.js";
import {
  activatePasswordResetEmail,
  activateEmailVerificationEmail,
  cancelEmailVerificationEmail,
  cancelPasswordResetEmail,
  prepareEmailVerificationEmail,
  preparePasswordResetEmail,
  queueEmailChangeNotice,
  queuePasswordChangedEmail,
  queueWelcomeEmail,
} from "./accountEmailService.js";
import { createAccessToken, createRefreshToken, isTokenVersionCurrent } from "../utils/authTokens.js";
import { geocodeAddress } from "../utils/geocode.js";
import { recordAudit } from "../utils/auditLog.js";
import { ShipperProfile } from "../models/index.cjs";

const maskEmail = (email = "") => {
  const [local, domain] = email.split("@");
  return domain ? `${local.slice(0, 2)}***@${domain}` : "";
};

const securityAuditActor = (user) => user ? {
  _id: user._id,
  role: user.role,
} : undefined;

const VERIFICATION_TOKEN_LIFETIME_MS = (Number(process.env.EMAIL_VERIFICATION_TOKEN_LIFETIME_MS) || 15 * 60) * 1000;
const genericVerificationResult = {
  success: true,
  message: "Nếu tài khoản cần xác minh, một liên kết mới đã được gửi tới email.",
};
const isEmailVerified = (user) => user?.emailVerified !== false;
const accountSecurityBaseUrl = () => String(
  process.env.ACCOUNT_SECURITY_URL
    || process.env.FRONTEND_URL
    || "http://localhost:5173"
).replace(/\/$/, "");

const issueVerificationEmail = async ({ user, to, purpose = "registration" }) => {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_LIFETIME_MS);
  let emailJob;
  try {
    emailJob = await prepareEmailVerificationEmail({
      userId: user._id,
      to,
      name: user.name,
      verificationUrl: `${accountSecurityBaseUrl()}/verify-email/${rawToken}`,
      verificationTokenHash: tokenHash,
      verificationTokenExpiresAt: expiresAt,
      purpose,
    });
  } catch {
    return { queued: false };
  }

  try {
    const updated = purpose === "email_change"
      ? await userRepo.setPendingEmailVerification(user._id, to, tokenHash, expiresAt)
      : await userRepo.setEmailVerificationToken(user._id, tokenHash, expiresAt);
    const stored = purpose === "email_change" ? Boolean(updated) : updated.matchedCount === 1;
    if (!stored) {
      await cancelEmailVerificationEmail(emailJob._id, tokenHash).catch(() => undefined);
      return { queued: false };
    }
  } catch (error) {
    await cancelEmailVerificationEmail(emailJob._id, tokenHash).catch(() => undefined);
    throw error;
  }

  await activateEmailVerificationEmail({
    jobId: emailJob._id,
    userId: user._id,
    verificationTokenHash: tokenHash,
    purpose,
  });
  return { queued: true };
};

export const loginUser = async ({ email, password }) => {
  const user = await userRepo.findByEmail(email);
  if (!user) {
    throw new AppError("User doesn't exist.", 401);
  }
  if (user.locked) {
    throw new AppError("Account is locked.", 403);
  }
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new AppError("Invalid credentials", 401);
  }

  if (!isEmailVerified(user)) {
    throw new AppError(
      "Bạn cần xác minh email trước khi đăng nhập.",
      403,
      "EMAIL_VERIFICATION_REQUIRED",
      { email: maskEmail(user.email), canResend: true }
    );
  }

  if (user.role === "restaurant_owner" && user.restaurantId) {
    const restaurant = await restaurantRepo.findById(user.restaurantId);
    if (!restaurant) {
      throw new AppError("Restaurant not found", 404);
    }
    if (restaurant.isLocked) {
      throw new AppError(
        "Your restaurant account is pending admin approval. Please wait for approval.",
        403
      );
    }
  }

  const token = createAccessToken(user);
  const refreshToken = createRefreshToken(user);

  const hashedRefreshToken = crypto.createHash("sha256").update(refreshToken).digest("hex");
  await userRepo.updateById(user._id, { refreshToken: hashedRefreshToken }, "+refreshToken");
  await recordAudit({ actor: user, action: "auth.login_succeeded", targetType: "authentication", targetId: user._id, category: "authentication" });

  const userRole = user.role || "user";
  return {
    success: true,
    token,
    refreshToken,
    role: userRole,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: userRole,
    },
  };
};

export const registerUser = async (userData) => {
  const { name, password, email, role, restaurantName, address, phone } =
    userData;
  const exists = await userRepo.findByEmail(email);
  if (exists) {
    throw new AppError("User already exists.", 409);
  }
  if (!validator.isEmail(email)) {
    throw new AppError("Please enter a valid email.", 400);
  }
  if (password.length < 8) {
    throw new AppError("Please enter a strong password.", 400);
  }
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(password, salt);

  const newUserData = {
    name,
    email,
    password: hash,
    role: role || "user",
    emailVerified: false,
    phone,
    address: {
      fullName: name,
      address: address,
      phone: phone,
    },
  };
  let newUser = await userRepo.create(newUserData);
  if (role === "restaurant_owner") {
    // Geocode the address here too: signing up is the other way a restaurant
    // gets created, and without coordinates it never shows up in the
    // customer's "restaurants near you" list.
    const coords = await geocodeAddress(address);

    const newRestaurant = await restaurantRepo.create({
      name: restaurantName,
      owner: newUser._id,
      address: address,
      phone: newUser.phone,
      email: email,
      isLocked: true,
      ...(coords && { lat: coords.lat, lng: coords.lng }),
    });
    newUser = await userRepo.updateRestaurantForUser(
      newUser._id,
      newRestaurant._id
    );
  }

  if (role === "shipper") {
    try {
      await ShipperProfile.create({ user: newUser._id, vehicleType: "motorbike" });
    } catch (error) {
      // Do not leave a duplicate email that cannot enter the Shipper workflow.
      await userRepo.deleteById(newUser._id);
      throw error;
    }
  }

  await recordAudit({
    actor: securityAuditActor(newUser),
    action: "auth.register_succeeded",
    targetType: "user",
    targetId: newUser._id,
    category: "authentication",
    metadata: { role: newUser.role || role || "user" },
  });
  await issueVerificationEmail({ user: newUser, to: newUser.email || email });

  return {
    success: true,
    verificationRequired: true,
    email: maskEmail(newUser.email || email),
    message: "Tài khoản đã được tạo. Hãy kiểm tra hộp thư để xác minh email trước khi đăng nhập.",
  };
};

export const lockUser = async (actor, userId, lock) => {
  if (!userId) {
    throw new AppError("Missing userId parameter", 400);
  }
  if (lock === undefined) {
    throw new AppError("Missing lock parameter", 400);
  }
  const user = await userRepo.findById(userId);
  if (!user) {
    throw new AppError("User not found", 404);
  }
  const updated = await userRepo.updateById(userId, { locked: lock });

  await recordAudit({
    actor,
    action: lock ? "user.locked" : "user.unlocked",
    targetType: "user",
    targetId: userId,
    metadata: { email: user.email },
  });

  return {
    success: true,
    message: `User ${lock ? "locked" : "unlocked"}`,
    data: updated,
  };
};

export const getMe = async (userId) => {
  const user = await userRepo.findById(userId);
  if (!user) {
    throw new AppError("User not found", 404);
  }
  const userObj = user.toObject ? user.toObject() : { ...user };
  // The repository populates `restaurantId`, so it arrives as a full object
  // here. Calling toString() on that yields "[object Object]" — take the _id.
  if (userObj.restaurantId) {
    userObj.restaurantId = (
      userObj.restaurantId._id || userObj.restaurantId
    ).toString();
  }
  return { success: true, data: userObj };
};

export const updateUserAddress = async (userId, addressData) => {
  const { fullName, phone, address, city, state, country, zipCode, lat, lng } =
    addressData;
  const updateData = {
    "address.fullName": fullName,
    "address.phone": phone,
    "address.address": address,
    "address.city": city,
    "address.state": state,
    "address.country": country,
    "address.zipCode": zipCode,
    "address.lat": lat ?? null,
    "address.lng": lng ?? null,
  };
  const updatedUser = await userRepo.updateById(userId, updateData);
  if (!updatedUser) {
    throw new AppError("User not found", 404);
  }
  return { success: true, data: updatedUser };
};

export const listUsers = async ({ page, limit } = {}) => {
  const result = await userRepo.findAll(undefined, { page, limit });
  const usersData = result.data.map((u) => {
    const obj = u.toObject ? u.toObject() : { ...u };
    // Same populated-object caveat as getMe — take the _id, not the object.
    if (obj.restaurantId)
      obj.restaurantId = (obj.restaurantId._id || obj.restaurantId).toString();
    return obj;
  });
  return { success: true, data: usersData, ...(result.pagination && { pagination: result.pagination }) };
};

export const updateProfile = async (userId, currentEmail, updates) => {
  const { name, email, phone } = updates;
  if (email && email.trim().toLowerCase() !== String(currentEmail).toLowerCase()) {
    throw new AppError(
      "Hãy dùng quy trình xác minh để thay đổi email đăng nhập.",
      409,
      "EMAIL_CHANGE_VERIFICATION_REQUIRED"
    );
  }
  const user = await userRepo.updateById(userId, { name, phone });
  return { success: true, data: user };
};

export const changePassword = async (userId, currentPassword, newPassword) => {
  // findById hides the password by default; ask for it explicitly so we can
  // verify the current one before overwriting.
  const user = await userRepo.findById(userId, "+password +authVersion");
  if (!user) {
    throw new AppError("User not found", 404);
  }
  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) {
    throw new AppError("Mật khẩu hiện tại không đúng", 400);
  }
  const isSame = await bcrypt.compare(newPassword, user.password);
  if (isSame) {
    throw new AppError("Mật khẩu mới phải khác mật khẩu hiện tại", 400);
  }
  const hash = await bcrypt.hash(newPassword, 10);
  const updatedUser = await userRepo.updatePasswordAndRevokeSessions(userId, hash);
  await recordAudit({ actor: securityAuditActor(user), action: "password.changed", targetType: "user", targetId: userId, category: "password" });
  await queuePasswordChangedEmail({
    userId,
    to: updatedUser.email,
    name: updatedUser.name,
    source: "authenticated_change",
    authVersion: updatedUser.authVersion,
  });
  return { success: true, message: "Đổi mật khẩu thành công", sessionUserId: String(userId) };
};

export const updateAvatar = async (userId, file) => {
  if (!file) {
    throw new AppError("Image required", 400);
  }
  const current = await userRepo.findById(userId);
  if (!current) {
    fs.unlinkSync(file.path);
    throw new AppError("User not found", 404);
  }

  const result = await cloudinary.uploader.upload(file.path, {
    folder: "avatars",
    resource_type: "image",
  });
  fs.unlinkSync(file.path);

  // Only clean up avatars we previously stored on Cloudinary — never a URL
  // that came from somewhere else (e.g. a future Google sign-in photo).
  if (current.avatar && current.avatar.includes("/avatars/")) {
    try {
      const publicId = current.avatar.split("/").pop().split(".")[0];
      await cloudinary.uploader.destroy(`avatars/${publicId}`);
    } catch (err) {
      console.error("Failed to remove old avatar:", err.message);
    }
  }

  const user = await userRepo.updateById(userId, { avatar: result.secure_url });
  return { success: true, data: user };
};

export const updateUserByAdmin = async (actor, userId, updates) => {
  // Belt and braces: the Joi schema already strips it, but never let an admin
  // set someone else's password — that is account takeover, not support.
  if (updates.password) {
    throw new AppError(
      "Admins cannot set a user's password. Ask the user to reset it by email.",
      403
    );
  }

  const before = await userRepo.findById(userId);
  if (!before) {
    throw new AppError("User not found", 404);
  }

  const updatedUser = await userRepo.updateById(userId, updates);
  if (!updatedUser) {
    throw new AppError("User not found", 404);
  }

  await recordAudit({
    actor,
    action: "user.updated_by_admin",
    targetType: "user",
    targetId: userId,
    reason: updates.reason || "",
    metadata: {
      changedFields: Object.keys(updates).filter((k) => k !== "userId"),
      roleBefore: before.role,
      roleAfter: updatedUser.role,
    },
  });
  const obj = updatedUser.toObject ? updatedUser.toObject() : { ...updatedUser };
  if (obj.restaurantId) obj.restaurantId = obj.restaurantId.toString();
  return { success: true, data: obj };
};

export const deleteUser = async (userId) => {
  const user = await userRepo.findById(userId);
  if (!user) {
    throw new AppError("User not found", 404);
  }
  if (user.role === "shipper") {
    throw new AppError("Shipper accounts must use the account closure workflow", 409);
  }
  await userRepo.deleteById(userId);
  return { success: true, message: "User deleted successfully" };
};

export const logoutUser = () => ({
  success: true,
  message: "Logged out successfully",
});

export const refreshAccessToken = async (refreshToken) => {
  if (!refreshToken) {
    throw new AppError("Refresh token is required", 400);
  }

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
  } catch (error) {
    throw new AppError("Invalid or expired refresh token", 401);
  }

  if (decoded.type !== "refresh") {
    throw new AppError("Invalid token type", 401);
  }

  const hashedToken = crypto.createHash("sha256").update(refreshToken).digest("hex");
  const user = await userRepo.findByRefreshToken(decoded.id, hashedToken);

  if (!user || !isTokenVersionCurrent(decoded, user)) {
    throw new AppError("Invalid refresh token", 401);
  }

  if (!isEmailVerified(user)) {
    throw new AppError(
      "Bạn cần xác minh email trước khi làm mới phiên đăng nhập.",
      403,
      "EMAIL_VERIFICATION_REQUIRED",
      { email: maskEmail(user.email), canResend: true }
    );
  }

  const newAccessToken = createAccessToken(user);
  return { success: true, token: newAccessToken };
};

export const resendEmailVerification = async (email) => {
  const startedAt = Date.now();
  const minimumResponseMs = Math.max(
    0,
    Number(process.env.EMAIL_VERIFICATION_MIN_RESPONSE_MS) || 350
  );
  try {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const identity = await userRepo.findByEmailOrPendingEmail(normalizedEmail);
    if (identity) {
      const user = await userRepo.findById(
        identity._id,
        "name email role emailVerified +pendingEmail"
      );
      if (user?.emailVerified === false && user.email === normalizedEmail) {
        await issueVerificationEmail({ user, to: user.email, purpose: "registration" });
        await recordAudit({
          actor: securityAuditActor(user),
          action: "email.verification_resent",
          targetType: "user",
          targetId: user._id,
          category: "email",
        });
      } else if (user?.pendingEmail === normalizedEmail) {
        await issueVerificationEmail({ user, to: normalizedEmail, purpose: "email_change" });
        await recordAudit({
          actor: securityAuditActor(user),
          action: "email.change_verification_resent",
          targetType: "user",
          targetId: user._id,
          category: "email",
        });
      }
    }
    return genericVerificationResult;
  } finally {
    const remainingMs = minimumResponseMs - (Date.now() - startedAt);
    if (remainingMs > 0) await new Promise((resolve) => setTimeout(resolve, remainingMs));
  }
};

export const requestEmailChange = async (userId, currentPassword, email) => {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!validator.isEmail(normalizedEmail)) {
    throw new AppError("Email không hợp lệ", 400);
  }

  const user = await userRepo.findById(
    userId,
    "+password +pendingEmail +authVersion"
  );
  if (!user) throw new AppError("User not found", 404);
  if (!await bcrypt.compare(currentPassword, user.password)) {
    throw new AppError("Mật khẩu hiện tại không đúng", 400, "CURRENT_PASSWORD_INVALID");
  }
  if (normalizedEmail === String(user.email).toLowerCase()) {
    throw new AppError("Email mới phải khác email hiện tại", 400);
  }

  const existing = await userRepo.findByEmailOrPendingEmail(normalizedEmail);
  if (existing && String(existing._id) !== String(user._id)) {
    throw new AppError("Email đã được sử dụng", 409, "EMAIL_ALREADY_EXISTS");
  }

  try {
    await issueVerificationEmail({ user, to: normalizedEmail, purpose: "email_change" });
  } catch (error) {
    if (error?.code === 11000) {
      throw new AppError("Email đã được sử dụng", 409, "EMAIL_ALREADY_EXISTS");
    }
    throw error;
  }

  await queueEmailChangeNotice({
    userId: user._id,
    to: user.email,
    name: user.name,
    completed: false,
    authVersion: user.authVersion,
  });
  await recordAudit({
    actor: securityAuditActor(user),
    action: "email.change_requested",
    targetType: "user",
    targetId: user._id,
    category: "email",
    metadata: { emailBefore: maskEmail(user.email), emailAfter: maskEmail(normalizedEmail) },
  });

  return {
    success: true,
    verificationRequired: true,
    email: maskEmail(normalizedEmail),
    message: "Hãy kiểm tra email mới và mở liên kết xác nhận trong 15 phút.",
  };
};

export const verifyEmail = async (token) => {
  const tokenHash = crypto.createHash("sha256").update(String(token || "")).digest("hex");
  const verified = await userRepo.consumeEmailVerificationToken(tokenHash);
  if (verified) {
    await recordAudit({
      actor: securityAuditActor(verified),
      action: "email.verified",
      targetType: "user",
      targetId: verified._id,
      category: "email",
    });
    await queueWelcomeEmail({ userId: verified._id, to: verified.email, name: verified.name });
    return {
      success: true,
      type: "registration",
      message: "Email đã được xác minh. Bạn có thể đăng nhập.",
    };
  }

  try {
    const changed = await userRepo.consumePendingEmailToken(tokenHash);
    if (changed) {
      const { user, oldEmail } = changed;
      await recordAudit({
        actor: securityAuditActor(user),
        action: "email.changed",
        targetType: "user",
        targetId: user._id,
        category: "email",
        metadata: { emailBefore: maskEmail(oldEmail), emailAfter: maskEmail(user.email) },
      });
      await queueEmailChangeNotice({
        userId: user._id,
        to: oldEmail,
        name: user.name,
        completed: true,
        authVersion: user.authVersion,
      });
      return {
        success: true,
        type: "email_change",
        message: "Email đăng nhập đã được thay đổi. Các phiên cũ đã đóng; hãy đăng nhập lại.",
        sessionUserId: String(user._id),
      };
    }
  } catch (error) {
    if (error?.code === 11000) {
      throw new AppError("Email đã được sử dụng", 409, "EMAIL_ALREADY_EXISTS");
    }
    throw error;
  }

  if (
    await userRepo.wasEmailVerificationTokenConsumed(tokenHash)
    || await userRepo.wasPendingEmailTokenConsumed(tokenHash)
  ) {
    throw new AppError(
      "Liên kết xác minh đã được sử dụng.",
      400,
      "EMAIL_VERIFICATION_ALREADY_USED"
    );
  }
  throw new AppError(
    "Liên kết xác minh không hợp lệ hoặc đã hết hạn.",
    400,
    "EMAIL_VERIFICATION_INVALID_OR_EXPIRED"
  );
};

export const forgotPassword = async (email) => {
  const startedAt = Date.now();
  const minimumResponseMs = Math.max(0, Number(process.env.FORGOT_PASSWORD_MIN_RESPONSE_MS) || 350);
  const genericResult = {
    success: true,
    message: "Nếu email này tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi.",
  };
  // Perform the same token generation/hashing work before the account branch.
  // Together with the response floor this removes the practical SMTP/DB timing
  // signal without delaying on the mail provider.
  const resetToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

  try {
    const user = await userRepo.findByEmail(email);
    if (user) {
      const securityBaseUrl = String(
        process.env.ACCOUNT_SECURITY_URL
          || process.env.FRONTEND_URL
          || "http://localhost:5173"
      ).replace(/\/$/, "");
      const resetUrl = `${securityBaseUrl}/reset-password/${resetToken}`;
      const resetTokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
      const emailJob = await preparePasswordResetEmail({
        userId: user._id,
        to: user.email,
        name: user.name,
        resetUrl,
        resetTokenHash: hashedToken,
        resetTokenExpiresAt,
      });
      let tokenStored = false;
      try {
        const update = await userRepo.setPasswordResetToken(
          user._id,
          hashedToken,
          resetTokenExpiresAt
        );
        tokenStored = update.matchedCount === 1;
      } catch (error) {
        await cancelPasswordResetEmail(emailJob._id, hashedToken).catch(() => undefined);
        throw error;
      }

      if (!tokenStored) {
        await cancelPasswordResetEmail(emailJob._id, hashedToken).catch(() => undefined);
        return genericResult;
      }

      // If activation is interrupted, the durable pending job is reconciled
      // against the stored User token by the worker before delivery.
      await activatePasswordResetEmail({
        jobId: emailJob._id,
        userId: user._id,
        resetTokenHash: hashedToken,
      });

      await recordAudit({
        actor: securityAuditActor(user),
        action: "password.reset_requested",
        targetType: "user",
        targetId: user._id,
        category: "password",
        outcome: "success",
      });
    } else {
      await recordAudit({
        action: "password.reset_requested",
        targetType: "authentication",
        category: "password",
        outcome: "success",
      });
    }
    return genericResult;
  } finally {
    const remainingMs = minimumResponseMs - (Date.now() - startedAt);
    if (remainingMs > 0) await new Promise((resolve) => setTimeout(resolve, remainingMs));
  }
};

export const resetPassword = async (token, newPassword) => {
  if (!newPassword || newPassword.length < 8) {
    throw new AppError("Password must be at least 8 characters", 400);
  }

  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(newPassword, salt);
  const user = await userRepo.consumeResetToken(hashedToken, { password: hash });

  if (!user) {
    if (await userRepo.wasResetPasswordTokenConsumed(hashedToken)) {
      throw new AppError("Liên kết đặt lại mật khẩu này đã được sử dụng.", 400, "RESET_TOKEN_ALREADY_USED");
    }
    throw new AppError("Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn", 400, "RESET_TOKEN_INVALID_OR_EXPIRED");
  }

  await recordAudit({
    actor: securityAuditActor(user),
    action: "password.reset_succeeded",
    targetType: "user",
    targetId: user._id,
    category: "password",
  });
  await queuePasswordChangedEmail({
    userId: user._id,
    to: user.email,
    name: user.name,
    source: "reset",
    authVersion: user.authVersion,
  });

  return { success: true, message: "Đặt lại mật khẩu thành công", sessionUserId: String(user._id) };
};

export const verifyResetToken = async (token) => {
  const hashedToken = crypto.createHash("sha256").update(String(token || "")).digest("hex");
  const isValid = await userRepo.isResetPasswordTokenValid(hashedToken);
  if (isValid) {
    return { success: true, message: "Liên kết hợp lệ." };
  }
  if (await userRepo.wasResetPasswordTokenConsumed(hashedToken)) {
    throw new AppError("Liên kết đặt lại mật khẩu này đã được sử dụng.", 400, "RESET_TOKEN_ALREADY_USED");
  }
  throw new AppError("Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.", 400, "RESET_TOKEN_INVALID_OR_EXPIRED");
};

export const getStats = async (period = "day") => {
  const [userCount, restaurantCount, completedOrdersCount] = await Promise.all([
    userRepo.countDocuments(),
    restaurantRepo.countDocuments(),
    userRepo.countCompletedOrders(),
  ]);

  const groupFormat = period === "month" ? "%Y-%m" : "%Y-%m-%d";
  const [revenue, completedSeries] = await Promise.all([
    userRepo.aggregateRevenue(period),
    userRepo.aggregateCompletedSeries(groupFormat),
  ]);

  return {
    success: true,
    data: {
      userCount,
      restaurantCount,
      completedOrdersCount,
      revenue,
      completedSeries,
    },
  };
};

export const getUserTransactions = async (userId) => {
  const user = await userRepo.findById(userId);
  if (!user) throw new AppError("User not found", 404);

  const Order = (await import("../models/orderModel.cjs")).default;
  const orders = await Order.find({ user: userId, paymentMethod: "PAYOS" })
    .sort({ createdAt: 1 })
    .populate("restaurantId", "name")
    .lean();

  const payosOrderIds = new Set(orders.map((o) => String(o._id)));
  const RefundRequest = (await import("../models/refundRequestModel.cjs")).default;
  const refunds = await RefundRequest.find({ customer: userId, status: "paid" })
    .sort({ createdAt: 1 })
    .lean();

  const events = [];

  for (const o of orders) {
    if (o.isPaid || o.paidAt || ["preparing", "delivering", "delivered"].includes(o.orderStatus)) {
      const voucherSettled = isZeroPayableVoucherOrder(o);
      events.push({
        _id: `order_${o._id}`,
        transactionType: voucherSettled ? "voucher_payment" : "payos_payment",
        title: `${voucherSettled ? "Thanh toán bằng voucher" : "Thanh toán PayOS"} - Đơn #${o._id.toString().slice(-6).toUpperCase()}`,
        // This is the customer's cash movement, not the gross order value.
        amount: voucherSettled ? 0 : -o.totalPrice,
        status: o.isPaid ? "paid" : o.orderStatus,
        paymentMethod: voucherSettled ? "VOUCHER" : "PAYOS",
        payosOrderCode: o.payosOrderCode,
        createdAt: o.paidAt || o.createdAt,
      });
    }
  }

  for (const r of refunds) {
    if (!r.order || payosOrderIds.has(String(r.order))) {
      events.push({
        _id: `refund_${r._id}`,
        transactionType: "payos_refund",
        title: `Hoàn tiền PayOS - Đơn #${r.order ? r.order.toString().slice(-6).toUpperCase() : ""}`,
        amount: r.amount,
        status: r.status,
        paymentMethod: "PAYOS",
        createdAt: r.updatedAt || r.createdAt,
      });
    }
  }

  events.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  let cumulative = user.balance || 0;
  const withBalance = events.map((ev) => {
    cumulative += ev.amount;
    return {
      ...ev,
      balanceAfter: cumulative,
    };
  });

  withBalance.reverse();

  return {
    success: true,
    data: {
      currentBalance: user.balance || 0,
      transactions: withBalance,
    },
  };
};

