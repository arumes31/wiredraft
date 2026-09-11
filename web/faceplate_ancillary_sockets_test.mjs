import assert from "node:assert/strict";
import test from "node:test";
import { hardwareCatalog, instantiateProfile } from "./static/js/catalog.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";
import { hardwarePrimitives } from "./static/js/hardware-components.js";
import { connectorKind } from "./static/js/termination.js";
import { CanvasEngine } from "./static/js/canvas.js";
import { AppState } from "./static/js/state.js";
import { SceneTileIndex } from "./static/js/scene-tiles.js";

const models = ["7010 family", "Network UPS family"];

/** Reconstruct original catalog inventories independently of the corrected physical endpoints. */
function fixture(model, legacy = false) {
  let catalog = hardwareCatalog.find((row) => row.model === model && row.vendor === (model === models[0] ? "Arista" : "Eaton"));
  assert.ok(catalog);
  if (legacy) catalog = { ...catalog, units: model === models[0] ? 2 : 1, inventoryRevision: 0, groups: model === models[0] ? [
    { zone: "uplink", count: 48, type: "SFP28_25G", speed: 25000, poe: false, prefix: "SFP28" },
    { zone: "uplink", count: 8, type: "QSFP_DD_400G", speed: 400000, poe: false, prefix: "QSFP-DD" },
    { zone: "management", count: 1, type: "RJ45_1G", speed: 1000, poe: false, prefix: "MGMT" },
    { zone: "management", count: 1, type: "Console", speed: 0, poe: false, prefix: "CONSOLE" },
  ] : [
    { zone: "management", count: 1, type: "RJ45_1G", speed: 1000, poe: false, prefix: "NETWORK" },
    { zone: "management", count: 1, type: "Power", speed: 0, poe: false, prefix: "AC" },
  ] };
  const device = instantiateProfile(catalog, model, { x: 20, y: 35 });
  device.id = `fixture-${model}`;
  for (const port of device.ports) { port.id = `${device.id}-${port.portIndex}`; port.deviceId = device.id; }
  return device;
}

/** Build both faces using the actual saved rack allocation. */
function scenes(device, width = 690) {
  return ["front", "rear"].map((face) => buildFaceplateScene(device,
    { x: 20, y: 35, width, height: device.faceplate.unitsU * 100 }, { face }));
}

/** Select ancillary sockets independently of decorative ports already authored in the panel. */
function ancillary(scene) { return scene.components.filter((part) => part.ancillarySocket); }

/** Exercise actual endpoint registration and picking without creating a browser canvas. */
function layoutEngine(device) {
  const state = new AppState(); state.setTopology({ devices: [device], links: [], racks: [] });
  const engine = Object.create(CanvasEngine.prototype);
  Object.assign(engine, { state, sceneDirty: true, sceneRevision: 0,
    rackTiles: new SceneTileIndex(), deviceTiles: new SceneTileIndex(),
    routingDeviceBoxes: [], routingPortBoxes: [], rackBoxes: [], trackPlanCache: null,
    routingPlanRevision: 0, camera: { x: 0, y: 0, zoom: 1 } });
  engine.layoutScene(); return engine;
}

/** Include connector strokes when testing primitive containment at both backing-store scales. */
function bounds(part) {
  const half = part.stroke ? (part.strokeWidth || 0) / 2 : 0;
  if (part.kind === "polygon") return [Math.min(...part.points.map(([x]) => x)) - half,
    Math.min(...part.points.map(([, y]) => y)) - half, Math.max(...part.points.map(([x]) => x)) + half,
    Math.max(...part.points.map(([, y]) => y)) + half];
  if (part.kind === "circle") return [part.cx - part.r - half, part.cy - part.r - half, part.cx + part.r + half, part.cy + part.r + half];
  if (part.kind === "line") return [Math.min(part.x1, part.x2) - half, Math.min(part.y1, part.y2) - half, Math.max(part.x1, part.x2) + half, Math.max(part.y1, part.y2) + half];
  assert.notEqual(part.kind, "text", "ancillary socket must not inherit an in-socket label");
  return [part.x - half, part.y - half, part.x + part.width + half, part.y + part.height + half];
}

test("original 7010 placeholder retains all54 physical sockets without inventing logical endpoints", () => {
  const device = fixture(models[0], true), before = structuredClone(device), [front, rear] = scenes(device);
  assert.equal(device.ports.length, 58); assert.equal(device.faceplate.unitsU, 2);
  assert.equal(front.ports.length, 2); assert.equal(front.unmappedPorts.length, 56);
  assert.equal(ancillary(front).length, 52); assert.equal(ancillary(rear).length, 0);
  assert.equal(ancillary(front).filter((part) => part.kind === "rj45").length, 24);
  assert.equal(ancillary(front).filter((part) => part.kind === "rj45-inverted").length, 24);
  assert.equal(ancillary(front).filter((part) => part.kind === "sfp").length, 4);
  assert.deepEqual(ancillary(front).map((part) => part.physicalSlotIndex).sort((a, b) => a - b), Array.from({ length: 52 }, (_, i) => i + 1));
  assert.equal(rear.hiddenPorts.length, 58); assert.deepEqual(device, before);
});

test("original Eaton two-endpoint inventory retains verified portrait DB9 and Micro-B art only on its rear", () => {
  const device = fixture(models[1], true), before = structuredClone(device), [front, rear] = scenes(device);
  assert.equal(device.ports.length, 2); assert.equal(device.faceplate.unitsU, 1);
  assert.equal(rear.ports.length, 2); assert.equal(rear.unmappedPorts.length, 0);
  assert.deepEqual(ancillary(rear).map((part) => [part.physicalSlotIndex, part.kind]), [[3, "eaton-db9"], [4, "eaton-micro"]]);
  assert.ok(ancillary(rear).every((part) => part.height > part.width));
  assert.equal(ancillary(front).length, 0); assert.equal(front.hiddenPorts.length, 2); assert.deepEqual(device, before);
});

test("complete current inventories produce no supplemental sockets on either physical face", () => {
  for (const model of models) {
    const device = fixture(model), panels = scenes(device);
    assert.equal(panels.flatMap(ancillary).length, 0);
    assert.equal(panels.flatMap((scene) => scene.ports).length, device.ports.length);
    assert.ok(panels.every((scene) => scene.unmappedPorts.length === 0));
  }
});

test("every complete current model in the catalog avoids supplemental double drawing", () => {
  let checked = 0;
  for (const catalog of hardwareCatalog) {
    const device = instantiateProfile(catalog, catalog.model, { x: 0, y: 0 });
    const panels = scenes(device);
    if (panels[0].profile?.fidelity !== "model") continue;
    checked++;
    assert.equal(panels.flatMap(ancillary).length, 0, `${catalog.vendor} ${catalog.model}`);
  }
  assert.ok(checked > 400);
});

test("opposite-face claims stay hidden without producing a duplicate service socket", () => {
  const device = fixture(models[0], true); device.model = "7020 family";
  const [front, rear] = scenes(device);
  assert.equal(front.ports.length, 0); assert.equal(front.hiddenPorts.length, 58);
  assert.equal(rear.ports.length, 2); assert.equal(rear.hiddenPorts.length, 56);
  assert.equal(ancillary(front).length, 54); assert.equal(ancillary(rear).length, 0);
});

test("sparse reversed and edited saved inventories keep claims stable and preserve every data field", () => {
  const device = fixture(models[0], true);
  device.ports = device.ports.filter((port) => [1, 49, 57].includes(port.portIndex)).reverse();
  for (const port of device.ports) { port.label = `Saved custom ${port.portIndex}`; port.speedMbps = 100; port.nativeVlan = 42; port.allowedVlans = [42, 81]; }
  device.rackId = "saved-rack"; device.rackPosition = 17;
  const topology = { devices: [device], links: [{ id: "saved-link", sourceDeviceId: device.id, sourcePortId: device.ports[0].id, targetPortId: "peer-port" }] };
  const before = structuredClone(topology), [front] = scenes(device);
  assert.equal(front.ports.length, 1); assert.equal(front.ports[0].port.portIndex, 57);
  assert.equal(front.ports[0].displayLabel, "Saved custom 57");
  assert.equal(ancillary(front).length, 53); assert.equal(front.unmappedPorts.length, 2);
  assert.equal(ancillary(front).filter((part) => part.physicalSlotIndex === 53).length, 0);
  assert.deepEqual(topology, before);
});

test("duplicate logical claims leave one physical socket and preserve the rejected endpoint as unmapped", () => {
  const device = fixture(models[0], true), original = device.ports.find((port) => port.portIndex === 57);
  device.ports = [{ ...original, id: "first-claim" }, { ...original, id: "duplicate-claim" }];
  const [front] = scenes(device);
  assert.equal(front.ports.length, 1); assert.equal(front.ports[0].port.id, "first-claim");
  assert.deepEqual(front.unmappedPorts.map((port) => port.id), ["duplicate-claim"]);
  assert.equal(ancillary(front).length, 53);
  assert.equal(ancillary(front).some((part) => part.physicalSlotIndex === 53), false);
});

test("unknown revisions and empty inventories show verified hardware without mapping new endpoints", () => {
  for (const model of models) for (const empty of [false, true]) {
    const device = fixture(model, true); device.faceplate.inventoryRevision = 987;
    if (empty) device.ports = [];
    const before = structuredClone(device), panels = scenes(device);
    assert.equal(panels.flatMap((scene) => scene.ports).length, 0);
    assert.equal(panels.flatMap(ancillary).length, model === models[0] ? 54 : 4);
    for (const scene of panels) assert.equal(scene.unmappedPorts.length, device.ports.length);
    assert.deepEqual(device, before);
  }
});

test("ancillary geometry matches canonical socket art at460/690 and remains bounded at1x/2x", () => {
  let checked = 0;
  for (const model of models) for (const width of [460, 690]) for (const scene of scenes(fixture(model, true), width)) {
    for (const component of ancillary(scene)) {
      checked++;
      const slot = scene.profile.faces[scene.face].ports.find((candidate) => candidate.portIndex === component.physicalSlotIndex);
      assert.ok(slot); assert.equal(component.physicalFace, scene.face); assert.equal(component.role, "unclaimed-physical-socket");
      const expected = { kind: slot.connectorKind || connectorKind(slot.type),
        x: scene.chassis.x + (slot.x - slot.width / 2) * scene.chassis.width,
        y: scene.chassis.y + (slot.y - slot.height / 2) * scene.chassis.height,
        width: slot.width * scene.chassis.width, height: slot.height * scene.chassis.height };
      for (const key of ["x", "y", "width", "height"]) assert.ok(Math.abs(component[key] - expected[key]) < 1e-8);
      assert.deepEqual(hardwarePrimitives({ ...expected, x: component.x, y: component.y }), hardwarePrimitives(component));
      for (const key of ["port", "id", "portId", "deviceId", "status", "label"]) assert.equal(component[key], undefined);
      for (const scale of [1, 2]) {
        const scaled = { ...component, x: component.x * scale, y: component.y * scale, width: component.width * scale, height: component.height * scale };
        const primitives = hardwarePrimitives(scaled); assert.ok(primitives.length > 0);
        for (const primitive of primitives) {
          const [left, top, right, bottom] = bounds(primitive);
          assert.ok(left >= scaled.x - 1e-8 && top >= scaled.y - 1e-8 && right <= scaled.x + scaled.width + 1e-8 && bottom <= scaled.y + scaled.height + 1e-8, `${model} ${width} ${scale} ${component.kind}`);
        }
      }
    }
  }
  assert.equal(checked, 108);
});

test("ancillary sockets never enter visible or routing endpoint maps or respond to port picking", () => {
  for (const model of models) {
    const device = fixture(model, true), engine = layoutEngine(device), scene = engine.faceplateScenes().get(device.id);
    assert.ok(ancillary(scene).length > 0);
    assert.equal(engine.portGeometry().length, 2);
    assert.equal(engine.portCenters().size, 2);
    assert.equal(engine.routingPortGeometry().length, device.ports.length);
    assert.deepEqual(new Set(engine.routingPortGeometry().map((box) => box.port.id)), new Set(device.ports.map((port) => port.id)));
    for (const component of ancillary(scene)) {
      const point = { x: component.x + component.width / 2, y: component.y + component.height / 2 };
      assert.equal(engine.hitPort(point), null); assert.equal(engine.nearestPort(point, .01), null);
    }
  }
});

test("schematic and imported devices do not acquire supplemental physical sockets", () => {
  const device = { id: "custom", category: "Switch", faceplate: { rows: 1, unitsU: 1 }, ports: [{ id: "custom-port", type: "RJ45_1G" }] };
  for (const scene of scenes(device)) { assert.equal(scene.profile, null); assert.equal(ancillary(scene).length, 0); assert.equal(scene.ports.length, 1); }
});
