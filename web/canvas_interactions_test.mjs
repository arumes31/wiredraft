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

console.log("canvas interaction checks passed");
