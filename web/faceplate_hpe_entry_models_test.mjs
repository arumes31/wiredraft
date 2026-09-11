import assert from "node:assert/strict";
import test from "node:test";
import { hardwareCatalog, instantiateProfile, upgradeInstalledPhysicalPorts } from "./static/js/catalog.js";
import { resolveEquipmentFaceplate } from "./static/js/faceplate-equipment-models.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";

const cases = [
  { model: "ProLiant DL20", generation: "Gen11", sku: "P65392-B21", units: 1, count: 6, drives: 4 },
  { model: "ProLiant DL160", generation: "Gen10", sku: "878973-B21", units: 1, count: 3, drives: 8 },
  { model: "ProLiant DL180", generation: "Gen10", sku: "879517-B21", units: 2, count: 3, drives: 8 },
];

/** Construct the prior inventory independently of the revised profile's counts, types and rack height. */
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

/** Test positive-area intersection without rejecting boundaries that only touch. */
function overlaps(a, b) {
  return a.x < b.x + b.width - 1e-6 && a.x + a.width > b.x + 1e-6 &&
    a.y < b.y + b.height - 1e-6 && a.y + a.height > b.y + 1e-6;
}

for (const expected of cases) {
  test(`${expected.model} selects documented generation, base SKU and fixed network sockets`, () => {
    const device = deviceFor(expected.model);
    const profile = resolveEquipmentFaceplate(device);
    assert.equal(profile.fidelity, "model");
    assert.equal(profile.inventoryComplete, true);
    assert.equal(profile.inventoryRevision, 1);
    assert.equal(device.faceplate.unitsU, expected.units);
    assert.equal(device.ports.length, expected.count);
    assert.ok(device.ports.filter((p) => p.type !== "Console").every((p) => p.type === "RJ45_1G" && p.speedMbps === 1000));
    assert.deepEqual(profile.evidence.models, [expected.model]);
    assert.equal(profile.evidence.sku, expected.sku);
    assert.ok(profile.sku.includes(expected.generation) && profile.sku.includes(expected.sku));
    assert.equal(profile.faces.front.ports.length, 0);
    assert.equal(profile.faces.rear.ports.length, expected.count);
    assert.ok(profile.note.includes("865438-B21") && profile.note.includes("SATA"));
    assert.ok(profile.note.includes("200–240V AC"), "Titanium865438 uses high-line AC, not the Platinum supply's universal input");
    assert.equal(profile.faces.front.components.filter((p) => p.kind === "drive-carrier").length, expected.drives);
    const supplies = profile.faces.rear.components.filter((p) => p.kind === "psu");
    assert.equal(supplies.length, 2);
    assert.ok(supplies.every((part) => part.variant === "hpe-flexslot-800-titanium" && part.sku === "865438-B21" && part.inputVoltage === "200–240V AC"));
    assert.equal(new URL(profile.evidence.powerPhoto).hostname, "www.servershop24.de");
    assert.ok(profile.evidence.powerProvenance.includes("occlusion") && profile.evidence.powerProvenance.includes("866793-001"));
    assert.ok(profile.catalogDiscrepancies.some((note) => note.includes("iLO Service") && note.includes("not a serial")));
  });

  test(`${expected.model} preserves both legacy and current saved port settings through refresh`, () => {
    for (const legacy of [true, false]) {
      const device = deviceFor(expected.model, legacy);
      if (legacy) delete device.faceplate.inventoryRevision;
      device.rackId = "installed-rack";
      device.rackPosition = 19;
      for (const port of device.ports) {
        port.speedMbps = 100;
        port.group = "user-group";
        port.isPoe = true;
        port.nativeVlan = 51;
        port.allowedVlans = [51, 75];
      }
      const original = structuredClone(device);
      assert.equal(upgradeInstalledPhysicalPorts({ devices: [device] }), false);
      assert.deepEqual(device, original, "even generated default labels must not trigger resetting saved port configuration");
      device.ports[0].label = "MGMT1";
      const renamed = structuredClone(device);
      assert.equal(upgradeInstalledPhysicalPorts({ devices: [device] }), false);
      assert.deepEqual(device, renamed, "a user label matching the generic refresh pattern must not reset its 100Mbps/PoE/group settings");
      device.ports.find((p) => p.portIndex === 2).label = "iLO1";
      device.ports.reverse();
      const before = structuredClone(device);
      const bounds = { x: 0, y: 0, width: 690, height: 200 };
      const scene = buildFaceplateScene(device, bounds, { face: "rear" });
      const kept = legacy && expected.count === 3 ? [5, 2, 1] : [...device.ports.map((p) => p.portIndex)];
      assert.deepEqual(scene.ports.map((p) => p.port.portIndex), kept);
      assert.deepEqual(scene.unmappedPorts.map((p) => p.portIndex), legacy && expected.count === 3 ? [4, 3] : []);
      assert.equal(scene.ports.find((p) => p.port.portIndex === 2).displayLabel, "iLO1", "a misleading custom name stays custom");
      assert.deepEqual(device, before);
      if (legacy) assert.equal(device.faceplate.unitsU, 2);
      device.ports = device.ports.filter((p) => [2, 3, 5].includes(p.portIndex));
      const gapped = buildFaceplateScene(device, bounds, { face: "rear" });
      assert.deepEqual(gapped.ports.map((p) => p.port.portIndex), legacy && expected.count === 3 ? [5, 2] : device.ports.map((p) => p.portIndex));
      device.faceplate.inventoryRevision = 99;
      const unknown = buildFaceplateScene(device, bounds, { face: "rear" });
      assert.equal(unknown.ports.length, 0);
      assert.equal(unknown.unmappedPorts.length, device.ports.length);
    }
  });

  test(`${expected.model} keeps sockets and captions clear at new and saved rack heights and both render widths`, () => {
    for (const width of [460, 690]) for (const face of ["front", "rear"]) for (const legacy of [false, true]) {
      const device = deviceFor(expected.model, legacy);
      const scene = buildFaceplateScene(device, { x: 10, y: 40, width, height: device.faceplate.unitsU * 100 }, { face });
      assert.equal(scene.unmappedPorts.length, legacy && expected.count === 3 ? 2 : 0);
      for (const port of scene.ports) {
        assert.ok(port.height <= 23, "preserved rack occupancy must not stretch the physical connector");
        for (const component of scene.components.filter((p) => p.kind !== "text")) {
          assert.ok(!overlaps(port, component), `${expected.model} socket overlaps ${component.role || component.kind}`);
        }
        const label = port.labelPlacement;
        const captionWidth = Math.min(label.boxMaxWidth, Math.max(12, Math.min(label.maxWidth, port.displayLabel.length * label.fontSize) + 6));
        const caption = { x: label.x - captionWidth / 2, y: label.y - label.boxHeight / 2, width: captionWidth, height: label.boxHeight };
        assert.ok(caption.y >= scene.chassis.y && caption.y + caption.height <= scene.chassis.y + scene.chassis.height);
        for (const target of [...scene.ports, ...scene.components.filter((p) => p.kind !== "text")]) {
          assert.ok(!overlaps(caption, target), `${expected.model} ${port.displayLabel} overlaps ${target.kind || "socket"}/${target.role || ""}`);
        }
      }
    }
  });
}

test("HPE entry models trace separate drive banks, service ordering and covered optional slots", () => {
  const [small, medium, large] = cases.map(({ model }) => resolveEquipmentFaceplate(deviceFor(model)));
  const drives = (profile) => profile.faces.front.components.filter((p) => p.kind === "drive-carrier");
  assert.deepEqual(drives(small).filter((p) => p.y < .5).map((p) => p.driveNumber), [3]);
  assert.deepEqual(drives(small).filter((p) => p.y > .5).map((p) => p.driveNumber), [1, 2, 4]);
  assert.ok(drives(small).every((p) => p.variant === "hpe-basic"));
  assert.deepEqual(drives(medium).filter((p) => p.y < .5).map((p) => p.driveNumber), [1, 3, 5]);
  assert.deepEqual(drives(medium).filter((p) => p.y > .5).map((p) => p.driveNumber), [2, 4, 6, 7, 8]);
  assert.ok([...drives(medium), ...drives(large)].every((p) => p.variant === "hpe-smart"));
  assert.ok(drives(large).every((p) => p.x > .60 && p.orientation === "vertical"));
  const [nic1, nic2, nic3, nic4, ilo, serial] = small.faces.rear.ports;
  assert.ok(nic1.x < nic2.x && nic2.x < nic3.x && nic3.y < nic4.y);
  assert.equal(nic3.x, nic4.x);
  assert.ok(serial.x < ilo.x && serial.y < ilo.y);
  assert.equal(serial.connectorKind, "db9");
  assert.equal(small.faces.rear.components.filter((p) => p.kind === "displayport").length, 1);
  assert.equal(small.faces.rear.components.filter((p) => p.kind === "usb").length, 4);
  for (const profile of [medium, large]) {
    const [p1, p2, management] = profile.faces.rear.ports;
    assert.ok(management.x < p1.x && p1.x < p2.x);
    assert.equal(profile.faces.rear.components.filter((p) => p.role === "media-module-blank").length, 1);
    assert.equal(profile.faces.rear.components.filter((p) => p.role === "serial-blank").length, 1);
  }
  assert.equal(large.faces.rear.components.filter((p) => p.role === "pcie-cover").length, 3);
  assert.equal(large.faces.rear.components.filter((p) => p.role === "secondary-riser-blank").length, 1);
  assert.notDeepEqual(small.faces.rear, medium.faces.rear);
  assert.notDeepEqual(medium.faces.rear, large.faces.rear);
});

test("the selected 1U HPE bodies keep their dimensions inside larger saved rack allocations", () => {
  for (const model of ["ProLiant DL20", "ProLiant DL160"]) {
    const fresh = deviceFor(model);
    for (const width of [460, 690]) for (const face of ["front", "rear"]) {
      const reference = buildFaceplateScene(fresh, { x: 10, y: 40, width, height: 100 }, { face });
      for (const units of [2, 4]) {
        const saved = deviceFor(model, true);
        saved.faceplate.unitsU = units;
        const before = structuredClone(saved);
        const scene = buildFaceplateScene(saved, { x: 10, y: 40, width, height: units * 100 }, { face });
        assert.deepEqual(scene.chassis, reference.chassis, `${model} keeps its 1U physical body within ${units}U occupancy`);
        assert.deepEqual(scene.components.filter((part) => !part.applicationOverlay && !part.ancillarySocket),
          reference.components.filter((part) => !part.applicationOverlay && !part.ancillarySocket), "all common physical hardware keeps its exact geometry");
        const supplements = scene.components.filter((part) => part.ancillarySocket);
        const serial = model === "ProLiant DL20" && face === "rear"
          ? reference.ports.find((port) => port.port.portIndex === 6) : null;
        if (model === "ProLiant DL20" && face === "rear") assert.ok(serial, "the new inventory must expose the documented DB9 slot");
        assert.deepEqual(supplements, serial ? [{kind:"db9",x:serial.x,y:serial.y,width:serial.width,height:serial.height,
          role:"unclaimed-physical-socket",physicalSlotIndex:6,physicalFace:"rear",ancillarySocket:true}] : [],
          "the legacy drawing supplements only the missing serial socket at exactly the current socket bounds");
        for (const box of scene.ports) {
          const index = model === "ProLiant DL160" && box.port.portIndex === 5 ? 3 : box.port.portIndex;
          const original = reference.ports.find((port) => port.port.portIndex === index);
          assert.ok(original);
          assert.deepEqual([box.x, box.y, box.width, box.height], [original.x, original.y, original.width, original.height]);
        }
        assert.deepEqual(saved, before, "sizing the physical drawing must preserve the saved height, IDs and configuration");
        assert.equal(resolveEquipmentFaceplate(saved), resolveEquipmentFaceplate(saved), "repeated rendering reuses its slot-index cache");
      }
      assert.deepEqual(buildFaceplateScene(fresh, { x: 10, y: 40, width, height: 100 }, { face }).chassis, reference.chassis,
        "resolving a larger saved allocation must not mutate the cached fresh profile");
    }
  }
});
