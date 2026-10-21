import mongoose from "mongoose";
import { Cart, Food } from "../models/index.cjs";
import AppError from "../utils/AppError.js";

const populateCart = (query) =>
  query
    .populate("items.foodId")
    .populate("restaurantId")
    .populate("branchId")
    .populate("merchantId");

export const findAllByUser = async (userId) =>
  populateCart(Cart.find({ userId }).sort({ updatedAt: -1 }));

export const findByIdForUser = async (cartId, userId) => {
  if (!mongoose.isValidObjectId(cartId)) return null;
  return populateCart(Cart.findOne({ _id: cartId, userId }));
};

export const findByUserAndRestaurant = async (userId, restaurantId) =>
  populateCart(Cart.findOne({ userId, restaurantId }));

export const findByUserAndBranch = async (userId, branchId) =>
  populateCart(Cart.findOne({ userId, branchId }));

export const findOrCreate = async (userId, restaurantId) => {
  try {
    return await Cart.findOneAndUpdate(
      { userId, restaurantId },
      { $setOnInsert: { userId, restaurantId, items: [] } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    if (error?.code === 11000) {
      return Cart.findOne({ userId, restaurantId });
    }
    throw error;
  }
};

export const findOrCreateByBranch = async (userId, branchId, merchantId) => {
  try {
    return await Cart.findOneAndUpdate(
      { userId, branchId },
      { $setOnInsert: { userId, branchId, merchantId, items: [] } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    if (error?.code === 11000) {
      return Cart.findOne({ userId, branchId });
    }
    throw error;
  }
};

export const mutateItems = async (cartId, userId, mutation, retries = 6) => {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    const cart = await Cart.findOne({ _id: cartId, userId });
    if (!cart) return null;
    mutation(cart.items);

    if (cart.items.length === 0) {
      const deleted = await Cart.deleteOne({
        _id: cart._id,
        userId,
        __v: cart.__v,
      });
      if (deleted.deletedCount === 1) return null;
      continue;
    }

    try {
      await cart.save();
      return findByIdForUser(cart._id, userId);
    } catch (error) {
      if (error?.name !== "VersionError" || attempt === retries - 1) {
        if (error?.name === "VersionError") {
          throw new AppError("Giỏ hàng đang được cập nhật đồng thời, vui lòng thử lại", 409);
        }
        throw error;
      }
      // Giãn cách ngẫu nhiên (jittered backoff) để giải tỏa tranh chấp ghi đồng thời
      const delayMs = Math.floor(Math.random() * 25 + 15) * (attempt + 1);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new AppError("Giỏ hàng đang được cập nhật đồng thời, vui lòng thử lại", 409);
};

export const deleteByIdForUser = async (cartId, userId) => {
  if (!mongoose.isValidObjectId(cartId)) return { deletedCount: 0 };
  return Cart.deleteOne({ _id: cartId, userId });
};

export const findFoodById = async (foodId) => Food.findById(foodId);
