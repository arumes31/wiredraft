export const RACK_WIDTH = 750;
export const RACK_HEADER_HEIGHT = 64;
export const RACK_FOOTER_HEIGHT = 20;
export const RACK_DEVICE_INSET = 30;
export const RACK_UNIT_HEIGHT = 100;
export const RACK_MOUNTED_DEVICE_WIDTH = 690;

export function rackBounds(rack) {
  return {
    x: rack.positionX,
    y: rack.positionY,
    width: RACK_WIDTH,
    height: RACK_HEADER_HEIGHT + rack.heightU * RACK_UNIT_HEIGHT + RACK_FOOTER_HEIGHT,
  };
}

export function mountedDevicePosition(rack, device) {
  const units = Math.max(1, Number(device.faceplate?.unitsU) || 1);
  const topUnit = Number(device.rackUnit) + units - 1;
  return {
    x: rack.positionX + RACK_DEVICE_INSET,
    y: rack.positionY + RACK_HEADER_HEIGHT + (rack.heightU - topUnit) * RACK_UNIT_HEIGHT,
  };
}

export function isRackPlacementAvailable(topology, device, rackID, rackUnit) {
  const rack = topology.racks?.find((candidate) => candidate.id === rackID);
  if (!rack) return false;
  const units = Math.max(1, Number(device.faceplate?.unitsU) || 1);
  const lastUnit = rackUnit + units - 1;
  if (!Number.isInteger(rackUnit) || rackUnit < 1 || lastUnit > rack.heightU) return false;
  return topology.devices.every((current) => {
    if (current.id === device.id || current.rackId !== rackID || current.rackUnit < 1) return true;
    const currentUnits = Math.max(1, Number(current.faceplate?.unitsU) || 1);
    const currentLastUnit = current.rackUnit + currentUnits - 1;
    return lastUnit < current.rackUnit || rackUnit > currentLastUnit;
  });
}

export function findRackLanding(topology, device, proposedPosition) {
  const units = Math.max(1, Number(device.faceplate?.unitsU) || 1);
  const centerX = proposedPosition.x + RACK_MOUNTED_DEVICE_WIDTH / 2;
  const centerY = proposedPosition.y + units * RACK_UNIT_HEIGHT / 2;
  for (const rack of [...(topology.racks || [])].reverse()) {
    const bounds = rackBounds(rack);
    const bayTop = rack.positionY + RACK_HEADER_HEIGHT;
    const bayBottom = bayTop + rack.heightU * RACK_UNIT_HEIGHT;
    const isInside = centerX >= bounds.x && centerX <= bounds.x + bounds.width &&
      centerY >= bayTop && centerY <= bayBottom;
    if (!isInside) continue;
    if (units > rack.heightU) {
      return {
        rack,
        rackUnit: 1,
        position: { x: rack.positionX + RACK_DEVICE_INSET, y: bayTop },
        isValid: false,
        reason: "capacity",
      };
    }
    const maxTopIndex = Math.max(0, rack.heightU - units);
    const topIndex = Math.max(0, Math.min(maxTopIndex,
      Math.round((proposedPosition.y - bayTop) / RACK_UNIT_HEIGHT)));
    const rackUnit = rack.heightU - units - topIndex + 1;
    const isValid = isRackPlacementAvailable(topology, device, rack.id, rackUnit);
    return {
      rack,
      rackUnit,
      position: mountedDevicePosition(rack, { ...device, rackUnit }),
      isValid,
      reason: isValid ? "available" : "occupied",
    };
  }
  return null;
}

export function usedRackUnits(topology, rackID) {
  const units = new Set();
  for (const device of topology.devices || []) {
    if (device.rackId !== rackID || device.rackUnit < 1) continue;
    const height = Math.max(1, Number(device.faceplate?.unitsU) || 1);
    for (let unit = device.rackUnit; unit < device.rackUnit + height; unit += 1) units.add(unit);
  }
  return units.size;
}
