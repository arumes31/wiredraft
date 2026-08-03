import assert from "node:assert/strict";

import { cableBezier } from "./static/js/cabling.js";
import { CanvasEngine } from "./static/js/canvas.js";

const engine = Object.create(CanvasEngine.prototype);
engine.camera = { x: 40, y: -20, zoom: 2 };
engine.canvas = { getBoundingClientRect: () => ({ left: 100, top: 50 }) };
engine.portBoxes = [
  { port: { id: "lower" }, x: 10, y: 10, width: 20, height: 10, centerX: 20, centerY: 15 },
  { port: { id: "topmost" }, x: 15, y: 10, width: 20, height: 10, centerX: 25, centerY: 15 },
];
engine.deviceBoxes = [
  { device: { id: "lower-device" }, x: 0, y: 0, width: 100, height: 100 },
  { device: { id: "top-device" }, x: 20, y: 20, width: 100, height: 100 },
];
engine.rackBoxes = [{ rack: { id: "rack" }, x: 0, y: 0, width: 400, height: 600 }];
engine.linkCurves = [{ link: { id: "link" }, curve: cableBezier({ x: 0, y: 200 }, { x: 200, y: 200 }) }];

assert.deepEqual(engine.eventPoint({ clientX: 150, clientY: 100 }), { x: 50, y: 50 });
assert.deepEqual(engine.screenToWorld({ x: 100, y: 100 }), { x: 30, y: 60 });

assert.equal(engine.hitPort({ x: 15, y: 15 }).port.id, "topmost", "last rendered overlapping port must win");
assert.equal(engine.hitPort({ x: 8, y: 15 }), null);
assert.equal(engine.hitPort({ x: 8, y: 15 }, 2).port.id, "lower", "tolerance must include the exact expanded boundary");
assert.equal(engine.nearestPort({ x: 24, y: 15 }, 20).port.id, "topmost");
assert.equal(engine.nearestPort({ x: 100, y: 100 }, 5), null);

assert.equal(engine.hitDevice({ x: 25, y: 25 }).device.id, "top-device", "topmost device must win overlap");
assert.equal(engine.hitDevice({ x: 0, y: 0 }).device.id, "lower-device", "inclusive bounds must remain clickable");
assert.equal(engine.hitRack({ x: 400, y: 600 }).rack.id, "rack", "rack lower-right boundary must be inclusive");
assert.equal(engine.hitRack({ x: 400.01, y: 600 }), null);

assert.equal(engine.hitLink({ x: 100, y: 203 }).link.id, "link");
assert.equal(engine.hitLink({ x: 100, y: 205 }), null, "zoom-scaled cable tolerance must not over-select nearby space");

console.log("canvas hit-testing boundary checks passed");
