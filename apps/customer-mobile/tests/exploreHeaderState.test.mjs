import assert from "node:assert/strict";
import test from "node:test";
import {
  clampExploreHeaderProgress,
  exploreHeaderMetrics,
} from "../src/screens/home/exploreHeaderState.ts";

test("clamps overscroll and deep scroll", () => {
  assert.equal(clampExploreHeaderProgress(-40), 0);
  assert.equal(clampExploreHeaderProgress(0), 0);
  assert.equal(clampExploreHeaderProgress(96), 1);
  assert.equal(clampExploreHeaderProgress(500), 1);
});

test("compacts without crossing touch-size minimums", () => {
  const end = exploreHeaderMetrics(1, true);
  assert.ok(end.locationMinHeight >= 52);
  assert.ok(end.controlMinHeight >= 44);
  assert.equal(end.backgroundColor, "#F8FAFC");
});
