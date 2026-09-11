/** Choose initial cable media and VLANs without changing either endpoint's saved configuration. */
export function defaultCableProperties(sourcePort, targetPort) {
  if (sourcePort.type === "POTS_RJ11" || targetPort.type === "POTS_RJ11") {
    return { cableType: "TELEPHONE", vlanIds: [], primaryVlan: 0 };
  }
  const sourceVLANs = carriedVLANs(sourcePort);
  const targetVLANs = carriedVLANs(targetPort);
  const shared = [...sourceVLANs].filter((id) => targetVLANs.has(id));
  const primary = shared[0] || sourcePort.nativeVlan || targetPort.nativeVlan || 1;
  return {
    cableType: sourcePort.type === "COAX_F" || targetPort.type === "COAX_F" ? "COAX" :
      /SFP|FIBER_/.test(sourcePort.type) || /SFP|FIBER_/.test(targetPort.type) ? "FIBER" : "CAT6A",
    vlanIds: shared.length ? shared : [primary], primaryVlan: primary,
  };
}

/** Exclude unconfigured endpoints from Ethernet VLAN intersection when creating ordinary cables. */
function carriedVLANs(port) {
  if (port.mode === "Unconfigured") return new Set();
  return new Set([port.nativeVlan, ...(port.allowedVlans || [])].filter(Boolean));
}
