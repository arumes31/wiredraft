export const NavigationMode = Object.freeze({
  AUTO: "auto",
  TRACKPAD: "trackpad",
  MOUSE: "mouse",
});

export const NavigationGesture = Object.freeze({
  PAN: "pan",
  ZOOM: "zoom",
});

export const NAVIGATION_STORAGE_KEY = "netdiagram.navigation-mode";
export const DRAG_ACTIVATION_DISTANCE = 5;

const TRACKPAD_LATCH_MS = 1200;
const TRACKPAD_EVENT_INTERVAL_MS = 42;
const TRACKPAD_FINE_DELTA = 50;
const LINE_DELTA_PIXELS = 16;
const ZOOM_SENSITIVITY = .0015;
const MAX_ZOOM_DELTA = 240;

export function normalizeNavigationMode(mode) {
  return Object.values(NavigationMode).includes(mode) ? mode : NavigationMode.AUTO;
}

export function normalizeWheelDelta(event, viewportHeight = 800) {
  const mode = Number(event?.deltaMode) || 0;
  const scale = mode === 1 ? LINE_DELTA_PIXELS : mode === 2 ? Math.max(1, Number(viewportHeight) || 800) : 1;
  return {
    x: finiteDelta(event?.deltaX) * scale,
    y: finiteDelta(event?.deltaY) * scale,
  };
}

export function classifyWheelGesture(event, configuredMode, detector = {}, timestamp = event?.timeStamp) {
  const mode = normalizeNavigationMode(configuredMode);
  const now = Number.isFinite(Number(timestamp)) ? Number(timestamp) : 0;
  const modifiedZoom = Boolean(event?.ctrlKey || event?.metaKey);
  if (modifiedZoom) {
    detector.lastEventAt = now;
    return { gesture: NavigationGesture.ZOOM, detectedMode: NavigationMode.TRACKPAD };
  }
  if (mode === NavigationMode.TRACKPAD) {
    detector.lastEventAt = now;
    return { gesture: NavigationGesture.PAN, detectedMode: NavigationMode.TRACKPAD };
  }
  if (mode === NavigationMode.MOUSE) {
    detector.lastEventAt = now;
    return { gesture: NavigationGesture.ZOOM, detectedMode: NavigationMode.MOUSE };
  }

  const deltaX = Math.abs(finiteDelta(event?.deltaX));
  const deltaY = Math.abs(finiteDelta(event?.deltaY));
  const pixelMode = (Number(event?.deltaMode) || 0) === 0;
  const rapidPixelEvent = pixelMode && Number.isFinite(detector.lastEventAt) &&
    now >= detector.lastEventAt && now - detector.lastEventAt <= TRACKPAD_EVENT_INTERVAL_MS;
  const precisionEvidence = pixelMode && (
    deltaX > .01 ||
    (deltaY > 0 && (!Number.isInteger(finiteDelta(event?.deltaY)) || deltaY < TRACKPAD_FINE_DELTA)) ||
    (rapidPixelEvent && deltaY < 120)
  );
  if (precisionEvidence) detector.lastTrackpadAt = now;
  detector.lastEventAt = now;
  const trackpadLatched = Number.isFinite(detector.lastTrackpadAt) &&
    now >= detector.lastTrackpadAt && now - detector.lastTrackpadAt <= TRACKPAD_LATCH_MS;
  return trackpadLatched
    ? { gesture: NavigationGesture.PAN, detectedMode: NavigationMode.TRACKPAD }
    : { gesture: NavigationGesture.ZOOM, detectedMode: NavigationMode.MOUSE };
}

export function wheelZoomLogDelta(deltaY) {
  return -clamp(finiteDelta(deltaY), -MAX_ZOOM_DELTA, MAX_ZOOM_DELTA) * ZOOM_SENSITIVITY;
}

export function applyNavigationFrame(camera, pending, limits = {}) {
  const next = {
    ...camera,
    x: camera.x + finiteDelta(pending?.panX),
    y: camera.y + finiteDelta(pending?.panY),
  };
  const zoomLog = finiteDelta(pending?.zoomLog);
  const anchor = pending?.zoomAnchor;
  if (!zoomLog || !anchor) return next;
  const minZoom = Number.isFinite(limits.minZoom) ? limits.minZoom : .1;
  const maxZoom = Number.isFinite(limits.maxZoom) ? limits.maxZoom : 5;
  const worldX = (anchor.x - next.x) / next.zoom;
  const worldY = (anchor.y - next.y) / next.zoom;
  next.zoom = clamp(next.zoom * Math.exp(zoomLog), minZoom, maxZoom);
  next.x = anchor.x - worldX * next.zoom;
  next.y = anchor.y - worldY * next.zoom;
  return next;
}

export function navigationModeSummary(mode) {
  switch (normalizeNavigationMode(mode)) {
    case NavigationMode.TRACKPAD: return "TRACKPAD · 2-FINGER PAN · PINCH ZOOM";
    case NavigationMode.MOUSE: return "MOUSE · DRAG PAN · WHEEL ZOOM";
    default: return "AUTO · TOUCHPAD / MOUSE DETECTION";
  }
}

export function navigationGestureHints(mode) {
  switch (normalizeNavigationMode(mode)) {
    case NavigationMode.TRACKPAD: return { pan: "2-FINGER", zoom: "PINCH" };
    case NavigationMode.MOUSE: return { pan: "DRAG / SPACE", zoom: "WHEEL" };
    default: return { pan: "2-FINGER / DRAG", zoom: "WHEEL / PINCH" };
  }
}

function finiteDelta(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
