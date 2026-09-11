const CONFIGURABLE_MODES = new Set(["Access", "Trunk", "Hybrid"]);
const PHYSICAL_ONLY_TYPES = new Set(["SAS_MINI_HD_12G", "SAS_MINI_6G", "FC_SFP_16G", "Power"]);

/** Identify storage and power endpoints whose settings are not Ethernet VLAN profiles. */
export function isPhysicalOnlyPort(port) {
  return PHYSICAL_ONLY_TYPES.has(port?.type);
}

/** Protect every member when a saved group includes a physical-only endpoint. */
export function isPhysicalOnlyLinkScope(topology, selectedLinkID) {
  const ports = new Map((topology?.devices || []).flatMap(device => (device.ports || []).map(port => [port.id, port])));
  return linkConfigurationScope(topology, selectedLinkID).some(link =>
    isPhysicalOnlyPort(ports.get(link.sourcePortId)) || isPhysicalOnlyPort(ports.get(link.targetPortId)));
}

export function normalizeLinkConfiguration(input) {
  const mode = CONFIGURABLE_MODES.has(input?.mode) ? input.mode : "Access";
  const nativeVlan = Number(input?.nativeVlan || 0);
  const allowedVlans = mode === "Access" ? [] : [...new Set((input?.allowedVlans || [])
    .map(Number)
    .filter((vlanID) => vlanID > 0 && vlanID !== nativeVlan))].sort((left, right) => left - right);
  return { mode, nativeVlan, allowedVlans };
}

/** Infer an Ethernet profile; physical storage and power endpoints have none. */
export function defaultLinkConfiguration(topology, link, sourcePort, targetPort) {
  if (isPhysicalOnlyPort(sourcePort) || isPhysicalOnlyPort(targetPort)) return null;
  const nativeVlan = Number(link?.primaryVlan || sourcePort?.nativeVlan || targetPort?.nativeVlan || topology?.vlans?.[0]?.id || 1);
  const channels = (link?.vlanIds || []).map(Number).filter(Boolean);
  const endpointsAgree = sourcePort?.mode === targetPort?.mode && CONFIGURABLE_MODES.has(sourcePort?.mode);
  const hasTaggedChannels = channels.some((vlanID) => vlanID !== nativeVlan);
  const mode = hasTaggedChannels
    ? endpointsAgree && sourcePort.mode !== "Access" ? sourcePort.mode : "Trunk"
    : endpointsAgree ? sourcePort.mode : "Access";
  return normalizeLinkConfiguration({
    mode,
    nativeVlan,
    allowedVlans: channels.filter((vlanID) => vlanID !== nativeVlan),
  });
}

/** Compare a real Ethernet profile without normalizing physical-only endpoints. */
export function isLinkConfigurationSynchronized(link, sourcePort, targetPort, configuration) {
  if (!link || !sourcePort || !targetPort || !configuration || isPhysicalOnlyPort(sourcePort) || isPhysicalOnlyPort(targetPort)) return false;
  const expected = normalizeLinkConfiguration(configuration);
  const expectedChannels = [expected.nativeVlan, ...expected.allowedVlans];
  const endpointMatches = (port) => {
    const actual = normalizeLinkConfiguration(port);
    return actual.mode === expected.mode &&
      actual.nativeVlan === expected.nativeVlan &&
      sameVLANs(actual.allowedVlans, expected.allowedVlans);
  };
  return endpointMatches(sourcePort) && endpointMatches(targetPort) &&
    Number(link.primaryVlan) === expected.nativeVlan &&
    sameVLANs(link.vlanIds || [], expectedChannels);
}

export function linkConfigurationScope(topology, selectedLinkID) {
  const linksByID = new Map((topology?.links || []).map((link) => [link.id, link]));
  const group = (topology?.linkGroups || []).find((candidate) =>
    (candidate.linkIds || []).includes(selectedLinkID));
  const linkIDs = group?.linkIds?.length ? group.linkIds : [selectedLinkID];
  return linkIDs.map((linkID) => linksByID.get(linkID)).filter(Boolean);
}

export function isLinkConfigurationScopeSynchronized(topology, selectedLinkID, configuration) {
  const portsByID = new Map((topology?.devices || []).flatMap((device) =>
    (device.ports || []).map((port) => [port.id, port])));
  const links = linkConfigurationScope(topology, selectedLinkID);
  return links.length > 0 && links.every((link) => isLinkConfigurationSynchronized(
    link,
    portsByID.get(link.sourcePortId),
    portsByID.get(link.targetPortId),
    configuration,
  ));
}

function sameVLANs(left, right) {
  const normalized = (items) => [...new Set((items || []).map(Number))].sort((a, b) => a - b);
  const leftVLANs = normalized(left);
  const rightVLANs = normalized(right);
  return leftVLANs.length === rightVLANs.length && leftVLANs.every((vlanID, index) => vlanID === rightVLANs[index]);
}
