// backend/repositories/cartRepository.js
import { Cart, Food } from "../models/index.cjs"; // Dùng index

export const findByUserId = async (userId) => {
  return await Cart.findOne({ userId }).populate("items.foodId"); // Populate foodId ref
};

export const create = async (userId) => {
  try {
    const cart = new Cart({ userId, items: [] });
    return await cart.save();
  } catch (error) {
    if (error.code === 11000) {
      return await findByUserId(userId);
    }
    throw error;
  }
};

export const update = async (userId, updatedItems) => {
  // Validate items: quantity min 1 theo schema
  updatedItems.forEach((item) => {
    if (item.quantity < 1) throw new Error("Quantity must be at least 1");
  });
  return await Cart.findOneAndUpdate(
    { userId },
    { items: updatedItems },
    { new: true, runValidators: true } // Enforce schema validators
  ).populate("items.foodId");
};

export const deleteByUserId = async (userId) => {
  return await Cart.deleteOne({ userId });
};

export const findFoodById = async (foodId) => {
  return await Food.findById(foodId);
};
