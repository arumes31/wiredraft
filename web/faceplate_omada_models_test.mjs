import assert from "node:assert/strict";
import test from "node:test";
import { hardwareCatalog, instantiateProfile } from "./static/js/catalog.js";
import { resolveOmadaFaceplate } from "./static/js/faceplate-omada-models.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";

/** Resolve an explicitly named Omada catalog model and its canonical panel coordinates. */
function fixture(model) {
  const catalog = hardwareCatalog.find((item) => item.vendor === "TP-Link Omada" && item.model === model);
  const device = instantiateProfile(catalog, model, { x: 0, y: 0 });
  return { device, profile: resolveOmadaFaceplate(device) };
}

test("all nine Omada traces retain typed inventory, revision evidence and stable cached lookup", () => {
  const models = hardwareCatalog.filter((item) => item.vendor === "TP-Link Omada");
  assert.equal(models.length, 9);
  for (const { model } of models) {
    const { device, profile } = fixture(model);
    assert.equal(profile.fidelity, "model", model);
    assert.ok(profile.hardwareRevision && profile.sourcePage && profile.evidence.length, model);
    assert.deepEqual(Object.values(profile.faces).flatMap((face) => face.ports).map((port) => [port.portIndex, port.type]).sort((a, b) => a[0] - b[0]),
      device.ports.map((port) => [port.portIndex, port.type]));
    const snapshot = JSON.stringify(profile);
    device.ports[0].label = "Customer uplink";
    assert.equal(resolveOmadaFaceplate(device), profile);
    assert.equal(JSON.stringify(profile), snapshot);
  }
  assert.equal(resolveOmadaFaceplate({}), null);
  assert.equal(resolveOmadaFaceplate({ faceplate: { vendor: "TP-Link Omada" }, model: "SG2008P unknown revision" }), null);
  assert.equal(resolveOmadaFaceplate({ faceplate: { vendor: "Other" }, model: "SG2008P" }), null);
});

test("SG2008P has an indicator-only front and descending rear port numbers beside DC", () => {
  const { profile } = fixture("SG2008P");
  assert.equal(profile.defaultFace, "rear");
  assert.equal(profile.faces.front.ports.length, 0);
  assert.equal(profile.faces.rear.ports.length, 8);
  assert.ok(profile.faces.front.connectionMarker);
  const ports = profile.faces.rear.ports;
  assert.ok(ports[0].x > ports.at(-1).x, "rear physical numbers run 8 to 1 from left to right");
  assert.equal(new Set(ports.map((port) => port.y)).size, 1);
  const power = profile.faces.rear.components.find((part) => part.kind === "power");
  assert.equal(power.variant, "dc-barrel");
  assert.ok(power.x + power.width < ports.at(-1).x - ports.at(-1).width / 2);
});

test("compact SG2210MP and SG3210 retain distinct service positions and one copper row", () => {
  const poe = fixture("SG2210MP").profile;
  const managed = fixture("SG3210").profile;
  for (const profile of [poe, managed]) {
    assert.equal(new Set(profile.faces.front.ports.filter((port) => port.type === "RJ45_1G").map((port) => port.y)).size, 1);
    assert.equal(profile.faces.rear.components.some((part) => part.kind === "fan"), false);
  }
  assert.deepEqual(poe.faces.front.ports.filter((port) => port.type === "SFP_1G").map((port) => port.physicalLabel), ["SFP1", "SFP2"]);
  assert.ok(poe.faces.rear.components.find((part) => part.kind === "power").x < managed.faces.rear.components.find((part) => part.kind === "power").x);
  const usb = managed.faces.front.ports.find((port) => port.type === "USB_MICRO_CONSOLE");
  assert.equal(usb.connectorKind, "usb-micro");
  assert.ok(managed.catalogDiscrepancies.some((note) => note.includes("micro-USB")));
});

test("24-port models have three copper banks, low optical rows and revision-specific console artwork", () => {
  for (const model of ["SG2428P", "SG3428", "SG3428X"]) {
    const { profile } = fixture(model);
    const copper = profile.faces.front.ports.filter((port) => port.type === "RJ45_1G");
    const optical = profile.faces.front.ports.filter((port) => port.type.startsWith("SFP"));
    assert.equal(copper[0].x, copper[1].x);
    assert.ok(copper[0].y < copper[1].y, "odd ports are above even ports");
    assert.ok(copper[8].x - copper[6].x > copper[2].x - copper[0].x, model);
    assert.equal(new Set(optical.map((port) => port.y)).size, 1);
    assert.ok(optical[0].x > copper.at(-1).x);
  }
  const { profile } = fixture("SG3428X");
  assert.equal(profile.faces.front.ports.find((port) => port.type === "USB_C_CONSOLE").connectorKind, "usb-c");
  assert.equal(profile.faces.front.components.some((part) => part.kind === "usb-c"), false, "console is rendered once through its new inventory endpoint");
});

test("48-port models have three 16-port banks, paired SFPs and distinct rear ventilation", () => {
  for (const model of ["SG3452", "SG3452XP"]) {
    const { profile } = fixture(model);
    const copper = profile.faces.front.ports.filter((port) => port.type === "RJ45_1G");
    const optical = profile.faces.front.ports.filter((port) => port.type.startsWith("SFP"));
    assert.ok(copper[16].x - copper[14].x > copper[2].x - copper[0].x);
    assert.equal(optical[0].x, optical[1].x);
    assert.ok(optical[0].y < optical[1].y);
    assert.equal(profile.faces.rear.components.some((part) => part.kind === "vent"), model === "SG3452");
  }
});

test("SX6632YF shows SFP-size cages and its documented one-PSU four-fan population", () => {
  const { device, profile } = fixture("SX6632YF");
  const slots = profile.faces.front.ports.filter((port) => port.portIndex <= 32);
  assert.equal(slots.length, 32);
  assert.ok(slots.every((port) => port.connectorKind === "sfp"));
  assert.equal(slots.filter((port) => port.type === "QSFP28_100G").length, 0);
  assert.equal(slots.filter((port) => port.type === "SFP_PLUS_10G").length, 26);
  assert.equal(slots.filter((port) => port.type === "SFP28_25G").length, 6);
  assert.equal(device.ports.length, 35);
  assert.equal(profile.faces.front.components.filter((part) => part.kind === "usb").length, 2);
  assert.equal(profile.faces.rear.components.filter((part) => part.kind === "psu").length, 1);
  assert.equal(profile.faces.rear.components.filter((part) => part.kind === "fan").length, 4);
  assert.ok(profile.faces.rear.components.some((part) => part.kind === "module-bay" && part.label === "PSU2"));
  assert.ok(profile.catalogDiscrepancies[0].includes("no QSFP"));
});

test("corrected Omada instances add service ports while old typed inventories keep their original sockets", () => {
  for (const [model, oldCount] of [["SG3210", 12], ["SG3428X", 29], ["SG3452XP", 53], ["SX6632YF", 33]]) {
    const { device } = fixture(model);
    const legacy = structuredClone(device);
    legacy.ports = legacy.ports.slice(0, oldCount);
    if (model === "SG3210") legacy.ports[11].type = "USB_C_CONSOLE";
    if (model === "SX6632YF") for (let index = 0; index < 32; index++) legacy.ports[index].type = index < 24 ? "SFP28_25G" : "QSFP28_100G";
    legacy.ports.forEach((port, index) => { port.id = `${model}-${index}`; port.label = `Operator ${index}`; });
    const before = structuredClone(legacy);
    const scene = buildFaceplateScene(legacy, { x: 0, y: 0, width: 690, height: 100 });
    assert.equal(scene.ports.length, oldCount, model);
    assert.equal(scene.unmappedPorts.length, 0, model);
    assert.deepEqual(scene.ports.map((slot) => slot.displayLabel), legacy.ports.map((port) => port.label));
    assert.deepEqual(legacy, before);
  }
});
