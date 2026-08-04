export function summarizeLinkGroup(topology, group) {
  const linksByID = new Map((topology?.links || []).map((link) => [link.id, link]));
  const devicesByID = new Map((topology?.devices || []).map((device) => [device.id, device]));
  const links = group.linkIds.map((linkID) => linksByID.get(linkID)).filter(Boolean);
  const count = links.length;
  const mode = group.mode === "MCLAG" ? "MC-LAG" : group.mode.toUpperCase();
  const title = `${mode} · ${group.name}`;
  if (!links.length) return { title, detail: "NO ACTIVE MEMBERS" };

  if (group.mode === "Trunk") {
    const vlans = [...new Set(links.flatMap((link) =>
      link.vlanIds?.length ? link.vlanIds : [link.primaryVlan || 1]))].sort((left, right) => left - right);
    return { title, detail: `${count} LINKS · VLAN ${vlans.join("/") || "—"}` };
  }
  if (group.mode === "Failover") {
    const primary = linksByID.get(group.primaryLinkId) || links[0];
    return {
      title,
      detail: `${peerPair(primary, devicesByID)} · 1 PRIMARY + ${Math.max(0, count - 1)} BACKUP`,
    };
  }
  if (group.mode === "MCLAG") {
    const commonDeviceID = commonEndpoint(links);
    if (commonDeviceID) {
      const peerIDs = [...new Set(links.map((link) =>
        link.sourceDeviceId === commonDeviceID ? link.targetDeviceId : link.sourceDeviceId))];
      const common = shortName(devicesByID.get(commonDeviceID)?.name);
      const peers = peerIDs.map((id) => shortName(devicesByID.get(id)?.name)).join(" + ");
      return { title, detail: `${common} ↔ ${peers} · ${count} LINKS` };
    }
    const deviceCount = new Set(links.flatMap((link) => [link.sourceDeviceId, link.targetDeviceId])).size;
    return { title, detail: `${deviceCount} DEVICES · ${count} LINKS` };
  }
  return { title, detail: `${peerPair(links[0], devicesByID)} · ${count} LINKS` };
}

export function groupAccent(mode) {
  if (mode === "Trunk") return "#55a7ff";
  if (mode === "MCLAG") return "#f0b35a";
  if (mode === "Failover") return "#d99b55";
  return "#42d9c8";
}

export function describeLinkGroupMembers(topology, group, selectedLinkID = "") {
  const devicesByID = new Map((topology?.devices || []).map((device) => [device.id, device]));
  const linksByID = new Map((topology?.links || []).map((link) => [link.id, link]));
  let backupNumber = 0;

  return (group?.linkIds || []).flatMap((linkID, index) => {
    const link = linksByID.get(linkID);
    if (!link) return [];

    let role = `MEMBER ${index + 1}`;
    if (group.mode === "Failover") {
      if (link.id === group.primaryLinkId) role = "PRIMARY";
      else {
        backupNumber += 1;
        role = `BACKUP ${backupNumber}`;
      }
    }

    return [{
      id: link.id,
      role,
      selected: link.id === selectedLinkID,
      source: describeEndpoint(devicesByID.get(link.sourceDeviceId), link.sourcePortId),
      target: describeEndpoint(devicesByID.get(link.targetDeviceId), link.targetPortId),
    }];
  });
}

export function peerLinkIDs(topology, selectedLinkID) {
  if (!selectedLinkID) return new Set();
  const group = (topology?.linkGroups || []).find((candidate) => candidate.linkIds.includes(selectedLinkID));
  return new Set((group?.linkIds || []).filter((linkID) => linkID !== selectedLinkID));
}

export function linkGroupPortBadges(topology) {
  const linksByID = new Map((topology?.links || []).map((link) => [link.id, link]));
  const badges = new Map();
  for (const group of topology?.linkGroups || []) {
    if (group.mode !== "Failover") continue;
    for (const linkID of group.linkIds || []) {
      const link = linksByID.get(linkID);
      if (!link) continue;
      const role = link.id === group.primaryLinkId ? "P" : "B";
      const badge = {
        role,
        color: role === "P" ? "#42d9c8" : "#f0b35a",
        groupId: group.id,
        linkId: link.id,
      };
      badges.set(link.sourcePortId, { ...badge, endpoint: "source" });
      badges.set(link.targetPortId, { ...badge, endpoint: "target" });
    }
  }
  return badges;
}

function commonEndpoint(links) {
  const first = links[0];
  return [first.sourceDeviceId, first.targetDeviceId].find((deviceID) =>
    links.every((link) => link.sourceDeviceId === deviceID || link.targetDeviceId === deviceID)) || "";
}

function peerPair(link, devicesByID) {
  return `${shortName(devicesByID.get(link.sourceDeviceId)?.name)} ↔ ${shortName(devicesByID.get(link.targetDeviceId)?.name)}`;
}

function shortName(name) {
  const value = String(name || "UNKNOWN");
  return value.length > 18 ? `${value.slice(0, 16)}…` : value;
}

function describeEndpoint(device, portID) {
  const port = (device?.ports || []).find((candidate) => candidate.id === portID);
  return {
    device: device?.name || "Unknown device",
    port: port?.label || "Unknown port",
  };
}
