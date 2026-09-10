import assert from "node:assert/strict";
import test from "node:test";
import { hardwareCatalog, instantiateProfile, upgradeInstalledPhysicalPorts } from "./static/js/catalog.js";
import { resolveEquipmentFaceplate } from "./static/js/faceplate-equipment-models.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";

/** Reconstruct the original seven-entry catalog when exercising persisted GE104 inventories. */
function fixture(legacy = false) {
  const catalog = hardwareCatalog.find((item) => item.vendor === "ADTRAN" && item.model === "FSP 150-GE104");
  const old = { ...catalog, inventoryRevision: 0, groups: [
    { zone: "access", count: 4, type: "RJ45_1G", speed: 1000, labels: ["UNI1", "UNI2", "UNI3", "UNI4"], prefix: "", poe: false },
    { zone: "uplink", count: 2, type: "SFP_1G", speed: 1000, labels: ["NNI1", "NNI2"], prefix: "", poe: false },
    { zone: "management", count: 1, type: "RJ45_1G", speed: 1000, labels: ["MGMT"], prefix: "", poe: false },
  ] };
  const device = instantiateProfile(legacy ? old : catalog, catalog.model, { x: 20, y: 40 });
  device.ports.forEach((port) => { port.id = `ge104-${port.portIndex}`; });
  return device;
}

/** Compare occupied rectangle areas without treating touching panel edges as collisions. */
function overlaps(a, b) {
  return a.x < b.x + b.width - 1e-9 && a.x + a.width > b.x + 1e-9 &&
    a.y < b.y + b.height - 1e-9 && a.y + a.height > b.y + 1e-9;
}

test("GE104 selects the original AC chassis with optical NNI and all four copper/SFP UNI pairs", () => {
  const device = fixture();
  const profile = resolveEquipmentFaceplate(device);
  assert.equal(profile.fidelity, "model");
  assert.equal(profile.inventoryRevision, 1);
  assert.equal(profile.inventoryComplete, true);
  assert.equal(device.faceplate.inventoryRevision, 1);
  assert.deepEqual(profile.evidence.models, ["FSP 150-GE104"]);
  assert.match(profile.sku, /GE104 AC.*optical NNI/);
  assert.equal(new URL(profile.source).hostname, "www.adtran-networks.com");
  assert.equal(new URL(profile.evidence.front).hostname, "i.ebayimg.com");
  assert.match(profile.evidence.provenance, /seller photographs/);
  assert.match(profile.limitations.join(" "), /GE104\(E\)/);
  assert.match(profile.limitations.join(" "), /share one logical interface/);
  assert.deepEqual(device.ports.map((port) => [port.type, port.speedMbps]), [
    ...Array.from({ length: 4 }, () => ["RJ45_1G", 1000]), ["SFP_1G", 1000], ["SFP_1G", 1000],
    ["RJ45_1G", 0], ["Console", 0], ...Array.from({ length: 4 }, () => ["SFP_1G", 1000]),
  ]);
  assert.ok(device.ports.every((port) => !port.isPoe));
  assert.equal(profile.faces.front.ports.length, 12);
  assert.equal(profile.faces.rear.ports.length, 0);
  assert.equal(resolveEquipmentFaceplate(device), profile);
});

test("GE104 follows its photographed service stack, bottom SFP row and numbered copper pairs", () => {
  const profile = resolveEquipmentFaceplate(fixture());
  const slots = new Map(profile.faces.front.ports.map((slot) => [slot.portIndex, slot]));
  assert.deepEqual([1, 2, 3, 4].map((index) => slots.get(index).physicalLabel), ["3", "4", "5", "6"]);
  assert.deepEqual([9, 10, 11, 12].map((index) => slots.get(index).physicalLabel), ["3", "4", "5", "6"]);
  assert.equal(slots.get(1).x, slots.get(2).x);
  assert.equal(slots.get(3).x, slots.get(4).x);
  assert.ok(slots.get(1).y < slots.get(2).y && slots.get(3).y < slots.get(4).y);
  assert.ok(slots.get(7).x < slots.get(9).x && slots.get(12).x < slots.get(1).x);
  assert.ok(slots.get(3).x < slots.get(5).x && slots.get(5).x < slots.get(6).x);
  assert.equal(slots.get(7).x, slots.get(8).x);
  assert.ok(slots.get(7).y < slots.get(8).y);
  assert.equal(slots.get(7).physicalLabel, "LAN");
  assert.equal(slots.get(8).physicalLabel, "RS232");
  assert.equal(profile.faces.front.components.find((part) => part.kind === "power").variant, "c14-diagonal");
  assert.equal(profile.faces.front.components.filter((part) => part.kind === "usb").length, 1);
  assert.equal(profile.faces.rear.components.filter((part) => part.role === "ground").length, 2);
  assert.equal(profile.faces.rear.components.find((part) => part.role === "grounding-plate").kind, "chassis");
  assert.ok(profile.faces.rear.components.some((part) => part.kind === "vent"));
  assert.ok(Object.values(profile.faces).flatMap((face) => face.components).every((part) => !["psu", "fan"].includes(part.kind)));
});

test("GE104 keeps all seven old identities and settings when mapping ordinal UNIs to printed 3–6", () => {
  const device = fixture(true);
  delete device.faceplate.inventoryRevision;
  device.rackId = "edge-rack";
  device.rackPosition = 8;
  device.ports[0].label = "Customer handoff";
  device.ports[0].nativeVlan = 76;
  device.ports[0].allowedVlans = [76, 81];
  device.ports[0].isPoe = true;
  device.ports[6].label = "Out-of-band";
  device.ports.reverse();
  const before = structuredClone(device);
  assert.equal(upgradeInstalledPhysicalPorts({ devices: [device] }), false);
  const bounds = { x: 10, y: 20, width: 690, height: 100 };
  const scene = buildFaceplateScene(device, bounds, { face: "front" });
  const current = buildFaceplateScene(fixture(), bounds, { face: "front" });
  assert.equal(scene.ports.length, 7);
  assert.equal(scene.unmappedPorts.length, 0);
  for (const port of scene.ports) {
    const canonical = current.ports.find((box) => box.port.portIndex === port.port.portIndex);
    assert.deepEqual([port.centerX, port.centerY], [canonical.centerX, canonical.centerY]);
  }
  assert.equal(scene.ports.find((box) => box.port.id === "ge104-1").displayLabel, "Customer handoff");
  assert.equal(scene.ports.find((box) => box.port.id === "ge104-2").displayLabel, "4");
  assert.equal(scene.ports.find((box) => box.port.id === "ge104-7").displayLabel, "Out-of-band");
  assert.deepEqual(device, before);
  device.ports = device.ports.filter((port) => [2, 5, 7].includes(port.portIndex));
  assert.deepEqual(buildFaceplateScene(device, bounds, { face: "front" }).ports.map((box) => box.port.id), ["ge104-7", "ge104-5", "ge104-2"]);
  device.faceplate.inventoryRevision = 99;
  const unknown = buildFaceplateScene(device, bounds, { face: "front" });
  assert.equal(unknown.ports.length, 0);
  assert.equal(unknown.unmappedPorts.length, 3);
});

test("GE104 uses a half-width 1U aspect and clear captions at compact and normal rack widths", () => {
  const device = fixture();
  for (const width of [460, 690]) for (const face of ["front", "rear"]) {
    const scene = buildFaceplateScene(device, { x: 10, y: 40, width, height: 100 }, { face });
    assert.equal(scene.unmappedPorts.length, 0);
    assert.ok(scene.chassis.width < width * .51);
    if (width === 690) assert.ok(Math.abs(scene.chassis.width / scene.chassis.height - 5) < .08);
    for (const port of scene.ports) {
      const label = port.labelPlacement;
      const captionWidth = Math.min(label.boxMaxWidth, Math.max(12,
        Math.min(label.maxWidth, port.displayLabel.length * label.fontSize) + 6));
      const caption = { x: label.x - captionWidth / 2, y: label.y - label.boxHeight / 2,
        width: captionWidth, height: label.boxHeight };
      assert.ok(caption.y >= scene.chassis.y && caption.y + caption.height <= scene.chassis.y + scene.chassis.height);
      for (const obstacle of [...scene.ports, ...scene.components.filter((part) => part.kind !== "text")]) {
        assert.ok(!overlaps(caption, obstacle), `${port.displayLabel} caption overlaps ${obstacle.role || obstacle.kind || obstacle.port.id}`);
      }
    }
  }
});
