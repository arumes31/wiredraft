import assert from "node:assert/strict";
import { hardwareCatalog, instantiateProfile } from "./static/js/catalog.js";
import { resolveEnterpriseFaceplate } from "./static/js/faceplate-enterprise-models.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";

const vendors = ["Cisco", "HPE Aruba", "Juniper", "Dell", "Arista", "Extreme", "Ruckus", "Palo Alto", "Sophos", "Check Point"];
const profiles = hardwareCatalog.filter((profile) => vendors.includes(profile.vendor)
  && ["Switch", "Firewall", "Router"].includes(profile.category));
const verifiedAliasModels = new Map([
  ["FortiWLC family", ["FortiWLC-500D"]],
  ["X695", ["X695-48Y-8C"]],
  ["X870", ["X870-32c"]],
  ["Secure Firewall 9300", ["FPR-C9300-AC"]],
  ["X465", ["X465-24MU-24W"]],
  ["X590", ["X590-24t-1q-2c"]],
  ["X690", ["X690-48t-2q-4c"]],
  ["PA-7000 family", ["PA-7050"]],
  ["X440-G2", ["X440-G2-48p-10GE4"]],
  ["X450-G2", ["X450-G2-48p-10GE4"]],
  ["X460-G2", ["X460-G2-48p-10GE4"]],
  ["QFX5200 family", ["QFX5200-32C-AFO2"]],
  ["QFX5210 family", ["QFX5210-64C-AFO"]],
  ["QFX5220 family", ["QFX5220-32CD-AFO"]],
  ["EX9200 family", ["EX9204-AC-BND2"]],
  ["QFX10000 family", ["QFX10008-BASE"]],
  ["Meraki MS250", ["MS250-48LP"]],
  ["Meraki MS350", ["MS350-48LP"]],
  ["Meraki MS390", ["MS390-48P-HW"]],
  ["Meraki MS410", ["MS410-32"]],
  ["Meraki MS425", ["MS425-32"]],
  ["Meraki MS450", ["MS450-12"]],
  ["QFX5120 family", ["QFX5120-48Y-AFO2"]],
  ["QFX5130 family", ["QFX5130-32CD-AFO"]],
  ["ICX 7650 family", ["ICX7650-48ZP"]],
  ["ICX 7850 family", ["ICX7850-48F"]],
  ["ICX 8200 family", ["ICX8200-48PF2"]],
  ["Meraki MS120", ["MS120-48FP"]],
  ["Meraki MS210", ["MS210-48FP"]],
  ["Meraki MS225", ["MS225-48FP"]],
  ["QFX5100 family", ["QFX5100-48S-AFO"]],
  ["QFX5110 family", ["QFX5110-48S-AFO"]],
  ["PA-5400 family", ["PA-5410"]],
  ["EX4400 family", ["EX4400-48P"]],
  ["EX4600 family", ["EX4600-40F-AFO"]],
  ["ICX 7450 family", ["ICX7450-48P"]],
  ["ICX 7550 family", ["ICX7550-48ZP"]],
  ["Nexus 7000 family", ["N7K-C7009"]],
  ["Nexus 9000 family", ["N9K-C93180YC-FX3"]],
  ["PA-5200 family", ["PA-5220"]],
  ["EX4100 family", ["EX4100-48P"]],
  ["EX4300 family", ["EX4300-48P"]],
  ["Nexus 3000 family", ["N3K-C3064PQ-10GX"]],
  ["Nexus 5000 family", ["N5K-C5548UP-FA"]],
  ["ICX 7150 family", ["ICX7150-48P-4X10GR"]],
  ["ICX 7250 family", ["ICX7250-48"]],
  ["EX2300 family", ["EX2300-48P"]],
  ["EX3400 family", ["EX3400-48P"]],
  ["PA-3400 family", ["PA-3410"]],
  ["ISR 4300 family", ["ISR4331/K9"]],
  ["ISR 4400 family", ["ISR4431/K9"]],
  ["7800 family", ["DCS-7804R3-BND"]],
  ["Catalyst 9800-L WLC", ["C9800-L-F-K9"]],
  ["ISR 1100 family", ["C1111X-8P"]],
  ["7300 family", ["DCS-7304X3-BND-F"]],
  ["7500 family", ["DCS-7504R3-BND"]],
  ["Catalyst 9400 family", ["C9404R"]],
  ["Catalyst 9600 family", ["C9606R"]],
  ["7260 family", ["DCS-7260CX3-64-F"]],
  ["7280 family", ["DCS-7280SR3-48YC8-F"]],
  ["Catalyst 9200 family", ["C9200L-48P-4X"]],
  ["Catalyst 9300 family", ["C9300L-48P-4X"]],
  ["Catalyst 9500 family", ["C9500-48Y4C"]],
  ["7010 family", ["DCS-7010T-48-F"]],
  ["7020 family", ["DCS-7020TR-48-F"]],
  ["7050 family", ["DCS-7050SX3-48YC8-F"]],
  ["7060 family", ["DCS-7060CX2-32S-F"]],
  ["CX 6400 family", ["R0X26A"]],
  ["CX 8400 family", ["JL376A"]],
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
    // Source-sized AC inlets have a larger envelope than the network sockets.
    const powerEnvelope = device.model === "EX2300 family" ? ["juniper-ex-c14", 40, 31]
      : device.model === "EX3400 family" ? ["juniper-ex-c14-portrait", 28, 35]
      : device.model === "EX4100 family" ? ["juniper-ex-next-c14-portrait", 28, 35]
      : device.model === "EX4300 family" ? ["juniper-ex-next-c16", 47, 34]
      : device.model === "EX4400 family" ? ["juniper-ex-core-c16-portrait", 29, 37]
      : device.model === "EX4600 family" ? ["juniper-ex-core-c14-portrait", 29, 37]
      : ["QFX5100 family", "QFX5110 family"].includes(device.model) ? ["juniper-qfx-access-c14-portrait", 29, 37] : device.model === "QFX5120 family" ? ["juniper-qfx-next-c14-portrait", 29, 37]
      : device.model === "QFX5130 family" ? ["juniper-qfx-next-c16-portrait", 29, 37] : device.model === "QFX5200 family" ? ["juniper-qfx-spine-c14-850", 29, 37]
      : device.model === "QFX5210 family" ? ["juniper-qfx-spine-c16-1100", 29, 37]
      : device.model === "QFX5220 family" ? ["juniper-qfx-spine-c16-1600", 29, 37] : device.model === "PA-7000 family" ? ["pa7050-c20", 70, 38]
      : device.model === "EX9200 family" ? ["juniper-modular-ex-c20", 38, 44]
      : device.model === "QFX10000 family" ? ["juniper-modular-qfx-c20", 45, 34]
      : ["SRX5400", "SRX5600"].includes(device.model) ? ["juniper-srx5k-c20", 37, 44]
      : device.model === "SRX5800" ? ["juniper-srx5k-c20-diagonal", 47, 40] : null;
    // Portrait QSFP cages exchange the usual horizontal long/short axes; keep both dimensions bounded.
    assert.ok(scene.ports.every((port) => {
      if (port.port.type === "Power" && powerEnvelope && port.connectorKind === powerEnvelope[0]) {
        return port.width <= powerEnvelope[1] && port.height <= powerEnvelope[2];
      }
      // The SRX5800 rotates the same source-sized cards into vertical chassis slots.
      const rotated = device.model === "SRX5800" && {
        "juniper-srx5k-qsfp-v": [17, 30],
        "juniper-srx5k-sfp-v": [17, 24],
        "juniper-srx5k-rj45-v": [18, 26],
      }[port.connectorKind];
      if (rotated) return port.width <= rotated[0] && port.height <= rotated[1] && port.height > port.width;
      return port.port.type === "Stack" || (port.connectorKind === "qsfp-vertical"
        ? port.width <= 23.0001 && port.height <= 24.0001 && port.height > port.width : port.height <= 23.0001);
    }),
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
