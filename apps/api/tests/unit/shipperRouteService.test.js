import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ROUTE_REFRESH_DISTANCE_METRES,
  ROUTE_REFRESH_MAX_AGE_MS,
  fetchLiveShipperRoute,
  shouldRefreshLiveRoute,
} from "../../services/shipperRouteService.js";

const originalKey = process.env.TRACKASIA_KEY;
const origin = { lat: 10.7769, lng: 106.7009 };
const destination = { lat: 10.78, lng: 106.705 };
const route = (overrides = {}) => ({
  origin,
  geometry: [[106.7009, 10.7769], [106.7012, 10.7772]],
  durationSeconds: 240,
  generatedAt: new Date("2026-09-17T08:00:00.000Z"),
  ...overrides,
});

beforeEach(() => {
  process.env.TRACKASIA_KEY = "test-key";
});

afterEach(() => {
  if (originalKey === undefined) delete process.env.TRACKASIA_KEY;
  else process.env.TRACKASIA_KEY = originalKey;
});

describe("shouldRefreshLiveRoute", () => {
  it("refreshes when no usable snapshot exists", () => {
    expect(shouldRefreshLiveRoute(null, origin, new Date("2026-09-17T08:00:01.000Z"))).toBe(true);
  });

  it("does not refresh below the distance and age thresholds", () => {
    expect(shouldRefreshLiveRoute(route(), { lat: 10.777, lng: 106.7009 }, new Date("2026-09-17T08:00:10.000Z"))).toBe(false);
  });

  it("refreshes when origin movement reaches the threshold", () => {
    const movedNorth = { lat: origin.lat + (ROUTE_REFRESH_DISTANCE_METRES / 111_111), lng: origin.lng };
    expect(shouldRefreshLiveRoute(route(), movedNorth, new Date("2026-09-17T08:00:10.000Z"))).toBe(true);
  });

  it("refreshes when snapshot age reaches the maximum", () => {
    expect(shouldRefreshLiveRoute(route(), origin, new Date("2026-09-17T08:00:29.999Z"))).toBe(false);
    expect(shouldRefreshLiveRoute(route(), origin, new Date("2026-09-17T08:00:30.000Z"))).toBe(true);
    expect(ROUTE_REFRESH_MAX_AGE_MS).toBe(30_000);
  });
});

describe("fetchLiveShipperRoute", () => {
  it("normalizes the selected TrackAsia motorbike route", async () => {
    let requestedUrl;
    const fetchImpl = async (url) => {
      requestedUrl = String(url);
      return new Response(JSON.stringify({
        routes: [{
          geometry: { coordinates: [[106.7012, 10.7784], [106.702, 10.779]] },
          duration: 481.4,
        }],
      }), { status: 200, headers: { "content-type": "application/json" } });
    };

    await expect(fetchLiveShipperRoute({
      origin: { lat: 10.7784, lng: 106.7012 },
      destination,
      fetchImpl,
      now: new Date("2026-09-17T08:00:00.000Z"),
    })).resolves.toEqual({
      origin: { lat: 10.7784, lng: 106.7012 },
      geometry: [[106.7012, 10.7784], [106.702, 10.779]],
      durationSeconds: 482,
      generatedAt: new Date("2026-09-17T08:00:00.000Z"),
    });

    expect(requestedUrl).toContain("directions/v5/moto/");
    expect(requestedUrl).toContain("geometries=geojson");
    expect(requestedUrl).toContain("overview=full");
    expect(requestedUrl).toContain("key=test-key");
  });

  it("rejects malformed provider routes", async () => {
    await expect(fetchLiveShipperRoute({
      origin,
      destination,
      fetchImpl: async () => new Response(JSON.stringify({ routes: [] }), { status: 200 }),
    })).rejects.toThrow("Cannot calculate live shipper route");
  });

  it("reports a sanitized TrackAsia failure without exposing credentials or coordinates", async () => {
    const diagnostics = [];
    await expect(fetchLiveShipperRoute({
      origin: { lat: 10.7784, lng: 106.7012 },
      destination,
      fetchImpl: async () => new Response("unauthorized", { status: 401 }),
      onFailure: (event) => diagnostics.push(event),
    })).rejects.toThrow("Cannot calculate live shipper route");

    expect(diagnostics).toEqual([{ category: "http", httpStatus: 401 }]);
    expect(JSON.stringify(diagnostics)).not.toContain("test-key");
    expect(JSON.stringify(diagnostics)).not.toContain("106.7012");
  });
});
