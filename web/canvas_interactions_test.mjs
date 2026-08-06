import assert from "node:assert/strict";

import { EmptyCanvasAction, emptyCanvasAction, nextCanvasTool } from "./static/js/canvas-interactions.js";
import { CanvasEngine } from "./static/js/canvas.js";

assert.equal(emptyCanvasAction(false), EmptyCanvasAction.PAN);
assert.equal(emptyCanvasAction(true), EmptyCanvasAction.SELECT);
assert.equal(nextCanvasTool("annotation-arrow", "annotation-arrow"), "select", "clicking the active drawing tool must unselect it");
assert.equal(nextCanvasTool("annotation-arrow", "annotation-text"), "annotation-text");

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

const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
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

console.log("canvas interaction checks passed");
