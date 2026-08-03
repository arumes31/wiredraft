export const DEFAULT_VLAN_COLOR = "#75888b";

export function linkVLANPalette(topology, link) {
  const vlanColors = new Map((topology?.vlans || []).map((vlan) => [Number(vlan.id), vlan.colorHex]));
  const configuredVLANs = [...new Set((link?.vlanIds || []).map(Number).filter((vlanID) => vlanID > 0))]
    .sort((left, right) => left - right);
  const nativeVlanID = Number(link?.primaryVlan || configuredVLANs[0] || 0);
  const vlanIDs = nativeVlanID > 0
    ? [nativeVlanID, ...configuredVLANs.filter((vlanID) => vlanID !== nativeVlanID)]
    : configuredVLANs;
  const channels = (vlanIDs.length ? vlanIDs : [0]).map((vlanID) => ({
    id: vlanID,
    color: vlanColors.get(vlanID) || DEFAULT_VLAN_COLOR,
    isNative: vlanID === nativeVlanID,
  }));
  return {
    nativeVlanID,
    nativeColor: vlanColors.get(nativeVlanID) || channels[0].color,
    channels,
    isRainbow: channels.length > 1,
  };
}

export function vlanBandPattern(channelCount, channelIndex, time = 0) {
  const count = Math.max(1, Number(channelCount) || 1);
  const index = Math.max(0, Math.min(count - 1, Number(channelIndex) || 0));
  const bandLength = Math.max(2, Math.min(14, 84 / count));
  const cycleLength = bandLength * count;
  const motion = (Number(time) || 0) * .026;
  return {
    dash: count > 1 ? [bandLength, cycleLength - bandLength] : [],
    offset: -(motion + index * bandLength),
    bandLength,
    cycleLength,
  };
}
