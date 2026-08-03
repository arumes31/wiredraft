import assert from "node:assert/strict";

import { cableBezier } from "./static/js/cabling.js";
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

assert.equal(strokes.length, 3, "hover should redraw the complete route with two halo layers and an underlay");
assert.deepEqual(strokes.map(({ color, width }) => ({ color, width })), [
  { color: "#7affee", width: 16.5 },
  { color: "#7affee", width: 9.5 },
  { color: "#020607", width: 5.5 },
]);
assert.equal(strokes.every(({ drawnCurve }) => drawnCurve === curve), true, "every highlight layer must cover the same full route");
assert.deepEqual(vlanRedraw, { drawnCurve: curve, drawnPalette: palette, thickness: 3.25, time: 0, alpha: 1 });
assert.deepEqual(pulseRedraw, { drawnCurve: curve, time: 0, color: "#42d9c8" });
assert.equal(warningRedraws, 1, "warning marker must remain visible above the hover redraw");

engine.hoveredLink = { link: { id: "missing-link" } };
engine.drawHoveredLinkHighlight({}, 0);
assert.equal(strokes.length, 3, "a stale hover target must not draw another route");

const underpassEngine = Object.create(CanvasEngine.prototype);
const lowerBaseCurve = cableBezier({ x: 50, y: 0 }, { x: 50, y: 100 });
underpassEngine.hoveredLink = null;
underpassEngine.linkCurves = [{
  link: { id: "lower" }, curve: lowerBaseCurve, baseCurve: lowerBaseCurve, thickness: 3,
  vlanPalette: palette, cableAlpha: .96, selected: false, selectedPeer: false, traced: false,
}, {
  link: { id: "upper" },
  curve: { ...curve, bridges: [{ crossing: { x: 50, y: 50 }, openingRadius: 7, underRouteIndex: 0 }] },
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
underpassEngine.drawBridgeUnderpasses(clipContext, 0, { animationScope: "none" });
assert.deepEqual(underpassCalls.find(({ kind }) => kind === "arc"), { kind: "arc", x: 50, y: 50, radius: 7 });
assert.equal(underpassCalls.filter(({ kind }) => kind === "clip").length, 1, "the lower cable redraw must be clipped to the bridge opening");
assert.equal(underpassCalls.find(({ kind }) => kind === "stroke").drawnCurve, lowerBaseCurve, "the lower cable must remain geometrically continuous through the bridge");
assert.equal(underpassCalls.find(({ kind }) => kind === "vlan").drawnCurve, lowerBaseCurve, "the visible underpass must retain its VLAN colors");

const drawEngine = Object.create(CanvasEngine.prototype);
drawEngine.state = {
  topology: { vlans: [], linkGroups: [], links: [] },
  selection: null,
  analysis: null,
  traceLinkIDs: new Set(),
};
drawEngine.portBoxes = [];
drawEngine.deviceBoxes = [];
drawEngine.routeCache = new Map();
let highlightPasses = 0;
drawEngine.drawHoveredLinkHighlight = () => { highlightPasses += 1; };
drawEngine.drawLinkGroupGuides = () => {};
drawEngine.drawCableLabels = () => {};

drawEngine.drawLinks({}, 0, true, false);
assert.equal(highlightPasses, 0, "PNG and SVG render passes must not include transient hover highlighting");
drawEngine.drawLinks({}, 0, false, true);
assert.equal(highlightPasses, 1, "interactive frames must include the full-link hover pass");

console.log("full-link hover highlight checks passed");
