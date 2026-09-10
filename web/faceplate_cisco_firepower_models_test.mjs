import assert from "node:assert/strict";
import { hardwareCatalog, instantiateProfile } from "./static/js/catalog.js";
import { buildCiscoFirepowerModelFaceplate } from "./static/js/faceplate-cisco-firepower-models.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";

const series = [1010, 1120, 1140, 2110, 2120, 2130, 2140, 4110, 4120, 4140, 4150];
const bounds = { x: 0, y: 0, width: 690, height: 100 };

/** Instantiate the corrected catalog row with stable endpoint IDs for scene checks. */
function deviceFor(number) {
  const device = instantiateProfile(hardwareCatalog.find((entry) => entry.vendor === "Cisco" && entry.model === `Secure Firewall ${number}`), "Firewall", { x: 0, y: 0 });
  device.ports.forEach((port) => { port.id = `port-${port.portIndex}`; });
  return device;
}

/** Reconstruct the old, inaccurate catalog without changing any saved identity or type. */
function legacyDevice(number) {
  const device = deviceFor(number);
  delete device.faceplate.inventoryRevision;
  const rows = number < 4000 ? [
    ...Array.from({ length: 12 }, (_, index) => [String(index + 1), "RJ45_1G"]),
    ...Array.from({ length: 4 }, (_, index) => [`SFP+${index + 1}`, "SFP_PLUS_10G"]),
    ["MGMT1", "RJ45_1G"], ["CONSOLE1", "USB_C_CONSOLE"],
  ] : [
    ...Array.from({ length: 24 }, (_, index) => [`SFP28${index + 1}`, "SFP28_25G"]),
    ...Array.from({ length: 8 }, (_, index) => [`QSFP28${index + 1}`, "QSFP28_100G"]),
    ["MGMT1", "RJ45_1G"], ["MGMT2", "RJ45_1G"], ["CONSOLE1", "Console"],
  ];
  device.ports = rows.map(([label, type], index) => ({ id: `saved-${index + 1}`, portIndex: index + 1, label, type }));
  device.faceplate.totalPorts = device.ports.length;
  if (number >= 4000) device.faceplate.unitsU = 3;
  return device;
}

for (const number of series) {
  const device = deviceFor(number);
  const profile = buildCiscoFirepowerModelFaceplate(device);
  assert.equal(profile.fidelity, "model");
  assert.equal(profile.inventoryComplete, true);
  assert.equal(device.faceplate.inventoryRevision, 1);
  assert.deepEqual(profile.evidence.models, [device.model]);
  assert.equal(device.faceplate.unitsU, 1, "the corrected 4100 inventory must occupy its documented 1U");
  const expected = number === 1010 ? 11 : number < 2000 ? 15 : number < 4000 ? 18 : 10;
  assert.equal(device.ports.length, expected);
  const visible = buildFaceplateScene(device, bounds, { face: profile.defaultFace });
  assert.equal(visible.ports.length, expected);
  assert.equal(visible.unmappedPorts.length, 0, "every corrected catalog endpoint has a documented physical socket");
  assert.equal(new Set(visible.ports.map((box) => `${box.centerX}:${box.centerY}`)).size, expected);
  const opposite = buildFaceplateScene(device, bounds, { face: profile.defaultFace === "front" ? "rear" : "front" });
  assert.equal(opposite.hiddenPorts.length, expected);
  assert.deepEqual(opposite.hiddenPorts.map((box) => box.port.id).sort(), device.ports.map((port) => port.id).sort());
  assert.ok(profile.catalogDiscrepancies.length);
  const first = visible.ports.find((box) => box.displayLabel === "1/1");
  const second = visible.ports.find((box) => box.displayLabel === "1/2");
  assert.equal(first.centerX, second.centerX);
  assert.ok(first.centerY < second.centerY, "Cisco orders odd sockets above even sockets");
}

const p1010 = buildCiscoFirepowerModelFaceplate(deviceFor(1010));
assert.equal(p1010.faces.front.components.some((part) => part.kind === "led" || part.kind === "fan"), false);
assert.deepEqual(deviceFor(1010).ports.filter((port) => port.isPoe).map((port) => port.label), ["7", "8"]);
assert.equal(p1010.faces.rear.components.find((part) => part.kind === "power").columns, 2);
assert.equal(p1010.faces.rear.ports.find((port) => port.label === "CONSOLE1").type, "USB_MINI_CONSOLE");
assert.equal(p1010.faces.rear.ports.find((port) => port.label === "RJ45-CONSOLE1").type, "Console");
for (const number of [1120, 1140, 2110, 2120]) {
  assert.equal(deviceFor(number).ports.filter((port) => port.type === "SFP_1G").length, 4);
  assert.equal(deviceFor(number).ports.filter((port) => port.type === "SFP_PLUS_10G").length, 0);
}
for (const [number, powerSupplies, fans] of [[2130, 1, 4], [2140, 2, 4], [4110, 1, 6], [4120, 1, 6], [4140, 2, 6], [4150, 2, 6]]) {
  const rear = buildCiscoFirepowerModelFaceplate(deviceFor(number)).faces.rear;
  assert.equal(rear.components.filter((part) => part.kind === "psu").length, powerSupplies);
  assert.equal(rear.components.filter((part) => part.kind === "fan").length, fans);
  if (powerSupplies === 1) assert.equal(rear.components.find((part) => part.label === "PSU 2").variant, "blank");
}

for (const number of series) {
  const legacy = legacyDevice(number);
  const before = structuredClone(legacy);
  const profile = buildCiscoFirepowerModelFaceplate(deviceFor(number));
  const scene = buildFaceplateScene(legacy, bounds, { face: profile.defaultFace });
  const expectedUnmapped = number === 1010 ? 8 : number < 2000 ? 4 : number < 4000 ? 0 : 25;
  assert.equal(scene.unmappedPorts.length, expectedUnmapped, `${number}: nonexistent legacy ports must never occupy real sockets`);
  assert.deepEqual(legacy, before, "rendering cannot rewrite saved topology records");
  const management = scene.ports.find((box) => box.port.label === "MGMT1");
  assert.ok(management, "legacy management follows its documented socket after indices shift");
  const currentManagement = buildFaceplateScene(deviceFor(number), bounds, { face: profile.defaultFace }).ports.find((box) => box.port.label === "MGMT1");
  assert.equal(management.centerX, currentManagement.centerX);
  assert.equal(management.centerY, currentManagement.centerY);
  const optical = scene.ports.find((box) => box.port.type.includes("SFP"));
  if (optical) assert.match(optical.displayLabel, /^1\//, "known legacy optical defaults display the printed interface number");
  const renamed = structuredClone(legacy);
  renamed.ports.reverse();
  for (const port of renamed.ports) port.label = `Custom ${port.id}`;
  const edited = buildFaceplateScene(renamed, bounds, { face: profile.defaultFace });
  assert.deepEqual(edited.unmappedPorts.map((port) => port.id).sort(), scene.unmappedPorts.map((port) => port.id).sort(),
    "renamed legacy data must not accidentally occupy a shifted management slot");
}
assert.equal(buildCiscoFirepowerModelFaceplate({ model: "Secure Firewall 9300" }), null);
assert.equal(buildCiscoFirepowerModelFaceplate({ model: "Secure Firewall 1010", faceplate: { vendor: "Other" } }), null);
