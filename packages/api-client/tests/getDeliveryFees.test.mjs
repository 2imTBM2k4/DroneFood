import assert from "node:assert/strict";
import test from "node:test";

import { DroneFoodApiClient } from "../dist/index.js";

test("getDeliveryFees reads the backend's top-level fee response", async () => {
  let requestedUrl;
  const client = new DroneFoodApiClient({
    baseUrl: "https://api.drone-food.test/",
    fetchImplementation: async (url) => {
      requestedUrl = url;
      return new Response(
        JSON.stringify({
          success: true,
          shipperRatePerKm: 5000,
          droneRatePerKm: 7000,
          currency: "VND",
          serviceFee: 0,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    },
  });

  const fees = await client.getDeliveryFees();

  assert.equal(requestedUrl, "https://api.drone-food.test/api/config/fees");
  assert.deepEqual(fees, {
    shipperRatePerKm: 5000,
    droneRatePerKm: 7000,
    currency: "VND",
    serviceFee: 0,
  });
});

test("existing API methods still unwrap data envelopes", async () => {
  const entries = [{ id: "address-1" }];
  const client = new DroneFoodApiClient({
    baseUrl: "https://api.drone-food.test",
    fetchImplementation: async () =>
      new Response(JSON.stringify({ success: true, data: entries }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
  });

  assert.deepEqual(await client.listAddressBook(), entries);
});
