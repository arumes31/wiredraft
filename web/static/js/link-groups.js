import { isPhysicalOnlyPort } from "./link-configuration.js";

export const LinkGroupMode = Object.freeze({
  TRUNK: "Trunk",
  LACP: "LACP",
  MCLAG: "MCLAG",
  FAILOVER: "Failover",
});

export function groupForLink(topology, linkID) {
  return (topology?.linkGroups || []).find((group) => group.linkIds.includes(linkID)) || null;
}

/** Plan a complete group merge while rejecting missing, rear or mixed-media endpoints. */
export function planLinkGroup(topology, sourceLinkID, targetLinkID, input) {
  if (!sourceLinkID || !targetLinkID || sourceLinkID === targetLinkID) {
    throw new Error("Choose two different cables");
  }
  const linksByID = new Map((topology?.links || []).map((link) => [link.id, link]));
  const linkIDs = new Set(linksByID.keys());
  if (!linkIDs.has(sourceLinkID) || !linkIDs.has(targetLinkID)) {
    throw new Error("A selected cable no longer exists");
  }
  const sourceGroup = groupForLink(topology, sourceLinkID);
  const targetGroup = groupForLink(topology, targetLinkID);
  const memberIDs = new Set([sourceLinkID, targetLinkID]);
  for (const linkID of sourceGroup?.linkIds || []) memberIDs.add(linkID);
  for (const linkID of targetGroup?.linkIds || []) memberIDs.add(linkID);
  validateGroupMembers(topology, linksByID, memberIDs);

  const retained = sourceGroup || targetGroup;
  let primaryLinkID = "";
  if (input.mode === LinkGroupMode.FAILOVER) {
    primaryLinkID = String(input.primaryLinkId || retained?.primaryLinkId || sourceLinkID);
    if (!memberIDs.has(primaryLinkID)) throw new Error("Choose a primary cable from this failover group");
  }
  return {
    action: retained ? "update" : "create",
    deleteGroupIDs: sourceGroup && targetGroup && sourceGroup.id !== targetGroup.id ? [targetGroup.id] : [],
    group: {
      id: retained?.id || "",
      name: String(input.name || retained?.name || `${input.mode} BUNDLE`).trim(),
      mode: input.mode,
      linkIds: [...memberIDs],
      primaryLinkId: primaryLinkID,
      notes: String(input.notes || ""),
    },
  };
}

/** Inspect both endpoints of every merged member without changing saved topology records. */
function validateGroupMembers(topology, linksByID, memberIDs) {
  const portsByID = new Map((topology?.devices || []).flatMap(device => (device.ports || []).map(port => [port.id, port])));
  const endpointClasses = new Set();
  for (const linkID of memberIDs) {
    const link = linksByID.get(linkID);
    if (!link) throw new Error("A group cable no longer exists");
    if (link.sourceSide === "rear" || link.targetSide === "rear") {
      throw new Error("Rear panel mappings cannot join trunk, LACP, MC-LAG, or failover groups");
    }
    for (const portID of [link.sourcePortId, link.targetPortId]) {
      const port = portsByID.get(portID);
      if (!port) throw new Error("A cable endpoint no longer exists");
      endpointClasses.add(isPhysicalOnlyPort(port));
    }
  }
  if (endpointClasses.size > 1) throw new Error("Physical-only and Ethernet cables cannot share a link group");
}

export function defaultGroupInput(topology, sourceLinkID, targetLinkID) {
  const sourceGroup = groupForLink(topology, sourceLinkID);
  const targetGroup = groupForLink(topology, targetLinkID);
  const group = sourceGroup || targetGroup;
  const nextNumber = (topology?.linkGroups || []).length + 1;
  return {
    mode: group?.mode || LinkGroupMode.TRUNK,
    name: group?.name || `LINK GROUP ${nextNumber}`,
    notes: group?.notes || "",
    primaryLinkId: group?.primaryLinkId || sourceLinkID,
    memberLinkIds: [...new Set([
      sourceLinkID,
      targetLinkID,
      ...(sourceGroup?.linkIds || []),
      ...(targetGroup?.linkIds || []),
    ])],
  };
}
