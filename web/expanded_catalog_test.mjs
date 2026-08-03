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
  "USB_MICRO_CONSOLE", "USB_C_CONSOLE", "Stack",
]) assert.ok(types.has(type), `missing connector profile for ${type}`);

assert.equal(connectorKind("CFP2_100G"), "cfp");
assert.equal(connectorKind("OSFP_800G"), "osfp");
assert.equal(connectorKind("FIBER_LC"), "lc");
assert.equal(connectorKind("FIBER_SC"), "sc");
assert.equal(connectorKind("FIBER_MPO"), "mpo");
assert.equal(connectorKind("USB_MICRO_CONSOLE"), "usb-micro");
assert.equal(connectorKind("USB_C_CONSOLE"), "usb-c");
assert.equal(connectorKind("Stack"), "stack");
assert.deepEqual(connectorSize("CFP_100G"), { width: 30, height: 16 });
assert.deepEqual(connectorSize("OSFP_800G"), { width: 25, height: 16 });

const stackProfile = hardwareCatalog.find((profile) => profile.model === "Catalyst 9500 family");
const stackDevice = instantiateProfile(stackProfile, "CORE", { x: 0, y: 0 });
assert.equal(stackDevice.ports.filter((port) => port.type === "Stack").length, 2);
assert.deepEqual(stackDevice.ports.filter((port) => port.type === "Stack").map((port) => port.label), ["STACK1", "STACK2"]);
assert.ok(stackDevice.ports.filter((port) => port.type === "Stack").every((port) => port.mode === "Unconfigured"));
assert.ok(stackDevice.ports.some((port) => port.group === "MGMT"), "dedicated management port metadata is required");

const fiberPanelProfile = hardwareCatalog.find((profile) => profile.model === "LC fiber panel 24");
const fiberPanel = instantiateProfile(fiberPanelProfile, "FIBER A", { x: 0, y: 0 });
assert.ok(fiberPanel.ports.every((port) => port.type === "FIBER_LC" && port.mode === "Unconfigured" && port.nativeVlan === 0));

const coverage = faceplateResearchCoverage(hardwareCatalog);
assert.equal(coverage.fallback, 0, "every built-in family must resolve to a sourced chassis treatment");

assert.equal(registerProfiles([{
  vendor: "Lab", model: "Advanced connectors", category: "Switch", units: 1, color: "#123456",
  groups: [{ zone: "uplink", count: 1, type: "OSFP_800G", speed: 800000, poe: false, prefix: "OSFP" }],
}]), 1, "advanced connector types must be accepted by profile import");

console.log(`expanded catalog checks passed: ${hardwareCatalog.length} profiles, ${types.size} connector types`);
