export const ACTIVE_MAP_STORAGE_KEY = "netdiagram.activeMap";

export function preferredTopologyID(topologies, storedID) {
  const summaries = Array.isArray(topologies) ? topologies : [];
  if (storedID && summaries.some((topology) => topology.id === storedID)) return storedID;
  return summaries[0]?.id || "";
}

export function nextMapName(topologies, prefix = "NETWORK MAP") {
  const names = new Set((Array.isArray(topologies) ? topologies : []).map((topology) => String(topology.name || "").toUpperCase()));
  let sequence = 1;
  while (names.has(`${prefix} ${String(sequence).padStart(2, "0")}`)) sequence += 1;
  return `${prefix} ${String(sequence).padStart(2, "0")}`;
}
