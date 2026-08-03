export const PatchPanelPortCounts = Object.freeze([12, 24, 48, 96]);

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
  const occupied = new Set((topology.links || []).flatMap((link) => [link.sourcePortId, link.targetPortId]));
  return [...device.ports]
    .sort((left, right) => left.portIndex - right.portIndex)
    .map((port) => ({ ...port, occupied: occupied.has(port.id) }));
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

  const occupied = new Map();
  for (const link of topology.links || []) {
    occupied.set(link.sourcePortId, link.id);
    occupied.set(link.targetPortId, link.id);
  }
  const blocked = [...sourcePorts, ...targetPorts].filter((port) => occupied.has(port.id));
  if (blocked.length) {
    const labels = blocked.slice(0, 4).map((port) => `${port.deviceId === source.id ? source.name : target.name} / ${port.label}`);
    throw new Error(`Already connected: ${labels.join(", ")}${blocked.length > 4 ? ` +${blocked.length - 4} more` : ""}`);
  }

  const links = sourcePorts.map((sourcePort, index) => ({
    id: "", sourceDeviceId: source.id, sourcePortId: sourcePort.id,
    targetDeviceId: target.id, targetPortId: targetPorts[index].id,
    cableType: "CAT6A", vlanIds: [], primaryVlan: 0,
    notes: `Patch range ${source.name} ${sourcePort.label} ↔ ${target.name} ${targetPorts[index].label}`,
  }));
  return { source, target, sourcePorts, targetPorts, targetEnd, links };
}

function orderedPorts(device) {
  return [...device.ports].sort((left, right) => left.portIndex - right.portIndex);
}

function positiveInteger(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw new Error(`${label} must be a positive whole number`);
  return number;
}
