import { getRoadDistanceKm, haversineKm } from "../utils/distance.js";
import AppError from "../utils/AppError.js";

export const SHIPPER_RATE_PER_KM = 5000;
export const DRONE_RATE_PER_KM = 7000;
export const SERVICE_FEE = 0;

const assertCoordinates = (point, label) => {
  if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lng)) {
    throw new AppError(`${label} requires valid map coordinates.`, 400);
  }
};

const billableKilometres = (distanceKm) => Math.ceil(distanceKm * 1000) / 1000;

export const getDeliveryRates = () => ({
  shipperRatePerKm: SHIPPER_RATE_PER_KM,
  droneRatePerKm: DRONE_RATE_PER_KM,
  currency: "VND",
  serviceFee: SERVICE_FEE,
});

export const calculateShippingQuote = async ({ deliveryMethod, origin, destination }) => {
  assertCoordinates(origin, "Restaurant location");
  assertCoordinates(destination, "Delivery location");

  let distanceKm;
  let ratePerKm;
  let distanceType;

  if (deliveryMethod === "drone") {
    distanceKm = haversineKm(origin, destination);
    ratePerKm = DRONE_RATE_PER_KM;
    distanceType = "air";
  } else if (deliveryMethod === "shipper") {
    // A pickup and drop-off at the exact same coordinates costs no road
    // distance and does not require an external routing lookup.
    distanceKm = origin.lat === destination.lat && origin.lng === destination.lng
      ? 0
      : await getRoadDistanceKm(origin, destination);
    ratePerKm = SHIPPER_RATE_PER_KM;
    distanceType = "road";
  } else {
    throw new AppError("Delivery method must be shipper or drone.", 400);
  }

  const billedDistanceKm = billableKilometres(distanceKm);
  return {
    deliveryMethod,
    distanceKm,
    billedDistanceKm,
    distanceType,
    ratePerKm,
    shippingPrice: Math.round(billedDistanceKm * ratePerKm),
    currency: "VND",
  };
};

export const computeOrderTotals = (subtotal, shippingPrice) => {
  if (!Number.isFinite(subtotal) || subtotal < 0) {
    throw new AppError("Invalid subtotal.", 400);
  }
  if (!Number.isFinite(shippingPrice) || shippingPrice < 0) {
    throw new AppError("Invalid shipping price.", 400);
  }
  const serviceFee = subtotal > 0 ? SERVICE_FEE : 0;
  return { subtotal, deliveryFee: shippingPrice, serviceFee, total: subtotal + shippingPrice + serviceFee };
};
