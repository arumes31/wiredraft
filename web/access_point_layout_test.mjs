import assert from "node:assert/strict";
import test from "node:test";
import { hardwareCatalog, instantiateProfile } from "./static/js/catalog.js";
import * as faceplateScene from "./static/js/faceplate-scene.js";
import { CanvasEngine } from "./static/js/canvas.js";
import { SceneTileIndex } from "./static/js/scene-tiles.js";
import { AppState } from "./static/js/state.js";
import { findRackFaceLanding, usedRackUnits } from "./static/js/rack.js";

/** Give real catalog fixtures distinct stable identities. */
function deviceFor(model, id = model) {
  const device = instantiateProfile(hardwareCatalog.find((item) => item.model === model), model, { x: 100, y: 100 });
  device.id = id;
  device.ports.forEach((port) => { port.id = `${id}-${port.portIndex}`; port.deviceId = id; });
  return device;
}

/** Run the real scene, picking and routing paths without a browser context. */
function layoutEngine(devices, racks = [], links = []) {
  const state = new AppState();
  state.setTopology({ devices, racks, links });
  const engine = Object.create(CanvasEngine.prototype);
  Object.assign(engine, { state, sceneDirty: true, sceneRevision: 0,
    rackTiles: new SceneTileIndex(), deviceTiles: new SceneTileIndex(),
    routingDeviceBoxes: [], routingPortBoxes: [], rackBoxes: [], trackPlanCache: null,
    routingPlanRevision: 0, camera: { x: 0, y: 0, zoom: 1 } });
  return engine;
}

test("free circular and square access points expose readable sockets without changing inventory", () => {
  for (const model of ["AP-635", "UniFi U7 Pro"]) {
    const device = deviceFor(model);
    const before = structuredClone(device);
    const engine = layoutEngine([device]);
    const [box] = engine.deviceRectangles();
    assert.equal(box.height, 345);
    const scene = engine.faceplateScenes().get(device.id);
    assert.equal(scene.chassis.width, scene.chassis.height);
    for (const port of scene.ports.filter((entry) => !entry.port.type.startsWith("USB"))) {
      assert.ok(port.width >= 18, `${model} ${port.port.label} must be readable at normal zoom`);
      assert.ok(port.labelPlacement.maxWidth >= 12, `${model} label must have useful width before zoom`);
      assert.equal(engine.hitPort({ x: port.centerX, y: port.centerY }).port.id, port.port.id);
    }
    assert.equal(engine.hitDevice({ x: box.x + 10, y: box.y + box.height - 10 }).device.id, device.id);
    assert.deepEqual(device, before);
  }
});

test("display sizing leaves unknown APs and rack unit dimensions unchanged", () => {
  const ap = deviceFor("AP-635");
  assert.deepEqual(faceplateScene.faceplateDisplaySize(ap, { width: 900 }), { width: 900, height: 450 });
  assert.deepEqual(faceplateScene.faceplateDisplaySize(ap, { mounted: true }), { width: 690, height: 100 });
  for (const device of [{ category: "AccessPoint", faceplate: { unitsU: 1 } },
    { category: "Server", faceplate: { unitsU: 2 } }, deviceFor("FortiGate 100F")]) {
    assert.equal(faceplateScene.faceplateDisplaySize(device).height, (device.faceplate.unitsU || 1) * 100);
  }
});

test("mounted APs and their hidden rack shadows still occupy one rack unit", () => {
  const ap = deviceFor("AP-635");
  const neighbor = deviceFor("FortiGate 100F");
  const rack = { id: "rack", positionX: 100, positionY: 100, heightU: 12 };
  Object.assign(ap, { rackId: rack.id, rackUnit: 2, rackFace: "front" });
  Object.assign(neighbor, { rackId: rack.id, rackUnit: 1, rackFace: "front" });
  const engine = layoutEngine([ap, neighbor], [rack]);
  const boxes = engine.deviceRectangles();
  assert.deepEqual(boxes.map((box) => box.height), [100, 100]);
  assert.equal(boxes[0].y + boxes[0].height, boxes[1].y);
  assert.equal(usedRackUnits(engine.state.topology, rack.id), 2);
  const installedAP = engine.state.topology.devices[0];
  installedAP.rackFace = "rear";
  engine.sceneDirty = true;
  engine.layoutScene();
  assert.equal(engine.shadowDeviceBoxes[0].height, 100);
  installedAP.rackId = "missing-rack";
  engine.sceneDirty = true;
  assert.equal(engine.deviceRectangles().find((box) => box.device.id === ap.id).height, 345,
    "an orphaned rack reference renders as a free device");
});

test("AP panel changes preserve saved legacy ports and cable attachment coordinates", () => {
  const ap = deviceFor("AP-635");
  ap.ports = ap.ports.slice(0, 2);
  ap.ports[0].label = "OFFICE UPLINK";
  const target = deviceFor("FortiGate 100F");
  target.positionY = 600;
  const link = { id: "uplink", sourceDeviceId: ap.id, sourcePortId: ap.ports[0].id,
    targetDeviceId: target.id, targetPortId: target.ports[0].id, cableType: "COPPER" };
  const engine = layoutEngine([ap, target], [], [link]);
  const before = structuredClone(engine.state.topology);
  engine.layoutScene();
  const socket = engine.portBoxByID.get(link.sourcePortId);
  const source = { x: socket.centerX, y: socket.centerY };
  assert.deepEqual(engine.cableTrackPlan().tracks.get(link.id).route.source, source);
  engine.state.setDeviceFaceplateFace(ap.id, "front");
  engine.sceneDirty = true;
  engine.layoutScene();
  const portal = engine.routingPortBoxByID.get(link.sourcePortId);
  assert.equal(portal.portal, true);
  assert.deepEqual(engine.cableTrackPlan().tracks.get(link.id).route.source, { x: portal.centerX, y: portal.centerY });
  engine.state.setDeviceFaceplateFace(ap.id, "rear");
  engine.sceneDirty = true;
  engine.layoutScene();
  assert.deepEqual(engine.cableTrackPlan().tracks.get(link.id).route.source, source);
  assert.deepEqual(engine.state.topology, before);
});

test("install placement leaves clearance around mixed AP, switch and server heights", () => {
  const engine = layoutEngine([]);
  for (const [index, model] of ["AP-635", "UniFi U7 Pro", "FortiGate 100F", "PowerEdge R650", "AP-635", "UniFi U7 Pro"].entries()) {
    const device = deviceFor(model, `install-${index}`);
    const before = structuredClone(engine.state.topology.devices);
    const position = engine.nextDevicePosition(device);
    const size = faceplateScene.faceplateDisplaySize(device);
    for (const box of engine.deviceRectangles()) {
      assert.ok(position.x + size.width <= box.x || position.x >= box.x + box.width ||
        position.y >= box.y + box.height + 50 || position.y + size.height + 50 <= box.y);
    }
    assert.deepEqual(engine.state.topology.devices, before, "placement must not reflow saved devices");
    Object.assign(device, { positionX: position.x, positionY: position.y });
    engine.state.topology.devices.push(device);
    engine.sceneDirty = true;
  }
});

test("rack landing uses the free AP body center while rack occupancy remains one unit", () => {
  const device = deviceFor("AP-635");
  const rack = { id: "rack", positionX: 100, positionY: 200, heightU: 12 };
  const topology = { racks: [rack], devices: [device] };
  const faces = [{ rack, face: "front", x: 100, y: 200, width: 750 }];
  const landing = findRackFaceLanding(topology, device, { x: 130, y: 150 }, faces, { sourceHeight: 345 });
  assert.equal(landing?.isValid, true);
  assert.equal(landing?.rackUnit, 12);
  assert.equal(findRackFaceLanding(topology, device, { x: 130, y: 1350 }, faces, { sourceHeight: 345 }), null);
  assert.equal(device.faceplate.unitsU, 1);
});

test("drag ghosts retain the captured source dimensions", () => {
  const device = deviceFor("AP-635");
  const engine = layoutEngine([device]);
  engine.drag = { active: true, originals: new Map([[device.id, { x: 100, y: 100, width: 690, height: 345, device }]]) };
  const drawn = [];
  const context = { save() {}, restore() {}, setLineDash() {}, strokeRect() {}, fillRect: (...rectangle) => drawn.push(rectangle) };
  engine.drawDragGhosts(context);
  assert.deepEqual(drawn, [[100, 100, 690, 345]]);
});
