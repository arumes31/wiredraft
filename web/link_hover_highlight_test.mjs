import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { cableBezier, routeFromPoints, routesWithCrossingBridges } from "./static/js/cabling.js";
import {
  cableHoverAlphaFactor, CanvasEngine, deviceHoverFrameInterval, hoverNeedsAnimation,
} from "./static/js/canvas.js";
import { patchPanelPathIndex } from "./static/js/patch-panels.js";

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
engine.hoveredLink = null;
engine.hoveredDevice = { device: { id: "switch-a" } };
engine.drawHoveredLinkHighlight({}, 0, new Set(["link-hovered"]));
assert.equal(strokes.length, 4,
  "device hover must use static opacity isolation instead of redrawing every attached route with glow layers");
assert.equal(hoverNeedsAnimation({ hoveredDevice: engine.hoveredDevice }), false,
  "a stationary switch hover must not keep the animation loop alive");
assert.equal(hoverNeedsAnimation({ hoveredPort: { port: { id: "a1" } } }), true,
  "single-port hover may retain the detailed focused animation path");
assert.equal(deviceHoverFrameInterval({ maxFPS: 45 }, engine.hoveredDevice), 1000 / 30,
  "quality-mode device hover must cap pointer-driven redraws at 30 FPS");
assert.equal(deviceHoverFrameInterval({ maxFPS: 24 }, engine.hoveredDevice), 1000 / 24,
  "balanced device hover must respect its lower profile limit");

const focusEngine = Object.create(CanvasEngine.prototype);
focusEngine.state = { topology: {
  links: [
    { id: "left", sourcePortId: "a1", targetPortId: "b1" },
    { id: "right", sourcePortId: "a2", targetPortId: "c1" },
    { id: "unrelated", sourcePortId: "d1", targetPortId: "e1" },
    { id: "rear-one", sourcePortId: "p1", targetPortId: "q1", sourceSide: "rear", targetSide: "rear", rearChannelId: "tube-1" },
    { id: "rear-two", sourcePortId: "p2", targetPortId: "q2", sourceSide: "rear", targetSide: "rear", rearChannelId: "tube-1" },
  ],
  devices: [
    { id: "device-a", ports: [{ id: "a1" }, { id: "a2" }] },
    { id: "device-b", ports: [{ id: "b1" }] },
  ],
  linkGroups: [{ id: "bundle-a", mode: "MCLAG", linkIds: ["left", "right"] }],
} };
focusEngine.hoveredLink = null;
focusEngine.hoveredDevice = null;
focusEngine.hoveredPort = { port: { id: "a1" } };
assert.deepEqual([...focusEngine.hoverFocusLinkIDs()], ["left"], "port hover must focus every path using that connector");
focusEngine.hoveredPort = null;
focusEngine.hoveredDevice = { device: { id: "device-a" } };
assert.deepEqual([...focusEngine.hoverFocusLinkIDs()].sort(), ["left", "right"], "switch hover must focus all attached paths");
const indexedDeviceLinks = new Set(["left", "right"]);
focusEngine.linkIDsByDevice = new Map([["device-a", indexedDeviceLinks]]);
assert.equal(focusEngine.hoverFocusLinkIDs(), indexedDeviceLinks,
  "switch hover must reuse the pre-indexed attachment set instead of scanning every link per frame");
focusEngine.hoveredDevice = null;
focusEngine.hoveredLink = { link: { id: "left" } };
assert.deepEqual([...focusEngine.hoverFocusLinkIDs()].sort(), ["left", "right"],
  "hovering one logical-group member must focus the complete Trunk/LACP/MC-LAG/Failover group");
const indexedGroupLinks = new Set(["left", "right"]);
focusEngine.groupLinkIDsByLink = new Map([
  ["left", indexedGroupLinks],
  ["right", indexedGroupLinks],
]);
assert.equal(focusEngine.hoverFocusLinkIDs(), indexedGroupLinks,
  "group hover must reuse the pre-indexed member set instead of scanning groups per frame");
focusEngine.hoveredLink = { link: { id: "unrelated" } };
assert.deepEqual([...focusEngine.hoverFocusLinkIDs()], ["unrelated"],
  "hovering an ungrouped cable must retain single-link focus");
focusEngine.hoveredLink = { link: focusEngine.state.topology.links.find((link) => link.id === "rear-one") };
assert.deepEqual([...focusEngine.hoverFocusLinkIDs()].sort(), ["rear-one", "rear-two"],
  "hovering one structured-wiring strand must focus its complete tube or discrete channel");

const panelPathTopology = {
  devices: [
    { id: "source-switch", category: "Switch", ports: [{ id: "source-port" }] },
    { id: "panel-a", category: "PatchPanel", ports: [{ id: "panel-a-port-1" }] },
    { id: "panel-b", category: "PatchPanel", ports: [{ id: "panel-b-port-1" }] },
    { id: "target-switch", category: "Switch", ports: [{ id: "target-port" }] },
  ],
  links: [
    { id: "path-in", sourcePortId: "source-port", targetPortId: "panel-a-port-1" },
    {
      id: "path-rear", sourcePortId: "panel-a-port-1", targetPortId: "panel-b-port-1",
      sourceSide: "rear", targetSide: "rear",
    },
    { id: "path-out", sourcePortId: "panel-b-port-1", targetPortId: "target-port" },
  ],
  linkGroups: [],
};
const panelPathFocusEngine = Object.create(CanvasEngine.prototype);
panelPathFocusEngine.state = { topology: panelPathTopology };
panelPathFocusEngine.groupLinkIDsByLink = new Map();
panelPathFocusEngine.patchPanelPathLinkIDsByLink = patchPanelPathIndex(panelPathTopology);
panelPathFocusEngine.hoveredLink = { link: panelPathTopology.links[0] };
assert.deepEqual([...panelPathFocusEngine.hoverFocusLinkIDs()].sort(), ["path-in", "path-out", "path-rear"],
  "hovering a cable into a patch panel must highlight its rear map and the cable continuing to the next device");
panelPathFocusEngine.hoveredLink = null;
panelPathFocusEngine.hoveredDevice = { device: panelPathTopology.devices[0] };
const directSwitchLinks = new Set(["path-in"]);
panelPathFocusEngine.linkIDsByDevice = new Map([["source-switch", directSwitchLinks]]);
assert.deepEqual([...panelPathFocusEngine.hoverFocusLinkIDs()].sort(), ["path-in", "path-out", "path-rear"],
  "hovering a switch must expand each attached cable through both panels to the connected device");
assert.deepEqual([...directSwitchLinks], ["path-in"],
  "switch path expansion must not mutate the cached direct-attachment index");

panelPathFocusEngine.linkIDsByDevice = new Map();
assert.deepEqual([...panelPathFocusEngine.hoverFocusLinkIDs()].sort(), ["path-in", "path-out", "path-rear"],
  "switch hover must retain full panel-path expansion when the scene index is unavailable");

const layoutEngine = Object.create(CanvasEngine.prototype);
layoutEngine.sceneDirty = true;
layoutEngine.sceneRevision = 0;
layoutEngine.state = { topology: {
  racks: [], devices: [], vlans: [],
  links: focusEngine.state.topology.links,
  linkGroups: focusEngine.state.topology.linkGroups,
} };
layoutEngine.rackTiles = { clear() {}, insert() {} };
layoutEngine.deviceTiles = { clear() {}, insert() {} };
layoutEngine.layoutScene();
assert.equal(layoutEngine.groupLinkIDsByLink.get("left"), layoutEngine.groupLinkIDsByLink.get("right"),
  "scene layout must index every group member to the same cached focus set");
assert.deepEqual([...layoutEngine.groupLinkIDsByLink.get("left")].sort(), ["left", "right"]);

const groupHighlightEngine = Object.create(CanvasEngine.prototype);
groupHighlightEngine.hoveredDevice = null;
groupHighlightEngine.hoveredLink = { link: { id: "left" } };
groupHighlightEngine.state = focusEngine.state;
groupHighlightEngine.groupLinkIDsByLink = layoutEngine.groupLinkIDsByLink;
groupHighlightEngine.linkCurves = [
  { link: { id: "left" }, rearMapping: false },
  { link: { id: "right" }, rearMapping: false },
  { link: { id: "unrelated" }, rearMapping: false },
];
groupHighlightEngine.rearHoverIsolationActive = () => false;
const highlightedGroupMembers = [];
groupHighlightEngine.drawHoveredLinkHighlightEntry = (_context, _time, entry) => highlightedGroupMembers.push(entry.link.id);
groupHighlightEngine.drawHoveredLinkHighlight({}, 0);
assert.deepEqual(highlightedGroupMembers, ["left", "right"],
  "the complete highlight pass must redraw every logical-group member and no unrelated cable");

const focusedTubeRoute = { points: [{ x: 0, y: 10 }, { x: 100, y: 10 }] };
const unrelatedTubeRoute = { points: [{ x: 0, y: 30 }, { x: 100, y: 30 }] };
const tubeHighlightEngine = Object.create(CanvasEngine.prototype);
const tubeStrokes = [];
tubeHighlightEngine.strokeCurve = (_context, drawnCurve, color, width, alpha, options = {}) => {
  tubeStrokes.push({ drawnCurve, color, width, alpha, options });
};
panelPathFocusEngine.hoveredDevice = null;
panelPathFocusEngine.hoveredLink = { link: panelPathTopology.links[0] };
const panelCableFocusIDs = panelPathFocusEngine.hoverFocusLinkIDs();
tubeHighlightEngine.drawRearChannelSheaths({}, new Map([
  ["focused-strand", { route: { rearChannelSheath: {
    key: "tube-focused", linkIds: ["path-rear"], route: focusedTubeRoute, width: 9,
  } } }],
  ["unrelated-strand", { route: { rearChannelSheath: {
    key: "tube-unrelated", linkIds: ["other-rear"], route: unrelatedTubeRoute, width: 9,
  } } }],
]), { hoverFocusLinkIDs: panelCableFocusIDs, hasHoverFocus: true });
const focusedTubeStrokes = tubeStrokes.filter(({ drawnCurve }) => drawnCurve === focusedTubeRoute);
const unrelatedTubeStrokes = tubeStrokes.filter(({ drawnCurve }) => drawnCurve === unrelatedTubeRoute);
assert.equal(focusedTubeStrokes.length, 6,
  "a tube touched by the expanded panel path must receive two dedicated halo layers and its complete sheath redraw");
assert.deepEqual(focusedTubeStrokes.slice(0, 2).map(({ color, width, alpha }) => ({ color, width, alpha })), [
  { color: "#ffd786", width: 23, alpha: .28 },
  { color: "#ffe7a8", width: 15, alpha: .52 },
]);
assert.deepEqual(focusedTubeStrokes.at(-1), {
  drawnCurve: focusedTubeRoute, color: "#fff1c2", width: 1.75, alpha: .98,
  options: { dash: [9, 5], lineCap: "butt" },
}, "the active tube must finish with a bright static center trace");
assert.equal(unrelatedTubeStrokes.length, 4, "an unrelated tube must not receive hover halo layers");
assert.equal(unrelatedTubeStrokes.every(({ alpha }) => alpha <= .16), true,
  "unrelated tube sheaths must visibly dim while a panel path is focused");

assert.equal(cableHoverAlphaFactor({ rearIsolation: true, rearMapping: false, hasHoverFocus: true, hoverFocused: true }), .1,
  "rear isolation must dim even attached front cables to exactly ten percent");
assert.equal(cableHoverAlphaFactor({ rearIsolation: true, rearMapping: true, hasHoverFocus: true, hoverFocused: false }), 1,
  "rear isolation must leave all backend runs readable");
assert.equal(cableHoverAlphaFactor({ rearIsolation: false, rearMapping: false, hasHoverFocus: true, hoverFocused: false }), .2,
  "normal hover isolation must retain the existing twenty-percent dim level");
focusEngine.hoveredDevice = { device: { id: "panel-a", category: "PatchPanel" } };
focusEngine.hoveredLink = null;
assert.equal(focusEngine.rearHoverIsolationActive(), true, "patch-panel hover must activate rear-channel isolation");
focusEngine.hoveredDevice = null;
focusEngine.hoveredLink = { link: { id: "rear", sourceSide: "rear", targetSide: "rear" } };
assert.equal(focusEngine.rearHoverIsolationActive(), true, "backend-link hover must activate rear-channel isolation");
const canvasSource = readFileSync(new URL("./static/js/canvas.js", import.meta.url), "utf8");
assert.match(canvasSource, /if \(rearIsolation\) return rearMapping \? 1 : \.1/, "rear isolation must explicitly dim front paths to ten percent");
assert.match(canvasSource, /if \(showAllLabels\) this\.drawExportEndpointLabels\(ctx, topology\)/,
  "PNG and PDF documentation renders must add remote endpoint badges");
assert.match(canvasSource,
  /rearMapping \? RearPanelLinkVisual\.strokeWidth :\s*baseCurve\.tightBundle \? Math\.min\(speedThickness, 1\.5\) : speedThickness/,
  "rear mappings must stay thin while front bundles compact their rails enough to remain visually distinct");
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
  kind: "arc", x: 50, y: 50, radius: 4, start: Math.PI, end: Math.PI * 2, anticlockwise: false,
}, "canvas paths must draw the horizontal crossing as a real 4px semicircle");

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
