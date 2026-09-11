import assert from "node:assert/strict";

import { defaultGroupInput, groupForLink, planLinkGroup } from "./static/js/link-groups.js";
import { linkGroupPortBadges } from "./static/js/link-group-display.js";

const links = ["a", "b", "c", "d"].map((id) => ({ id, sourcePortId: `${id}-source`, targetPortId: `${id}-target` }));
const devices = [{ id: "endpoints", ports: links.flatMap(link => [
  { id: link.sourcePortId, type: "RJ45_1G" }, { id: link.targetPortId, type: "RJ45_1G" },
]) }];

const created = planLinkGroup({ devices, links, linkGroups: [] }, "a", "b", {
  mode: "LACP", name: "EDGE LACP", notes: "",
});
assert.equal(created.action, "create");
assert.deepEqual(new Set(created.group.linkIds), new Set(["a", "b"]));

const topology = {
  devices,
  links,
  linkGroups: [{ id: "g1", name: "CORE", mode: "MCLAG", linkIds: ["a", "b"], notes: "peer pair" }],
};
assert.equal(groupForLink(topology, "a").id, "g1");
assert.deepEqual(defaultGroupInput(topology, "a", "c"), {
  mode: "MCLAG", name: "CORE", notes: "peer pair", primaryLinkId: "a", memberLinkIds: ["a", "c", "b"],
});
const extended = planLinkGroup(topology, "a", "c", { mode: "MCLAG", name: "CORE", notes: "peer pair" });
assert.equal(extended.action, "update");
assert.deepEqual(new Set(extended.group.linkIds), new Set(["a", "b", "c"]));

const merged = planLinkGroup({
  devices,
  links,
  linkGroups: [
    { id: "g1", name: "LEFT", mode: "LACP", linkIds: ["a", "b"], notes: "" },
    { id: "g2", name: "RIGHT", mode: "LACP", linkIds: ["c", "d"], notes: "" },
  ],
}, "a", "c", { mode: "LACP", name: "MERGED", notes: "" });
assert.deepEqual(merged.deleteGroupIDs, ["g2"]);
assert.deepEqual(new Set(merged.group.linkIds), new Set(["a", "b", "c", "d"]));

const failover = planLinkGroup({ devices, links, linkGroups: [] }, "a", "b", {
  mode: "Failover", name: "WAN FAILOVER", primaryLinkId: "b", notes: "",
});
assert.equal(failover.group.primaryLinkId, "b");
assert.deepEqual(new Set(failover.group.linkIds), new Set(["a", "b"]));

const changedToLACP = planLinkGroup({
  devices,
  links,
  linkGroups: [{ id: "g3", name: "WAN FAILOVER", mode: "Failover", linkIds: ["a", "b"], primaryLinkId: "a", notes: "" }],
}, "a", "b", { mode: "LACP", name: "WAN LACP", primaryLinkId: "a", notes: "" });
assert.equal(changedToLACP.group.primaryLinkId, "");

const failoverBadges = linkGroupPortBadges({
  links: [
    { id: "primary", sourcePortId: "a-wan1", targetPortId: "isp-1" },
    { id: "backup", sourcePortId: "a-wan2", targetPortId: "lte-1" },
  ],
  linkGroups: [{
    id: "wan-failover", mode: "Failover", primaryLinkId: "primary", linkIds: ["primary", "backup"],
  }],
});
assert.deepEqual([...failoverBadges.entries()].map(([portID, badge]) => [portID, badge.role]), [
  ["a-wan1", "P"], ["isp-1", "P"], ["a-wan2", "B"], ["lte-1", "B"],
], "P/B roles must be attached to both physical endpoint sockets");
assert.equal(linkGroupPortBadges({ links, linkGroups: topology.linkGroups }).size, 0,
  "LACP and MC-LAG groups must not create floating member dots or fake primary badges");

/** Build complete saved groups so every inherited member participates in validation. */
function endpointFixture(types = Array(8).fill("RJ45_1G")) {
  return {
    devices: [{ id: "endpoints", ports: devices[0].ports.map((port, index) => ({ ...port, type: types[index] })) }],
    links: structuredClone(links),
    linkGroups: [{ id: "left", linkIds: ["a", "b"] }, { id: "right", linkIds: ["c", "d"] }],
  };
}

for (const type of ["Power", "SAS_MINI_HD_12G", "SAS_MINI_6G", "FC_SFP_16G"]) {
  for (let index = 0; index < 8; index++) {
    const types = Array(8).fill("RJ45_1G");
    types[index] = type;
    const mixed = endpointFixture(types);
    const before = structuredClone(mixed);
    assert.throws(() => planLinkGroup(mixed, "a", "c", { mode: "LACP" }), /physical-only.*Ethernet/i,
      `${type} at endpoint${index} must reject a mixed member, including inherited members`);
    assert.deepEqual(mixed, before, "rejected planning must preserve saved groups and endpoints");
  }
  const mixedCables = endpointFixture([type, type, "RJ45_1G", "RJ45_1G", type, type, "RJ45_1G", "RJ45_1G"]);
  mixedCables.linkGroups = [];
  assert.throws(() => planLinkGroup(mixedCables, "a", "b", { mode: "Trunk" }), /physical-only.*Ethernet/i);
}

for (const mode of ["Trunk", "LACP", "MCLAG", "Failover"]) {
  for (const types of [Array(8).fill("RJ45_1G"),
    ["Power", "Power", "SAS_MINI_HD_12G", "SAS_MINI_HD_12G", "SAS_MINI_6G", "SAS_MINI_6G", "FC_SFP_16G", "FC_SFP_16G"]]) {
    const valid = endpointFixture(types);
    const before = structuredClone(valid);
    const planned = planLinkGroup(valid, "a", "c", { mode, primaryLinkId: "d" });
    assert.deepEqual(new Set(planned.group.linkIds), new Set(["a", "b", "c", "d"]));
    assert.equal(planned.group.primaryLinkId, mode === "Failover" ? "d" : "");
    assert.deepEqual(valid, before, "valid planning must not mutate existing records");
  }
}

for (let index = 0; index < 8; index++) {
  const missing = endpointFixture();
  missing.devices[0].ports.splice(index, 1);
  assert.throws(() => planLinkGroup(missing, "a", "c", { mode: "LACP" }), /endpoint.*no longer exists/i);
}
const staleMember = endpointFixture();
staleMember.links = staleMember.links.filter(link => link.id !== "d");
assert.throws(() => planLinkGroup(staleMember, "a", "c", { mode: "LACP" }), /cable.*no longer exists/i);
for (const side of ["sourceSide", "targetSide"]) {
  const rearMember = endpointFixture();
  rearMember.links[3][side] = "rear";
  assert.throws(() => planLinkGroup(rearMember, "a", "c", { mode: "LACP" }), /Rear panel mappings/);
}
assert.throws(() => planLinkGroup(endpointFixture(), "a", "a", { mode: "LACP" }), /two different cables/);
assert.throws(() => planLinkGroup(endpointFixture(), "a", "missing", { mode: "LACP" }), /cable.*no longer exists/);
assert.throws(() => planLinkGroup(endpointFixture(), "a", "c", { mode: "Failover", primaryLinkId: "missing" }), /primary cable/);
console.log("link group planning checks passed");
