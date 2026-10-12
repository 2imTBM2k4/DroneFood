import test from "node:test";
import assert from "node:assert/strict";

test("sortTimeSeries orders ISO timestamps from oldest to newest", async () => {
  const module = await import("./dashboardData.js").catch(() => ({}));

  assert.equal(typeof module.sortTimeSeries, "function");
  assert.deepEqual(
    module.sortTimeSeries([
      { timestamp: "2026-08-18T00:00:00.000Z", value: 3 },
      { timestamp: "2025-11-24T00:00:00.000Z", value: 2 },
      { timestamp: "2025-11-13T00:00:00.000Z", value: 1 },
    ]),
    [
      { timestamp: "2025-11-13T00:00:00.000Z", value: 1 },
      { timestamp: "2025-11-24T00:00:00.000Z", value: 2 },
      { timestamp: "2026-08-18T00:00:00.000Z", value: 3 },
    ]
  );
});

test("mergeTrendSeries joins GMV and completed orders by date", async () => {
  const { mergeTrendSeries } = await import("./dashboardData.js");

  assert.equal(typeof mergeTrendSeries, "function");
  assert.deepEqual(
    mergeTrendSeries(
      [
        { timestamp: "2026-10-08T00:00:00.000Z", value: 1800000 },
        { timestamp: "2026-10-07T00:00:00.000Z", value: 1200000 },
      ],
      [
        { timestamp: "2026-10-07T00:00:00.000Z", value: 12 },
        { timestamp: "2026-10-09T00:00:00.000Z", value: 18 },
      ]
    ),
    [
      {
        timestamp: "2026-10-07T00:00:00.000Z",
        gmv: 1200000,
        completedOrders: 12,
      },
      {
        timestamp: "2026-10-08T00:00:00.000Z",
        gmv: 1800000,
        completedOrders: 0,
      },
      {
        timestamp: "2026-10-09T00:00:00.000Z",
        gmv: 0,
        completedOrders: 18,
      },
    ]
  );
});

test("getDualAxisConfig pads both scales into five readable ticks", async () => {
  const { getDualAxisConfig } = await import("./dashboardData.js");

  assert.equal(typeof getDualAxisConfig, "function");
  assert.deepEqual(
    getDualAxisConfig([
      { gmv: 3400000, completedOrders: 29 },
      { gmv: 2100000, completedOrders: 18 },
    ]),
    {
      gmvDomain: [0, 4000000],
      ordersDomain: [0, 32],
      tickCount: 5,
    }
  );
});

test("dashboard contract exposes the API filter values", async () => {
  const { dashboardPeriods, dashboardRegions } = await import("./dashboardContract.js");

  assert.deepEqual(dashboardPeriods.map((item) => item.value), ["today", "7d", "30d"]);
  assert.ok(dashboardRegions.some((item) => item.value === "district-1"));
});
