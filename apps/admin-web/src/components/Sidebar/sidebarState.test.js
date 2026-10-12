import assert from "node:assert/strict";
import test from "node:test";

const sidebarState = await import("./sidebarState.js").catch(() => ({
  readSidebarCollapsed: () => false,
  writeSidebarCollapsed: () => undefined,
}));

test("restores the collapsed sidebar state from storage", () => {
  const storage = { getItem: () => "true" };

  assert.equal(sidebarState.readSidebarCollapsed(storage), true);
});

test("treats every stored value except true as expanded", () => {
  const storage = { getItem: () => "false" };

  assert.equal(sidebarState.readSidebarCollapsed(storage), false);
});

test("persists sidebar state as a boolean string", () => {
  const writes = [];
  const storage = { setItem: (...args) => writes.push(args) };

  sidebarState.writeSidebarCollapsed(storage, true);

  assert.deepEqual(writes, [["admin-sidebar-collapsed", "true"]]);
});
