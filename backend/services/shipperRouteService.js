import AppError from "../utils/AppError.js";
import { haversineKm } from "../utils/distance.js";

export const ROUTE_REFRESH_DISTANCE_METRES = 100;
export const ROUTE_REFRESH_MAX_AGE_MS = 30 * 1000;

const isCoordinate = (point) => Number.isFinite(point?.lat) && Number.isFinite(point?.lng) &&
  Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180;

const isGeometry = (geometry) => Array.isArray(geometry) && geometry.length >= 2 && geometry.every(
  ([lng, lat]) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
);

const isRouteSnapshot = (route) => isCoordinate(route?.origin) && isGeometry(route?.geometry) &&
  Number.isFinite(route?.durationSeconds) && route.durationSeconds >= 0 && route?.generatedAt;

export const shouldRefreshLiveRoute = (route, origin, now = new Date()) => {
  if (!isCoordinate(origin) || !isRouteSnapshot(route)) return true;

  const generatedAt = new Date(route.generatedAt);
  if (!Number.isFinite(generatedAt.getTime())) return true;
  if (now.getTime() - generatedAt.getTime() >= ROUTE_REFRESH_MAX_AGE_MS) return true;

  return haversineKm(route.origin, origin) * 1000 >= ROUTE_REFRESH_DISTANCE_METRES;
};

const reportFailure = (onFailure, event) => {
  try { onFailure(event); } catch {}
};

export const fetchLiveShipperRoute = async ({ origin, destination, fetchImpl = fetch, now = new Date(), onFailure = () => {} }) => {
  if (!isCoordinate(origin) || !isCoordinate(destination)) {
    throw new AppError("Cannot calculate live shipper route: invalid coordinates", 400);
  }

  const key = process.env.TRACKASIA_KEY;
  if (!key) throw new AppError("Cannot calculate live shipper route: map service is unavailable", 503);

  const coordinates = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  const url = new URL(`https://maps.track-asia.com/directions/v5/moto/${encodeURIComponent(coordinates)}.json`);
  url.searchParams.set("geometries", "geojson");
  url.searchParams.set("overview", "full");
  url.searchParams.set("key", key);

  let response;
  try {
    response = await fetchImpl(url, { signal: AbortSignal.timeout(8000) });
  } catch (error) {
    reportFailure(onFailure, { category: "network" });
    throw new AppError("Cannot calculate live shipper route: map service is unavailable", 503);
  }

  if (!response.ok) {
    reportFailure(onFailure, { category: "http", httpStatus: response.status });
    throw new AppError("Cannot calculate live shipper route: map service is unavailable", 503);
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    reportFailure(onFailure, { category: "invalid_response" });
    throw new AppError("Cannot calculate live shipper route: map service is unavailable", 503);
  }

  const selectedRoute = payload?.routes?.[0];
  const geometry = selectedRoute?.geometry?.coordinates;
  if (!isGeometry(geometry) || !Number.isFinite(selectedRoute?.duration) || selectedRoute.duration < 0) {
    reportFailure(onFailure, { category: "invalid_response" });
    throw new AppError("Cannot calculate live shipper route: map service is unavailable", 503);
  }

  return {
    origin: { lat: origin.lat, lng: origin.lng },
    geometry: geometry.map(([lng, lat]) => [lng, lat]),
    durationSeconds: Math.ceil(selectedRoute.duration),
    generatedAt: now,
  };
};
