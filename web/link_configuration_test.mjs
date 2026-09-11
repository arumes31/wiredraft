import assert from "node:assert/strict";

import {
  defaultLinkConfiguration,
  isLinkConfigurationScopeSynchronized,
  isLinkConfigurationSynchronized,
  isPhysicalOnlyLinkScope,
  isPhysicalOnlyPort,
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

// Physical storage and power paths must never acquire an Ethernet profile,
// including a mixed endpoint pair and an accidentally grouped physical member.
for (const type of ["SAS_MINI_HD_12G", "SAS_MINI_6G", "FC_SFP_16G", "Power"]) {
  const passive = { id: "physical", type, mode: "Unconfigured", nativeVlan: 0, allowedVlans: [] };
  assert.equal(isPhysicalOnlyPort(passive), true, type);
  const cable = { primaryVlan: 0, vlanIds: [] };
  assert.equal(defaultLinkConfiguration(topology, cable, passive, passive), null, type);
  assert.equal(defaultLinkConfiguration(topology, cable, passive, source), null, `${type} source`);
  assert.equal(defaultLinkConfiguration(topology, cable, source, passive), null, `${type} target`);
  assert.equal(isLinkConfigurationSynchronized(cable, passive, passive, { mode: "Access", nativeVlan: 1, allowedVlans: [] }), false, type);
  const grouped = structuredClone(groupTopology);
  grouped.devices[1].ports[1] = { ...passive, id: "p4" };
  const before = structuredClone(grouped);
  assert.equal(isPhysicalOnlyLinkScope(grouped, "member-a"), true, `${type} grouped member`);
  assert.equal(isLinkConfigurationScopeSynchronized(grouped, "member-a", groupConfiguration), false, `${type} grouped member`);
  assert.deepEqual(grouped, before, `${type} classification must not rewrite saved topology`);
}
assert.equal(isPhysicalOnlyLinkScope(groupTopology, "member-a"), false);
assert.equal(isPhysicalOnlyLinkScope(null, "missing"), false);
assert.equal(isPhysicalOnlyPort({ type: "SFP_PLUS_10G" }), false);
assert.equal(isPhysicalOnlyPort({ type: "FIBER_LC" }), false);
assert.equal(isPhysicalOnlyPort({ type: "__proto__" }), false);
assert.equal(isPhysicalOnlyPort(null), false);
console.log("link configuration checks passed");
