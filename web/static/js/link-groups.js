export const LinkGroupMode = Object.freeze({
  TRUNK: "Trunk",
  LACP: "LACP",
  MCLAG: "MCLAG",
  FAILOVER: "Failover",
});

export function groupForLink(topology, linkID) {
  return (topology?.linkGroups || []).find((group) => group.linkIds.includes(linkID)) || null;
}

export function planLinkGroup(topology, sourceLinkID, targetLinkID, input) {
  if (!sourceLinkID || !targetLinkID || sourceLinkID === targetLinkID) {
    throw new Error("Choose two different cables");
  }
  const linkIDs = new Set((topology?.links || []).map((link) => link.id));
  if (!linkIDs.has(sourceLinkID) || !linkIDs.has(targetLinkID)) {
    throw new Error("A selected cable no longer exists");
  }
  const sourceGroup = groupForLink(topology, sourceLinkID);
  const targetGroup = groupForLink(topology, targetLinkID);
  const memberIDs = new Set([sourceLinkID, targetLinkID]);
  for (const linkID of sourceGroup?.linkIds || []) memberIDs.add(linkID);
  for (const linkID of targetGroup?.linkIds || []) memberIDs.add(linkID);

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
