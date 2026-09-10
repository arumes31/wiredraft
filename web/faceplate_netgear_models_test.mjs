import assert from "node:assert/strict";
import test from "node:test";
import { hardwareCatalog, instantiateProfile } from "./static/js/catalog.js";
import { resolveNetgearFaceplate } from "./static/js/faceplate-netgear-models.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";

/** Instantiate a named NETGEAR profile without sharing mutable inventory between tests. */
function fixture(model) {
  const catalog = hardwareCatalog.find((item) => item.vendor === "NETGEAR" && item.model === model);
  const device = instantiateProfile(catalog, model, { x: 0, y: 0 });
  return { device, profile: resolveNetgearFaceplate(device) };
}

test("six explicit NETGEAR traces retain stable inventory and separately cited front/rear evidence", () => {
  for (const model of ["M4300-28G", "M4300-52G", "M4250-26G4F-PoE+", "GS110T", "GS724T", "GS748T"]) {
    const { device, profile } = fixture(model);
    assert.equal(profile.fidelity, "model");
    assert.match(profile.evidence.front, /#page=\d+$/);
    assert.match(profile.evidence.rear, /#page=\d+$/);
    assert.equal(profile.evidence.models[0], model);
    assert.deepEqual(Object.values(profile.faces).flatMap((face) => face.ports).map((slot) => [slot.portIndex, slot.type]).sort((a, b) => a[0] - b[0]),
      device.ports.map((port) => [port.portIndex, port.type]));
    const snapshot = JSON.stringify(profile);
    device.ports[0].label = "Operator label";
    assert.equal(resolveNetgearFaceplate(device), profile);
    assert.equal(JSON.stringify(profile), snapshot);
  }
  assert.equal(resolveNetgearFaceplate({}), null);
  assert.equal(resolveNetgearFaceplate({ model: "M4300 family", faceplate: { vendor: "NETGEAR" } }), null);
  assert.equal(resolveNetgearFaceplate({ model: "M4300-28G", faceplate: { vendor: "Other" } }), null);
});

test("GS110T has a compact single row, separate optical sockets and rear DC power", () => {
  const { device, profile } = fixture("GS110T");
  assert.equal(profile.sku, "GS110T (2011 hardware guide)");
  assert.ok(profile.chassis.width < .6);
  const front = profile.faces.front.ports;
  assert.equal(front.length, 10);
  assert.equal(new Set(front.slice(0, 8).map((slot) => slot.y)).size, 1);
  assert.deepEqual(front.slice(8).map((slot) => slot.physicalLabel), ["9F", "10F"]);
  assert.equal(profile.faces.rear.ports.length, 0);
  assert.ok(profile.faces.rear.components.some((part) => part.kind === "power" && part.variant === "dc-barrel"));
  assert.ok(profile.limitations.some((note) => /voltage/i.test(note)));
  const before = structuredClone(device);
  const scene = buildFaceplateScene(device, { x: 0, y: 0, width: 690, height: 100 });
  assert.deepEqual(scene.ports.slice(8).map((slot) => slot.displayLabel), ["9F", "10F"]);
  device.ports[8].label = "Customer optical handoff";
  assert.equal(buildFaceplateScene(device, { x: 0, y: 0, width: 690, height: 100 }).ports[8].displayLabel, "Customer optical handoff");
  device.ports[8].label = before.ports[8].label;
  assert.deepEqual(device, before);
});

test("GS724T v6 and GS748T v6 retain distinct copper banks, optical arrangements and rear power positions", () => {
  const small = fixture("GS724T").profile;
  const large = fixture("GS748T").profile;
  assert.equal(small.sku, "GS724Tv6");
  assert.equal(large.sku, "GS748Tv6");
  assert.ok(small.faces.front.ports[0].x > .3);
  assert.ok(large.faces.front.ports[0].x < .1);
  for (const profile of [small, large]) {
    assert.ok(profile.limitations.some((note) => /v6/.test(note)));
    assert.equal(profile.faces.rear.ports.length, 0);
    assert.equal(profile.faces.rear.components.filter((part) => part.kind === "fan").length, 0, "internal/side fans are not rear fan modules");
    assert.ok(profile.faces.front.ports[0].y < profile.faces.front.ports[1].y);
  }
  const smallOptical = small.faces.front.ports.filter((slot) => slot.type === "SFP_1G");
  const largeOptical = large.faces.front.ports.filter((slot) => slot.type === "SFP_1G");
  assert.deepEqual(smallOptical.map((slot) => slot.physicalLabel), ["25F", "26F"]);
  assert.equal(smallOptical[0].y, smallOptical[1].y);
  assert.deepEqual(largeOptical.map((slot) => slot.physicalLabel), ["47F", "48F", "49F", "50F"]);
  assert.equal(largeOptical[0].x, largeOptical[1].x);
  assert.notEqual(small.faces.rear.components.find((part) => part.kind === "power").x,
    large.faces.rear.components.find((part) => part.kind === "power").x);
  assert.ok(large.catalogDiscrepancies.some((note) => /47F.*48F.*alternative media/.test(note)));
});

test("M4300 24/48-port banks use mixed copper/fiber uplinks and a rear serial console", () => {
  const small = fixture("M4300-28G").profile;
  const large = fixture("M4300-52G").profile;
  assert.ok(small.faces.front.ports[0].x > .45);
  assert.ok(large.faces.front.ports[0].x < .08);
  for (const [profile, copper] of [[small, 24], [large, 48]]) {
    const ports = profile.faces.front.ports;
    assert.equal(ports.length, copper + 6);
    assert.equal(ports[0].x, ports[1].x);
    assert.ok(ports[0].y < ports[1].y);
    assert.ok(ports[12].x - ports[10].x > ports[2].x - ports[0].x);
    assert.deepEqual(ports.slice(copper, copper + 4).map((port) => port.connectorKind), ["rj45", "rj45", "sfp", "sfp"]);
    assert.deepEqual(ports.slice(copper, copper + 4).map((port) => port.type), ["RJ45_10G", "RJ45_10G", "SFP_PLUS_10G", "SFP_PLUS_10G"]);
    assert.ok(ports.some((port) => port.type === "USB_MINI_CONSOLE"));
    assert.equal(profile.faces.rear.ports.length, 1);
    assert.equal(profile.faces.rear.ports[0].type, "Console");
    assert.equal(profile.faces.rear.components.filter((part) => part.kind === "fan").length, 3);
    assert.equal(profile.faces.rear.components.filter((part) => part.kind === "psu").length, 1);
    assert.ok(profile.faces.rear.components.some((part) => part.kind === "module-bay" && part.label === "PSU2"));
  }
});

test("M4250 exposes the rear Ethernet bank and single PoE+ power inlet while its front only repeats indicators", () => {
  const { device, profile } = fixture("M4250-26G4F-PoE+");
  assert.equal(profile.defaultFace, "rear");
  assert.equal(profile.faces.front.ports.length, 0);
  assert.equal(profile.faces.front.components.filter((part) => part.kind === "led").length, 33);
  assert.equal(profile.faces.rear.ports.length, 33);
  const optical = profile.faces.rear.ports.filter((port) => port.type === "SFP_1G");
  assert.deepEqual(optical.map((port) => port.physicalLabel), ["27", "28", "29", "30"]);
  assert.deepEqual(optical.map((port) => port.portIndex), [27, 28, 29, 30]);
  assert.equal(profile.faces.rear.components.filter((part) => part.kind === "power").length, 1);
  assert.equal(profile.faces.rear.components.filter((part) => part.kind === "rj45").length, 0, "all physical Ethernet sockets now have catalog endpoints");
  assert.equal(device.ports[24].isPoe, false);
  assert.equal(device.ports[25].isPoe, false);
  const before = structuredClone(device);
  const front = buildFaceplateScene(device, { x: 0, y: 0, width: 690, height: 100 }, { face: "front" });
  const rear = buildFaceplateScene(device, { x: 0, y: 0, width: 690, height: 100 }, { face: "rear" });
  assert.equal(front.hiddenPorts.length, device.ports.length);
  assert.equal(rear.ports.length, device.ports.length);
  assert.deepEqual(device, before);
});

test("legacy M4250 inventory keeps its existing cable identities after omitted Ethernet ports are added to new instances", () => {
  const { device, profile } = fixture("M4250-26G4F-PoE+");
  assert.equal(device.faceplate.inventoryRevision, 1);
  const legacy = structuredClone(device);
  delete legacy.faceplate.inventoryRevision;
  legacy.ports = legacy.ports.filter((port) => port.portIndex <= 24 || port.portIndex >= 27 && port.portIndex <= 31);
  legacy.ports.forEach((port, index) => { port.portIndex = index + 1; port.id = `legacy-${index + 1}`; port.label = `Operator ${index + 1}`; });
  const before = structuredClone(legacy);
  const bounds = { x: 0, y: 0, width: 690, height: 100 };
  const actual = buildFaceplateScene(legacy, bounds, { face: "rear" });
  const current = buildFaceplateScene(device, bounds, { face: "rear" });
  assert.equal(actual.ports.length, 29);
  assert.equal(actual.unmappedPorts.length, 0);
  const indexMap = profile.legacyLayouts[0].portIndexMap;
  for (const slot of actual.ports) {
    const target = current.ports.find((candidate) => candidate.port.portIndex === indexMap[slot.port.portIndex]);
    assert.equal(slot.x, target.x);
    assert.equal(slot.y, target.y);
    assert.equal(slot.displayLabel, slot.port.label, "user labels survive revision translation");
  }
  assert.deepEqual(legacy, before);
  for (const port of legacy.ports.filter((port) => port.type === "SFP_1G")) port.label = String(port.portIndex);
  const numbered = buildFaceplateScene(legacy, bounds, { face: "rear" });
  assert.deepEqual(numbered.ports.filter((slot) => slot.port.type === "SFP_1G").map((slot) => slot.displayLabel), ["27", "28", "29", "30"],
    "known old generated labels display the actual chassis numbering while custom names remain untouched");
});

test("legacy M4300 optical-typed copper uplinks remain mapped without mutating persisted types", () => {
  const { device } = fixture("M4300-28G");
  device.ports = device.ports.slice(0, 29);
  device.ports[24].type = "SFP_PLUS_10G";
  device.ports[25].type = "SFP_PLUS_10G";
  const before = structuredClone(device);
  const scene = buildFaceplateScene(device, { x: 0, y: 0, width: 690, height: 100 });
  assert.equal(scene.ports.length, 28);
  assert.equal(scene.ports[24].connectorKind, "rj45");
  assert.equal(scene.ports[25].connectorKind, "rj45");
  assert.equal(scene.unmappedPorts.length, 0);
  assert.deepEqual(device, before);
});
