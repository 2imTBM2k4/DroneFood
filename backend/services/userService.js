import crypto from "crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import validator from "validator";
import fs from "fs";
import { v2 as cloudinary } from "cloudinary";
import * as userRepo from "../repositories/userRepository.js";
import * as restaurantRepo from "../repositories/restaurantRepository.js";
import AppError from "../utils/AppError.js";
import sendEmail from "../utils/sendEmail.js";
import { geocodeAddress } from "../utils/geocode.js";
import { recordAudit } from "../utils/auditLog.js";
import { ShipperProfile } from "../models/index.cjs";

const createAccessToken = (id) => {
  return jwt.sign({ id, type: "access" }, process.env.JWT_SECRET, { expiresIn: "30m" });
};

const createRefreshToken = (id) => {
  return jwt.sign({ id, type: "refresh" }, process.env.JWT_SECRET, { expiresIn: "7d" });
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

  const token = createAccessToken(user._id);
  const refreshToken = createRefreshToken(user._id);

  const hashedRefreshToken = crypto.createHash("sha256").update(refreshToken).digest("hex");
  await userRepo.updateById(user._id, { refreshToken: hashedRefreshToken }, "+refreshToken");

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
    phone,
    address: {
      fullName: name,
      address: address,
      phone: phone,
    },
  };
  let newUser = await userRepo.create(newUserData);
  const token = createAccessToken(newUser._id);
  const refreshToken = createRefreshToken(newUser._id);

  const hashedRefreshToken = crypto.createHash("sha256").update(refreshToken).digest("hex");
  await userRepo.updateById(newUser._id, { refreshToken: hashedRefreshToken }, "+refreshToken");

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

  return { success: true, token, refreshToken };
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
  if (email && email !== currentEmail) {
    const existing = await userRepo.findByEmail(email);
    if (existing) {
      throw new AppError("Email already exists", 409);
    }
  }
  const user = await userRepo.updateById(userId, { name, email, phone });
  return { success: true, data: user };
};

export const changePassword = async (userId, currentPassword, newPassword) => {
  // findById hides the password by default; ask for it explicitly so we can
  // verify the current one before overwriting.
  const user = await userRepo.findById(userId, "+password");
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
  await userRepo.updateById(userId, { password: hash });
  return { success: true, message: "Đổi mật khẩu thành công" };
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

  if (!user) {
    throw new AppError("Invalid refresh token", 401);
  }

  const newAccessToken = createAccessToken(user._id);
  return { success: true, token: newAccessToken };
};

export const forgotPassword = async (email) => {
  const user = await userRepo.findByEmail(email);
  if (!user) {
    throw new AppError("No account with that email address", 404);
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

  await userRepo.updateById(user._id, {
    resetPasswordToken: hashedToken,
    resetPasswordExpires: Date.now() + 15 * 60 * 1000,
  }, "+resetPasswordToken +resetPasswordExpires");

  const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/reset-password/${resetToken}`;

  await sendEmail({
    to: email,
    subject: "Password Reset - Drone Food",
    html: `
      <h2>Password Reset Request</h2>
      <p>You requested a password reset. Click the link below to set a new password:</p>
      <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#ff6b35;color:#fff;text-decoration:none;border-radius:6px;">Reset Password</a>
      <p>This link expires in 15 minutes.</p>
      <p>If you did not request this, please ignore this email.</p>
    `,
  });

  return { success: true, message: "Password reset email sent" };
};

export const resetPassword = async (token, newPassword) => {
  if (!newPassword || newPassword.length < 8) {
    throw new AppError("Password must be at least 8 characters", 400);
  }

  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
  const user = await userRepo.findByResetToken(hashedToken);

  if (!user) {
    throw new AppError("Invalid or expired reset token", 400);
  }

  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(newPassword, salt);

  await userRepo.updateById(user._id, {
    password: hash,
    resetPasswordToken: null,
    resetPasswordExpires: null,
  }, "+password");

  return { success: true, message: "Password has been reset successfully" };
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
