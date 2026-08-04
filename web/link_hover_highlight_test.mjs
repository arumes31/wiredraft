import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { cableBezier, routeFromPoints, routesWithCrossingBridges } from "./static/js/cabling.js";
import { CanvasEngine } from "./static/js/canvas.js";

const engine = Object.create(CanvasEngine.prototype);
const palette = { nativeColor: "#42d9c8", isRainbow: false, channels: [] };
const curve = cableBezier({ x: 0, y: 0 }, { x: 100, y: 40 });
engine.hoveredLink = { link: { id: "link-hovered" } };
engine.linkCurves = [{
  link: { id: "link-hovered" },
  curve,
  thickness: 2.5,
  primaryColor: "#42d9c8",
  role: { key: "inter-rack-high-speed", color: "#3de5e5" },
  vlanPalette: palette,
  warning: true,
}];

const strokes = [];
let vlanRedraw = null;
let pulseRedraw = null;
let warningRedraws = 0;
engine.strokeCurve = (_context, drawnCurve, color, width, alpha) => strokes.push({ drawnCurve, color, width, alpha });
engine.drawVLANColors = (_context, drawnCurve, drawnPalette, thickness, time, alpha) => {
  vlanRedraw = { drawnCurve, drawnPalette, thickness, time, alpha };
};
engine.drawPulse = (_context, drawnCurve, time, color) => { pulseRedraw = { drawnCurve, time, color }; };
engine.drawWarning = () => { warningRedraws += 1; };

engine.drawHoveredLinkHighlight({}, 0);

assert.equal(strokes.length, 4, "hover should redraw the complete route with two halo layers, casing, and role rail");
assert.deepEqual(strokes.map(({ color, width }) => ({ color, width })), [
  { color: "#3de5e5", width: 14.5 },
  { color: "#3de5e5", width: 8.5 },
  { color: "#020607", width: 5.5 },
  { color: "#3de5e5", width: 3.9 },
]);
assert.equal(strokes.every(({ drawnCurve }) => drawnCurve === curve), true, "every highlight layer must cover the same full route");
assert.deepEqual(vlanRedraw, { drawnCurve: curve, drawnPalette: palette, thickness: 2.75, time: 0, alpha: 1 });
assert.equal(pulseRedraw, null, "hover focus should use a static glow instead of adding animation work");
assert.equal(warningRedraws, 1, "warning marker must remain visible above the hover redraw");

engine.hoveredLink = { link: { id: "missing-link" } };
engine.drawHoveredLinkHighlight({}, 0);
assert.equal(strokes.length, 4, "a stale hover target must not draw another route");

const focusEngine = Object.create(CanvasEngine.prototype);
focusEngine.state = { topology: {
  links: [
    { id: "left", sourcePortId: "a1", targetPortId: "b1" },
    { id: "right", sourcePortId: "a2", targetPortId: "c1" },
    { id: "unrelated", sourcePortId: "d1", targetPortId: "e1" },
  ],
  devices: [
    { id: "device-a", ports: [{ id: "a1" }, { id: "a2" }] },
    { id: "device-b", ports: [{ id: "b1" }] },
  ],
} };
focusEngine.hoveredLink = null;
focusEngine.hoveredDevice = null;
focusEngine.hoveredPort = { port: { id: "a1" } };
assert.deepEqual([...focusEngine.hoverFocusLinkIDs()], ["left"], "port hover must focus every path using that connector");
focusEngine.hoveredPort = null;
focusEngine.hoveredDevice = { device: { id: "device-a" } };
assert.deepEqual([...focusEngine.hoverFocusLinkIDs()].sort(), ["left", "right"], "switch hover must focus all attached paths");
const canvasSource = readFileSync(new URL("./static/js/canvas.js", import.meta.url), "utf8");
assert.match(canvasSource, /hasHoverFocus && !hoverFocused \? \.2 : 1/, "unrelated hover paths must dim to exactly 20 percent");
assert.match(canvasSource, /if \(showAllLabels\) this\.drawExportEndpointLabels\(ctx, topology\)/,
  "PNG and PDF documentation renders must add remote endpoint badges");
assert.match(canvasSource, /rearMapping \? RearPanelLinkVisual\.strokeWidth : speedThickness/,
  "rear mappings must use the shared thin stroke instead of speed-based cable thickness");
assert.match(canvasSource, /rearMapping \? RearPanelLinkVisual\.opacity : failoverRole/,
  "rear mappings must use the shared subordinate opacity by default");
assert.match(canvasSource, /\[\$\{rackLabel\(topology, endpoint\.device\)\} - \$\{endpoint\.device\.name\}: \$\{sideLabel\}\$\{endpoint\.port\.label\}\]/,
  "hover tooltips must identify the rack, device, and port for each endpoint");

const underpassEngine = Object.create(CanvasEngine.prototype);
const lowerBaseCurve = cableBezier({ x: 50, y: 0 }, { x: 50, y: 100 });
underpassEngine.hoveredLink = null;
underpassEngine.linkCurves = [{
  link: { id: "lower" }, curve: lowerBaseCurve, baseCurve: lowerBaseCurve, thickness: 3,
  vlanPalette: palette, cableAlpha: .96, role: { color: "#4e9cf5" }, selected: false, selectedPeer: false, traced: false,
}, {
  link: { id: "upper" },
  curve: { ...curve, bridges: [{ crossing: { x: 50, y: 50 }, openingRadius: 7, underRouteIndex: 0 }] },
  thickness: 3, vlanPalette: palette, cableAlpha: .96, role: { color: "#3de5e5" }, dash: [],
  selected: false, selectedPeer: false, traced: false,
}];
const underpassCalls = [];
underpassEngine.strokeCurve = (_context, drawnCurve, color, width) => underpassCalls.push({ kind: "stroke", drawnCurve, color, width });
underpassEngine.drawVLANColors = (_context, drawnCurve) => underpassCalls.push({ kind: "vlan", drawnCurve });
const clipContext = {
  save: () => underpassCalls.push({ kind: "save" }),
  beginPath: () => underpassCalls.push({ kind: "begin" }),
  arc: (x, y, radius) => underpassCalls.push({ kind: "arc", x, y, radius }),
  clip: () => underpassCalls.push({ kind: "clip" }),
  restore: () => underpassCalls.push({ kind: "restore" }),
};
underpassEngine.drawBridgeJumpers(clipContext, 0, { animationScope: "none" });
assert.deepEqual(underpassCalls.find(({ kind }) => kind === "arc"), { kind: "arc", x: 50, y: 50, radius: 7 });
assert.equal(underpassCalls.filter(({ kind }) => kind === "clip").length, 1, "the horizontal jumper redraw must be clipped to the bridge opening");
assert.equal(underpassCalls.find(({ kind }) => kind === "stroke").drawnCurve, underpassEngine.linkCurves[1].curve,
  "the horizontal cable must be redrawn above the vertical track regardless of link order");
assert.equal(underpassCalls.find(({ kind }) => kind === "vlan").drawnCurve, underpassEngine.linkCurves[1].curve,
  "the jumper bow must retain the horizontal cable's VLAN colors");

const [, jumperRoute] = routesWithCrossingBridges([
  routeFromPoints([{ x: 50, y: 0 }, { x: 50, y: 100 }]),
  routeFromPoints([{ x: 0, y: 50 }, { x: 100, y: 50 }]),
]);
const jumperPathCalls = [];
const jumperContext = {
  save: () => {}, restore: () => {}, beginPath: () => {}, stroke: () => {}, setLineDash: () => {},
  moveTo: (x, y) => jumperPathCalls.push({ kind: "move", x, y }),
  lineTo: (x, y) => jumperPathCalls.push({ kind: "line", x, y }),
  arc: (x, y, radius, start, end, anticlockwise) =>
    jumperPathCalls.push({ kind: "arc", x, y, radius, start, end, anticlockwise }),
};
CanvasEngine.prototype.strokeCurve.call({ activeGraphicsProfile: { glows: false } }, jumperContext, jumperRoute, "#fff", 3);
assert.deepEqual(jumperPathCalls.find(({ kind }) => kind === "arc"), {
  kind: "arc", x: 50, y: 50, radius: 5, start: Math.PI, end: Math.PI * 2, anticlockwise: false,
}, "canvas paths must draw the horizontal crossing as a real 5px semicircle");

const drawEngine = Object.create(CanvasEngine.prototype);
drawEngine.state = {
  topology: { vlans: [], linkGroups: [], links: [] },
  selection: null,
  analysis: null,
  traceLinkIDs: new Set(),
};
drawEngine.portBoxes = [];
drawEngine.deviceBoxes = [];
drawEngine.rackBoxes = [];
drawEngine.routeCache = new Map();
drawEngine.trackPlanCache = null;
drawEngine.sceneRevision = 0;
drawEngine.hoveredLink = null;
drawEngine.hoveredPort = null;
drawEngine.hoveredDevice = null;
let highlightPasses = 0;
drawEngine.drawHoveredLinkHighlight = () => { highlightPasses += 1; };
drawEngine.drawLinkGroupGuides = () => {};
drawEngine.drawCableLabels = () => {};

drawEngine.drawLinks({}, 0, true, false);
assert.equal(highlightPasses, 0, "PNG and SVG render passes must not include transient hover highlighting");
drawEngine.drawLinks({}, 0, false, true);
assert.equal(highlightPasses, 1, "interactive frames must include the full-link hover pass");

console.log("full-link hover highlight checks passed");
