import { rackBounds, RACK_WIDTH, RACK_FACE_GAP } from "./rack.js";
import { faceplateDisplaySize } from "./faceplate-scene.js";

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

/** Resolve against the room outlines captured before a drag can expand them. */
export function roomAtPoint(boxes, point) {
  return [...boxes].reverse().find(box => !box.collapsed && point.x >= box.x && point.x <= box.x + box.width &&
    point.y >= box.y && point.y <= box.y + box.height)?.room.id || "";
}

function equipmentBounds(item, collection) {
  const size = collection === "racks" ? { ...rackBounds(item), width: RACK_WIDTH * 2 + RACK_FACE_GAP }
    : faceplateDisplaySize(item);
  return { ...size, x: item.positionX, y: item.positionY };
}

/** Arrange racks in a row and free devices below them, reserving both rack faces. */
export function assignRoom(topology, collection, id, roomID, { snap = false } = {}) {
  const item = topology[collection]?.find(candidate => candidate.id === id);
  if (!item || (collection === "devices" && item.rackId)) return;
  const changed = (item.roomId || "") !== roomID;
  if (!changed && !snap) return;
  const room = topology.rooms?.find(candidate => candidate.id === roomID);
  if (roomID && !room) return;
  item.roomId = roomID;
  if (!room) return;
  const members = roomMembers(topology, roomID);
  const occupied = [...members.racks.filter(rack => rack !== item).map(rack => equipmentBounds(rack, "racks")),
    ...members.devices.filter(device => device !== item && !device.rackId).map(device => equipmentBounds(device, "devices"))];
  const left = room.positionX + ROOM_PADDING, top = room.positionY + ROOM_HEADER + ROOM_PADDING;
  const size = equipmentBounds(item, collection);
  const candidate = { x: changed ? left : Math.max(left, Math.round(item.positionX / 10) * 10),
    y: changed ? top : Math.max(top, Math.round(item.positionY / 10) * 10), width: size.width, height: size.height };
  if (changed && collection === "devices") candidate.y = Math.max(top, ...occupied.map(box => box.y + box.height + ROOM_PADDING));
  while (true) {
    const collisions = occupied.filter(box => candidate.x < box.x + box.width + ROOM_PADDING &&
      candidate.x + candidate.width + ROOM_PADDING > box.x && candidate.y < box.y + box.height + ROOM_PADDING &&
      candidate.y + candidate.height + ROOM_PADDING > box.y);
    if (!collisions.length) break;
    if (collection === "racks") candidate.x = Math.max(...collisions.map(box => box.x + box.width + ROOM_PADDING));
    else candidate.y = Math.max(...collisions.map(box => box.y + box.height + ROOM_PADDING));
  }
  const dx = candidate.x - item.positionX, dy = candidate.y - item.positionY;
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
