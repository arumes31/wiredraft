import { rackBounds, RACK_WIDTH, RACK_FACE_GAP } from "./rack.js";

export const ROOM_HEADER = 100;
export const ROOM_PADDING = 60;

export function roomForDevice(topology, device) {
  return device.rackId ? (topology.racks || []).find(rack => rack.id === device.rackId)?.roomId || "" : device.roomId || "";
}

export function roomMembers(topology, roomID) {
  return { racks: (topology.racks || []).filter(rack => rack.roomId === roomID),
    devices: (topology.devices || []).filter(device => roomForDevice(topology, device) === roomID) };
}

/** Translate stored coordinates together; rack allocation and cable IDs stay untouched. */
export function moveRoom(topology, roomID, dx, dy) {
  const room = topology.rooms?.find(item => item.id === roomID);
  if (!room) return;
  const members = roomMembers(topology, roomID);
  for (const item of [room, ...members.racks, ...members.devices]) {
    item.positionX += dx;
    item.positionY += dy;
  }
}

/** Explicit assignment places new members below existing equipment inside the room. */
export function assignRoom(topology, collection, id, roomID) {
  const item = topology[collection]?.find(candidate => candidate.id === id);
  if (!item || (collection === "devices" && item.rackId)) return;
  if ((item.roomId || "") === roomID) return;
  const room = topology.rooms?.find(candidate => candidate.id === roomID);
  if (roomID && !room) return;
  item.roomId = roomID;
  if (!room) return;
  const members = roomMembers(topology, roomID);
  const bottom = Math.max(room.positionY + ROOM_HEADER,
    ...members.racks.filter(rack => rack !== item).map(rack => rack.positionY + rackBounds(rack).height),
    ...members.devices.filter(device => device !== item && !device.rackId).map(device => device.positionY + Math.max(100, (device.faceplate?.unitsU || 1) * 100)));
  const rackRight = Math.max(room.positionX, ...members.racks.filter(rack => rack !== item).map(rack => rack.positionX + RACK_WIDTH * 2 + RACK_FACE_GAP));
  const dx = (collection === "racks" ? rackRight : room.positionX) + ROOM_PADDING - item.positionX;
  const dy = (collection === "racks" ? room.positionY + ROOM_HEADER : bottom) + ROOM_PADDING - item.positionY;
  item.positionX += dx; item.positionY += dy;
  if (collection === "racks") for (const device of topology.devices || []) {
    if (device.rackId === id) { device.positionX += dx; device.positionY += dy; }
  }
}

export function removeRoom(topology, roomID) {
  topology.rooms = (topology.rooms || []).filter(room => room.id !== roomID);
  for (const item of [...(topology.racks || []), ...(topology.devices || [])]) {
    if (item.roomId === roomID) delete item.roomId;
  }
}

/** Fit the outline to rendered equipment, including expanded rear elevations. */
export function layoutRooms(topology, rackBoxes, deviceBoxes, collapsed = new Set()) {
  return (topology.rooms || []).map(room => {
    const members = roomMembers(topology, room.id);
    const boxes = [...rackBoxes.filter(box => box.rack.roomId === room.id),
      ...deviceBoxes.filter(box => !box.device.rackId && box.device.roomId === room.id)];
    const x = Math.min(room.positionX, ...boxes.map(box => box.x - ROOM_PADDING));
    const y = Math.min(room.positionY, ...boxes.map(box => box.y - ROOM_HEADER - ROOM_PADDING));
    const right = Math.max(room.positionX + room.width, ...boxes.map(box => box.x + box.width + ROOM_PADDING));
    const bottom = Math.max(room.positionY + room.height, ...boxes.map(box => box.y + box.height + ROOM_PADDING));
    return { room, x, y, width: collapsed.has(room.id) ? 720 : right - x,
      height: collapsed.has(room.id) ? 180 : bottom - y, collapsed: collapsed.has(room.id),
      rackCount: members.racks.length, deviceCount: members.devices.length };
  });
}

/** Replace cables touching collapsed rooms with inspectable aggregate connections. */
export function roomConnections(topology, collapsed) {
  const hiddenLinkIDs = new Set(), bundles = new Map(), ports = new Map();
  for (const device of topology.devices || []) {
    const roomID = roomForDevice(topology, device);
    for (const port of device.ports || []) ports.set(port.id, { device, roomID });
  }
  for (const link of topology.links || []) {
    const source = ports.get(link.sourcePortId), target = ports.get(link.targetPortId);
    if (!source || !target || (!collapsed.has(source.roomID) && !collapsed.has(target.roomID))) continue;
    hiddenLinkIDs.add(link.id);
    if (source.roomID && source.roomID === target.roomID) continue;
    const endpoint = item => collapsed.has(item.roomID) ? `room:${item.roomID}` : `device:${item.device.id}`;
    const ends = [endpoint(source), endpoint(target)].sort();
    const key = JSON.stringify(ends);
    if (!bundles.has(key)) bundles.set(key, { source: ends[0], target: ends[1], linkIDs: [] });
    bundles.get(key).linkIDs.push(link.id);
  }
  return { hiddenLinkIDs, bundles: [...bundles.values()] };
}
