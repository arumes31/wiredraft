import assert from "node:assert/strict";
import test from "node:test";
import { hardwareCatalog, instantiateProfile, upgradeInstalledPhysicalPorts } from "./static/js/catalog.js";
import { resolveHPEDL500Faceplate } from "./static/js/faceplate-hpe-dl500-models.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";

/** Construct independent legacy 2U inventory or the current explicitly selected DL580. */
function deviceFor(legacy = false, units = legacy ? 2 : 4) {
  let entry = hardwareCatalog.find((row) => row.model === "ProLiant DL580" && row.vendor === "HPE");
  if (legacy) entry = { ...entry, units: 2, inventoryRevision: 0, groups: [
    { zone: "access", count: 4, type: "RJ45_10G", speed: 10000, prefix: "NIC", poe: false },
    { zone: "management", count: 1, type: "RJ45_1G", speed: 1000, prefix: "iLO" },
  ] };
  const device = instantiateProfile(entry, "Saved DL580", { x: 10, y: 20 });
  device.id = "dl580"; device.faceplate.unitsU = units;
  for (const port of device.ports) { port.id = `dl580-${port.portIndex}`; port.deviceId = device.id; }
  return device;
}

test("DL580 selects its own 4U chassis, upper-left drive cage, sixteen slots and four AC supplies", () => {
  const entry = hardwareCatalog.find((row) => row.model === "ProLiant DL580");
  assert.equal(entry.units, 4);
  const device = deviceFor(); const profile = resolveHPEDL500Faceplate(device);
  assert.equal(profile.fidelity, "model"); assert.equal(profile.sku, "ProLiant DL580 Gen10 · 869854-B21");
  assert.equal(device.ports.length, 6); assert.equal(profile.faces.front.ports.length, 0);
  assert.equal(profile.faces.rear.ports.length, 6);
  assert.equal(profile.faces.rear.ports[5].connectorKind, "db9");
  const drives = profile.faces.front.components.filter((part) => part.kind === "drive-carrier");
  assert.equal(drives.length, 8); assert.ok(drives.every((part) => part.x < .34 && part.y < .1 && part.height < .5));
  assert.equal(profile.faces.front.components.filter((part) => part.role === "empty-drive-box").length, 5);
  assert.equal(profile.faces.front.components.filter((part) => part.kind === "usb").length, 3);
  const brackets = profile.faces.rear.components.filter((part) => part.role === "pcie-slot-cover");
  assert.deepEqual([brackets.filter((part) => part.x < .3).length, brackets.filter((part) => part.x >= .3 && part.x < .65).length, brackets.filter((part) => part.x >= .65).length], [7, 7, 2]);
  const power = profile.faces.rear.components.filter((part) => part.kind === "psu");
  assert.equal(power.length, 4); assert.equal(new Set(power.map((part) => part.x)).size, 2); assert.equal(new Set(power.map((part) => part.y)).size, 2);
  assert.ok(power.every((part) => part.sku === "865414-B21" && part.watts === 800 && part.active === false));
  assert.match(profile.note, /878214-B21/); assert.match(profile.note, /872340-B21/);
  assert.match(profile.note, /665240-B21/);
});

test("DL580 keeps its physical proportions inside old rack allocations without moving saved endpoints", () => {
  const native = buildFaceplateScene(deviceFor(), { x: 0, y: 0, width: 690, height: 400 }, { face: "rear" });
  for (const legacy of [false, true]) for (const units of [2, 4, 6]) {
    const device = deviceFor(legacy, units); device.rackId = "rack"; device.rackPosition = 12;
    device.ports.reverse(); device.ports = device.ports.filter((port) => port.portIndex !== 2);
    for (const port of device.ports) { port.label = "Custom"; port.speedMbps = 100; port.isPoe = true; port.group = "Saved"; port.nativeVlan = 3; port.allowedVlans = [3, 8]; }
    const before = structuredClone(device);
    assert.equal(upgradeInstalledPhysicalPorts({ devices: [device] }), false);
    const profile = resolveHPEDL500Faceplate(device);
    assert.equal(resolveHPEDL500Faceplate(device), profile, "allocation-specific geometry is cached");
    const scene = buildFaceplateScene(device, { x: 0, y: 0, width: 690, height: units * 100 }, { face: "rear" });
    assert.ok(Math.abs(scene.chassis.height / scene.chassis.width - native.chassis.height / native.chassis.width) < 1e-9);
    assert.equal(scene.ports.length, device.ports.length); assert.equal(scene.unmappedPorts.length, 0);
    assert.deepEqual(device, before);
    for (const box of scene.ports) {
      const expected = native.ports.find((slot) => slot.port.portIndex === box.port.portIndex);
      assert.ok(Math.abs((box.centerX - scene.chassis.x) / scene.chassis.width - (expected.centerX - native.chassis.x) / native.chassis.width) < 1e-9);
      assert.equal(box.displayLabel, "Custom");
    }
    device.faceplate.inventoryRevision = 99;
    const unknown = buildFaceplateScene(device, { x: 0, y: 0, width: 690, height: units * 100 }, { face: "rear" });
    assert.equal(unknown.ports.length, 0); assert.equal(unknown.unmappedPorts.length, device.ports.length);
  }
});

test("DL580 captions clear physical hardware at native and historical display sizes", () => {
  for (const width of [460, 690]) for (const units of [2, 4]) for (const face of ["front", "rear"]) {
    const scene = buildFaceplateScene(deviceFor(units === 2, units), { x: 0, y: 0, width, height: units * 100 }, { face });
    for (const slot of scene.ports) {
      const label = slot.labelPlacement;
      const w = Math.min(label.boxMaxWidth, slot.displayLabel.length * label.fontSize * .7 + 6);
      const rect = { x: label.x - w / 2, y: label.y - label.boxHeight / 2, width: w, height: label.boxHeight };
      assert.ok(rect.x >= scene.chassis.x && rect.x + rect.width <= scene.chassis.x + scene.chassis.width);
      assert.ok(rect.y >= scene.chassis.y && rect.y + rect.height <= scene.chassis.y + scene.chassis.height);
      for (const other of [...scene.ports, ...scene.components]) assert.ok(
        rect.x + rect.width <= other.x || other.x + other.width <= rect.x || rect.y + rect.height <= other.y || other.y + other.height <= rect.y,
        `${units}U ${slot.displayLabel} caption overlaps ${other.kind || other.port?.portIndex}`);
    }
  }
});
