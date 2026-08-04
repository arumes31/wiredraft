export const PatchPanelPortCounts = Object.freeze([12, 24, 48, 96]);
export const LinkEndpointSide = Object.freeze({ FRONT: "front", REAR: "rear" });
export const RearPanelLinkVisual = Object.freeze({
  color: "#f0b35a",
  opacity: .46,
  strokeWidth: 1.5,
  casingOpacity: .28,
  casingWidth: 3,
  dash: Object.freeze([11, 6]),
});

export function endpointSide(link, endpoint) {
  return String(link?.[`${endpoint}Side`] || LinkEndpointSide.FRONT).toLowerCase();
}

export function isRearPanelLink(link) {
  return endpointSide(link, "source") === LinkEndpointSide.REAR &&
    endpointSide(link, "target") === LinkEndpointSide.REAR;
}

export function isPortSideOccupied(topology, portID, side = LinkEndpointSide.FRONT) {
  return (topology?.links || []).some((link) =>
    (link.sourcePortId === portID && endpointSide(link, "source") === side) ||
    (link.targetPortId === portID && endpointSide(link, "target") === side));
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

  const links = sourcePorts.map((sourcePort, index) => ({
    id: "", sourceDeviceId: source.id, sourcePortId: sourcePort.id,
    sourceSide: LinkEndpointSide.REAR,
    targetDeviceId: target.id, targetPortId: targetPorts[index].id,
    targetSide: LinkEndpointSide.REAR,
    cableType: panelCableType(source, sourcePort), vlanIds: [], primaryVlan: 0,
    notes: `Panel rear map ${source.name} ${sourcePort.label} ↔ ${target.name} ${targetPorts[index].label}`,
  }));
  return { source, target, sourcePorts, targetPorts, targetEnd, links };
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
