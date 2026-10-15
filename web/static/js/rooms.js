import { rackBounds, RACK_WIDTH, RACK_FACE_GAP } from "./rack.js";
import { faceplateDisplaySize } from "./faceplate-scene.js";

export const ROOM_HEADER = 100;
export const ROOM_PADDING = 240;
export const ROOM_EQUIPMENT_GAP = 180;

/** Read optional room spacing while preserving defaults for existing maps. */
export function roomSpacing(room) {
  return { padding: room.padding || ROOM_PADDING, gap: room.equipmentGap || ROOM_EQUIPMENT_GAP };
}

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

/** Measure free device bodies or reserve both elevations of a rack for room placement. */
function equipmentBounds(item, collection) {
  const size = collection === "racks" ? { ...rackBounds(item), width: RACK_WIDTH * 2 + RACK_FACE_GAP }
    : faceplateDisplaySize(item);
  return { ...size, x: item.positionX, y: item.positionY };
}

/** Place newly assigned equipment; existing members move only on an explicit arrange request. */
export function assignRoom(topology, collection, id, roomID, { snap = false } = {}) {
  const item = topology[collection]?.find(candidate => candidate.id === id);
  if (!item || (collection === "devices" && item.rackId)) return;
  const changed = (item.roomId || "") !== roomID;
  if (!changed && !snap) return;
  const room = topology.rooms?.find(candidate => candidate.id === roomID);
  if (roomID && !room) return;
  item.roomId = roomID;
  if (!room) return;
  const { padding, gap } = roomSpacing(room);
  const members = roomMembers(topology, roomID);
  const occupied = [...members.racks.filter(rack => rack !== item).map(rack => equipmentBounds(rack, "racks")),
    ...members.devices.filter(device => device !== item && !device.rackId).map(device => equipmentBounds(device, "devices"))];
  const left = room.positionX + padding, top = room.positionY + ROOM_HEADER + padding;
  const size = equipmentBounds(item, collection);
  const candidate = { x: changed ? left : Math.max(left, Math.round(item.positionX / 10) * 10),
    y: changed ? top : Math.max(top, Math.round(item.positionY / 10) * 10), width: size.width, height: size.height };
  if (changed && collection === "devices") candidate.y = Math.max(top, ...occupied.map(box => box.y + box.height + gap));
  while (true) {
    const collisions = occupied.filter(box => candidate.x < box.x + box.width + gap &&
      candidate.x + candidate.width + gap > box.x && candidate.y < box.y + box.height + gap &&
      candidate.y + candidate.height + gap > box.y);
    if (!collisions.length) break;
    if (collection === "racks") candidate.x = Math.max(...collisions.map(box => box.x + box.width + gap));
    else candidate.y = Math.max(...collisions.map(box => box.y + box.height + gap));
  }
  moveEquipment(topology, collection, item, candidate);
}

/** Move a rack together with stored mounted-device coordinates. */
function moveEquipment(topology, collection, item, candidate) {
  const dx = candidate.x - item.positionX, dy = candidate.y - item.positionY;
  item.positionX += dx; item.positionY += dy;
  if (collection === "racks") for (const device of topology.devices || []) {
    if (device.rackId === item.id) { device.positionX += dx; device.positionY += dy; }
  }
}

/** Explicitly arrange room contents with independent wall and equipment clearance. */
export function arrangeRoom(topology, roomID, rackWidths = new Map()) {
  const room = topology.rooms?.find(item => item.id === roomID);
  if (!room) return;
  const { padding, gap } = roomSpacing(room), members = roomMembers(topology, roomID);
  const left = room.positionX + padding, top = room.positionY + ROOM_HEADER + padding;
  let x = left, bottom = top;
  for (const rack of members.racks) {
    const size = equipmentBounds(rack, "racks");
    moveEquipment(topology, "racks", rack, { x, y: top });
    x += (rackWidths.get(rack.id) || size.width) + gap;
    bottom = Math.max(bottom, top + size.height + gap);
  }
  for (const device of members.devices.filter(item => !item.rackId)) {
    moveEquipment(topology, "devices", device, { x: left, y: bottom });
    bottom += equipmentBounds(device, "devices").height + gap;
  }
}

/** Deliberately detach equipment and place it beyond its former room, keeping cables attached. */
export function leaveRoom(topology, collection, id) {
  const item = topology[collection]?.find(candidate => candidate.id === id);
  const room = topology.rooms?.find(candidate => candidate.id === item?.roomId);
  if (!room || (collection === "devices" && item.rackId)) return;
  const rackBoxes = (topology.racks || []).map(rack => ({ rack, ...equipmentBounds(rack, "racks") }));
  const deviceBoxes = topology.devices.filter(device => !device.rackId).map(device => ({ device, ...equipmentBounds(device, "devices") }));
  const outline = layoutRooms(topology, rackBoxes, deviceBoxes).find(box => box.room === room);
  const { gap } = roomSpacing(room), size = equipmentBounds(item, collection);
  const occupied = [...rackBoxes.filter(box => box.rack !== item), ...deviceBoxes.filter(box => box.device !== item)];
  let x = outline.x + outline.width + gap;
  while (true) {
    const collisions = occupied.filter(box => x < box.x + box.width + gap && x + size.width + gap > box.x &&
      item.positionY < box.y + box.height + gap && item.positionY + size.height + gap > box.y);
    if (!collisions.length) break;
    x = Math.max(...collisions.map(box => box.x + box.width + gap));
  }
  item.roomId = "";
  moveEquipment(topology, collection, item, { x, y: item.positionY });
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
    const { padding } = roomSpacing(room);
    const members = roomMembers(topology, room.id);
    const boxes = [...rackBoxes.filter(box => box.rack.roomId === room.id),
      ...deviceBoxes.filter(box => !box.device.rackId && box.device.roomId === room.id)];
    const x = Math.min(room.positionX, ...boxes.map(box => box.x - padding));
    const y = Math.min(room.positionY, ...boxes.map(box => box.y - ROOM_HEADER - padding));
    const right = Math.max(room.positionX + room.width, ...boxes.map(box => box.x + box.width + padding));
    const bottom = Math.max(room.positionY + room.height, ...boxes.map(box => box.y + box.height + padding));
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
