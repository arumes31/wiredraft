import assert from "node:assert/strict";
import test from "node:test";
import { hardwareCatalog, instantiateProfile, instantiateStaticServer } from "./static/js/catalog.js";
import { resolveEquipmentFaceplate } from "./static/js/faceplate-equipment-models.js";

/** Instantiate a named catalog fixture with its canonical inventory. */
function deviceFor(model) {
  const catalog = hardwareCatalog.find((item) => item.model === model);
  assert.ok(catalog, model);
  return instantiateProfile(catalog, model, { x: 0, y: 0 });
}

/** Check whether two normalized rectangles intersect with positive area. */
function overlaps(a, b) {
  return a.x < b.x + b.width - 1e-9 && a.x + a.width > b.x + 1e-9 &&
    a.y < b.y + b.height - 1e-9 && a.y + a.height > b.y + 1e-9;
}

/** Verify all inventory slots are bounded and avoid physical components and other sockets. */
function verifyGeometry(device, profile) {
  const slots = Object.values(profile.faces).flatMap((face) => face.ports);
  assert.deepEqual(slots.map(({ portIndex, type }) => [portIndex, type]).sort((a, b) => a[0] - b[0]),
    device.ports.map(({ portIndex, type }) => [portIndex, type]).sort((a, b) => a[0] - b[0]), device.model);
  for (const [name, face] of Object.entries(profile.faces)) {
    const boxes = face.ports.map((slot) => ({ ...slot, x: slot.x - slot.width / 2, y: slot.y - slot.height / 2 }));
    for (const rect of [...face.components, ...boxes, ...(face.connectionMarker ? [face.connectionMarker] : [])]) {
      assert.ok([rect.x, rect.y, rect.width, rect.height].every(Number.isFinite), `${device.model}: ${name} finite`);
      assert.ok(rect.x >= 0 && rect.y >= 0 && rect.width > 0 && rect.height > 0 &&
        rect.x + rect.width <= 1 + 1e-9 && rect.y + rect.height <= 1 + 1e-9, `${device.model}: ${name} bounded`);
    }
    for (let index = 0; index < boxes.length; index++) {
      for (const other of [...boxes.slice(index + 1), ...face.components]) {
        assert.ok(!overlaps(boxes[index], other), `${device.model}: ${name} socket ${boxes[index].portIndex} overlaps ${other.kind || other.portIndex}`);
      }
      if (face.connectionMarker) assert.ok(!overlaps(boxes[index], face.connectionMarker));
    }
  }
}

test("all 133 equipment models preserve the catalog inventory in distinct, bounded panels", () => {
  let count = 0;
  for (const catalog of hardwareCatalog) {
    const device = instantiateProfile(catalog, catalog.model, { x: 0, y: 0 });
    const profile = resolveEquipmentFaceplate(device);
    if (!profile) continue;
    count++;
    verifyGeometry(device, profile);
    assert.ok(profile.source && profile.sourcePage && profile.note, device.model);
    assert.ok(["model", "family", "schematic"].includes(profile.fidelity));
    assert.notDeepEqual(profile.faces.front, profile.faces.rear, device.model);
    assert.equal(resolveEquipmentFaceplate(device), profile, "canonical layouts should be cached");
  }
  assert.equal(count, 133);
});

test("documented connector panel roles distinguish networking, AV switches, servers and APs", () => {
  for (const [model, face, panelPortCount] of [
    ["UniFi Standard 24", "front"], ["CRS317-1G-16S+RM", "front"], ["GS108T", "front"],
    ["SG2008P", "rear"], ["M4250 family", "rear"], ["M4250-26G4F-PoE+", "rear"],
    ["Console Manager family", "front"], ["SLC Console Manager family", "rear", 50],
    ["Dominion Serial family", "rear"], ["PowerEdge R650", "rear", 3], ["ProLiant ML350", "rear"],
    ["RackStation family", "rear"], ["Smart-UPS Network family", "rear"], ["UniFi U7 Pro", "rear"],
    ["Catalyst 9166I", "rear"], ["AP-635", "rear"], ["RUTX50", "front"],
  ]) {
    const device = deviceFor(model);
    const profile = resolveEquipmentFaceplate(device);
    assert.equal(profile.defaultFace, face, model);
    assert.equal(profile.faces[face].ports.length, panelPortCount ?? device.ports.length, model);
    if (model === "PowerEdge R650") assert.equal(profile.faces.front.ports.length, 1);
    if (model === "SLC Console Manager family") assert.equal(profile.faces.front.ports.length, 1);
  }
});

test("UCI exposes front Ethernet and rear coax with clear opposite-panel markers", () => {
  const device = deviceFor("UniFi Cable Internet");
  const profile = resolveEquipmentFaceplate(device);
  assert.deepEqual(profile.faces.front.ports.map((port) => port.type), ["RJ45_MGIG"]);
  assert.deepEqual(profile.faces.rear.ports.map((port) => port.type), ["COAX_F"]);
  assert.equal(profile.fidelity, "model");
  for (const face of Object.values(profile.faces)) assert.ok(face.connectionMarker);
  verifyGeometry(device, profile);
});

test("generic passive rear artwork never duplicates connectable inventory or patch-through semantics", () => {
  for (const catalog of hardwareCatalog.filter((item) => item.vendor.startsWith("Generic") && item.category === "PatchPanel")) {
    const device = instantiateProfile(catalog, catalog.model, { x: 0, y: 0 });
    const profile = resolveEquipmentFaceplate(device);
    assert.equal(profile.fidelity, "schematic");
    assert.equal(profile.faces.front.ports.length, device.ports.length);
    assert.deepEqual(profile.faces.rear.ports, []);
    assert.ok(profile.faces.rear.components.length > 1);
  }
});

test("configurable equipment identifies schematic service areas without invented fan or PSU populations", () => {
  for (const model of ["5G router · dual WAN", "GPON ONT · 4×GE", "DOCSIS 3.1 cable modem", "EdgeSwitch legacy family", "Rack PDU 16 outlet",
    "EdgeRouter legacy family", "KVM-over-IP 16 port", "EdgeMAX legacy family"]) {
    const profile = resolveEquipmentFaceplate(deviceFor(model));
    assert.equal(profile.fidelity, "schematic", model);
    assert.ok(Object.values(profile.faces).flatMap((face) => face.components).every((component) =>
      !["fan", "psu"].includes(component.kind)), model);
  }
});

test("equipment lookup ignores edited port names and refuses unrelated or unknown models", () => {
  const device = deviceFor("GS108T");
  const profile = resolveEquipmentFaceplate(device);
  device.ports[0].label = "Renamed customer handoff";
  device.ports.reverse();
  assert.equal(resolveEquipmentFaceplate(device), profile);
  assert.equal(profile.faces.front.ports[0].label, "1");
  assert.equal(resolveEquipmentFaceplate({ ...device, model: "GS108T unlisted revision" }), null);
  assert.equal(resolveEquipmentFaceplate(deviceFor("FortiGate 40F")), null);
  assert.equal(resolveEquipmentFaceplate(deviceFor("PowerSwitch S3048")), null);
  assert.equal(resolveEquipmentFaceplate({}), null);
});

test("dynamic Static servers use the actual configurable NIC inventory without stale model caching", () => {
  for (const nicCount of [1, 4, 16]) {
    for (const media of ["1g-rj45", "2.5g-rj45", "10g-rj45", "10g-sfp", "25g-sfp", "100g-qsfp"]) {
      for (const includeBMC of [false, true]) {
        const device = instantiateStaticServer({ model: "Custom server", nicCount, media, units: 2, includeBMC }, { x: 0, y: 0 });
        device.ports[0].label = "Customer NIC";
        const profile = resolveEquipmentFaceplate(device);
        assert.equal(profile.fidelity, "schematic");
        assert.equal(profile.defaultFace, "rear");
        assert.equal(profile.faces.rear.ports.find((slot) => slot.portIndex === 1).label, "Customer NIC");
        verifyGeometry(device, profile);
      }
    }
  }
  assert.equal(resolveEquipmentFaceplate({ category: "Switch", faceplate: { vendor: "Static" }, ports: [] }), null);
});

test("server socket height remains physically consistent across reserved rack heights", () => {
  for (const units of [1, 2, 4]) {
    const device = instantiateStaticServer({ nicCount: 4, media: "25g-sfp", units, includeBMC: true }, { x: 0, y: 0 });
    const profile = resolveEquipmentFaceplate(device);
    for (const port of profile.faces.rear.ports) assert.ok(port.height * units * 100 <= 24.01);
    verifyGeometry(device, profile);
  }
  const fas = resolveEquipmentFaceplate(deviceFor("FAS family"));
  for (const port of fas.faces.rear.ports) assert.ok(port.height * 400 <= 24.01);
});

test("observed catalog discrepancies are exposed without silently changing saved inventory", () => {
  for (const model of ["UniFi Pro Max 24 PoE", "UniFi Pro Max 48 PoE", "USW-Pro-Max-48-PoE", "USW-Enterprise-48-PoE", "UDM-Pro-Max", "PowerEdge R650"]) {
    const device = deviceFor(model);
    const before = JSON.stringify(device);
    const profile = resolveEquipmentFaceplate(device);
    assert.ok(profile.catalogDiscrepancies.length > 0, model);
    assert.equal(JSON.stringify(device), before);
    assert.ok(profile.limitations.length > 0);
  }
});
