// backend/repositories/restaurantRepository.js
import { Restaurant } from "../models/index.cjs";

export const findAll = async ({ page, limit } = {}) => {
  let query = Restaurant.find({}).select("-bankAccount").populate("owner", "name email");

  if (page && limit) {
    const total = await Restaurant.countDocuments();
    const data = await query.skip((page - 1) * limit).limit(limit);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  const data = await query;
  return { data };
};

export const findById = async (id) => {
  return await Restaurant.findById(id).select("-bankAccount").populate("owner", "name email");
};

export const findByOwner = async (ownerId) => {
  return await Restaurant.findOne({ owner: ownerId });
};

export const create = async (restaurantData) => {
  const { name, address, email, owner } = restaurantData;
  if (!name || !address || !email || !owner) {
    throw new Error("Missing required fields for Restaurant");
  }
  const restaurant = new Restaurant(restaurantData);
  return await restaurant.save();
};

export const updateById = async (id, updates, options = {}) => {
  return await Restaurant.findByIdAndUpdate(id, updates, {
    new: true,
    runValidators: true,
    ...options,
  }).select("-bankAccount");
};

export const deleteById = async (id) => {
  return await Restaurant.findByIdAndDelete(id);
};

export const countDocuments = async () => {
  return await Restaurant.countDocuments();
};
