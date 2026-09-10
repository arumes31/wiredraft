import assert from "node:assert/strict";
import { test } from "node:test";
import { hardwareCatalog, instantiateProfile, upgradeInstalledPhysicalPorts } from "./static/js/catalog.js";
import { buildDellModelFaceplate } from "./static/js/faceplate-dell-models.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";

const bounds = { x: 0, y: 0, width: 690, height: 100 };
const cases = [
  { model: "PowerSwitch S3048", sku: "S3048-ON", total: 54, front: 54, rear: 0, fans: 3, optical: 4 },
  { model: "PowerSwitch S4048", sku: "S4048-ON", total: 57, front: 55, rear: 2, fans: 3, optical: 54 },
  { model: "PowerSwitch S5048", sku: "S5048F-ON", total: 57, front: 54, rear: 3, fans: 4, optical: 54 },
];

/** Reconstruct the historical shared 56-endpoint catalog row independently of its corrected population. */
function deviceFor(model, legacy = false) {
  let catalog = hardwareCatalog.find((entry) => entry.vendor === "Dell" && entry.model === model);
  if (legacy) catalog = { ...catalog, inventoryRevision: 0, groups: [
    { zone: "uplink", count: 48, type: "SFP28_25G", speed: 25000, prefix: "SFP28" },
    { zone: "uplink", count: 6, type: "QSFP28_100G", speed: 100000, prefix: "QSFP28" },
    { zone: "management", count: 1, type: "RJ45_1G", speed: 1000, prefix: "MGMT" },
    { zone: "management", count: 1, type: "Console", speed: 0, prefix: "CONSOLE" },
  ] };
  const device = instantiateProfile(catalog, model, { x: 0, y: 0 });
  for (const port of device.ports) port.id = `saved-${port.portIndex}`;
  return device;
}

for (const expected of cases) {
  test(`${expected.model} selects individually documented ${expected.sku} panels and complete inventory`, () => {
    const device = deviceFor(expected.model);
    const profile = buildDellModelFaceplate(device);
    assert.ok(profile, "the short entry must resolve a documented exact SKU");
    assert.equal(profile.sku, expected.sku);
    assert.equal(profile.fidelity, "model");
    assert.equal(profile.inventoryRevision, 1);
    assert.equal(profile.inventoryComplete, true);
    assert.equal(profile.rearHardwareVerified, true);
    assert.deepEqual(profile.evidence.models, [expected.model]);
    assert.equal(new URL(profile.source).hostname, "dl.dell.com");
    assert.ok(profile.evidence.front.includes("#page="));
    assert.ok(profile.evidence.rear.includes("#page="));
    assert.ok(profile.evidence.configuration.includes(expected.sku));
    assert.equal(device.ports.length, expected.total);
    const front = buildFaceplateScene(device, bounds, { face: "front" });
    const rear = buildFaceplateScene(device, bounds, { face: "rear" });
    assert.equal(front.ports.length, expected.front);
    assert.equal(rear.ports.length, expected.rear);
    assert.equal(front.unmappedPorts.length + rear.unmappedPorts.length, 0);
    assert.equal(new Set([...front.ports, ...rear.ports].map((port) => port.port.id)).size, expected.total);
    assert.equal(profile.faces.rear.components.filter((part) => part.kind === "fan").length, expected.fans);
    assert.equal(profile.faces.rear.components.filter((part) => part.kind === "psu").length, 2);
    assert.equal(profile.faces.front.ports.filter((port) => /^(SFP|QSFP)/.test(port.type)).length, expected.optical);
  });

  test(`${expected.model} preserves reordered, renamed and gapped revision-zero endpoints without changing settings`, () => {
    const device = deviceFor(expected.model, true);
    device.ports.reverse();
    for (const port of device.ports) {
      if ([1, 49, 55, 56].includes(port.portIndex)) port.label = `Configured ${port.portIndex}`;
      port.nativeVlan = 72; port.allowedVlans = [72, 81]; port.isPoe = true;
    }
    const before = structuredClone(device);
    assert.equal(upgradeInstalledPhysicalPorts({ devices: [device] }), false);
    const scenes = ["front", "rear"].map((face) => buildFaceplateScene(device, bounds, { face }));
    const ports = scenes.flatMap((scene) => scene.ports);
    assert.equal(ports.length, expected.model.endsWith("S3048") ? 54 : 56);
    assert.deepEqual(scenes[0].unmappedPorts.map((port) => port.portIndex).sort((a, b) => a - b),
      expected.model.endsWith("S3048") ? [53, 54] : []);
    for (const index of [1, 49, 55, 56]) {
      const port = ports.find((box) => box.port.id === `saved-${index}`);
      assert.equal(port.displayLabel, `Configured ${index}`);
      assert.equal(port.port.speedMbps, before.ports.find((item) => item.portIndex === index).speedMbps);
      assert.equal(port.port.isPoe, true);
    }
    assert.deepEqual(device, before);
    device.ports = device.ports.filter((port) => [1, 49, 53, 55, 56].includes(port.portIndex));
    const partial = structuredClone(device);
    const sparse = ["front", "rear"].flatMap((face) => buildFaceplateScene(device, bounds, { face }).ports);
    assert.deepEqual(sparse.map((port) => port.port.id).sort(),
      [1, 49, ...(expected.model.endsWith("S3048") ? [] : [53]), 55, 56].map((index) => `saved-${index}`).sort());
    assert.deepEqual(device, partial);
    device.faceplate.inventoryRevision = 99;
    const unknown = buildFaceplateScene(device, bounds);
    assert.equal(unknown.ports.length, 0);
    assert.equal(unknown.unmappedPorts.length, 5);
  });
}

test("S3048 corrects copper and 10G cages while surplus old optics cannot capture its service sockets", () => {
  const current = deviceFor(cases[0].model);
  assert.deepEqual(current.ports.slice(0, 48).map((port) => [port.type, port.speedMbps]), Array(48).fill(["RJ45_1G", 1000]));
  assert.deepEqual(current.ports.slice(48, 52).map((port) => [port.type, port.speedMbps]), Array(4).fill(["SFP_PLUS_10G", 10000]));
  const profile = buildDellModelFaceplate(current);
  const indices = profile.legacyLayouts[0].portIndexMap;
  assert.equal(indices[55], 53); assert.equal(indices[56], 54);
  assert.equal(indices[53], undefined); assert.equal(indices[54], undefined);
  const old = buildFaceplateScene(deviceFor(cases[0].model, true), bounds);
  assert.equal(old.ports.find((port) => port.port.portIndex === 1).connectorKind, "rj45");
  assert.equal(old.ports.find((port) => port.port.portIndex === 49).connectorKind, "sfp");
  const mgmt = old.ports.find((port) => port.port.portIndex === 55);
  const serial = old.ports.find((port) => port.port.portIndex === 56);
  assert.ok(serial.centerY < mgmt.centerY);
  assert.equal(serial.centerX, mgmt.centerX);
  assert.equal(mgmt.displayLabel, "MGMT"); assert.equal(serial.displayLabel, "CONSOLE");
});

test("S4048 has 10G/40G cages, a front micro-USB console and three horizontal dual-fan trays", () => {
  const device = deviceFor(cases[1].model);
  assert.ok(device.ports.slice(0, 48).every((port) => port.type === "SFP_PLUS_10G" && port.speedMbps === 10000));
  assert.ok(device.ports.slice(48, 54).every((port) => port.type === "QSFP_PLUS_40G" && port.speedMbps === 40000));
  const profile = buildDellModelFaceplate(device);
  assert.equal(profile.faces.front.ports.find((port) => port.portIndex === 57).type, "USB_MICRO_CONSOLE");
  const fans = profile.faces.rear.components.filter((part) => part.kind === "fan");
  assert.ok(fans.every((part) => part.variant === "dell-dual-horizontal"));
  assert.ok(profile.faces.rear.ports.find((port) => port.portIndex === 55).y < profile.faces.rear.ports.find((port) => port.portIndex === 56).y);
  assert.ok(profile.catalogDiscrepancies.some((note) => note.includes("RJ45") && note.includes("prose")));
});

test("S5048 uses six separate QSFP28 sockets, a rear micro-USB console and fan-right AC supplies", () => {
  const profile = buildDellModelFaceplate(deviceFor(cases[2].model));
  assert.deepEqual(profile.faces.front.ports.filter((port) => port.type === "QSFP28_100G").map((port) => port.physicalLabel), ["49", "50", "51", "52", "53", "54"]);
  assert.ok(profile.faces.rear.components.filter((part) => part.kind === "psu").every((part) => part.variant === "ac-fan-right"));
  assert.ok(profile.faces.rear.components.filter((part) => part.kind === "fan").every((part) => part.variant === "dell-single-handle"));
  const slots = new Map(profile.faces.rear.ports.map((port) => [port.portIndex, port]));
  assert.ok(slots.get(55).y < slots.get(56).y && slots.get(56).y < slots.get(57).y);
  assert.equal(slots.get(57).type, "USB_MICRO_CONSOLE");
});

test("Dell's XC diagrams and stack-group assignments give odd upper ports and even lower ports in consecutive pairs", () => {
  for (const { model } of cases) {
    const profile = buildDellModelFaceplate(deviceFor(model));
    const slots = new Map(profile.faces.front.ports.map((port) => [port.portIndex, port]));
    for (let index = 1; index < 48; index += 2) {
      assert.equal(slots.get(index).x, slots.get(index + 1).x);
      assert.ok(slots.get(index).y < slots.get(index + 1).y);
    }
    for (let index = 49; index < (model.endsWith("S3048") ? 52 : 54); index += 2) {
      assert.equal(slots.get(index).x, slots.get(index + 1).x);
      assert.ok(slots.get(index).y < slots.get(index + 1).y);
      if (index > 49) assert.ok(slots.get(index).x > slots.get(index - 2).x);
    }
    for (const start of [17, 33]) assert.ok(slots.get(start).x > slots.get(start - 1).x);
  }
});

test("S4048's primary front detail places micro-USB above its single-digit display and storage socket", () => {
  const device = deviceFor(cases[1].model);
  const profile = buildDellModelFaceplate(device);
  assert.ok(profile.evidence.panelDetail.includes("XC_Series_Networking_Guide_v2.0.pdf#page=8"));
  assert.equal(profile.faces.front.components.find((part) => part.kind === "lcd").digits, 1);
  for (const rectangle of [bounds, { x: 60, y: 20, width: 1380, height: 200 }]) {
    const scene = buildFaceplateScene(device, rectangle);
    const micro = scene.ports.find((port) => port.port.portIndex === 57);
    const display = scene.components.find((part) => part.kind === "lcd");
    const storage = scene.components.find((part) => part.kind === "usb");
    assert.ok(micro.y + micro.height < display.y);
    assert.ok(display.y + display.height < storage.y);
    assert.ok(micro.labelPlacement.x > storage.x + storage.width);
  }
});

test("Unversioned S3048 services retain explicit roles even when their labels equal another port's number", () => {
  const device = deviceFor(cases[0].model, true);
  delete device.faceplate.inventoryRevision;
  device.ports.find((port) => port.portIndex === 55).label = "1";
  device.ports.find((port) => port.portIndex === 56).label = "49";
  const before = structuredClone(device);
  const scene = buildFaceplateScene(device, bounds);
  const actual = new Map(scene.ports.map((port) => [port.port.portIndex, port]));
  assert.notEqual(actual.get(55).centerX, actual.get(1).centerX);
  assert.notEqual(actual.get(56).centerX, actual.get(49).centerX);
  assert.equal(actual.get(55).displayLabel, "1");
  assert.equal(actual.get(56).displayLabel, "49");
  assert.deepEqual(device, before);
});
