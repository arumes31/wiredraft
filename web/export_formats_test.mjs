import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { routeFromPoints, routesWithCrossingBridges } from "./static/js/cabling.js";
import {
  buildConfigurationDocument, buildHTMLDocument, buildPDFDocument, buildSVGDocument, svgRoutePath,
} from "./static/js/export.js";
import { linkEndpointBadges } from "./static/js/link-end-labels.js";

const applicationHTML = readFileSync(new URL("./static/index.html", import.meta.url), "utf8");
const applicationJS = readFileSync(new URL("./static/js/app.js", import.meta.url), "utf8");
const exportJS = readFileSync(new URL("./static/js/export.js", import.meta.url), "utf8");
for (const [id, label] of [["pdf-button", "PDF SHEET"], ["html-button", "HTML REPORT"], ["configuration-button", "CONFIG WORKBOOK"]]) {
  assert.match(applicationHTML, new RegExp(`id="${id}"[^>]*>[^]*?<b>${label}</b>`), `${label} must be available in the export popup`);
  assert.match(applicationJS, new RegExp(`getElementById\\("${id}"\\)\\.addEventListener`), `${label} must be wired to an export action`);
}
assert.match(applicationJS, /exportModulePromise \|\|= import\("\.\/export\.js"\)/, "heavy export code must be loaded only when first used");
for (const action of ["exportConfiguration", "exportHTML", "exportJSON", "exportPDF", "exportPNG", "exportSVG"]) {
  assert.match(applicationJS, new RegExp(`runLazyExport\\("${action}"`), `${action} must be dispatched through the lazy export module`);
}
assert.match(exportJS, /data-layer="bridge-jumper"[^]*clip-path="url\(#\$\{clipID\}\)"/,
  "SVG exports must redraw horizontal jumper bows above vertical tracks");
assert.match(exportJS, /data-layer="cable-outline"[^]*CABLE_OUTLINE_WIDTH \* 2/,
  "SVG exports must outline colored cable rails with the shared high-contrast width");
assert.match(exportJS, /data-layer="link-end-label"[^]*data-endpoint=/,
  "SVG exports must identify both remote endpoints near the cable ends");
assert.match(exportJS, /data-layer="panel-rear-map"[^]*stroke-dasharray="\$\{RearPanelLinkVisual\.dash\.join\(" "\)\}"/,
  "SVG exports must distinguish rear panel mappings with the shared dash pattern");
assert.match(exportJS, /data-layer="panel-rear-map"[^]*stroke-width="\$\{RearPanelLinkVisual\.strokeWidth\}"[^]*opacity="\$\{RearPanelLinkVisual\.opacity\}"/,
  "SVG exports must keep rear panel mappings thinner and more transparent than front cables");

const crossingHorizontal = routeFromPoints([{ x: 0, y: 50 }, { x: 100, y: 50 }]);
const crossingVertical = routeFromPoints([{ x: 50, y: 0 }, { x: 50, y: 100 }]);
const [, exportedHorizontal] = routesWithCrossingBridges([crossingVertical, crossingHorizontal]);
assert.match(svgRoutePath(exportedHorizontal), /H46 A4 4 0 0 1 54 50 H100/,
  "the static SVG path must replace the horizontal crossing span with a 4px semicircular arc");

const badgeTopology = {
  racks: [{ id: "rack-a", name: "RACK A01" }, { id: "rack-b", name: "RACK B01" }],
  devices: [
    { id: "a", name: "CORE A", rackId: "rack-a", ports: [{ id: "a49", label: "49" }] },
    { id: "b", name: "CORE B", rackId: "rack-b", ports: [{ id: "b23", label: "P23" }] },
  ],
};
const endpointBadges = linkEndpointBadges(badgeTopology, { id: "ab", sourcePortId: "a49", targetPortId: "b23" },
  routeFromPoints([{ x: 0, y: 10 }, { x: 100, y: 10 }, { x: 100, y: 90 }, { x: 200, y: 90 }]));
assert.deepEqual(endpointBadges.map(({ text }) => text), ["➔ B01:P23", "⇠ A01:49"],
  "export badges must name the remote rack and port at both cable ends");

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9]);
const pdf = buildPDFDocument(jpeg, 1600, 900, "Vienna Core Δ");
const pdfText = Buffer.from(pdf).toString("latin1");
assert.ok(pdfText.startsWith("%PDF-1.4"), "PDF export needs a versioned header");
assert.match(pdfText, /\/MediaBox \[0 0 1190\.55 841\.89\]/, "wide diagrams should use landscape A3");
assert.match(pdfText, /\/Subtype \/Image[^]*\/Filter \/DCTDecode/, "PDF must embed the JPEG as an image object");
assert.match(pdfText, /\/Title <FEFF/, "PDF title metadata should use a Unicode-safe string");
assert.ok(Buffer.from(pdf).includes(Buffer.from(jpeg)), "PDF must contain the complete JPEG payload");
const xrefOffset = Number(pdfText.match(/startxref\n(\d+)\n/)?.[1]);
assert.equal(pdfText.slice(xrefOffset, xrefOffset + 4), "xref", "startxref must point at the cross-reference table");
const xrefEntries = [...pdfText.matchAll(/^(\d{10}) 00000 n $/gm)].map((match) => Number(match[1]));
assert.equal(xrefEntries.length, 6, "PDF must index every indirect object");
xrefEntries.forEach((offset, index) => assert.equal(pdfText.slice(offset, offset + 7), `${index + 1} 0 obj`, `xref entry ${index + 1} must point at its object`));

const topology = {
  name: "Core <A> & Edge", organization: "Example Corp", location: "Vienna DC1", racks: [], devices: [], links: [], vlans: [],
  notes: "safe </script><script>alert(1)</script>",
  documentationLinks: [{ targetKind: "topology", label: "Runbook", url: "https://docs.example.test/runbook" }],
};
const engine = {
  worldBounds: () => ({ x: 0, y: 0, width: 800, height: 500 }),
  portCenters: () => new Map(), rackRectangles: () => [], deviceRectangles: () => [],
};
const html = buildHTMLDocument(topology, engine, new Date("2026-08-03T19:30:00.000Z"));
assert.ok(html.startsWith("<!doctype html>"), "HTML export should be a standalone document");
assert.match(html, /<title>Core &lt;A&gt; &amp; Edge · Netdiagram export<\/title>/, "HTML title must be escaped");
assert.match(html, /<svg role="img" aria-label="Core &lt;A&gt; &amp; Edge network topology"/, "HTML must embed the accessible topology SVG");
assert.match(html, /<b>0<\/b>RACKS[^]*<b>0<\/b>DEVICES[^]*<b>0<\/b>CABLES[^]*<b>0<\/b>VLANS/, "HTML should include topology totals");
assert.match(html, /Example Corp \/ Vienna DC1 · Portable physical topology report/,
  "standalone reports must retain their organization and location assignment");
assert.match(html, /id="netdiagram-topology" type="application\/json"/, "HTML must embed restorable source data as inert JSON");
assert.equal(html.includes("</script><script>alert(1)</script>"), false, "embedded JSON must not break out of its data block");
assert.match(html, /safe \\u003c\/script\\u003e\\u003cscript\\u003ealert\(1\)\\u003c\/script\\u003e/, "HTML must retain escaped source data");
assert.match(html, /ATTACHED DOCUMENTATION[^]*Runbook[^]*https:\/\/docs\.example\.test\/runbook/, "HTML reports must preserve attached documentation links");
assert.equal(/<(?:link|script)\b[^>]+(?:src|href)="https?:/i.test(html), false, "standalone HTML must not depend on remote assets");

const staticRackA = { id: "static-rack-a", name: "RACK A01", heightU: 4, color: "#27575d" };
const staticRackB = { id: "static-rack-b", name: "RACK B01", heightU: 4, color: "#27575d" };
const staticDeviceA = {
  id: "static-a", name: "CORE A", category: "Switch", model: "GENERIC", rackId: staticRackA.id,
  faceplate: { vendor: "Generic", unitsU: 1 }, ports: [
    { id: "static-a-mgmt", label: "MGMT", portIndex: 1, type: "RJ45_1G", group: "MGMT", speedMbps: 1000 },
    { id: "static-a-wan2", label: "WAN2", portIndex: 2, type: "RJ45_1G", group: "WAN", speedMbps: 1000 },
  ],
};
const staticDeviceB = {
  id: "static-b", name: "CORE B", category: "Switch", model: "GENERIC", rackId: staticRackB.id,
  faceplate: { vendor: "Generic", unitsU: 1 }, ports: [
    { id: "static-b-23", label: "P23", portIndex: 23, type: "RJ45_1G", group: "DATA", speedMbps: 1000 },
    { id: "static-b-24", label: "P24", portIndex: 24, type: "RJ45_1G", group: "DATA", speedMbps: 1000 },
  ],
};
const staticTopology = {
  name: "Static trace",
  racks: [staticRackA, staticRackB], devices: [staticDeviceA, staticDeviceB],
  vlans: [{ id: 10, name: "Management", colorHex: "#f0b35a" }], linkGroups: [], annotations: [],
  links: [{ id: "static-link", sourceDeviceId: staticDeviceA.id, sourcePortId: "static-a-mgmt", targetDeviceId: staticDeviceB.id, targetPortId: "static-b-23", cableType: "CAT6A", primaryVlan: 10, vlanIds: [10] }],
};
const staticEngine = {
  worldBounds: () => ({ x: 0, y: 0, width: 1650, height: 500 }),
  portCenters: () => new Map([
    ["static-a-mgmt", { x: 650, y: 145 }], ["static-a-wan2", { x: 620, y: 165 }],
    ["static-b-23", { x: 1000, y: 345 }], ["static-b-24", { x: 1030, y: 365 }],
  ]),
  rackRectangles: () => [
    { rack: staticRackA, x: 0, y: 0, width: 750, height: 464 },
    { rack: staticRackB, x: 900, y: 0, width: 750, height: 464 },
  ],
  deviceRectangles: () => [
    { device: staticDeviceA, rack: staticRackA, x: 30, y: 100, width: 690, height: 100 },
    { device: staticDeviceB, rack: staticRackB, x: 930, y: 300, width: 690, height: 100 },
  ],
};
const staticSVG = buildSVGDocument(staticTopology, staticEngine);
assert.match(staticSVG, /data-layer="cable-outline"[^]*stroke-width="6\.25"/, "static SVG must contain a one-pixel cable outline");
assert.match(staticSVG, /data-role="management"[^]*stroke-dasharray="4 4"/, "management paths need a non-color dash cue");
assert.match(staticSVG, /data-layer="link-end-label" data-endpoint="source"[^]*➔ B01:P23/, "source badge must identify its remote rack and port");
assert.match(staticSVG, /data-layer="link-end-label" data-endpoint="target"[^]*⇠ A01:MGMT/, "target badge must identify its remote rack and port");

const failoverSVG = buildSVGDocument({
  ...staticTopology,
  links: [
    staticTopology.links[0],
    { ...staticTopology.links[0], id: "static-backup", sourcePortId: "static-a-wan2", targetPortId: "static-b-24" },
  ],
  linkGroups: [{
    id: "static-failover", name: "WAN FAILOVER", mode: "Failover",
    primaryLinkId: "static-link", linkIds: ["static-link", "static-backup"],
  }],
}, staticEngine);
assert.match(failoverSVG, /data-layer="link-group-port-badge" data-role="P" data-link="static-link"/,
  "static exports must render primary state directly on both endpoint sockets");
assert.match(failoverSVG, /data-layer="link-group-port-badge" data-role="B" data-link="static-backup"/,
  "static exports must render backup state directly on both endpoint sockets");
assert.equal((failoverSVG.match(/data-layer="link-group-port-badge"/g) || []).length, 4,
  "both endpoints of both failover members need an on-socket role badge");
assert.match(failoverSVG, /data-layer="cable-outline"[^>]*stroke-width="4\.5"/,
  "tight group members need compact outlined rails that remain distinct at a 5px track pitch");

const layeredSVG = buildSVGDocument({
  ...staticTopology,
  links: [{
    ...staticTopology.links[0],
    id: "static-rear-map",
    cableType: "FIBER",
    sourceSide: "rear",
    targetSide: "rear",
  }, ...staticTopology.links],
}, staticEngine);
const rearLayerIndex = layeredSVG.indexOf('data-layer="panel-rear-map"');
const frontLayerIndex = layeredSVG.indexOf('data-layer="cable-outline"');
assert.ok(rearLayerIndex >= 0 && frontLayerIndex > rearLayerIndex,
  "SVG exports must paint backend structured wiring below every solid front cable");
assert.match(layeredSVG, /data-layer="panel-rear-map"[^>]*stroke-dasharray="6 4"[^>]*opacity="0\.75"/,
  "SVG backend runs must retain the shared 6/4 dash and 75-percent opacity");
const sheathIndex = layeredSVG.indexOf('data-layer="rear-channel-sheath"');
assert.ok(sheathIndex > rearLayerIndex && sheathIndex < frontLayerIndex,
  "tube sheaths must cover the common rear-strand run while remaining below every front cable");
assert.match(layeredSVG, /data-layer="rear-channel-sheath"[^>]*data-channel-type="tube"[^>]*data-strands="1"/,
  "static exports must retain tube channel semantics for traceable documentation");
assert.match(layeredSVG, /data-layer="rear-channel-sheath-core"[^>]*opacity="\.94"/,
  "static exports must render the shared tube as an opaque thick run instead of exposed parallel strands");

const configuredTopology = {
  organization: "Example Corp", location: "Vienna DC1",
  name: "Vienna Core & Edge",
  revision: 17,
  racks: [
    { id: "rack-a", name: "RACK A01" },
    { id: "rack-b", name: "RACK B01" },
  ],
  devices: [
    {
      id: "switch-a", name: "CORE SW A", category: "Switch", model: "CX 6300M 48G", rackId: "rack-a", rackUnit: 42,
      serialNumber: "SER-A", assetTag: "ASSET-A", hostname: "core-a", managementIp: "10.0.0.11", owner: "Network Operations",
      location: { site: "Vienna", building: "HQ", floor: "1", room: "DC-A" },
      faceplate: { vendor: "HPE Aruba", unitsU: 1 },
      ports: [
        { id: "a-1", portIndex: 1, label: "1/1/1", group: "DATA", type: "SFP28_25G", mediaType: "Fiber", speedMbps: 25000, status: "up", mode: "Trunk", nativeVlan: 10, allowedVlans: [20] },
        { id: "a-2", portIndex: 2, label: "1/1/2", group: "DATA", type: "SFP28_25G", mediaType: "Fiber", speedMbps: 25000, status: "up", mode: "Trunk", nativeVlan: 10, allowedVlans: [20] },
      ],
    },
    {
      id: "switch-b", name: "CORE SW B", category: "Switch", model: "CX 6300M 48G", rackId: "rack-b", rackUnit: 42,
      hostname: "core-b", managementIp: "10.0.0.12", faceplate: { vendor: "HPE Aruba", unitsU: 1 },
      ports: [
        { id: "b-1", portIndex: 1, label: "1/1/1", group: "DATA", type: "SFP28_25G", mediaType: "Fiber", speedMbps: 25000, status: "up", mode: "Trunk", nativeVlan: 10, allowedVlans: [20] },
        { id: "b-2", portIndex: 2, label: "1/1/2", group: "DATA", type: "SFP28_25G", mediaType: "Fiber", speedMbps: 25000, status: "up", mode: "Trunk", nativeVlan: 10, allowedVlans: [20] },
      ],
    },
    { id: "fw-a", name: "EDGE FW A", category: "Firewall", model: "FortiGate 200E", rackId: "rack-a", rackUnit: 39, faceplate: { vendor: "Fortinet", unitsU: 1 }, ports: [] },
    { id: "fw-b", name: "EDGE FW B", category: "Firewall", model: "FortiGate 200E", rackId: "rack-a", rackUnit: 38, faceplate: { vendor: "Fortinet", unitsU: 1 }, ports: [] },
  ],
  vlans: [
    { id: 10, name: "Management", colorHex: "#42d9c8", description: "Infrastructure management" },
    { id: 20, name: "Users", colorHex: "#4a9eff", description: "User access" },
  ],
  links: [
    { id: "link-a", sourceDeviceId: "switch-a", sourcePortId: "a-1", targetDeviceId: "switch-b", targetPortId: "b-1", cableType: "FIBER", primaryVlan: 10, vlanIds: [10, 20], notes: "Primary uplink" },
    { id: "link-b", sourceDeviceId: "switch-a", sourcePortId: "a-2", targetDeviceId: "switch-b", targetPortId: "b-2", cableType: "FIBER", primaryVlan: 10, vlanIds: [10, 20], notes: "safe </script><script>alert(1)</script>" },
  ],
  linkGroups: [{ id: "lag-1", name: "CORE LAG", mode: "LACP", linkIds: ["link-a", "link-b"], primaryLinkId: "link-a", notes: "Inter-rack aggregate" }],
  switchSystems: [{ id: "vsf-1", name: "CORE VSF", mode: "VSF", deviceIds: ["switch-a", "switch-b"], notes: "Logical core" }],
  firewallClusters: [{ id: "ha-1", name: "EDGE HA", mode: "ActivePassive", deviceIds: ["fw-a", "fw-b"], activeDeviceId: "fw-a", notes: "Internet edge" }],
};
const workbook = buildConfigurationDocument(configuredTopology, new Date("2026-08-04T12:00:00.000Z"));
assert.ok(workbook.startsWith("<!doctype html>"), "configuration export should be a standalone document");
assert.match(workbook, /Example Corp \/ Vienna DC1 · Inventory/,
  "configuration workbooks must identify their organization and location");
for (const section of ["Inventory", "Port configuration", "VLAN configuration", "Connected links", "Trunks and link groups", "Switch systems", "Firewall clusters"]) {
  assert.match(workbook, new RegExp(`>${section}<`), `configuration workbook must include ${section}`);
}
assert.match(workbook, /CORE SW A:1\/1\/1 \[FRONT\] → CORE SW B:1\/1\/1 \[FRONT\]/,
  "connected-link schedule must contain exact device:port to device:port paths");
assert.match(workbook, /CORE LAG[^]*LACP[^]*MEMBER 1[^]*MEMBER 2/,
  "link-group register must enumerate every physical trunk member");
assert.match(workbook, /10 · Management[^]*20 · Users/, "port and link records must resolve VLAN IDs to names");
assert.match(workbook, /CORE VSF[^]*Aruba VSF/, "switch-system configuration must include stack technology");
assert.match(workbook, /EDGE HA[^]*Active \/ passive[^]*EDGE FW A · ACTIVE[^]*EDGE FW B · PASSIVE/,
  "firewall configuration must include cluster mode and member roles");
assert.match(workbook, /id="netdiagram-topology" type="application\/json"/, "configuration workbook must embed its source topology for audit");
assert.equal(workbook.includes("</script><script>alert(1)</script>"), false, "configuration data must not break out of its inert JSON block");
assert.match(workbook, /safe \\u003c\/script\\u003e\\u003cscript\\u003ealert\(1\)\\u003c\/script\\u003e/,
  "configuration workbook must retain safely escaped source data");
assert.match(workbook, /id="filter"[^]*document\.querySelectorAll\('th button'\)/,
  "offline workbook must provide global filtering and sortable registers");
assert.equal(/<(?:link|script)\b[^>]+(?:src|href)="https?:/i.test(workbook), false,
  "configuration workbook must not depend on remote assets");

console.log("PDF, standalone diagram, and configuration workbook export checks passed");
