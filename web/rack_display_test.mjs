import assert from "node:assert/strict";
import test from "node:test";
import { hardwareCatalog, instantiateProfile } from "./static/js/catalog.js";
import { CanvasEngine } from "./static/js/canvas.js";
import { SceneTileIndex } from "./static/js/scene-tiles.js";
import { AppState } from "./static/js/state.js";
import { buildSVGDocument } from "./static/js/export.js";
import { assignCableTracks } from "./static/js/cabling.js";

function fixture(rackDisplay) {
  const device = instantiateProfile(hardwareCatalog.find((item) => item.model === "ProLiant DL360"), "Server", { x: 0, y: 0 });
  Object.assign(device, { id: "server", rackId: "rack", rackUnit: 2, rackFace: "rear", rackDisplay });
  device.ports.forEach((port, index) => { port.id = `server-port-${index}`; port.deviceId = device.id; });
  const state = new AppState();
  state.setTopology({ devices: [device], racks: [{ id: "rack", name: "Rack", heightU: 6, positionX: 100, positionY: 100, color: "#345678" }], links: [], vlans: [] });
  const engine = Object.create(CanvasEngine.prototype);
  Object.assign(engine, { state, sceneDirty: true, sceneRevision: 0,
    rackTiles: new SceneTileIndex(), deviceTiles: new SceneTileIndex(),
    routingDeviceBoxes: [], routingPortBoxes: [], rackBoxes: [], trackPlanCache: null,
    routingPlanRevision: 0, camera: { x: 0, y: 0, zoom: 1 } });
  return { engine, state, device };
}

test("servers show matching front and rear panels at the same U position", () => {
  const { engine, state, device } = fixture();
  const original = JSON.stringify(state.topology);
  let boxes = engine.deviceRectangles();
  assert.equal(boxes.length, 1);
  assert.equal(boxes[0].scene.face, "front");
  state.setRackFace("rack", "rear"); engine.sceneDirty = true;
  assert.equal(engine.deviceRectangles()[0].scene.face, "rear");
  state.setRackDualFace("rack", true); engine.sceneDirty = true;
  boxes = engine.deviceRectangles();
  assert.equal(boxes.length, 2);
  assert.deepEqual(new Set(boxes.map((box) => box.scene.face)), new Set(["front", "rear"]));
  assert.equal(boxes[0].y, boxes[1].y);
  assert.equal(JSON.stringify(state.topology), original);
  const ports = engine.portGeometry();
  const routed = engine.routingPortGeometry();
  assert.equal(new Set(routed.map((box) => box.port.id)).size, device.ports.length);
  assert.equal(routed.length, device.ports.length);
  for (const port of ports) {
    assert.equal(engine.hitPort({ x: port.centerX, y: port.centerY }).port.id, port.port.id);
    const anchor = routed.find((box) => box.port.id === port.port.id);
    assert.equal(anchor.centerX, port.centerX);
    assert.equal(anchor.centerY, port.centerY);
  }
  const svg = buildSVGDocument(state.topology, engine);
  assert.equal((svg.match(/data-layer="faceplate"/g) || []).length, 2);
  assert.match(svg, /data-hardware-face="front"/);
  assert.match(svg, /data-hardware-face="rear"/);
  for (const port of ports) assert.equal(svg.split(`data-entity="port" data-port-id="${port.port.id}"`).length - 1, 1);
});

test("device display override can restrict a server to its mounting face", () => {
  const { engine, state } = fixture("mounted");
  assert.equal(engine.deviceRectangles().length, 0);
  state.setRackDualFace("rack", true); engine.sceneDirty = true;
  assert.equal(engine.deviceRectangles().length, 1);
  state.topology.devices[0].rackDisplay = "both"; engine.sceneDirty = true;
  assert.equal(engine.deviceRectangles().length, 2);
});

test("routing anchors replace portals with the first real socket and retain it", () => {
  const { engine, device } = fixture();
  engine.layoutScene();
  const portal = [...engine.routingPortBoxByID.values()].find((box) => box.portal);
  assert.ok(portal);
  engine.addVisibleDevice(device, null, { x: 1000, y: 100 }, "rear");
  const socket = engine.routingPortBoxByID.get(portal.port.id);
  assert.ok(!socket.portal);
  assert.notEqual(socket, portal);
  engine.addVisibleDevice(device, null, { x: 2000, y: 100 }, "rear");
  assert.equal(engine.routingPortBoxByID.get(portal.port.id), socket);
  engine.addVisibleDevice(device, null, { x: 3000, y: 100 }, "front");
  assert.equal(engine.routingPortBoxByID.get(portal.port.id), socket);
});

test("cables use the panel containing the socket even when the other panel is the primary box", () => {
  const { engine, state } = fixture();
  state.topology.devices[0].rackFace = "front";
  const peer = structuredClone(state.topology.devices[0]);
  peer.id = "peer"; peer.rackUnit = 5;
  peer.ports.forEach((port, index) => { port.id = `peer-port-${index}`; port.deviceId = peer.id; });
  state.topology.devices.push(peer);
  state.setRackDualFace("rack", true);
  engine.layoutScene();
  const source = engine.portGeometry().find((box) => box.device.id === "server");
  const target = engine.portGeometry().find((box) => box.device.id === "peer");
  assert.equal(source.deviceBox.face, "rear");
  const link = { id: "cable", sourcePortId: source.port.id, targetPortId: target.port.id, cableType: "CAT6", primaryVlan: 1, vlanIds: [1] };
  const track = assignCableTracks({ links: [link], portBoxes: engine.routingPortGeometry(),
    deviceBoxes: engine.routingDeviceBoxes, rackBoxes: engine.routingRackBoxes }).get("cable");
  assert.deepEqual(track.source, { x: source.centerX, y: source.centerY });
  assert.deepEqual(track.target, { x: target.centerX, y: target.centerY });
  assert.ok([source.deviceBox.x, source.deviceBox.x + source.deviceBox.width].includes(track.sourceDeviceEdgeX));
  const rear = engine.rackFaceBoxes.find((box) => box.face === "rear");
  const front = engine.rackFaceBoxes.find((box) => box.face === "front");
  assert.ok(Math.abs(track.sourceGutterX - rear.x) < Math.abs(track.sourceGutterX - front.x));
});
