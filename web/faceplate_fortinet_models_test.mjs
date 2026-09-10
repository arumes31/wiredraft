import assert from "node:assert/strict";
import { hardwareCatalog, instantiateProfile, upgradeInstalledPhysicalPorts } from "./static/js/catalog.js";
import { resolveFortinetFaceplate } from "./static/js/faceplate-fortinet-models.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";
import { hardwarePrimitives } from "./static/js/hardware-components.js";

/** Instantiate a catalog device with canonical inventory for panel assertions. */
function deviceFor(model) {
  return instantiateProfile(hardwareCatalog.find((item) => item.vendor === "Fortinet" && item.model === model), model, { x: 0, y: 0 });
}

/** Determine whether normalized rectangles visibly cover one another. */
function overlaps(a, b) {
  return a.x < b.x + b.width - .00001 && a.x + a.width > b.x + .00001 &&
    a.y < b.y + b.height - .00001 && a.y + a.height > b.y + .00001;
}

const catalog = hardwareCatalog.filter((item) => item.vendor === "Fortinet");
assert.equal(catalog.length, 225);
for (const entry of catalog) {
  const device = deviceFor(entry.model);
  const profile = resolveFortinetFaceplate(device);
  assert.ok(profile, entry.model);
  assert.match(profile.source, /^https:\/\//);
  assert.ok(profile.sourcePage);
  assert.ok(["family", "model"].includes(profile.fidelity));
  const ports = Object.values(profile.faces).flatMap((face) => face.ports);
  assert.equal(ports.length, device.ports.length, `${entry.model} preserves every inventory socket`);
  assert.deepEqual(new Set(ports.map((port) => port.portIndex)), new Set(device.ports.map((port) => port.portIndex)));
  for (const port of device.ports) assert.ok(ports.some((item) => item.portIndex === port.portIndex && item.type === port.type && item.label === port.label));
  for (const face of Object.values(profile.faces)) {
    const boxes = face.ports.map((port) => ({ x: port.x - port.width / 2, y: port.y - port.height / 2, width: port.width, height: port.height }));
    for (const [index, box] of boxes.entries()) {
      assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= 1 && box.y + box.height <= 1, `${entry.model} port bounds`);
      assert.ok(box.width > 0 && box.height > 0);
      assert.ok(box.height * Math.max(1, entry.units || 1) <= .240001, `${entry.model} physical socket height must not scale with rack units`);
      for (const other of boxes.slice(index + 1)) assert.equal(overlaps(box, other), false, `${entry.model} sockets overlap`);
      for (const component of face.components) assert.equal(overlaps(box, component), false, `${entry.model} ${component.kind} overlaps socket`);
    }
    for (const component of face.components) assert.ok(component.x >= 0 && component.y >= 0 && component.x + component.width <= 1 && component.y + component.height <= 1);
  }
  if (!profile.rearHardwareVerified) assert.ok(profile.faces.rear.components.every((item) => item.kind === "text"), "unverified hardware must not acquire invented PSU/fan counts");
  const renamed = structuredClone(device);
  renamed.ports.forEach((port) => { port.label = "custom"; port.id = `kept-${port.portIndex}`; });
  assert.equal(resolveFortinetFaceplate(renamed), profile, "editable port data must not alter the model geometry cache");
}

for (const model of ["FortiSwitch 148F", "FortiSwitch 148F-POE", "FortiSwitch 148F-FPOE", "FortiSwitch 624F", "FortiSwitch 624F-FPOE", "FortiSwitch 648F", "FortiSwitch 648F-FPOE"]) {
  assert.equal(resolveFortinetFaceplate(deviceFor(model)).fidelity, "model");
}
assert.equal(resolveFortinetFaceplate(deviceFor("FortiSwitch 624F")).faces.rear.components.filter((item) => item.kind === "fan").length, 3);
assert.equal(resolveFortinetFaceplate(deviceFor("FortiSwitch 648F")).faces.rear.components.filter((item) => item.kind === "fan").length, 4);
assert.equal(resolveFortinetFaceplate(deviceFor("FortiSwitch 148F")).faces.rear.components.filter((item) => item.kind === "fan").length, 0);
for (const model of ["FortiGate 90G", "FortiGate 120G"]) {
  const profile = resolveFortinetFaceplate(deviceFor(model));
  assert.equal(profile.fidelity, "model", "panel geometry is independently verified even when catalog labels or sockets need correction");
  assert.ok(profile.catalogDiscrepancies.length);
  assert.ok(profile.hardwareRevision);
}
assert.equal(resolveFortinetFaceplate({ model: "FortiGate unknown", faceplate: { vendor: "Fortinet" } }), null);
assert.equal(resolveFortinetFaceplate({ model: "FortiGate 90G", faceplate: { vendor: "Other" } }), null);
assert.equal(resolveFortinetFaceplate({}), null);
for (const model of ["FortiGate 40F-3G4G", "FortiGate 70G-POE", "FortiGate 80F-POE", "FortiAP 231F"]) {
  const profile = resolveFortinetFaceplate(deviceFor(model));
  assert.equal(profile.defaultFace, "rear");
  assert.equal(profile.faces.front.ports.length, 0);
  assert.ok(profile.faces.front.components.some((item) => item.kind === "led"));
}
for (const [model, fans] of [["FortiSwitch 424E", 1], ["FortiSwitch 424E-Fiber", 0], ["FortiSwitch 424E-POE", 2], ["FortiSwitch 424E-FPOE", 2]]) {
  const profile = resolveFortinetFaceplate(deviceFor(model));
  assert.equal(profile.faces.rear.components.filter((item) => item.kind === "fan").length, fans);
  assert.ok(profile.faces.rear.components.some((item) => item.kind === "console"));
  assert.equal(profile.fidelity, "model");
  assert.equal(profile.inventoryComplete, false);
  assert.equal(profile.missingPorts[0].type, "Console");
  assert.equal(profile.missingPorts[0].face, "rear");
}
for (const model of ["FortiSwitch 224E", "FortiSwitch 224E-POE", "FortiSwitch 248E-POE", "FortiSwitch 248E-FPOE"]) {
  const profile = resolveFortinetFaceplate(deviceFor(model));
  assert.ok(profile.faces.rear.components.some((item) => item.kind === "console"));
  assert.equal(profile.faces.rear.components.filter((item) => item.kind === "power").length, model.includes("POE") ? 1 : 2);
}
for (const [model, fans] of [["FortiSwitch 1048E", 4], ["FortiSwitch 1048G", 5], ["FortiSwitch 2048F", 6],
  ["FortiSwitch 3032E", 5], ["FortiSwitch 3032G", 5], ["FortiSwitch 524D", 1], ["FortiSwitch 548D-FPOE", 1]]) {
  const profile = resolveFortinetFaceplate(deviceFor(model));
  assert.equal(profile.fidelity, "model");
  assert.equal(profile.inventoryComplete, true);
  assert.equal(profile.faces.rear.components.filter((item) => item.kind === "fan").length, fans);
}
const highDensity = resolveFortinetFaceplate(deviceFor("FortiSwitch 2048F"));
assert.equal(new Set(highDensity.faces.front.ports.filter((port) => port.type === "SFP28_25G").map((port) => port.y)).size, 3,
  "2048F SFP28 ports occupy three physical rows");
for (const model of ["FortiSwitch 124G", "FortiSwitch 124G-FPOE"]) {
  const profile = resolveFortinetFaceplate(deviceFor(model));
  assert.equal(profile.fidelity, "model");
  assert.equal(profile.faces.rear.components.filter((item) => item.kind === "fan").length, 0);
  assert.equal(profile.faces.front.ports.filter((port) => port.type === "SFP_PLUS_10G").length, 6);
}
const base108 = resolveFortinetFaceplate(deviceFor("FortiSwitch 108F"));
assert.equal(base108.missingPorts[0].type, "Console");
assert.equal(base108.missingPorts[0].face, "rear");
assert.ok(base108.faces.front.connectionMarker && base108.faces.rear.connectionMarker);
for (const model of ["FortiSwitch 108F-POE", "FortiSwitch 108F-FPOE"]) {
  const profile = resolveFortinetFaceplate(deviceFor(model));
  assert.equal(profile.faces.rear.ports.length, 0);
  assert.ok(profile.faces.front.ports.some((port) => port.type === "Console"));
}
assert.equal(resolveFortinetFaceplate(deviceFor("FortiSwitch 224D-FPOE")).faces.rear.components.filter((item) => item.kind === "fan").length, 2);
for (const model of ["FortiSwitch Rugged 108F", "FortiSwitch Rugged 112F-POE", "FortiSwitch Rugged 216F-POE"]) {
  const profile = resolveFortinetFaceplate(deviceFor(model));
  assert.deepEqual(profile.verifiedFaces, ["front"]);
  assert.equal(profile.panelsVerified, false);
  assert.deepEqual(profile.faces.front.components.filter((item) => item.kind === "terminal").map((item) => item.pins).sort(), [4, 5]);
}
const rugged424 = resolveFortinetFaceplate(deviceFor("FortiSwitch Rugged 424F-POE"));
assert.equal(rugged424.hardwareRevision, "P26913-05 and above");
assert.equal(rugged424.fidelity, "model");
assert.deepEqual(rugged424.faces.rear.components.filter((item) => item.kind === "terminal").map((item) => item.pins), [3, 5]);
assert.equal(rugged424.missingPorts[0].type, "Console");
assert.equal(resolveFortinetFaceplate(deviceFor("FortiGate 120G")).inventoryComplete, true);
assert.equal(resolveFortinetFaceplate(deviceFor("FortiGate 90G")).missingPorts.length, 2);
const cellular40 = resolveFortinetFaceplate(deviceFor("FortiGate 40F-3G4G"));
assert.equal(cellular40.fidelity, "model");
assert.equal(cellular40.faces.front.components.filter((item) => item.kind === "coax").length, 3,
  "FortiGate cellular antenna connectors are on the front");
assert.equal(cellular40.faces.rear.components.filter((item) => item.kind === "coax").length, 0,
  "the FortiWiFi-only rear antennas must not appear on a FortiGate");
assert.deepEqual([...cellular40.faces.rear.ports].sort((a, b) => a.x - b.x).map((port) => port.label),
  ["CONSOLE", "WAN", "A", "3", "2", "1"]);
for (const model of ["FortiGate 80F-POE", "FortiGate 81F-POE", "FortiGate 80F-Bypass"]) {
  const profile = resolveFortinetFaceplate(deviceFor(model));
  assert.equal(profile.fidelity, "model");
  assert.equal(profile.faces.rear.components.filter((item) => item.kind === "power").length, 2);
  assert.equal(profile.faces.front.components.some((item) => item.kind === "vent"), model.endsWith("POE"),
    "the PoE chassis has an additional front ventilation strip");
}
for (const model of ["FortiGate 900G", "FortiGate 901G", "FortiGate 900G-DC", "FortiGate 901G-DC"]) {
  const profile = resolveFortinetFaceplate(deviceFor(model));
  assert.equal(profile.fidelity, "model");
  assert.deepEqual(profile.faces.rear.components.filter((item) => item.kind === "psu").map((item) => item.variant),
    [model.endsWith("-DC") ? "dc" : "ac", model.endsWith("-DC") ? "dc" : "ac"]);
  assert.equal(profile.faces.front.ports.find((port) => port.type === "RJ45_MGIG").physicalLabel, "HA",
    "the catalog's editable management label must not relocate the physical HA socket");
}
const extender511 = resolveFortinetFaceplate(deviceFor("FortiExtender 511F"));
assert.equal(extender511.fidelity, "model");
assert.equal(extender511.inventoryComplete, false);
assert.equal(extender511.missingPorts[0].type, "Console");
assert.equal(extender511.missingPorts[0].face, "front");
assert.ok(extender511.faces.rear.components.some((item) => item.kind === "button" && item.variant === "reset"));
for (const model of ["FortiGate 400F-DC", "FortiGate 401F-DC", "FortiGate 1000F", "FortiGate 1001F", "FortiGate 1100E", "FortiGate 1101E"]) {
  assert.equal(resolveFortinetFaceplate(deviceFor(model)).fidelity, "model", `${model} has separately traced panels`);
}
for (const model of ["FortiGate 1000F", "FortiGate 1100E"]) {
  const profile = resolveFortinetFaceplate(deviceFor(model));
  assert.ok(profile.faces.front.ports.every((port) => port.y > .55), "two-unit chassis keep connectors below the upper ventilation bank");
  assert.equal(profile.faces.rear.components.filter((item) => item.kind === "psu").length, 2);
}
for (const model of ["FortiGate 1800F", "FortiGate 1801F"]) {
  const device = deviceFor(model);
  const profile = resolveFortinetFaceplate(device);
  assert.equal(profile.fidelity, "model");
  assert.equal(device.ports.length, 45);
  assert.equal(device.faceplate.inventoryRevision, 1);
  const legacy = structuredClone(device);
  delete legacy.faceplate.inventoryRevision;
  legacy.ports.at(-1).label = "Renamed console";
  legacy.ports.push({ ...legacy.ports.at(-1), id: "saved-extra-console", portIndex: 46, label: "Legacy link" });
  const before = structuredClone(legacy);
  assert.equal(upgradeInstalledPhysicalPorts({ devices: [legacy] }), false,
    "an old inventory revision must not be silently rewritten");
  assert.deepEqual(legacy, before);
  const scene = buildFaceplateScene(legacy, { x: 0, y: 0, width: 690, height: 200 });
  assert.equal(scene.ports.length, 45);
  assert.equal(scene.unmappedPorts.length, 1);
  assert.equal(scene.unmappedPorts[0].id, "saved-extra-console");
}
for (const model of ["FortiGate 2600F", "FortiGate 2601F", "FortiGate 3000F", "FortiGate 3001F",
  "FortiGate 3200F", "FortiGate 3201F", "FortiGate 3500F", "FortiGate 3501F"]) {
  assert.equal(resolveFortinetFaceplate(deviceFor(model)).fidelity, "model");
}
const fresh3000 = deviceFor("FortiGate 3000F");
const old3000 = structuredClone(fresh3000);
delete old3000.faceplate.inventoryRevision;
old3000.ports.forEach((port) => {
  if (port.portIndex > 18) port.portIndex += 2;
  if (port.portIndex < 3) { port.type = "RJ45_1G"; port.speedMbps = 1000; }
  port.label = "Operator label";
});
old3000.ports.splice(18, 0, ...[19, 20].map((portIndex) => ({ ...old3000.ports[17],
  id: `legacy-extra-${portIndex}`, portIndex, label: "Preserved connection" })));
const old3000Before = structuredClone(old3000);
assert.equal(upgradeInstalledPhysicalPorts({ devices: [old3000] }), false);
assert.deepEqual(old3000, old3000Before);
const testBounds = { x: 0, y: 0, width: 690, height: 200 };
const fresh3000Scene = buildFaceplateScene(fresh3000, testBounds);
const old3000Scene = buildFaceplateScene(old3000, testBounds);
assert.equal(old3000Scene.ports.length, 41);
assert.deepEqual(old3000Scene.unmappedPorts.map((port) => port.id), ["legacy-extra-19", "legacy-extra-20"]);
for (const expected of fresh3000Scene.ports) {
  const oldIndex = expected.port.portIndex <= 18 ? expected.port.portIndex : expected.port.portIndex + 2;
  const actual = old3000Scene.ports.find((port) => port.port.portIndex === oldIndex);
  assert.ok(actual, `saved 3000F index ${oldIndex} still resolves`);
  assert.equal(actual.centerX, expected.centerX);
  assert.equal(actual.centerY, expected.centerY);
}
const old3500 = deviceFor("FortiGate 3500F");
delete old3500.faceplate.inventoryRevision;
old3500.ports.slice(0, 2).forEach((port) => { port.type = "RJ45_1G"; port.speedMbps = 1000; });
assert.equal(buildFaceplateScene(old3500, testBounds).unmappedPorts.length, 0,
  "the media correction retains existing management endpoints at their physical sockets");
for (const model of ["FortiGate 3700F", "FortiGate 3701F", "FortiGate 3000G", "FortiGate 3001G",
  "FortiGate 3500G", "FortiGate 3501G", "FortiGate 3800G", "FortiGate 3801G"]) {
  assert.equal(resolveFortinetFaceplate(deviceFor(model)).fidelity, "model");
}
const largeG = resolveFortinetFaceplate(deviceFor("FortiGate 3800G"));
assert.equal(largeG.faces.rear.components.filter((item) => item.kind === "psu").length, 4);
assert.equal(largeG.faces.rear.components.filter((item) => item.kind === "fan" && item.variant === "removable").length, 3);
assert.equal(largeG.faces.front.components.filter((item) => item.kind === "lcd").length, 1);
assert.deepEqual(largeG.faces.front.ports.filter((port) => /^HA/.test(port.physicalLabel || "")).map((port) => port.physicalLabel),
  ["HA1", "HA2", "HA3", "HA4"]);
assert.equal(resolveFortinetFaceplate(deviceFor("FortiGate 3500G")).faces.rear.components.filter((item) => item.kind === "fan").length, 3,
  "the G model has a different rear assembly from the four-fan 3500F");
const legacyG = structuredClone(old3000);
legacyG.model = "FortiGate 3000G";
const legacyGScene = buildFaceplateScene(legacyG, testBounds);
assert.equal(legacyGScene.ports.length, 41);
assert.equal(legacyGScene.unmappedPorts.length, 2);
const expectedG = buildFaceplateScene(deviceFor("FortiGate 3000G"), testBounds);
assert.equal(legacyGScene.ports.find((port) => port.port.portIndex === 21).centerX,
  expectedG.ports.find((port) => port.port.portIndex === 19).centerX);

for (const base of ["4200F", "4201F", "4400F", "4401F", "4800F", "4801F", "4801F-NEBS"]) {
  for (const dc of [false, true]) {
    const model = `FortiGate ${dc ? base.replace(/-NEBS$/, "") + "-DC" + (base.endsWith("NEBS") ? "-NEBS" : "") : base}`;
    const profile = resolveFortinetFaceplate(deviceFor(model));
    assert.equal(profile.fidelity, "model", `${model} must use its inspected front and rear`);
    assert.equal(profile.inventoryComplete, true);
    assert.equal(profile.faces.rear.components.filter((item) => item.kind === "fan" && item.variant === "removable").length, 3);
    const expectedSupplies = base.startsWith("420") || dc && base.startsWith("440") ? 2 : 4;
    assert.deepEqual(profile.faces.rear.components.filter((item) => item.kind === "psu").map((item) => item.variant),
      Array(expectedSupplies).fill(dc ? "dc-keyed2" : "ac"), `${model} must retain its documented PSU population`);
    assert.ok(profile.faces.front.ports.every((port) => port.y > .7), "large chassis ports occupy the lower connector strip");
  }
}
const next4200 = deviceFor("FortiGate 4200F");
assert.equal(next4200.ports.filter((port) => port.type === "SFP28_25G").length, 20,
  "4200F includes both HA, both AUX and sixteen data SFP28 sockets");
const saved4200 = structuredClone(next4200);
delete saved4200.faceplate.inventoryRevision;
saved4200.ports = saved4200.ports.filter((port) => ![21, 22].includes(port.portIndex));
saved4200.ports.forEach((port) => {
  if (port.portIndex > 22) port.portIndex -= 2;
  port.id = `saved-4200-${port.portIndex}`;
  port.label = "Operator connection";
  port.speedMbps = 1234;
});
const saved4200Before = structuredClone(saved4200);
assert.equal(upgradeInstalledPhysicalPorts({ devices: [saved4200] }), false);
const old4200Scene = buildFaceplateScene(saved4200, { ...testBounds, height: 300 });
const next4200Scene = buildFaceplateScene(next4200, { ...testBounds, height: 300 });
assert.equal(old4200Scene.ports.length, 29);
assert.equal(old4200Scene.unmappedPorts.length, 0);
for (const actual of old4200Scene.ports) {
  const nextIndex = actual.port.portIndex > 20 ? actual.port.portIndex + 2 : actual.port.portIndex;
  const expected = next4200Scene.ports.find((port) => port.port.portIndex === nextIndex);
  assert.equal(actual.centerX, expected.centerX, `saved4200 index ${actual.port.portIndex} keeps the correct connector`);
  assert.equal(actual.centerY, expected.centerY);
}
assert.deepEqual(saved4200, saved4200Before, "rendering and catalog updates preserve saved IDs, labels and configuration");
const all4800 = resolveFortinetFaceplate(deviceFor("FortiGate 4801F-DC-NEBS"));
assert.match(all4800.hardwareRevision, /2026/);
assert.deepEqual(all4800.faces.front.ports.filter((port) => /^(?:HA|AUX)/.test(port.physicalLabel || "")).map((port) => port.physicalLabel),
  ["HA1", "HA2", "AUX1", "AUX2"]);
for (const model of ["FortiGate 1100E-DC", "FortiGate 1800F-DC", "FortiGate 1801F-DC", "FortiGate 2600F-DC",
  "FortiGate 2601F-DC", "FortiGate 3000F-DC", "FortiGate 3001F-DC"]) {
  const profile = resolveFortinetFaceplate(deviceFor(model));
  assert.equal(profile.fidelity, "model", `${model} has a separately illustrated DC rear panel`);
  assert.equal(profile.inventoryComplete, true);
  assert.equal(profile.faces.rear.components.filter((item) => item.kind === "fan").length, 3);
  assert.equal(profile.faces.rear.components.filter((item) => item.kind === "psu").length, 2);
  assert.ok(profile.faces.rear.components.filter((item) => item.kind === "psu").every((item) => item.variant === "dc-terminal2"));
}
for (const [model, fans] of [["FortiGate 300E", 3], ["FortiGate 301E", 3], ["FortiGate 400E", 4], ["FortiGate 401E", 4],
  ["FortiGate 401E-DC", 4], ["FortiGate 500E", 3], ["FortiGate 501E", 3], ["FortiGate 600E", 4], ["FortiGate 601E", 4]]) {
  const profile = resolveFortinetFaceplate(deviceFor(model));
  assert.equal(profile.fidelity, "model");
  assert.equal(profile.faces.rear.components.filter((item) => item.kind === "fan").length, fans);
  assert.equal(profile.faces.rear.components.filter((item) => item.kind === "psu").length, 1, "the standard rear has one supply and an optional empty bay");
  assert.ok(profile.faces.rear.components.some((item) => item.kind === "module-bay" && item.label === "PWR2 OPTIONAL"));
  assert.deepEqual(profile.faces.front.ports.filter((port) => /^(?:S|VW)\d$/.test(port.physicalLabel || "")).map((port) => port.physicalLabel),
    ["S1", "S2", "VW1", "VW2"]);
}
for (const model of ["FortiGate 200E", "FortiGate 201E"]) {
  const profile = resolveFortinetFaceplate(deviceFor(model));
  assert.equal(profile.fidelity, "model");
  assert.ok(profile.faces.rear.components.some((item) => item.variant === "dc-multipin" && item.columns === 7),
    "the RPS inlet has fourteen contacts in two rows");
  assert.equal(profile.faces.front.components.some((item) => item.kind === "text" && item.label === "HDD"), model === "FortiGate 201E");
}
for (const model of ["FortiGate 50G-5G", "FortiGate 51G-5G"]) {
  const profile = resolveFortinetFaceplate(deviceFor(model));
  assert.equal(profile.fidelity, "model");
  assert.equal(profile.defaultFace, "rear");
  assert.equal(profile.faces.front.ports.length, 0);
  assert.equal(profile.faces.front.components.filter((item) => item.kind === "coax" && item.variant !== "capped").length, 2);
  assert.equal(profile.faces.front.components.filter((item) => item.kind === "coax" && item.variant === "capped").length, 1);
  assert.equal(profile.faces.rear.components.filter((item) => item.kind === "coax").length, 3);
  assert.deepEqual([...profile.faces.rear.ports].sort((a, b) => a.x - b.x).map((port) => port.physicalLabel),
    ["CONSOLE", "WAN", "A", "3", "2", "1"]);
}

for (const [model, count, supplyCount] of [["2201E-ACDC", 39, 2], ["3300E", 39, 2], ["3301E", 39, 2],
  ["3400E", 31, 2], ["3401E", 31, 2], ["3400E-DC", 31, 2], ["3401E-DC", 31, 2],
  ["3600E", 41, 2], ["3601E", 41, 2], ["3600E-DC", 41, 2],
  ["3960E", 25, 3], ["3980E", 29, 3], ["3960E-DC", 25, 3], ["3980E-DC", 29, 3]]) {
  const device = deviceFor(`FortiGate ${model}`);
  const profile = resolveFortinetFaceplate(device);
  assert.equal(profile.fidelity, "model", `${model} has its own documented front and rear`);
  assert.equal(profile.inventoryComplete, true);
  assert.equal(device.ports.length, count, `${model} has its documented typed inventory`);
  assert.equal(profile.faces.rear.components.filter((item) => item.kind === "fan").length, 4);
  const supplies = profile.faces.rear.components.filter((item) => item.kind === "psu");
  assert.equal(supplies.length, supplyCount);
  assert.ok(supplies.every((item) => item.orientation === "vertical"));
  assert.ok(supplies.every((item) => item.variant === (model.endsWith("-DC") ? "dc-terminal2" : "ac")));
}

/** Check legacy endpoint identities, edited configuration and explicit physical index migrations together. */
function verifyLegacyE(model, groups, indexMap) {
  const fresh = deviceFor(`FortiGate ${model}`);
  const saved = structuredClone(fresh);
  delete saved.faceplate.inventoryRevision;
  saved.ports = groups.flatMap(([type, count]) => Array(count).fill(type)).map((type, index) => ({
    ...fresh.ports[0], id: `saved-${model}-${index + 1}`, portIndex: index + 1,
    label: `Operator connection ${index + 1}`, type, speedMbps: 1234,
  }));
  const before = structuredClone(saved);
  assert.equal(upgradeInstalledPhysicalPorts({ devices: [saved] }), false);
  const bounds = { ...testBounds, height: fresh.faceplate.unitsU * 100 };
  const expected = buildFaceplateScene(fresh, bounds);
  const actual = buildFaceplateScene(saved, bounds);
  assert.equal(actual.ports.length, Object.keys(indexMap).length);
  assert.deepEqual(actual.unmappedPorts.map((port) => port.portIndex),
    saved.ports.filter((port) => !indexMap[port.portIndex]).map((port) => port.portIndex));
  for (const port of actual.ports) {
    const corresponding = expected.ports.find((item) => item.port.portIndex === indexMap[port.port.portIndex]);
    assert.ok(corresponding, `${model} legacy index ${port.port.portIndex}`);
    assert.ok([port.centerX, port.centerY, corresponding.centerX, corresponding.centerY].every(Number.isFinite));
    assert.equal(port.centerX, corresponding.centerX);
    assert.equal(port.centerY, corresponding.centerY);
  }
  assert.deepEqual(saved, before, "inventory corrections never rewrite saved endpoint IDs, labels or configuration");
}

verifyLegacyE("3300E", [["RJ45_1G", 16], ["SFP28_25G", 16], ["QSFP28_100G", 4], ["Console", 1]],
  Object.fromEntries(Array.from({ length: 37 }, (_, index) => [index + 1, index < 16 ? index + 1 : index + 3])));
verifyLegacyE("3401E-DC", [["RJ45_1G", 2], ["SFP28_25G", 24], ["QSFP28_100G", 4], ["Console", 2]],
  Object.fromEntries(Array.from({ length: 31 }, (_, index) => [index + 1, index + 1])));
verifyLegacyE("3600E", [["RJ45_1G", 2], ["SFP28_25G", 24], ["QSFP28_100G", 4], ["Console", 1]],
  Object.fromEntries(Array.from({ length: 31 }, (_, index) => [index + 1, index < 26 ? index + 1 : index < 30 ? index + 9 : 41])));
for (const model of ["3960E", "3980E-DC"]) {
  const moreQSFP = model.startsWith("3980");
  const expectedMap = Object.fromEntries(Array.from({ length: 18 }, (_, index) => [index + 1, index + 1]));
  for (let index = 35; index <= (moreQSFP ? 42 : 40); index++) expectedMap[index] = index - 16;
  expectedMap[43] = moreQSFP ? 29 : 25;
  verifyLegacyE(model, [["RJ45_1G", 2], ["SFP28_25G", 32], ["QSFP28_100G", 8], ["Console", 1]], expectedMap);
}

for (const [model, count, fans] of [["2200E", 39, 4], ["2201E", 39, 4], ["2000E", 41, 3],
  ["2500E", 47, 3], ["400E-Bypass", 35, 4]]) {
  const device = deviceFor(`FortiGate ${model}`);
  const profile = resolveFortinetFaceplate(device);
  assert.equal(profile.fidelity, "model", model);
  assert.equal(profile.inventoryComplete, true);
  assert.equal(device.ports.length, count);
  assert.equal(profile.faces.rear.components.filter((item) => item.kind === "fan").length, fans);
  assert.equal(profile.faces.rear.components.filter((item) => item.kind === "psu").length, 2);
}
const bypass2500 = resolveFortinetFaceplate(deviceFor("FortiGate 2500E")).faces.front.ports.filter((port) => port.type === "FIBER_LC");
assert.deepEqual(bypass2500.map((port) => port.physicalLabel), ["43", "44"], "fixed LC bypass optics are not pluggable SFP sockets");
for (const model of ["2000E", "2500E"]) {
  const expectedMap = Object.fromEntries(Array.from({ length: 14 }, (_, index) => [index + 1, index + 1]));
  for (let index = 15; index <= (model === "2000E" ? 20 : 24); index++) expectedMap[index] = index + 20;
  expectedMap[39] = model === "2000E" ? 41 : 47;
  verifyLegacyE(model, [["RJ45_1G", 14], ["SFP28_25G", 20], ["QSFP_PLUS_40G", 4], ["Console", 1]], expectedMap);
}
verifyLegacyE("400E-Bypass", [["RJ45_1G", 18], ["SFP_1G", 16], ["Console", 1]],
  { ...Object.fromEntries(Array.from({ length: 18 }, (_, index) => [index + 1, index + 1])), 35: 35 });

for (const [model, count, fans, supplies] of [["800D", 37, 5, 1], ["800D-DC", 37, 5, 1], ["900D", 38, 0, 2], ["1000D", 38, 0, 2],
  ["3000D", 19, 3, 2], ["3000D-DC", 19, 3, 2], ["3100D", 35, 3, 2], ["3100D-DC", 35, 3, 2],
  ["3200D", 51, 3, 2], ["3200D-DC", 51, 3, 2], ["3700D", 36, 3, 2], ["3700D-DC", 36, 3, 2]]) {
  const device = deviceFor(`FortiGate ${model}`);
  const profile = resolveFortinetFaceplate(device);
  assert.equal(profile.fidelity, "model", model);
  assert.equal(profile.inventoryComplete, true);
  assert.equal(device.ports.length, count);
  assert.equal(profile.faces.rear.components.filter((item) => item.kind === "fan").length, fans);
  assert.equal(profile.faces.rear.components.filter((item) => item.kind === "psu").length, supplies);
  if (model.endsWith("-DC")) assert.ok(profile.faces.rear.components.filter((item) => item.kind === "psu").every((item) =>
    item.variant === (model.startsWith("800") ? "dc-recessed3-inlet-right" : model.startsWith("3700") ? "dc-terminal2" : "dc-keyed3-inlet-right")));
}
for (const model of ["900D", "1000D", "3700D", "3700D-DC"]) {
  const profile = resolveFortinetFaceplate(deviceFor(`FortiGate ${model}`));
  assert.equal(profile.faces.front.ports.filter((port) => port.type === "USB_MINI_CONSOLE").length, 1);
}
const front800D = resolveFortinetFaceplate(deviceFor("FortiGate 800D")).faces.front.ports;
assert.deepEqual(front800D.filter((port) => /^WAN/.test(port.physicalLabel || "")).map((port) => port.portIndex), [25, 26],
  "new WAN endpoints do not displace the existing twenty-four copper identities");
for (const label of ["1", "2"]) {
  const wan = front800D.find((port) => port.physicalLabel === `WAN${label}`);
  const data = front800D.find((port) => port.physicalLabel === label);
  assert.equal(wan.x, data.x, "each WAN socket sits above its same-numbered bypass partner");
  assert.ok(wan.y < data.y);
}
verifyLegacyE("800D", [["RJ45_1G", 24], ["SFP_1G", 8], ["SFP_PLUS_10G", 2], ["Console", 1]],
  Object.fromEntries(Array.from({ length: 35 }, (_, index) => [index + 1, index < 24 ? index + 1 : index + 3])));
for (const model of ["900D", "1000D"]) verifyLegacyE(model,
  [["RJ45_1G", 18], ["SFP_1G", 16], ["SFP_PLUS_10G", 2], ["Console", 1]],
  Object.fromEntries(Array.from({ length: 37 }, (_, index) => [index + 1, index + 1])));
verifyLegacyE("3100D-DC", [["RJ45_1G", 2], ["SFP_PLUS_10G", 48], ["Console", 1]],
  { ...Object.fromEntries(Array.from({ length: 34 }, (_, index) => [index + 1, index + 1])), 51: 35 });
verifyLegacyE("3700D-DC", [["RJ45_1G", 2], ["SFP_PLUS_10G", 28], ["QSFP_PLUS_40G", 4], ["Console", 2]],
  Object.fromEntries(Array.from({ length: 36 }, (_, index) => [index + 1, index + 1])));

for (const model of ["3300E", "3960E", "2000E", "400E-Bypass", "800D", "3000D", "3700D"]) {
  const device = deviceFor(`FortiGate ${model}`);
  const rear = resolveFortinetFaceplate(device).faces.rear;
  const studs = rear.components.filter((item) => item.kind === "screw");
  assert.equal(studs.length, 2, `${model} has two exposed chassis earthing studs`);
  assert.equal(rear.components.some((item) => item.kind === "terminal"), false, "metal earth studs are not green terminal blocks");
  for (const stud of studs) {
    const art = hardwarePrimitives({ ...stud, x: stud.x * 1000, y: stud.y * device.faceplate.unitsU * 100,
      width: stud.width * 1000, height: stud.height * device.faceplate.unitsU * 100 });
    assert.equal(art.filter((item) => item.kind === "circle" && item.r > 0).length, 2, "each stud has visible metal head and contact");
    assert.equal(art.filter((item) => item.kind === "line").length, 2);
  }
}
