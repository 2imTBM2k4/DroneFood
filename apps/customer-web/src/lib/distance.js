// Distance + delivery-time helpers for ranking restaurants near the customer.

// How far we'll look for restaurants. One radius covers both cases: a small
// province's whole town fits inside it, while in a big city it keeps the list
// to genuinely nearby places. Shared so every surface agrees.
export const NEARBY_RADIUS_KM = 15;

const EARTH_RADIUS_KM = 6371;
const toRad = (deg) => (deg * Math.PI) / 180;

// Great-circle distance between two {lat, lng} points, in kilometres.
export function haversineKm(a, b) {
  if (
    !a ||
    !b ||
    typeof a.lat !== "number" ||
    typeof a.lng !== "number" ||
    typeof b.lat !== "number" ||
    typeof b.lng !== "number"
  ) {
    return null;
  }

  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

// Rough delivery estimate: a fixed prep window plus drone travel time.
// ~10 min to prepare + ~2 min per km (≈30 km/h door-to-door).
export function estimateEtaMinutes(distanceKm) {
  if (typeof distanceKm !== "number") return null;
  return Math.max(10, Math.round(10 + distanceKm * 2));
}

// "800 m" under a kilometre, otherwise "3.2 km".
export function formatDistance(distanceKm) {
  if (typeof distanceKm !== "number") return "";
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m`;
  return `${distanceKm.toFixed(1)} km`;
}

// Fallback when the customer's location is unknown: is this address in one of
// the major cities we default to (Hanoi / Ho Chi Minh City)?
export function isMajorCityAddress(address = "") {
  const s = address.toLowerCase();
  return (
    s.includes("hồ chí minh") ||
    s.includes("ho chi minh") ||
    s.includes("hcm") ||
    s.includes("sài gòn") ||
    s.includes("sai gon") ||
    s.includes("tp.hcm") ||
    s.includes("hà nội") ||
    s.includes("ha noi") ||
    s.includes("hanoi")
  );
}
