import assert from "node:assert/strict";
import test from "node:test";
import { hardwareCatalog, instantiateProfile } from "./static/js/catalog.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";
import { resolveModelFaceplate } from "./static/js/faceplate-models.js";
import { CanvasEngine } from "./static/js/canvas.js";
import { SceneTileIndex } from "./static/js/scene-tiles.js";
import { AppState } from "./static/js/state.js";

/** Instantiate a catalog device with stable identifiers for topology checks. */
function deviceFor(model, id = model) {
  const profile = hardwareCatalog.find((candidate) => candidate.model === model);
  assert.ok(profile, model);
  const device = instantiateProfile(profile, model, { x: 80, y: 140 });
  device.id = id;
  device.ports.forEach((port, index) => { port.id = `${id}-${index}`; port.deviceId = id; });
  return device;
}

/** Exercise the real layout and routing methods without a browser drawing context. */
function layoutEngine(topology) {
  const state = new AppState();
  state.setTopology(topology);
  const engine = Object.create(CanvasEngine.prototype);
  Object.assign(engine, { state, sceneDirty: true, sceneRevision: 0,
    rackTiles: new SceneTileIndex(), deviceTiles: new SceneTileIndex(),
    routingDeviceBoxes: [], routingPortBoxes: [], rackBoxes: [], trackPlanCache: null,
    routingPlanRevision: 0, camera: { x: 0, y: 0, zoom: 1 } });
  return engine;
}

test("schematic and imported devices retain their established connector positions", () => {
  const device = { id: "custom", category: "Switch", faceplate: { rows: 2 }, ports: [
    { id: "a", type: "RJ45_1G" }, { id: "b", type: "RJ45_1G" },
    { id: "c", type: "SFP_1G", faceplateX: .8, faceplateY: .65 },
  ] };
  const scene = buildFaceplateScene(device, { x: 10, y: 20, width: 690, height: 100 }, { face: "rear" });
  assert.equal(scene.profile, null);
  assert.equal(scene.face, "front");
  assert.deepEqual(scene.ports.map(({ centerX, centerY }) => [centerX, centerY]), [[402, 55.5], [402, 84.5], [562, 85]]);
  assert.equal(scene.portal, null);
  assert.equal(scene.hiddenPorts.length, 0);
  assert.equal(buildFaceplateScene({ faceplate: {}, ports: [] }, { x: 0, y: 0, width: 690, height: 100 }).ports.length, 0);
});

test("authored panels keep every inventory port on exactly one physical face", () => {
  let modelCount = 0;
  for (const catalogProfile of hardwareCatalog) {
    const device = deviceFor(catalogProfile.model);
    const profile = resolveModelFaceplate(device);
    if (!profile) continue;
    modelCount += 1;
    const bounds = { x: 80, y: 140, width: 690, height: 100 * device.faceplate.unitsU };
    const front = buildFaceplateScene(device, bounds, { face: "front" });
    const rear = buildFaceplateScene(device, bounds, { face: "rear" });
    assert.equal(front.ports.length + rear.ports.length, device.ports.length, device.model);
    assert.equal(new Set([...front.ports, ...rear.ports].map(({ port }) => port.id)).size, device.ports.length);
    for (const scene of [front, rear]) {
      assert.equal(scene.ports.length + scene.hiddenPorts.length, device.ports.length);
      for (const box of scene.ports) {
        assert.ok(box.x >= scene.chassis.x && box.x + box.width <= scene.chassis.x + scene.chassis.width, `${device.model} ${box.port.label} horizontal bounds`);
        assert.ok(box.y >= scene.chassis.y && box.y + box.height <= scene.chassis.y + scene.chassis.height, `${device.model} ${box.port.label} vertical bounds`);
      }
      for (const hidden of scene.hiddenPorts) {
        assert.equal(hidden.portal, true);
        assert.ok(hidden.centerX >= scene.portal.x && hidden.centerX <= scene.portal.x + scene.portal.width);
      }
    }
    assert.equal(buildFaceplateScene(device, bounds).face, profile.defaultFace);
  }
  assert.ok(modelCount >= 20, `Only ${modelCount} authored models`);
});

test("renaming a known socket preserves its physical slot and stored configuration", () => {
  const device = deviceFor("FortiGate 40F");
  const bounds = { x: 0, y: 0, width: 690, height: 100 };
  const before = buildFaceplateScene(device, bounds);
  const port = device.ports[0];
  port.label = "CUSTOM WAN";
  port.nativeVlan = 42;
  const after = buildFaceplateScene(device, bounds);
  assert.equal(after.ports[0].centerX, before.ports[0].centerX);
  assert.equal(after.ports[0].centerY, before.ports[0].centerY);
  assert.equal(after.ports[0].port, port);
  assert.equal(after.ports[0].port.nativeVlan, 42);
  port.label = device.ports[1].label;
  const duplicateLabel = buildFaceplateScene(device, bounds);
  assert.equal(duplicateLabel.ports[0].centerX, before.ports[0].centerX,
    "an editable label matching another socket must not move the physical port");
  assert.notEqual(duplicateLabel.ports[0].centerX, duplicateLabel.ports[1].centerX);
});

test("switching a hardware panel preserves cable endpoints and picking matches the scene", () => {
  const source = deviceFor("FortiGate 40F", "source");
  const target = deviceFor("FortiGate 100F", "target");
  target.positionY += 250;
  const link = { id: "link", sourceDeviceId: source.id, sourcePortId: source.ports[0].id,
    targetDeviceId: target.id, targetPortId: target.ports[0].id, cableType: "COPPER", sourceSide: "front", targetSide: "front" };
  const engine = layoutEngine({ devices: [source, target], links: [link], racks: [] });
  engine.layoutScene();
  const sourceBox = engine.portBoxByID.get(link.sourcePortId);
  assert.equal(engine.hitPort({ x: sourceBox.centerX, y: sourceBox.centerY }).port.id, link.sourcePortId);
  const before = engine.cableTrackPlan().tracks.get(link.id).route;
  assert.deepEqual(before.source, { x: sourceBox.centerX, y: sourceBox.centerY });
  const saved = structuredClone(engine.state.topology);
  engine.state.setDeviceFaceplateFace(source.id, "front");
  engine.sceneDirty = true;
  engine.layoutScene();
  assert.equal(engine.portBoxByID.has(link.sourcePortId), false);
  const hidden = engine.routingPortBoxByID.get(link.sourcePortId);
  const route = engine.cableTrackPlan().tracks.get(link.id).route;
  assert.deepEqual(route.source, { x: hidden.centerX, y: hidden.centerY });
  assert.ok(engine.faceplateScenes().get(source.id).portal);
  assert.equal(engine.routingPortGeometry().length, source.ports.length + target.ports.length);
  assert.equal(engine.portGeometry().length, target.ports.length);
  assert.deepEqual(engine.state.topology, saved);
  engine.state.setDeviceFaceplateFace(source.id, "rear");
  engine.sceneDirty = true;
  engine.layoutScene();
  assert.deepEqual(engine.cableTrackPlan().tracks.get(link.id).route.source, before.source);
});
