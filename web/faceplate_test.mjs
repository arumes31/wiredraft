import assert from "node:assert/strict";

import { cableBezier } from "./static/js/cabling.js";
import { hardwareCatalog, instantiateProfile, upgradeInstalledPhysicalPorts } from "./static/js/catalog.js";
import { buildSVGDocument } from "./static/js/export.js";
import { faceplateResearchCoverage, resolveFaceplateTemplate } from "./static/js/faceplate.js";
import { connectorKind, connectorSize, endpointCurveSegment, portLinkLEDColor } from "./static/js/termination.js";

assert.equal(connectorKind("RJ45_1G"), "rj45");
assert.equal(connectorKind("DSL_RJ11"), "dsl");
assert.equal(connectorKind("SFP_PLUS_10G"), "sfp");
assert.equal(connectorKind("QSFP_DD_400G"), "qsfp");
assert.deepEqual(connectorSize("QSFP28_100G"), { width: 21, height: 15 });
assert.equal(portLinkLEDColor("up"), "#42d98b", "an up link LED must remain solid green");
assert.equal(portLinkLEDColor("down"), "#2d393b", "a down link LED must remain inactive");

const curve = cableBezier({ x: 100, y: 100 }, { x: 500, y: 400 });
const sourceSegment = endpointCurveSegment(curve, "source", { x: 50, y: 50, width: 100, height: 100 });
const targetSegment = endpointCurveSegment(curve, "target", { x: 450, y: 350, width: 100, height: 100 });
assert.deepEqual(sourceSegment.source, curve.source, "source overlay must begin at the real source port");
assert.deepEqual(targetSegment.target, curve.target, "target overlay must end at the real target port");
assert.ok(sourceSegment.target.y > 156, "source overlay should join the cable beyond the device edge");
assert.ok(targetSegment.source.y < 344, "target overlay should join the cable beyond the device edge");

const coverage = faceplateResearchCoverage(hardwareCatalog);
assert.equal(coverage.total, hardwareCatalog.length);
assert.equal(coverage.sourced, hardwareCatalog.length);
assert.equal(coverage.fallback, 0);
assert.ok(coverage.templates.size >= 18, `expected broad chassis coverage, got ${coverage.templates.size} templates`);

function resolved(vendor, model, category = "Switch", unitsU = 1) {
  return resolveFaceplateTemplate({ model, category, faceplate: { vendor, unitsU } });
}

assert.equal(resolved("Fortinet", "FortiGate 40F", "Firewall").id, "fortinet-desktop");
assert.equal(resolved("Fortinet", "FortiGate Rugged 70G", "Firewall").id, "fortinet-rugged");
assert.equal(resolved("Fortinet", "FortiSwitch 124F").id, "fortinet-switch");
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
  return area && area.x > 0 && area.x < .5 && area.y > 0 && area.y < 1;
}), "every faceplate template needs an explicit left-side status/control area");

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
assert.match(svg.slice(cableIndex), /d="M[^\"]+ C[^\"]+"/, "the foreground cable must preserve the complete routed curve");
assert.match(svg, /class="name"[^>]+fill="#202426"[^>]*>SOURCE<\/text>/, "light faceplate labels need dark ink");
assert.match(svg, /width="18" height="14" rx="2"/, "RJ45 SVG geometry should match the canvas connector size");
assert.match(svg, /width="17" height="12" rx="2"/, "SFP SVG geometry should match the canvas connector size");
assert.match(svg, /data-layer="status-area"/, "SVG status indicators should use faceplate status-area geometry");

console.log(`faceplate checks passed: ${coverage.sourced} sourced profiles across ${coverage.templates.size} templates`);
