const CONFIGURABLE_MODES = new Set(["Access", "Trunk", "Hybrid"]);

export function normalizeLinkConfiguration(input) {
  const mode = CONFIGURABLE_MODES.has(input?.mode) ? input.mode : "Access";
  const nativeVlan = Number(input?.nativeVlan || 0);
  const allowedVlans = mode === "Access" ? [] : [...new Set((input?.allowedVlans || [])
    .map(Number)
    .filter((vlanID) => vlanID > 0 && vlanID !== nativeVlan))].sort((left, right) => left - right);
  return { mode, nativeVlan, allowedVlans };
}

export function defaultLinkConfiguration(topology, link, sourcePort, targetPort) {
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

export function isLinkConfigurationSynchronized(link, sourcePort, targetPort, configuration) {
  if (!link || !sourcePort || !targetPort) return false;
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
