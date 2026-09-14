import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import * as foodRepo from "../repositories/foodRepository.js";
import foodModel from "../models/foodModel.cjs";
import AppError from "../utils/AppError.js";
export const addFood = async (user, foodData, file) => {
  if (user.role !== "restaurant_owner" || !user.restaurantId) {
    throw new AppError(
      "Only restaurant owners with a valid restaurant can add food",
      403
    );
  }
  const { name, description, price, category, optionGroups } = foodData;
  let imageUrl = null;

  if (!file) {
    throw new AppError("Image required", 400);
  }

  const result = await cloudinary.uploader.upload(file.path, {
    folder: "foods",
    resource_type: "image",
  });
  imageUrl = result.secure_url;
  fs.unlinkSync(file.path);

  const newFoodData = {
    name,
    description,
    price,
    category,
    image: imageUrl,
    restaurantId: user.restaurantId,
    optionGroups: optionGroups || [],
  };
  const newFood = await foodRepo.create(newFoodData);
  return { success: true, message: "Food added successfully", food: newFood };
};

// SỬA: Cho phép user thường xem món ăn theo restaurantId
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const listFood = async (user, query = {}) => {
  const { restaurantId, q, category, minPrice, maxPrice, page, limit, sort } = query;
  let filter = {};

  if (restaurantId) {
    filter.restaurantId = restaurantId;
  } else if (user && user.role === "restaurant_owner" && user.restaurantId) {
    filter.restaurantId = user.restaurantId;
  }

  if (q) {
    const search = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ name: search }, { description: search }];
  }
  if (category) filter.category = category;
  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.price = {};
    if (minPrice !== undefined) filter.price.$gte = minPrice;
    if (maxPrice !== undefined) filter.price.$lte = maxPrice;
  }

  const result = await foodRepo.findAll(filter, { page, limit, sort });
  return { success: true, data: result.data, pagination: result.pagination };
};

export const removeFood = async (user, id) => {
  const food = await foodRepo.findById(id);
  if (!food) {
    throw new AppError("Food not found", 404);
  }

  let foodRestIdStr = food.restaurantId;
  if (food.restaurantId && food.restaurantId._id) {
    foodRestIdStr = food.restaurantId._id.toString();
  } else if (typeof food.restaurantId === "object") {
    foodRestIdStr = food.restaurantId.toString();
  } else {
    foodRestIdStr = food.restaurantId;
  }

  const userRestIdStr = user.restaurantId
    ? typeof user.restaurantId === "object"
      ? user.restaurantId.toString()
      : user.restaurantId
    : null;

  // Admins may touch any dish. Everyone else must own the restaurant it
  // belongs to — checking only the restaurant_owner role would let a plain
  // customer through.
  if (user.role !== "admin" && userRestIdStr !== foodRestIdStr) {
    throw new AppError("Unauthorized: Not your restaurant's food", 403);
  }

  if (food.image) {
    const publicId = food.image.split("/").pop().split(".")[0];
    await cloudinary.uploader.destroy(`foods/${publicId}`);
  }

  await foodRepo.deleteById(id);
  return { success: true, message: "Food removed successfully" };
};

export const updateFood = async (user, updates, file) => {
  const { id, name, description, price, category, optionGroups } = updates;
  const food = await foodRepo.findById(id);

  if (!food) {
    throw new AppError("Food not found", 404);
  }

  let foodRestIdStr = food.restaurantId;
  if (food.restaurantId && food.restaurantId._id) {
    foodRestIdStr = food.restaurantId._id.toString();
  } else if (typeof food.restaurantId === "object") {
    foodRestIdStr = food.restaurantId.toString();
  } else {
    foodRestIdStr = food.restaurantId;
  }

  const userRestIdStr = user.restaurantId
    ? typeof user.restaurantId === "object"
      ? user.restaurantId.toString()
      : user.restaurantId
    : null;

  // Admins may touch any dish. Everyone else must own the restaurant it
  // belongs to — checking only the restaurant_owner role would let a plain
  // customer through.
  if (user.role !== "admin" && userRestIdStr !== foodRestIdStr) {
    throw new AppError("Unauthorized: Not your restaurant's food", 403);
  }

  const updateData = { name, description, price, category };

  // Only touch option groups when the caller sent them, so a partial update
  // can't silently wipe a dish's options.
  if (optionGroups !== undefined) {
    updateData.optionGroups = optionGroups;
  }

  if (file) {
    if (food.image) {
      const publicId = food.image.split("/").pop().split(".")[0];
      await cloudinary.uploader.destroy(`foods/${publicId}`);
    }
    const result = await cloudinary.uploader.upload(file.path, {
      folder: "foods",
      resource_type: "image",
    });
    updateData.image = result.secure_url;
    fs.unlinkSync(file.path);
  }

  const updatedFood = await foodRepo.updateById(id, updateData);
  return {
    success: true,
    message: "Food updated successfully",
    food: updatedFood,
  };
};
export const getFoodById = async (foodId) => {
  try {
    const food = await foodModel
      .findById(foodId)
      .populate("restaurantId", "name address"); // Optional: populate restaurant info nếu cần
    if (!food) {
      return { success: false, message: "Food not found" };
    }
    return { success: true, data: food };
  } catch (error) {
    console.error("Service getFoodById error:", error);
    throw new AppError("Failed to fetch food", 500);
  }
};
