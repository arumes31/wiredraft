import { isRackPlacementAvailable, mountedDevicePosition, normalizeRackFace, RACK_WIDTH, RACK_FACE_GAP } from "./rack.js";
import { applyPlacements, placementChanges } from "./placement-sync.js";
import { faceplateDisplaySize } from "./faceplate-scene.js";

/** Validate the full device height again at creation time, without displacing hardware. */
export function newDevicePlacement(topology, device, target) {
  if (!target.rackId) {
    if (target.roomId && !topology.rooms?.some(room => room.id === target.roomId)) throw new Error("This room was removed. Choose another position.");
    return { positionX: target.x, positionY: target.y, ...(target.roomId ? { roomId: target.roomId } : {}) };
  }
  const { rackId, rackUnit } = target;
  const rackFace = normalizeRackFace(target.rackFace);
  if (!isRackPlacementAvailable(topology, device, rackId, rackUnit, rackFace)) {
    throw new Error(`This device does not fit at U${rackUnit}. Choose a smaller device or another free rack unit.`);
  }
  const rack = topology.racks.find((item) => item.id === rackId);
  const position = mountedDevicePosition(rack, { ...device, rackUnit });
  return { rackId, rackUnit, rackFace, positionX: position.x, positionY: position.y };
}

/** Plan the complete drop and release conflicting hardware without changing the map. */
export function planRackReplacement(topology, devices) {
  const changes = placementChanges(topology, "devices", devices);
  const next = applyPlacements(topology, changes);
  const moving = new Set(changes.map((change) => change.id));
  const displaced = new Map();
  for (const device of next.devices.filter((item) => moving.has(item.id) && item.rackId)) {
    const end = device.rackUnit + Math.max(1, Number(device.faceplate?.unitsU) || 1) - 1;
    for (const current of next.devices) {
      if (moving.has(current.id) || current.rackId !== device.rackId ||
        normalizeRackFace(current.rackFace) !== normalizeRackFace(device.rackFace)) continue;
      const currentEnd = current.rackUnit + Math.max(1, Number(current.faceplate?.unitsU) || 1) - 1;
      if (device.rackUnit <= currentEnd && end >= current.rackUnit) displaced.set(current.id, current);
    }
  }
  // Put released hardware beyond both rack elevations and existing free devices.
  const releaseX = Math.max(0,
    ...(topology.racks || []).map((rack) => rack.positionX + RACK_WIDTH * 2 + RACK_FACE_GAP * 2),
    ...topology.devices.filter((device) => !device.rackId).map((device) => device.positionX + RACK_WIDTH + RACK_FACE_GAP));
  let releaseY = 100;
  for (const device of displaced.values()) {
    Object.assign(device, { rackId: "", rackUnit: 0, rackFace: "", positionX: releaseX, positionY: releaseY });
    releaseY += faceplateDisplaySize(device).height + 50;
  }
  for (const device of next.devices.filter((item) => moving.has(item.id) && item.rackId)) {
    if (!isRackPlacementAvailable(next, device, device.rackId, device.rackUnit, device.rackFace)) {
      throw new Error("The selected devices do not fit in this rack range. Move them separately.");
    }
  }
  return { changes: placementChanges(topology, "devices", next.devices),
    displaced: topology.devices.filter((device) => displaced.has(device.id)),
    mounted: next.devices.filter((device) => moving.has(device.id) && device.rackId) };
}
