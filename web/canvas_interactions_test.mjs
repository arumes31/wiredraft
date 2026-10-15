import assert from "node:assert/strict";
import test from "node:test";

import { EmptyCanvasAction, emptyCanvasAction, nextCanvasTool } from "./static/js/canvas-interactions.js";
import { CanvasEngine } from "./static/js/canvas.js";

assert.equal(emptyCanvasAction(false), EmptyCanvasAction.PAN);
assert.equal(emptyCanvasAction(true), EmptyCanvasAction.SELECT);
assert.equal(nextCanvasTool("annotation-arrow", "annotation-arrow"), "select", "clicking the active drawing tool must unselect it");
assert.equal(nextCanvasTool("annotation-arrow", "annotation-text"), "annotation-text");

const rackFaceEngine = Object.create(CanvasEngine.prototype);
const rackFaceChanges = [];
const rackFaceBox = {
  rack: { id: "rack-dual" }, face: "front", x: 100, y: 200, width: 750,
  expanded: false, primary: true,
};
Object.assign(rackFaceEngine, {
  canvas: { setPointerCapture() {}, style: {} },
  state: {
    isRackDualFace: () => false,
    setRackDualFace: (rackID, expanded) => rackFaceChanges.push({ rackID, expanded }),
  },
  invalidate() {}, eventPoint: () => ({ x: 0, y: 0 }), screenToWorld: (point) => point,
});
const rackFaceControls = rackFaceEngine.rackFaceControls(rackFaceBox);
assert.deepEqual(rackFaceControls.map((control) => control.label), ["FRONT", "REAR", "DUAL"]);
assert.equal(rackFaceEngine.rackFaceControls({ ...rackFaceBox, expanded: true, primary: false }).length, 0,
  "the secondary elevation must not duplicate header controls");
rackFaceEngine.hitRackFaceControl = () => rackFaceControls.at(-1);
rackFaceEngine.pointerDown({ button: 0, pointerId: 5, preventDefault() {} });
assert.deepEqual(rackFaceChanges, [{ rackID: "rack-dual", expanded: true }],
  "the per-rack DUAL control must open an editable second elevation");

const annotationSelections = [];
const annotationEngine = Object.create(CanvasEngine.prototype);
Object.assign(annotationEngine, {
  canvas: { setPointerCapture() {}, style: {} },
  state: {
    topology: { links: [], annotations: [{ id: "arrow-1", type: "arrow", x1: 10, y1: 10, x2: 110, y2: 10 }] },
    select: (type, id) => annotationSelections.push({ type, id }),
  },
  ctx: { save() {}, restore() {}, measureText: () => ({ width: 60 }) },
  camera: { zoom: 1 }, activeTool: "select", isSpaceDown: false,
  invalidate() {}, eventPoint: () => ({ x: 50, y: 14 }), screenToWorld: (point) => point,
  hitPort: () => { throw new Error("annotation hit must win over a port behind it"); },
});
annotationEngine.pointerDown({ button: 0, pointerId: 4, preventDefault() {} });
assert.deepEqual(annotationSelections, [{ type: "annotation", id: "arrow-1" }]);
annotationEngine.state.topology.annotations = [{ id: "note-1", type: "text", x1: 200, y1: 160, x2: 200, y2: 160, text: "RUNBOOK" }];
assert.equal(annotationEngine.hitAnnotation({ x: 225, y: 150 }).id, "note-1", "text annotation labels must be clickable");

const faceplateEngine = Object.create(CanvasEngine.prototype);
const selected = [];
const hoveredCable = { link: { id: "link-on-faceplate" } };
Object.assign(faceplateEngine, {
  canvas: {
    setPointerCapture() {},
    style: {},
  },
  state: {
    topology: { links: [] },
    select: (type, id) => selected.push({ type, id }),
  },
  camera: { zoom: 1 },
  isSpaceDown: false,
  invalidate() {},
  eventPoint: () => ({ x: 130, y: 80 }),
  screenToWorld: (point) => point,
  hitPort: () => null,
  hitLink: () => hoveredCable,
  hitDevice: () => ({ device: { id: "device-behind-cable" } }),
});
faceplateEngine.pointerDown({ button: 0, pointerId: 1, preventDefault() {} });
assert.deepEqual(selected, [{ type: "link", id: "link-on-faceplate" }],
  "a visible cable must win the click over the faceplate behind it");
assert.equal(faceplateEngine.mode, "SELECTED_LINK");
assert.equal(faceplateEngine.linkDrag.sourceLinkID, "link-on-faceplate");

const freePortEngine = Object.create(CanvasEngine.prototype);
const selectedPort = [];
Object.assign(freePortEngine, {
  canvas: {
    setPointerCapture() {},
    style: {},
  },
  state: {
    topology: { links: [] },
    select: (type, id) => selectedPort.push({ type, id }),
  },
  camera: { zoom: 1 },
  isSpaceDown: false,
  invalidate() {},
  eventPoint: () => ({ x: 130, y: 80 }),
  screenToWorld: (point) => point,
  hitPort: () => ({ port: { id: "free-port" } }),
  hitLink: () => { throw new Error("a free port must retain patching priority"); },
});
freePortEngine.pointerDown({ button: 0, pointerId: 2, preventDefault() {} });
assert.deepEqual(selectedPort, [{ type: "port", id: "free-port" }]);
assert.equal(freePortEngine.mode, "DRAFTING_CABLE");

const rearMappedPort = {
  device: { id: "patch-panel-a", category: "PatchPanel" },
  port: { id: "mapped-front-port" },
};
const rearMappedTarget = {
  device: { id: "patch-panel-b", category: "PatchPanel" },
  port: { id: "mapped-front-target" },
};
const rearMappedSelections = [];
const rearMappedPortEngine = Object.create(CanvasEngine.prototype);
Object.assign(rearMappedPortEngine, {
  canvas: {
    setPointerCapture() {},
    style: {},
  },
  state: {
    topology: {
      links: [{
        id: "rear-map",
        sourcePortId: rearMappedPort.port.id,
        sourceSide: "rear",
        targetPortId: rearMappedTarget.port.id,
        targetSide: "rear",
      }],
    },
    select: (type, id) => rearMappedSelections.push({ type, id }),
  },
  camera: { zoom: 1 },
  isSpaceDown: false,
  invalidate() {},
  eventPoint: () => ({ x: 130, y: 80 }),
  screenToWorld: (point) => point,
  hitPort: () => rearMappedPort,
  hitLink: () => { throw new Error("a rear map must not block its front jack"); },
});
rearMappedPortEngine.pointerDown({ button: 0, pointerId: 3, preventDefault() {} });
assert.deepEqual(rearMappedSelections, [{ type: "port", id: rearMappedPort.port.id }]);
assert.equal(rearMappedPortEngine.mode, "DRAFTING_CABLE",
  "a rear-mapped jack must still start an independent front cable");
assert.equal(rearMappedPortEngine.isEligibleTarget(
  { device: { id: "switch-a" }, port: { id: "switch-port" } },
  rearMappedTarget,
), true, "a rear-mapped jack must remain eligible as an independent front target");

const jitterDevice = {
  id: "jitter-device", name: "JITTER DEVICE", rackId: "", rackUnit: 0, rackFace: "",
  positionX: 100, positionY: 100, faceplate: { unitsU: 1 }, ports: [],
};
let jitterPoint = { x: 120, y: 120 };
let jitterDeviceUpdates = 0;
const jitterEngine = Object.create(CanvasEngine.prototype);
Object.assign(jitterEngine, {
  canvas: {
    setPointerCapture() {}, hasPointerCapture: () => false, releasePointerCapture() {}, style: {},
  },
  state: {
    topology: { devices: [jitterDevice], racks: [], links: [] },
    selection: null, history: [], future: [],
    select(type, id) { this.selection = type ? { type, id } : null; },
    emit() {},
  },
  callbacks: { onDeviceUpdate: () => { jitterDeviceUpdates += 1; } },
  camera: { zoom: 1 }, activeTool: "select", isSpaceDown: false, selectedDevices: new Set(),
  deviceBoxes: [{ device: jitterDevice, x: 100, y: 100, width: 690, height: 100 }],
  invalidate() {}, eventPoint: () => jitterPoint, screenToWorld: (point) => point,
  hitRackFaceControl: () => null, hitAnnotation: () => null, hitPort: () => null, hitLink: () => null,
  hitDevice: () => jitterEngine.deviceBoxes[0], hitRack: () => null,
});
jitterEngine.pointerDown({ button: 0, pointerId: 8, preventDefault() {} });
jitterPoint = { x: 122, y: 122 };
jitterEngine.pointerMove({});
assert.equal(jitterEngine.drag.active, false, "sub-threshold touchpad jitter must not begin a device drag");
jitterEngine.pointerUp({ pointerId: 8 });
assert.equal(jitterEngine.state.history.length, 0, "a jitter-only click must not create an undo entry");
assert.equal(jitterDeviceUpdates, 0, "a jitter-only click must not persist a device update");

const jitterRack = { id: "jitter-rack", positionX: 40, positionY: 40, heightU: 42 };
let rackPoint = { x: 80, y: 55 };
let rackUpdates = 0;
const rackJitterEngine = Object.create(CanvasEngine.prototype);
Object.assign(rackJitterEngine, {
  canvas: { setPointerCapture() {}, hasPointerCapture: () => false, releasePointerCapture() {}, style: {} },
  state: {
    topology: { devices: [], racks: [jitterRack], links: [] }, selection: null, history: [], future: [],
    select(type, id) { this.selection = type ? { type, id } : null; }, emit() {},
  },
  callbacks: { onRackUpdate: () => { rackUpdates += 1; } },
  camera: { zoom: 1 }, activeTool: "select", isSpaceDown: false, selectedDevices: new Set(),
  deviceBoxes: [], invalidate() {}, eventPoint: () => rackPoint, screenToWorld: (point) => point,
  hitRackFaceControl: () => null, hitAnnotation: () => null, hitPort: () => null, hitLink: () => null,
  hitDevice: () => null, hitRack: () => ({ rack: jitterRack, x: 40, y: 40, width: 750, height: 1000 }),
});
rackJitterEngine.pointerDown({ button: 0, pointerId: 9, preventDefault() {} });
rackPoint = { x: 82, y: 57 };
rackJitterEngine.pointerMove({});
assert.equal(rackJitterEngine.rackDrag.active, false, "sub-threshold touchpad jitter must not begin a rack drag");
rackJitterEngine.pointerUp({ pointerId: 9 });
assert.equal(rackJitterEngine.state.history.length, 0);
assert.equal(rackUpdates, 0, "a jitter-only rack click must not persist an update");

test("empty room interiors pan the view in locked mode while keeping equipment unchanged", () => {
  const room = { id: "room", positionX: 0, positionY: 0, width: 3000, height: 5000 };
  const topology = { rooms: [room], racks: [{ id: "rack", roomId: "room", positionX: 240, positionY: 340 }], devices: [], links: [] };
  const before = structuredClone(topology);
  let point = { x: 1100, y: 2000 };
  const engine = Object.create(CanvasEngine.prototype);
  Object.assign(engine, {
    canvas: { setPointerCapture() {}, hasPointerCapture: () => false, style: {} },
    state: { topology, history: [], editLock: { allows: () => false, checkExpiry() {} },
      select(type, id) { this.selection = { type, id }; } },
    callbacks: {}, camera: { x: 20, y: 30, zoom: 2 }, activeTool: "select", selectedDevices: new Set(["previous"]),
    invalidate() {}, eventPoint: () => point, screenToWorld: p => p,
    roomRectangles: () => [{ room, x: 0, y: 0, width: 3000, height: 5000 }],
    hitRackFaceControl: () => null, hitAnnotation: () => null, hitPort: () => null,
    hitLink: () => null, hitDevice: () => null, hitRack: () => null,
  });
  engine.pointerDown({ button: 0, pointerId: 1, preventDefault() {} });
  point = { x: 1180, y: 2050 };
  engine.pointerMove({});
  assert.deepEqual(engine.camera, { x: 100, y: 80, zoom: 2 });
  assert.deepEqual(engine.state.selection, { type: "room", id: "room" });
  assert.equal(engine.selectedDevices.size, 0);
  engine.pointerUp({ pointerId: 1 });
  assert.equal(engine.pan, null);
  assert.deepEqual(topology, before);
  assert.equal(engine.state.history.length, 0);
});

const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
test("manual rack dragging preserves displayed placement and blocks overlap without moving neighbours", () => {
  const rack = { id: "r", roomId: "room", positionX: 0, positionY: 0, heightU: 6 };
  const neighbour = { id: "other", roomId: "room", positionX: 3000, positionY: 0, heightU: 6 };
  const mounted = { id: "mounted", rackId: "r", positionX: 30, positionY: 100 };
  let point = { x: 1100, y: 30 };
  const engine = Object.create(CanvasEngine.prototype);
  Object.assign(engine, {
    canvas: { setPointerCapture() {}, hasPointerCapture: () => false, style: {} },
    state: { topology: { racks: [rack, neighbour], devices: [mounted], rooms: [{ id: "room" }], links: [] },
      history: [], future: [], select(type, id) { this.selection = { type, id }; }, emit() {} },
    callbacks: {}, camera: { zoom: 1 }, activeTool: "select", selectedDevices: new Set(),
    deviceBoxes: [], rackBoxes: [{ rack, x: 1000, y: 0, width: 750, height: 684 }, { rack: neighbour, x: 3000, y: 0, width: 750, height: 684 }],
    invalidate() {}, eventPoint: () => point, screenToWorld: p => p,
    hitRackFaceControl: () => null, hitAnnotation: () => null, hitPort: () => null, hitLink: () => null, hitDevice: () => null,
    hitRack: () => ({ rack, x: 1000, y: 0, width: 750, height: 684 }), roomRectangles: () => [],
  });
  engine.pointerDown({ button: 0, pointerId: 1, preventDefault() {} });
  point = { x: 1200, y: 30 };
  engine.pointerMove({});
  assert.equal(rack.positionX, 1100, "a visually shifted rack continues from its displayed origin");
  assert.equal(mounted.positionX, 1130, "stored mounted offsets follow the actual rack displacement");
  point = { x: 2700, y: 30 };
  engine.pointerMove({});
  assert.equal(rack.positionX, 1100, "an overlapping proposal keeps the last valid position");
  assert.equal(neighbour.positionX, 3000);
  assert.equal(engine.canvas.style.cursor, "not-allowed");
  engine.pointerUp({ pointerId: 1 });
  assert.equal(rack.roomId, "room");
  assert.equal(rack.positionX, 1100);
});

for (const { name, moves, roomId, positionX } of [
  { name: "a rejected move into a room", moves: [1100, 3200], positionX: 1000 },
  { name: "only rejected moves", moves: [3200], positionX: 0 },
  { name: "a rejected move into another room", moves: [2200, 7200], roomId: "first" },
  { name: "an accepted room drop", moves: [2200], roomId: "first" },
]) {
  test(`rack room assignment follows the last accepted pointer after ${name}`, () => {
    const rack = { id: "moving", positionX: 0, positionY: 0, heightU: 6 };
    const neighbours = [3000, 7000].map((x, index) => ({ id: `other-${index}`, roomId: index ? "second" : "first",
      positionX: x, positionY: 0, heightU: 6 }));
    const rooms = [2000, 6000].map((x, index) => ({ id: index ? "second" : "first", positionX: x, positionY: 0, width: 3000, height: 1800 }));
    let point = { x: 100, y: 30 }, saved;
    const engine = Object.create(CanvasEngine.prototype);
    Object.assign(engine, {
      canvas: { setPointerCapture() {}, hasPointerCapture: () => false, style: {} },
      state: { topology: { racks: [rack, ...neighbours], devices: [], rooms, links: [] }, history: [], future: [],
        select(type, id) { this.selection = { type, id }; }, emit() {} },
      callbacks: { onRackUpdate: item => { saved = item; } },
      camera: { zoom: 1 }, activeTool: "select", selectedDevices: new Set(), deviceBoxes: [],
      rackBoxes: neighbours.map(rack => ({ rack, x: rack.positionX, y: 0, width: 750, height: 684 })),
      invalidate() {}, eventPoint: () => point, screenToWorld: p => p,
      hitRackFaceControl: () => null, hitAnnotation: () => null, hitPort: () => null, hitLink: () => null, hitDevice: () => null,
      hitRack: () => ({ rack, x: 0, y: 0, width: 750, height: 684 }),
      roomRectangles: () => rooms.map(room => ({ room, x: room.positionX, y: 0, width: room.width, height: room.height })),
    });
    engine.pointerDown({ button: 0, pointerId: 1, preventDefault() {} });
    for (const x of moves) {
      point = { x, y: 30 };
      engine.pointerMove({});
    }
    engine.pointerUp({ pointerId: 1 });
    assert.equal(rack.roomId, roomId);
    assert.equal(saved.roomId, roomId, "persist the same room as the accepted placement");
    if (positionX !== undefined) assert.equal(rack.positionX, positionX);
    assert.deepEqual(neighbours.map(rack => rack.positionX), [3000, 7000]);
  });
}

let navigationFlush = null;
let navigationFrames = 0;
globalThis.requestAnimationFrame = (callback) => {
  navigationFrames += 1;
  navigationFlush = callback;
  return navigationFrames;
};
try {
  const navigationEngine = Object.create(CanvasEngine.prototype);
  Object.assign(navigationEngine, {
    navigationMode: "trackpad", navigationDetector: {}, lastDetectedNavigationMode: "",
    navigationFrame: 0, pendingNavigation: null, camera: { x: 0, y: 0, zoom: 1 }, height: 600,
    pointerScreen: { x: 0, y: 0 }, pointerWorld: { x: 0, y: 0 }, callbacks: {},
    eventPoint: () => ({ x: 200, y: 150 }), invalidate() {},
  });
  navigationEngine.flushNavigation = navigationEngine.flushNavigation.bind(navigationEngine);
  const wheelEvent = { deltaX: 5, deltaY: 20, deltaMode: 0, timeStamp: 10, preventDefault() {} };
  navigationEngine.wheel(wheelEvent);
  navigationEngine.wheel({ ...wheelEvent, timeStamp: 20 });
  assert.equal(navigationFrames, 1, "rapid touchpad input must share one animation frame");
  assert.deepEqual(navigationEngine.camera, { x: 0, y: 0, zoom: 1 }, "camera changes must wait for the frame boundary");
  navigationFlush();
  assert.deepEqual(navigationEngine.camera, { x: -10, y: -40, zoom: 1 });
} finally {
  globalThis.requestAnimationFrame = originalRequestAnimationFrame;
}

test("mixed-height group drops assign rooms by each device center, independent of the grab offset", () => {
  for (const grabY of [20, 350]) {
    const topology = { racks: [], links: [], rooms: [
      { id: "upper", positionX: 0, positionY: 0, width: 1800, height: 300 },
      { id: "lower", positionX: 0, positionY: 300, width: 1800, height: 600 },
    ], devices: [
      { id: "short", positionX: 1000, positionY: 100, faceplate: { unitsU: 1 } },
      { id: "tall", positionX: 1000, positionY: 200, faceplate: { unitsU: 4 } },
    ] };
    const snapshot = structuredClone(topology);
    let saved;
    const engine = Object.create(CanvasEngine.prototype);
    Object.assign(engine, {
      canvas: { style: {}, hasPointerCapture: () => false },
      state: { topology, history: [], future: [], emit() {} },
      callbacks: { onDevicesUpdate: devices => { saved = devices; } },
      invalidate() {},
      drag: { active: true, snapshot, offset: { x: 80, y: grabY }, invalidIDs: new Set(), occupiedLandings: new Map(),
        originals: new Map(snapshot.devices.map(device => [device.id, { device, width: 690, height: device.faceplate.unitsU * 100 }])),
        roomBoxes: topology.rooms.map(room => ({ room, x: room.positionX, y: room.positionY, width: room.width, height: room.height })) },
    });
    engine.pointerUp({ pointerId: 1 });
    assert.deepEqual(topology.devices.map(device => device.roomId), ["upper", "lower"]);
    assert.deepEqual(saved.map(device => device.roomId), ["upper", "lower"]);
    assert.deepEqual(engine.state.history, [snapshot]);
  }
});

console.log("canvas interaction checks passed");
