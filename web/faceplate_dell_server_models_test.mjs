import assert from "node:assert/strict";
import test from "node:test";
import { hardwareCatalog, instantiateProfile, upgradeInstalledPhysicalPorts } from "./static/js/catalog.js";
import { resolveEquipmentFaceplate } from "./static/js/faceplate-equipment-models.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";

const cases = [
  { model: "PowerEdge R350", units: 1, drives: 4, endpoints: 5 },
  { model: "PowerEdge R450", units: 1, drives: 8, endpoints: 4 },
  { model: "PowerEdge R550", units: 2, drives: 8, endpoints: 4 },
  { model: "PowerEdge R650", units: 1, drives: 8, endpoints: 4, watts: 800 },
  { model: "PowerEdge R6525", units: 1, drives: 8, endpoints: 4, watts: 1400 },
  { model: "PowerEdge R750", units: 2, drives: 8, endpoints: 4, watts: 2400 },
  { model: "PowerEdge R7525", units: 2, drives: 8, endpoints: 4, watts: 2400 },
  { model: "PowerEdge R6615", units: 1, drives: 8, endpoints: 4, watts: 800 },
  { model: "PowerEdge R7615", units: 2, drives: 8, endpoints: 4, watts: 2400 },
];

/** Reconstruct the original family record when checking saved topology compatibility. */
function deviceFor(model, legacy = false) {
  let catalog = hardwareCatalog.find((entry) => entry.vendor === "Dell" && entry.model === model);
  if (legacy) catalog = { ...catalog, units: 2, inventoryRevision: 0, groups: [
    { zone: "access", count: 4, type: "RJ45_10G", speed: 10000, poe: false, prefix: "NIC" },
    { zone: "management", count: 1, type: "RJ45_1G", speed: 1000, poe: false, prefix: "iDRAC" },
  ] };
  const device = instantiateProfile(catalog, model, { x: 30, y: 40 });
  device.id = model;
  for (const port of device.ports) port.id = `saved-${port.portIndex}`;
  return device;
}

for (const expected of cases) {
  test(`${expected.model} has the individual selected chassis and complete fixed I/O`, () => {
    const device = deviceFor(expected.model);
    const profile = resolveEquipmentFaceplate(device);
    assert.equal(device.faceplate.unitsU, expected.units);
    assert.equal(device.faceplate.inventoryRevision, 1);
    assert.equal(profile.fidelity, "model");
    assert.deepEqual(profile.evidence.models, [expected.model]);
    assert.ok(["www.dell.com", "i.dell.com", "www.delltechnologies.com"].includes(new URL(profile.source).hostname));
    assert.equal(new URL(profile.evidence.rear).protocol, "https:");
    assert.ok(profile.evidence.configuration.includes(`${expected.watts || 600}W`));
    assert.equal(device.ports.length, expected.endpoints);
    assert.deepEqual(device.ports.slice(0, 2).map((port) => [port.type, port.speedMbps]), [["RJ45_1G", 1000], ["RJ45_1G", 1000]]);
    const bounds = { x: 20, y: 50, width: 690, height: expected.units * 100 };
    const scenes = ["front", "rear"].map((face) => buildFaceplateScene(device, bounds, { face }));
    assert.equal(scenes[0].ports.length, 1);
    assert.equal(scenes[0].ports[0].port.type, "USB_MICRO_CONSOLE");
    assert.equal(scenes[1].ports.length, expected.endpoints - 1);
    assert.equal(scenes[0].unmappedPorts.length + scenes[1].unmappedPorts.length, 0);
    assert.equal(new Set(scenes.flatMap((scene) => scene.ports.map((box) => box.port.id))).size, expected.endpoints);
    for (const scene of scenes) for (const box of scene.ports) {
      assert.ok(box.labelPlacement.y - 5.5 >= scene.chassis.y, `${expected.model} caption above chassis`);
      assert.ok(box.labelPlacement.y + 5.5 <= scene.chassis.y + scene.chassis.height, `${expected.model} caption below chassis`);
    }
    assert.equal(profile.faces.front.components.filter((part) => part.kind === "drive-carrier").length, expected.drives);
    assert.equal(profile.faces.rear.components.filter((part) => part.kind === "psu").length, 2);
    assert.ok(profile.faces.rear.components.every((part) => part.kind !== "fan"));
    assert.equal(resolveEquipmentFaceplate(device), profile);
  });

  test(`${expected.model} preserves saved 2U occupancy and old identities without inventing extra NICs`, () => {
    const device = deviceFor(expected.model, true);
    device.rackId = "existing-rack";
    device.rackPosition = 17;
    device.ports.reverse();
    const nic = device.ports.find((port) => port.portIndex === 2);
    nic.label = "Production uplink";
    nic.nativeVlan = 14;
    nic.allowedVlans = [14, 26];
    device.ports.find((port) => port.portIndex === 5).label = "Renamed management";
    const snapshot = structuredClone(device);
    assert.equal(upgradeInstalledPhysicalPorts({ devices: [device] }), false);
    const rear = buildFaceplateScene(device, { x: 30, y: 40, width: 690, height: 200 }, { face: "rear" });
    assert.deepEqual(rear.ports.map((box) => box.port.id), ["saved-5", "saved-2", "saved-1"]);
    assert.deepEqual(rear.unmappedPorts.map((port) => port.id), ["saved-4", "saved-3"]);
    assert.equal(rear.ports.find((box) => box.port.id === "saved-2").displayLabel, "Production uplink");
    assert.equal(rear.ports.find((box) => box.port.id === "saved-2").port.type, "RJ45_10G");
    assert.equal(rear.ports.find((box) => box.port.id === "saved-5").displayLabel, "Renamed management");
    assert.equal(rear.hiddenPorts.length, 2);
    const current = buildFaceplateScene(deviceFor(expected.model), { x: 30, y: 40, width: 690, height: 200 }, { face: "rear" });
    for (const [oldIndex, newIndex] of [[1, 1], [2, 2], [5, 3]]) {
      const oldBox = rear.ports.find((box) => box.port.portIndex === oldIndex);
      const newBox = current.ports.find((box) => box.port.portIndex === newIndex);
      assert.deepEqual([oldBox.centerX, oldBox.centerY], [newBox.centerX, newBox.centerY]);
    }
    assert.deepEqual(device, snapshot);
    device.ports = device.ports.filter((port) => [2, 4, 5].includes(port.portIndex));
    delete device.faceplate.inventoryRevision;
    assert.deepEqual(buildFaceplateScene(device, { x: 0, y: 0, width: 690, height: 200 }, { face: "rear" }).ports.map((box) => box.port.id), ["saved-5", "saved-2"]);
    device.faceplate.inventoryRevision = 8;
    assert.equal(buildFaceplateScene(device, { x: 0, y: 0, width: 690, height: 200 }).unmappedPorts.length, 3);
  });
}

test("R450's eight carriers follow the documented three-upper/five-lower arrangement", () => {
  const profile = resolveEquipmentFaceplate(deviceFor("PowerEdge R450"));
  const drives = profile.faces.front.components.filter((part) => part.kind === "drive-carrier");
  assert.equal(drives.filter((part) => part.y < .4).length, 3);
  assert.equal(drives.filter((part) => part.y >= .4).length, 5);
  assert.equal(profile.faces.front.components.filter((part) => part.kind === "vga").length, 1);
});

test("R650 and R6525 retain their uneven eight-drive front while R6615 reserves the central ventilation bay", () => {
  const profiles = ["R650", "R6525", "R6615"].map((model) => resolveEquipmentFaceplate(deviceFor(`PowerEdge ${model}`)));
  for (const profile of profiles) {
    assert.deepEqual(profile.faces.rear.components.filter((part) => part.kind === "psu").map((part) => part.variant),
      ["ac-inlet-right-sideways", "ac-inlet-right-sideways"],
      "narrow supplies have a sideways C14 inlet with horizontal blades and an orange latch");
  }
  for (const profile of profiles.slice(0, 2)) {
    const drives = profile.faces.front.components.filter((part) => part.kind === "drive-carrier");
    assert.equal(drives.filter((part) => part.y < .5).length, 3);
    assert.equal(drives.filter((part) => part.y >= .5).length, 5);
    assert.equal(profile.faces.rear.components.filter((part) => part.role === "pcie-cover").length, 3);
  }
  const r6615 = profiles[2];
  const drives = r6615.faces.front.components.filter((part) => part.kind === "drive-carrier");
  assert.equal(drives.filter((part) => part.x < .45).length, 4);
  assert.equal(drives.filter((part) => part.x > .55).length, 4);
  assert.ok(drives.every((part) => part.x + part.width < .45 || part.x > .55));
  assert.equal(r6615.faces.rear.components.filter((part) => part.role === "pcie-cover").length, 2);
  assert.match(r6615.evidence.configuration, /optional two-port 1GbE LOM installed/);
});

test("R750, R7525 and R7615 use their own vertical drive and eight-slot rear layouts with wide C20 supplies", () => {
  const layouts = [];
  for (const model of ["R750", "R7525", "R7615"]) {
    const profile = resolveEquipmentFaceplate(deviceFor(`PowerEdge ${model}`));
    const drives = profile.faces.front.components.filter((part) => part.kind === "drive-carrier");
    assert.equal(new Set(drives.map((part) => part.y)).size, 1);
    assert.ok(drives.every((part) => part.width < .05 && part.height > .7));
    assert.equal(profile.faces.rear.components.filter((part) => part.role === "pcie-cover").length, 8);
    assert.deepEqual(profile.faces.rear.components.filter((part) => part.kind === "psu").map((part) => part.variant),
      ["ac-fan-left-c20", "ac-fan-left-c20"]);
    assert.equal(profile.faces.rear.components.filter((part) => part.role === "ocp-blank").length, 1);
    assert.ok(profile.faces.rear.components.filter((part) => part.kind === "drive-carrier").every((part) => part.variant === "boss"),
      "selected rear has boot carriers but no rear storage-drive module");
    layouts.push(profile.faces.rear.ports.map((port) => [port.x, port.y]));
    assert.match(profile.evidence.configuration, model === "R7615" ? /BOSS-N1/ : /BOSS-S2/);
  }
  assert.notDeepEqual(layouts[0], layouts[1]);
  assert.notDeepEqual(layouts[1], layouts[2]);
});

test("R350 fixed serial and model-specific VGA positions differ from optional-serial server chassis", () => {
  const r350 = resolveEquipmentFaceplate(deviceFor("PowerEdge R350"));
  const serial = r350.faces.rear.ports.find((port) => port.type === "Console");
  assert.equal(serial.connectorKind, "db9");
  assert.ok(serial.x < r350.faces.rear.ports.find((port) => port.portIndex === 1).x);
  assert.equal(r350.faces.front.components.filter((part) => part.kind === "vga").length, 0);
  for (const model of ["PowerEdge R450", "PowerEdge R550"]) {
    const profile = resolveEquipmentFaceplate(deviceFor(model));
    assert.ok(profile.faces.rear.ports.every((port) => port.type !== "Console"));
    assert.equal(profile.faces.front.components.filter((part) => part.kind === "vga").length, 1);
  }
});

test("R350 identification artwork distinguishes its small CMA jack from the larger ID button and power supplies", () => {
  const rear = resolveEquipmentFaceplate(deviceFor("PowerEdge R350")).faces.rear;
  const cma = rear.components.find((part) => part.kind === "service-jack");
  assert.ok(cma, "the CMA LED cable socket has its own service-connector semantics");
  const identification = rear.components.find((part) => part.kind === "button");
  assert.ok(cma.x < identification.x && cma.width < identification.width);
  assert.ok(rear.components.every((part) => part.kind !== "power"), "the chassis has no separate barrel power input");
});
