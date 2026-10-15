import assert from "node:assert/strict";
import test from "node:test";
import { roomForDevice, roomMembers, moveRoom, assignRoom, removeRoom, roomConnections, layoutRooms } from "./static/js/rooms.js";

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
