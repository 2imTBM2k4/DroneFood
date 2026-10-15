const crypto = require("crypto");
const mongoose = require("mongoose");

/** Preserve the deterministic MAIN identifier used by the multi-branch migration. */
const deriveBranchId = (restaurantId) => new mongoose.Types.ObjectId(
  crypto.createHash("sha256").update(`multi-branch-restaurant-v1:${String(restaurantId?._id || restaurantId)}:MAIN`).digest("hex").slice(0, 24)
);

const mapLegacyStatus = (restaurant) => ({
  merchantStatus: "active",
  branchStatus: restaurant?.isLocked === true ? "locked" : "active",
});

const normalizeOperatingHours = (restaurant) => {
  if (Array.isArray(restaurant?.operatingHours)) {
    return restaurant.operatingHours.map(({ day, open, close }) => ({ day, open, close }));
  }
  const open = restaurant?.openingHours?.openTime;
  const close = restaurant?.openingHours?.closeTime;
  if (!open || !close) return [];
  return Array.from({ length: 7 }, (_, day) => ({ day, open, close }));
};

const finiteCoordinate = (value, max) => Number.isFinite(value) && Math.abs(value) <= max;
const buildAddress = (restaurant) => {
  const lat = restaurant?.address?.lat ?? restaurant?.lat;
  const lng = restaurant?.address?.lng ?? restaurant?.lng;
  return {
    text: typeof restaurant?.address === "string" ? restaurant.address : restaurant?.address?.text || restaurant?.address?.address || "",
    lat: finiteCoordinate(lat, 90) ? lat : null,
    lng: finiteCoordinate(lng, 180) ? lng : null,
    geocodedAt: restaurant?.address?.geocodedAt || null,
  };
};
const buildLocation = (restaurant) => {
  const lat = restaurant?.address?.lat ?? restaurant?.lat;
  const lng = restaurant?.address?.lng ?? restaurant?.lng;
  if (!finiteCoordinate(lat, 90) || !finiteCoordinate(lng, 180)) return undefined;
  return { type: "Point", coordinates: [lng, lat] };
};

const buildMerchantDocument = (restaurant, slug) => ({
  _id: restaurant._id, type: "individual", name: restaurant.name, slug,
  logoUrl: restaurant.logoUrl || restaurant.image || "", coverUrl: restaurant.coverUrl || "", description: restaurant.description || "",
  ownerUserId: restaurant.owner, status: "active", approvedBy: restaurant.approvedBy || null,
  approvedAt: restaurant.approvedAt || restaurant.createdAt || new Date(), rejectReason: "",
  revenueShare: { merchant: 0.8, platform: 0.2 }, branchCount: 1, legacyRestaurantId: restaurant._id,
  createdAt: restaurant.createdAt || new Date(), updatedAt: restaurant.updatedAt || new Date(),
});
const buildBranchDocument = (restaurant, merchantId, branchId) => {
  const location = buildLocation(restaurant);
  return {
    _id: branchId, merchantId, name: "Chi nhánh chính", code: "MAIN", address: buildAddress(restaurant),
    ...(location ? { location } : {}), phone: restaurant.phone || "", operatingHours: normalizeOperatingHours(restaurant),
    isOpen: restaurant.isOpen === true, status: mapLegacyStatus(restaurant).branchStatus,
    images: Array.isArray(restaurant.images) ? restaurant.images : [restaurant.image].filter(Boolean),
    managerUserIds: [], deliveryRadiusKm: restaurant.deliveryRadiusKm ?? null,
    createdAt: restaurant.createdAt || new Date(), updatedAt: restaurant.updatedAt || new Date(),
  };
};

module.exports = { deriveBranchId, mapLegacyStatus, normalizeOperatingHours, buildAddress, buildLocation, buildMerchantDocument, buildBranchDocument };
