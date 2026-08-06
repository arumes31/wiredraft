export const RACK_WIDTH = 750;
export const RACK_HEADER_HEIGHT = 64;
export const RACK_FOOTER_HEIGHT = 20;
export const RACK_DEVICE_INSET = 30;
export const RACK_UNIT_HEIGHT = 100;
export const RACK_MOUNTED_DEVICE_WIDTH = 690;
export const RACK_FACE_GAP = 90;
export const RackFace = Object.freeze({ FRONT: "front", REAR: "rear" });

export function normalizeRackFace(face) {
  return face === RackFace.REAR ? RackFace.REAR : RackFace.FRONT;
}

export function oppositeRackFace(face) {
  return normalizeRackFace(face) === RackFace.FRONT ? RackFace.REAR : RackFace.FRONT;
}

export function visibleRackFaces(face, expanded) {
  return expanded
    ? [RackFace.FRONT, RackFace.REAR]
    : [normalizeRackFace(face)];
}

export function rackBounds(rack) {
  return {
    x: rack.positionX,
    y: rack.positionY,
    width: RACK_WIDTH,
    height: RACK_HEADER_HEIGHT + rack.heightU * RACK_UNIT_HEIGHT + RACK_FOOTER_HEIGHT,
  };
}

export function layoutRackGroups(racks, expandedRackIDs, clearance = RACK_FACE_GAP) {
  const layouts = new Map();
  const placed = [];
  const ordered = [...(racks || [])].sort((left, right) =>
    left.positionX - right.positionX || left.positionY - right.positionY || String(left.id).localeCompare(String(right.id)));
  for (const rack of ordered) {
    const bounds = rackBounds(rack);
    const expanded = expandedRackIDs?.has(rack.id) || false;
    const width = expanded ? RACK_WIDTH * 2 + RACK_FACE_GAP : RACK_WIDTH;
    let x = bounds.x;
    while (true) {
      const collisions = placed.filter((current) =>
        bounds.y < current.y + current.height + clearance && bounds.y + bounds.height + clearance > current.y &&
        x < current.x + current.width + clearance && x + width + clearance > current.x);
      if (!collisions.length) break;
      x = Math.max(x, ...collisions.map((current) => current.x + current.width + clearance));
    }
    const layout = { rack, x, y: bounds.y, width, height: bounds.height, expanded };
    layouts.set(rack.id, layout);
    placed.push(layout);
  }
  return layouts;
}

export function mountedDevicePosition(rack, device) {
  const units = Math.max(1, Number(device.faceplate?.unitsU) || 1);
  const topUnit = Number(device.rackUnit) + units - 1;
  return {
    x: rack.positionX + RACK_DEVICE_INSET,
    y: rack.positionY + RACK_HEADER_HEIGHT + (rack.heightU - topUnit) * RACK_UNIT_HEIGHT,
  };
}

export function isRackPlacementAvailable(topology, device, rackID, rackUnit, rackFace = RackFace.FRONT) {
  const rack = topology.racks?.find((candidate) => candidate.id === rackID);
  if (!rack) return false;
  const face = normalizeRackFace(rackFace);
  const units = Math.max(1, Number(device.faceplate?.unitsU) || 1);
  const lastUnit = rackUnit + units - 1;
  if (!Number.isInteger(rackUnit) || rackUnit < 1 || lastUnit > rack.heightU) return false;
  return topology.devices.every((current) => {
    if (current.id === device.id || current.rackId !== rackID || current.rackUnit < 1 ||
      normalizeRackFace(current.rackFace) !== face) return true;
    const currentUnits = Math.max(1, Number(current.faceplate?.unitsU) || 1);
    const currentLastUnit = current.rackUnit + currentUnits - 1;
    return lastUnit < current.rackUnit || rackUnit > currentLastUnit;
  });
}

export function findRackLanding(topology, device, proposedPosition, rackFaces = null) {
  const targets = [...(topology.racks || [])].reverse().map((rack) => ({
    rack,
    rackFace: normalizeRackFace(typeof rackFaces === "function"
      ? rackFaces(rack.id)
      : rackFaces?.get?.(rack.id) ?? rackFaces?.[rack.id]),
    x: rack.positionX,
    y: rack.positionY,
    width: RACK_WIDTH,
  }));
  return findLanding(topology, device, proposedPosition, targets);
}

export function findRackFaceLanding(topology, device, proposedPosition, rackFaceBoxes) {
  const targets = [...(rackFaceBoxes || [])].reverse().map((box) => ({
    rack: box.rack,
    rackFace: normalizeRackFace(box.face),
    x: box.x,
    y: box.y,
    width: box.width || RACK_WIDTH,
  }));
  return findLanding(topology, device, proposedPosition, targets);
}

function findLanding(topology, device, proposedPosition, targets) {
  const units = Math.max(1, Number(device.faceplate?.unitsU) || 1);
  const centerX = proposedPosition.x + RACK_MOUNTED_DEVICE_WIDTH / 2;
  const centerY = proposedPosition.y + units * RACK_UNIT_HEIGHT / 2;
  for (const target of targets) {
    const { rack, rackFace } = target;
    const visualRack = { ...rack, positionX: target.x, positionY: target.y };
    const bayTop = target.y + RACK_HEADER_HEIGHT;
    const bayBottom = bayTop + rack.heightU * RACK_UNIT_HEIGHT;
    const isInside = centerX >= target.x && centerX <= target.x + target.width &&
      centerY >= bayTop && centerY <= bayBottom;
    if (!isInside) continue;
    if (units > rack.heightU) {
      return {
        rack,
        rackFace,
        rackUnit: 1,
        position: { x: target.x + RACK_DEVICE_INSET, y: bayTop },
        isValid: false,
        reason: "capacity",
      };
    }
    const maxTopIndex = Math.max(0, rack.heightU - units);
    const topIndex = Math.max(0, Math.min(maxTopIndex,
      Math.round((proposedPosition.y - bayTop) / RACK_UNIT_HEIGHT)));
    const rackUnit = rack.heightU - units - topIndex + 1;
    const isValid = isRackPlacementAvailable(topology, device, rack.id, rackUnit, rackFace);
    return {
      rack,
      rackFace,
      rackUnit,
      position: mountedDevicePosition(visualRack, { ...device, rackUnit }),
      isValid,
      reason: isValid ? "available" : "occupied",
    };
  }
  return null;
}

export function usedRackUnits(topology, rackID, rackFace = null) {
  const units = new Set();
  for (const device of topology.devices || []) {
    if (device.rackId !== rackID || device.rackUnit < 1) continue;
    if (rackFace && normalizeRackFace(device.rackFace) !== normalizeRackFace(rackFace)) continue;
    const height = Math.max(1, Number(device.faceplate?.unitsU) || 1);
    for (let unit = device.rackUnit; unit < device.rackUnit + height; unit += 1) units.add(unit);
  }
  return units.size;
}
