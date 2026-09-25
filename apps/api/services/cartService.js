import * as cartRepo from "../repositories/cartRepository.js";
import AppError from "../utils/AppError.js";
import {
  resolveSelectedOptions,
  buildLineKey,
  computeUnitPrice,
} from "../utils/foodOptions.js";

/**
 * Shape a stored cart for the client. Lines carry the dish snapshot the UI
 * needs plus a server-computed unitPrice, so the frontend never has to price
 * options itself.
 */
const serialiseCart = (cart) => {
  const items = (cart?.items || [])
    // A dish deleted from the menu leaves a dangling ref; drop it rather than
    // break the whole cart.
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
        restaurantId: food.restaurantId?._id
          ? food.restaurantId._id.toString()
          : food.restaurantId?.toString() || null,
      };
    });

  const subtotal = items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  );

  return {
    success: true,
    items,
    subtotal,
    restaurantId: items[0]?.restaurantId || null,
  };
};

const getOrCreateCart = async (userId) => {
  const cart = await cartRepo.findByUserId(userId);
  return cart || (await cartRepo.create(userId));
};

/** Carts hold one restaurant at a time; adding across restaurants is rejected. */
const assertSameRestaurant = (cart, food) => {
  const existing = cart.items.find((item) => item.foodId);
  if (!existing) return;

  const existingRestaurantId = existing.foodId.restaurantId?.toString();
  const incomingRestaurantId = food.restaurantId?.toString();

  if (
    existingRestaurantId &&
    incomingRestaurantId &&
    existingRestaurantId !== incomingRestaurantId
  ) {
    throw new AppError("Only items from one restaurant allowed per cart", 400);
  }
};

export const getCart = async (userId) => {
  const cart = await getOrCreateCart(userId);
  return serialiseCart(cart);
};

export const addToCart = async (
  userId,
  itemId,
  quantity = 1,
  selectedOptions = [],
  note = ""
) => {
  const food = await cartRepo.findFoodById(itemId);
  if (!food) {
    throw new AppError("Food not found", 404);
  }
  if (food.isAvailable === false) {
    throw new AppError("This dish is currently sold out", 409);
  }

  // Throws if the picks don't satisfy the dish's own option groups.
  const resolvedOptions = resolveSelectedOptions(food, selectedOptions);
  const lineKey = buildLineKey(itemId, resolvedOptions);

  const cart = await getOrCreateCart(userId);
  assertSameRestaurant(cart, food);

  const existing = cart.items.find((item) => item.lineKey === lineKey);
  if (existing) {
    existing.quantity += quantity;
    // A fresh note replaces the old one; an empty one leaves it alone.
    if (note) existing.note = note;
  } else {
    cart.items.push({
      lineKey,
      foodId: itemId,
      quantity,
      selectedOptions: resolvedOptions,
      note,
    });
  }

  const updatedCart = await cartRepo.update(userId, cart.items);
  return serialiseCart(updatedCart);
};

/** Set a line's quantity outright. Quantity 0 removes the line. */
export const updateLine = async (userId, lineKey, quantity) => {
  const cart = await cartRepo.findByUserId(userId);
  if (!cart) {
    throw new AppError("Cart not found", 404);
  }

  const index = cart.items.findIndex((item) => item.lineKey === lineKey);
  if (index === -1) {
    throw new AppError("Line not in cart", 404);
  }

  if (quantity <= 0) {
    cart.items.splice(index, 1);
  } else {
    cart.items[index].quantity = quantity;
  }

  const updatedCart = await cartRepo.update(userId, cart.items);
  return serialiseCart(updatedCart);
};

/** Remove a whole line regardless of its quantity. */
export const removeLine = async (userId, lineKey) => {
  const cart = await cartRepo.findByUserId(userId);
  if (!cart) {
    throw new AppError("Cart not found", 404);
  }

  const index = cart.items.findIndex((item) => item.lineKey === lineKey);
  if (index === -1) {
    throw new AppError("Line not in cart", 404);
  }

  cart.items.splice(index, 1);
  const updatedCart = await cartRepo.update(userId, cart.items);
  return serialiseCart(updatedCart);
};

export const clearCart = async (userId) => {
  await cartRepo.deleteByUserId(userId);
  return { success: true, message: "Cart cleared", items: [], subtotal: 0 };
};
