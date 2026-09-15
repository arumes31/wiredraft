import assert from "node:assert/strict";
import { test } from "node:test";
import { CanvasEngine } from "./static/js/canvas.js";

for (const kind of ["rack", "device"]) {
  test(`${kind} dragging crosses the origin in every direction and stays on the grid`, () => {
    const item = { id: "item", positionX: 0, positionY: 0 };
    const engine = Object.create(CanvasEngine.prototype);
    Object.assign(engine, {
      state: { topology: { racks: kind === "rack" ? [item] : [], devices: kind === "device" ? [item] : [] }, selection: { id: item.id }, emit() {} },
      canvas: { style: {} }, camera: { zoom: 1 }, callbacks: {}, rackFaceBoxes: [],
      invalidate() {}, eventPoint: (event) => event, screenToWorld: (point) => point,
    });
    if (kind === "rack") engine.rackDrag = { active: true, start: { x: 0, y: 0 }, original: { x: 0, y: 0 } };
    else engine.drag = { active: true, start: { x: 0, y: 0 }, invalidIDs: new Set(), occupiedLandings: new Map(), originals: new Map([[item.id, { x: 0, y: 0 }]]) };
    for (const [x, y] of [[-203, -307], [203, -307], [-203, 307], [203, 307]]) {
      engine.pointerMove({ x, y });
      assert.equal(Math.sign(item.positionX), Math.sign(x));
      assert.equal(Math.sign(item.positionY), Math.sign(y));
      assert.ok(Math.abs(item.positionX - x) <= 10);
      assert.ok(Math.abs(item.positionY - y) <= 10);
      assert.equal(Math.abs(item.positionX % 10), 0);
      assert.equal(Math.abs(item.positionY % 10), 0);
    }
  });
}
