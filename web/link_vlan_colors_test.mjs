import assert from "node:assert/strict";

import { DEFAULT_VLAN_COLOR, linkVLANPalette, vlanBandPattern } from "./static/js/link-vlan-colors.js";
import { buildSVGDocument } from "./static/js/export.js";

const topology = {
  vlans: [
    { id: 1, colorHex: "#f4c542" },
    { id: 10, colorHex: "#42d9c8" },
    { id: 20, colorHex: "#ee6c9f" },
    { id: 30, colorHex: "#6f8cff" },
  ],
};

assert.deepEqual(linkVLANPalette(topology, { primaryVlan: 20, vlanIds: [20] }), {
  nativeVlanID: 20,
  nativeColor: "#ee6c9f",
  channels: [{ id: 20, color: "#ee6c9f", isNative: true }],
  isRainbow: false,
});

assert.deepEqual(linkVLANPalette(topology, { primaryVlan: 10, vlanIds: [30, 10, 20, 30] }), {
  nativeVlanID: 10,
  nativeColor: "#42d9c8",
  channels: [
    { id: 10, color: "#42d9c8", isNative: true },
    { id: 20, color: "#ee6c9f", isNative: false },
    { id: 30, color: "#6f8cff", isNative: false },
  ],
  isRainbow: true,
});

assert.equal(linkVLANPalette(topology, { primaryVlan: 999, vlanIds: [999] }).nativeColor, DEFAULT_VLAN_COLOR);
assert.equal(linkVLANPalette(topology, { primaryVlan: 0, vlanIds: [30, 20] }).nativeVlanID, 20);

const firstBand = vlanBandPattern(3, 0, 1000);
const secondBand = vlanBandPattern(3, 1, 1000);
assert.deepEqual(firstBand.dash, [14, 28]);
assert.equal(firstBand.cycleLength, 42);
assert.equal(secondBand.offset - firstBand.offset, -14);
assert.ok(vlanBandPattern(20, 0).cycleLength <= 84);
assert.deepEqual(vlanBandPattern(1, 0).dash, []);

const svgTopology = {
  name: "VLAN colors",
  racks: [],
  devices: [],
  vlans: topology.vlans,
  links: [{
    id: "link-1", sourcePortId: "source", targetPortId: "target",
    primaryVlan: 10, vlanIds: [10, 20, 30],
  }],
};
const svgEngine = {
  worldBounds: () => ({ x: 0, y: 0, width: 300, height: 150 }),
  portCenters: () => new Map([["source", { x: 10, y: 20 }], ["target", { x: 280, y: 120 }]]),
  rackRectangles: () => [],
  deviceRectangles: () => [],
};
const svg = buildSVGDocument(svgTopology, svgEngine);
assert.match(svg, /data-layer="cable-native" data-vlan="10"/);
assert.match(svg, /data-layer="cable-vlan" data-vlan="10"/);
assert.match(svg, /data-layer="cable-vlan" data-vlan="20"/);
assert.match(svg, /data-layer="cable-vlan" data-vlan="30"/);
assert.match(svg, /stroke-dasharray="14 28"/);

console.log("VLAN cable color checks passed");
