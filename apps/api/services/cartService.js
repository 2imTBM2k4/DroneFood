import * as cartRepo from "../repositories/cartRepository.js";
import { resolveAddressSnapshot } from "./addressBookService.js";
import { assertBranchOperational } from "./branchService.js";
import { haversineKm } from "../utils/distance.js";
import { estimateEtaMinutes } from "../utils/deliveryEstimate.js";
import { isRestaurantOpenNow } from "../utils/openingHours.js";
import AppError from "../utils/AppError.js";
import {
  resolveSelectedOptions,
  buildLineKey,
  computeUnitPrice,
} from "../utils/foodOptions.js";

const restaurantIdOf = (restaurant) =>
  restaurant?._id?.toString?.() || restaurant?.toString?.() || null;

const serialiseRestaurant = (restaurant) => ({
  id: restaurantIdOf(restaurant),
  name: restaurant?.name || "Nhà hàng không còn hoạt động",
  image: restaurant?.image || "",
  isOpen: isRestaurantOpenNow(restaurant),
});

const serialiseCart = (cart, fallback = {}) => {
  const items = (cart?.items || [])
    .filter((item) => item.foodId)
    .map((item) => {
      const food = item.foodId;
      const selectedOptions = (item.selectedOptions || []).map((option) => ({
        groupName: option.groupName,
        optionName: option.optionName,
        priceDelta: option.priceDelta || 0,
      }));
      return {
        lineKey: item.lineKey,
        foodId: food._id.toString(),
        name: food.name,
        image: food.image,
        basePrice: food.price,
        unitPrice: computeUnitPrice(food, selectedOptions),
        quantity: item.quantity,
        selectedOptions,
        note: item.note || "",
        restaurantId: food.restaurantId?.toString?.() || null,
      };
    });
  const restaurant = cart?.restaurantId || fallback.restaurant || null;
  const branch = cart?.branchId || null;
  const branchId = branch?._id?.toString?.() || branch?.toString?.() || null;
  const merchantId =
    cart?.merchantId?._id?.toString?.() || cart?.merchantId?.toString?.() || null;
  return {
    success: true,
    cartId: cart?._id?.toString?.() || fallback.cartId || null,
    cartVersion: cart?.__v ?? fallback.cartVersion ?? null,
    restaurant: serialiseRestaurant(restaurant),
    restaurantId: restaurantIdOf(restaurant),
    branchId,
    merchantId,
    ...(branch?.name && { branchName: branch.name }),
    items,
    subtotal: items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0
    ),
  };
};

const summaryFor = (cart, destination) => {
  const restaurant = cart.restaurantId;
  let distanceKm = null;
  let etaMin = null;
  if (
    destination &&
    Number.isFinite(restaurant?.lat) &&
    Number.isFinite(restaurant?.lng)
  ) {
    try {
      distanceKm = haversineKm(
        { lat: restaurant.lat, lng: restaurant.lng },
        destination
      );
      etaMin = estimateEtaMinutes(distanceKm);
    } catch {
      distanceKm = null;
      etaMin = null;
    }
  }
  return {
    cartId: cart._id.toString(),
    restaurant: serialiseRestaurant(restaurant),
    itemCount: (cart.items || []).reduce(
      (sum, item) => sum + (item.foodId ? item.quantity : 0),
      0
    ),
    distanceKm,
    etaMin,
    updatedAt: cart.updatedAt,
  };
};

export const listCarts = async (userId, addressEntryId) => {
  let destination = null;
  if (addressEntryId) {
    try {
      const address = await resolveAddressSnapshot(userId, addressEntryId);
      if (Number.isFinite(address.lat) && Number.isFinite(address.lng)) {
        destination = { lat: address.lat, lng: address.lng };
      }
    } catch {
      destination = null;
    }
  }
  const carts = await cartRepo.findAllByUser(userId);
  const valid = carts.filter(
    (cart) => cart.restaurantId && cart.items.some((item) => item.foodId)
  );
  return {
    success: true,
    carts: valid.map((cart) => summaryFor(cart, destination)),
    cartCount: valid.length,
  };
};

export const getCart = async (userId, cartId) => {
  const cart = await cartRepo.findByIdForUser(cartId, userId);
  if (!cart) throw new AppError("Cart not found", 404);
  return serialiseCart(cart);
};

export const getLegacyCart = async (userId) => {
  const carts = await cartRepo.findAllByUser(userId);
  if (carts.length === 0) {
    return {
      success: true,
      cartId: null,
      items: [],
      subtotal: 0,
      restaurantId: null,
    };
  }
  if (carts.length > 1) {
    throw new AppError("Multiple carts exist; select a restaurant cart", 409);
  }
  return serialiseCart(carts[0]);
};

export const addToCart = async (
  userId,
  itemId,
  quantity = 1,
  selectedOptions = [],
  note = "",
  branchId = null,
  restaurantId = null
) => {
  if (branchId && restaurantId) {
    throw new AppError(
      "Chỉ được truyền branchId hoặc restaurantId, không được truyền cả hai",
      400
    );
  }

  const food = await cartRepo.findFoodById(itemId);
  if (!food) throw new AppError("Food not found", 404);
  if (food.isAvailable === false) {
    throw new AppError("This dish is currently sold out", 409);
  }

  const resolvedOptions = resolveSelectedOptions(food, selectedOptions);
  const lineKey = buildLineKey(itemId, resolvedOptions);

  let cart;
  if (branchId) {
    const { branch, merchant } = await assertBranchOperational(branchId);
    if (food.merchantId && food.merchantId.toString() !== merchant._id.toString()) {
      throw new AppError("Món ăn không thuộc thương hiệu của chi nhánh này", 400);
    }

    const existingCarts = await cartRepo.findAllByUser(userId);
    const otherBranchCart = existingCarts.find(
      (c) =>
        (c.items || []).length > 0 &&
        ((c.branchId && (c.branchId._id || c.branchId).toString() !== branchId.toString()) ||
          (!c.branchId && (c.restaurantId || c.get?.("restaurantId"))))
    );
    if (otherBranchCart) {
      throw new AppError(
        "Giỏ hàng chỉ chứa món từ 1 chi nhánh. Xóa giỏ để thêm từ chi nhánh mới",
        409
      );
    }

    cart = await cartRepo.findOrCreateByBranch(userId, branchId, merchant._id);
  } else {
    const targetRestId = restaurantId || food.restaurantId;
    if (!targetRestId) throw new AppError("Restaurant not found", 404);

    const existingCarts = await cartRepo.findAllByUser(userId);
    const branchCartWithItems = existingCarts.find(
      (c) => c.branchId && (c.items || []).length > 0
    );
    if (branchCartWithItems) {
      throw new AppError(
        "Giỏ hàng chỉ chứa món từ 1 chi nhánh. Xóa giỏ để thêm từ chi nhánh mới",
        409
      );
    }

    cart = await cartRepo.findOrCreate(userId, targetRestId);
  }

  if (!cart) {
    throw new AppError(
      "Cart storage migration is incomplete. Please try again after the database migration.",
      503
    );
  }

  if (cart.branchId && cart.restaurantId) {
    cart.restaurantId = undefined;
  }

  const updated = await cartRepo.mutateItems(cart._id, userId, (items) => {
    const existing = items.find((item) => item.lineKey === lineKey);
    if (existing) {
      existing.quantity += quantity;
      if (note) existing.note = note;
    } else {
      items.push({
        lineKey,
        foodId: itemId,
        quantity,
        selectedOptions: resolvedOptions,
        note,
      });
    }
  });

  return serialiseCart(updated);
};

export const updateLine = async (userId, cartId, lineKey, quantity) => {
  const current = await cartRepo.findByIdForUser(cartId, userId);
  if (!current) throw new AppError("Cart not found", 404);
  const fallback = { cartId, restaurant: current.restaurantId };
  const updated = await cartRepo.mutateItems(cartId, userId, (items) => {
    const index = items.findIndex((item) => item.lineKey === lineKey);
    if (index === -1) throw new AppError("Line not in cart", 404);
    if (quantity <= 0) items.splice(index, 1);
    else items[index].quantity = quantity;
  });
  return serialiseCart(updated, fallback);
};

export const removeLine = async (userId, cartId, lineKey) => {
  const current = await cartRepo.findByIdForUser(cartId, userId);
  if (!current) throw new AppError("Cart not found", 404);
  const fallback = { cartId, restaurant: current.restaurantId };
  const updated = await cartRepo.mutateItems(cartId, userId, (items) => {
    const index = items.findIndex((item) => item.lineKey === lineKey);
    if (index === -1) throw new AppError("Line not in cart", 404);
    items.splice(index, 1);
  });
  return serialiseCart(updated, fallback);
};

export const clearCart = async (userId, cartId) => {
  const result = await cartRepo.deleteByIdForUser(cartId, userId);
  if (result.deletedCount === 0) throw new AppError("Cart not found", 404);
  return { success: true, message: "Cart cleared", cartId };
};
