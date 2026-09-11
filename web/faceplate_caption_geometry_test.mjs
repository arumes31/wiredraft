import assert from "node:assert/strict";
import { test } from "node:test";
import { hardwareCatalog, instantiateProfile } from "./static/js/catalog.js";
import { resolveExtremeFaceplate } from "./static/js/faceplate-extreme-models.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";
import { CanvasEngine } from "./static/js/canvas.js";
import { buildSVGDocument } from "./static/js/export.js";

const bounds = { x: 0, y: 0, width: 690, height: 100 };

/** Create a real VSP inventory with deterministic identities for comparing both renderers. */
function fixture() {
  const device = instantiateProfile(hardwareCatalog.find((entry) => entry.model === "VSP 7400-48Y-8C"), "VSP", bounds);
  device.id = "vsp";
  device.ports.forEach((port) => { port.id = `p${port.portIndex}`; });
  return device;
}

/** Restore temporary source geometry after exercising invalid optional dimensions. */
function withAnchors(callback) {
  const device = fixture();
  const anchors = resolveExtremeFaceplate(device).faces.front.ports.slice(0, 2).map((slot) => slot.descriptionAnchor);
  const originals = anchors.map((anchor) => ({ ...anchor }));
  try { callback(device, anchors); } finally {
    anchors.forEach((anchor, index) => {
      for (const key of Object.keys(anchor)) delete anchor[key];
      Object.assign(anchor, originals[index]);
    });
  }
}

test("compact caption dimensions reject nonnumeric values and keep readable font and padding limits", () => {
  withAnchors((device, [anchor]) => {
    for (const [fontSize, boxHeight, expected] of [
      [undefined, undefined, [8, 11]], [NaN, Infinity, [8, 11]],
      [-1, -10, [5.5, 7]], [99, 0, [8, 9.5]],
      ["6", "7", [8, 11]], [5.5, 999, [5.5, 11]], [6, 8, [6, 8]],
    ]) {
      Object.assign(anchor, { fontSize, boxHeight });
      const label = buildFaceplateScene(device, bounds).ports[0].labelPlacement;
      assert.deepEqual([label.fontSize, label.boxHeight], expected);
    }
  });
});

test("horizontal caption fitting only constrains plates whose actual vertical extents intersect", () => {
  withAnchors((device, [first, second]) => {
    device.ports = device.ports.slice(0, 2);
    Object.assign(first, { x: .2, y: .4, fontSize: 5.5, boxHeight: 7 });
    Object.assign(second, { x: .21, y: .4 + 8 / 76, fontSize: 5.5, boxHeight: 7 });
    assert.ok(buildFaceplateScene(device, bounds).ports.every((box) => box.labelPlacement.maxWidth === 30),
      "separated compact plates must not compress one another as if both were11px tall");
    first.boxHeight = 11;
    second.boxHeight = 11;
    assert.ok(buildFaceplateScene(device, bounds).ports.every((box) => box.labelPlacement.maxWidth < 2),
      "the same centers with default plates do intersect and must constrain width");
  });
});

test("Canvas and SVG use the same compact plate heights and font sizes while ordinary captions stay11px", () => {
  const device = fixture();
  const scene = buildFaceplateScene(device, bounds);
  const rectangles = [];
  const texts = [];
  const context = {
    save() {}, restore() {}, beginPath() {}, fill() {}, stroke() {},
    measureText: (text) => ({ width: text.length * 4 }),
    roundRect: (...args) => rectangles.push(args),
    fillText: (...args) => texts.push({ args, font: context.font }),
  };
  CanvasEngine.prototype.drawPortDescriptions.call({ portBoxes: scene.ports,
    deviceBoxByID: new Map([[device.id, { ...bounds, device }]]), state: {} }, context);
  const topology = { name: "Compact captions", devices: [device], links: [], racks: [], vlans: [], linkGroups: [] };
  const svg = buildSVGDocument(topology, {
    ctx: context, worldBounds: () => bounds, portCenters: () => new Map(),
    portGeometry: () => scene.ports, routingPortGeometry: () => scene.ports,
    faceplateScenes: () => new Map([[device.id, scene]]),
    deviceRectangles: () => [{ ...bounds, device }], rackRectangles: () => [],
  });
  const svgPlates = [...svg.matchAll(/<rect data-layer="port-description"[^>]+>/g)].map(([markup]) =>
    Object.fromEntries([...markup.matchAll(/\b(x|y|width|height)="([^"]+)"/g)].map(([, key, value]) => [key, Number(value)])));
  const svgFonts = [...svg.matchAll(/<text class="port-label"[^>]+font-size="([^"]+)"/g)].map(([, value]) => Number(value));
  assert.equal(svgPlates.length, scene.ports.length);
  for (const [index, box] of scene.ports.entries()) {
    const label = box.labelPlacement;
    const [x, y, width, height] = rectangles[index];
    assert.equal(height, label.boxHeight);
    assert.equal(y, label.y - label.boxHeight / 2);
    for (const [key, expected] of Object.entries({ x: x + 50, y: y + 50, width, height }))
      assert.ok(Math.abs(svgPlates[index][key] - expected) < 1e-8, `${box.port.id} ${key} differs between renderers`);
    assert.equal(svgFonts[index], label.fontSize);
    assert.ok(texts[index].font.includes(`${label.fontSize}px`));
  }
  assert.deepEqual([...new Set(rectangles.map((rect) => rect[3]))].sort((a, b) => a - b), [7, 8, 11]);
});
