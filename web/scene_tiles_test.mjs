import assert from "node:assert/strict";
import test from "node:test";

import { CanvasEngine } from "./static/js/canvas.js";
import { MAX_TILES_PER_OPERATION, SceneTileIndex } from "./static/js/scene-tiles.js";

test("tile index stays bounded for coordinates the renderer cannot enumerate", () => {
  const index = new SceneTileIndex();
  const near = { x: 10, y: 10, width: 100, height: 100 };
  const unsafe = { x: 2 ** 80, y: -(2 ** 80), width: 690, height: 100 };
  const huge = { x: -1e7, y: -1e7, width: 2e7, height: 2e7 };
  for (const item of [near, unsafe, huge]) index.insert(item);

  assert.equal(index.keys(unsafe), null);
  assert.equal(index.keys(huge), null);
  assert.ok(index.tiles.size <= MAX_TILES_PER_OPERATION);
  assert.deepEqual(new Set(index.query({ x: 0, y: 0, width: 200, height: 200 })), new Set([near, huge]));
  assert.deepEqual(new Set(index.query(huge)), new Set([near, huge]));
  assert.deepEqual(index.query({ x: 2 ** 80 - 2 ** 70, y: -(2 ** 80) - 2 ** 70, width: 2 ** 71, height: 2 ** 71 }), [unsafe]);

  index.clear();
  assert.equal(index.items.length + index.untiled.length + index.tiles.size, 0);
});

test("export grid spacing follows output pixels instead of world size", () => {
  let lines = 0;
  const ctx = {
    beginPath() {}, stroke() {}, lineTo() {},
    moveTo() { lines += 1; },
  };
  const engine = Object.create(CanvasEngine.prototype);
  const profile = { minorGrid: true };
  // A 7000px export of a map spanning the full supported canvas range.
  const zoom = 7000 / 2e7;
  engine.drawGrid(ctx, 7000, 7000, { x: 1e7 * zoom, y: 1e7 * zoom, zoom }, profile);
  assert.ok(lines > 0, "major grid is still drawn");
  assert.ok(lines <= 7000 / 8 * 2 + 4, `drew ${lines} grid lines`);

  lines = 0;
  engine.drawGrid(ctx, 1000, 800, { x: 0, y: 0, zoom: 1 }, profile);
  assert.equal(lines, 1000 / 20 + 800 / 20 + 1000 / 100 + 800 / 100, "interactive zoom keeps both grids");

  lines = 0;
  engine.drawGrid(ctx, 1000, 800, { x: 0, y: 0, zoom: Number.NaN }, profile);
  assert.equal(lines, 0);
});
