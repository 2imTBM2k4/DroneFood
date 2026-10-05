import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = path.resolve(process.cwd());

test("Task 5: Orders & Tracking Screens Architecture and Design System Adherence", async (t) => {
  const ordersScreenSrc = fs.readFileSync(
    path.join(ROOT, "src/screens/orders/OrdersScreen.tsx"),
    "utf8"
  );
  const completedOrderSrc = fs.readFileSync(
    path.join(ROOT, "src/screens/orders/CompletedOrderDetailScreen.tsx"),
    "utf8"
  );
  const shipperTrackingSrc = fs.readFileSync(
    path.join(ROOT, "src/screens/orders/ShipperTrackingScreen.tsx"),
    "utf8"
  );
  const droneTrackingSrc = fs.readFileSync(
    path.join(ROOT, "src/screens/orders/DroneTrackingScreen.tsx"),
    "utf8"
  );
  const telemetryHudSrc = fs.readFileSync(
    path.join(ROOT, "src/components/drone/DroneTelemetryHUD.tsx"),
    "utf8"
  );

  await t.test("OrdersScreen removes GlassSurface, uses flat cards, 44x44 actions, and review modal", () => {
    assert.ok(!ordersScreenSrc.includes("GlassSurface"), "OrdersScreen must not use GlassSurface");
    assert.ok(ordersScreenSrc.includes("minHeight: 44"), "Action buttons must meet >=44x44 touch targets");
    assert.ok(ordersScreenSrc.includes("OrderReviewModal"), "OrdersScreen must preserve OrderReviewModal");
    assert.ok(ordersScreenSrc.includes("onTrackOrder"), "OrdersScreen must preserve onTrackOrder handler");
  });

  await t.test("CompletedOrderDetailScreen removes GlassSurface, uses InfoRow and delivered badge", () => {
    assert.ok(!completedOrderSrc.includes("GlassSurface"), "CompletedOrderDetailScreen must not use GlassSurface");
    assert.ok(completedOrderSrc.includes("InfoRow"), "CompletedOrderDetailScreen must use InfoRow for bill breakdown");
    assert.ok(completedOrderSrc.includes("statusDeliveredBg"), "CompletedOrderDetailScreen must use statusDelivered token");
  });

  await t.test("ShipperTrackingScreen removes GlassSurface, integrates Timeline component and MapView", () => {
    assert.ok(!shipperTrackingSrc.includes("GlassSurface"), "ShipperTrackingScreen must not use GlassSurface");
    assert.ok(shipperTrackingSrc.includes("<Timeline"), "ShipperTrackingScreen must use Timeline component");
    assert.ok(shipperTrackingSrc.includes("deliveryMethod=\"shipper\""), "ShipperTrackingScreen Timeline must have deliveryMethod=shipper");
    assert.ok(shipperTrackingSrc.includes("MapView"), "ShipperTrackingScreen must preserve MapView");
  });

  await t.test("DroneTelemetryHUD strictly shows only Phase status and ETA (no speed, altitude, battery per user lock)", () => {
    assert.ok(!telemetryHudSrc.includes("GlassSurface"), "DroneTelemetryHUD must not use GlassSurface");
    assert.ok(!telemetryHudSrc.includes("altitudeMeters"), "DroneTelemetryHUD must not show altitude");
    assert.ok(!telemetryHudSrc.includes("speedKmh"), "DroneTelemetryHUD must not show speed");
    assert.ok(!telemetryHudSrc.includes("batteryPercent"), "DroneTelemetryHUD must not show battery");
    assert.ok(telemetryHudSrc.includes("calculateDroneEtaMinutes"), "DroneTelemetryHUD must use calculateDroneEtaMinutes");
  });

  await t.test("DroneTrackingScreen removes GlassSurface, uses Timeline, DroneTelemetryHUD, and CargoUnlockModal", () => {
    assert.ok(!droneTrackingSrc.includes("GlassSurface"), "DroneTrackingScreen must not use GlassSurface");
    assert.ok(droneTrackingSrc.includes("<Timeline"), "DroneTrackingScreen must use Timeline component");
    assert.ok(droneTrackingSrc.includes("DroneTelemetryHUD"), "DroneTrackingScreen must use DroneTelemetryHUD");
    assert.ok(droneTrackingSrc.includes("CargoUnlockModal"), "DroneTrackingScreen must preserve CargoUnlockModal");
    assert.ok(droneTrackingSrc.includes("onCancelOrder"), "DroneTrackingScreen must preserve onCancelOrder");
  });
});
