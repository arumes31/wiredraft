import assert from "node:assert/strict";
import { hardwareCatalog, instantiateProfile, upgradeInstalledPhysicalPorts } from "./static/js/catalog.js";
import { resolveModelFaceplate } from "./static/js/faceplate-models.js";

const models = [
  "FortiGate 40F", "FortiGate 60F", "FortiGate 61F", "FortiGate 70F", "FortiGate 71F",
  "FortiGate 70G", "FortiGate 71G", "FortiGate 80F", "FortiGate 81F", "FortiGate 100F",
  "FortiGate 101F", "FortiGate 200F", "FortiGate 201F", "FortiGate 400F", "FortiGate 401F",
  "FortiGate 600F", "FortiGate 601F", "FortiSwitch 124F", "FortiSwitch 124F-POE", "FortiSwitch 124F-FPOE",
];

/** Instantiate the catalog model used by a physical-panel assertion. */
function deviceFor(model) {
  const device = instantiateProfile(hardwareCatalog.find((profile) => profile.model === model), model, { x: 0, y: 0 });
  device.id = `test-${model}`;
  device.ports.forEach((port, index) => { port.id = `${device.id}-${index + 1}`; port.deviceId = device.id; });
  return device;
}

for (const model of models) {
  const device = deviceFor(model);
  const layout = resolveModelFaceplate(device);
  assert.ok(layout, `${model} must have both physical faces`);
  assert.match(layout.source, /^https:\/\//);
  assert.ok(layout.sourcePage, `${model} must cite the panel pages`);
  assert.ok(layout.chassis.width > 0 && layout.chassis.x + layout.chassis.width <= 1);
  const slots = Object.values(layout.faces).flatMap((face) => face.ports);
  assert.equal(slots.length, device.ports.length, `${model} must locate every physical port exactly once`);
  for (const port of device.ports) {
    const matched = slots.filter((slot) => slot.label === port.label && (!slot.type || slot.type === port.type));
    assert.equal(matched.length, 1, `${model} ${port.label}/${port.type} requires one matching connector`);
    assert.equal(matched[0].portIndex, port.portIndex, "renamed ports must retain a stable inventory match");
  }
  for (const face of Object.values(layout.faces)) {
    for (const slot of face.ports) {
      assert.ok(slot.x > 0 && slot.x < 1 && slot.y > 0 && slot.y < 1, `${model} connector stays in chassis`);
    }
    for (const component of face.components) {
      assert.ok(component.width > 0 && component.height > 0, `${model} components need positive dimensions`);
      assert.ok(component.x >= 0 && component.y >= 0 && component.x + component.width <= 1.000001 && component.y + component.height <= 1.000001,
        `${model} ${component.kind} stays in chassis`);
      if (component.kind === "vent") {
        for (const slot of face.ports) {
          const overlaps = component.x < slot.x + slot.width / 2 && component.x + component.width > slot.x - slot.width / 2 &&
            component.y < slot.y + slot.height / 2 && component.y + component.height > slot.y - slot.height / 2;
          assert.equal(overlaps, false, `${model} ventilation must not cover ${slot.label}`);
        }
      }
    }
  }
}

for (const model of ["FortiGate 40F", "FortiGate 60F", "FortiGate 70F", "FortiGate 70G", "FortiGate 80F"]) {
  const layout = resolveModelFaceplate(deviceFor(model));
  assert.equal(layout.defaultFace, "rear");
  assert.equal(layout.faces.front.ports.length, 0, `${model} front has indicators, not sockets`);
}
for (const model of ["FortiGate 40F", "FortiGate 80F", "FortiGate 400F"]) {
  const unverified = deviceFor(model);
  unverified.model += "-UNVERIFIED";
  assert.equal(resolveModelFaceplate(unverified), null, "unverified variants must not inherit exact model claims");
}
assert.equal(resolveModelFaceplate({ model: "FortiGate 100F", faceplate: { vendor: "Other" } }), null);
assert.equal(resolveModelFaceplate({}), null);

const fg100 = deviceFor("FortiGate 100F");
const layout100 = resolveModelFaceplate(fg100);
for (const label of ["17", "18", "19", "20"]) {
  assert.equal(fg100.ports.filter((port) => port.label === label).length, 2, "shared media requires both physical sockets");
  assert.deepEqual(new Set(fg100.ports.filter((port) => port.label === label).map((port) => port.type)), new Set(["RJ45_1G", "SFP_1G"]));
}
assert.ok(layout100.faces.front.ports.find((slot) => slot.label === "X1").x < layout100.faces.front.ports.find((slot) => slot.label === "13").x);
assert.equal(layout100.faces.rear.components.filter((component) => component.kind === "power").length, 2);
assert.equal(layout100.faces.rear.components.filter((component) => component.kind === "psu").length, 0, "100F has fixed power inlets");
assert.equal(resolveModelFaceplate(deviceFor("FortiGate 400F")).faces.rear.components.filter((component) => component.kind === "psu").length, 2);
assert.equal(resolveModelFaceplate(deviceFor("FortiSwitch 124F")).faces.rear.components.filter((component) => component.kind === "fan").length, 0);
assert.equal(resolveModelFaceplate(deviceFor("FortiSwitch 124F-POE")).faces.rear.components.filter((component) => component.kind === "fan").length, 2);

const old100 = structuredClone(fg100);
old100.ports = old100.ports.filter((port) => !(port.type === "RJ45_1G" && ["17", "18", "19", "20"].includes(port.label)));
old100.ports[0].label = "DMZ renamed";
old100.ports[0].nativeVlan = 32;
const originalPorts = structuredClone(old100.ports);
const topology = { devices: [old100], links: [{ id: "keep-link", sourcePortId: old100.ports[0].id }] };
assert.equal(upgradeInstalledPhysicalPorts(topology), true);
assert.equal(old100.ports.length, 33);
for (const port of originalPorts) {
  const migrated = old100.ports.find((current) => current.id === port.id);
  assert.equal(migrated.label, port.label, "named existing ports are preserved");
  assert.equal(migrated.nativeVlan, port.nativeVlan, "existing port settings are preserved");
  assert.equal(migrated.portIndex, port.portIndex, "existing inventory indices are stable");
}
assert.equal(topology.links[0].sourcePortId, originalPorts[0].id);
assert.equal(new Set(old100.ports.map((port) => port.id)).size, 33, "new sockets must receive distinct IDs");
assert.equal(upgradeInstalledPhysicalPorts(topology), false, "migration must be idempotent");
const incomplete = structuredClone(fg100);
incomplete.ports.splice(0, 1);
assert.equal(upgradeInstalledPhysicalPorts({ devices: [incomplete] }), false, "custom inventory must not be rebuilt");
