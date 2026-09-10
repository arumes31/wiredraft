import assert from "node:assert/strict";
import test from "node:test";
import { hardwareCatalog, instantiateProfile } from "./static/js/catalog.js";
import { buildCheckPointModelFaceplate } from "./static/js/faceplate-checkpoint-models.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";

/** Give a real catalog inventory stable identities for compatibility and geometry assertions. */
function deviceFor(model) {
  const device = instantiateProfile(hardwareCatalog.find((row) => row.vendor === "Check Point" && row.model === model), model, { x: 0, y: 0 });
  device.id = model;
  for (const port of device.ports) { port.id = `${model}-${port.portIndex}`; port.deviceId = model; }
  return device;
}

test("3600 and 3800 have six single-row Ethernet sockets, both console types and two rear DC inlets", () => {
  for (const model of ["Quantum 3600", "Quantum 3800"]) {
    const profile = buildCheckPointModelFaceplate(deviceFor(model));
    assert.equal(profile.fidelity, "model");
    assert.deepEqual(profile.evidence.models, [model]);
    assert.match(profile.evidence.front, /#page=30$/);
    assert.match(profile.evidence.rear, /#page=33$/);
    assert.ok(profile.chassis.width < .5, "this is a half-width desktop chassis");
    assert.equal(profile.faces.front.ports.length, 8);
    assert.equal(new Set(profile.faces.front.ports.slice(0, 6).map((slot) => slot.y)).size, 1);
    assert.deepEqual(profile.faces.front.ports.slice(6).map((slot) => slot.connectorKind), ["rj45", "usb-c"]);
    assert.equal(profile.faces.rear.components.filter((part) => part.kind === "power").length, 2);
    assert.equal(profile.faces.rear.components.filter((part) => part.kind === "fan").length, 1);
  }
  assert.equal(buildCheckPointModelFaceplate({}), null);
  assert.equal(buildCheckPointModelFaceplate(deviceFor("Quantum 1500")), null);
});

test("Check Point exact scenes retain renamed, reordered inventory and route hidden sockets without mutations", () => {
  for (const model of ["Quantum 1600", "Quantum 1800", "Quantum 3600", "Quantum 3800"]) {
    const device = deviceFor(model);
    device.ports.reverse();
    device.ports[0].label = "Operator console";
    device.ports[0].allowedVlans = [101];
    const original = structuredClone(device);
    const bounds = { x: 20, y: 30, width: 690, height: 100 };
    const front = buildFaceplateScene(device, bounds, { face: "front" });
    const rear = buildFaceplateScene(device, bounds, { face: "rear" });
    assert.equal(front.profile.fidelity, "model");
    assert.equal(front.unmappedPorts.length, 0);
    assert.equal(front.ports.find((box) => box.port.id === device.ports[0].id).displayLabel, "Operator console");
    assert.equal(rear.ports.length, 0);
    assert.deepEqual(new Set(rear.hiddenPorts.map((box) => box.port.id)), new Set(device.ports.map((port) => port.id)));
    assert.deepEqual(device, original);
  }
});

test("Spark 1600 and 1800 retain their individual LAN banks, combo ports and single versus dual AC power", () => {
  const small = buildCheckPointModelFaceplate(deviceFor("Quantum 1600"));
  const large = buildCheckPointModelFaceplate(deviceFor("Quantum 1800"));
  assert.equal(small.faces.front.ports.length, 22);
  assert.equal(large.faces.front.ports.length, 27);
  assert.equal(small.faces.rear.components.filter((part) => part.kind === "power").length, 1);
  assert.equal(large.faces.rear.components.filter((part) => part.kind === "power").length, 2);
  assert.equal(large.faces.rear.components.filter((part) => part.kind === "fan").length, 5);
  assert.ok(large.faces.front.ports[0].x < small.faces.front.ports[0].x, "1800 has a separate multigigabit pair left of the sixteen-port bank");
  assert.ok(large.faces.front.ports[0].y > large.faces.front.ports[1].y, "the printed LAN numbering starts on the lower row");
  const device = deviceFor("Quantum 1800");
  assert.deepEqual(device.ports.slice(0, 3).map((port) => [port.label, port.speedMbps]), [["LAN1", 2500], ["LAN2", 2500], ["LAN3", 1000]]);
  assert.equal(device.ports[17].label, "LAN18");
  assert.equal(large.faces.front.ports.find((port) => port.portIndex === 25).physicalLabel, "EXT");
});

test("the corrected 1800 speed banks preserve all original endpoint identities and custom configuration", () => {
  const device = deviceFor("Quantum 1800");
  delete device.faceplate.inventoryRevision;
  for (const port of device.ports.slice(0, 18)) {
    port.type = port.portIndex <= 16 ? "RJ45_1G" : "RJ45_MGIG";
    port.speedMbps = port.portIndex <= 16 ? 1000 : 2500;
    port.label = `Production LAN ${port.portIndex}`;
  }
  device.ports.reverse();
  const original = structuredClone(device);
  const scene = buildFaceplateScene(device, { x: 0, y: 0, width: 690, height: 100 });
  assert.equal(scene.ports.length, 27);
  assert.equal(scene.unmappedPorts.length, 0);
  for (const port of device.ports) assert.equal(scene.ports.find((box) => box.port.id === port.id).displayLabel, port.label === "MGMT" ? "EXT" : port.label);
  assert.deepEqual(device, original);
});

test("6000 and 7000 models retain row-major ports, dedicated LOM, and their different power and cooling populations", () => {
  for (const series of [6200, 6400, 6600, 6700, 6900, 7000]) {
    const device = deviceFor(`Quantum ${series}`);
    const profile = buildCheckPointModelFaceplate(device);
    assert.equal(profile.fidelity, "model");
    assert.equal(device.ports.length, 13);
    assert.equal(device.ports[12].label, "LOM");
    const slots = profile.faces.front.ports;
    assert.equal(slots[0].x, slots[4].x);
    assert.ok(slots[0].y < slots[4].y);
    assert.equal(new Set(slots.slice(0, 4).map((slot) => slot.x)).size, 4);
    assert.equal(profile.faces.front.components.filter((part) => part.variant === "blank").length, series >= 6900 ? 2 : 1);
    const rear = profile.faces.rear.components;
    assert.equal(rear.filter((part) => part.kind === "fan").length, series === 6200 ? 5 : series === 6400 ? 6 : series === 7000 ? 5 : 4);
    assert.equal(rear.filter((part) => part.kind === "psu").length, series >= 6600 ? 2 : 0);
    const retained = device.ports.slice(0, 12);
    device.ports = retained.reverse();
    delete device.faceplate.inventoryRevision;
    device.ports[0].label = "Saved console name";
    const original = structuredClone(device);
    const scene = buildFaceplateScene(device, { x: 0, y: 0, width: 690, height: 100 });
    assert.equal(scene.ports.length, 12);
    assert.equal(scene.unmappedPorts.length, 0);
    assert.deepEqual(device, original);
  }
});
