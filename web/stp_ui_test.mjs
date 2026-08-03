import assert from "node:assert/strict";

import { analysisView } from "./static/js/analysis-ui.js";
import { CanvasEngine } from "./static/js/canvas.js";

const view = analysisView({
  issues: [],
  loops: [{ vlanId: 10, deviceIds: ["root", "access"], linkIds: ["link-2"] }],
  stp: [{
    vlanId: 10,
    domain: 1,
    rootBridgeId: "root",
    rootName: "CORE <ROOT>",
    bridges: [
      { bridgeId: "root", name: "CORE <ROOT>", deviceIds: ["member-a", "member-b"], priority: 4096, rootPathCost: 0, rootPortIds: [] },
      { bridgeId: "access", name: "ACCESS", deviceIds: ["access"], priority: 32768, rootPathCost: 1, rootPortIds: ["port-root"] },
    ],
    ports: [
      { portId: "port-root", linkId: "link-1", logicalBridgeId: "access", role: "Root", state: "forwarding" },
      { portId: "port-blocked", linkId: "link-2", logicalBridgeId: "access", role: "Blocked", state: "blocking" },
    ],
    paths: [
      { bridgeId: "root", bridgeIds: ["root"], linkIds: [] },
      { bridgeId: "access", bridgeIds: ["access", "root"], linkIds: ["link-1"] },
    ],
  }],
});

assert.equal(view.stpCountText, "1 DOMAIN");
assert.match(view.stpMarkup, /VLAN 10 · DOMAIN 1/);
assert.match(view.stpMarkup, /2 CHASSIS · PRIORITY 4096/);
assert.match(view.stpMarkup, /1 BLOCKED/);
assert.match(view.stpMarkup, /data-stp-links="link-1"/);
assert.doesNotMatch(view.stpMarkup, /CORE <ROOT>/, "bridge names must be escaped");
assert.match(view.stpMarkup, /CORE &lt;ROOT&gt;/);

const engine = Object.create(CanvasEngine.prototype);
engine.state = { analysis: {
  stp: [
    { vlanId: 10, ports: [{ portId: "port-1", role: "Designated" }, { portId: "port-2", role: "Root" }] },
    { vlanId: 20, ports: [{ portId: "port-1", role: "Blocked" }] },
  ],
} };
engine.rebuildSTPPortStateCache();
assert.equal(engine.stpPortRole("port-1"), "Blocked", "blocked role must take visual precedence across VLANs");
assert.equal(engine.stpPortRole("port-2"), "Root");
assert.equal(engine.stpPortRole("missing"), "");
assert.deepEqual(engine.stpPortStates("port-1").map(({ vlanId }) => vlanId), [10, 20]);

console.log("spanning-tree rail and cached port role checks passed");
