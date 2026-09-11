import assert from "node:assert/strict";
import { hardwareCatalog, instantiateProfile } from "./static/js/catalog.js";
import { buildCiscoASAModelFaceplate } from "./static/js/faceplate-cisco-asa-models.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";

/** Resolve an individual Cisco ASA with its existing catalog identities. */
function model(series) {
  const name = `ASA ${series}-X`;
  const device = instantiateProfile(hardwareCatalog.find((entry) => entry.vendor === "Cisco" && entry.model === name), name, { x: 0, y: 0 });
  return { device, profile: buildCiscoASAModelFaceplate(device) };
}

for (const series of [5506, 5508, 5516, 5525, 5545, 5555]) {
  const { device, profile } = model(series);
  assert.equal(profile.fidelity, "model");
  assert.deepEqual(profile.evidence.models, [device.model]);
  assert.equal(profile.defaultFace, "rear");
  assert.equal(profile.faces.front.ports.length, 0);
  assert.equal(profile.faces.rear.ports.length, device.ports.length);
  const console = profile.faces.rear.ports.find((port) => port.label === "CONSOLE1");
  assert.equal(console.type, series <= 5516 ? "USB_MINI_CONSOLE" : "Console", "new inventory has the physical connector type");
  assert.equal(console.connectorKind, series <= 5516 ? "usb-mini" : "console");
  assert.ok(profile.catalogDiscrepancies.some((note) => note.includes("Micro-USB")));
  const scene = buildFaceplateScene(device, { x: 0, y: 0, width: 690, height: 100 }, { face: "rear" });
  const drawn = scene.ports.find((port) => port.port.label === "CONSOLE1");
  assert.equal(drawn.connectorKind, console.connectorKind);
  assert.equal(drawn.displayLabel, console.physicalLabel);
  const renamed = structuredClone(device);
  renamed.ports.find((port) => port.label === "CONSOLE1").label = "Operator console";
  assert.equal(buildFaceplateScene(renamed, { x: 0, y: 0, width: 690, height: 100 }, { face: "rear" })
    .ports.find((port) => port.port.label === "Operator console").displayLabel, "Operator console");
  if (series <= 5516) {
    assert.equal(profile.faces.rear.ports.filter((port) => port.type === "Console").length, 1,
      "new inventory includes the additional physical RJ45 console");
    assert.equal(new Set(profile.faces.rear.ports.filter((port) => /^\d+$/.test(port.label)).map((port) => port.y)).size, 1);
  } else {
    const first = profile.faces.rear.ports.find((port) => port.label === "1");
    const second = profile.faces.rear.ports.find((port) => port.label === "2");
    const eighth = profile.faces.rear.ports.find((port) => port.label === "8");
    assert.equal(first.physicalLabel, "0/0");
    assert.equal(eighth.physicalLabel, "0/7");
    assert.equal(first.x, second.x);
    assert.ok(first.y > second.y && first.x > eighth.x, "0/0 belongs bottom right, while 0/7 belongs top left");
  }
  const legacy = structuredClone(device);
  delete legacy.faceplate.inventoryRevision;
  legacy.ports = legacy.ports.filter((port) => port.portIndex <= 10);
  legacy.ports.find((port) => port.portIndex === 10).type = "USB_MICRO_CONSOLE";
  legacy.faceplate.totalPorts = 10;
  const legacyScene = buildFaceplateScene(legacy, { x: 0, y: 0, width: 690, height: 100 }, { face: "rear" });
  assert.equal(legacyScene.ports.length, 10, "all existing ASA endpoints remain bound");
  assert.equal(legacyScene.unmappedPorts.length, 0);
  assert.equal(legacyScene.ports.find((box) => box.port.portIndex === 10).connectorKind, console.connectorKind);
}
assert.equal(model(5506).profile.faces.front.components.filter((part) => part.kind === "led").length, 0,
  "Cisco explicitly states that the 5506-X front has no LEDs or connectors");
assert.equal(model(5506).profile.faces.rear.components.find((part) => part.kind === "power").columns, 2);
assert.deepEqual(model(5508).profile.faces.rear, model(5516).profile.faces.rear);
assert.equal(model(5508).profile.faces.front.components.filter((part) => part.kind === "led").length, 4);
assert.equal(model(5525).profile.faces.front.components.filter((part) => part.kind === "module-bay").length, 1);
assert.equal(model(5525).profile.faces.rear.components.filter((part) => part.kind === "fan").length, 1);
for (const series of [5545, 5555]) {
  const { profile } = model(series);
  assert.equal(profile.faces.front.components.filter((part) => part.kind === "module-bay").length, 2);
  assert.equal(profile.faces.rear.components.filter((part) => part.kind === "psu").length, 1, "base configuration has only PSU 0 installed");
  assert.equal(profile.faces.rear.components.find((part) => part.label === "PSU 1").variant, "blank");
}
assert.equal(buildCiscoASAModelFaceplate({ model: "ASA 5506-X", faceplate: { vendor: "Other" } }), null);
assert.equal(buildCiscoASAModelFaceplate({ model: "ASA 5507-X" }), null);
