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

export function organizationLocationOptions(topologies = []) {
  const locationsByOrganization = new Map();
  for (const topology of topologies) {
    const organization = String(topology.organization || "").trim();
    const location = String(topology.location || "").trim();
    if (!organization || !location) continue;
    const locations = locationsByOrganization.get(organization) || new Set();
    locations.add(location);
    locationsByOrganization.set(organization, locations);
  }
  return [...locationsByOrganization.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([organization, locations]) => ({
      organization,
      locations: [...locations].sort((left, right) => left.localeCompare(right)),
    }));
}

export function topologyOptionLabel(topology) {
  const organization = String(topology?.organization || "").trim();
  const location = String(topology?.location || "").trim();
  const scope = organization && location ? `${organization} · ${location}` : "UNASSIGNED";
  return `${scope} / ${topology?.name || "Untitled topology"}`;
}
