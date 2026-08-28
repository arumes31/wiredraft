import assert from "node:assert/strict";

import { cableBezier } from "./static/js/cabling.js";
import { hardwareCatalog, instantiateProfile, upgradeInstalledPhysicalPorts } from "./static/js/catalog.js";
import { buildSVGDocument } from "./static/js/export.js";
import { faceplateResearchCoverage, resolveFaceplateTemplate } from "./static/js/faceplate.js";
import { connectorKind, connectorSize, endpointRouteSegment, faceplateConnectorSize, portLinkLEDColor } from "./static/js/termination.js";

assert.equal(connectorKind("RJ45_1G"), "rj45");
assert.equal(connectorKind("DSL_RJ11"), "dsl");
assert.equal(connectorKind("SFP_PLUS_10G"), "sfp");
assert.equal(connectorKind("QSFP_DD_400G"), "qsfp");
assert.deepEqual(connectorSize("QSFP28_100G"), { width: 21, height: 15 });
const denseConnector = faceplateConnectorSize({ type: "RJ45_1G", group: "PORT" }, {
  ports: Array.from({ length: 48 }, () => ({ group: "PORT" })),
});
assert.ok(Math.abs(denseConnector.width - 14.04) < Number.EPSILON * 10);
assert.ok(Math.abs(denseConnector.height - 10.92) < Number.EPSILON * 10);
assert.equal(portLinkLEDColor("up"), "#42d98b", "an up link LED must remain solid green");
assert.equal(portLinkLEDColor("down"), "#2d393b", "a down link LED must remain inactive");

const curve = cableBezier({ x: 100, y: 100 }, { x: 500, y: 400 });
const sourceSegment = endpointRouteSegment(curve, "source", { x: 50, y: 50, width: 100, height: 100 });
const targetSegment = endpointRouteSegment(curve, "target", { x: 450, y: 350, width: 100, height: 100 });
assert.deepEqual(sourceSegment.source, curve.source, "source overlay must begin at the real source port");
assert.deepEqual(targetSegment.target, curve.target, "target overlay must end at the real target port");
assert.ok(sourceSegment.target.x > 156, "source overlay should join the cable beyond the device edge");
assert.ok(targetSegment.source.x < 444, "target overlay should join the cable beyond the device edge");

const coverage = faceplateResearchCoverage(hardwareCatalog);
assert.equal(coverage.total, hardwareCatalog.length);
assert.equal(coverage.sourced, hardwareCatalog.length);
assert.equal(coverage.fallback, 0);
assert.ok(coverage.templates.size >= 18, `expected broad chassis coverage, got ${coverage.templates.size} templates`);
assert.equal(Object.values(coverage.labels).reduce((sum, count) => sum + count, 0), hardwareCatalog.length);
assert.equal(Object.values(coverage.positions).reduce((sum, count) => sum + count, 0), hardwareCatalog.length);
assert.ok(coverage.positions.exact >= 1, "at least one catalog profile must carry exact physical coordinates");
assert.ok(coverage.positions.schematic > coverage.positions.exact,
  "catalog audit must expose the current schematic-layout backlog instead of presenting it as exact");

function resolved(vendor, model, category = "Switch", unitsU = 1) {
  return resolveFaceplateTemplate({ model, category, faceplate: { vendor, unitsU } });
}

assert.equal(resolved("Fortinet", "FortiGate 40F", "Firewall").id, "fortinet-desktop");
assert.equal(resolved("Fortinet", "FortiGate 40F", "Firewall").statusArea.compact, true);
assert.equal(resolved("Fortinet", "FortiGate 100F", "Firewall").statusArea.compact, true);
assert.equal(resolved("Fortinet", "FortiGate 400F", "Firewall").statusArea.compact, true);
assert.equal(resolved("Fortinet", "FortiGate Rugged 70G", "Firewall").id, "fortinet-rugged");
assert.equal(resolved("Fortinet", "FortiSwitch 108F").id, "fortinet-compact-switch");
assert.equal(resolved("Fortinet", "FortiSwitch Rugged 216F-POE").id, "fortinet-rugged-switch");
assert.equal(resolved("Fortinet", "FortiSwitch 124F").id, "fortinet-switch");
assert.equal(resolved("Fortinet", "FortiSwitch 424E").id, "fortinet-campus-switch");
assert.equal(resolved("Fortinet", "FortiSwitch 524D").id, "fortinet-campus-switch");
assert.equal(resolved("Fortinet", "FortiSwitch 648F").id, "fortinet-dense-core-switch");
assert.equal(resolved("Fortinet", "FortiSwitch 2048F").statusArea.compact, true);
assert.equal(resolved("Fortinet", "FortiSwitch 1024E").statusArea.x, .905);
assert.equal(resolved("Fortinet", "FortiGate 6000F", "Firewall", 3).id, "fortinet-modular");
assert.equal(resolved("Cisco", "Nexus 93180YC-FX3").id, "cisco-datacenter");
assert.equal(resolved("Ubiquiti", "UniFi Pro Max 24 PoE").control, "lcm");
assert.equal(resolved("Unknown", "Imported Model").id, "generic-switch");
assert.deepEqual(resolved("HPE Aruba", "CX 6300M 48G").statusArea, {
  kind: "status-stack", x: .214, y: .5, known: true, width: 38, height: 40,
});
assert.equal(resolved("Unknown", "Imported Model").statusArea.known, false);
assert.ok(hardwareCatalog.every((profile) => {
  const area = resolved(profile.vendor, profile.model, profile.category, profile.units).statusArea;
  return area && area.x > 0 && area.x < .96 && area.y > 0 && area.y < 1;
}), "every faceplate template needs an explicit in-chassis status/control area");

function instantiatedLabels(vendor, model) {
  const profile = hardwareCatalog.find((candidate) => candidate.vendor === vendor && candidate.model === model);
  assert.ok(profile, `missing profile ${vendor} ${model}`);
  return instantiateProfile(profile, model, { x: 0, y: 0 }).ports.map((port) => port.label);
}

assert.deepEqual(instantiatedLabels("Fortinet", "FortiGate 40F"), ["WAN", "A", "1", "2", "3", "CONSOLE"]);
assert.deepEqual(instantiatedLabels("Fortinet", "FortiGate 60F").slice(0, 10), ["1", "2", "3", "4", "5", "A", "B", "DMZ", "WAN1", "WAN2"]);
assert.deepEqual(instantiatedLabels("Fortinet", "FortiGate 70G").slice(0, 10), ["1", "2", "3", "4", "5", "6", "A", "B", "WAN1", "WAN2"]);
assert.deepEqual(instantiatedLabels("Fortinet", "FortiGate 100F").slice(0, 6), ["DMZ", "MGMT", "WAN1", "WAN2", "HA1", "HA2"]);
assert.ok(instantiatedLabels("Fortinet", "FortiGate 200F").includes("X4"));
assert.ok(instantiatedLabels("Fortinet", "FortiGate 6000F").includes("MGMT3"));
assert.deepEqual(instantiatedLabels("Palo Alto", "PA-440 / PA-450").slice(0, 2), ["ethernet1/1", "ethernet1/2"]);
assert.equal(instantiatedLabels("Cisco", "Catalyst C9200L-24P-4X").at(-1), "CONSOLE");
assert.ok(hardwareCatalog.every((profile) => profile.portLayout?.source && profile.portLayout?.fidelity));
assert.ok(hardwareCatalog.every((profile) => profile.portLayout?.labelFidelity && profile.portLayout?.positionFidelity && profile.portLayout?.sourceScope));
for (const model of ["FortiGate 2200E", "FortiGate 2600F", "FortiGate 3200F", "FortiGate 4200F", "FortiGate 7081F"]) {
  const profile = hardwareCatalog.find((candidate) => candidate.model === model);
  assert.notEqual(profile.portLayout.labelFidelity, "exact", `${model} must not inherit evidence from a numeric substring`);
}

const fortiSwitch1024EProfile = hardwareCatalog.find((profile) => profile.model === "FortiSwitch 1024E");
const fortiSwitch1024E = instantiateProfile(fortiSwitch1024EProfile, "CORE 1024E", { x: 0, y: 0 });
const fortiSwitch1024EDataPorts = fortiSwitch1024E.ports.filter((port) => /^\d+$/.test(port.label));
const fortiSwitch1024ESFPPorts = fortiSwitch1024EDataPorts.slice(0, 24);
const fortiSwitch1024EMgmtPort = fortiSwitch1024E.ports.find((port) => port.label === "MGMT");
const fortiSwitch1024EConsolePort = fortiSwitch1024E.ports.find((port) => port.label === "CONSOLE");
assert.equal(fortiSwitch1024EProfile.portLayout.fidelity, "exact");
assert.match(fortiSwitch1024EProfile.portLayout.source, /fortiswitch-t1024e-1024e-quickstart-guide/);
assert.deepEqual(fortiSwitch1024EDataPorts.map((port) => port.label),
  Array.from({ length: 26 }, (_, index) => String(index + 1)));
assert.equal(new Set(fortiSwitch1024ESFPPorts.map((port) => port.faceplateX)).size, 12);
assert.deepEqual([...new Set(fortiSwitch1024ESFPPorts.map((port) => port.faceplateY))], [.4, .7]);
const fortiSwitch1024EColumns = [...new Set(fortiSwitch1024ESFPPorts.map((port) => port.faceplateX))].sort((a, b) => a - b);
assert.ok(fortiSwitch1024EColumns.every((x, index) => index === 0 || (x - fortiSwitch1024EColumns[index - 1]) * 690 > 17),
  "1024E SFP+ cages must not overlap at the 690px faceplate width");
assert.deepEqual(fortiSwitch1024EDataPorts.slice(24).map((port) => [port.faceplateX, port.faceplateY]), [[.78, .4], [.78, .7]]);
assert.equal(fortiSwitch1024EMgmtPort.faceplateX, .84);
assert.equal(fortiSwitch1024EMgmtPort.faceplateY, .55);
assert.equal(fortiSwitch1024EConsolePort.faceplateX, .235);
assert.equal(fortiSwitch1024EConsolePort.faceplateY, .7);

for (const model of [
  "FortiGate 40F", "FortiGate 40F-3G4G",
  "FortiGate 60F", "FortiGate 61F",
  "FortiGate 70F", "FortiGate 71F",
  "FortiGate 70G", "FortiGate 70G-POE", "FortiGate 71G", "FortiGate 71G-POE",
  "FortiGate 80F", "FortiGate 80F-Bypass", "FortiGate 80F-POE", "FortiGate 81F", "FortiGate 81F-POE",
  "FortiGate 100F", "FortiGate 101F",
  "FortiGate 200E", "FortiGate 201E", "FortiGate 200F", "FortiGate 201F",
  "FortiGate 400F", "FortiGate 400F-DC", "FortiGate 401F", "FortiGate 401F-DC",
  "FortiGate 600F", "FortiGate 601F",
]) {
  const profile = hardwareCatalog.find((candidate) => candidate.model === model);
  const device = instantiateProfile(profile, model, { x: 0, y: 0 });
  assert.equal(profile.portLayout.positionFidelity, "exact", `${model} must use its QSG connector-face layout`);
  assert.match(profile.portLayout.source, /QSG|QuickStart/i, `${model} exact geometry must cite a quick-start guide`);
  assert.ok(device.ports.every((port) => Number.isFinite(port.faceplateX) && Number.isFinite(port.faceplateY)),
    `${model} must position every connector`);
  assert.ok(device.ports.every((port) => port.faceplateX >= .02 && port.faceplateX <= .98 && port.faceplateY >= .08 && port.faceplateY <= .92),
    `${model} connectors must remain inside the faceplate`);
}

for (const model of [
  "FortiSwitch 124E", "FortiSwitch 124E-POE", "FortiSwitch 124E-FPOE",
  "FortiSwitch 124F", "FortiSwitch 124F-POE", "FortiSwitch 124F-FPOE",
  "FortiSwitch 148E", "FortiSwitch 148E-POE",
  "FortiSwitch 148F", "FortiSwitch 148F-POE", "FortiSwitch 148F-FPOE",
]) {
  const profile = hardwareCatalog.find((candidate) => candidate.model === model);
  const device = instantiateProfile(profile, model, { x: 0, y: 0 });
  const dataPorts = device.ports.filter((port) => /^\d+$/.test(port.label));
  const accessCount = model.includes("148") ? 48 : 24;
  const accessPorts = dataPorts.slice(0, accessCount);
  const uplinkPorts = dataPorts.slice(accessCount);
  assert.equal(profile.portLayout.positionFidelity, "exact", `${model} must use its QSG layout`);
  assert.equal(new Set(accessPorts.map((port) => port.faceplateX)).size, accessCount / 2);
  assert.deepEqual([...new Set(accessPorts.map((port) => port.faceplateY))], [.4, .7]);
  assert.equal(new Set(uplinkPorts.map((port) => port.faceplateX)).size, 2);
  assert.deepEqual([...new Set(uplinkPorts.map((port) => port.faceplateY))], [.4, .7]);
  const columns = [...new Set(accessPorts.map((port) => port.faceplateX))].sort((a, b) => a - b);
  const connector = faceplateConnectorSize(accessPorts[0], device);
  assert.ok(columns.every((x, index) => index === 0 || (x - columns[index - 1]) * 690 >= connector.width),
    `${model} access connectors must not overlap`);
}

for (const model of [
  "FortiSwitch 108F", "FortiSwitch 108F-POE", "FortiSwitch 108F-FPOE",
  "FortiSwitch 110G-FPOE",
  "FortiSwitch 124G", "FortiSwitch 124G-FPOE",
  "FortiSwitch 224D-FPOE", "FortiSwitch 224E", "FortiSwitch 224E-POE",
  "FortiSwitch 248D", "FortiSwitch 248E-POE", "FortiSwitch 248E-FPOE",
  "FortiSwitch M426E-FPOE",
  "FortiSwitch 524D", "FortiSwitch 524D-FPOE", "FortiSwitch 548D", "FortiSwitch 548D-FPOE",
  "FortiSwitch 348G", "FortiSwitch 348G-FPOE", "FortiSwitch 1048G",
  "FortiSwitch 424E", "FortiSwitch 424E-POE", "FortiSwitch 424E-FPOE", "FortiSwitch 424E-Fiber",
  "FortiSwitch 448E", "FortiSwitch 448E-POE", "FortiSwitch 448E-FPOE",
  "FortiSwitch T1024E", "FortiSwitch T1024F-FPOE",
  "FortiSwitch 1048E", "FortiSwitch 2048F", "FortiSwitch 3032E", "FortiSwitch 3032G",
  "FortiSwitch 624F", "FortiSwitch 624F-FPOE",
  "FortiSwitch 648F", "FortiSwitch 648F-FPOE",
  "FortiSwitch Rugged 108F", "FortiSwitch Rugged 112F-POE",
  "FortiSwitch Rugged 216F-POE", "FortiSwitch Rugged 424F-POE",
]) {
  const profile = hardwareCatalog.find((candidate) => candidate.model === model);
  const device = instantiateProfile(profile, model, { x: 0, y: 0 });
  assert.equal(profile.portLayout.positionFidelity, "exact", `${model} must use its QSG layout`);
  assert.ok(device.ports.every((port) => port.faceplateX >= .02 && port.faceplateX <= .98 && port.faceplateY >= .08 && port.faceplateY <= .92));
}

const m426E = instantiateProfile(
  hardwareCatalog.find((profile) => profile.model === "FortiSwitch M426E-FPOE"),
  "FortiSwitch M426E-FPOE", { x: 0, y: 0 },
);
assert.equal(m426E.ports.filter((port) => port.isPoe).length, 24);
assert.deepEqual(m426E.ports.slice(24, 26).map((port) => [port.type, port.speedMbps, port.isPoe]),
  Array.from({ length: 2 }, () => ["RJ45_MGIG", 5000, false]));
assert.ok(m426E.ports.some((port) => port.label === "MGMT" && port.type === "RJ45_1G"));
assert.ok(!m426E.ports.some((port) => port.type === "Console"),
  "M426E console is on the QSG rear panel");

for (const [model, poeCount, dataPortCount] of [
  ["FortiSwitch 524D", 0, 30], ["FortiSwitch 524D-FPOE", 24, 30],
  ["FortiSwitch 548D", 0, 54], ["FortiSwitch 548D-FPOE", 48, 54],
]) {
  const profile = hardwareCatalog.find((candidate) => candidate.model === model);
  const device = instantiateProfile(profile, model, { x: 0, y: 0 });
  assert.equal(device.ports.filter((port) => port.isPoe).length, poeCount, `${model} PoE bank must match its QSG`);
  assert.equal(device.ports.filter((port) => /^\d+$/.test(port.label)).length, dataPortCount);
  assert.ok(device.ports.some((port) => port.label === "MGMT" && port.type === "RJ45_1G"));
  assert.ok(device.ports.some((port) => port.label === "CONSOLE" && port.type === "USB_MICRO_CONSOLE"));
}

for (const [model, poeCount] of [["FortiSwitch 348G", 0], ["FortiSwitch 348G-FPOE", 48]]) {
  const profile = hardwareCatalog.find((candidate) => candidate.model === model);
  const device = instantiateProfile(profile, model, { x: 0, y: 0 });
  assert.equal(device.ports.filter((port) => /^\d+$/.test(port.label)).length, 52);
  assert.equal(device.ports.filter((port) => port.isPoe).length, poeCount);
  assert.ok(device.ports.some((port) => port.label === "MGMT"));
  assert.ok(device.ports.some((port) => port.label === "CONSOLE"));
}

const fortiSwitch1048G = instantiateProfile(
  hardwareCatalog.find((profile) => profile.model === "FortiSwitch 1048G"),
  "FortiSwitch 1048G", { x: 0, y: 0 },
);
assert.equal(fortiSwitch1048G.ports.filter((port) => /^\d+$/.test(port.label)).length, 54);
assert.ok(fortiSwitch1048G.ports.some((port) => port.label === "MGMT"));
assert.ok(fortiSwitch1048G.ports.some((port) => port.label === "CONSOLE"));

for (const [model, dataPortCount] of [
  ["FortiSwitch 1048E", 54], ["FortiSwitch 2048F", 58], ["FortiSwitch 3032E", 32], ["FortiSwitch 3032G", 34],
]) {
  const profile = hardwareCatalog.find((candidate) => candidate.model === model);
  const device = instantiateProfile(profile, model, { x: 0, y: 0 });
  assert.equal(device.ports.filter((port) => /^\d+$/.test(port.label)).length, dataPortCount, `${model} data-port inventory must match its QSG`);
  assert.ok(device.ports.some((port) => port.label === "MGMT"));
  assert.ok(device.ports.some((port) => port.label === "CONSOLE"));
}
assert.deepEqual(
  instantiatedLabels("Fortinet", "FortiSwitch 2048F").filter((label) => /^\d+$/.test(label)).slice(48),
  ["49", "50", "51", "52", "53", "54", "55", "56", "57", "58"],
  "2048F must include its QSG-documented SFP+ ports 57 and 58",
);

for (const [model, dataPortCount] of [
  ["FortiSwitch Rugged 108F", 8], ["FortiSwitch Rugged 112F-POE", 12],
  ["FortiSwitch Rugged 216F-POE", 20], ["FortiSwitch Rugged 424F-POE", 30],
]) {
  const profile = hardwareCatalog.find((candidate) => candidate.model === model);
  const device = instantiateProfile(profile, model, { x: 0, y: 0 });
  assert.equal(device.ports.filter((port) => /^\d+$/.test(port.label)).length, dataPortCount);
  assert.ok(device.ports.some((port) => port.label === "MGMT" && port.type === "RJ45_1G"));
}
const rugged424F = instantiateProfile(
  hardwareCatalog.find((profile) => profile.model === "FortiSwitch Rugged 424F-POE"),
  "FortiSwitch Rugged 424F-POE", { x: 0, y: 0 },
);
assert.deepEqual(rugged424F.ports.slice(0, 12).map((port) => [port.type, port.speedMbps, port.isPoe]),
  Array.from({ length: 12 }, () => ["RJ45_MGIG", 2500, true]));
assert.deepEqual(rugged424F.ports.slice(12, 24).map((port) => [port.type, port.speedMbps]),
  Array.from({ length: 12 }, () => ["SFP_PLUS_10G", 2500]));
assert.ok(!rugged424F.ports.some((port) => port.type === "Console"),
  "424F console is not on the QSG front panel");

for (const [model, poeCount] of [
  ["FortiSwitch 224D-FPOE", 24], ["FortiSwitch 224E", 0], ["FortiSwitch 224E-POE", 12],
  ["FortiSwitch 248D", 0], ["FortiSwitch 248E-POE", 24], ["FortiSwitch 248E-FPOE", 48],
]) {
  const profile = hardwareCatalog.find((candidate) => candidate.model === model);
  const device = instantiateProfile(profile, model, { x: 0, y: 0 });
  assert.equal(device.ports.filter((port) => port.isPoe).length, poeCount, `${model} PoE bank must match its QSG`);
  assert.ok(device.ports.some((port) => port.label === "MGMT" && port.type === "RJ45_1G"));
  assert.ok(!device.ports.some((port) => port.type === "Console"), `${model} rear console must stay off the faceplate`);
}

const fortiSwitch108F = instantiateProfile(
  hardwareCatalog.find((profile) => profile.model === "FortiSwitch 108F"),
  "FortiSwitch 108F", { x: 0, y: 0 },
);
assert.equal(fortiSwitch108F.ports.length, 10);
assert.ok(fortiSwitch108F.ports.every((port) => port.faceplateY === .55));
assert.ok(!fortiSwitch108F.ports.some((port) => port.type === "Console"), "108F rear console must not appear on the front faceplate");
for (const model of ["FortiSwitch 108F-POE", "FortiSwitch 108F-FPOE"]) {
  const profile = hardwareCatalog.find((candidate) => candidate.model === model);
  const device = instantiateProfile(profile, model, { x: 0, y: 0 });
  assert.equal(device.ports.find((port) => port.label === "CONSOLE").faceplateX, .18);
}

for (const model of [
  "FortiSwitch 424E", "FortiSwitch 424E-POE", "FortiSwitch 424E-FPOE", "FortiSwitch 424E-Fiber",
  "FortiSwitch 448E", "FortiSwitch 448E-POE", "FortiSwitch 448E-FPOE",
]) {
  const profile = hardwareCatalog.find((candidate) => candidate.model === model);
  const device = instantiateProfile(profile, model, { x: 0, y: 0 });
  assert.ok(device.ports.some((port) => port.label === "MGMT" && port.type === "RJ45_1G"), `${model} must expose its front management port`);
  assert.ok(!device.ports.some((port) => port.type === "Console"), `${model} rear console must not appear on the front faceplate`);
}

const fortiSwitch110G = instantiateProfile(
  hardwareCatalog.find((profile) => profile.model === "FortiSwitch 110G-FPOE"),
  "FortiSwitch 110G-FPOE", { x: 0, y: 0 },
);
assert.deepEqual([...new Set(fortiSwitch110G.ports.slice(0, 8).map((port) => port.faceplateY))], [.4, .7]);
assert.deepEqual(fortiSwitch110G.ports.slice(8, 10).map((port) => port.faceplateX), [.755, .755]);
assert.equal(fortiSwitch110G.ports.find((port) => port.label === "CONSOLE").faceplateX, .39);

for (const model of ["FortiSwitch 624F", "FortiSwitch 624F-FPOE", "FortiSwitch 648F", "FortiSwitch 648F-FPOE"]) {
  const profile = hardwareCatalog.find((candidate) => candidate.model === model);
  const device = instantiateProfile(profile, model, { x: 0, y: 0 });
  assert.ok(device.ports.some((port) => port.label === "MGMT"), `${model} must include the QSG management jack`);
  assert.ok(device.ports.some((port) => port.label === "CONSOLE"), `${model} must include the QSG console jack`);
}

const legacyFortiSwitch1024E = structuredClone(fortiSwitch1024E);
legacyFortiSwitch1024E.id = "device-1024e";
legacyFortiSwitch1024E.ports.forEach((port, index) => {
  port.id = `existing-1024e-${index}`;
  port.deviceId = legacyFortiSwitch1024E.id;
  port.faceplateX = .83 + index * .001;
  port.faceplateY = index % 2 ? .7 : .4;
});
const fortiSwitchPortIDs = legacyFortiSwitch1024E.ports.map((port) => port.id);
assert.equal(upgradeInstalledPhysicalPorts({ devices: [legacyFortiSwitch1024E], linkGroups: [] }), true);
assert.deepEqual(legacyFortiSwitch1024E.ports.map((port) => port.id), fortiSwitchPortIDs);
assert.deepEqual(legacyFortiSwitch1024E.ports.map((port) => [port.faceplateX, port.faceplateY]),
  fortiSwitch1024E.ports.map((port) => [port.faceplateX, port.faceplateY]));

const fortiSwitch424EProfile = hardwareCatalog.find((profile) => profile.model === "FortiSwitch 424E");
const legacyFortiSwitch424E = instantiateProfile(fortiSwitch424EProfile, "OLD 424E", { x: 0, y: 0 });
const legacyFortiSwitch424EManagement = legacyFortiSwitch424E.ports.at(-1);
legacyFortiSwitch424EManagement.type = "Console";
legacyFortiSwitch424EManagement.speed = 0;
legacyFortiSwitch424EManagement.group = "CONSOLE";
legacyFortiSwitch424EManagement.label = "CONSOLE";
assert.equal(upgradeInstalledPhysicalPorts({ devices: [legacyFortiSwitch424E], linkGroups: [] }), true);
assert.equal(legacyFortiSwitch424EManagement.type, "RJ45_1G");
assert.equal(legacyFortiSwitch424EManagement.label, "MGMT");
assert.equal(legacyFortiSwitch424EManagement.faceplateX, .055);

const legacy80FProfile = hardwareCatalog.find((profile) => profile.model === "FortiGate 80F");
const legacy80F = instantiateProfile(legacy80FProfile, "OLD 80F", { x: 0, y: 0 });
legacy80F.id = "device-80f";
legacy80F.ports = legacy80F.ports.filter((port) => !["WAN1", "WAN2"].includes(port.label));
legacy80F.ports.forEach((port, index) => {
  port.id = `existing-${index}`;
  port.deviceId = legacy80F.id;
  port.label = port.type === "Console" ? "CONSOLE1" : port.type === "SFP_1G" ? `SHARED${index - 7}` : `PORT${index + 1}`;
});
const existingIDs = new Set(legacy80F.ports.map((port) => port.id));
const legacyTopology = { devices: [legacy80F], linkGroups: [] };
assert.equal(upgradeInstalledPhysicalPorts(legacyTopology), true);
assert.equal(legacy80F.ports.length, 13);
assert.ok(["WAN1", "WAN2", "SFP1", "SFP2"].every((label) => legacy80F.ports.some((port) => port.label === label)));
assert.ok([...existingIDs].every((id) => legacy80F.ports.some((port) => port.id === id)), "migration must retain existing cable endpoint ids");

const sourceDevice = {
  id: "device-a", name: "SOURCE", model: "FortiGate 40F", category: "Firewall",
  faceplate: { vendor: "Fortinet", vendorColor: "#e64135", unitsU: 1 },
  ports: [{ id: "port-a", type: "RJ45_1G" }],
};
const targetDevice = {
  id: "device-b", name: "TARGET", model: "Catalyst C9200L-24P-4X", category: "Switch",
  faceplate: { vendor: "Cisco", vendorColor: "#263b4b", unitsU: 1 },
  ports: [{ id: "port-b", type: "SFP_PLUS_10G" }],
};
const topology = {
  name: "Layer test", racks: [], devices: [sourceDevice, targetDevice],
  vlans: [{ id: 1, colorHex: "#42d9c8" }],
  links: [{ id: "link-a", sourcePortId: "port-a", targetPortId: "port-b", primaryVlan: 1 }],
};
const engine = {
  worldBounds: () => ({ x: 0, y: 0, width: 1200, height: 500 }),
  portCenters: () => new Map([["port-a", { x: 300, y: 100 }], ["port-b", { x: 800, y: 350 }]]),
  rackRectangles: () => [],
  deviceRectangles: () => [
    { device: sourceDevice, x: 0, y: 50, width: 690, height: 100 },
    { device: targetDevice, x: 510, y: 300, width: 690, height: 100 },
  ],
};
const svg = buildSVGDocument(topology, engine);
const cableIndex = svg.indexOf('data-layer="cable"');
const faceplateIndex = svg.indexOf('data-layer="faceplate"');
const portDescriptionIndex = svg.indexOf('data-layer="port-description"');
assert.ok(faceplateIndex >= 0 && faceplateIndex < cableIndex, "the complete cable must render above device chassis");
assert.ok(cableIndex < portDescriptionIndex, "physical port names must render above cables");
assert.equal(svg.includes('data-layer="cable-termination"'), false, "the cable must not use a duplicated endpoint overlay");
assert.equal(svg.includes('data-layer="cable-plug"'), false, "the cable itself should enter the port without a separate plug graphic");
assert.match(svg.slice(cableIndex), /d="M[^\"]+ [HV][^\"]+"/, "the foreground cable must preserve the complete orthogonal route");
assert.doesNotMatch(svg.slice(cableIndex), /d="M[^\"]+ C[^\"]+"/, "cable exports must not contain Bézier segments");
assert.match(svg, /class="name"[^>]+fill="#202426"[^>]*>SOURCE<\/text>/, "light faceplate labels need dark ink");
assert.match(svg, /width="18" height="14" rx="2"/, "RJ45 SVG geometry should match the canvas connector size");
assert.match(svg, /width="17" height="12" rx="2"/, "SFP SVG geometry should match the canvas connector size");
assert.match(svg, /data-layer="status-area"/, "SVG status indicators should use faceplate status-area geometry");

console.log(`faceplate checks passed: ${coverage.sourced} sourced profiles across ${coverage.templates.size} templates`);
