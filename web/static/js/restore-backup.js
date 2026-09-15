export function parseTopologyBackup(text) {
  const topology = JSON.parse(text);
  if (!topology || !Array.isArray(topology.devices) || !Array.isArray(topology.links) || !Array.isArray(topology.vlans)) {
    throw new Error("The selected file is not a topology backup");
  }
  return topology;
}

/** Only the newly created map may be replaced or removed during restoration. */
export async function restoreAsNewMap(api, backup, metadata) {
  const created = await api.createTopology({ ...metadata, template: "blank" });
  try {
    return await api.replaceTopology({
      ...backup, ...metadata,
      id: created.id, revision: created.revision, createdAt: created.createdAt,
      organizationId: created.organizationId, organization: created.organization,
      photos: [], shareGrants: [],
    });
  } catch (error) {
    try {
      // Revision checking preserves a map if the restore succeeded but its response was lost.
      await api.deleteTopology(created.id, created.revision);
    } catch {
      throw new Error(`Restore could not be confirmed. Check the map list for "${created.name}" before retrying. ${error.message}`);
    }
    throw error;
  }
}
