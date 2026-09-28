export const cartCount = (summaries = []) => summaries.length;

export const cartForRestaurant = (summaries = [], restaurantId) =>
  summaries.find(
    (cart) => String(cart.restaurant?.id) === String(restaurantId)
  ) || null;

export const cartMeta = (cart) => {
  const parts = [`${cart?.itemCount || 0} món`];
  if (cart?.restaurant?.isOpen === false) {
    parts.push("Quán đang đóng cửa");
    return parts;
  }
  if (Number.isFinite(cart?.etaMin) && Number.isFinite(cart?.distanceKm)) {
    parts.push(`${cart.etaMin}–${cart.etaMin + 10} phút`);
    parts.push(
      cart.distanceKm < 1
        ? `${Math.round(cart.distanceKm * 1000)} m`
        : `${cart.distanceKm.toFixed(1)} km`
    );
  }
  return parts;
};

export const buildCheckoutPayload = (cartId, cartVersion, fields = {}) => ({
  cartId,
  cartVersion,
  ...fields,
});
