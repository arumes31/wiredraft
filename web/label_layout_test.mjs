import assert from "node:assert/strict";

import { describeLinkGroupMembers, peerLinkIDs, summarizeLinkGroup } from "./static/js/link-group-display.js";
import { cableLabelVisibility, placeCableLabels, pointerBubblePlacement, rectanglesOverlap } from "./static/js/label-layout.js";

const topology = {
  devices: [
    { id: "edge", name: "EDGE FIREWALL", ports: [{ id: "edge-1", label: "port11" }, { id: "edge-2", label: "port12" }] },
    { id: "a", name: "CORE SWITCH A", ports: [{ id: "a-1", label: "24" }] },
    { id: "b", name: "CORE SWITCH B", ports: [{ id: "b-1", label: "48" }] },
  ],
  links: [
    { id: "one", sourceDeviceId: "edge", sourcePortId: "edge-1", targetDeviceId: "a", targetPortId: "a-1", vlanIds: [1, 10] },
    { id: "two", sourceDeviceId: "edge", sourcePortId: "edge-2", targetDeviceId: "b", targetPortId: "b-1", vlanIds: [1, 10] },
  ],
};
const summary = summarizeLinkGroup(topology, {
  id: "group", name: "CORE PEERS", mode: "MCLAG", linkIds: ["one", "two"],
});
assert.equal(summary.title, "MC-LAG · CORE PEERS");
assert.match(summary.detail, /EDGE FIREWALL ↔ CORE SWITCH A \+ CORE SWITCH B · 2 LINKS/);

const lacp = summarizeLinkGroup(topology, {
  id: "lacp", name: "UPLINKS", mode: "LACP", linkIds: ["one", "two"],
});
assert.equal(lacp.title, "LACP · UPLINKS");
assert.equal(lacp.detail, "EDGE FIREWALL ↔ CORE SWITCH A · 2 LINKS");

assert.deepEqual(describeLinkGroupMembers(topology, {
  id: "failover", mode: "Failover", primaryLinkId: "one", linkIds: ["one", "two"],
}, "two"), [
  {
    id: "one", role: "PRIMARY", selected: false,
    source: { device: "EDGE FIREWALL", port: "port11" },
    target: { device: "CORE SWITCH A", port: "24" },
  },
  {
    id: "two", role: "BACKUP 1", selected: true,
    source: { device: "EDGE FIREWALL", port: "port12" },
    target: { device: "CORE SWITCH B", port: "48" },
  },
]);

topology.links[1].vlanIds = [];
topology.links[1].primaryVlan = 20;
const trunk = summarizeLinkGroup(topology, {
  id: "trunk", name: "VLAN CARRIER", mode: "Trunk", linkIds: ["one", "two"],
});
assert.equal(trunk.title, "TRUNK · VLAN CARRIER");
assert.equal(trunk.detail, "2 LINKS · VLAN 1/10/20");

topology.linkGroups = [{ id: "group", name: "CORE PEERS", mode: "MCLAG", linkIds: ["one", "two"] }];
assert.deepEqual(peerLinkIDs(topology, "one"), new Set(["two"]));
assert.deepEqual(peerLinkIDs(topology, "two"), new Set(["one"]));
assert.deepEqual(peerLinkIDs(topology, "missing"), new Set());
assert.deepEqual(cableLabelVisibility(topology, null), { groupIDs: new Set(), linkIDs: new Set() });
assert.deepEqual(cableLabelVisibility(topology, "one"), { groupIDs: new Set(["group"]), linkIDs: new Set() });
topology.links.push({ id: "standalone", sourceDeviceId: "a", targetDeviceId: "b", vlanIds: [20] });
assert.deepEqual(cableLabelVisibility(topology, "standalone"), { groupIDs: new Set(), linkIDs: new Set(["standalone"]) });
assert.deepEqual(cableLabelVisibility(topology, null, true), {
  groupIDs: new Set(["group"]), linkIDs: new Set(["standalone"]),
});

const items = Array.from({ length: 20 }, (_, index) => ({
  id: String(index), width: 90, height: 20, anchor: { x: 100, y: 100 }, candidates: [{ x: 100, y: 100 }],
}));
const placed = placeCableLabels(items);
for (let left = 0; left < placed.length; left += 1) {
  for (let right = left + 1; right < placed.length; right += 1) {
    assert.equal(rectanglesOverlap(placed[left].rect, placed[right].rect), false, `labels ${left} and ${right} overlap`);
  }
}
assert.deepEqual(placeCableLabels(items), placed, "placement must remain deterministic");

const viewport = { width: 800, height: 600 };
const bubbleSize = { width: 180, height: 70 };
const centerBubble = pointerBubblePlacement({ x: 300, y: 250 }, bubbleSize, viewport);
assert.equal(centerBubble.x, 316, "bubble should leave the pointer click target clear");
assert.equal(centerBubble.y, 266);
assert.deepEqual(centerBubble.tail.point, { x: 300, y: 250 });
const edgeBubble = pointerBubblePlacement({ x: 790, y: 590 }, bubbleSize, viewport);
assert.equal(edgeBubble.x, 594, "bubble should flip left at the viewport edge");
assert.equal(edgeBubble.y, 504, "bubble should flip above at the viewport edge");
assert.ok(edgeBubble.x >= 8 && edgeBubble.y >= 8);
assert.ok(edgeBubble.x + edgeBubble.width <= viewport.width - 8);
assert.ok(edgeBubble.y + edgeBubble.height <= viewport.height - 8);

console.log("cable label layout checks passed");
