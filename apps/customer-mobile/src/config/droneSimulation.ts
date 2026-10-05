/**
 * Drone simulation constants and helper utilities.
 * 
 * NOTE: These are temporary simulation parameters used while physical drone telemetry
 * stream is not yet connected to the mobile client.
 */

export const DRONE_SIMULATION = {
  /** Simulated cruise speed in km/h */
  CRUISE_SPEED_KMH: 50,
  /** Simulated cruise altitude in meters */
  CRUISE_ALTITUDE_METERS: 120,
} as const;

/**
 * Calculates estimated flight time in minutes based on distance and 50 km/h speed.
 * Formula: (deliveryDistanceKm / 50) * 60 (minutes)
 * 
 * @param distanceKm Distance between restaurant and customer drop-off point in km.
 * @returns Estimated minutes as integer (minimum 1 minute if distance > 0), or null if invalid.
 */
export const calculateDroneEtaMinutes = (distanceKm?: number | null): number | null => {
  if (typeof distanceKm !== "number" || !Number.isFinite(distanceKm) || distanceKm <= 0) {
    return null;
  }
  return Math.max(1, Math.round((distanceKm / DRONE_SIMULATION.CRUISE_SPEED_KMH) * 60));
};
