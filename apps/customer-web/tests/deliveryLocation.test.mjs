import assert from "node:assert/strict";
import test from "node:test";
import {
  CURRENT_LOCATION_ID,
  resolveDeliveryCoordinates,
} from "../src/lib/deliveryLocation.js";

const user = {
  address: { lat: 10.1, lng: 106.1 },
  addressBook: [
    { id: "home", lat: 10.2, lng: 106.2 },
    { _id: "work", lat: 10.3, lng: 106.3 },
  ],
};

test("selected navbar address takes precedence over live GPS", () => {
  assert.deepEqual(
    resolveDeliveryCoordinates({
      user,
      restaurantLocationId: "work",
      liveLocation: { lat: 10.4, lng: 106.4 },
    }),
    { lat: 10.3, lng: 106.3 }
  );
});

test("current-location option uses live GPS", () => {
  assert.deepEqual(
    resolveDeliveryCoordinates({
      user,
      restaurantLocationId: CURRENT_LOCATION_ID,
      liveLocation: { lat: 10.4, lng: 106.4 },
    }),
    { lat: 10.4, lng: 106.4 }
  );

  assert.deepEqual(
    resolveDeliveryCoordinates({
      user,
      restaurantLocationId: CURRENT_LOCATION_ID,
      liveLocation: null,
    }),
    { lat: 10.1, lng: 106.1 }
  );
});

test("unknown saved selection falls back safely", () => {
  assert.deepEqual(
    resolveDeliveryCoordinates({
      user,
      restaurantLocationId: "missing",
      liveLocation: { lat: 10.4, lng: 106.4 },
    }),
    { lat: 10.4, lng: 106.4 }
  );
});
