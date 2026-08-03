export const FirewallClusterModes = Object.freeze([
  { value: "ActivePassive", label: "Active / passive" },
  { value: "ActiveActive", label: "Active / active" },
]);

const labels = new Map(FirewallClusterModes.map((mode) => [mode.value, mode.label]));

export function firewallClusterModeLabel(mode) {
  return labels.get(mode) || mode || "Firewall cluster";
}

export function firewallClusterForDevice(topology, deviceID) {
  return (topology?.firewallClusters || []).find((cluster) => cluster.deviceIds?.includes(deviceID)) || null;
}

export function firewallClusterCandidates(topology, editedClusterID = "") {
  return (topology?.devices || [])
    .filter((device) => device.category === "Firewall")
    .map((device) => {
      const membership = firewallClusterForDevice(topology, device.id);
      return {
        device,
        membership,
        available: !membership || membership.id === editedClusterID,
      };
    });
}

export function firewallClusterRole(cluster, deviceID) {
  if (!cluster?.deviceIds?.includes(deviceID)) return "";
  if (cluster.mode === "ActiveActive") return "ACTIVE";
  return cluster.activeDeviceId === deviceID ? "ACTIVE" : "PASSIVE";
}

export function buildFirewallCluster(existing, input) {
  const deviceIds = [...new Set(input.deviceIds || [])];
  if (deviceIds.length < 2) throw new Error("Select at least two physical firewalls");
  const name = String(input.name || "").trim();
  if (!name) throw new Error("Enter a firewall cluster name");
  if (!labels.has(input.mode)) throw new Error("Select active/active or active/passive mode");
  const activeDeviceId = input.mode === "ActivePassive" ? String(input.activeDeviceId || "") : "";
  if (input.mode === "ActivePassive" && !deviceIds.includes(activeDeviceId)) {
    throw new Error("Select the active firewall from the cluster members");
  }
  return {
    id: existing?.id || "",
    name,
    mode: input.mode,
    deviceIds,
    activeDeviceId,
    notes: String(input.notes || "").trim(),
  };
}

export function firewallClusterAccent(cluster, deviceID = "") {
  if (cluster?.mode === "ActivePassive" && deviceID && cluster.activeDeviceId !== deviceID) return "#f0b35a";
  return "#42d9c8";
}
