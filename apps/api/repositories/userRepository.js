// backend/repositories/userRepository.js
import { User, Restaurant, Order } from "../models/index.cjs"; // Dùng index

export const initializeIndexes = () => User.init();

export const findByEmail = async (email) => {
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : email;
  return await User.findOne({ email: normalizedEmail }).select("+password +role +authVersion"); // Select hidden fields
};

export const findById = async (id, select = "-password -cart -wishlist") => {
  // Exclude sensitive/embedded cart nếu không cần
  return await User.findById(id).select(select).populate("restaurantId"); // Populate restaurant nếu có
};

export const create = async (userData) => {
  // Validate schema: email unique, password min 6
  const user = new User(userData);
  return await user.save({ validateBeforeSave: true });
};

export const updateById = async (id, updates, select = "-password", options = {}) => {
  return await User.findByIdAndUpdate(id, updates, {
    new: true,
    runValidators: true,
    ...options,
  })
    .select(select)
    .populate("restaurantId");
};

export const deleteById = async (id) => {
  return await User.findByIdAndDelete(id);
};

export const findAll = async (select = "-password -cart -wishlist", { page, limit } = {}) => {
  let query = User.find({}).select(select).populate("restaurantId");

  if (page && limit) {
    const total = await User.countDocuments();
    const data = await query.skip((page - 1) * limit).limit(limit);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  const data = await query;
  return { data };
};

export const countDocuments = async () => {
  return await User.countDocuments();
};

export const findAdmin = async () => {
  return await User.findOne({ role: "admin" }).select("+password +balance");
};

export const consumeResetToken = async (hashedToken, updates) => {
  return await User.findOneAndUpdate(
    {
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    },
    {
      $set: {
        ...updates,
        lastResetPasswordToken: hashedToken,
        resetPasswordToken: null,
        resetPasswordExpires: null,
        refreshToken: null,
      },
      $inc: { authVersion: 1 },
    },
    { new: true, runValidators: true }
  ).select("name email role +resetPasswordToken +resetPasswordExpires +refreshToken +authVersion");
};

export const wasResetPasswordTokenConsumed = async (tokenHash) => Boolean(
  await User.exists({ lastResetPasswordToken: tokenHash })
);

export const isResetPasswordTokenValid = async (tokenHash) => Boolean(
  await User.exists({
    resetPasswordToken: tokenHash,
    resetPasswordExpires: { $gt: Date.now() },
  })
);

export const findByEmailOrPendingEmail = async (email) => {
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : email;
  return await User.findOne({
    $or: [{ email: normalizedEmail }, { pendingEmail: normalizedEmail }],
  }).select("email +pendingEmail");
};

export const updatePasswordAndRevokeSessions = async (userId, password) => {
  return await User.findByIdAndUpdate(
    userId,
    {
      $set: { password, refreshToken: null },
      $inc: { authVersion: 1 },
    },
    { new: true, runValidators: true }
  ).select("name email role +authVersion");
};

export const setPasswordResetToken = (userId, resetPasswordToken, resetPasswordExpires) =>
  User.updateOne(
    { _id: userId },
    { $set: { resetPasswordToken, resetPasswordExpires } }
  );

export const hasActivePasswordResetToken = async (userId, resetPasswordToken) => Boolean(
  await User.exists({
    _id: userId,
    resetPasswordToken,
    resetPasswordExpires: { $gt: new Date() },
  })
);

export const setEmailVerificationToken = (userId, tokenHash, expiresAt) =>
  User.updateOne(
    { _id: userId, emailVerified: false },
    { $set: { emailVerificationToken: tokenHash, emailVerificationExpires: expiresAt } }
  );

export const hasActiveEmailVerificationToken = async (userId, tokenHash) => Boolean(
  await User.exists({
    _id: userId,
    emailVerified: false,
    emailVerificationToken: tokenHash,
    emailVerificationExpires: { $gt: new Date() },
  })
);

export const consumeEmailVerificationToken = (tokenHash) => User.findOneAndUpdate(
  {
    emailVerified: false,
    emailVerificationToken: tokenHash,
    emailVerificationExpires: { $gt: new Date() },
  },
  {
    $set: {
      emailVerified: true,
      emailVerifiedAt: new Date(),
      lastEmailVerificationToken: tokenHash,
      emailVerificationToken: null,
      emailVerificationExpires: null,
    },
  },
  { new: true }
).select("name email role emailVerified emailVerifiedAt");

export const wasEmailVerificationTokenConsumed = async (tokenHash) => Boolean(
  await User.exists({ lastEmailVerificationToken: tokenHash, emailVerified: true })
);

export const setPendingEmailVerification = (userId, pendingEmail, tokenHash, expiresAt) =>
  User.findOneAndUpdate(
    { _id: userId, emailVerified: { $ne: false } },
    {
      $set: {
        pendingEmail,
        pendingEmailVerificationToken: tokenHash,
        pendingEmailVerificationExpires: expiresAt,
      },
    },
    { new: true, runValidators: true }
  ).select("name email role +pendingEmail +authVersion");

export const hasActivePendingEmailToken = async (userId, tokenHash) => Boolean(
  await User.exists({
    _id: userId,
    pendingEmailVerificationToken: tokenHash,
    pendingEmailVerificationExpires: { $gt: new Date() },
  })
);

export const consumePendingEmailToken = async (tokenHash) => {
  const candidate = await User.findOne({
    pendingEmailVerificationToken: tokenHash,
    pendingEmailVerificationExpires: { $gt: new Date() },
  }).select("+pendingEmail");
  if (!candidate?.pendingEmail) return null;

  const oldEmail = candidate.email;
  const user = await User.findOneAndUpdate(
    {
      _id: candidate._id,
      pendingEmail: candidate.pendingEmail,
      pendingEmailVerificationToken: tokenHash,
    },
    {
      $set: {
        email: candidate.pendingEmail,
        emailVerified: true,
        emailVerifiedAt: new Date(),
        lastPendingEmailVerificationToken: tokenHash,
        refreshToken: null,
      },
      $unset: {
        pendingEmail: 1,
        pendingEmailVerificationToken: 1,
        pendingEmailVerificationExpires: 1,
      },
      $inc: { authVersion: 1 },
    },
    { new: true }
  ).select("name email role +authVersion");
  return user ? { user, oldEmail } : null;
};

export const wasPendingEmailTokenConsumed = async (tokenHash) => Boolean(
  await User.exists({ lastPendingEmailVerificationToken: tokenHash })
);

export const findByRefreshToken = async (userId, hashedToken) => {
  return await User.findOne({
    _id: userId,
    refreshToken: hashedToken,
  }).select("+refreshToken +authVersion");
};

export const updateRestaurantForUser = async (userId, restaurantId) => {
  return await User.findByIdAndUpdate(userId, { restaurantId }, { new: true });
};

export const countRestaurants = async () => {
  return await Restaurant.countDocuments();
};

export const countCompletedOrders = async () => {
  return await Order.countDocuments({ orderStatus: "delivered" });
};

// Thêm cho stats aggregate nếu cần (dùng trong service)
export const aggregateRevenue = async (period = "day") => {
  const match = { orderStatus: "delivered" };
  const groupFormat = period === "month" ? "%Y-%m" : "%Y-%m-%d";
  return await Order.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $dateToString: { format: groupFormat, date: "$deliveredAt" } },
        totalRevenue: { $sum: { $multiply: ["$totalPrice", 0.2] } },
      },
    },
    { $sort: { _id: 1 } },
  ]);
};

export const aggregateCompletedSeries = async (groupFormat) => {
  return await Order.aggregate([
    { $match: { orderStatus: "delivered" } },
    {
      $group: {
        _id: { $dateToString: { format: groupFormat, date: "$deliveredAt" } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
};
