import assert from "node:assert/strict";
import { instantiatePatchPanel, planPatchPanelMapping } from "./static/js/patch-panels.js";

function identifiedPanel(name, count, id) {
  const panel = instantiatePatchPanel({ name, portCount: count, color: "#262d2f" }, { x: 0, y: 0 });
  panel.id = id;
  panel.ports.forEach((port, index) => {
    port.id = `${id}-port-${index + 1}`;
    port.deviceId = id;
  });
  return panel;
}

for (const [count, units, rows] of [[12, 1, 1], [24, 1, 1], [48, 1, 2], [96, 2, 4]]) {
  const panel = identifiedPanel(`PANEL ${count}`, count, `panel-${count}`);
  assert.equal(panel.category, "PatchPanel");
  assert.equal(panel.ports.length, count);
  assert.equal(panel.faceplate.unitsU, units);
  assert.equal(panel.faceplate.rows, rows);
  assert.ok(panel.ports.every((port) => port.mode === "Unconfigured" && port.nativeVlan === 0));
  assert.deepEqual(panel.ports.map((port) => port.label), Array.from({ length: count }, (_, index) => String(index + 1)));
}

const source = identifiedPanel("PATCH A", 24, "panel-a");
const target = identifiedPanel("PATCH B", 24, "panel-b");
const topology = { devices: [source, target], links: [] };
const plan = planPatchPanelMapping(topology, {
  sourceDeviceId: source.id, sourceStart: 7, sourceEnd: 10,
  targetDeviceId: target.id, targetStart: 1,
});
assert.equal(plan.targetEnd, 4);
assert.equal(plan.links.length, 4);
assert.deepEqual(plan.sourcePorts.map((port) => port.label), ["7", "8", "9", "10"]);
assert.deepEqual(plan.targetPorts.map((port) => port.label), ["1", "2", "3", "4"]);
assert.deepEqual(plan.links.map((link) => [link.sourcePortId, link.targetPortId]), [
  ["panel-a-port-7", "panel-b-port-1"],
  ["panel-a-port-8", "panel-b-port-2"],
  ["panel-a-port-9", "panel-b-port-3"],
  ["panel-a-port-10", "panel-b-port-4"],
]);

assert.throws(() => planPatchPanelMapping({
  devices: [source, target],
  links: [{ id: "occupied", sourcePortId: "panel-a-port-8", targetPortId: "panel-b-port-20" }],
}, {
  sourceDeviceId: source.id, sourceStart: 7, sourceEnd: 10,
  targetDeviceId: target.id, targetStart: 1,
}), /Already connected: PATCH A \/ 8/);

assert.throws(() => planPatchPanelMapping(topology, {
  sourceDeviceId: source.id, sourceStart: 20, sourceEnd: 24,
  targetDeviceId: target.id, targetStart: 22,
}), /does not have ports 22–26/);

console.log("patch panel range mapping checks passed");
