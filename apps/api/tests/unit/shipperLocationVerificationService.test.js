import { describe, expect, it } from "vitest";
import {
  SHIPPER_PROXIMITY_METRES,
  requireShipperWithinMetres,
} from "../../services/shipperLocationVerificationService.js";

const profileAt = (lng, lat, ageMs = 0) => ({
  currentLocation: { coordinates: [lng, lat] },
  locationUpdatedAt: new Date(Date.now() - ageMs),
});

describe("requireShipperWithinMetres", () => {
  it("accepts a fresh point within 200 metres", () => {
    const latOffset = 199 / 111_111;
    expect(requireShipperWithinMetres({
      profile: profileAt(106.6844, 10.76952 + latOffset),
      target: { lat: 10.76952, lng: 106.6844 },
      message: "near restaurant",
    })).toEqual({ lat: 10.76952 + latOffset, lng: 106.6844 });
    expect(SHIPPER_PROXIMITY_METRES).toBe(200);
  });

  it("rejects a point farther than 200 metres", () => {
    expect(() => requireShipperWithinMetres({
      profile: profileAt(106.6844, 10.76952 + (250 / 111_111)),
      target: { lat: 10.76952, lng: 106.6844 },
      message: "near restaurant",
    })).toThrow("near restaurant");
  });

  it("rejects a stale GPS location", () => {
    expect(() => requireShipperWithinMetres({
      profile: profileAt(106.6844, 10.76952, 90_001),
      target: { lat: 10.76952, lng: 106.6844 },
      message: "near restaurant",
    })).toThrow("A live location updated within 90 seconds is required");
  });
});
