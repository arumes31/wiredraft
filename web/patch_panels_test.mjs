import assert from "node:assert/strict";
import { catalogVendors, modelsForVendor, patchPanelProfiles } from "./static/js/catalog.js";
import {
  availablePatchPanelPorts, instantiatePatchPanel, isRearPanelLink, planPatchPanelMapping, RearPanelLinkVisual,
} from "./static/js/patch-panels.js";

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
assert.ok(plan.links.every((link) => link.sourceSide === "rear" && link.targetSide === "rear" && isRearPanelLink(link)));
assert.ok(RearPanelLinkVisual.strokeWidth < 2 && RearPanelLinkVisual.opacity >= .7 && RearPanelLinkVisual.opacity <= .8,
  "rear panel maps must remain thin while meeting the 70–80% structured-wiring opacity range");
assert.deepEqual(RearPanelLinkVisual.dash, [6, 4], "backend links must use the dedicated 6/4 dash signature");
assert.equal(isRearPanelLink({ sourceSide: "rear", targetSide: "front" }), true,
  "a run with either endpoint on the rear plane is backend infrastructure");
assert.equal(isRearPanelLink({ sourceSide: "front", targetSide: "front" }), false);

const frontCableDoesNotBlockRear = planPatchPanelMapping({
  devices: [source, target],
  links: [{
    id: "front-cable", sourcePortId: "panel-a-port-8", targetPortId: "panel-b-port-20",
    sourceSide: "front", targetSide: "front",
  }],
}, {
  sourceDeviceId: source.id, sourceStart: 7, sourceEnd: 10,
  targetDeviceId: target.id, targetStart: 1,
});
assert.equal(frontCableDoesNotBlockRear.links.length, 4);
const portEight = availablePatchPanelPorts({
  devices: [source, target], links: [{
    id: "front-cable", sourcePortId: "panel-a-port-8", targetPortId: "panel-b-port-20",
  }],
}, source.id).find((port) => port.label === "8");
assert.equal(portEight.frontOccupied, true);
assert.equal(portEight.rearOccupied, false);

assert.throws(() => planPatchPanelMapping({
  devices: [source, target],
  links: [{
    id: "occupied", sourcePortId: "panel-a-port-8", targetPortId: "panel-b-port-20",
    sourceSide: "rear", targetSide: "rear",
  }],
}, {
  sourceDeviceId: source.id, sourceStart: 7, sourceEnd: 10,
  targetDeviceId: target.id, targetStart: 1,
}), /Rear already mapped: PATCH A \/ 8/);

assert.throws(() => planPatchPanelMapping(topology, {
  sourceDeviceId: source.id, sourceStart: 20, sourceEnd: 24,
  targetDeviceId: target.id, targetStart: 22,
}), /does not have ports 22–26/);

assert.equal(catalogVendors().includes("Generic Patch"), false, "Generic Patch must not appear in the generic Device provider list");
assert.deepEqual(modelsForVendor("Generic Patch"), [], "Generic Patch models belong exclusively to the Panel installer");
assert.equal(patchPanelProfiles().length, 18);
assert.ok(patchPanelProfiles().some((profile) => profile.model === "Cat6a copper panel 24"));
assert.ok(patchPanelProfiles().some((profile) => profile.model === "MPO fiber panel 96"));

console.log("patch panel range mapping checks passed");
