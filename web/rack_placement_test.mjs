import assert from "node:assert/strict";
import test from "node:test";
import { planRackReplacement } from "./static/js/rack-placement.js";
import { applyPlacements } from "./static/js/placement-sync.js";

const device = (id, rackUnit, unitsU = 1, rackFace = "front") => ({
  id, name: id, rackId: rackUnit ? "rack" : "", rackUnit, rackFace,
  positionX: 100, positionY: 100, faceplate: { unitsU }, ports: [],
});
const topology = (devices) => ({ devices, racks: [{ id: "rack", name: "Rack", heightU: 6, positionX: 900, positionY: 100 }] });

test("a partial overlap releases every occupied device but preserves adjacent and opposite-face mounts", () => {
  const source = device("source", 0, 3);
  const before = topology([source, device("first", 2, 2), device("second", 4), device("adjacent", 5), device("rear", 3, 1, "rear")]);
  const original = structuredClone(before);
  const plan = planRackReplacement(before, [{ ...source, rackId: "rack", rackUnit: 2 }]);
  assert.deepEqual(before, original);
  assert.deepEqual(plan.displaced.map((item) => item.id), ["first", "second"]);
  const after = applyPlacements(before, plan.changes);
  assert.equal(after.devices[0].rackUnit, 2);
  assert.ok(after.devices.slice(1, 3).every((item) => item.rackId === "" && item.rackUnit === 0 && item.rackFace === ""));
  assert.ok(after.devices[2].positionY > after.devices[1].positionY + 200);
  assert.deepEqual(after.devices.slice(3), original.devices.slice(3));
});

test("a multi-device drop can use a selected device's vacated range", () => {
  const first = device("first", 1), second = device("second", 2), occupied = device("occupied", 3);
  const before = topology([first, second, occupied]);
  const plan = planRackReplacement(before, [{ ...first, rackUnit: 2 }, { ...second, rackUnit: 3 }]);
  assert.deepEqual(plan.displaced.map((item) => item.id), ["occupied"]);
  assert.deepEqual(applyPlacements(before, plan.changes).devices.map((item) => item.rackUnit), [2, 3, 0]);
});

test("confirmation cannot force an oversized or internally overlapping multi-device drop", () => {
  const first = device("first", 0), second = device("second", 0);
  const before = topology([first, second]);
  assert.throws(() => planRackReplacement(before, [{ ...first, rackId: "rack", rackUnit: 7 }]), /do not fit/);
  assert.throws(() => planRackReplacement(before, [first, second].map((item) => ({ ...item, rackId: "rack", rackUnit: 2 }))), /do not fit/);
});
