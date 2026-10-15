import assert from "node:assert/strict";
import test from "node:test";
const rules = await import("./droneDelivery.js").catch(() => ({ applicationState: () => ({}) }));

test("an old enabled flag without approval never shows enabled service", () => {
  assert.deepEqual(rules.applicationState({ droneDeliveryEnabled: true }), { status: "not_registered", canSubmit: true, canToggle: false, enabled: false });
});
test("pending application is read-only and cannot enable service", () => {
  assert.deepEqual(rules.applicationState({ droneDeliveryApplication: { status: "pending" } }), { status: "pending", canSubmit: false, canToggle: false, enabled: false });
});
test("rejected application can be corrected but cannot enable service", () => {
  assert.deepEqual(rules.applicationState({ droneDeliveryApplication: { status: "rejected" } }), { status: "rejected", canSubmit: true, canToggle: false, enabled: false });
});
test("approved application enables the independent operation switch, not editing", () => {
  assert.deepEqual(rules.applicationState({ droneDeliveryApplication: { status: "approved" }, droneDeliveryEnabled: false }), { status: "approved", canSubmit: false, canToggle: true, enabled: false });
  assert.equal(rules.applicationState({ droneDeliveryApplication: { status: "approved" }, droneDeliveryEnabled: true }).enabled, true);
});
