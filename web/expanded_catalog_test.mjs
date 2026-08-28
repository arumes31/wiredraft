import assert from "node:assert/strict";

import { hardwareCatalog, instantiateProfile, registerProfiles } from "./static/js/catalog.js";
import { faceplateResearchCoverage } from "./static/js/faceplate.js";
import { connectorKind, connectorSize } from "./static/js/termination.js";

const names = new Set(hardwareCatalog.map((profile) => `${profile.vendor} ${profile.model}`));
const requiredFragments = [
  "Cisco Catalyst 9400", "Cisco Nexus 7000", "Cisco Meraki MS390", "Cisco ASA 5516-X",
  "Cisco Secure Firewall 9300", "Cisco ISR 4400", "HPE Aruba CX 10000", "HPE ProLiant DL380",
  "Dell PowerSwitch Z9332", "Dell PowerEdge R7625", "NETGEAR GS752T", "TP-Link Omada SG3452",
  "Arista 7800", "Juniper EX9200", "Juniper SRX5800", "Juniper QFX10000",
  "Ubiquiti UDM-Pro-Max", "MikroTik CCR2216", "MikroTik CRS518", "Palo Alto PA-7000",
  "Sophos XGS 4500", "Check Point Quantum 28000", "Extreme X870", "Ruckus ICX 8200",
  "APC Smart-UPS", "Generic Facility Rack PDU", "Generic KVM KVM-over-IP", "Opengear Console Manager",
  "Cisco Catalyst 9800-L", "Synology RackStation", "Generic Patch LC fiber panel 96",
  "Generic Patch Cat6a copper panel 48",
];
for (const fragment of requiredFragments) {
  assert.ok([...names].some((name) => name.includes(fragment)), `missing expanded catalog entry matching ${fragment}`);
}

assert.ok(hardwareCatalog.length >= 450, `expected broad catalog expansion, got ${hardwareCatalog.length}`);
assert.equal(new Set(hardwareCatalog.map((profile) => `${profile.vendor}\0${profile.model}`)).size, hardwareCatalog.length,
  "catalog vendor/model pairs must be unique");

const types = new Set(hardwareCatalog.flatMap((profile) => profile.groups.map((group) => group.type)));
for (const type of [
  "CFP_100G", "CFP2_100G", "CFP4_100G", "OSFP_800G", "FIBER_LC", "FIBER_SC", "FIBER_MPO",
  "USB_MINI_CONSOLE", "USB_MICRO_CONSOLE", "USB_C_CONSOLE", "Stack",
]) assert.ok(types.has(type), `missing connector profile for ${type}`);

assert.equal(connectorKind("CFP2_100G"), "cfp");
assert.equal(connectorKind("OSFP_800G"), "osfp");
assert.equal(connectorKind("FIBER_LC"), "lc");
assert.equal(connectorKind("FIBER_SC"), "sc");
assert.equal(connectorKind("FIBER_MPO"), "mpo");
assert.equal(connectorKind("USB_MINI_CONSOLE"), "usb-mini");
assert.equal(connectorKind("USB_MICRO_CONSOLE"), "usb-micro");
assert.equal(connectorKind("USB_C_CONSOLE"), "usb-c");
assert.equal(connectorKind("Stack"), "stack");
assert.deepEqual(connectorSize("CFP_100G"), { width: 30, height: 16 });
assert.deepEqual(connectorSize("OSFP_800G"), { width: 25, height: 16 });
assert.deepEqual(connectorSize("USB_MINI_CONSOLE"), { width: 14, height: 9 });

const stackProfile = hardwareCatalog.find((profile) => profile.model === "Catalyst 9500 family");
const stackDevice = instantiateProfile(stackProfile, "CORE", { x: 0, y: 0 });
assert.equal(stackDevice.ports.filter((port) => port.type === "Stack").length, 2);
assert.deepEqual(stackDevice.ports.filter((port) => port.type === "Stack").map((port) => port.label), ["STACK1", "STACK2"]);
assert.ok(stackDevice.ports.filter((port) => port.type === "Stack").every((port) => port.mode === "Unconfigured"));
assert.ok(stackDevice.ports.some((port) => port.group === "MGMT"), "dedicated management port metadata is required");

function catalogDevice(model) {
  const profile = hardwareCatalog.find((candidate) => candidate.model === model);
  assert.ok(profile, `missing catalog profile ${model}`);
  return { profile, device: instantiateProfile(profile, model, { x: 0, y: 0 }) };
}

for (const [model, portCount] of [
  ["GS108T", 8], ["GS110T", 10], ["GS724T", 26], ["GS748T", 52],
  ["SG2008P", 8], ["SG2210MP", 10], ["SG2428P", 28],
  ["SG3210", 12], ["SG3428", 30], ["SG3452", 54],
]) {
  const { profile, device } = catalogDevice(model);
  assert.equal(device.ports.length, portCount, `${model} connector inventory must match vendor documentation`);
  assert.equal(profile.portLayout.labelFidelity, "exact", `${model} labels must retain model-level evidence`);
  assert.equal(profile.portLayout.positionFidelity, "schematic", `${model} positions must not overstate the available evidence`);
  assert.equal(profile.portLayout.sourceScope, "model");
}
assert.equal(catalogDevice("SG2008P").device.ports.filter((port) => port.isPoe).length, 4);
assert.equal(catalogDevice("SG2210MP").device.ports.filter((port) => port.isPoe).length, 8);
assert.equal(catalogDevice("SG2428P").device.ports.filter((port) => port.isPoe).length, 24);
assert.deepEqual(catalogDevice("SG3428").device.ports.slice(-2).map((port) => port.type), ["Console", "USB_C_CONSOLE"]);
assert.deepEqual(catalogDevice("SG3452").device.ports.slice(-2).map((port) => port.type), ["Console", "USB_MICRO_CONSOLE"]);
assert.deepEqual(catalogDevice("GS748T").device.ports.slice(-4).map((port) => port.label), ["47F", "48F", "49", "50"]);

for (const [model, portCount] of [
  ["CCR1009", 11], ["CCR1016", 13], ["CCR1036", 17], ["CCR1072", 10],
  ["CCR2004", 16], ["CCR2116", 18], ["CCR2216", 16],
  ["CRS305", 5], ["CRS309", 9], ["CRS310", 10], ["CRS312", 17],
  ["CRS317", 18], ["CRS326", 27], ["CRS328", 29], ["CRS354", 56],
  ["CRS504", 6], ["CRS518", 20],
]) {
  const { profile, device } = catalogDevice(model);
  assert.equal(device.ports.length, portCount, `${model} representative connector count must match its cited chassis`);
  assert.equal(profile.portLayout.sourceScope, "family", `${model} shorthand must not claim exact-SKU evidence`);
}
for (const model of ["CRS354", "CRS518", "CRS354-48G-4S+2Q+RM", "CRS518-16XS-2XQ-RM"]) {
  const types = catalogDevice(model).device.ports.slice(-2).map((port) => port.type);
  assert.deepEqual(types, ["RJ45_1G", "Console"], `${model} must expose separate management and serial connectors`);
}
assert.equal(catalogDevice("CRS354-48G-4S+2Q+RM").device.ports.filter((port) => port.type === "QSFP_PLUS_40G").length, 2);
assert.equal(catalogDevice("CRS354-48G-4S+2Q+RM").device.ports.at(-2).speedMbps, 1000,
  "CRS354 management Ethernet must use its 1G catalog speed");

for (const [model, portCount] of [
  ["PA-220", 11], ["PA-440", 10], ["PA-450", 10], ["PA-460", 10],
  ["PA-850", 17], ["PA-440 / PA-450", 10],
]) {
  const { profile, device } = catalogDevice(model);
  assert.equal(device.ports.length, portCount, `${model} connector count must match its hardware reference`);
  assert.equal(profile.units, 1, `${model} must occupy a 1U faceplate`);
  assert.equal(profile.portLayout.labelFidelity, "exact");
  assert.equal(profile.portLayout.sourceScope, "model");
}
assert.deepEqual(catalogDevice("PA-440").device.ports.slice(-2).map((port) => [port.label, port.type]), [
  ["MGT", "RJ45_1G"], ["MICRO-USB", "USB_MICRO_CONSOLE"],
]);
assert.deepEqual(catalogDevice("PA-850").device.ports.slice(-5).map((port) => port.label),
  ["HA1", "HA2", "MGT", "CONSOLE", "MICRO-USB"]);

for (const [model, portCount] of [
  ["XGS 87", 7], ["XGS 107", 11], ["XGS 116", 11],
  ["XGS 126", 16], ["XGS 136", 16],
  ["XGS 2100", 13], ["XGS 2300", 13],
  ["XGS 3100", 15], ["XGS 3300", 15],
  ["XGS 4300", 15], ["XGS 4500", 15],
  ["XGS 2100 / 2300", 13],
]) {
  const { profile, device } = catalogDevice(model);
  assert.equal(device.ports.length, portCount, `${model} connector count must match its operating instructions`);
  assert.equal(profile.units, 1, `${model} must occupy a 1U faceplate`);
  assert.equal(profile.portLayout.labelFidelity, "exact");
  assert.equal(profile.portLayout.sourceScope, "model");
  assert.equal(profile.portLayout.positionFidelity, "schematic");
}
assert.equal(catalogDevice("XGS 116").device.ports.filter((port) => port.isPoe).length, 1);
assert.equal(catalogDevice("XGS 126").device.ports.filter((port) => port.isPoe).length, 2);
assert.equal(catalogDevice("XGS 136").device.ports.filter((port) => port.speedMbps === 2500 && port.isPoe).length, 2);
assert.deepEqual(catalogDevice("XGS 2100").device.ports.slice(8, 10).map((port) => [port.label, port.type]), [
  ["F1", "SFP_1G"], ["F2", "SFP_1G"],
]);
assert.deepEqual(catalogDevice("XGS 3100").device.ports.slice(8, 12).map((port) => [port.label, port.type]), [
  ["F1", "SFP_PLUS_10G"], ["F2", "SFP_PLUS_10G"],
  ["F3", "SFP_1G"], ["F4", "SFP_1G"],
]);
assert.deepEqual(catalogDevice("XGS 4300").device.ports.slice(-3).map((port) => [port.label, port.type]), [
  ["MGMT", "RJ45_1G"], ["COM", "Console"], ["MICRO-USB", "USB_MICRO_CONSOLE"],
]);

for (const [model, portCount, units] of [
  ["Quantum 1600", 22, 1], ["Quantum 1800", 27, 1],
  ["Quantum 3600", 8, 1], ["Quantum 3800", 8, 1],
  ["Quantum 6200", 12, 1], ["Quantum 6400", 12, 1],
  ["Quantum 6600", 12, 1], ["Quantum 6700", 12, 1],
  ["Quantum 6900", 12, 1], ["Quantum 7000", 12, 1],
  ["Quantum 16000", 12, 2], ["Quantum 26000", 12, 2],
  ["Quantum 28000", 8, 2],
]) {
  const { profile, device } = catalogDevice(model);
  assert.equal(device.ports.length, portCount, `${model} base connector count must match its datasheet`);
  assert.equal(profile.units, units, `${model} rack height must match its chassis`);
  assert.equal(profile.portLayout.labelFidelity, "exact");
  assert.equal(profile.portLayout.sourceScope, "model");
  assert.equal(profile.portLayout.positionFidelity, "schematic");
}
assert.equal(catalogDevice("Quantum 1500").profile.portLayout.sourceScope, "family");
assert.equal(catalogDevice("Quantum 1500").device.ports.length, 12);
assert.deepEqual(catalogDevice("Quantum 3600").device.ports.slice(-3).map((port) => [port.label, port.type]), [
  ["MGMT", "RJ45_1G"], ["CONSOLE", "Console"], ["USB-C", "USB_C_CONSOLE"],
]);
assert.deepEqual(catalogDevice("Quantum 6200").device.ports.slice(-4).map((port) => port.label),
  ["MGMT", "SYNC", "CONSOLE", "USB-C"]);
assert.ok(catalogDevice("Quantum 6200").device.ports.slice(-4).every((port) => port.faceplateX >= .22 && port.faceplateX <= .31),
  "dense management clusters must stay clear of the product identity and data-port regions");
assert.equal(catalogDevice("Quantum 28000").device.ports.filter((port) => port.type === "SFP_PLUS_10G").length, 4);

for (const [model, portCount] of [
  ["SRX300", 10], ["SRX320", 10], ["SRX340", 19], ["SRX345", 19],
  ["SRX380", 23], ["SRX1500", 24], ["SRX4100", 12], ["SRX4200", 12], ["SRX4600", 20],
]) {
  const { profile, device } = catalogDevice(model);
  assert.equal(device.ports.length, portCount, `${model} fixed connector count must match its hardware guide`);
  assert.equal(profile.units, 1);
  assert.equal(profile.portLayout.labelFidelity, "exact");
  assert.equal(profile.portLayout.sourceScope, "model");
  assert.equal(profile.portLayout.positionFidelity, "schematic");
}
assert.equal(catalogDevice("SRX380").device.ports.filter((port) => port.isPoe).length, 16);
assert.deepEqual(catalogDevice("SRX1500").device.ports.slice(-4).map((port) => port.label),
  ["HA", "MGMT", "CONSOLE", "MINI-USB"]);
assert.equal(catalogDevice("SRX4600").device.ports.filter((port) => port.type === "QSFP28_100G").length, 4);
for (const [model, units] of [["SRX5400", 5], ["SRX5600", 8], ["SRX5800", 16]]) {
  const { profile, device } = catalogDevice(model);
  assert.equal(profile.units, units);
  assert.equal(profile.portLayout.sourceScope, "modular");
  assert.equal(profile.portLayout.labelFidelity, "modular");
  assert.equal(device.ports.length, 3, `${model} must not invent connectors for unselected line cards`);
}

const fiberPanelProfile = hardwareCatalog.find((profile) => profile.model === "LC fiber panel 24");
const fiberPanel = instantiateProfile(fiberPanelProfile, "FIBER A", { x: 0, y: 0 });
assert.ok(fiberPanel.ports.every((port) => port.type === "FIBER_LC" && port.mode === "Unconfigured" && port.nativeVlan === 0));

const coverage = faceplateResearchCoverage(hardwareCatalog);
assert.equal(coverage.fallback, 0, "every built-in family must resolve to a sourced chassis treatment");

assert.equal(registerProfiles([{
  vendor: "Lab", model: "Advanced connectors", category: "Switch", units: 1, color: "#123456",
  groups: [
    { zone: "uplink", count: 1, type: "OSFP_800G", speed: 800000, poe: false, prefix: "OSFP" },
    { zone: "management", count: 1, type: "USB_MINI_CONSOLE", speed: 0, poe: false, prefix: "CONSOLE" },
  ],
}]), 1, "advanced connector types must be accepted by profile import");

assert.equal(registerProfiles([{
  vendor: "Lab", model: "Positioned ports", category: "Switch", units: 1, color: "#123456", fidelity: "exact",
  groups: [{
    zone: "access", count: 2, type: "RJ45_1G", speed: 1000, poe: false, prefix: "",
    labels: ["1", "2"], positions: [{ x: .4, y: .4 }, { x: .4, y: .7 }],
  }],
}]), 1, "profile imports must accept validated normalized faceplate positions");
assert.throws(() => registerProfiles([{
  vendor: "Lab", model: "Invalid positions", category: "Switch", units: 1, color: "#123456",
  groups: [{
    zone: "access", count: 2, type: "RJ45_1G", speed: 1000, poe: false, prefix: "",
    positions: [{ x: .4, y: .4 }],
  }],
}]), /Invalid hardware profile/, "position arrays must cover every connector in their group");

console.log(`expanded catalog checks passed: ${hardwareCatalog.length} profiles, ${types.size} connector types`);
