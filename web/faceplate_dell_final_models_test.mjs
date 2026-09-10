import assert from "node:assert/strict";
import { test } from "node:test";
import { hardwareCatalog, instantiateProfile, upgradeInstalledPhysicalPorts } from "./static/js/catalog.js";
import { buildDellModelFaceplate } from "./static/js/faceplate-dell-models.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";

const cases = [
  { model: "PowerSwitch S5248", sku: "S5248F-ON", units: 1, total: 57, front: 54, rear: 3, fans: 4, oldMapped: 56, services: [55, 56] },
  { model: "PowerSwitch Z9264", sku: "Z9264F-ON", units: 2, total: 69, front: 69, rear: 0, fans: 4, oldMapped: 56, services: [67, 68] },
  { model: "PowerSwitch Z9332", sku: "Z9332F-ON", units: 1, total: 36, front: 36, rear: 0, fans: 7, oldMapped: 36, services: [35, 36] },
];

/** Build a current device or the independently reconstructed historical generic 56-port, 1U population. */
function deviceFor(model, legacy = false) {
  let catalog = hardwareCatalog.find((entry) => entry.vendor === "Dell" && entry.model === model);
  if (legacy) catalog = { ...catalog, units: 1, inventoryRevision: 0, groups: [
    { zone: "uplink", count: 48, type: "SFP28_25G", speed: 25000, prefix: "SFP28" },
    { zone: "uplink", count: 6, type: "QSFP28_100G", speed: 100000, prefix: "QSFP28" },
    { zone: "management", count: 1, type: "RJ45_1G", speed: 1000, prefix: "MGMT" },
    { zone: "management", count: 1, type: "Console", speed: 0, prefix: "CONSOLE" },
  ] };
  const device = instantiateProfile(catalog, model, { x: 0, y: 0 });
  for (const port of device.ports) port.id = `saved-${port.portIndex}`;
  return device;
}

/** Gather front and rear runtime sockets while retaining the original device's saved rack allocation. */
function scenesFor(device) {
  return ["front", "rear"].map((face) => buildFaceplateScene(device,
    { x: 0, y: 0, width: 690, height: device.faceplate.unitsU * 100 }, { face }));
}

for (const expected of cases) {
  test(`${expected.model} resolves its disclosed full SKU and complete individually sourced panel population`, () => {
    const device = deviceFor(expected.model);
    const profile = buildDellModelFaceplate(device);
    assert.ok(profile, "short catalog name requires an exact full-SKU selection");
    assert.equal(profile.sku, expected.sku);
    assert.equal(profile.fidelity, "model");
    assert.equal(profile.inventoryRevision, 1);
    assert.equal(profile.inventoryComplete, true);
    assert.equal(profile.rearHardwareVerified, true);
    assert.equal(device.faceplate.unitsU, expected.units);
    assert.equal(device.ports.length, expected.total);
    assert.equal(new URL(profile.source).hostname, "dl.dell.com");
    assert.deepEqual(profile.evidence.models, [expected.model]);
    assert.ok(profile.evidence.configuration.includes(expected.sku));
    assert.ok(profile.evidence.front.includes("#page="));
    assert.ok(profile.evidence.rear.includes("#page="));
    assert.ok(!profile.evidence.panelDetail?.includes("XC_Series"), "new models must not inherit unrelated prior XC evidence");
    const scenes = scenesFor(device);
    assert.deepEqual(scenes.map((scene) => scene.ports.length), [expected.front, expected.rear]);
    assert.equal(scenes.flatMap((scene) => scene.unmappedPorts).length, 0);
    assert.equal(new Set(scenes.flatMap((scene) => scene.ports).map((port) => port.port.id)).size, expected.total);
    assert.equal(profile.faces.rear.components.filter((part) => part.kind === "fan").length, expected.fans);
    assert.equal(profile.faces.rear.components.filter((part) => part.kind === "psu").length, 2);
  });

  test(`${expected.model} retains reordered, renamed, gapped and unversioned saved endpoints and their settings`, () => {
    const device = deviceFor(expected.model, true);
    delete device.faceplate.inventoryRevision;
    device.ports.reverse();
    for (const port of device.ports) {
      port.label = [55, 56].includes(port.portIndex) ? String(port.portIndex - 54) : `Custom ${port.portIndex}`;
      port.isPoe = true; port.nativeVlan = 81; port.allowedVlans = [81, 92];
    }
    const before = structuredClone(device);
    assert.equal(upgradeInstalledPhysicalPorts({ devices: [device] }), false);
    const scenes = scenesFor(device); const visible = scenes.flatMap((scene) => scene.ports);
    assert.equal(visible.length, expected.oldMapped);
    const canonical = scenesFor(deviceFor(expected.model)).flatMap((scene) => scene.ports);
    for (const [offset, currentIndex] of expected.services.entries()) {
      const oldIndex = 55 + offset;
      const saved = visible.find((port) => port.port.portIndex === oldIndex);
      const current = canonical.find((port) => port.port.portIndex === currentIndex);
      assert.ok(saved); assert.ok(current);
      assert.equal(saved.displayLabel, String(offset + 1));
      assert.equal(saved.port.isPoe, true);
      assert.equal(saved.port.id, `saved-${oldIndex}`);
      assert.equal(saved.centerX, current.centerX);
    }
    assert.deepEqual(device, before);
    assert.equal(device.faceplate.unitsU, 1, "saved rack allocation must not be silently increased");
    device.ports = device.ports.filter((port) => [1, 33, 34, 35, 49, 55, 56].includes(port.portIndex));
    const sparse = structuredClone(device);
    const retained = scenesFor(device).flatMap((scene) => scene.ports).map((port) => port.port.portIndex).sort((a, b) => a - b);
    assert.deepEqual(retained, expected.model.endsWith("Z9332") ? [1, 33, 34, 55, 56] : [1, 33, 34, 35, 49, 55, 56]);
    assert.deepEqual(device, sparse);
    device.faceplate.inventoryRevision = 99;
    const unknown = scenesFor(device)[0];
    assert.equal(unknown.ports.length, 0);
    assert.equal(unknown.unmappedPorts.length, 7);
  });
}

test("S5248's paired logical DD labels are one physical socket each and its short-entry services retain their role order", () => {
  const device = deviceFor(cases[0].model); const profile = buildDellModelFaceplate(device);
  assert.deepEqual(device.ports.slice(48, 54).map((port) => port.type),
    ["QSFP_DD_200G", "QSFP_DD_200G", ...Array(4).fill("QSFP28_100G")]);
  assert.deepEqual(profile.faces.front.ports.slice(48).map((port) => port.physicalLabel), ["49/50", "51/52", "53", "54", "55", "56"]);
  const service = new Map(profile.faces.rear.ports.map((port) => [port.portIndex, port]));
  assert.equal(service.get(55).physicalLabel, "MGMT"); assert.equal(service.get(56).physicalLabel, "CONSOLE");
  assert.ok(service.get(55).y < service.get(56).y && service.get(56).y < service.get(57).y);
  assert.equal(service.get(57).type, "USB_MICRO_CONSOLE");
  assert.ok(profile.faces.rear.components.filter((part) => part.kind === "fan").every((part) => part.variant === "dell-radial-handle"));
  assert.ok(profile.faces.rear.components.filter((part) => part.kind === "psu").every((part) => part.variant === "ac-fan-right-sideways"));
  const full = hardwareCatalog.find((entry) => entry.model === "PowerSwitch S5248F-ON");
  const prior = buildDellModelFaceplate(instantiateProfile(full, "unchanged full SKU", { x: 0, y: 0 }));
  assert.equal(prior.faces.rear.ports.find((port) => port.portIndex === 55).physicalLabel, "CONSOLE");
});

test("Z9264's four numbered rows, lower-right SFP pair and console-top service cluster follow the exact primary photo", () => {
  const device = deviceFor(cases[1].model); const profile = buildDellModelFaceplate(device);
  assert.ok(device.ports.slice(0, 64).every((port) => port.type === "QSFP28_100G"));
  assert.ok(device.ports.slice(64, 66).every((port) => port.type === "SFP_PLUS_10G"));
  const slots = new Map(profile.faces.front.ports.map((port) => [port.portIndex, port]));
  for (const start of [1, 33]) {
    for (let index = start; index < start + 32; index += 2) {
      assert.equal(slots.get(index).x, slots.get(index + 1).x);
      assert.ok(slots.get(index).y < slots.get(index + 1).y);
    }
  }
  assert.equal(slots.get(1).x, slots.get(33).x);
  assert.ok(slots.get(2).y < slots.get(33).y);
  assert.ok(slots.get(65).x > slots.get(64).x && slots.get(65).y < slots.get(66).y);
  assert.ok(slots.get(68).y < slots.get(67).y && slots.get(68).x < slots.get(1).x);
  assert.equal(slots.get(69).type, "USB_MICRO_CONSOLE");
  const display = profile.faces.front.components.find((part) => part.kind === "lcd");
  assert.equal(display.digits, 1); assert.ok(display.x > .9);
  const psus = profile.faces.rear.components.filter((part) => part.kind === "psu");
  assert.equal(psus[0].x, psus[1].x); assert.ok(psus[0].y < psus[1].y);
  assert.ok(profile.faces.rear.components.filter((part) => part.kind === "fan").every((part) => part.gripColor === "#9daeb8"));
  assert.ok(profile.catalogDiscrepancies.some((note) => note.includes("page32") && note.includes("reverses")));
  assert.ok(scenesFor(device)[0].ports.every((port) => port.height <= 23), "2U must not stretch sockets to oversized dimensions");
});

test("Z9332 has only36 sockets, covered seven-fan rear hardware and explicitly AC-only supply selection", () => {
  const device = deviceFor(cases[2].model); const profile = buildDellModelFaceplate(device);
  assert.ok(device.ports.slice(0, 32).every((port) => port.type === "QSFP_DD_400G" && port.speedMbps === 400000));
  assert.ok(device.ports.slice(32, 34).every((port) => port.type === "SFP_PLUS_10G"));
  assert.ok(!device.ports.some((port) => port.type.startsWith("USB_")));
  const slots = new Map(profile.faces.front.ports.map((port) => [port.portIndex, port]));
  for (let index = 1; index < 34; index += 2) {
    assert.equal(slots.get(index).x, slots.get(index + 1).x);
    assert.ok(slots.get(index).y < slots.get(index + 1).y);
  }
  assert.ok(slots.get(36).y < slots.get(35).y);
  assert.ok(profile.faces.rear.components.filter((part) => part.kind === "fan").every((part) => part.variant === "dell-z9332-covered"));
  assert.ok(profile.faces.rear.components.filter((part) => part.kind === "psu").every((part) => part.variant === "dell-z9332-ac"));
  assert.ok(profile.evidence.configuration.includes("200–240"));
  assert.ok(profile.catalogDiscrepancies.some((note) => note.includes("35–54") && note.includes("unmapped")));
  const legacy = scenesFor(deviceFor(cases[2].model, true))[0];
  assert.deepEqual(legacy.unmappedPorts.map((port) => port.portIndex).sort((a, b) => a - b), Array.from({ length: 20 }, (_, index) => index + 35));
});

test("Z9264 groups compact paired captions outside all four physical socket rows", () => {
  for (const legacy of [false, true]) {
    const scene = scenesFor(deviceFor(cases[1].model, legacy))[0];
    const captions = [];
    for (const port of scene.ports) {
      const label = port.labelPlacement;
      const width = Math.min(label.boxMaxWidth, port.displayLabel.length * label.fontSize * .7 + 6);
      const caption = { x: label.x - width / 2, y: label.y - label.boxHeight / 2, width, height: label.boxHeight };
      assert.ok(caption.x >= scene.chassis.x && caption.x + caption.width <= scene.chassis.x + scene.chassis.width &&
        caption.y >= scene.chassis.y && caption.y + caption.height <= scene.chassis.y + scene.chassis.height,
      `caption ${port.displayLabel} leaves the chassis at ${legacy ? "saved1U" : "new2U"}`);
      for (const other of captions) assert.ok(!(caption.x < other.x + other.width && caption.x + caption.width > other.x &&
        caption.y < other.y + other.height && caption.y + caption.height > other.y), `caption ${port.displayLabel} overlaps another caption`);
      captions.push(caption);
      for (const socket of scene.ports) assert.ok(!(caption.x < socket.x + socket.width &&
        caption.x + caption.width > socket.x && caption.y < socket.y + socket.height && caption.y + caption.height > socket.y),
      `caption ${port.displayLabel} covers socket ${socket.displayLabel}`);
    }
  }
});
