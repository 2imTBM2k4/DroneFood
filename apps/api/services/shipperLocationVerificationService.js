import AppError from "../utils/AppError.js";
import { haversineKm } from "../utils/distance.js";

export const LOCATION_STALE_MS = 90 * 1000;
export const SHIPPER_PROXIMITY_METRES = 200;

export const requireFreshShipperLocation = (profile) => {
  const [lng, lat] = profile?.currentLocation?.coordinates || [];
  const updatedAt = new Date(profile?.locationUpdatedAt);
  const fresh = Number.isFinite(updatedAt.getTime()) && Date.now() - updatedAt.getTime() <= LOCATION_STALE_MS;
  if (!fresh || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new AppError("A live location updated within 90 seconds is required", 409);
  }
  return { lat, lng };
};

export const requireShipperWithinMetres = ({ profile, target, message }) => {
  const origin = requireFreshShipperLocation(profile);
  if (!Number.isFinite(target?.lat) || !Number.isFinite(target?.lng)) {
    throw new AppError("Delivery location is unavailable", 409);
  }
  if (haversineKm(origin, target) * 1000 > SHIPPER_PROXIMITY_METRES) {
    throw new AppError(message, 409);
  }
  return origin;
};
