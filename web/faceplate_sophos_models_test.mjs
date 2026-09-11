import assert from "node:assert/strict";
import test from "node:test";
import { hardwareCatalog, instantiateProfile } from "./static/js/catalog.js";
import { buildSophosModelFaceplate } from "./static/js/faceplate-sophos-models.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";

/** Instantiate the individual catalog SKU used by the source illustration. */
function model(number) {
  return buildSophosModelFaceplate(instantiateProfile(hardwareCatalog.find((entry) => entry.vendor === "Sophos"
    && entry.model === `XGS ${number}`), `XGS ${number}`, { x: 0, y: 0 }));
}

/** Find a traced connector while preserving its physical panel. */
function port(profile, face, label) {
  return profile.faces[face].ports.find((slot) => slot.label === label);
}

for (const number of [87, 107, 116, 126, 136, 2100, 2300, 3100, 3300, 4300, 4500]) {
  const profile = model(number);
  assert.equal(profile.fidelity, "model");
  assert.deepEqual(profile.evidence.models, [`XGS ${number}`]);
  assert.match(profile.evidence.front, /#page=3$/);
  assert.match(profile.evidence.rear, /#page=3$/);
  assert.ok(profile.faces.front.components.every((part) => part.kind !== "power"));
}

for (const number of [87, 107, 116, 126, 136]) {
  const profile = model(number);
  assert.equal(profile.faces.front.ports.length, 1, "desktop console is the only routable front socket");
  assert.equal(port(profile, "front", "MICRO-USB").type, "USB_MICRO_CONSOLE");
  assert.ok(port(profile, "rear", "COM"), "RJ45 console remains on the rear");
  assert.ok(port(profile, "rear", "1").y < port(profile, "rear", "2").y,
    "desktop diagrams place odd copper ports above even ports");
  assert.equal(profile.faces.rear.components.filter((part) => part.kind === "power").length, number === 87 ? 1 : 2);
  assert.ok(profile.faces.front.connectionMarker && profile.faces.rear.connectionMarker);
}
assert.ok(model(87).chassis.width < model(116).chassis.width, "230 mm and 320 mm desktop bodies must differ");
assert.equal(port(model(116), "rear", "7").x, .69);
assert.ok(port(model(116), "rear", "7").x - port(model(116), "rear", "5").x > .15,
  "116 copper ports 7/8 form a separate bank beside the expansion slot");
assert.equal(port(model(126), "rear", "11").type, "RJ45_1G");
assert.equal(port(model(136), "rear", "11").type, "RJ45_MGIG");
assert.equal(port(model(136), "rear", "F1").x, port(model(136), "rear", "F2").x,
  "desktop fiber ports are vertically stacked");

for (const number of [2100, 2300, 3100, 3300, 4300, 4500]) {
  const profile = model(number);
  assert.equal(profile.faces.rear.ports.length, 0);
  assert.ok(port(profile, "front", "2").y < port(profile, "front", "1").y,
    "rack diagrams reverse the desktop order, placing even ports above odd");
  assert.equal(profile.faces.front.components.filter((part) => part.kind === "lcd").length, 1);
  assert.equal(profile.faces.front.components.filter((part) => part.kind === "module-bay").length, number >= 4300 ? 2 : 1);
}
assert.ok(port(model(3100), "front", "F1").x < port(model(2100), "front", "F1").x,
  "3100 adds the SFP+ bank to the left of the SFP bank");
assert.ok(port(model(4300), "front", "F2").y < port(model(4300), "front", "F1").y);
assert.equal(port(model(4300), "front", "F1").x, port(model(4300), "front", "F2").x);
assert.equal(model(4500).faces.rear.components.filter((part) => part.kind === "psu").length, 1,
  "the source base configuration has one installed PSU and one empty redundant slot");
assert.ok(model(4500).faces.rear.components.some((part) => part.kind === "module-bay" && part.label === "PSU 2" && part.variant === "blank"));
assert.equal(model(4300).faces.rear.components.filter((part) => part.kind === "psu").length, 0);
assert.ok(model(4300).faces.rear.components.some((part) => part.kind === "power" && part.variant === "ac"));
assert.ok(model(2100).evidence.supplemental && model(3100).evidence.supplemental && model(4300).evidence.supplemental,
  "manual variation footnotes require verification against individual official product photographs");
const xgs2100Power = model(2100).faces.rear.components.find((part) => part.role === "power-control");
assert.equal(xgs2100Power?.kind, "button");
assert.equal(xgs2100Power.variant, "oval");
assert.ok(xgs2100Power.width * 438 > xgs2100Power.height * 44, "the exact power control is a horizontal oval push button");
assert.equal(buildSophosModelFaceplate({ model: "XGS 126 / 136" }), null, "a model name without its catalog vendor cannot resolve hardware");
assert.equal(buildSophosModelFaceplate({ model: "XGS 126", faceplate: { vendor: "Other" } }), null);
assert.equal(buildSophosModelFaceplate({ model: "Unknown" }), null);

test("combined Sophos aliases disclose a specific non-wireless chassis and preserve saved endpoint settings", () => {
  for (const [name, selected, count] of [["XGS 126 / 136", "XGS 126", 16], ["XGS 2100 / 2300", "XGS 2100", 13]]) {
    const device = instantiateProfile(hardwareCatalog.find((entry) => entry.model === name), name, { x: 0, y: 0 });
    const profile = buildSophosModelFaceplate(device);
    assert.equal(profile.fidelity, "model");
    assert.equal(profile.evidence.selectedModel, selected);
    assert.equal(profile.sku, selected);
    assert.deepEqual(profile.evidence.models, [selected]);
    assert.match(profile.limitations.join(" "), new RegExp(selected));
    assert.equal(device.ports.length, count);
    assert.equal(device.faceplate.inventoryRevision, 1);
    if (selected === "XGS 126") {
      assert.equal(device.ports[10].type, "RJ45_1G");
      assert.equal(device.ports[10].speedMbps, 1000);
      for (const port of device.ports.slice(10, 12)) { port.type = "RJ45_MGIG"; port.speedMbps = 2500; }
    } else assert.match(profile.evidence.configuration, /XGS 2100.*empty.*Flexi/i);
    delete device.faceplate.inventoryRevision;
    device.ports = device.ports.filter((port) => port.portIndex !== 3).reverse();
    for (const port of device.ports) { port.id = `saved-${port.portIndex}`; port.label = `Custom ${port.portIndex}`; port.allowedVlans = [125]; }
    const before = structuredClone(device);
    const bounds = { x: 0, y: 0, width: 690, height: 100 };
    const scenes = ["front", "rear"].map((face) => buildFaceplateScene(device, bounds, { face }));
    assert.equal(scenes[0].unmappedPorts.length, 0);
    const sockets = scenes.flatMap((scene) => scene.ports);
    assert.deepEqual(new Set(sockets.map((box) => box.port.id)), new Set(device.ports.map((port) => port.id)));
    assert.ok(sockets.every((box) => box.displayLabel.startsWith("Custom ")));
    assert.deepEqual(device, before);
    device.faceplate.inventoryRevision = 99;
    assert.equal(buildFaceplateScene(device, bounds).unmappedPorts.length, device.ports.length);
  }
});
