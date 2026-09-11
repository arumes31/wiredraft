import assert from "node:assert/strict";
import { test } from "node:test";
import { hardwareCatalog, instantiateProfile, upgradeInstalledPhysicalPorts } from "./static/js/catalog.js";
import { resolveArubaFaceplate } from "./static/js/faceplate-aruba-models.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";

const cases = [
  { series: "6000", sku: "R8N85A", total: 53, optical: "SFP_1G", speed: 1000, management: false },
  { series: "6100", sku: "JL675A", total: 53, optical: "SFP_PLUS_10G", speed: 10000, management: false },
  { series: "6200", sku: "JL727A", total: 54, optical: "SFP_PLUS_10G", speed: 10000, management: true },
  { series: "6300", sku: "JL661A", total: 54, optical: "SFP56_50G", speed: 50000, management: true },
];

/** Instantiate a selected current SKU or the historical groups with constructor-defined zone ordering. */
function deviceFor(series, legacy = false) {
  let entry = hardwareCatalog.find((item) => item.vendor === "HPE Aruba" && item.model === `CX ${series} family`);
  if (legacy) entry = { ...entry, inventoryRevision: 0, groups: [
    { zone: "access", count: 48, type: "RJ45_1G", speed: 1000, prefix: "", poe: true },
    { zone: "uplink", count: 4, type: "SFP56_50G", speed: 50000, prefix: "SFP56" },
    { zone: "management", count: 1, type: "RJ45_1G", speed: 1000, prefix: "MGMT" },
    { zone: "management", count: 1, type: "USB_C_CONSOLE", speed: 0, prefix: "CONSOLE" },
    { zone: "uplink", count: 2, type: "Stack", speed: 40000, prefix: "VSF" },
  ] };
  const device = instantiateProfile(entry, entry.model, { x: 0, y: 0 });
  for (const port of device.ports) port.id = `retained-${port.portIndex}`;
  return device;
}

/** Resolve the actual front scene at the existing one-rack-unit allocation. */
function sceneFor(device) {
  return buildFaceplateScene(device, { x: 0, y: 0, width: 690, height: 100 }, { face: "front" });
}

for (const expected of cases) {
  test(`CX ${expected.series} alias selects its documented ${expected.sku} panels and real connector inventory`, () => {
    const device = deviceFor(expected.series); const profile = resolveArubaFaceplate(device);
    assert.ok(profile, "every alias needs an explicit selected full SKU");
    assert.equal(profile.sku, expected.sku); assert.equal(profile.fidelity, "model");
    assert.equal(profile.inventoryRevision, 1); assert.equal(profile.inventoryComplete, true);
    assert.equal(profile.rearHardwareVerified, true);
    assert.equal(profile.evidence.catalogAlias, device.model);
    assert.equal(profile.evidence.selectedModel, expected.sku);
    assert.deepEqual(profile.evidence.models, [expected.sku]);
    assert.ok(profile.evidence.front && profile.evidence.rear && profile.evidence.configuration.includes(expected.sku));
    assert.equal(device.ports.length, expected.total);
    assert.ok(device.ports.slice(0, 48).every((port) => port.type === "RJ45_1G" && port.isPoe));
    assert.ok(device.ports.slice(48, 52).every((port) => port.type === expected.optical && port.speedMbps === expected.speed));
    assert.ok(!device.ports.some((port) => port.type === "Stack"), "VSF uses data ports, not extra dedicated sockets");
    const scene = sceneFor(device);
    assert.equal(scene.ports.length, expected.total); assert.equal(scene.unmappedPorts.length, 0);
    assert.equal(profile.faces.rear.ports.length, 0);
    const slots = new Map(profile.faces.front.ports.map((slot) => [slot.portIndex, slot]));
    for (let index = 1; index < 52; index += 2) {
      assert.equal(slots.get(index).x, slots.get(index + 1).x);
      assert.ok(slots.get(index).y < slots.get(index + 1).y, "paired arrows specify odd upper/even lower");
    }
    assert.equal(slots.get(expected.total).physicalLabel, "CONSOLE");
    if (expected.management) assert.equal(slots.get(53).physicalLabel, "MGMT");
  });

  test(`CX ${expected.series} keeps saved current edits and explicitly maps actual historical service indices`, () => {
    const current = deviceFor(expected.series);
    const freshPort = current.ports[expected.management ? 52 : 0];
    freshPort.speedMbps = 100; freshPort.group = "Edited group"; freshPort.isPoe = false;
    const freshBefore = structuredClone(current);
    assert.equal(upgradeInstalledPhysicalPorts({ devices: [current] }), false);
    assert.deepEqual(current, freshBefore, "default captions must not cause current saved settings to be repaired");
    const old = deviceFor(expected.series, true);
    assert.deepEqual(old.ports.slice(52).map((port) => [port.portIndex, port.type]),
      [[53, "Stack"], [54, "Stack"], [55, "RJ45_1G"], [56, "USB_C_CONSOLE"]]);
    delete old.faceplate.inventoryRevision; old.ports.reverse();
    for (const port of old.ports) {
      port.label = port.portIndex === 56 ? "1" : `Custom ${port.portIndex}`;
      port.speedMbps = 100; port.isPoe = false; port.nativeVlan = 77; port.allowedVlans = [77, 99];
    }
    const before = structuredClone(old);
    assert.equal(upgradeInstalledPhysicalPorts({ devices: [old] }), false);
    const scene = sceneFor(old); const canonical = sceneFor(deviceFor(expected.series));
    assert.equal(scene.ports.length, expected.total);
    assert.deepEqual(scene.unmappedPorts.map((port) => port.portIndex).sort((a, b) => a - b), expected.management ? [53, 54] : [53, 54, 55]);
    for (const [previous, next] of [[56, expected.total], ...(expected.management ? [[55, 53]] : [])]) {
      const retained = scene.ports.find((port) => port.port.portIndex === previous);
      const slot = canonical.ports.find((port) => port.port.portIndex === next);
      assert.equal(retained.centerX, slot.centerX); assert.equal(retained.centerY, slot.centerY);
      assert.equal(retained.port.id, `retained-${previous}`);
      if (previous === 56) assert.equal(retained.displayLabel, "1", "custom captions never identify another socket");
    }
    assert.deepEqual(old, before);
    old.ports = old.ports.filter((port) => [1, 49, 53, 55, 56].includes(port.portIndex));
    assert.equal(sceneFor(old).ports.length, expected.management ? 4 : 3);
    old.faceplate.inventoryRevision = 99;
    assert.equal(sceneFor(old).ports.length, 0); assert.equal(sceneFor(old).unmappedPorts.length, 5);
  });
}

test("Aruba alias rear hardware preserves fixed cooling versus the selected two-tray modular configuration", () => {
  for (const series of ["6000", "6100"]) {
    const profile = resolveArubaFaceplate(deviceFor(series));
    assert.equal(profile.faces.rear.components.filter((part) => part.kind === "power").length, 1);
    assert.equal(profile.faces.rear.components.find((part) => part.kind === "power").variant, "ac-c14");
    assert.equal(profile.faces.rear.components.filter((part) => part.kind === "fan").length, 0);
    assert.equal(profile.faces.front.components.filter((part) => part.kind === "button").length, 2);
  }
  const fixed = resolveArubaFaceplate(deviceFor("6200"));
  assert.equal(fixed.faces.rear.components.filter((part) => part.variant === "aruba-fixed-radial").length, 3);
  assert.equal(fixed.faces.rear.components.find((part) => part.kind === "power").variant, "ac-sideways");
  const modular = resolveArubaFaceplate(deviceFor("6300"));
  assert.equal(modular.faces.rear.components.filter((part) => part.variant === "aruba-dual-hex").length, 2);
  assert.equal(modular.faces.rear.components.filter((part) => part.kind === "psu" && part.variant === "hpe-flexslot-800").length, 2);
  assert.match(modular.evidence.configuration, /JL086A.*680W/);
  assert.match(modular.evidence.configuration, /JL669B/);
  assert.ok(!modular.evidence.configuration.includes("800W"));
  const topVent = modular.faces.front.components.find((part) => part.kind === "vent");
  assert.ok(topVent.height >= .12 && topVent.y + topVent.height <= .15 && topVent.x + topVent.width <= .70,
    "the visible top ventilation strip ends before the status indicators");
});

test("Aruba alias printed captions stay inside the chassis and clear every socket", () => {
  for (const { series } of cases) {
    const scene = sceneFor(deviceFor(series)); const captions = [];
    for (const port of scene.ports) {
      const label = port.labelPlacement;
      const width = Math.min(label.boxMaxWidth, port.displayLabel.length * label.fontSize * .7 + 6);
      const caption = { x: label.x - width / 2, y: label.y - label.boxHeight / 2, width, height: label.boxHeight };
      assert.ok(caption.x >= scene.chassis.x && caption.x + caption.width <= scene.chassis.x + scene.chassis.width &&
        caption.y >= scene.chassis.y && caption.y + caption.height <= scene.chassis.y + scene.chassis.height,
      `${series} caption ${port.displayLabel} leaves the chassis`);
      for (const box of [...captions, ...scene.ports, ...scene.components.filter((item) => !item.applicationOverlay)]) assert.ok(!(caption.x < box.x + box.width && caption.x + caption.width > box.x &&
        caption.y < box.y + box.height && caption.y + caption.height > box.y), `${series} caption ${port.displayLabel} overlaps hardware or another caption`);
      captions.push(caption);
    }
  }
});
