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

test("the 6200 / 6600 alias discloses 6200 Base and retains known Mgmt/Sync identities without repurposing optical endpoints", () => {
  const device = deviceFor("Quantum 6200 / 6600");
  const profile = buildCheckPointModelFaceplate(device);
  assert.equal(profile.fidelity, "model");
  assert.equal(profile.evidence.selectedModel, "Quantum 6200");
  assert.equal(profile.sku, "Quantum 6200 Base");
  assert.deepEqual(profile.evidence.models, ["Quantum 6200"]);
  assert.match(profile.evidence.configuration, /6200 Base.*LOM/);
  assert.equal(device.faceplate.inventoryRevision, 1);
  assert.equal(device.ports.length, 13);
  assert.deepEqual(device.ports.slice(8).map((port) => [port.type, port.label]),
    [["RJ45_1G", "MGMT"], ["RJ45_1G", "SYNC"], ["Console", "CONSOLE"], ["USB_C_CONSOLE", "USB-C"], ["RJ45_1G", "LOM"]]);
  assert.equal(profile.faces.rear.components.filter((part) => part.kind === "power" && part.variant === "ac").length, 1);
  assert.equal(profile.faces.rear.components.filter((part) => part.kind === "psu").length, 0);
  assert.ok(profile.faces.rear.components.some((part) => part.kind === "service-jack" && part.role === "esd"));
  delete device.faceplate.inventoryRevision;
  device.ports = Array.from({ length: 14 }, (_, index) => ({
    id: `old-${index + 1}`, portIndex: index + 1, type: index < 8 ? "RJ45_1G" : index < 12 ? "SFP_PLUS_10G" : "Console",
    label: `Custom ${index + 1}`, speedMbps: index < 8 ? 1000 : index < 12 ? 10000 : 0, allowedVlans: [207], poe: false,
  })).filter((port) => port.portIndex !== 3).reverse();
  const before = structuredClone(device);
  const bounds = { x: 0, y: 0, width: 690, height: 100 };
  const scene = buildFaceplateScene(device, bounds);
  assert.deepEqual(scene.unmappedPorts.map((port) => port.portIndex), [12, 11, 10, 9]);
  assert.deepEqual(scene.ports.map((box) => box.port.portIndex), [14, 13, 8, 7, 6, 5, 4, 2, 1]);
  const oldSync = scene.ports.find((box) => box.port.portIndex === 14);
  const oldMgmt = scene.ports.find((box) => box.port.portIndex === 13);
  assert.equal(oldSync.centerX, oldMgmt.centerX);
  assert.ok(oldSync.centerY < oldMgmt.centerY, "source SYNC is above MGMT despite the old alias's reversed index order");
  assert.deepEqual(new Set([...scene.ports, ...scene.hiddenPorts].map((box) => box.port.id)), new Set(device.ports.map((port) => port.id)));
  assert.deepEqual(device, before);
  device.faceplate.inventoryRevision = 99;
  assert.equal(buildFaceplateScene(device, bounds).unmappedPorts.length, device.ports.length);
});

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

test("16000, 26000 and 28000 show their selected line card, rack height and actual rear PSU population", () => {
  for (const series of [16000, 26000, 28000]) {
    const device = deviceFor(`Quantum ${series}`);
    const profile = buildCheckPointModelFaceplate(device);
    assert.equal(profile?.fidelity, "model");
    assert.deepEqual(profile.evidence.models, [device.model]);
    assert.equal(device.faceplate.unitsU, series === 16000 ? 2 : 3);
    assert.equal(device.ports.length, series === 28000 ? 9 : 13);
    assert.equal(device.ports.at(-1).label, "LOM");
    const bays = profile.faces.front.components.filter((part) => part.kind === "module-bay" && part.y >= 1 / device.faceplate.unitsU);
    assert.equal(bays.length, series === 16000 ? 4 : 8);
    assert.equal(bays.filter((part) => part.variant === "populated").length, 1);
    assert.equal(bays[0].label, undefined, "the populated card leaves its lower edge clear for printed port numbers");
    const data = profile.faces.front.ports.filter((port) => port.portIndex <= (series === 28000 ? 4 : 8));
    assert.ok(data.every((port) => port.x < .22), "selected base line card occupies the first expansion bay");
    if (series === 28000) assert.equal(new Set(data.map((port) => port.y)).size, 1);
    else { assert.equal(data[0].x, data[4].x); assert.ok(data[0].y < data[4].y); }
    const rear = profile.faces.rear.components;
    assert.equal(rear.filter((part) => part.kind === "psu").length, series === 16000 ? 1 : 3);
    assert.equal(rear.filter((part) => part.kind === "fan").length, 4, "only the four externally visible fans are drawn");
    assert.equal(profile.faces.rear.ports.length, 0);
    const scene = buildFaceplateScene(device, { x: 0, y: 0, width: 690, height: device.faceplate.unitsU * 100 });
    assert.equal(scene.unmappedPorts.length, 0);
    assert.ok(scene.ports.every((port) => port.height <= 23));
  }
});

test("large Check Point legacy inventories keep endpoint IDs and saved rack units when the omitted LOM socket is introduced", () => {
  for (const series of [16000, 26000, 28000]) {
    const device = deviceFor(`Quantum ${series}`);
    const oldCount = series === 28000 ? 8 : 12;
    device.ports = device.ports.filter((port) => port.portIndex <= oldCount).reverse();
    delete device.faceplate.inventoryRevision;
    device.faceplate.unitsU = 2;
    device.ports[0].label = "Saved console";
    const original = structuredClone(device);
    const scene = buildFaceplateScene(device, { x: 0, y: 0, width: 690, height: 200 });
    assert.equal(scene.profile.fidelity, "model");
    assert.equal(scene.ports.length, oldCount);
    assert.equal(scene.unmappedPorts.length, 0);
    assert.deepEqual(new Set(scene.ports.map((box) => box.port.id)), new Set(device.ports.map((port) => port.id)));
    assert.equal(scene.ports.find((box) => box.port.id === device.ports[0].id).displayLabel, "Saved console");
    assert.deepEqual(device, original);
  }
});
