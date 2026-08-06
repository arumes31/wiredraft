export const PatchPanelPortCounts = Object.freeze([12, 24, 48, 96]);
export const LinkEndpointSide = Object.freeze({ FRONT: "front", REAR: "rear" });
export const RearChannelType = Object.freeze({
  INDEPENDENT: "independent", AUTO: "auto", TUBE: "tube", DISCRETE: "discrete",
});
export const RearChannelGroupSizes = Object.freeze([1, 2, 4, 6, 8, 12, 24]);
export const RearPanelLinkVisual = Object.freeze({
  color: "#f0b35a",
  opacity: .75,
  strokeWidth: 1.5,
  casingOpacity: .38,
  casingWidth: 3,
  dash: Object.freeze([6, 4]),
});

export function endpointSide(link, endpoint) {
  return String(link?.[`${endpoint}Side`] || LinkEndpointSide.FRONT).toLowerCase();
}

export function isRearPanelLink(link) {
  return endpointSide(link, "source") === LinkEndpointSide.REAR ||
    endpointSide(link, "target") === LinkEndpointSide.REAR;
}

export function isPortSideOccupied(topology, portID, side = LinkEndpointSide.FRONT) {
  return (topology?.links || []).some((link) =>
    (link.sourcePortId === portID && endpointSide(link, "source") === side) ||
    (link.targetPortId === portID && endpointSide(link, "target") === side));
}

// Build connected physical paths across the front and rear termination planes of
// each patch-panel jack. The returned component Sets are shared by every member
// so pointer hover can expand a link focus without walking the topology per frame.
export function patchPanelPathIndex(topology) {
  const links = topology?.links || [];
  const panelPortIDs = new Set((topology?.devices || [])
    .filter((device) => device.category === "PatchPanel")
    .flatMap((device) => (device.ports || []).map((port) => port.id)));
  if (!links.length || !panelPortIDs.size) return new Map();

  const linksByTermination = new Map();
  const adjacency = new Map(links.map((link) => [link.id, new Set()]));
  for (const link of links) {
    for (const endpoint of ["source", "target"]) {
      const portID = link[`${endpoint}PortId`];
      if (!panelPortIDs.has(portID)) continue;
      addMapSetValue(linksByTermination, `${portID}:${endpointSide(link, endpoint)}`, link.id);
    }
  }

  for (const portID of panelPortIDs) {
    const frontLinks = linksByTermination.get(`${portID}:${LinkEndpointSide.FRONT}`) || [];
    const rearLinks = linksByTermination.get(`${portID}:${LinkEndpointSide.REAR}`) || [];
    for (const frontLinkID of frontLinks) {
      for (const rearLinkID of rearLinks) {
        if (frontLinkID === rearLinkID) continue;
        adjacency.get(frontLinkID)?.add(rearLinkID);
        adjacency.get(rearLinkID)?.add(frontLinkID);
      }
    }
  }

  const pathByLinkID = new Map();
  const visited = new Set();
  for (const link of links) {
    if (visited.has(link.id)) continue;
    const component = new Set();
    const pending = [link.id];
    while (pending.length) {
      const linkID = pending.pop();
      if (visited.has(linkID)) continue;
      visited.add(linkID);
      component.add(linkID);
      for (const adjacentLinkID of adjacency.get(linkID) || []) pending.push(adjacentLinkID);
    }
    if (component.size < 2) continue;
    for (const linkID of component) pathByLinkID.set(linkID, component);
  }
  return pathByLinkID;
}

export function instantiatePatchPanel(input, position) {
  const portCount = Number(input.portCount);
  if (!PatchPanelPortCounts.includes(portCount)) {
    throw new Error("Patch panel port count must be 12, 24, 48, or 96");
  }
  const units = portCount > 48 ? 2 : 1;
  const panel = {
    id: "", name: String(input.name || "PATCH PANEL"), category: "PatchPanel",
    model: `${portCount}-port Cat6A patch panel`, positionX: position.x, positionY: position.y,
    faceplate: {
      unitsU: units, totalPorts: portCount, rows: 1, portSpacingX: 23, portSpacingY: 29,
      vendorColor: String(input.color || "#262d2f"), hasSfpSlots: false,
      vendor: "Generic Patch", layout: "generic-patch-panel",
    },
    ports: Array.from({ length: portCount }, (_, index) => ({
      id: "", deviceId: "", portIndex: index + 1, label: String(index + 1),
      type: "RJ45_10G", mode: "Unconfigured", nativeVlan: 0, allowedVlans: [],
      speedMbps: 10000, isPoe: false, status: "down", group: "PASSIVE COPPER",
    })),
  };
  const rows = portCount <= 24 ? 1 : portCount <= 48 ? 2 : 4;
  const columns = Math.ceil(portCount / rows);
  panel.faceplate.rows = rows;
  for (let index = 0; index < panel.ports.length; index += 1) {
    const row = Math.floor(index / columns);
    const column = index % columns;
    panel.ports[index].faceplateX = columns === 1 ? .61 : .29 + .66 * column / (columns - 1);
    panel.ports[index].faceplateY = rows === 1 ? .54 : .2 + .6 * row / (rows - 1);
  }
  return panel;
}

export function patchPanelDevices(topology) {
  return (topology?.devices || []).filter((device) => device.category === "PatchPanel");
}

export function panelMapAvailability(topology) {
  const panelCount = patchPanelDevices(topology).length;
  if (panelCount === 0) {
    return {
      ready: false,
      panelCount,
      message: "No patch panels are installed. Add two with + PANEL before opening Panel Map.",
    };
  }
  if (panelCount === 1) {
    return {
      ready: false,
      panelCount,
      message: "Only one patch panel is installed. Add one more with + PANEL before opening Panel Map.",
    };
  }
  return { ready: true, panelCount, message: "Open Panel Map" };
}

export function availablePatchPanelPorts(topology, deviceID) {
  const device = patchPanelDevices(topology).find((candidate) => candidate.id === deviceID);
  if (!device) return [];
  return [...device.ports]
    .sort((left, right) => left.portIndex - right.portIndex)
    .map((port) => ({
      ...port,
      occupied: isPortSideOccupied(topology, port.id, LinkEndpointSide.REAR),
      frontOccupied: isPortSideOccupied(topology, port.id, LinkEndpointSide.FRONT),
      rearOccupied: isPortSideOccupied(topology, port.id, LinkEndpointSide.REAR),
    }));
}

export function planPatchPanelMapping(topology, input) {
  const source = patchPanelDevices(topology).find((device) => device.id === input.sourceDeviceId);
  const target = patchPanelDevices(topology).find((device) => device.id === input.targetDeviceId);
  if (!source || !target) throw new Error("Select two installed patch panels");
  if (source.id === target.id) throw new Error("Source and target patch panels must be different");

  const sourceStart = positiveInteger(input.sourceStart, "Source start port");
  const sourceEnd = positiveInteger(input.sourceEnd, "Source end port");
  const targetStart = positiveInteger(input.targetStart, "Target start port");
  if (sourceEnd < sourceStart) throw new Error("Source end port must not be before the start port");
  const count = sourceEnd - sourceStart + 1;
  const targetEnd = targetStart + count - 1;
  const sourcePorts = orderedPorts(source).slice(sourceStart - 1, sourceEnd);
  const targetPorts = orderedPorts(target).slice(targetStart - 1, targetEnd);
  if (sourcePorts.length !== count) throw new Error(`${source.name} does not have ports ${sourceStart}–${sourceEnd}`);
  if (targetPorts.length !== count) throw new Error(`${target.name} does not have ports ${targetStart}–${targetEnd}`);

  const occupiedRear = new Map();
  for (const link of topology.links || []) {
    if (endpointSide(link, "source") === LinkEndpointSide.REAR) occupiedRear.set(link.sourcePortId, link.id);
    if (endpointSide(link, "target") === LinkEndpointSide.REAR) occupiedRear.set(link.targetPortId, link.id);
  }
  const blocked = [...sourcePorts, ...targetPorts].filter((port) => occupiedRear.has(port.id));
  if (blocked.length) {
    const labels = blocked.slice(0, 4).map((port) => `${port.deviceId === source.id ? source.name : target.name} / ${port.label}`);
    throw new Error(`Rear already mapped: ${labels.join(", ")}${blocked.length > 4 ? ` +${blocked.length - 4} more` : ""}`);
  }

  const incompatible = sourcePorts.find((port, index) => port.type !== targetPorts[index].type);
  if (incompatible) throw new Error("Rear ranges must use matching connector types");

  const channelPlan = rearChannelPlan(input, source, sourcePorts[0], sourceStart, sourceEnd);

  const links = sourcePorts.map((sourcePort, index) => ({
    id: "", sourceDeviceId: source.id, sourcePortId: sourcePort.id,
    sourceSide: LinkEndpointSide.REAR,
    targetDeviceId: target.id, targetPortId: targetPorts[index].id,
    targetSide: LinkEndpointSide.REAR,
    cableType: panelCableType(source, sourcePort), vlanIds: [], primaryVlan: 0,
    ...(channelPlan.metadataByLink[index] || {}),
    notes: `Panel rear map ${source.name} ${sourcePort.label} ↔ ${target.name} ${targetPorts[index].label}`,
  }));
  return { source, target, sourcePorts, targetPorts, targetEnd, links, channels: channelPlan.channels };
}

export function planRearPanelLinkUpdate(topology, linkID, panelID, input) {
  const link = (topology?.links || []).find((candidate) => candidate.id === linkID);
  if (!link || endpointSide(link, "source") !== LinkEndpointSide.REAR || endpointSide(link, "target") !== LinkEndpointSide.REAR) {
    throw new Error("Select an existing rear panel mapping");
  }

  const panels = patchPanelDevices(topology);
  const panel = panels.find((candidate) => candidate.id === panelID);
  const panelIsSource = link.sourceDeviceId === panelID;
  const panelIsTarget = link.targetDeviceId === panelID;
  if (!panel || (!panelIsSource && !panelIsTarget)) throw new Error("The selected panel is not part of this rear mapping");

  const peer = panels.find((candidate) => candidate.id === input.peerDeviceId);
  if (!peer) throw new Error("Select a remote patch panel");
  if (peer.id === panel.id) throw new Error("Rear mappings must connect two different patch panels");
  const panelPort = orderedPorts(panel).find((port) => port.id === input.panelPortId);
  const peerPort = orderedPorts(peer).find((port) => port.id === input.peerPortId);
  if (!panelPort) throw new Error(`Select a rear port on ${panel.name}`);
  if (!peerPort) throw new Error(`Select a rear port on ${peer.name}`);
  if (panelPort.type !== peerPort.type) throw new Error("Rear mappings must use matching connector types");

  const occupiedRear = new Set();
  for (const candidate of topology.links || []) {
    if (candidate.id === link.id) continue;
    if (endpointSide(candidate, "source") === LinkEndpointSide.REAR) occupiedRear.add(candidate.sourcePortId);
    if (endpointSide(candidate, "target") === LinkEndpointSide.REAR) occupiedRear.add(candidate.targetPortId);
  }
  const blocked = [panelPort, peerPort].filter((port) => occupiedRear.has(port.id));
  if (blocked.length) {
    const names = blocked.map((port) => `${port.deviceId === panel.id ? panel.name : peer.name} / ${port.label}`);
    throw new Error(`Rear already mapped: ${names.join(", ")}`);
  }

  const next = { ...link, sourceSide: LinkEndpointSide.REAR, targetSide: LinkEndpointSide.REAR };
  if (panelIsSource) {
    next.sourceDeviceId = panel.id;
    next.sourcePortId = panelPort.id;
    next.targetDeviceId = peer.id;
    next.targetPortId = peerPort.id;
  } else {
    next.sourceDeviceId = peer.id;
    next.sourcePortId = peerPort.id;
    next.targetDeviceId = panel.id;
    next.targetPortId = panelPort.id;
  }
  next.cableType = panelCableType(panel, panelPort);
  const source = panels.find((candidate) => candidate.id === next.sourceDeviceId);
  const target = panels.find((candidate) => candidate.id === next.targetDeviceId);
  const sourcePort = source?.ports.find((port) => port.id === next.sourcePortId);
  const targetPort = target?.ports.find((port) => port.id === next.targetPortId);
  next.notes = `Panel rear map ${source?.name || "Unknown"} ${sourcePort?.label || "—"} ↔ ${target?.name || "Unknown"} ${targetPort?.label || "—"}`;

  const originalPair = [link.sourceDeviceId, link.targetDeviceId].sort().join("\u0000");
  const nextPair = [next.sourceDeviceId, next.targetDeviceId].sort().join("\u0000");
  const pairChanged = originalPair !== nextPair;
  const requestedChannelType = String(input.rearChannelType || "").trim().toLowerCase();
  if (!requestedChannelType) {
    if (pairChanged) clearRearChannel(next);
    return next;
  }
  if (requestedChannelType === RearChannelType.INDEPENDENT) {
    clearRearChannel(next);
    return next;
  }
  if (![RearChannelType.TUBE, RearChannelType.DISCRETE].includes(requestedChannelType)) {
    throw new Error("Rear channel type must be independent, tube, or discrete bundle");
  }

  const requestedChannelName = String(input.rearChannelName || "").trim();
  if (!requestedChannelName) throw new Error("Rear channel name is required for tube and discrete runs");
  if (requestedChannelName.length > 120) throw new Error("Rear channel name must not exceed 120 characters");
  const existingMembers = link.rearChannelId
    ? (topology.links || []).filter((candidate) => candidate.rearChannelId === link.rearChannelId)
    : [];
  const metadataUnchanged = !pairChanged && link.rearChannelId &&
    link.rearChannelType === requestedChannelType &&
    String(link.rearChannelName || "").trim() === requestedChannelName;
  const canReuseChannelID = !pairChanged && link.rearChannelId && existingMembers.length === 1;
  const rearChannelID = metadataUnchanged || canReuseChannelID
    ? link.rearChannelId
    : String(input.rearChannelId || "").trim().toLowerCase();
  if (!isVersion4UUID(rearChannelID)) throw new Error("Rear channel identifier must be a version 4 UUID");
  next.rearChannelId = rearChannelID;
  next.rearChannelName = requestedChannelName;
  next.rearChannelType = requestedChannelType;
  return next;
}

function clearRearChannel(link) {
  delete link.rearChannelId;
  delete link.rearChannelName;
  delete link.rearChannelType;
}

function rearChannelPlan(input, panel, port, sourceStart, sourceEnd) {
  const requestedType = String(input.rearChannelType || "").trim().toLowerCase();
  const linkCount = sourceEnd - sourceStart + 1;
  if (!requestedType) return { channels: [], metadataByLink: Array(linkCount).fill(null) };
  if (![RearChannelType.AUTO, RearChannelType.TUBE, RearChannelType.DISCRETE].includes(requestedType)) {
    throw new Error("Rear channel type must be automatic, tube, or discrete bundle");
  }
  const cableType = panelCableType(panel, port);
  const rearChannelType = requestedType === RearChannelType.AUTO
    ? cableType === "FIBER" ? RearChannelType.TUBE : RearChannelType.DISCRETE
    : requestedType;
  const baseChannelID = String(input.rearChannelId || "").trim().toLowerCase();
  if (!baseChannelID) throw new Error("Rear channel identifier is missing");
  if (!isVersion4UUID(baseChannelID)) throw new Error("Rear channel identifier must be a version 4 UUID");
  const defaultName = `${rearChannelType === RearChannelType.TUBE ? "TUBE" : "BUNDLE"} ${sourceStart}–${sourceEnd}`;
  const baseChannelName = String(input.rearChannelName || defaultName).trim();
  if (baseChannelName.length > 120) throw new Error("Rear channel name must not exceed 120 characters");
  const groupSize = rearChannelGroupSize(input.rearChannelGroupSize, linkCount);
  const channelCount = Math.ceil(linkCount / groupSize);
  const channels = Array.from({ length: channelCount }, (_, groupIndex) => {
    const memberStartIndex = groupIndex * groupSize;
    const memberEndIndex = Math.min(linkCount, memberStartIndex + groupSize) - 1;
    const groupSourceStart = sourceStart + memberStartIndex;
    const groupSourceEnd = sourceStart + memberEndIndex;
    const suffix = channelCount > 1
      ? ` · ${String(groupIndex + 1).padStart(2, "0")}/${String(channelCount).padStart(2, "0")} · P${groupSourceStart}–${groupSourceEnd}`
      : "";
    const rearChannelName = `${baseChannelName.slice(0, Math.max(0, 120 - suffix.length))}${suffix}`;
    return {
      rearChannelId: derivedChannelUUID(baseChannelID, groupIndex),
      rearChannelName,
      rearChannelType,
      memberStartIndex,
      memberEndIndex,
      sourceStart: groupSourceStart,
      sourceEnd: groupSourceEnd,
      memberCount: memberEndIndex - memberStartIndex + 1,
    };
  });
  const metadataByLink = Array.from({ length: linkCount }, (_, linkIndex) => {
    const channel = channels[Math.floor(linkIndex / groupSize)];
    return channel ? {
      rearChannelId: channel.rearChannelId,
      rearChannelName: channel.rearChannelName,
      rearChannelType: channel.rearChannelType,
    } : null;
  });
  return { channels, metadataByLink };
}

function rearChannelGroupSize(value, linkCount) {
  const normalized = String(value || "all").trim().toLowerCase();
  if (normalized === "all") return linkCount;
  const size = Number(normalized);
  if (!RearChannelGroupSizes.includes(size)) {
    throw new Error(`Tube grouping must be all selected runs or ${RearChannelGroupSizes.join(", ")} strands`);
  }
  return size;
}

function isVersion4UUID(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function derivedChannelUUID(baseUUID, offset) {
  if (!offset) return baseUUID;
  const parts = baseUUID.split("-");
  const suffix = (BigInt(`0x${parts[4]}`) + BigInt(offset)) % (1n << 48n);
  parts[4] = suffix.toString(16).padStart(12, "0");
  return parts.join("-");
}

function panelCableType(panel, port) {
  if (String(port.type).startsWith("FIBER_")) return "FIBER";
  const model = String(panel.model || "").toUpperCase();
  if (model.includes("CAT5E")) return "CAT5E";
  if (model.includes("CAT6A")) return "CAT6A";
  return "CAT6";
}

function orderedPorts(device) {
  return [...device.ports].sort((left, right) => left.portIndex - right.portIndex);
}

function positiveInteger(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw new Error(`${label} must be a positive whole number`);
  return number;
}

function addMapSetValue(map, key, value) {
  if (!map.has(key)) map.set(key, new Set());
  map.get(key).add(value);
}
