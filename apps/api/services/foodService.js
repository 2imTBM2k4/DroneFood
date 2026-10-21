import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import * as foodRepo from "../repositories/foodRepository.js";
import foodModel from "../models/foodModel.cjs";
import AppError from "../utils/AppError.js";
export const addFood = async (user, foodData, file) => {
  let targetMerchantId = foodData.merchantId;
  let targetRestaurantId = foodData.restaurantId;

  if (user.role === "merchant_owner") {
    const { Merchant } = await import("../models/index.cjs");
    const merchant = await Merchant.findOne({ ownerUserId: user._id });
    if (!merchant) {
      throw new AppError("Bạn chưa có thông tin merchant", 404);
    }
    if (targetMerchantId && targetMerchantId.toString() !== merchant._id.toString()) {
      throw new AppError("Bạn không có quyền thêm món cho merchant khác", 403);
    }
    targetMerchantId = merchant._id;
  } else if (user.role === "restaurant_owner") {
    if (!user.restaurantId) {
      throw new AppError(
        "Only restaurant owners with a valid restaurant can add food",
        403
      );
    }
    targetRestaurantId = user.restaurantId;
  } else if (user.role === "admin") {
    if (!targetMerchantId && !targetRestaurantId) {
      throw new AppError("merchantId hoặc restaurantId là bắt buộc", 400);
    }
  } else {
    throw new AppError(
      "Only merchant owners or restaurant owners can add food",
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
    transformation: [
      { width: 800, height: 800, crop: "limit", quality: "auto", fetch_format: "auto" },
    ],
  });
  imageUrl = result.secure_url;
  fs.unlinkSync(file.path);

  const newFoodData = {
    name,
    description,
    price,
    category,
    image: imageUrl,
    merchantId: targetMerchantId || undefined,
    restaurantId: targetRestaurantId || targetMerchantId || undefined,
    optionGroups: optionGroups || [],
  };
  const newFood = await foodRepo.create(newFoodData);
  return { success: true, message: "Food added successfully", food: newFood };
};

// SỬA: Cho phép user thường xem món ăn theo restaurantId hoặc merchantId/branchId
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const listFood = async (user, query = {}) => {
  const { restaurantId, merchantId, branchId, q, category, minPrice, maxPrice, page, limit, sort } = query;
  const conditions = [];

  let effectiveMerchantId = merchantId;
  let effectiveBranchId = branchId;

  if (!effectiveMerchantId && branchId) {
    const { Branch } = await import("../models/index.cjs");
    const branch = await Branch.findById(branchId);
    if (branch) {
      effectiveMerchantId = branch.merchantId;
    }
  }

  if (effectiveMerchantId) {
    conditions.push({ $or: [{ merchantId: effectiveMerchantId }, { restaurantId: effectiveMerchantId }] });
  } else if (restaurantId) {
    conditions.push({ $or: [{ restaurantId }, { merchantId: restaurantId }] });
  } else if (user && (user.role === "restaurant_owner" || user.role === "merchant_owner")) {
    if (user.role === "merchant_owner") {
      const { Merchant } = await import("../models/index.cjs");
      const merchant = await Merchant.findOne({ ownerUserId: user._id });
      if (merchant) {
        conditions.push({ $or: [{ merchantId: merchant._id }, { restaurantId: merchant._id }] });
      }
    } else if (user.restaurantId) {
      conditions.push({ $or: [{ restaurantId: user.restaurantId }, { merchantId: user.restaurantId }] });
    }
  } else if (user && user.role === "branch_manager") {
    const { Branch } = await import("../models/index.cjs");
    const managedBranches = await Branch.find({ managerUserIds: user._id });
    if (managedBranches.length > 0) {
      effectiveMerchantId = managedBranches[0].merchantId;
      if (!effectiveBranchId) {
        effectiveBranchId = managedBranches[0]._id.toString();
      }
      conditions.push({ $or: [{ merchantId: effectiveMerchantId }, { restaurantId: effectiveMerchantId }] });
    }
  } else {
    // Storefront discovery must not expose dishes an owner has marked sold
    // out. Restaurant owners still receive their entire menu above.
    conditions.push({ isAvailable: true });
  }

  if (q) {
    const search = new RegExp(escapeRegex(q), "i");
    conditions.push({ $or: [{ name: search }, { description: search }] });
  }

  const filter = conditions.length > 1
    ? { $and: conditions }
    : conditions.length === 1
      ? conditions[0]
      : {};

  if (category) filter.category = category;
  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.price = {};
    if (minPrice !== undefined) filter.price.$gte = minPrice;
    if (maxPrice !== undefined) filter.price.$lte = maxPrice;
  }

  const result = await foodRepo.findAll(filter, { page, limit, sort });

  const data = (result.data || []).map((item) => {
    const raw = typeof item.toObject === "function" ? item.toObject() : { ...item };
    if (effectiveBranchId) {
      const isUnavailableHere =
        Array.isArray(raw.unavailableBranchIds) &&
        raw.unavailableBranchIds.some(
          (b) => (b._id || b).toString() === effectiveBranchId.toString()
        );
      raw.isBranchAvailable = raw.isAvailable !== false && !isUnavailableHere;
      raw.isSoldOutAtBranch = isUnavailableHere;
    }
    return raw;
  });

  return { success: true, data, pagination: result.pagination };
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

  let isAuthorized = user.role === "admin";
  if (!isAuthorized) {
    if (user.role === "merchant_owner") {
      const { Merchant } = await import("../models/index.cjs");
      const merchant = await Merchant.findOne({ ownerUserId: user._id });
      if (merchant) {
        const merchantIdStr = merchant._id.toString();
        const foodMerchantStr = (food.merchantId?._id || food.merchantId || "").toString();
        const foodRestStr = (food.restaurantId?._id || food.restaurantId || "").toString();
        if (foodMerchantStr === merchantIdStr || foodRestStr === merchantIdStr) {
          isAuthorized = true;
        }
      }
    } else if (
      userRestIdStr &&
      (userRestIdStr === foodRestIdStr ||
        userRestIdStr === (food.merchantId?._id || food.merchantId || "").toString())
    ) {
      isAuthorized = true;
    }
  }

  if (!isAuthorized) {
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

  let isAuthorized = user.role === "admin";
  if (!isAuthorized) {
    if (user.role === "merchant_owner") {
      const { Merchant } = await import("../models/index.cjs");
      const merchant = await Merchant.findOne({ ownerUserId: user._id });
      if (merchant) {
        const merchantIdStr = merchant._id.toString();
        const foodMerchantStr = (food.merchantId?._id || food.merchantId || "").toString();
        const foodRestStr = (food.restaurantId?._id || food.restaurantId || "").toString();
        if (foodMerchantStr === merchantIdStr || foodRestStr === merchantIdStr) {
          isAuthorized = true;
        }
      }
    } else if (
      userRestIdStr &&
      (userRestIdStr === foodRestIdStr ||
        userRestIdStr === (food.merchantId?._id || food.merchantId || "").toString())
    ) {
      isAuthorized = true;
    }
  }

  if (!isAuthorized) {
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
      transformation: [
        { width: 800, height: 800, crop: "limit", quality: "auto", fetch_format: "auto" },
      ],
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

export const setFoodAvailability = async (user, foodId, isAvailable) => {
  const food = await foodRepo.findById(foodId);
  if (!food) throw new AppError("Food not found", 404);

  let isAuthorized = user.role === "admin";
  if (!isAuthorized) {
    if (user.role === "merchant_owner") {
      const { Merchant } = await import("../models/index.cjs");
      const merchant = await Merchant.findOne({ ownerUserId: user._id });
      if (merchant) {
        const merchantIdStr = merchant._id.toString();
        const foodMerchantStr = (food.merchantId?._id || food.merchantId || "").toString();
        const foodRestStr = (food.restaurantId?._id || food.restaurantId || "").toString();
        if (foodMerchantStr === merchantIdStr || foodRestStr === merchantIdStr) {
          isAuthorized = true;
        }
      }
    } else if (
      user.restaurantId &&
      (String(user.restaurantId) === String(food.restaurantId?._id || food.restaurantId || "") ||
        String(user.restaurantId) === String(food.merchantId?._id || food.merchantId || ""))
    ) {
      isAuthorized = true;
    }
  }

  if (!isAuthorized) {
    throw new AppError("Unauthorized: Not your restaurant's food", 403);
  }

  const updated = await foodRepo.updateById(foodId, { isAvailable });
  return { success: true, food: updated };
};

export const setBranchFoodAvailability = async (
  user,
  foodId,
  branchId,
  isAvailable
) => {
  const food = await foodRepo.findById(foodId);
  if (!food) throw new AppError("Food not found", 404);

  const { Branch, Merchant } = await import("../models/index.cjs");
  const branch = await Branch.findById(branchId);
  if (!branch) throw new AppError("Chi nhánh không tồn tại", 404);

  const branchMerchantId = branch.merchantId.toString();
  const foodMerchantId = (
    food.merchantId?._id ||
    food.merchantId ||
    food.restaurantId?._id ||
    food.restaurantId ||
    ""
  ).toString();

  if (foodMerchantId !== branchMerchantId) {
    throw new AppError("Món ăn không thuộc thực đơn của chi nhánh này", 400);
  }

  let isAuthorized = user.role === "admin";
  if (!isAuthorized) {
    if (user.role === "merchant_owner") {
      const merchant = await Merchant.findOne({ ownerUserId: user._id });
      if (merchant && merchant._id.toString() === branchMerchantId) {
        isAuthorized = true;
      }
    } else if (user.role === "branch_manager") {
      const isAssigned =
        Array.isArray(branch.managerUserIds) &&
        branch.managerUserIds.some(
          (mgrId) => mgrId.toString() === user._id.toString()
        );
      if (isAssigned) {
        isAuthorized = true;
      }
    }
  }

  if (!isAuthorized) {
    throw new AppError(
      "Bạn không có quyền quản lý món ăn tại chi nhánh này",
      403
    );
  }

  let updateQuery;
  if (isAvailable) {
    updateQuery = { $pull: { unavailableBranchIds: branch._id } };
  } else {
    updateQuery = { $addToSet: { unavailableBranchIds: branch._id } };
  }

  const updated = await foodModel.findByIdAndUpdate(foodId, updateQuery, {
    new: true,
  });

  return {
    success: true,
    message: isAvailable
      ? "Đã bật món tại chi nhánh"
      : "Đã tạm hết món tại chi nhánh",
    food: updated,
    branchId,
    isAvailable,
  };
};
