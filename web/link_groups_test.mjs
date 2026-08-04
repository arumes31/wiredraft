import assert from "node:assert/strict";

import { defaultGroupInput, groupForLink, planLinkGroup } from "./static/js/link-groups.js";
import { linkGroupPortBadges } from "./static/js/link-group-display.js";

const links = ["a", "b", "c", "d"].map((id) => ({ id }));

const created = planLinkGroup({ links, linkGroups: [] }, "a", "b", {
  mode: "LACP", name: "EDGE LACP", notes: "",
});
assert.equal(created.action, "create");
assert.deepEqual(new Set(created.group.linkIds), new Set(["a", "b"]));

const topology = {
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
  links,
  linkGroups: [
    { id: "g1", name: "LEFT", mode: "LACP", linkIds: ["a", "b"], notes: "" },
    { id: "g2", name: "RIGHT", mode: "LACP", linkIds: ["c", "d"], notes: "" },
  ],
}, "a", "c", { mode: "LACP", name: "MERGED", notes: "" });
assert.deepEqual(merged.deleteGroupIDs, ["g2"]);
assert.deepEqual(new Set(merged.group.linkIds), new Set(["a", "b", "c", "d"]));

const failover = planLinkGroup({ links, linkGroups: [] }, "a", "b", {
  mode: "Failover", name: "WAN FAILOVER", primaryLinkId: "b", notes: "",
});
assert.equal(failover.group.primaryLinkId, "b");
assert.deepEqual(new Set(failover.group.linkIds), new Set(["a", "b"]));

const changedToLACP = planLinkGroup({
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

console.log("link group planning checks passed");
