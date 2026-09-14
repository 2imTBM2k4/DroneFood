// backend/repositories/userRepository.js
import { User, Restaurant, Order } from "../models/index.cjs"; // Dùng index

export const findByEmail = async (email) => {
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : email;
  return await User.findOne({ email: normalizedEmail }).select("+password +role"); // Select hidden fields
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

export const findByResetToken = async (hashedToken) => {
  return await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: Date.now() },
  }).select("+resetPasswordToken +resetPasswordExpires");
};

export const findByRefreshToken = async (userId, hashedToken) => {
  return await User.findOne({
    _id: userId,
    refreshToken: hashedToken,
  }).select("+refreshToken");
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
