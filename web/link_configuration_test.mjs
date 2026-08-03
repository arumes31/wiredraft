import assert from "node:assert/strict";

import {
  defaultLinkConfiguration,
  isLinkConfigurationScopeSynchronized,
  isLinkConfigurationSynchronized,
  linkConfigurationScope,
  normalizeLinkConfiguration,
} from "./static/js/link-configuration.js";

const topology = { vlans: [{ id: 1 }, { id: 10 }, { id: 20 }, { id: 30 }] };
const link = { primaryVlan: 10, vlanIds: [30, 10, 20] };
const source = { mode: "Trunk", nativeVlan: 10, allowedVlans: [20, 30] };
const target = { mode: "Trunk", nativeVlan: 10, allowedVlans: [30, 20] };

assert.deepEqual(defaultLinkConfiguration(topology, link, source, target), {
  mode: "Trunk", nativeVlan: 10, allowedVlans: [20, 30],
});
assert.deepEqual(defaultLinkConfiguration(topology, link, { ...source, mode: "Access" }, { ...target, mode: "Access" }), {
  mode: "Trunk", nativeVlan: 10, allowedVlans: [20, 30],
});
assert.equal(isLinkConfigurationSynchronized(link, source, target, { mode: "Trunk", nativeVlan: 10, allowedVlans: [20, 30] }), true);
assert.equal(isLinkConfigurationSynchronized(link, source, { ...target, nativeVlan: 1 }, { mode: "Trunk", nativeVlan: 10, allowedVlans: [20, 30] }), false);

assert.deepEqual(normalizeLinkConfiguration({
  mode: "Trunk", nativeVlan: "10", allowedVlans: [30, "20", 10, 20],
}), { mode: "Trunk", nativeVlan: 10, allowedVlans: [20, 30] });
assert.deepEqual(normalizeLinkConfiguration({
  mode: "Access", nativeVlan: 20, allowedVlans: [10, 30],
}), { mode: "Access", nativeVlan: 20, allowedVlans: [] });

const groupTopology = {
  devices: [
    { id: "left", ports: [
      { id: "p1", mode: "Trunk", nativeVlan: 10, allowedVlans: [20, 30] },
      { id: "p2", mode: "Trunk", nativeVlan: 10, allowedVlans: [20, 30] },
    ] },
    { id: "right", ports: [
      { id: "p3", mode: "Trunk", nativeVlan: 10, allowedVlans: [20, 30] },
      { id: "p4", mode: "Trunk", nativeVlan: 10, allowedVlans: [20, 30] },
    ] },
    { id: "other", ports: [
      { id: "p5", mode: "Access", nativeVlan: 1, allowedVlans: [] },
      { id: "p6", mode: "Access", nativeVlan: 1, allowedVlans: [] },
    ] },
  ],
  links: [
    { id: "member-a", sourcePortId: "p1", targetPortId: "p3", primaryVlan: 10, vlanIds: [10, 20, 30] },
    { id: "member-b", sourcePortId: "p2", targetPortId: "p4", primaryVlan: 10, vlanIds: [10, 20, 30] },
    { id: "unrelated", sourcePortId: "p5", targetPortId: "p6", primaryVlan: 1, vlanIds: [1] },
  ],
  linkGroups: [{ id: "group-a", mode: "LACP", linkIds: ["member-a", "member-b"] }],
};
const groupConfiguration = { mode: "Trunk", nativeVlan: 10, allowedVlans: [20, 30] };

assert.deepEqual(linkConfigurationScope(groupTopology, "member-b").map((item) => item.id), ["member-a", "member-b"]);
assert.deepEqual(linkConfigurationScope(groupTopology, "unrelated").map((item) => item.id), ["unrelated"]);
assert.equal(isLinkConfigurationScopeSynchronized(groupTopology, "member-b", groupConfiguration), true);
groupTopology.devices[1].ports[1].nativeVlan = 1;
assert.equal(isLinkConfigurationScopeSynchronized(groupTopology, "member-b", groupConfiguration), false);

console.log("link configuration checks passed");
