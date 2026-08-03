export const GraphicsMode = Object.freeze({
  AUTO: "auto",
  PERFORMANCE: "performance",
  BALANCED: "balanced",
  QUALITY: "quality",
});

export const GRAPHICS_STORAGE_KEY = "netdiagram.graphics-mode";

const profiles = Object.freeze({
  [GraphicsMode.PERFORMANCE]: Object.freeze({
    resolvedMode: GraphicsMode.PERFORMANCE,
    label: "PERFORMANCE",
    maxFPS: 0,
    pixelRatio: 1,
    animationScope: "none",
    pulses: "none",
    shadows: false,
    glows: false,
    minorGrid: false,
    deviceDetail: "minimal",
  }),
  [GraphicsMode.BALANCED]: Object.freeze({
    resolvedMode: GraphicsMode.BALANCED,
    label: "BALANCED",
    maxFPS: 24,
    pixelRatio: 1.5,
    animationScope: "focused",
    pulses: "focused",
    shadows: false,
    glows: true,
    minorGrid: true,
    deviceDetail: "reduced",
  }),
  [GraphicsMode.QUALITY]: Object.freeze({
    resolvedMode: GraphicsMode.QUALITY,
    label: "QUALITY",
    maxFPS: 45,
    pixelRatio: 2.25,
    animationScope: "all",
    pulses: "all",
    shadows: true,
    glows: true,
    minorGrid: true,
    deviceDetail: "full",
  }),
});

export function normalizeGraphicsMode(mode) {
  return Object.values(GraphicsMode).includes(mode) ? mode : GraphicsMode.AUTO;
}

export function resolveGraphicsProfile(mode, topology, capabilities = {}, reducedMotion = false) {
  const requestedMode = normalizeGraphicsMode(mode);
  let resolvedMode = requestedMode;
  if (reducedMotion) {
    resolvedMode = GraphicsMode.PERFORMANCE;
  } else if (requestedMode === GraphicsMode.AUTO) {
    resolvedMode = automaticMode(topology, capabilities);
  }
  const profile = profiles[resolvedMode] || profiles[GraphicsMode.BALANCED];
  return { ...profile, requestedMode };
}

export function graphicsProfileSummary(profile) {
  const frameRate = profile.maxFPS ? `${profile.maxFPS} FPS` : "STATIC IDLE";
  return `${profile.label} · ${frameRate} · ${profile.pixelRatio}× PIXELS`;
}

export function graphicsAnimationActive(profile, activity = {}) {
  if (!profile || profile.animationScope === "none" || profile.maxFPS <= 0) return false;
  if (profile.animationScope === "all") return Boolean(activity.hasLinks);
  return Boolean(activity.hasFocus || activity.isInteracting);
}

export function graphicsEffectActive(profile, isFocused) {
  return profile?.animationScope === "all" || (profile?.animationScope === "focused" && isFocused);
}

function automaticMode(topology, capabilities) {
  const devices = topology?.devices || [];
  const links = topology?.links || [];
  const ports = devices.reduce((total, device) => total + (device.ports?.length || 0), 0);
  const cores = positiveNumber(capabilities.hardwareConcurrency, 8);
  const memory = positiveNumber(capabilities.deviceMemory, 8);
  const pixelRatio = positiveNumber(capabilities.devicePixelRatio, 1);

  if (links.length >= 28 || ports >= 360 || cores <= 4 || memory <= 4 || pixelRatio >= 3.5) return GraphicsMode.PERFORMANCE;
  if (links.length >= 10 || ports >= 140 || devices.length >= 12 || cores <= 6 || memory <= 6 || pixelRatio >= 2.5) return GraphicsMode.BALANCED;
  return GraphicsMode.QUALITY;
}

function positiveNumber(value, fallback) {
  return Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : fallback;
}
