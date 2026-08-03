export const SwitchSystemModes = Object.freeze([
  { value: "Stack", label: "Generic stack" },
  { value: "VSF", label: "Aruba VSF" },
  { value: "MCLAG", label: "Fortinet MC-LAG" },
  { value: "StackWise", label: "Cisco StackWise" },
  { value: "VSS", label: "Cisco VSS" },
  { value: "VirtualChassis", label: "Juniper Virtual Chassis" },
  { value: "IRF", label: "HPE / H3C IRF" },
  { value: "Custom", label: "Custom logical system" },
]);

const labels = new Map(SwitchSystemModes.map((mode) => [mode.value, mode.label]));

export function switchSystemModeLabel(mode) {
  return labels.get(mode) || mode || "Logical system";
}

export function switchSystemForDevice(topology, deviceID) {
  return (topology?.switchSystems || []).find((system) => system.deviceIds?.includes(deviceID)) || null;
}

export function logicalDeviceCount(topology) {
  const devices = topology?.devices || [];
  const deviceIDs = new Set(devices.map((device) => device.id));
  const grouped = new Set();
  let logicalSystems = 0;
  for (const system of topology?.switchSystems || []) {
    const members = [...new Set(system.deviceIds || [])].filter((deviceID) => deviceIDs.has(deviceID));
    if (members.length < 2) continue;
    logicalSystems += 1;
    for (const deviceID of members) grouped.add(deviceID);
  }
  for (const cluster of topology?.firewallClusters || []) {
    const members = [...new Set(cluster.deviceIds || [])].filter((deviceID) => deviceIDs.has(deviceID));
    if (members.length < 2) continue;
    logicalSystems += 1;
    for (const deviceID of members) grouped.add(deviceID);
  }
  return devices.length - grouped.size + logicalSystems;
}

export function switchSystemCandidates(topology, editedSystemID = "") {
  return (topology?.devices || [])
    .filter((device) => device.category === "Switch")
    .map((device) => {
      const membership = switchSystemForDevice(topology, device.id);
      return {
        device,
        membership,
        available: !membership || membership.id === editedSystemID,
      };
    });
}

export function buildSwitchSystem(existing, input) {
  const deviceIds = [...new Set(input.deviceIds || [])];
  if (deviceIds.length < 2) throw new Error("Select at least two physical switches");
  const name = String(input.name || "").trim();
  if (!name) throw new Error("Enter a logical system name");
  if (!labels.has(input.mode)) throw new Error("Select a supported switch-system technology");
  return {
    id: existing?.id || "",
    name,
    mode: input.mode,
    deviceIds,
    notes: String(input.notes || "").trim(),
  };
}

export function switchSystemAccent(mode) {
  if (mode === "MCLAG" || mode === "VSS") return "#f0b35a";
  if (mode === "Custom") return "#a98dea";
  return "#42d9c8";
}
