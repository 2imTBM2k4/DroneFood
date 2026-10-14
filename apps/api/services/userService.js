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
import sendEmail from "../utils/sendEmail.js";
import { geocodeAddress } from "../utils/geocode.js";
import { recordAudit } from "../utils/auditLog.js";
import { ShipperProfile } from "../models/index.cjs";

const maskEmail = (email = "") => {
  const [local, domain] = email.split("@");
  return domain ? `${local.slice(0, 2)}***@${domain}` : "";
};

const createAccessToken = (id) => {
  return jwt.sign({ id, type: "access" }, process.env.JWT_SECRET, { expiresIn: "30m" });
};

const createRefreshToken = (id) => {
  return jwt.sign({ id, type: "refresh" }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

export const loginUser = async ({ email, password, portal, clientType }) => {
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

  if (user.role !== "admin" && user.isEmailVerified === false) {
    const error = new AppError(
      "Tài khoản chưa được kích hoạt. Vui lòng kiểm tra email của bạn để kích hoạt tài khoản.",
      403
    );
    error.isUnverified = true;
    error.email = user.email;
    throw error;
  }

  const userRole = user.role || "user";
  const targetPortal = portal || clientType;
  if (targetPortal) {
    if (targetPortal === "admin" && userRole !== "admin") {
      throw new AppError("Tài khoản không có quyền truy cập trang Quản trị (Admin).", 403);
    }
    const RESTAURANT_ROLES = ["restaurant_owner", "merchant_owner", "branch_manager"];
    if (targetPortal === "restaurant" && !RESTAURANT_ROLES.includes(userRole)) {
      throw new AppError("Tài khoản không có quyền truy cập giao diện Nhà hàng.", 403);
    }
    if ((targetPortal === "customer" || targetPortal === "user") && userRole !== "user") {
      throw new AppError("Tài khoản Quản trị hoặc Nhà hàng không thể đăng nhập vào giao diện Khách hàng.", 403);
    }
    if (targetPortal === "shipper" && userRole !== "shipper") {
      throw new AppError("Tài khoản này không phải là tài khoản Shipper.", 403);
    }
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
  await recordAudit({ actor: user, action: "auth.login_succeeded", targetType: "authentication", targetId: user._id, category: "authentication" });

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

export const sendAccountVerificationEmail = async (email, name, rawToken) => {
  const verifyUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/verify-email/${rawToken}`;

  try {
    await sendEmail({
      to: email,
      subject: "Kích hoạt tài khoản Drone Food của bạn",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e5e7eb; border-radius: 16px; background: #ffffff;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #ff6b35; font-size: 26px; font-weight: 800; margin: 0;">DRONE FOOD</h1>
            <p style="color: #6b7280; font-size: 14px; margin-top: 4px;">Giao đồ ăn bằng Drone thế hệ mới</p>
          </div>
          <h2 style="color: #111827; font-size: 20px; font-weight: 700; margin-top: 0;">Chào mừng bạn, ${name || "Quý khách"}!</h2>
          <p style="color: #4b5563; font-size: 15px; line-height: 1.6;">Cảm ơn bạn đã đăng ký tài khoản tại Drone Food. Để hoàn tất đăng ký và kích hoạt tài khoản của bạn, vui lòng nhấn vào nút bên dưới:</p>
          <div style="margin: 28px 0; text-align: center;">
            <a href="${verifyUrl}" style="display: inline-block; padding: 14px 28px; background-color: #ff6b35; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 6px -1px rgba(255, 107, 53, 0.2);">
              Kích hoạt tài khoản ngay
            </a>
          </div>
          <p style="color: #4b5563; font-size: 14px; line-height: 1.5;">Hoặc bạn có thể sao chép và dán liên kết sau vào trình duyệt của bạn:</p>
          <p style="margin: 8px 0; padding: 12px; background: #f3f4f6; border-radius: 8px; font-size: 12px; color: #374151; word-break: break-all;">
            <a href="${verifyUrl}" style="color: #0066cc; text-decoration: underline;">${verifyUrl}</a>
          </p>
          <p style="color: #9ca3af; font-size: 13px; line-height: 1.5; margin-top: 24px; margin-bottom: 0;">
            Liên kết kích hoạt có hiệu lực trong vòng <strong>24 giờ</strong>. Nếu bạn không tạo tài khoản này, vui lòng bỏ qua email.
          </p>
        </div>
      `,
    });
  } catch (mailErr) {
    console.error("Failed to send verification email:", mailErr?.message || mailErr);
    console.log(`[DEV] Account verification link for ${email}: ${verifyUrl}`);
  }
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

  const activationToken = crypto.randomBytes(32).toString("hex");
  const hashedActivationToken = crypto.createHash("sha256").update(activationToken).digest("hex");
  const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  const newUserData = {
    name,
    email,
    password: hash,
    role: role || "user",
    phone,
    isEmailVerified: false,
    emailVerificationToken: hashedActivationToken,
    emailVerificationTokenExpires: verificationExpires,
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

  // Send activation email asynchronously
  await sendAccountVerificationEmail(email, name, activationToken);

  return {
    success: true,
    requiresVerification: true,
    email: newUser.email,
    message: "Đăng ký thành công! Vui lòng kiểm tra email để kích hoạt tài khoản.",
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
  } else if (userObj.role === "merchant_owner" || userObj.role === "restaurant_owner") {
    const { Merchant } = await import("../models/index.cjs");
    const merchant = await Merchant.findOne({ ownerUserId: userId });
    if (merchant) {
      userObj.restaurantId = (merchant.legacyRestaurantId || merchant._id).toString();
      userObj.merchantId = merchant._id.toString();
    }
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
  const updateData = {};
  if (name !== undefined) updateData.name = name;
  if (phone !== undefined) updateData.phone = phone;

  if (email && email !== currentEmail) {
    const existing = await userRepo.findByEmail(email);
    if (existing) {
      throw new AppError("Email already exists", 409);
    }
    updateData.email = email;
  }

  const user = await userRepo.updateById(userId, updateData);
  if (updateData.email && updateData.email !== currentEmail) {
    await recordAudit({
      actor: user,
      action: "email.updated",
      targetType: "user",
      targetId: userId,
      category: "email",
      metadata: { emailBefore: maskEmail(currentEmail), emailAfter: maskEmail(updateData.email) },
    });
  }
  return { success: true, data: user };
};

export const requestEmailChange = async (userId, currentPassword, newEmail) => {
  const user = await userRepo.findById(userId, "+password");
  if (!user) {
    throw new AppError("User not found", 404);
  }

  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) {
    throw new AppError("Mật khẩu hiện tại không đúng", 400);
  }

  const normalizedEmail = newEmail.trim().toLowerCase();
  if (normalizedEmail === user.email.toLowerCase()) {
    throw new AppError("Email mới phải khác email hiện tại", 400);
  }

  const existing = await userRepo.findByEmail(normalizedEmail);
  if (existing) {
    throw new AppError("Email này đã được sử dụng bởi một tài khoản khác", 409);
  }

  const otp = String(crypto.randomInt(100000, 999999));
  const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");
  const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await userRepo.updateById(
    userId,
    {
      pendingEmail: normalizedEmail,
      emailVerificationOtp: hashedOtp,
      emailVerificationExpires: expires,
    },
    "+pendingEmail +emailVerificationOtp +emailVerificationExpires"
  );

  try {
    await sendEmail({
      to: normalizedEmail,
      subject: "Mã xác thực thay đổi Email - Drone Food",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e5e7eb; border-radius: 16px; background: #ffffff;">
          <h2 style="color: #111827; margin-top: 0; font-size: 22px; font-weight: 700;">Xác thực thay đổi Email</h2>
          <p style="color: #4b5563; font-size: 15px; line-height: 1.6;">Bạn vừa yêu cầu thay đổi email đăng nhập của tài khoản DroneFood sang địa chỉ này. Vui lòng nhập mã xác nhận bên dưới để hoàn tất:</p>
          <div style="margin: 24px 0; padding: 18px; background: #f3f4f6; border-radius: 12px; text-align: center;">
            <span style="font-family: monospace; font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #0066cc;">${otp}</span>
          </div>
          <p style="color: #6b7280; font-size: 13px; line-height: 1.5; margin-bottom: 0;">Mã xác thực có hiệu lực trong vòng <strong>10 phút</strong>. Nếu không phải bạn thực hiện yêu cầu này, vui lòng bỏ qua email.</p>
        </div>
      `,
    });
  } catch (mailErr) {
    console.error("Failed to send verification email:", mailErr?.message || mailErr);
  }

  return {
    success: true,
    message: "Mã xác thực đã được gửi đến email mới của bạn.",
  };
};

export const confirmEmailChange = async (userId, otp) => {
  const user = await userRepo.findById(
    userId,
    "+pendingEmail +emailVerificationOtp +emailVerificationExpires"
  );
  if (!user) {
    throw new AppError("User not found", 404);
  }

  if (!user.pendingEmail || !user.emailVerificationOtp || !user.emailVerificationExpires) {
    throw new AppError("Không tìm thấy yêu cầu thay đổi email nào", 400);
  }

  if (new Date() > new Date(user.emailVerificationExpires)) {
    throw new AppError("Mã xác thực đã hết hạn. Vui lòng yêu cầu lại", 400);
  }

  const hashedOtp = crypto.createHash("sha256").update(otp.trim()).digest("hex");
  if (hashedOtp !== user.emailVerificationOtp) {
    throw new AppError("Mã xác thực không chính xác", 400);
  }

  const conflict = await userRepo.findByEmail(user.pendingEmail);
  if (conflict && String(conflict._id) !== String(userId)) {
    throw new AppError("Email này đã được sử dụng bởi một tài khoản khác", 409);
  }

  const oldEmail = user.email;
  const newEmail = user.pendingEmail;

  const updatedUser = await userRepo.updateById(userId, {
    email: newEmail,
    pendingEmail: null,
    emailVerificationOtp: null,
    emailVerificationExpires: null,
  });

  await recordAudit({
    actor: updatedUser,
    action: "email.updated",
    targetType: "user",
    targetId: userId,
    category: "email",
    metadata: { emailBefore: maskEmail(oldEmail), emailAfter: maskEmail(newEmail) },
  });

  return {
    success: true,
    data: updatedUser,
    message: "Cập nhật email thành công",
  };
};

export const requestPhoneChange = async (userId, currentPassword, newPhone) => {
  const user = await userRepo.findById(userId, "+password");
  if (!user) {
    throw new AppError("User not found", 404);
  }

  if (!user.email) {
    throw new AppError("Tài khoản chưa có email để nhận mã xác minh", 400);
  }

  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) {
    throw new AppError("Mật khẩu hiện tại không đúng", 400);
  }

  const normalizedPhone = newPhone.trim();
  if (user.phone && normalizedPhone === user.phone.trim()) {
    throw new AppError("Số điện thoại mới phải khác số điện thoại hiện tại", 400);
  }

  const otp = String(crypto.randomInt(100000, 999999));
  const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");
  const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await userRepo.updateById(
    userId,
    {
      pendingPhone: normalizedPhone,
      phoneVerificationOtp: hashedOtp,
      phoneVerificationExpires: expires,
    },
    "+pendingPhone +phoneVerificationOtp +phoneVerificationExpires"
  );

  try {
    await sendEmail({
      to: user.email,
      subject: "Mã xác thực thay đổi Số điện thoại - Drone Food",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e5e7eb; border-radius: 16px; background: #ffffff;">
          <h2 style="color: #111827; margin-top: 0; font-size: 22px; font-weight: 700;">Xác thực thay đổi Số điện thoại</h2>
          <p style="color: #4b5563; font-size: 15px; line-height: 1.6;">Bạn vừa yêu cầu cập nhật số điện thoại tài khoản DroneFood sang số mới: <strong>${normalizedPhone}</strong>. Vui lòng nhập mã xác nhận bên dưới để hoàn tất:</p>
          <div style="margin: 24px 0; padding: 18px; background: #f3f4f6; border-radius: 12px; text-align: center;">
            <span style="font-family: monospace; font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #0066cc;">${otp}</span>
          </div>
          <p style="color: #6b7280; font-size: 13px; line-height: 1.5; margin-bottom: 0;">Mã xác thực có hiệu lực trong vòng <strong>10 phút</strong>. Nếu không phải bạn thực hiện yêu cầu này, vui lòng đổi mật khẩu ngay lập tức.</p>
        </div>
      `,
    });
  } catch (mailErr) {
    console.error("Failed to send phone change verification email:", mailErr?.message || mailErr);
  }

  return {
    success: true,
    message: `Mã xác thực đã được gửi đến email của bạn (${maskEmail(user.email)}).`,
  };
};

export const confirmPhoneChange = async (userId, otp) => {
  const user = await userRepo.findById(
    userId,
    "+pendingPhone +phoneVerificationOtp +phoneVerificationExpires"
  );
  if (!user) {
    throw new AppError("User not found", 404);
  }

  if (!user.pendingPhone || !user.phoneVerificationOtp || !user.phoneVerificationExpires) {
    throw new AppError("Không tìm thấy yêu cầu thay đổi số điện thoại nào", 400);
  }

  if (new Date() > new Date(user.phoneVerificationExpires)) {
    throw new AppError("Mã xác thực đã hết hạn. Vui lòng yêu cầu lại", 400);
  }

  const hashedOtp = crypto.createHash("sha256").update(otp.trim()).digest("hex");
  if (hashedOtp !== user.phoneVerificationOtp) {
    throw new AppError("Mã xác thực không chính xác", 400);
  }

  const oldPhone = user.phone;
  const newPhone = user.pendingPhone;

  const updatedUser = await userRepo.updateById(userId, {
    phone: newPhone,
    pendingPhone: null,
    phoneVerificationOtp: null,
    phoneVerificationExpires: null,
  });

  await recordAudit({
    actor: updatedUser,
    action: "phone.updated",
    targetType: "user",
    targetId: userId,
    category: "security",
    metadata: { phoneBefore: oldPhone || null, phoneAfter: newPhone },
  });

  return {
    success: true,
    data: updatedUser,
    message: "Cập nhật số điện thoại thành công",
  };
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
  await recordAudit({ actor: user, action: "password.changed", targetType: "user", targetId: userId, category: "password" });
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
        title: `${voucherSettled ? "Thanh toán bằng voucher" : "Thanh toán PayOS"} - Đơn #${o.orderCode || o._id.toString().slice(-6).toUpperCase()}`,
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
        title: `Hoàn tiền PayOS - Đơn #${r.order ? (r.order.orderCode || r.order.toString().slice(-6).toUpperCase()) : ""}`,
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

export const verifyEmail = async (token) => {
  if (!token || typeof token !== "string") {
    throw new AppError("Mã xác thực không hợp lệ", 400);
  }

  const hashedToken = crypto.createHash("sha256").update(token.trim()).digest("hex");
  const user = await userRepo.findByVerificationToken(hashedToken);

  if (!user) {
    throw new AppError("Liên kết kích hoạt không hợp lệ hoặc đã hết hạn.", 400);
  }

  await userRepo.updateById(
    user._id,
    {
      isEmailVerified: true,
      emailVerificationToken: null,
      emailVerificationTokenExpires: null,
    },
    "-password"
  );

  await recordAudit({
    actor: user,
    action: "auth.email_verified",
    targetType: "user",
    targetId: user._id,
    category: "authentication",
  });

  return {
    success: true,
    message: "Tài khoản của bạn đã được kích hoạt thành công! Bạn có thể đăng nhập ngay bây giờ.",
  };
};

export const resendVerification = async (email) => {
  if (!email || !validator.isEmail(email)) {
    throw new AppError("Email không hợp lệ", 400);
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = await userRepo.findByEmail(normalizedEmail);

  if (!user) {
    return {
      success: true,
      message: "Nếu email tồn tại trong hệ thống, liên kết kích hoạt đã được gửi.",
    };
  }

  if (user.isEmailVerified) {
    return {
      success: true,
      alreadyVerified: true,
      message: "Tài khoản này đã được kích hoạt trước đó. Bạn có thể đăng nhập ngay.",
    };
  }

  const activationToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(activationToken).digest("hex");
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await userRepo.updateById(
    user._id,
    {
      emailVerificationToken: hashedToken,
      emailVerificationTokenExpires: expires,
    },
    "+emailVerificationToken +emailVerificationTokenExpires"
  );

  await sendAccountVerificationEmail(user.email, user.name, activationToken);

  return {
    success: true,
    message: "Liên kết kích hoạt mới đã được gửi đến email của bạn.",
  };
};


