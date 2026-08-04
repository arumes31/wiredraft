import assert from "node:assert/strict";
import test from "node:test";

import { TopologyMinimap } from "./static/js/minimap.js";

test("minimap draws bounded scene geometry and navigates by pointer", () => {
  const events = new Map();
  const operations = [];
  const context = new Proxy({}, {
    get(target, property) {
      if (!(property in target)) target[property] = (...args) => operations.push([property, ...args]);
      return target[property];
    },
    set(target, property, value) {
      target[property] = value;
      operations.push([`set:${String(property)}`, value]);
      return true;
    },
  });
  const canvas = {
    clientWidth: 100,
    clientHeight: 50,
    width: 0,
    height: 0,
    getContext: () => context,
    addEventListener: (type, listener) => events.set(type, listener),
    getBoundingClientRect: () => ({ left: 10, top: 20, width: 100, height: 50 }),
  };
  const stateListeners = new Map();
  const state = { addEventListener: (type, listener) => stateListeners.set(type, listener) };
  const centers = [];
  const engine = {
    worldBounds: () => ({ x: -100, y: -50, width: 400, height: 200 }),
    rackRectangles: () => [{ x: -80, y: -30, width: 120, height: 180, rack: { color: "#123456" } }],
    deviceRectangles: () => [{ x: -60, y: -10, width: 80, height: 20 }],
    viewportWorldRect: () => ({ x: 0, y: 0, width: 1, height: 1 }),
    centerOn: (x, y) => centers.push([x, y]),
  };
  const ratioDescriptor = Object.getOwnPropertyDescriptor(globalThis, "devicePixelRatio");
  Object.defineProperty(globalThis, "devicePixelRatio", { configurable: true, value: 3 });
  try {
    const minimap = new TopologyMinimap(canvas, engine, state);
    stateListeners.get("change")();
    assert.equal(canvas.width, 200, "pixel ratio should be capped at two");
    assert.equal(canvas.height, 100);
    assert.ok(operations.some(([name]) => name === "fillRect"));
    assert.ok(operations.some(([name, , , width, height]) => name === "strokeRect" && width === 8 && height === 6));

    const transform = minimap.transform(100, 50);
    assert.equal(transform.scale, 0.17);
    assert.equal(transform.x(-100), 16);
    assert.equal(transform.y(-50), 8);

    events.get("pointerdown")({ clientX: 60, clientY: 45 });
    assert.equal(minimap.dragging, true);
    assert.equal(centers.length, 1);
    events.get("pointermove")({ clientX: 70, clientY: 45 });
    assert.equal(centers.length, 2);
    events.get("pointerup")();
    events.get("pointermove")({ clientX: 80, clientY: 45 });
    assert.equal(centers.length, 2);
    events.get("pointercancel")();
    assert.equal(minimap.dragging, false);
  } finally {
    if (ratioDescriptor) Object.defineProperty(globalThis, "devicePixelRatio", ratioDescriptor);
    else delete globalThis.devicePixelRatio;
  }
});
