import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import * as restaurantRepo from "../repositories/restaurantRepository.js";
import * as userRepo from "../repositories/userRepository.js";
import AppError from "../utils/AppError.js";
import { geocodeAddress } from "../utils/geocode.js";
import { recordAudit } from "../utils/auditLog.js";
import { getRestaurantRatingSummaries } from "./orderReviewService.js";

export const listRestaurants = async ({ page, limit } = {}) => {
  const result = await restaurantRepo.findAll({ page, limit });
  const ratingSummaries = await getRestaurantRatingSummaries(
    result.data.map((restaurant) => restaurant._id)
  );
  const data = result.data.map((restaurant) => ({
    ...restaurant.toObject(),
    ...(ratingSummaries.get(String(restaurant._id)) || {}),
  }));
  return { success: true, data, ...(result.pagination && { pagination: result.pagination }) };
};

export const updateRestaurant = async (user, id, updates, file) => {
  // Only the restaurant's own owner (or an admin) may edit it. Ownership is
  // read from either side of the link, since some older restaurants have a
  // corrupt `owner` field while the user's `restaurantId` still points here.
  const existing = await restaurantRepo.findById(id);
  if (!existing) {
    throw new AppError("Restaurant not found", 404);
  }
  if (user.role !== "admin") {
    const ownerId = String(existing.owner?._id || existing.owner || "");
    const ownsViaRestaurant = ownerId === String(user._id);
    const ownsViaUser = String(user.restaurantId || "") === String(id);
    if (!ownsViaRestaurant && !ownsViaUser) {
      throw new AppError("You can only edit your own restaurant", 403);
    }
  }

  if (file) {
    const current = await restaurantRepo.findById(id);
    if (current && current.image) {
      try {
        const publicId = current.image.split("/").pop().split(".")[0];
        await cloudinary.uploader.destroy(`restaurants/${publicId}`);
      } catch (deleteError) {
        console.warn("Could not delete old image:", deleteError);
      }
    }
    const result = await cloudinary.uploader.upload(file.path, {
      folder: "restaurants",
      resource_type: "image",
    });
    updates.image = result.secure_url;
    fs.unlinkSync(file.path);
  }

  // Re-geocode when the address is being changed so distance stays accurate.
  if (updates.address) {
    const coords = await geocodeAddress(updates.address);
    if (coords) {
      updates.lat = coords.lat;
      updates.lng = coords.lng;
    }
  }

  const restaurant = await restaurantRepo.updateById(id, updates);
  if (!restaurant) {
    throw new AppError("Restaurant not found", 404);
  }
  return {
    success: true,
    message: "Restaurant updated successfully",
    data: restaurant,
  };
};

export const createRestaurant = async (user, data, file) => {
  // Creating a restaurant also re-points the caller's `restaurantId`, so a
  // plain customer must not be able to do it.
  if (user.role !== "restaurant_owner" && user.role !== "admin") {
    throw new AppError("Only restaurant owners can create a restaurant", 403);
  }

  let imageUrl = null;
  if (file) {
    const result = await cloudinary.uploader.upload(file.path, {
      folder: "restaurants",
      resource_type: "image",
    });
    imageUrl = result.secure_url;
    fs.unlinkSync(file.path);
  }
  const restaurantData = { ...data, image: imageUrl, owner: user._id };

  // Geocode the address so the storefront can rank this restaurant by distance.
  if (restaurantData.address) {
    const coords = await geocodeAddress(restaurantData.address);
    if (coords) {
      restaurantData.lat = coords.lat;
      restaurantData.lng = coords.lng;
    }
  }

  const newRestaurant = await restaurantRepo.create(restaurantData);

  await userRepo.updateById(user._id, { restaurantId: newRestaurant._id });

  return {
    success: true,
    message: "Restaurant created successfully",
    data: newRestaurant,
  };
};

export const deleteRestaurant = async (actor, id) => {
  const restaurant = await restaurantRepo.findById(id);
  if (!restaurant) {
    throw new AppError("Restaurant not found", 404);
  }

  const { Order } = await import("../models/index.cjs");
  const totalOrders = await Order.countDocuments({ restaurantId: id });
  if (totalOrders > 0) {
    throw new AppError(
      `Không thể xóa nhà hàng. Nhà hàng này đã có ${totalOrders} đơn hàng trong hệ thống.`,
      409
    );
  }

  if (restaurant.image) {
    try {
      const publicId = restaurant.image.split("/").pop().split(".")[0];
      await cloudinary.uploader.destroy(`restaurants/${publicId}`);
    } catch (deleteError) {
      console.warn("Could not delete image:", deleteError);
    }
  }
  await restaurantRepo.deleteById(id);

  await recordAudit({
    actor,
    action: "restaurant.deleted",
    targetType: "restaurant",
    targetId: id,
    metadata: { name: restaurant.name, email: restaurant.email },
  });

  return { success: true, message: "Restaurant deleted successfully" };
};

export const getRestaurantById = async (id) => {
  const restaurant = await restaurantRepo.findById(id);
  if (!restaurant) {
    throw new AppError("Restaurant not found", 404);
  }
  const ratingSummaries = await getRestaurantRatingSummaries([restaurant._id]);
  const ratingData = ratingSummaries.get(String(restaurant._id)) || { averageRating: null, ratingCount: 0 };
  return {
    success: true,
    data: {
      ...(typeof restaurant.toObject === "function" ? restaurant.toObject() : restaurant),
      ...ratingData,
    },
  };
};

export const lockRestaurant = async (actor, id, isLocked) => {
  if (typeof isLocked !== "boolean") {
    throw new AppError("isLocked must be a boolean", 400);
  }
  const restaurant = await restaurantRepo.updateById(id, { isLocked });
  if (!restaurant) {
    throw new AppError("Restaurant not found", 404);
  }
  await recordAudit({
    actor,
    action: isLocked ? "restaurant.locked" : "restaurant.unlocked",
    targetType: "restaurant",
    targetId: id,
    metadata: { name: restaurant.name },
  });

  return {
    success: true,
    message: `Restaurant ${isLocked ? "locked" : "unlocked"} successfully`,
    data: restaurant,
  };
};

/**
 * The owner's open/closed switch. Unlike `isLocked` (admin approval) this only
 * affects trading: a closed restaurant disappears from the storefront and
 * refuses new orders, while its owner keeps full access to the dashboard.
 */
export const setOpenState = async (user, id, isOpen) => {
  const restaurant = await restaurantRepo.findById(id);
  if (!restaurant) {
    throw new AppError("Restaurant not found", 404);
  }

  // Owners may only flip their own restaurant; admins may flip any.
  // Ownership is read from either side of the link — some older restaurants
  // have a corrupt `owner` field, but the user's `restaurantId` still points
  // here, and that is just as good a proof.
  if (user.role !== "admin") {
    const ownerId = String(restaurant.owner?._id || restaurant.owner || "");
    const ownsViaRestaurant = ownerId === String(user._id);
    const ownsViaUser = String(user.restaurantId || "") === String(id);
    if (!ownsViaRestaurant && !ownsViaUser) {
      throw new AppError("You can only change your own restaurant", 403);
    }
  }

  const updated = await restaurantRepo.updateById(id, { isOpen });

  await recordAudit({
    actor: user,
    action: isOpen ? "restaurant.opened" : "restaurant.closed",
    targetType: "restaurant",
    targetId: id,
    metadata: { name: restaurant.name },
  });

  return {
    success: true,
    message: isOpen ? "Restaurant is now open" : "Restaurant is now closed",
    data: updated,
  };
};
