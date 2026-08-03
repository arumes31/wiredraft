import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  GraphicsMode, graphicsAnimationActive, graphicsEffectActive, graphicsProfileSummary,
  normalizeGraphicsMode, resolveGraphicsProfile,
} from "./static/js/graphics-quality.js";
import { CanvasEngine } from "./static/js/canvas.js";

const topology = (deviceCount, portsPerDevice, linkCount) => ({
  devices: Array.from({ length: deviceCount }, () => ({ ports: Array.from({ length: portsPerDevice }, () => ({ status: "up" })) })),
  links: Array.from({ length: linkCount }, (_, index) => ({ id: `link-${index}` })),
});

assert.equal(normalizeGraphicsMode("unknown"), GraphicsMode.AUTO);
assert.equal(resolveGraphicsProfile(GraphicsMode.AUTO, topology(2, 8, 2), { hardwareConcurrency: 12, deviceMemory: 16 }).resolvedMode, GraphicsMode.QUALITY);
assert.equal(resolveGraphicsProfile(GraphicsMode.AUTO, topology(10, 24, 14), { hardwareConcurrency: 8, deviceMemory: 8 }).resolvedMode, GraphicsMode.BALANCED);
assert.equal(resolveGraphicsProfile(GraphicsMode.AUTO, topology(16, 48, 32), { hardwareConcurrency: 16, deviceMemory: 32 }).resolvedMode, GraphicsMode.PERFORMANCE);
assert.equal(resolveGraphicsProfile(GraphicsMode.QUALITY, topology(2, 8, 2), {}, true).resolvedMode, GraphicsMode.PERFORMANCE, "reduced motion must disable continuous rendering");

const performance = resolveGraphicsProfile(GraphicsMode.PERFORMANCE, topology(2, 8, 2));
const balanced = resolveGraphicsProfile(GraphicsMode.BALANCED, topology(2, 8, 2));
const quality = resolveGraphicsProfile(GraphicsMode.QUALITY, topology(2, 8, 2));
assert.equal(graphicsAnimationActive(performance, { hasLinks: true, hasFocus: true }), false);
assert.equal(graphicsAnimationActive(balanced, { hasLinks: true }), false, "balanced mode should stay idle until an effect is focused");
assert.equal(graphicsAnimationActive(balanced, { hasFocus: true }), true);
assert.equal(graphicsAnimationActive(quality, { hasLinks: true }), true);
assert.equal(graphicsAnimationActive(quality, { hasActivePorts: true }), false, "up ports alone must not keep a LED animation loop running");
assert.equal("animateLEDs" in quality, false, "graphics profiles must not re-enable link LED blinking");
assert.equal(graphicsEffectActive(balanced, false), false);
assert.equal(graphicsEffectActive(balanced, true), true);
assert.match(graphicsProfileSummary(performance), /STATIC IDLE/);

const html = readFileSync(new URL("./static/index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("./static/js/app.js", import.meta.url), "utf8");
const canvas = readFileSync(new URL("./static/js/canvas.js", import.meta.url), "utf8");
assert.match(html, /id="graphics-quality"[^>]*>[\s\S]*value="auto"[\s\S]*value="performance"[\s\S]*value="balanced"[\s\S]*value="quality"/, "graphics control must expose every mode");
assert.match(app, /GRAPHICS_STORAGE_KEY/, "graphics choice must use persistent storage");
assert.match(app, /setGraphicsMode/, "graphics control must update the canvas renderer");
assert.match(canvas, /const due = this\.needsRender \|\| \(animationActive/, "idle canvases must skip full redraws");
assert.match(canvas, /if \(animationActive && this\.isDocumentVisible && this\.isCanvasVisible\)/, "idle render loops must stop requesting frames");
assert.match(canvas, /this\.isDocumentVisible && this\.isCanvasVisible/, "hidden canvases must suspend rendering");
assert.match(canvas, /curve: routeWithCrossingBridges/, "crossing bridge geometry must be cached with each route");
assert.doesNotMatch(canvas, /obstacleSignature|occupiedSignature/, "render frames must not rebuild route signature strings");
assert.doesNotMatch(canvas, /profile\.animateLEDs|time \/ 330/, "port LEDs must not contain time-based color animation");

const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
let requestedFrames = 0;
globalThis.requestAnimationFrame = () => { requestedFrames += 1; return requestedFrames; };
const idleEngine = Object.assign(Object.create(CanvasEngine.prototype), {
  frame: 7, needsRender: true, lastRenderTime: 0, isDocumentVisible: true, isCanvasVisible: true,
  graphicsProfile: () => performance, state: { topology: topology(2, 8, 2), selection: null, traceLinkIDs: new Set() },
  hoveredLink: null, draft: null, linkDrag: null, drag: null, rackDrag: null, pan: null, selectionBox: null,
  renderFrame() { this.renderCount = (this.renderCount || 0) + 1; },
});
idleEngine.loop(100);
assert.equal(idleEngine.renderCount, 1);
assert.equal(requestedFrames, 0, "performance mode must stop its frame loop after rendering an invalidation");
idleEngine.invalidate();
assert.equal(requestedFrames, 1, "a later interaction must wake the stopped renderer");
if (originalRequestAnimationFrame) globalThis.requestAnimationFrame = originalRequestAnimationFrame;
else delete globalThis.requestAnimationFrame;

console.log("adaptive graphics quality checks passed");
