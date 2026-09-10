import assert from "node:assert/strict";
import test from "node:test";
import { hardwareCatalog, instantiateProfile, upgradeInstalledPhysicalPorts } from "./static/js/catalog.js";
import { resolveEquipmentFaceplate } from "./static/js/faceplate-equipment-models.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";

/** Build fresh or independently described historical DL560 inventory with stable endpoint identities. */
function deviceFor(legacy = false) {
  let entry = hardwareCatalog.find((row) => row.vendor === "HPE" && row.model === "ProLiant DL560");
  if (legacy) entry = { ...entry, inventoryRevision: 0, groups: [
    { zone: "access", count: 4, type: "RJ45_10G", speed: 10000, prefix: "NIC", poe: false },
    { zone: "management", count: 1, type: "RJ45_1G", speed: 1000, prefix: "iLO" },
  ] };
  const device = instantiateProfile(entry, "Saved DL560", { x: 10, y: 20 });
  device.id = "dl560";
  for (const port of device.ports) { port.id = `dl560-${port.portIndex}`; port.deviceId = device.id; }
  return device;
}

test("DL560 selects its 2U Gen10 8SFF chassis, real FlexibleLOM and rear DB9 serial", () => {
  const device = deviceFor(); const profile = resolveEquipmentFaceplate(device);
  assert.equal(profile.fidelity, "model"); assert.equal(profile.sku, "ProLiant DL560 Gen10 · 841730-B21");
  assert.equal(device.faceplate.unitsU, 2); assert.equal(device.ports.length, 6);
  assert.deepEqual(device.ports.map((port) => port.type), ["RJ45_1G", "RJ45_1G", "RJ45_1G", "RJ45_1G", "RJ45_1G", "Console"]);
  assert.match(profile.note, /665240-B21/); assert.match(profile.note, /865414-B21/);
  assert.equal(profile.faces.front.ports.length, 0); assert.equal(profile.faces.rear.ports.length, 6);
  assert.equal(profile.faces.rear.ports.find((port) => port.portIndex === 6).connectorKind, "db9");
  const network = profile.faces.rear.ports.filter((port) => port.portIndex <= 4);
  assert.ok(network.every((port, i) => i === 0 || port.x < network[i - 1].x), "manufacturer numbers the four jacks from right to left");
  const drives = profile.faces.front.components.filter((part) => part.kind === "drive-carrier");
  assert.equal(drives.length, 8); assert.ok(drives.every((part) => part.x > .61 && part.orientation === "vertical"));
  assert.equal(profile.faces.front.components.filter((part) => part.role === "empty-drive-box").length, 2);
  assert.equal(profile.faces.front.components.filter((part) => part.kind === "usb").length, 2);
  assert.equal(profile.faces.rear.components.filter((part) => part.role === "pcie-slot-cover").length, 8);
  assert.equal(profile.faces.rear.components.filter((part) => part.kind === "psu" && part.variant === "hpe-flexslot-800").length, 2);
  assert.equal(profile.faces.rear.components.filter((part) => part.kind === "fan").length, 0);
  assert.equal(profile.faces.rear.components.filter((part) => part.kind === "usb").length, 4);
  assert.equal(profile.faces.rear.components.filter((part) => part.kind === "vga").length, 1, "rear display uses the existing 15-hole VGA primitive");
  assert.ok(profile.catalogDiscrepancies.some((note) => note.includes("iLO Service") && note.includes("not a serial")));
});

test("DL560 preserves old 10Gb IDs and every current edit without adding the new serial to saved devices", () => {
  for (const legacy of [false, true]) for (const sparse of [false, true]) {
    const device = deviceFor(legacy);
    if (sparse) device.ports = device.ports.filter((port) => port.portIndex !== 2);
    device.ports.reverse(); device.rackId = "rack"; device.rackPosition = 12;
    for (const port of device.ports) {
      port.label = port.portIndex === 5 ? "1" : `Custom ${port.portIndex}`;
      port.speedMbps = 100; port.isPoe = true; port.nativeVlan = 20; port.allowedVlans = [20, 30]; port.group = "Saved";
    }
    const before = structuredClone(device);
    assert.equal(upgradeInstalledPhysicalPorts({ devices: [device] }), false);
    for (const width of [460, 690]) {
      const bounds = { x: 0, y: 0, width, height: 200 };
      const scene = buildFaceplateScene(device, bounds, { face: "rear" });
      assert.equal(scene.ports.length, device.ports.length); assert.equal(scene.unmappedPorts.length, 0);
      const fresh = buildFaceplateScene(deviceFor(), bounds, { face: "rear" });
      for (const port of scene.ports) {
        const canonical = fresh.ports.find((slot) => slot.port.portIndex === port.port.portIndex);
        assert.deepEqual([port.centerX, port.centerY], [canonical.centerX, canonical.centerY]);
        assert.equal(port.displayLabel, port.port.label);
      }
    }
    assert.deepEqual(device, before);
    device.faceplate.inventoryRevision = 99;
    const unknown = buildFaceplateScene(device, { x: 0, y: 0, width: 690, height: 200 }, { face: "rear" });
    assert.equal(unknown.ports.length, 0); assert.equal(unknown.unmappedPorts.length, device.ports.length);
  }
});

test("DL560 source-specific geometry stays bounded and all connector captions remain clear", () => {
  const device = deviceFor();
  for (const width of [460, 690]) for (const face of ["front", "rear"]) {
    const scene = buildFaceplateScene(device, { x: 10, y: 20, width, height: 200 }, { face });
    for (const slot of scene.ports) {
      const label = slot.labelPlacement;
      const w = Math.min(label.boxMaxWidth, slot.displayLabel.length * label.fontSize * .7 + 6);
      const rect = { x: label.x - w / 2, y: label.y - label.boxHeight / 2, width: w, height: label.boxHeight };
      assert.ok(rect.x >= scene.chassis.x && rect.x + rect.width <= scene.chassis.x + scene.chassis.width);
      assert.ok(rect.y >= scene.chassis.y && rect.y + rect.height <= scene.chassis.y + scene.chassis.height);
      for (const other of [...scene.ports, ...scene.components]) assert.ok(
        rect.x + rect.width <= other.x || other.x + other.width <= rect.x || rect.y + rect.height <= other.y || other.y + other.height <= rect.y,
        `${face} ${slot.displayLabel} caption overlaps ${other.kind || other.port?.portIndex}`);
    }
  }
});
