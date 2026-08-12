import assert from "node:assert/strict";

import {
  applyNavigationFrame, classifyWheelGesture, loadStoredNavigationMode, NavigationGesture, NavigationMode, navigationGestureHints,
  navigationModeSummary, normalizeNavigationMode, normalizeWheelDelta, wheelZoomLogDelta,
} from "./static/js/canvas-navigation.js";

assert.equal(normalizeNavigationMode("trackpad"), NavigationMode.TRACKPAD);
assert.equal(normalizeNavigationMode("unsupported"), NavigationMode.AUTO);
const migratedNavigationStorage = new Map([["netdiagram.navigation-mode", NavigationMode.TRACKPAD]]);
const navigationStorage = {
  getItem(key) { return migratedNavigationStorage.get(key) ?? null; },
  setItem(key, value) { migratedNavigationStorage.set(key, value); },
};
assert.equal(loadStoredNavigationMode(navigationStorage), NavigationMode.TRACKPAD);
assert.equal(migratedNavigationStorage.get("wiredraft.navigation-mode"), NavigationMode.TRACKPAD);
assert.deepEqual(normalizeWheelDelta({ deltaX: 2, deltaY: -3, deltaMode: 1 }), { x: 32, y: -48 });
assert.deepEqual(normalizeWheelDelta({ deltaX: 0, deltaY: 1, deltaMode: 2 }, 900), { x: 0, y: 900 });

assert.equal(classifyWheelGesture({ deltaY: 100 }, NavigationMode.MOUSE, {}, 10).gesture, NavigationGesture.ZOOM);
assert.equal(classifyWheelGesture({ deltaY: 12 }, NavigationMode.TRACKPAD, {}, 10).gesture, NavigationGesture.PAN);
assert.equal(classifyWheelGesture({ deltaY: 5, ctrlKey: true }, NavigationMode.TRACKPAD, {}, 10).gesture,
  NavigationGesture.ZOOM, "trackpad pinch must zoom instead of pan");
assert.equal(classifyWheelGesture({ deltaY: 5, metaKey: true }, NavigationMode.AUTO, {}, 10).gesture,
  NavigationGesture.ZOOM, "Cmd + wheel must provide a zoom override");

const detector = {};
assert.equal(classifyWheelGesture({ deltaX: 4.5, deltaY: 13.25, deltaMode: 0 }, NavigationMode.AUTO, detector, 100).gesture,
  NavigationGesture.PAN, "precision horizontal deltas identify a touchpad");
assert.equal(classifyWheelGesture({ deltaX: 0, deltaY: 92, deltaMode: 0 }, NavigationMode.AUTO, detector, 240).gesture,
  NavigationGesture.PAN, "touchpad momentum must remain latched during the gesture");
assert.equal(classifyWheelGesture({ deltaX: 0, deltaY: 100, deltaMode: 0 }, NavigationMode.AUTO, detector, 1500).gesture,
  NavigationGesture.ZOOM, "coarse wheel input after the touchpad latch expires must zoom");
assert.equal(classifyWheelGesture({ deltaX: 0, deltaY: 3, deltaMode: 1 }, NavigationMode.AUTO, {}, 10).gesture,
  NavigationGesture.ZOOM, "line-mode wheel events must retain mouse zoom behavior");

assert.ok(wheelZoomLogDelta(100) < 0);
assert.ok(wheelZoomLogDelta(-100) > 0);
const camera = { x: 20, y: 40, zoom: 1 };
const panned = applyNavigationFrame(camera, { panX: -30, panY: 15, zoomLog: 0 });
assert.deepEqual(panned, { x: -10, y: 55, zoom: 1 });
const anchor = { x: 240, y: 180 };
const worldBefore = { x: (anchor.x - camera.x) / camera.zoom, y: (anchor.y - camera.y) / camera.zoom };
const zoomed = applyNavigationFrame(camera, { panX: 0, panY: 0, zoomLog: .2, zoomAnchor: anchor });
assert.ok(zoomed.zoom > camera.zoom);
assert.ok(Math.abs((anchor.x - zoomed.x) / zoomed.zoom - worldBefore.x) < .0001);
assert.ok(Math.abs((anchor.y - zoomed.y) / zoomed.zoom - worldBefore.y) < .0001);

assert.deepEqual(navigationGestureHints(NavigationMode.TRACKPAD), { pan: "2-FINGER", zoom: "PINCH" });
assert.match(navigationModeSummary(NavigationMode.MOUSE), /WHEEL ZOOM/);

console.log("touchpad and mouse navigation checks passed");
