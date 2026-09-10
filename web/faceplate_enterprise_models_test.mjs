import assert from "node:assert/strict";
import { hardwareCatalog, instantiateProfile } from "./static/js/catalog.js";
import { resolveEnterpriseFaceplate } from "./static/js/faceplate-enterprise-models.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";

const vendors = ["Cisco", "HPE Aruba", "Juniper", "Dell", "Arista", "Extreme", "Ruckus", "Palo Alto", "Sophos", "Check Point"];
const profiles = hardwareCatalog.filter((profile) => vendors.includes(profile.vendor)
  && ["Switch", "Firewall", "Router"].includes(profile.category));
const verifiedAliasModels = new Map([
  ["PA-440 / PA-450", ["PA-440", "PA-450"]],
  ["PA-1400 family", ["PA-1410"]],
  ["PA-1410 / PA-1420", ["PA-1410"]],
  ["XGS 126 / 136", ["XGS 126"]],
  ["XGS 2100 / 2300", ["XGS 2100"]],
  ["Quantum 6200 / 6600", ["Quantum 6200"]],
  ["Quantum 1500", ["Quantum Spark 1590"]],
]);

/** Create canonical inventory for a documented enterprise panel. */
function deviceFor(model) {
  const profile = profiles.find((profile) => profile.model === model);
  return instantiateProfile(profile, model, { x: 0, y: 0 });
}

/** Compare normalized rectangles with a tolerance for touching boundaries. */
function overlaps(a, b) {
  return a.x < b.x + b.width - 1e-8 && a.x + a.width > b.x + 1e-8
    && a.y < b.y + b.height - 1e-8 && a.y + a.height > b.y + 1e-8;
}

assert.equal(profiles.length, 184, "the entire assigned enterprise inventory must be exercised");
for (const catalog of profiles) {
  const device = instantiateProfile(catalog, catalog.model, { x: 0, y: 0 });
  const profile = resolveEnterpriseFaceplate(device);
  assert.ok(profile, `${catalog.vendor} ${catalog.model} requires a registered family`);
  if (profile.fidelity === "model") {
    const aliasModels = verifiedAliasModels.get(device.model);
    assert.deepEqual(profile.evidence.models, aliasModels || [device.model], "model fidelity requires exact named-model evidence");
    if (aliasModels) {
      assert.equal(profile.evidence.catalogAlias, device.model);
      if (aliasModels.length === 1) assert.equal(profile.evidence.selectedModel, aliasModels[0]);
      else assert.match(profile.evidence.sharedChassis, /identical/);
      assert.ok(profile.evidence.configuration && profile.limitations.length, "combined entries disclose the selected hardware configuration");
    }
    assert.equal(profile.evidence.scope, "model");
    assert.ok(profile.evidence.front && profile.evidence.rear);
  } else assert.equal(profile.fidelity, "family", "untraced inventory stays explicitly classified as family");
  assert.match(profile.source, /^https:\/\//);
  assert.ok(profile.sourcePage);
  assert.ok(profile.family);
  const slots = Object.values(profile.faces).flatMap((face) => face.ports);
  assert.equal(slots.length, device.ports.length, `${device.model}: every catalog port is preserved`);
  for (const port of device.ports) {
    assert.equal(slots.filter((slot) => slot.portIndex === port.portIndex && slot.type === port.type).length, 1,
      `${device.model} ${port.portIndex}/${port.type}: requires exactly one stable typed slot`);
  }
  for (const [face, panel] of Object.entries(profile.faces)) {
    const scene = buildFaceplateScene(device, { x: 0, y: 0, width: 690, height: device.faceplate.unitsU * 100 }, { face });
    // StackWise cavities can span the chassis height; Ethernet/service sockets retain their compact dimensions.
    assert.ok(scene.ports.every((port) => port.port.type === "Stack" || port.height <= 23.0001),
      `${device.model}: actual socket height must stay bounded after scaling its chassis and title strip`);
    assert.ok(panel.components.length, `${device.model} ${face} requires authored panel components`);
    const boxes = panel.ports.map((slot) => ({ ...slot, x: slot.x - slot.width / 2, y: slot.y - slot.height / 2 }));
    for (const item of [...boxes, ...panel.components]) {
      assert.ok(item.width > 0 && item.height > 0 && item.x >= 0 && item.y >= 0
        && item.x + item.width <= 1.000001 && item.y + item.height <= 1.000001,
      `${device.model} ${face} ${item.kind || item.label} stays within chassis`);
    }
    for (let index = 0; index < boxes.length; index++) {
      assert.ok(boxes.slice(index + 1).every((box) => !overlaps(boxes[index], box)),
        `${device.model} ${face}: hit targets must not overlap`);
      assert.ok(panel.components.filter((component) => ["vent", "fan", "power", "psu"].includes(component.kind))
        .every((component) => !overlaps(boxes[index], component)), `${device.model} ${face}: socket obscured by service hardware`);
      if (panel.connectionMarker) assert.ok(!overlaps(boxes[index], panel.connectionMarker), "opposite-panel marker requires reserved space");
    }
    if (panel.connectionMarker) assert.ok(panel.connectionMarker.height * device.faceplate.unitsU <= .130001,
      "opposite-panel capsules retain the same readable height on large chassis");
  }
  const edited = structuredClone(device);
  edited.ports.reverse();
  for (const port of edited.ports) port.label = "renamed";
  assert.deepEqual(resolveEnterpriseFaceplate(edited), profile, "renaming/reordering inventory cannot move physical sockets");
}

for (const model of ["ASA 5506-X", "ASA 5516-X", "ASA 5555-X", "Secure Firewall 1010", "Secure Firewall 1120", "Secure Firewall 1140"]) {
  const profile = resolveEnterpriseFaceplate(deviceFor(model));
  assert.equal(profile.defaultFace, "rear", `${model}: Cisco documents rear-facing I/O`);
  assert.equal(profile.faces.front.ports.length, 0);
}
assert.equal(resolveEnterpriseFaceplate(deviceFor("Secure Firewall 1010")).faces.front.components.some((c) => c.kind === "led"), false,
  "the 1010 front has no connectors or status indicators");

const ex3400 = resolveEnterpriseFaceplate(deviceFor("EX3400-24P"));
assert.equal(ex3400.faces.rear.ports.filter((slot) => slot.type === "QSFP_PLUS_40G").length, 2,
  "EX3400 rear Virtual Chassis uplinks must remain available on the rear face");
assert.ok(ex3400.catalogDiscrepancies.some((note) => note.includes("QSFP28")), "the historical QSFP28 inventory correction is disclosed");
const arista7050 = resolveEnterpriseFaceplate(deviceFor("7050SX3-48YC8"));
const arista7060 = resolveEnterpriseFaceplate(deviceFor("7060CX2-32S"));
assert.ok(arista7050.faces.rear.ports.some((slot) => slot.type === "Console"));
assert.ok(arista7060.faces.front.ports.some((slot) => slot.type === "Console"),
  "Arista's model-specific console placement must not be inferred from vendor alone");

const f2110 = resolveEnterpriseFaceplate(deviceFor("Secure Firewall 2110"));
const f2130 = resolveEnterpriseFaceplate(deviceFor("Secure Firewall 2130"));
assert.equal(f2110.faces.rear.components.filter((c) => c.kind === "psu").length, 0, "2110 uses fixed power");
assert.equal(f2130.faces.rear.components.filter((c) => c.kind === "psu").length, 1, "2130 ships with one PSU and one optional blank position");
assert.equal(f2130.faces.rear.components.filter((c) => c.kind === "module-bay" && c.label === "PSU 2").length, 1);
assert.notDeepEqual(resolveEnterpriseFaceplate(deviceFor("Catalyst 9400 family")).faces.front.components,
  resolveEnterpriseFaceplate(deviceFor("Catalyst 9200 family")).faces.front.components, "modular chassis need a distinct composition");
assert.notDeepEqual(resolveEnterpriseFaceplate(deviceFor("XGS 4300")).faces.rear.components,
  resolveEnterpriseFaceplate(deviceFor("XGS 4500")).faces.rear.components, "Sophos fixed and swappable power must differ");
assert.equal(resolveEnterpriseFaceplate({}), null);
assert.equal(resolveEnterpriseFaceplate({ model: "Catalyst C9200L-24T-4G", faceplate: { vendor: "Other" } }), null);
assert.equal(resolveEnterpriseFaceplate({ model: "Catalyst C9200L-24T-4G-unknown", faceplate: { vendor: "Cisco" } }), null);
assert.equal(resolveEnterpriseFaceplate({ model: "FortiGate 100F", faceplate: { vendor: "Fortinet" } }), null);
