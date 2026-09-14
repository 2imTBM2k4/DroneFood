import AppError from "./AppError.js";

const EARTH_RADIUS_KM = 6371;
const toRadians = (degrees) => (degrees * Math.PI) / 180;

/** Calculate straight-line distance between two latitude/longitude points. */
export const haversineKm = (origin, destination) => {
  const latDelta = toRadians(destination.lat - origin.lat);
  const lngDelta = toRadians(destination.lng - origin.lng);
  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(toRadians(origin.lat)) * Math.cos(toRadians(destination.lat)) * Math.sin(lngDelta / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/** Fetch motorbike route distance from TrackAsia for shipper pricing. */
export const getRoadDistanceKm = async (origin, destination) => {
  const key = process.env.TRACKASIA_KEY;
  if (!key) {
    throw new AppError("TRACKASIA_KEY is required to price shipper delivery.", 503);
  }

  const coordinates = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  const url = new URL(`https://maps.track-asia.com/distance-matrix/v1/moto/${coordinates}`);
  url.searchParams.set("annotations", "distance");
  url.searchParams.set("sources", "0");
  url.searchParams.set("destinations", "1");
  url.searchParams.set("key", key);

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`TrackAsia responded ${response.status}`);
    const payload = await response.json();
    const metres = payload?.distances?.[0]?.[0];
    if (!Number.isFinite(metres) || metres < 0) {
      throw new Error("TrackAsia did not return a route distance");
    }
    return metres / 1000;
  } catch (error) {
    throw new AppError(`Cannot calculate shipper route distance: ${error.message}`, 503);
  }
};
