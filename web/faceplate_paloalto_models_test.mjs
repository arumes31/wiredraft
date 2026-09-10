import assert from "node:assert/strict";
import test from "node:test";
import { hardwareCatalog, instantiateProfile } from "./static/js/catalog.js";
import { buildPaloAltoModelFaceplate } from "./static/js/faceplate-paloalto-models.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";

/** Build an individual Palo Alto model from its immutable catalog entry. */
function model(name) {
  return buildPaloAltoModelFaceplate(instantiateProfile(hardwareCatalog.find((entry) => entry.vendor === "Palo Alto"
    && entry.model === name), name, { x: 0, y: 0 }));
}

for (const name of ["PA-220", "PA-440", "PA-450", "PA-460", "PA-850"]) {
  const profile = model(name);
  assert.equal(profile.fidelity, "model");
  assert.deepEqual(profile.evidence.models, [name]);
  assert.match(profile.evidence.front, /-front-panel$/);
  assert.match(profile.evidence.rear, /-back-panel$/);
  assert.equal(profile.faces.rear.ports.length, 0);
  const first = profile.faces.front.ports.find((port) => port.label === "ethernet1/1");
  const second = profile.faces.front.ports.find((port) => port.label === "ethernet1/2");
  assert.equal(first.x, second.x);
  assert.ok(first.y < second.y, `${name} labels odd-numbered network ports above even ones`);
  const portal = profile.faces.rear.connectionMarker;
  assert.ok(portal, "opposite-panel marker has an explicitly reserved region");
  for (const part of profile.faces.rear.components) {
    assert.ok(portal.x + portal.width <= part.x || part.x + part.width <= portal.x
      || portal.y + portal.height <= part.y || part.y + part.height <= portal.y,
    `${name}: routing marker cannot cover ${part.kind}`);
  }
}
const p220 = model("PA-220");
assert.equal(p220.faces.front.components.filter((part) => part.kind === "led").length, 5);
assert.equal(p220.faces.front.ports.find((port) => port.label === "MGT").x,
  p220.faces.front.ports.find((port) => port.label === "CONSOLE").x, "220 management and RJ45 console are stacked");
for (const name of ["PA-440", "PA-450", "PA-460"]) {
  const profile = model(name);
  assert.match(profile.evidence.sharedChassis, /identical/);
  assert.equal(profile.faces.front.components.filter((part) => part.kind === "led").length, 6);
  assert.equal(profile.faces.front.components.filter((part) => part.kind === "usb").length, 2);
  const rearPowerLEDs = profile.faces.rear.components.filter((part) => part.kind === "led" && part.role === "power-status");
  assert.equal(rearPowerLEDs.length, 2, "the official shared rear panel shows a status lens beside each DC input");
  for (const [index, inlet] of profile.faces.rear.components.filter((part) => part.kind === "power").entries()) {
    assert.ok(rearPowerLEDs[index].x > inlet.x + inlet.width, "each PWR lens is beside its inlet, not inside the power connector");
  }
  assert.equal(profile.faces.front.components.filter((part) => part.kind === "console").length, 1);
  assert.ok(profile.catalogDiscrepancies.some((note) => note.includes("RJ45 CONSOLE")));
  assert.equal(profile.faces.front.ports.filter((port) => port.type === "Console").length, 0,
    "an omitted catalog connector must not be invented as routable inventory");
  assert.deepEqual(profile.faces.front.ports, model("PA-440").faces.front.ports,
    "the manufacturer explicitly confirms identical panel geometry for these three models");
}
const p850 = model("PA-850");
assert.equal(p850.faces.rear.components.filter((part) => part.kind === "psu").length, 2);
assert.equal(p850.faces.rear.components.filter((part) => part.kind === "fan").length, 3);
assert.ok(p850.faces.rear.components.filter((part) => part.kind === "psu").every((part) => part.x < .26));
assert.ok(p850.faces.rear.components.filter((part) => part.kind === "fan").every((part) => part.x > .6));
assert.equal(p850.faces.front.ports.filter((port) => port.type === "SFP_PLUS_10G").length, 4);
assert.equal(p850.faces.front.ports.find((port) => port.label === "HA1").x,
  p850.faces.front.ports.find((port) => port.label === "HA2").x);
assert.equal(buildPaloAltoModelFaceplate({ model: "PA-440 / PA-450" }), null);
assert.equal(buildPaloAltoModelFaceplate({ model: "PA-440", faceplate: { vendor: "Other" } }), null);
assert.equal(buildPaloAltoModelFaceplate({ model: "PA-441" }), null);

test("the PA-440 / PA-450 alias uses manufacturer-confirmed identical panels and appends the missing console", () => {
  const alias = model("PA-440 / PA-450");
  assert.equal(alias.fidelity, "model");
  assert.equal(alias.inventoryComplete, true);
  assert.equal(alias.sku, "PA-440 / PA-450 (identical panels)");
  assert.deepEqual(alias.evidence.models, ["PA-440", "PA-450"]);
  assert.match(alias.evidence.sharedChassis, /identical/);
  assert.equal(alias.faces.front.ports.length, 11);
  assert.equal(alias.faces.front.ports.find((slot) => slot.type === "Console").portIndex, 11);
  assert.equal(alias.faces.front.components.filter((part) => part.kind === "console").length, 0);
  assert.deepEqual(alias.faces.rear.components, model("PA-440").faces.rear.components);
  const device = instantiateProfile(hardwareCatalog.find((entry) => entry.model === "PA-440 / PA-450"), "Saved firewall", { x: 0, y: 0 });
  assert.equal(device.faceplate.inventoryRevision, 1);
  delete device.faceplate.inventoryRevision;
  device.ports = device.ports.slice(0, 10).filter((port) => port.portIndex !== 4).reverse();
  device.ports.forEach((port) => { port.id = `saved-${port.portIndex}`; port.label = "Operator label"; port.allowedVlans = [107]; });
  const before = structuredClone(device);
  const scene = buildFaceplateScene(device, { x: 0, y: 0, width: 690, height: 100 });
  assert.equal(scene.unmappedPorts.length, 0);
  assert.deepEqual(scene.ports.map((box) => box.port.id), device.ports.map((port) => port.id));
  assert.ok(scene.ports.every((box) => box.displayLabel === "Operator label"));
  assert.deepEqual(device, before);
  device.faceplate.inventoryRevision = 99;
  assert.equal(buildFaceplateScene(device, { x: 0, y: 0, width: 690, height: 100 }).unmappedPorts.length, device.ports.length);
});
