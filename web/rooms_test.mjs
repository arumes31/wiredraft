import assert from "node:assert/strict";
import test from "node:test";
import { roomForDevice, roomMembers, moveRoom, assignRoom, removeRoom, roomConnections, layoutRooms, roomAtPoint, ROOM_PADDING, ROOM_HEADER } from "./static/js/rooms.js";
import { rackBounds, RACK_WIDTH, RACK_FACE_GAP } from "./static/js/rack.js";
import { hardwareCatalog, instantiateProfile } from "./static/js/catalog.js";

function fixture() {
  return { rooms: [{ id: "a", name: "Server", positionX: 0, positionY: 0, width: 1800, height: 1200 },
    { id: "b", name: "Office", positionX: 3000, positionY: 0, width: 1800, height: 1200 }],
  racks: [{ id: "r", roomId: "a", positionX: 60, positionY: 160, heightU: 6 }],
  devices: [{ id: "d", rackId: "r", roomId: "b", positionX: 90, positionY: 300, ports: [{ id: "p" }] },
    { id: "f", roomId: "a", positionX: 60, positionY: 900, ports: [{ id: "q" }] },
    { id: "o", roomId: "b", positionX: 3060, positionY: 200, ports: [{ id: "s" }] }],
  links: [{ id: "internal", sourcePortId: "p", targetPortId: "q" }, { id: "external", sourcePortId: "p", targetPortId: "s" }] };
}

test("mounted devices inherit room and room movement preserves cable identity", () => {
  const top = fixture();
  assert.equal(roomForDevice(top, top.devices[0]), "a");
  assert.deepEqual(roomMembers(top, "a").devices.map(d => d.id), ["d", "f"]);
  const links = structuredClone(top.links);
  moveRoom(top, "a", 200, 300);
  assert.equal(top.racks[0].positionX, 260);
  assert.equal(top.devices[0].positionX, 290);
  assert.equal(top.devices[1].positionY, 1200);
  assert.equal(top.devices[2].positionX, 3060);
  assert.deepEqual(top.links, links);
});

test("assign and remove rooms preserve equipment and links", () => {
  const top = fixture();
  assignRoom(top, "devices", "f", "b");
  assert.equal(top.devices[1].roomId, "b");
  assert.ok(top.devices[1].positionX >= 3000);
  removeRoom(top, "b");
  assert.equal(top.rooms.length, 1);
  assert.equal(top.devices.length, 3);
  assert.equal(top.links.length, 2);
  assert.ok(top.devices.every(d => d.roomId !== "b"));
});

test("collapsed rooms bundle external cables and hide internal cables", () => {
  const top = fixture();
  top.links.push({ id: "second", sourcePortId: "q", targetPortId: "s" });
  const result = roomConnections(top, new Set(["a"]));
  assert.deepEqual([...result.hiddenLinkIDs].sort(), ["external", "internal", "second"]);
  assert.equal(result.bundles.length, 1);
  assert.deepEqual(result.bundles[0].linkIDs, ["external", "second"]);
  assert.deepEqual(new Set([result.bundles[0].source, result.bundles[0].target]), new Set(["room:a", "device:o"]));
});

test("room bounds contain dual racks and empty rooms retain usable area", () => {
  const top = fixture();
  const rooms = layoutRooms(top, [{ rack: top.racks[0], x: 60, y: 160, width: 2500, height: 5000 }], [], new Set());
  assert.ok(rooms[0].width >= 2620);
  assert.ok(rooms[0].height >= 5220);
  assert.equal(rooms[1].width, 1800);
  assert.equal(layoutRooms(top, [], [], new Set(["a"]))[0].height, 180);
});

test("multiple racks snap into a negative room with space for both elevations and mounted equipment", () => {
  const top = fixture(), room = top.rooms[1];
  Object.assign(room, { positionX: -3000, positionY: -2000 });
  top.racks.push({ id: "second", positionX: 0, positionY: 0, heightU: 42 });
  const before = structuredClone(top);
  assignRoom(top, "racks", "r", room.id);
  assignRoom(top, "racks", "second", room.id);
  const [first, second] = top.racks;
  assert.equal(first.positionX, room.positionX + ROOM_PADDING);
  assert.equal(first.positionY, room.positionY + ROOM_HEADER + ROOM_PADDING);
  assert.equal(second.positionY, first.positionY);
  assert.ok(second.positionX >= first.positionX + RACK_WIDTH * 2 + RACK_FACE_GAP + ROOM_PADDING);
  assert.equal(top.devices[0].positionX - before.devices[0].positionX, first.positionX - before.racks[0].positionX);
  assert.equal(roomForDevice(top, top.devices[0]), room.id);
  assert.deepEqual(top.links, before.links);
  const boxes = top.racks.map(rack => ({ rack, ...rackBounds(rack), width: RACK_WIDTH * 2 + RACK_FACE_GAP }));
  const outline = layoutRooms(top, boxes, [])[1];
  assert.ok(outline.x + outline.width >= second.positionX + boxes[1].width + ROOM_PADDING);
  assert.ok(outline.y + outline.height >= second.positionY + boxes[1].height + ROOM_PADDING);
  assignRoom(top, "racks", "second", "");
  const smaller = layoutRooms(top, boxes, [])[1];
  assert.ok(smaller.width < outline.width);
  assert.ok(smaller.height < outline.height);
});

test("room snapping clears collisions with devices already in the room and preserves free placement", () => {
  const top = fixture(), room = top.rooms[0];
  Object.assign(top.devices[1], { positionX: ROOM_PADDING, positionY: ROOM_HEADER + ROOM_PADDING });
  top.racks[0].roomId = "";
  assignRoom(top, "racks", "r", room.id);
  assert.ok(top.racks[0].positionX >= top.devices[1].positionX + 690 + ROOM_PADDING);
  top.devices.push({ id: "new", positionX: -500, positionY: -500, faceplate: { unitsU: 4 } });
  assignRoom(top, "devices", "new", room.id);
  const added = top.devices.at(-1);
  assert.ok(added.positionY >= top.racks[0].positionY + rackBounds(top.racks[0]).height + ROOM_PADDING);
  added.positionY = top.devices[1].positionY;
  assignRoom(top, "devices", "new", room.id, { snap: true });
  assert.ok(added.positionY >= top.devices[1].positionY + 100 + ROOM_PADDING);
  added.positionX = -1200; added.positionY = -800;
  assignRoom(top, "devices", "new", "", { snap: true });
  assert.equal(added.roomId, "");
  assert.equal(added.positionX, -1200);
  assert.equal(added.positionY, -800);
});

test("drop targets use the original outline and ignore collapsed rooms", () => {
  const top = fixture(), boxes = layoutRooms(top, [], [], new Set(["b"]));
  assert.equal(roomAtPoint(boxes, { x: 100, y: 200 }), "a");
  assert.equal(roomAtPoint(boxes, { x: 3100, y: 100 }), "");
  assert.equal(roomAtPoint(boxes, { x: -200, y: -200 }), "");
  assert.equal(roomAtPoint(boxes, { x: 1900, y: 200 }), "");
});

test("sequential device drops leave clearance around the actual access point body", () => {
  const top = fixture();
  top.racks = []; top.devices = [];
  for (const model of ["AP-635", "EX2300-24T", "UniFi U7 Pro"]) {
    const device = instantiateProfile(hardwareCatalog.find(profile => profile.model === model), model, { x: 0, y: 0 });
    device.id = model;
    top.devices.push(device);
    assignRoom(top, "devices", device.id, "a", { snap: true });
  }
  const [first, second, third] = top.devices;
  assert.ok(second.positionY >= first.positionY + 345 + ROOM_PADDING);
  assert.ok(third.positionY >= second.positionY + 100 + ROOM_PADDING);
});
