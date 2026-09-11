import assert from "node:assert/strict";
import { hardwareCatalog, instantiateProfile } from "./static/js/catalog.js";
import { buildJuniperSRXModelFaceplate } from "./static/js/faceplate-juniper-srx-models.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";

const bounds = { x: 0, y: 0, width: 690, height: 100 };

/** Instantiate one individually traced Juniper SRX catalog row. */
function deviceFor(series) {
  return instantiateProfile(hardwareCatalog.find((entry) => entry.vendor === "Juniper" && entry.model === `SRX${series}`), `SRX${series}`, { x: 0, y: 0 });
}

for (const series of [300, 320, 340, 345, 380]) {
  const device = deviceFor(series);
  const profile = buildJuniperSRXModelFaceplate(device);
  assert.equal(profile.fidelity, "model");
  assert.equal(profile.inventoryComplete, true);
  assert.deepEqual(profile.evidence.models, [device.model]);
  assert.equal(profile.faces.front.ports.length, device.ports.length);
  assert.equal(profile.faces.rear.ports.length, 0);
  assert.equal(profile.faces.front.ports.find((port) => port.label === "MINI-USB").type, "USB_MINI_CONSOLE");
  const copper = profile.faces.front.ports.filter((port) => port.type === "RJ45_1G" && port.label !== "MGMT");
  assert.equal(new Set(copper.map((port) => port.y)).size, 1, "the actual SRX banks use a single row");
  assert.ok(copper.every((port, index) => index === 0 || copper[index - 1].x < port.x));
  const scene = buildFaceplateScene(device, bounds, { face: "front" });
  assert.equal(scene.unmappedPorts.length, 0);
  assert.equal(scene.ports.length, device.ports.length);
  assert.ok(scene.ports.every((port) => port.displayLabel === port.port.label));
  assert.equal(buildFaceplateScene(device, bounds, { face: "rear" }).hiddenPorts.length, device.ports.length);
}
const p300 = buildJuniperSRXModelFaceplate(deviceFor(300));
const p320 = buildJuniperSRXModelFaceplate(deviceFor(320));
assert.equal(p300.faces.rear.components.filter((part) => part.kind === "fan").length, 0);
assert.equal(p300.faces.front.components.filter((part) => part.kind === "module-bay").length, 0);
assert.equal(p320.faces.rear.components.filter((part) => part.kind === "fan").length, 2);
assert.equal(p320.faces.front.components.filter((part) => part.kind === "module-bay").length, 2);
assert.ok(p300.chassis.height < p320.chassis.height);
for (const series of [340, 345]) {
  const device = deviceFor(series);
  const profile = buildJuniperSRXModelFaceplate(device);
  assert.equal(device.faceplate.inventoryRevision, 1);
  assert.deepEqual(device.ports.filter((port) => port.type === "SFP_1G").map((port) => port.label),
    ["0/8", "0/9", "0/10", "0/11", "0/12", "0/13", "0/14", "0/15"]);
  assert.equal(profile.faces.front.components.filter((part) => part.kind === "module-bay").length, 4);
  assert.equal(profile.faces.rear.components.filter((part) => part.kind === "fan").length, 4);
  assert.equal(profile.faces.rear.components.filter((part) => part.kind === "power").length, 1);
  const legacy = structuredClone(device);
  delete legacy.faceplate.inventoryRevision;
  for (const port of legacy.ports.filter((port) => port.type === "SFP_1G")) port.label = `0/${port.portIndex - 9}`;
  const original = structuredClone(legacy);
  const scene = buildFaceplateScene(legacy, bounds, { face: "front" });
  assert.equal(scene.unmappedPorts.length, 0);
  const optical = scene.ports.find((box) => box.port.portIndex === 9);
  assert.equal(optical.displayLabel, "0/8", "the old generated duplicate label displays the documented optical number");
  assert.deepEqual(legacy, original, "physical-label corrections never rewrite stored topology");
  legacy.ports.find((port) => port.portIndex === 9).label = "Optical upstream";
  assert.equal(buildFaceplateScene(legacy, bounds, { face: "front" }).ports.find((box) => box.port.portIndex === 9).displayLabel, "Optical upstream");
}
assert.match(buildJuniperSRXModelFaceplate(deviceFor(345)).evidence.configuration, /Single-AC/);
const p380 = buildJuniperSRXModelFaceplate(deviceFor(380));
assert.equal(p380.faces.front.ports.filter((port) => port.type === "RJ45_1G" && port.label !== "MGMT").length, 16);
assert.equal(p380.faces.front.ports.filter((port) => port.type === "SFP_PLUS_10G").length, 4);
assert.equal(p380.faces.rear.components.filter((part) => part.kind === "fan").length, 3);
assert.equal(p380.faces.rear.components.filter((part) => part.kind === "psu").length, 1);
assert.equal(p380.faces.rear.components.find((part) => part.label === "OPTIONAL PSU").variant, "blank");
for (const series of [1500, 4100, 4200, 4600]) {
  const device = deviceFor(series);
  const profile = buildJuniperSRXModelFaceplate(device);
  assert.equal(profile.fidelity, "model");
  assert.deepEqual(profile.evidence.models, [device.model]);
  assert.match(profile.evidence.configuration, /AC/);
  const before = structuredClone(device);
  const front = buildFaceplateScene(device, bounds, { face: "front" });
  assert.equal(front.unmappedPorts.length, 0);
  assert.equal(front.ports.length, device.ports.length);
  assert.equal(new Set(front.ports.map((box) => box.port.portIndex)).size, device.ports.length);
  assert.equal(buildFaceplateScene(device, bounds, { face: "rear" }).hiddenPorts.length, device.ports.length);
  const first = device.ports[0];
  const originalBox = front.ports.find((box) => box.port.portIndex === first.portIndex);
  first.label = "Renamed production uplink";
  device.ports.reverse();
  const renamedBox = buildFaceplateScene(device, bounds, { face: "front" }).ports.find((box) => box.port.portIndex === first.portIndex);
  assert.equal(renamedBox.displayLabel, first.label);
  assert.equal(renamedBox.x, originalBox.x);
  assert.equal(renamedBox.y, originalBox.y);
  assert.deepEqual(deviceFor(series), before, "model construction must not mutate the catalog");
}
const p1500 = buildJuniperSRXModelFaceplate(deviceFor(1500));
assert.equal(p1500.faces.front.ports.find((port) => port.label === "0/0").x,
  p1500.faces.front.ports.find((port) => port.label === "0/1").x);
assert.ok(p1500.faces.front.ports.find((port) => port.label === "0/0").y <
  p1500.faces.front.ports.find((port) => port.label === "0/1").y);
assert.equal(p1500.faces.front.components.filter((part) => part.label?.startsWith("WAN PIM")).length, 2);
assert.equal(p1500.faces.rear.components.filter((part) => part.kind === "fan").length, 4);
assert.equal(p1500.faces.rear.components.filter((part) => part.kind === "psu").length, 1);
assert.ok(p1500.faces.rear.components.find((part) => part.kind === "psu").x >
  p1500.faces.rear.components.find((part) => part.label === "OPTIONAL PSU 1").x);
for (const series of [4100, 4200]) {
  const profile = buildJuniperSRXModelFaceplate(deviceFor(series));
  const data = profile.faces.front.ports.filter((port) => /^\d+$/.test(port.label));
  assert.equal(data.length, 8);
  assert.equal(new Set(data.map((port) => port.y)).size, 1);
  assert.deepEqual(data.map((port) => port.physicalLabel), Array.from({ length: 8 }, (_, index) => `0/${index}`));
  assert.equal(profile.faces.rear.components.filter((part) => part.kind === "fan").length, 4,
    "four visible fan trays each house two tandem rotors");
  assert.equal(profile.faces.rear.components.filter((part) => part.kind === "psu").length, 2);
}
const p4600 = buildJuniperSRXModelFaceplate(deviceFor(4600));
const qsfp0 = p4600.faces.front.ports.find((port) => port.label === "0" && port.type === "QSFP28_100G");
const sfp0 = p4600.faces.front.ports.find((port) => port.label === "0" && port.type === "SFP_PLUS_10G");
assert.notEqual(qsfp0.portIndex, sfp0.portIndex, "duplicate printed numbers belong to different PICs");
assert.ok(qsfp0.x < sfp0.x);
const ctl0 = p4600.faces.front.ports.find((port) => port.label === "CTL0");
const ctl1 = p4600.faces.front.ports.find((port) => port.label === "CTL1");
const fab0 = p4600.faces.front.ports.find((port) => port.label === "FAB0");
assert.equal(ctl0.x, ctl1.x);
assert.ok(ctl0.y < ctl1.y && ctl0.x < fab0.x);
assert.equal(fab0.physicalLabel, "2");
assert.equal(p4600.faces.front.components.filter((part) => part.kind === "coax").length, 4);
assert.equal(p4600.faces.front.components.filter((part) => part.label?.startsWith("SSD ")).length, 2);
assert.equal(p4600.faces.rear.components.filter((part) => part.kind === "fan").length, 5);
assert.equal(p4600.faces.rear.components.filter((part) => part.kind === "psu").length, 2);
assert.equal(buildJuniperSRXModelFaceplate({ model: "SRX5400" }), null);
assert.equal(buildJuniperSRXModelFaceplate({ model: "SRX300", faceplate: { vendor: "Other" } }), null);
