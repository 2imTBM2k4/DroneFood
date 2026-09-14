import { describe, expect, it } from "vitest";
import {
  calculateShippingQuote,
  computeOrderTotals,
  DRONE_RATE_PER_KM,
} from "../../config/fees.js";

describe("VND delivery pricing", () => {
  it("prices drone delivery in whole VND from crow-flight distance", async () => {
    const quote = await calculateShippingQuote({
      deliveryMethod: "drone",
      origin: { lat: 10.7769, lng: 106.7009 },
      destination: { lat: 10.7859, lng: 106.7009 },
    });

    expect(quote.currency).toBe("VND");
    expect(quote.distanceType).toBe("air");
    expect(quote.ratePerKm).toBe(DRONE_RATE_PER_KM);
    expect(quote.shippingPrice).toBe(Math.round(quote.billedDistanceKm * 7000));
  });

  it("adds a VND shipping quote without changing the food subtotal", () => {
    expect(computeOrderTotals(85000, 7000)).toEqual({
      subtotal: 85000,
      deliveryFee: 7000,
      serviceFee: 0,
      total: 92000,
    });
  });
});
