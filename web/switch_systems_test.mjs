import assert from "node:assert/strict";

import {
  buildSwitchSystem, logicalDeviceCount, switchSystemCandidates,
  switchSystemForDevice, switchSystemModeLabel,
} from "./static/js/switch-systems.js";

const topology = {
  devices: [
    { id: "s1", name: "Switch 1", category: "Switch" },
    { id: "s2", name: "Switch 2", category: "Switch" },
    { id: "s3", name: "Switch 3", category: "Switch" },
    { id: "fw1", name: "Firewall", category: "Firewall" },
  ],
  switchSystems: [{ id: "system-1", name: "CORE", mode: "VSF", deviceIds: ["s1", "s2"], notes: "" }],
  firewallClusters: [],
};

assert.equal(logicalDeviceCount(topology), 3);
topology.firewallClusters = [{ id: "ha", mode: "ActivePassive", deviceIds: ["fw1", "fw2"], activeDeviceId: "fw1" }];
topology.devices.push({ id: "fw2", name: "Firewall 2", category: "Firewall" });
assert.equal(logicalDeviceCount(topology), 3, "switch systems and firewall clusters each count as one unit");
assert.equal(switchSystemForDevice(topology, "s2").id, "system-1");
assert.equal(switchSystemForDevice(topology, "s3"), null);
assert.equal(switchSystemModeLabel("MCLAG"), "Fortinet MC-LAG");

const candidates = switchSystemCandidates(topology);
assert.equal(candidates.length, 3);
assert.equal(candidates.find(({ device }) => device.id === "s1").available, false);
assert.equal(switchSystemCandidates(topology, "system-1").every(({ available }) => available), true);

const system = buildSwitchSystem(null, {
  name: " ACCESS FABRIC ", mode: "StackWise", deviceIds: ["s1", "s2", "s2", "s3"], notes: " peers ",
});
assert.equal(system.name, "ACCESS FABRIC");
assert.deepEqual(system.deviceIds, ["s1", "s2", "s3"]);
assert.equal(system.notes, "peers");
assert.throws(() => buildSwitchSystem(null, { name: "X", mode: "Stack", deviceIds: ["s1"] }), /at least two/i);

console.log("switch system checks passed");
