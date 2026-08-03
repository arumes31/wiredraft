import assert from "node:assert/strict";

import { DEFAULT_VLAN_COLOR, linkVLANPalette, vlanBandPattern } from "./static/js/link-vlan-colors.js";

const vlans = Array.from({ length: 256 }, (_, index) => ({
  id: index + 1,
  colorHex: `#${((index + 1) * 2654435761 & 0xffffff).toString(16).padStart(6, "0")}`,
}));
const topology = { vlans };

for (let seed = 1; seed <= 250; seed += 1) {
  const native = seed % 256 + 1;
  const configured = [native, seed % 64 + 1, native, (seed * 13) % 256 + 1];
  const palette = linkVLANPalette(topology, { primaryVlan: native, vlanIds: configured });
  assert.equal(palette.channels[0].id, native, "native VLAN must always be the first visual channel");
  assert.equal(new Set(palette.channels.map(({ id }) => id)).size, palette.channels.length, "channels must be unique");
  assert.deepEqual(palette.channels.slice(1).map(({ id }) => id), palette.channels.slice(1).map(({ id }) => id).toSorted((a, b) => a - b));
  assert.match(palette.nativeColor, /^#[0-9a-f]{6}$/i);
  const bands = palette.channels.map((_, index) => vlanBandPattern(palette.channels.length, index, seed * 17));
  assert.equal(new Set(bands.map(({ offset }) => offset)).size, bands.length, "rainbow channels must not share the same dash phase");
}

assert.equal(linkVLANPalette(null, null).nativeColor, DEFAULT_VLAN_COLOR);
assert.equal(linkVLANPalette({ vlans: [] }, { primaryVlan: -1, vlanIds: [NaN, -2, 0] }).channels.length, 1);

console.log("VLAN color property checks passed");
