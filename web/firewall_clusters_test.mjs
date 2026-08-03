import assert from "node:assert/strict";

import {
  buildFirewallCluster, firewallClusterCandidates, firewallClusterForDevice,
  firewallClusterModeLabel, firewallClusterRole,
} from "./static/js/firewall-clusters.js";

const topology = {
  devices: [
    { id: "fw1", name: "Firewall 1", category: "Firewall" },
    { id: "fw2", name: "Firewall 2", category: "Firewall" },
    { id: "fw3", name: "Firewall 3", category: "Firewall" },
    { id: "sw1", name: "Switch", category: "Switch" },
  ],
  firewallClusters: [{
    id: "cluster-1", name: "EDGE HA", mode: "ActivePassive",
    deviceIds: ["fw1", "fw2"], activeDeviceId: "fw1", notes: "",
  }],
};

assert.equal(firewallClusterForDevice(topology, "fw2").id, "cluster-1");
assert.equal(firewallClusterForDevice(topology, "fw3"), null);
assert.equal(firewallClusterModeLabel("ActiveActive"), "Active / active");
assert.equal(firewallClusterRole(topology.firewallClusters[0], "fw1"), "ACTIVE");
assert.equal(firewallClusterRole(topology.firewallClusters[0], "fw2"), "PASSIVE");

const candidates = firewallClusterCandidates(topology);
assert.equal(candidates.length, 3);
assert.equal(candidates.find(({ device }) => device.id === "fw1").available, false);
assert.equal(firewallClusterCandidates(topology, "cluster-1").every(({ available }) => available), true);

const activePassive = buildFirewallCluster(null, {
  name: " EDGE HA ", mode: "ActivePassive", deviceIds: ["fw1", "fw2", "fw2"], activeDeviceId: "fw1", notes: " peer pair ",
});
assert.deepEqual(activePassive.deviceIds, ["fw1", "fw2"]);
assert.equal(activePassive.activeDeviceId, "fw1");
assert.equal(activePassive.notes, "peer pair");
const activeActive = buildFirewallCluster(activePassive, {
  name: "EDGE HA", mode: "ActiveActive", deviceIds: ["fw1", "fw2", "fw3"], activeDeviceId: "fw1", notes: "",
});
assert.equal(activeActive.activeDeviceId, "");
assert.equal(firewallClusterRole(activeActive, "fw3"), "ACTIVE");
assert.throws(() => buildFirewallCluster(null, {
  name: "EDGE", mode: "ActivePassive", deviceIds: ["fw1", "fw2"], activeDeviceId: "fw3",
}), /active firewall/i);

console.log("firewall cluster checks passed");
