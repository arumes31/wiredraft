import assert from "node:assert/strict";
import { catalogVendors, modelsForVendor, patchPanelProfiles } from "./static/js/catalog.js";
import {
  availablePatchPanelPorts, instantiatePatchPanel, isRearPanelLink, panelMapAvailability, patchPanelPathIndex,
  planPatchPanelMapping, RearPanelLinkVisual,
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
assert.deepEqual(panelMapAvailability({ devices: [] }), {
  ready: false,
  panelCount: 0,
  message: "No patch panels are installed. Add two with + PANEL before opening Panel Map.",
});
assert.deepEqual(panelMapAvailability({ devices: [source] }), {
  ready: false,
  panelCount: 1,
  message: "Only one patch panel is installed. Add one more with + PANEL before opening Panel Map.",
});
assert.deepEqual(panelMapAvailability(topology), { ready: true, panelCount: 2, message: "Open Panel Map" });
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
const tubePlan = planPatchPanelMapping(topology, {
  sourceDeviceId: source.id, sourceStart: 1, sourceEnd: 4,
  targetDeviceId: target.id, targetStart: 5,
  rearChannelId: "10000000-0000-4000-8000-000000000001",
  rearChannelName: "Bündelader 01",
  rearChannelType: "tube",
});
assert.ok(tubePlan.links.every((mappedLink) =>
  mappedLink.rearChannelId === "10000000-0000-4000-8000-000000000001" &&
  mappedLink.rearChannelName === "Bündelader 01" && mappedLink.rearChannelType === "tube"),
"one mapped range must persist one shared physical channel identity");
const groupedTubePlan = planPatchPanelMapping(topology, {
  sourceDeviceId: source.id, sourceStart: 1, sourceEnd: 10,
  targetDeviceId: target.id, targetStart: 11,
  rearChannelId: "10000000-0000-4000-8000-000000000010",
  rearChannelName: "CORE TUBE",
  rearChannelType: "tube",
  rearChannelGroupSize: "4",
});
assert.deepEqual(groupedTubePlan.channels.map(({ memberCount }) => memberCount), [4, 4, 2],
  "one panel range must split into the configured strands-per-tube grouping");
assert.equal(new Set(groupedTubePlan.links.map((mappedLink) => mappedLink.rearChannelId)).size, 3,
  "each configured tube must receive an independent persistent channel UUID");
assert.deepEqual(groupedTubePlan.channels.map(({ rearChannelName }) => rearChannelName), [
  "CORE TUBE · 01/03 · P1–4",
  "CORE TUBE · 02/03 · P5–8",
  "CORE TUBE · 03/03 · P9–10",
]);
assert.deepEqual(groupedTubePlan.channels.map(({ rearChannelId }) => rearChannelId), [
  "10000000-0000-4000-8000-000000000010",
  "10000000-0000-4000-8000-000000000011",
  "10000000-0000-4000-8000-000000000012",
]);
const automaticCopperPlan = planPatchPanelMapping(topology, {
  sourceDeviceId: source.id, sourceStart: 1, sourceEnd: 4,
  targetDeviceId: target.id, targetStart: 5,
  rearChannelId: "10000000-0000-4000-8000-000000000002",
  rearChannelName: "Copper bundle",
  rearChannelType: "auto",
});
assert.ok(automaticCopperPlan.links.every((mappedLink) => mappedLink.rearChannelType === "discrete"),
  "automatic channel construction must resolve copper media to a discrete bundle");
assert.throws(() => planPatchPanelMapping(topology, {
  sourceDeviceId: source.id, sourceStart: 1, sourceEnd: 4,
  targetDeviceId: target.id, targetStart: 5,
  rearChannelType: "tube",
}), /identifier is missing/);
assert.throws(() => planPatchPanelMapping(topology, {
  sourceDeviceId: source.id, sourceStart: 1, sourceEnd: 4,
  targetDeviceId: target.id, targetStart: 5,
  rearChannelId: "10000000-0000-4000-8000-000000000020",
  rearChannelType: "tube",
  rearChannelGroupSize: "3",
}), /Tube grouping must be/);
assert.ok(RearPanelLinkVisual.strokeWidth < 2 && RearPanelLinkVisual.opacity >= .7 && RearPanelLinkVisual.opacity <= .8,
  "rear panel maps must remain thin while meeting the 70–80% structured-wiring opacity range");
assert.deepEqual(RearPanelLinkVisual.dash, [6, 4], "backend links must use the dedicated 6/4 dash signature");
assert.equal(isRearPanelLink({ sourceSide: "rear", targetSide: "front" }), true,
  "a run with either endpoint on the rear plane is backend infrastructure");
assert.equal(isRearPanelLink({ sourceSide: "front", targetSide: "front" }), false);

const patchPathTopology = {
  devices: [source, target, {
    id: "switch-a", category: "Switch", ports: [{ id: "switch-a-port-1" }, { id: "switch-a-port-2" }],
  }, {
    id: "switch-b", category: "Switch", ports: [{ id: "switch-b-port-1" }, { id: "switch-b-port-2" }],
  }],
  links: [
    { id: "panel-ingress", sourcePortId: "switch-a-port-1", targetPortId: "panel-a-port-1" },
    {
      id: "panel-rear-map", sourcePortId: "panel-a-port-1", targetPortId: "panel-b-port-1",
      sourceSide: "rear", targetSide: "rear",
    },
    { id: "panel-egress", sourcePortId: "panel-b-port-1", targetPortId: "switch-b-port-1" },
    { id: "unrelated", sourcePortId: "switch-a-port-2", targetPortId: "switch-b-port-2" },
  ],
};
const patchPathIndex = patchPanelPathIndex(patchPathTopology);
assert.deepEqual([...patchPathIndex.get("panel-ingress")].sort(), ["panel-egress", "panel-ingress", "panel-rear-map"],
  "a physical hover path must cross the same panel jack from front to rear and continue out of the remote panel");
assert.equal(patchPathIndex.get("panel-ingress"), patchPathIndex.get("panel-egress"),
  "all members must reuse one cached physical-path component");
assert.equal(patchPathIndex.has("unrelated"), false,
  "ordinary device ports and unrelated patch-panel jacks must not be joined into the path");

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
