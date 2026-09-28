import type { CartSummary } from "../types";

export const getCartBadgeCount = (carts: Pick<CartSummary, "cartId">[] = []) => carts.length;

export const selectRestaurantCart = (
  carts: Pick<CartSummary, "cartId" | "restaurant">[] = [],
  restaurantId?: string | null
) => carts.find((cart) => String(cart.restaurant?.id) === String(restaurantId)) || null;

export const getCartCardMeta = (cart: Partial<CartSummary>) => {
  const result = [`${cart.itemCount || 0} món`];
  if (cart.restaurant?.isOpen === false) return [...result, "Quán đang đóng cửa"];
  if (Number.isFinite(cart.etaMin) && Number.isFinite(cart.distanceKm)) {
    const eta = cart.etaMin as number;
    const distance = cart.distanceKm as number;
    result.push(`${eta}–${eta + 10} phút`);
    result.push(distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(1)} km`);
  }
  return result;
};
