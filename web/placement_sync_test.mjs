import assert from "node:assert/strict";
import test from "node:test";
import { applyPlacements, placementChanges, TopologyWriteQueue } from "./static/js/placement-sync.js";
import { AutosaveController } from "./static/js/autosave.js";

const snapshot = () => ({ id: "map", revision: 1, devices: [{ id: "device", name: "Original", positionX: 100, positionY: 100, ports: [{ id: "port" }] }], racks: [{ id: "rack", positionX: 500, positionY: 500 }] });

test("placement rebasing preserves remote inventory and unrelated edits", () => {
  const before = snapshot();
  const changes = placementChanges(before, "devices", [{ ...before.devices[0], positionX: 200 }]);
  const remote = snapshot();
  remote.revision = 9; remote.devices[0].name = "Remote name"; remote.devices[0].ports.push({ id: "new-port" });
  remote.racks[0].positionY = 700;
  const merged = applyPlacements(remote, changes, { checkConflicts: true });
  assert.equal(merged.devices[0].positionX, 200);
  assert.equal(merged.devices[0].name, "Remote name");
  assert.deepEqual(merged.devices[0].ports, remote.devices[0].ports);
  assert.equal(merged.racks[0].positionY, 700);
  assert.equal(merged.revision, 9);
  assert.equal(remote.devices[0].positionX, 100);
  assert.deepEqual(applyPlacements(merged, changes, { checkConflicts: true }), merged);
});

test("competing placements and deletions are not silently overwritten", () => {
  const before = snapshot();
  const changes = placementChanges(before, "devices", [{ ...before.devices[0], positionY: 200 }]);
  const moved = snapshot(); moved.devices[0].positionX = 500;
  assert.throws(() => applyPlacements(moved, changes, { checkConflicts: true }), /moved in another session/);
  assert.throws(() => applyPlacements({ ...moved, devices: [] }, changes, { checkConflicts: true }), /removed/);
  assert.deepEqual(applyPlacements({ ...moved, devices: [] }, changes).devices, []);
});

test("rack moves and legacy mounting defaults capture only actual placement changes", () => {
  const before = snapshot();
  assert.deepEqual(placementChanges(before, "devices", before.devices), []);
  assert.deepEqual(placementChanges(before, "devices", [{ id: "unknown" }]), []);
  const rackChanges = placementChanges(before, "racks", [{ ...before.racks[0], positionX: 600 }]);
  assert.equal(applyPlacements(before, rackChanges, { checkConflicts: true }).racks[0].positionX, 600);
  before.devices[0].rackId = "rack"; before.devices[0].rackUnit = 2;
  const next = { ...before.devices[0], rackFace: "front" };
  assert.deepEqual(placementChanges(before, "devices", [next]), []);
});

test("queued writes wait for response handling and recover after rejection", async () => {
  const queue = new TopologyWriteQueue();
  const order = [];
  let release;
  const first = queue.run(async () => { order.push("first"); await new Promise((resolve) => { release = resolve; }); throw new Error("conflict"); });
  const second = queue.run(() => { order.push("second"); return 2; });
  await Promise.resolve();
  assert.deepEqual(order, ["first"]);
  release();
  await assert.rejects(first, /conflict/);
  assert.equal(await second, 2);
  await queue.tail;
  assert.equal(queue.pending, 0);
  assert.deepEqual(order, ["first", "second"]);
});

test("deferring autosave during a drag retains the unsaved flag", async () => {
  let dragging = true;
  const autosave = new AutosaveController(async () => !dragging, { storage: { getItem: () => null } });
  try {
    autosave.markDirty();
    assert.equal(await autosave.flush(), false);
    assert.equal(autosave.isDirty, true);
    assert.equal(autosave.isSaving, false);
    dragging = false;
    assert.equal(await autosave.flush(), true);
    assert.equal(autosave.isDirty, false);
  } finally { autosave.destroy(); }
});
