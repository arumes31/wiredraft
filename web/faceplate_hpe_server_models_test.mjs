import assert from "node:assert/strict";
import test from "node:test";
import { hardwareCatalog, instantiateProfile, upgradeInstalledPhysicalPorts } from "./static/js/catalog.js";
import { resolveEquipmentFaceplate } from "./static/js/faceplate-equipment-models.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";

const cases = [
  { model: "ProLiant DL360", units: 1, sku: "P52499-B21", backplane: "P48895-B21" },
  { model: "ProLiant DL380", units: 2, sku: "P52534-B21", backplane: "P48813-B21" },
];
const amdCases = [
  { model: "ProLiant DL325", units: 1, sku: "P54199-B21", backplane: "P54999-B21", cable: null, slot: 21 },
  { model: "ProLiant DL345", units: 2, sku: "P54205-B21", backplane: "P55082-B21", cable: "P57121-B21", slot: 21 },
  { model: "ProLiant DL385", units: 2, sku: "P53921-B21", backplane: "P55082-B21", cable: "P57846-B21", slot: 22 },
];

/** Reconstruct the prior five-port, 2U family inventory independently of the corrected catalog. */
function deviceFor(model, legacy = false) {
  let catalog = hardwareCatalog.find((entry) => entry.vendor === "HPE" && entry.model === model);
  if (legacy) catalog = { ...catalog, units: 2, inventoryRevision: 0, groups: [
    { zone: "access", count: 4, type: "RJ45_10G", speed: 10000, prefix: "NIC", poe: false },
    { zone: "management", count: 1, type: "RJ45_1G", speed: 1000, prefix: "iLO", poe: false },
  ] };
  const device = instantiateProfile(catalog, model, { x: 10, y: 20 });
  device.id = model;
  device.ports.forEach((port) => { port.id = `saved-${port.portIndex}`; });
  return device;
}

/** Test positive-area intersections while permitting touching boundaries. */
function overlaps(a, b) {
  return a.x < b.x + b.width - 1e-6 && a.x + a.width > b.x + 1e-6 &&
    a.y < b.y + b.height - 1e-6 && a.y + a.height > b.y + 1e-6;
}

for (const expected of [...cases, ...amdCases]) {
  test(`${expected.model} selects its own Gen11 chassis and documented OCP adapter position`, () => {
    const device = deviceFor(expected.model);
    const profile = resolveEquipmentFaceplate(device);
    assert.equal(profile.fidelity, "model");
    assert.equal(profile.inventoryRevision, 1);
    assert.equal(profile.inventoryComplete, true);
    assert.equal(device.faceplate.unitsU, expected.units);
    assert.equal(device.faceplate.inventoryRevision, 1);
    assert.deepEqual(profile.evidence.models, [expected.model]);
    assert.equal(profile.evidence.sku, expected.sku);
    assert.equal(profile.sku, `${expected.model} Gen11 · ${expected.sku} · 8SFF / BCM57416`);
    const selectedSlot = amdCases.includes(expected) ? [`slot ${expected.slot}`, ...(expected.cable ? [expected.cable] : [])] : ["P51911-B21", "slot 15"];
    for (const detail of ["Gen11", "P10097-B21", ...selectedSlot, "SATA", expected.backplane, "800W"]) {
      assert.ok(profile.evidence.configuration.includes(detail), detail);
    }
    assert.equal(new URL(profile.source).hostname, "support.hpe.com");
    assert.equal(new URL(profile.evidence.adapterFront).hostname, "www.itcreations.com");
    assert.match(profile.evidence.adapterProvenance, /supplier/);
    assert.deepEqual(device.ports.map((port) => [port.type, port.speedMbps]),
      [["RJ45_10G", 10000], ["RJ45_10G", 10000], ["RJ45_1G", 1000]]);
    assert.equal(profile.faces.front.ports.length, 0);
    assert.deepEqual(profile.faces.rear.ports.map((port) => [port.portIndex, port.physicalLabel]), [[1, "P1"], [2, "P2"], [3, "iLO"]]);
    const [p1, p2, ilo] = profile.faces.rear.ports;
    assert.ok(p1.x < p2.x, "photographed P1 is left of P2");
    assert.ok(expected.slot === 21 ? p2.x < ilo.x : ilo.x < p1.x, "NIC follows the model-specific slot population rule");
    const service = profile.faces.front.components.filter((part) => part.role === "ilo-service");
    assert.equal(service.length, 1);
    assert.equal(service[0].kind, "usb");
    assert.ok(profile.catalogDiscrepancies.some((note) => note.includes("Q7Y55A") && note.includes("not a serial")));
    assert.equal(resolveEquipmentFaceplate(device), profile);
  });

  test(`${expected.model} preserves saved identities, gaps, settings and 2U without creating NIC3/4 sockets`, () => {
    const device = deviceFor(expected.model, true);
    delete device.faceplate.inventoryRevision;
    device.rackId = "installed-rack";
    device.rackPosition = 19;
    device.ports.reverse();
    const renamed = device.ports.find((port) => port.portIndex === 2);
    renamed.label = "Core uplink";
    renamed.nativeVlan = 51;
    renamed.allowedVlans = [51, 75];
    device.ports.find((port) => port.portIndex === 5).label = "Private management";
    const before = structuredClone(device);
    assert.equal(upgradeInstalledPhysicalPorts({ devices: [device] }), false);
    const bounds = { x: 20, y: 30, width: 690, height: 200 };
    const scene = buildFaceplateScene(device, bounds, { face: "rear" });
    assert.deepEqual(scene.ports.map((box) => box.port.id), ["saved-5", "saved-2", "saved-1"]);
    assert.deepEqual(scene.unmappedPorts.map((port) => port.id), ["saved-4", "saved-3"]);
    assert.equal(scene.ports.find((box) => box.port.id === "saved-2").displayLabel, "Core uplink");
    assert.equal(scene.ports.find((box) => box.port.id === "saved-5").displayLabel, "Private management");
    const current = buildFaceplateScene(deviceFor(expected.model), bounds, { face: "rear" });
    for (const [oldIndex, newIndex] of [[1, 1], [2, 2], [5, 3]]) {
      const oldBox = scene.ports.find((box) => box.port.portIndex === oldIndex);
      const newBox = current.ports.find((box) => box.port.portIndex === newIndex);
      assert.deepEqual([oldBox.centerX, oldBox.centerY], [newBox.centerX, newBox.centerY]);
    }
    assert.deepEqual(device, before);
    device.ports = device.ports.filter((port) => [2, 3, 5].includes(port.portIndex));
    assert.deepEqual(buildFaceplateScene(device, bounds, { face: "rear" }).ports.map((box) => box.port.id), ["saved-5", "saved-2"]);
    device.faceplate.inventoryRevision = 99;
    const unknown = buildFaceplateScene(device, bounds, { face: "rear" });
    assert.equal(unknown.ports.length, 0);
    assert.equal(unknown.unmappedPorts.length, 3);
  });

  test(`${expected.model} keeps socket captions clear of physical hardware at rack and compact widths`, () => {
    const device = deviceFor(expected.model);
    for (const width of [460, 690]) for (const face of ["front", "rear"]) {
      const scene = buildFaceplateScene(device, { x: 10, y: 40, width, height: expected.units * 100 }, { face });
      assert.equal(scene.unmappedPorts.length, 0);
      for (const port of scene.ports) {
        const label = port.labelPlacement;
        const captionWidth = Math.min(label.boxMaxWidth, Math.max(12,
          Math.min(label.maxWidth, port.displayLabel.length * label.fontSize) + 6));
        const caption = { x: label.x - captionWidth / 2, y: label.y - label.boxHeight / 2,
          width: captionWidth, height: label.boxHeight };
        assert.ok(caption.y >= scene.chassis.y && caption.y + caption.height <= scene.chassis.y + scene.chassis.height);
        assert.ok(!overlaps(caption, port), "caption clears its own socket");
        for (const component of scene.components.filter((part) => part.kind !== "text")) {
          assert.ok(!overlaps(caption, component), `${expected.model} ${port.displayLabel} caption overlaps ${component.kind}/${component.role}`);
        }
      }
    }
  });
}

test("DL360 and DL380 have different measured drive banks and covered expansion layouts", () => {
  const [small, large] = cases.map(({ model }) => resolveEquipmentFaceplate(deviceFor(model)));
  const smallDrives = small.faces.front.components.filter((part) => part.kind === "drive-carrier");
  const largeDrives = large.faces.front.components.filter((part) => part.kind === "drive-carrier");
  assert.deepEqual(smallDrives.filter((part) => part.y < .5).map((part) => part.driveNumber), [1, 3, 5]);
  assert.deepEqual(smallDrives.filter((part) => part.y > .5).map((part) => part.driveNumber), [2, 4, 6, 7, 8]);
  assert.deepEqual(largeDrives.map((part) => part.driveNumber), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.ok(largeDrives.every((part) => part.x > .61 && part.orientation === "vertical"));
  assert.ok([...smallDrives, ...largeDrives].every((part) => part.variant === "hpe-basic"));
  for (const [profile, slots] of [[small, 3], [large, 6]]) {
    assert.equal(profile.faces.rear.components.filter((part) => part.role === "pcie-cover").length, slots);
    assert.equal(profile.faces.rear.components.filter((part) => part.role === "ocp14-blank").length, 1);
    assert.deepEqual(profile.faces.rear.components.filter((part) => part.kind === "psu").map((part) => part.variant),
      ["hpe-flexslot-800", "hpe-flexslot-800"]);
    assert.equal(profile.faces.rear.components.filter((part) => part.kind === "vga").length, 1);
    assert.equal(profile.faces.rear.components.filter((part) => part.kind === "db9" || part.kind === "fan").length, 0);
    const status = profile.faces.front.components.filter((part) => part.role?.startsWith("status-")).sort((a, b) => a.y - b.y);
    assert.deepEqual(status.map((part) => part.role), ["status-power", "status-health", "status-nic", "status-uid"]);
  }
  assert.notDeepEqual(small.faces.front, large.faces.front);
  assert.notDeepEqual(small.faces.rear, large.faces.rear);
});

test("AMD Gen11 panels retain their source-specific riser covers, drive banks and front SID distinction", () => {
  const [small, single, dual] = amdCases.map(({ model }) => resolveEquipmentFaceplate(deviceFor(model)));
  for (const [profile, blank] of [[small, 22], [single, 22], [dual, 21]]) {
    assert.equal(profile.inventoryRevision, 1);
    assert.ok(profile.evidence.configuration.includes(`slot ${blank === 22 ? 21 : 22}`));
    assert.ok(!profile.evidence.configuration.includes("P51911"), "Intel CPU-to-OCP kit does not apply to AMD");
    assert.equal(profile.faces.rear.components.filter((part) => part.role === `ocp${blank}-blank`).length, 1);
    assert.deepEqual(profile.faces.rear.components.filter((part) => part.kind === "psu").map((part) => part.role), ["ps2", "ps1"]);
    assert.equal(profile.faces.rear.components.filter((part) => part.kind === "db9" || part.kind === "drive-carrier").length, 0);
    const uid = profile.faces.rear.components.find((part) => part.role === "rear-uid");
    const usb = profile.faces.rear.components.find((part) => part.kind === "usb");
    assert.ok(uid.x + uid.width < usb.x, "rear UID is left of the USB stack, as in the individual LED diagram");
  }
  const drives = small.faces.front.components.filter((part) => part.kind === "drive-carrier");
  assert.deepEqual(drives.filter((part) => part.y < .5).map((part) => part.driveNumber), [1, 3, 5]);
  assert.deepEqual(drives.filter((part) => part.y > .5).map((part) => part.driveNumber), [2, 4, 6, 7, 8]);
  assert.equal(small.faces.rear.components.filter((part) => part.role === "pcie-cover").length, 2);
  assert.equal(single.faces.rear.components.filter((part) => part.role === "pcie-cover").length, 2);
  assert.equal(dual.faces.rear.components.filter((part) => part.role === "pcie-cover").length, 1);
  assert.equal(dual.faces.rear.components.filter((part) => part.role === "secondary-riser-blank").length, 3);
  assert.equal(single.faces.front.components.filter((part) => part.role === "sid-blank").length, 0);
  assert.equal(dual.faces.front.components.filter((part) => part.role === "sid-blank").length, 1);
  for (const profile of [single, dual]) {
    const bank = profile.faces.front.components.filter((part) => part.kind === "drive-carrier");
    assert.deepEqual(bank.map((part) => part.driveNumber), [1, 2, 3, 4, 5, 6, 7, 8]);
    assert.ok(bank.every((part) => part.x > .6 && part.orientation === "vertical"));
    assert.equal(profile.faces.rear.components.filter((part) => part.role === "rear-drive-blank").length, 1);
    assert.equal(profile.faces.rear.components.filter((part) => part.role === "rear-boot-blank").length, 1);
  }
  assert.notDeepEqual(single.faces.front, dual.faces.front);
  assert.notDeepEqual(single.faces.rear, dual.faces.rear);
});
