import assert from "node:assert/strict";
import { hardwareCatalog, instantiateProfile, upgradeInstalledPhysicalPorts } from "./static/js/catalog.js";
import { buildCiscoCatalystModelFaceplate } from "./static/js/faceplate-cisco-catalyst-models.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";

const models = ["C9200L-24P-4X", "C9200L-24T-4G", "C9200L-48P-4X", "C9200L-48T-4G", "C9300L-24T-4G", "C9300L-48P-4X"];
const bounds = { x: 0, y: 0, width: 690, height: 100 };

/** Instantiate a fixed-uplink Catalyst SKU with stable endpoint IDs for legacy mapping checks. */
function deviceFor(model) {
  const device = instantiateProfile(hardwareCatalog.find((entry) => entry.vendor === "Cisco" && entry.model === `Catalyst ${model}`), model, { x: 0, y: 0 });
  device.ports.forEach((port) => { port.id = `port-${port.portIndex}`; });
  return device;
}

for (const model of models) {
  const device = deviceFor(model);
  const profile = buildCiscoCatalystModelFaceplate(device);
  const copperCount = model.includes("24") ? 24 : 48;
  const series9200 = model.startsWith("C9200");
  assert.equal(profile.fidelity, "model");
  assert.equal(profile.inventoryRevision, 1);
  assert.equal(device.faceplate.inventoryRevision, 1);
  assert.deepEqual(profile.evidence.models, [device.model]);
  assert.match(profile.evidence.configuration, /one AC supply/i);
  assert.match(profile.evidence.configuration, /StackWise.*uninstalled/);
  assert.equal(device.ports.length, copperCount + 7);
  assert.equal(profile.faces.front.ports.length, copperCount + 5);
  assert.equal(profile.faces.rear.ports.length, 2);
  const front = buildFaceplateScene(device, bounds, { face: "front" });
  const rear = buildFaceplateScene(device, bounds, { face: "rear" });
  assert.equal(front.unmappedPorts.length + rear.unmappedPorts.length, 0);
  assert.deepEqual([...front.ports, ...rear.ports].map((box) => box.port.id).sort(), device.ports.map((port) => port.id).sort());
  assert.equal(front.hiddenPorts.length, 2);
  assert.equal(rear.hiddenPorts.length, copperCount + 5);
  const copper = profile.faces.front.ports.filter((slot) => slot.type === "RJ45_1G");
  assert.equal(copper.length, copperCount);
  const first = copper.find((slot) => slot.label === "1");
  const second = copper.find((slot) => slot.label === "2");
  assert.equal(first.x, second.x);
  assert.ok(first.y < second.y, "odd copper numbers are above even numbers");
  assert.ok(copperCount === 24 ? first.x > .42 : first.x < .05, "24-port banks occupy the right half of the copper area");
  const optical = profile.faces.front.ports.filter((slot) => slot.type.includes("SFP"));
  assert.equal(optical.length, 4);
  assert.equal(new Set(optical.map((slot) => slot.y)).size, 1);
  assert.deepEqual(optical.map((slot) => slot.physicalLabel), [1, 2, 3, 4].map((index) => `${model.endsWith("4X") ? "10G" : "1G"}${index}`));
  assert.equal(profile.faces.front.ports.find((slot) => slot.type === "USB_MINI_CONSOLE").portIndex, copperCount + 6);
  assert.equal(profile.faces.rear.ports.find((slot) => slot.type === "Console").portIndex, copperCount + 5);
  assert.equal(profile.faces.rear.ports.find((slot) => slot.type === "RJ45_1G").portIndex, copperCount + 7);
  assert.equal(profile.faces.front.components.filter((part) => part.kind === "usb").length, series9200 ? 2 : 1);
  assert.equal(profile.faces.rear.components.filter((part) => part.kind === "fan").length, series9200 ? 2 : 3);
  assert.equal(profile.faces.rear.components.filter((part) => part.kind === "psu").length, 1);
  assert.equal(profile.faces.rear.components.find((part) => part.kind === "psu").variant, series9200 ? "ac" : "ac-inlet-right");
  assert.equal(profile.faces.rear.components.filter((part) => part.label?.startsWith("STACK BAY")).length, 2);
  assert.equal(profile.faces.rear.components.find((part) => part.label === "OPTIONAL PSU 2").variant, "blank");

  const legacy = structuredClone(device);
  delete legacy.faceplate.inventoryRevision;
  legacy.ports = legacy.ports.filter((port) => port.portIndex <= copperCount + 5);
  legacy.faceplate.totalPorts = legacy.ports.length;
  legacy.ports.reverse();
  legacy.ports.find((port) => port.portIndex === 1).label = "Renamed access port";
  const original = structuredClone(legacy);
  assert.equal(upgradeInstalledPhysicalPorts({ devices: [legacy] }), false);
  const oldFront = buildFaceplateScene(legacy, bounds, { face: "front" });
  const oldRear = buildFaceplateScene(legacy, bounds, { face: "rear" });
  assert.equal(oldFront.unmappedPorts.length + oldRear.unmappedPorts.length, 0);
  assert.equal(oldRear.ports.length, 1, "old console identity remains on the rear; absent MGMT is not invented");
  assert.equal(oldFront.ports.length, copperCount + 4);
  assert.equal(oldFront.ports.find((box) => box.port.portIndex === 1).displayLabel, "Renamed access port");
  assert.deepEqual(legacy, original, "rendering and catalog refresh preserve saved inventory and custom labels");
  legacy.ports.push({ id: "custom-extra", portIndex: copperCount + 6, label: "USB CONSOLE", type: "USB_MINI_CONSOLE" });
  assert.equal(buildFaceplateScene(legacy, bounds, { face: "front" }).unmappedPorts[0].id, "custom-extra",
    "an unmapped legacy index cannot fall through to a coincidental current index");
}
assert.equal(buildCiscoCatalystModelFaceplate({ model: "Catalyst 9200 family" }), null);
assert.equal(buildCiscoCatalystModelFaceplate({ model: "Catalyst C9200L-24P-4X", faceplate: { vendor: "Other" } }), null);
