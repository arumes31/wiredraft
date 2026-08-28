import {
  assignCableTracks, CableMode, cableBezier, cableDashPattern, CABLE_OUTLINE_WIDTH, cableRole, distanceToRoute,
  orderedCableLinks, pointOnRoute, routeSegments, routesWithCrossingBridges, segmentIntersectsRectangle,
} from "./cabling.js";
import { EmptyCanvasAction, emptyCanvasAction } from "./canvas-interactions.js";
import {
  applyNavigationFrame, classifyWheelGesture, DRAG_ACTIVATION_DISTANCE, NavigationGesture,
  normalizeNavigationMode, normalizeWheelDelta, wheelZoomLogDelta,
} from "./canvas-navigation.js";
import { commentPreviewLines } from "./plan-comments.js";
import { resolveFaceplateTemplate } from "./faceplate.js";
import { groupAccent, linkGroupPortBadges, peerLinkIDs, summarizeLinkGroup } from "./link-group-display.js";
import { linkVLANPalette, vlanBandPattern } from "./link-vlan-colors.js";
import { layoutEndpointBadges, linkEndpointBadges } from "./link-end-labels.js";
import {
  isPortSideOccupied, isRearPanelLink, LinkEndpointSide, patchPanelPathIndex, RearPanelLinkVisual,
} from "./patch-panels.js";
import { cableLabelVisibility, curveLabelCandidates, placeCableLabels, pointerBubblePlacement, radialCandidates } from "./label-layout.js";
import { findPort } from "./state.js";
import { connectorKind, faceplateConnectorSize, portDescriptionPlacement, portLinkLEDColor } from "./termination.js";
import { switchSystemAccent, switchSystemForDevice } from "./switch-systems.js";
import { firewallClusterAccent, firewallClusterForDevice, firewallClusterRole } from "./firewall-clusters.js";
import {
  GraphicsMode, graphicsAnimationActive, graphicsEffectActive, normalizeGraphicsMode, resolveGraphicsProfile,
} from "./graphics-quality.js";
import {
  findRackFaceLanding, layoutRackGroups, mountedDevicePosition, normalizeRackFace, oppositeRackFace, RackFace,
  RACK_DEVICE_INSET, RACK_FACE_GAP, RACK_HEADER_HEIGHT, RACK_UNIT_HEIGHT, RACK_WIDTH, usedRackUnits,
  visibleRackFaces,
} from "./rack.js";
import { SceneTileIndex } from "./scene-tiles.js";

const DEVICE_WIDTH = 690;
const UNIT_HEIGHT = 100;
const GRID = 10;
const QUALITY_FALLBACK = resolveGraphicsProfile(GraphicsMode.QUALITY, null);

export function cableHoverAlphaFactor({ rearIsolation, rearMapping, hasHoverFocus, hoverFocused }) {
  if (rearIsolation) return rearMapping ? 1 : .1;
  return hasHoverFocus && !hoverFocused ? .2 : 1;
}

export function hoverNeedsAnimation({ hoveredLink, hoveredPort, hoveredDevice } = {}) {
  return Boolean(hoveredLink || hoveredPort) && !hoveredDevice;
}

export function deviceHoverFrameInterval(profile, hoveredDevice) {
  if (!hoveredDevice) return 0;
  const profileFPS = Number(profile?.maxFPS) > 0 ? Number(profile.maxFPS) : 30;
  return 1000 / Math.min(30, profileFPS);
}

export class CanvasEngine {
  constructor(canvas, state, callbacks = {}, options = {}) {
    this.canvas = canvas;
    this.state = state;
    this.callbacks = callbacks;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.camera = { x: 35, y: 35, zoom: 0.85 };
    this.deviceBoxes = [];
    this.shadowDeviceBoxes = [];
    this.routingDeviceBoxes = [];
    this.rackBoxes = [];
    this.rackFaceBoxes = [];
    this.routingRackBoxes = [];
    this.rackTiles = new SceneTileIndex();
    this.deviceTiles = new SceneTileIndex();
    this.portBoxes = [];
    this.routingPortBoxes = [];
    this.deviceBoxByID = new Map();
    this.portBoxByID = new Map();
    this.routingPortBoxByID = new Map();
    this.rackPortalMarkers = [];
    this.portBoxesByDevice = new Map();
    this.linkIDsByPort = new Map();
    this.linkIDsByDevice = new Map();
    this.linksByPort = new Map();
    this.linksByDevice = new Map();
    this.groupByLink = new Map();
    this.groupLinkIDsByLink = new Map();
    this.patchPanelPathLinkIDsByLink = new Map();
    this.vlanByID = new Map();
    this.orderedLinks = [];
    this.linkCurves = [];
    this.routeCache = new Map();
    this.trackPlanCache = null;
    this.routingChanges = { full: true, changedDeviceIDs: new Set(), obstacleBounds: [] };
    this.routingGeometryKey = "";
    this.routingPlanRevision = 0;
    this.lastRoutingStats = { mode: "full", totalLinks: 0, reroutedLinks: 0, crossingPairs: 0 };
    this.stpPortStateCache = new Map();
    this.graphicsMode = normalizeGraphicsMode(options.graphicsMode);
    this.navigationMode = normalizeNavigationMode(options.navigationMode);
    this.navigationDetector = {};
    this.lastDetectedNavigationMode = "";
    this.pendingNavigation = null;
    this.navigationFrame = 0;
    this.flushNavigation = this.flushNavigation.bind(this);
    this.reducedMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches || false;
    this.activeGraphicsProfile = null;
    this.sceneDirty = true;
    this.sceneRevision = 0;
    this.needsRender = true;
    this.lastRenderTime = 0;
    this.isDocumentVisible = !document.hidden;
    this.isCanvasVisible = true;
    this.hoveredPort = null;
    this.hoveredLink = null;
    this.hoveredDevice = null;
    this.hoveredAnnotation = null;
    this.pointerWorld = { x: 0, y: 0 };
    this.pointerScreen = { x: 0, y: 0 };
    this.mode = CableMode.IDLE;
    this.draft = null;
    this.linkDrag = null;
    this.drag = null;
    this.rackDrag = null;
    this.rackDropPreview = null;
    this.pan = null;
    this.selectionBox = null;
    this.activeTool = "select";
    this.annotationDraft = null;
    this.selectedDevices = new Set();
    this.isSpaceDown = false;
    this.frame = 0;
    this.loop = this.loop.bind(this);
    this.graphicsProfileKey = "";
    this.onStateChange = ({ detail }) => {
      const layoutChanged = ["topology", "rack-view", "trace"].includes(detail?.kind);
      if (detail?.kind === "analysis") this.rebuildSTPPortStateCache();
      this.invalidate(layoutChanged);
      if (!layoutChanged) return;
      const profile = this.graphicsProfile();
      const nextKey = `${profile.resolvedMode}:${profile.pixelRatio}`;
      if (nextKey !== this.graphicsProfileKey) {
        this.graphicsProfileKey = nextKey;
        this.resize();
      }
    };
    this.onVisibilityChange = () => {
      this.isDocumentVisible = !document.hidden;
      if (this.isDocumentVisible) this.invalidate();
    };
    this.state.addEventListener("change", this.onStateChange);
    this.rebuildSTPPortStateCache();
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement);
    this.intersectionObserver = globalThis.IntersectionObserver ? new IntersectionObserver(([entry]) => {
      this.isCanvasVisible = entry?.isIntersecting !== false;
      if (this.isCanvasVisible) this.invalidate();
    }) : null;
    this.intersectionObserver?.observe(canvas);
    this.bind();
    this.resize();
  }

  destroy() {
    cancelAnimationFrame(this.frame);
    cancelAnimationFrame(this.navigationFrame);
    this.resizeObserver.disconnect();
    this.intersectionObserver?.disconnect();
    this.state.removeEventListener("change", this.onStateChange);
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
  }

  bind() {
    this.canvas.addEventListener("pointerdown", (event) => this.pointerDown(event));
    this.canvas.addEventListener("pointermove", (event) => this.pointerMove(event));
    this.canvas.addEventListener("pointerup", (event) => this.pointerUp(event));
    this.canvas.addEventListener("pointercancel", (event) => this.pointerUp(event));
    this.canvas.addEventListener("pointerleave", () => {
      this.hoveredPort = null;
      this.hoveredLink = null;
      this.hoveredDevice = null;
      this.hoveredAnnotation = null;
      this.invalidate();
    });
    this.canvas.addEventListener("wheel", (event) => this.wheel(event), { passive: false });
    this.canvas.addEventListener("contextmenu", (event) => this.contextMenu(event));
    window.addEventListener("keydown", (event) => {
      if (event.code === "Space" && !isFormField(event.target)) this.isSpaceDown = true;
      if (event.key === "Escape") {
        this.setTool("select");
        if (this.state.traceLinkIDs?.size) this.state.setTrace([]);
        if (this.state.dualFaceRackIDs?.size) this.state.setAllRacksDualFace(false);
      }
    });
    window.addEventListener("keyup", (event) => {
      if (event.code === "Space") this.isSpaceDown = false;
    });
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const profile = this.graphicsProfile();
    const ratio = Math.min(window.devicePixelRatio || 1, profile.pixelRatio);
    this.graphicsProfileKey = `${profile.resolvedMode}:${profile.pixelRatio}`;
    const width = Math.max(1, Math.round(rect.width * ratio));
    const height = Math.max(1, Math.round(rect.height * ratio));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.ratio = ratio;
    this.width = rect.width;
    this.height = rect.height;
    this.invalidate();
  }

  loop(time) {
    this.frame = 0;
    const profile = this.graphicsProfile();
    const topology = this.state.topology;
    const animationActive = graphicsAnimationActive(profile, {
      hasLinks: Boolean(topology?.links?.length),
      hasFocus: Boolean(hoverNeedsAnimation(this) || this.state.selection?.type === "link" || this.state.traceLinkIDs?.size),
      isInteracting: Boolean(this.draft || this.linkDrag?.active || this.drag?.active || this.rackDrag?.active || this.pan || this.selectionBox),
    });
    const frameInterval = profile.maxFPS > 0 ? 1000 / profile.maxFPS : Infinity;
    const deviceHoverInterval = deviceHoverFrameInterval(profile, this.hoveredDevice);
    const elapsed = time - this.lastRenderTime;
    const invalidationDue = this.needsRender && (!deviceHoverInterval || elapsed >= deviceHoverInterval);
    const animationInterval = deviceHoverInterval ? Math.max(deviceHoverInterval, Number.isFinite(frameInterval) ? frameInterval : 0) : frameInterval;
    const animationDue = animationActive && elapsed >= animationInterval;
    const due = invalidationDue || animationDue;
    if (due && this.isDocumentVisible && this.isCanvasVisible) {
      this.renderFrame(this.ctx, this.width, this.height, this.camera, time, true, profile);
      this.needsRender = false;
      this.lastRenderTime = time;
    }
    if ((animationActive || (this.needsRender && !invalidationDue)) && this.isDocumentVisible && this.isCanvasVisible) {
      this.frame = requestAnimationFrame(this.loop);
    }
  }

  renderFrame(ctx, width, height, camera, time, overlays, profile = this.graphicsProfile()) {
    this.activeGraphicsProfile = profile;
    ctx.setTransform(this.ratio || 1, 0, 0, this.ratio || 1, 0, 0);
    ctx.fillStyle = "#090e10";
    ctx.fillRect(0, 0, width, height);
    ctx.save();
    ctx.translate(camera.x, camera.y);
    ctx.scale(camera.zoom, camera.zoom);
    this.drawGrid(ctx, width, height, camera, profile);
    this.layoutScene();
    const viewport = this.viewportWorldRect(camera, width, height, 180);
    const visibleRackBoxes = this.rackTiles.query(viewport);
    for (const rackBox of visibleRackBoxes) this.drawRack(ctx, rackBox);
    if (overlays) this.drawRackLanding(ctx);
    for (const box of this.shadowDeviceBoxes) {
      if (intersects(box, viewport)) this.drawDeviceShadow(ctx, box);
    }
    for (const box of this.deviceTiles.query(viewport)) this.drawDevice(ctx, box.device, time);
    this.drawLinks(ctx, time, !overlays, overlays);
    this.drawRackPortals(ctx);
    this.drawPortDescriptions(ctx);
    this.drawAnnotations(ctx, overlays);
    if (overlays) {
      this.drawDraft(ctx);
      this.drawSelectionBox(ctx);
      this.drawDragGhosts(ctx);
      this.drawAnnotationDraft(ctx);
    }
    this.drawRackFaceControls(ctx, visibleRackBoxes);
    ctx.restore();
    if (overlays) this.drawTooltip(ctx);
  }

  drawGrid(ctx, width, height, camera, profile = this.activeGraphicsProfile || QUALITY_FALLBACK) {
    const left = -camera.x / camera.zoom;
    const top = -camera.y / camera.zoom;
    const right = left + width / camera.zoom;
    const bottom = top + height / camera.zoom;
    const minor = 20;
    ctx.lineWidth = 1 / camera.zoom;
    if (profile.minorGrid) {
      ctx.beginPath();
      for (let x = Math.floor(left / minor) * minor; x < right; x += minor) {
        ctx.moveTo(x, top); ctx.lineTo(x, bottom);
      }
      for (let y = Math.floor(top / minor) * minor; y < bottom; y += minor) {
        ctx.moveTo(left, y); ctx.lineTo(right, y);
      }
      ctx.strokeStyle = "rgba(91, 122, 126, .08)";
      ctx.stroke();
    }
    ctx.beginPath();
    for (let x = Math.floor(left / 100) * 100; x < right; x += 100) {
      ctx.moveTo(x, top); ctx.lineTo(x, bottom);
    }
    for (let y = Math.floor(top / 100) * 100; y < bottom; y += 100) {
      ctx.moveTo(left, y); ctx.lineTo(right, y);
    }
    ctx.strokeStyle = "rgba(91, 122, 126, .14)";
    ctx.stroke();
  }

  setTool(tool) {
    const supported = new Set(["select", "annotation-arrow", "annotation-rectangle", "annotation-text"]);
    this.cancelInteraction();
    this.activeTool = supported.has(tool) ? tool : "select";
    this.canvas.style.cursor = this.activeTool === "select" ? "default" : "crosshair";
    this.callbacks.onToolChange?.(this.activeTool);
    this.invalidate();
  }

  drawAnnotations(ctx, interactive = true) {
    for (const annotation of this.state.topology?.annotations || []) {
      const selected = interactive && this.state.selection?.type === "annotation" && this.state.selection.id === annotation.id;
      const hovered = interactive && this.hoveredAnnotation?.id === annotation.id;
      this.drawAnnotation(ctx, annotation, selected || hovered ? 1 : .9, selected, hovered);
    }
  }

  drawAnnotationDraft(ctx) {
    if (!this.annotationDraft) return;
    this.drawAnnotation(ctx, {
      type: this.annotationDraft.type,
      x1: this.annotationDraft.start.x,
      y1: this.annotationDraft.start.y,
      x2: this.annotationDraft.end.x,
      y2: this.annotationDraft.end.y,
      color: "#f0b35a",
      text: this.annotationDraft.type === "text" ? "NOTE" : "",
    }, .68);
  }

  drawAnnotation(ctx, annotation, alpha, selected = false, hovered = false) {
    const color = annotation.color || "#f0b35a";
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = (selected ? 3.5 : hovered ? 3 : 2) / this.camera.zoom;
    if (selected || hovered) {
      ctx.shadowColor = selected ? "#42d9c8" : color;
      ctx.shadowBlur = 9 / this.camera.zoom;
    }
    ctx.setLineDash([8 / this.camera.zoom, 4 / this.camera.zoom]);
    if (annotation.type === "rectangle") {
      ctx.strokeRect(annotation.x1, annotation.y1, annotation.x2 - annotation.x1, annotation.y2 - annotation.y1);
    } else if (annotation.type === "arrow") {
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(annotation.x1, annotation.y1); ctx.lineTo(annotation.x2, annotation.y2); ctx.stroke();
      const angle = Math.atan2(annotation.y2 - annotation.y1, annotation.x2 - annotation.x1);
      const head = 13 / this.camera.zoom;
      ctx.beginPath();
      ctx.moveTo(annotation.x2, annotation.y2);
      ctx.lineTo(annotation.x2 - Math.cos(angle - .48) * head, annotation.y2 - Math.sin(angle - .48) * head);
      ctx.lineTo(annotation.x2 - Math.cos(angle + .48) * head, annotation.y2 - Math.sin(angle + .48) * head);
      ctx.closePath(); ctx.fill();
    } else if (annotation.type === "text") {
      const text = String(annotation.text || "NOTE");
      ctx.setLineDash([]);
      ctx.font = `700 ${12 / this.camera.zoom}px Bahnschrift Condensed, sans-serif`;
      const width = ctx.measureText(text).width + 18 / this.camera.zoom;
      const height = 26 / this.camera.zoom;
      ctx.fillStyle = "rgba(8,15,17,.92)";
      ctx.strokeStyle = color;
      ctx.beginPath(); ctx.roundRect(annotation.x1, annotation.y1 - height, width, height, 4 / this.camera.zoom); ctx.fill(); ctx.stroke();
      ctx.fillStyle = color; ctx.textBaseline = "middle";
      ctx.fillText(text, annotation.x1 + 9 / this.camera.zoom, annotation.y1 - height / 2);
    }
    ctx.restore();
    if (selected) this.drawAnnotationSelection(ctx, annotation);
  }

  drawAnnotationSelection(ctx, annotation) {
    const bounds = this.annotationBounds(annotation);
    const handle = 6 / this.camera.zoom;
    ctx.save();
    ctx.strokeStyle = "#42d9c8";
    ctx.fillStyle = "#091113";
    ctx.lineWidth = 1.5 / this.camera.zoom;
    ctx.setLineDash([4 / this.camera.zoom, 3 / this.camera.zoom]);
    ctx.strokeRect(bounds.x, bounds.y, Math.max(bounds.width, 1 / this.camera.zoom), Math.max(bounds.height, 1 / this.camera.zoom));
    ctx.setLineDash([]);
    for (const point of bounds.handles) {
      ctx.fillRect(point.x - handle / 2, point.y - handle / 2, handle, handle);
      ctx.strokeRect(point.x - handle / 2, point.y - handle / 2, handle, handle);
    }
    ctx.restore();
  }

  annotationBounds(annotation) {
    if (annotation.type === "text") {
      this.ctx.save();
      this.ctx.font = `700 ${12 / this.camera.zoom}px Bahnschrift Condensed, sans-serif`;
      const width = this.ctx.measureText(String(annotation.text || "NOTE")).width + 18 / this.camera.zoom;
      this.ctx.restore();
      const height = 26 / this.camera.zoom;
      return {
        x: annotation.x1, y: annotation.y1 - height, width, height,
        handles: [{ x: annotation.x1, y: annotation.y1 }, { x: annotation.x1 + width, y: annotation.y1 - height }],
      };
    }
    const x = Math.min(annotation.x1, annotation.x2);
    const y = Math.min(annotation.y1, annotation.y2);
    const width = Math.abs(annotation.x2 - annotation.x1);
    const height = Math.abs(annotation.y2 - annotation.y1);
    return {
      x, y, width, height,
      handles: [{ x: annotation.x1, y: annotation.y1 }, { x: annotation.x2, y: annotation.y2 }],
    };
  }

  drawDragGhosts(ctx) {
    if (this.drag?.active) {
      for (const original of this.drag.originals.values()) {
        const height = Math.max(UNIT_HEIGHT, (original.device.faceplate.unitsU || 1) * UNIT_HEIGHT);
        ctx.save();
        ctx.globalAlpha = .24;
        ctx.fillStyle = original.device.faceplate.vendorColor || "#42d9c8";
        ctx.strokeStyle = "#8ff4e8";
        ctx.setLineDash([10 / this.camera.zoom, 6 / this.camera.zoom]);
        ctx.fillRect(original.x, original.y, DEVICE_WIDTH, height);
        ctx.strokeRect(original.x, original.y, DEVICE_WIDTH, height);
        ctx.restore();
      }
    }
    if (!this.rackDrag?.active) return;
    const selected = this.rackBoxes.find((box) => box.rack.id === this.state.selection?.id);
    if (!selected) return;
    const collision = this.rackBoxes.some((box) => box.rack.id !== selected.rack.id && intersects(expand(selected, 18), expand(box, 18)));
    ctx.save();
    ctx.globalAlpha = .62;
    ctx.strokeStyle = collision ? "#f36c63" : "#42d9c8";
    ctx.fillStyle = collision ? "rgba(243,108,99,.09)" : "rgba(66,217,200,.06)";
    ctx.setLineDash([12 / this.camera.zoom, 6 / this.camera.zoom]);
    ctx.lineWidth = 2 / this.camera.zoom;
    const zone = expand(selected, 18);
    ctx.fillRect(zone.x, zone.y, zone.width, zone.height);
    ctx.strokeRect(zone.x, zone.y, zone.width, zone.height);
    ctx.restore();
  }

  addVisibleDevice(device, rack, position) {
    const height = Math.max(UNIT_HEIGHT, (device.faceplate.unitsU || 1) * UNIT_HEIGHT);
    const deviceBox = { device, rack, x: position.x, y: position.y, width: DEVICE_WIDTH, height };
    this.deviceBoxes.push(deviceBox);
    this.routingDeviceBoxes.push(deviceBox);
    this.deviceBoxByID.set(device.id, deviceBox);
    this.deviceTiles.insert(deviceBox);
    const devicePortBoxes = [];
    const rows = Math.max(1, Math.min(4, device.faceplate.rows || 1));
    const columns = Math.ceil(device.ports.length / rows);
    const startX = position.x + 170;
    const available = 475;
    const stepX = columns > 1 ? Math.min(31, available / (columns - 1)) : 0;
    const groupWidth = stepX * Math.max(0, columns - 1);
    const baseX = startX + Math.max(0, (available - groupWidth) / 2);
    const stepY = rows === 1 ? 0 : 29;
    const baseY = position.y + height / 2 - (stepY * (rows - 1)) / 2;
    device.ports.forEach((port, index) => {
      const row = index % rows;
      const column = Math.floor(index / rows);
      const hasFaceplatePosition = port.faceplateX > 0 && port.faceplateY > 0;
      const centerX = hasFaceplatePosition ? position.x + port.faceplateX * DEVICE_WIDTH : baseX + column * stepX;
      const centerY = hasFaceplatePosition ? position.y + port.faceplateY * height : baseY + row * stepY;
      const connector = faceplateConnectorSize(port, device);
      const portBox = {
        port, device,
        x: centerX - connector.width / 2, y: centerY - connector.height / 2,
        width: connector.width, height: connector.height, centerX, centerY,
      };
      this.portBoxes.push(portBox);
      this.routingPortBoxes.push(portBox);
      devicePortBoxes.push(portBox);
      this.portBoxByID.set(port.id, portBox);
      this.routingPortBoxByID.set(port.id, portBox);
    });
    this.portBoxesByDevice.set(device.id, devicePortBoxes);
  }

  addPortalDevice(device, rack, marker) {
    const centerX = marker.x + marker.width / 2;
    const centerY = marker.y + marker.height / 2;
    const deviceBox = { device, rack, x: centerX - 10, y: centerY - 10, width: 20, height: 20, portal: true };
    this.routingDeviceBoxes.push(deviceBox);
    marker.deviceIDs.add(device.id);
    device.ports.forEach((port, index) => {
      const portCenterY = centerY + ((index % 5) - 2) * 2;
      const portBox = {
        port, device, portal: true,
        x: centerX - 3, y: portCenterY - 3, width: 6, height: 6,
        centerX, centerY: portCenterY,
      };
      this.routingPortBoxes.push(portBox);
      this.routingPortBoxByID.set(port.id, portBox);
      marker.portIDs.add(port.id);
    });
  }

  layoutScene() {
    if (!this.sceneDirty) return;
    const previousGeometry = captureRoutingGeometry(this.routingDeviceBoxes, this.rackBoxes, this.routingPortBoxes);
    this.rackBoxes = [];
    this.rackFaceBoxes = [];
    this.routingRackBoxes = [];
    this.deviceBoxes = [];
    this.shadowDeviceBoxes = [];
    this.routingDeviceBoxes = [];
    this.rackTiles.clear();
    this.deviceTiles.clear();
    this.portBoxes = [];
    this.routingPortBoxes = [];
    this.deviceBoxByID = new Map();
    this.portBoxByID = new Map();
    this.routingPortBoxByID = new Map();
    this.portBoxesByDevice = new Map();
    this.rackPortalMarkers = [];
    this.linkIDsByPort = new Map();
    this.linkIDsByDevice = new Map();
    this.linksByPort = new Map();
    this.linksByDevice = new Map();
    this.groupByLink = new Map();
    this.groupLinkIDsByLink = new Map();
    this.patchPanelPathLinkIDsByLink = new Map();
    this.vlanByID = new Map();
    this.orderedLinks = [];
    const topology = this.state.topology;
    if (!topology) {
      this.routingChanges = { full: true, changedDeviceIDs: new Set(), obstacleBounds: [] };
      this.routingGeometryKey = "";
      this.sceneDirty = false;
      this.sceneRevision += 1;
      return;
    }
    const racks = new Map((topology.racks || []).map((rack) => [rack.id, rack]));
    const traceExpandedRackIDs = tracedRackIDs(topology, this.state.traceLinkIDs);
    const manualExpandedRackIDs = this.state.dualFaceRackIDs || new Set();
    const expandedRackIDs = new Set([...traceExpandedRackIDs, ...manualExpandedRackIDs]);
    const rackGroupLayouts = layoutRackGroups([...racks.values()], expandedRackIDs);
    const faceBoxes = new Map();
    const portalByRack = new Map();
    for (const rack of racks.values()) {
      const currentFace = this.state.rackFace(rack.id);
      const expanded = expandedRackIDs.has(rack.id);
      const faces = visibleRackFaces(currentFace, expanded);
      const base = rackGroupLayouts.get(rack.id);
      const container = {
        rack, x: base.x, y: base.y,
        width: base.width,
        height: base.height, face: currentFace, expanded,
      };
      this.rackBoxes.push(container);
      faces.forEach((face, index) => {
        const box = {
          rack, face, expanded, primary: index === 0,
          manualExpanded: manualExpandedRackIDs.has(rack.id),
          traceExpanded: traceExpandedRackIDs.has(rack.id),
          routingKey: `${rack.id}:${face}`,
          x: base.x + index * (RACK_WIDTH + RACK_FACE_GAP), y: base.y,
          width: RACK_WIDTH, height: base.height,
        };
        this.rackFaceBoxes.push(box);
        this.routingRackBoxes.push(box);
        this.rackTiles.insert(box);
        faceBoxes.set(`${rack.id}:${face}`, box);
      });
      if (!expanded) {
        const marker = {
          rack, face: oppositeRackFace(currentFace),
          x: base.x + RACK_WIDTH - 270, y: base.y + 15, width: 112, height: 32,
          deviceIDs: new Set(), portIDs: new Set(), linkIDs: new Set(),
        };
        this.rackPortalMarkers.push(marker);
        portalByRack.set(rack.id, marker);
      }
    }
    for (const device of topology.devices) {
      const rack = device.rackId ? racks.get(device.rackId) : null;
      if (!rack || device.rackUnit < 1) {
        this.addVisibleDevice(device, null, { x: device.positionX, y: device.positionY });
        continue;
      }
      const face = normalizeRackFace(device.rackFace);
      const visibleRackBox = faceBoxes.get(`${rack.id}:${face}`);
      if (visibleRackBox) {
        const visualRack = { ...rack, positionX: visibleRackBox.x, positionY: visibleRackBox.y };
        this.addVisibleDevice(device, rack, mountedDevicePosition(visualRack, device));
        continue;
      }
      const primaryBox = faceBoxes.get(`${rack.id}:${this.state.rackFace(rack.id)}`);
      const visualRack = { ...rack, positionX: primaryBox.x, positionY: primaryBox.y };
      const position = mountedDevicePosition(visualRack, device);
      this.shadowDeviceBoxes.push({
        device, rack, face, x: position.x, y: position.y, width: DEVICE_WIDTH,
        height: Math.max(UNIT_HEIGHT, (device.faceplate.unitsU || 1) * UNIT_HEIGHT),
      });
      this.addPortalDevice(device, rack, portalByRack.get(rack.id));
    }
    this.vlanByID = new Map((topology.vlans || []).map((vlan) => [vlan.id, vlan]));
    this.patchPanelPathLinkIDsByLink = patchPanelPathIndex(topology);
    const liveLinkIDs = new Set((topology.links || []).map((link) => link.id));
    for (const group of topology.linkGroups || []) {
      const memberLinkIDs = new Set((group.linkIds || []).filter((linkID) => liveLinkIDs.has(linkID)));
      for (const linkID of memberLinkIDs) {
        this.groupByLink.set(linkID, group);
        this.groupLinkIDsByLink.set(linkID, memberLinkIDs);
      }
    }
    this.orderedLinks = orderedCableLinks(topology);
    for (const link of topology.links || []) {
      const source = this.routingPortBoxByID.get(link.sourcePortId);
      const target = this.routingPortBoxByID.get(link.targetPortId);
      for (const portID of new Set([link.sourcePortId, link.targetPortId])) {
        addMapSetValue(this.linkIDsByPort, portID, link.id);
        addMapArrayValue(this.linksByPort, portID, link);
      }
      for (const deviceID of new Set([
        link.sourceDeviceId || source?.device.id,
        link.targetDeviceId || target?.device.id,
      ].filter(Boolean))) {
        addMapSetValue(this.linkIDsByDevice, deviceID, link.id);
        addMapArrayValue(this.linksByDevice, deviceID, link);
      }
      for (const marker of this.rackPortalMarkers) {
        if (marker.portIDs.has(link.sourcePortId) || marker.portIDs.has(link.targetPortId)) marker.linkIDs.add(link.id);
      }
    }
    this.rackPortalMarkers = this.rackPortalMarkers.filter((marker) => marker.linkIDs.size > 0);
    const currentGeometry = captureRoutingGeometry(this.routingDeviceBoxes, this.rackBoxes, this.routingPortBoxes);
    this.routingChanges = compareRoutingGeometry(previousGeometry, currentGeometry, this.sceneRevision === 0);
    this.routingGeometryKey = currentGeometry.key;
    this.sceneDirty = false;
    this.sceneRevision += 1;
  }

  graphicsProfile() {
    return resolveGraphicsProfile(this.graphicsMode, this.state.topology, {
      hardwareConcurrency: globalThis.navigator?.hardwareConcurrency,
      deviceMemory: globalThis.navigator?.deviceMemory,
      devicePixelRatio: globalThis.devicePixelRatio,
    }, this.reducedMotion);
  }

  setGraphicsMode(mode) {
    this.graphicsMode = normalizeGraphicsMode(mode);
    this.resize();
    this.invalidate();
    return this.graphicsProfile();
  }

  setNavigationMode(mode) {
    this.navigationMode = normalizeNavigationMode(mode);
    this.navigationDetector = {};
    this.lastDetectedNavigationMode = "";
    this.callbacks.onNavigationInput?.({
      mode: this.navigationMode,
      detectedMode: this.navigationMode,
      gesture: null,
    });
  }

  invalidate(layout = false) {
    this.needsRender = true;
    if (layout) {
      this.sceneDirty = true;
      this.routeCache.clear();
    }
    if (!this.frame && this.isDocumentVisible && this.isCanvasVisible) {
      this.frame = requestAnimationFrame(this.loop);
    }
  }

  drawRack(ctx, box) {
    const { rack } = box;
    const selected = this.state.selection?.type === "rack" && this.state.selection.id === rack.id;
    const bayTop = box.y + RACK_HEADER_HEIGHT;
    const bayHeight = rack.heightU * RACK_UNIT_HEIGHT;
    const used = usedRackUnits(this.state.topology, rack.id, box.face);
    const profile = this.activeGraphicsProfile || QUALITY_FALLBACK;
    ctx.save();
    if (profile.shadows) {
      ctx.shadowColor = "rgba(0,0,0,.62)";
      ctx.shadowBlur = 28;
      ctx.shadowOffsetY = 12;
    }
    ctx.fillStyle = "rgba(5, 10, 12, .82)";
    ctx.strokeStyle = selected ? "#66eddd" : rack.color;
    ctx.lineWidth = selected ? 3 : 2;
    ctx.beginPath(); ctx.roundRect(box.x, box.y, box.width, box.height, 7); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

    const header = ctx.createLinearGradient(box.x, box.y, box.x, box.y + RACK_HEADER_HEIGHT);
    header.addColorStop(0, lighten(rack.color, 14));
    header.addColorStop(1, darken(rack.color, 22));
    ctx.fillStyle = header;
    ctx.fillRect(box.x + 2, box.y + 2, box.width - 4, RACK_HEADER_HEIGHT - 2);
    ctx.fillStyle = "#f1f8f7";
    ctx.font = "700 18px Bahnschrift Condensed, sans-serif";
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    ctx.fillText(rack.name, box.x + 26, box.y + 28, box.width - 430);
    ctx.fillStyle = "rgba(230, 244, 243, .68)";
    ctx.font = "700 9px Bahnschrift Condensed, sans-serif";
    ctx.fillText(`${rack.heightU}U ENCLOSURE · ${box.face.toUpperCase()} FACE · DRAG HEADER TO MOVE`, box.x + 27, box.y + 46);
    ctx.textAlign = "right";
    ctx.fillStyle = used === rack.heightU ? "#f36c63" : "#8ff4e8";
    ctx.fillText(`${used}U USED · ${rack.heightU - used}U FREE`, box.x + box.width - 290, box.y + 34);

    ctx.fillStyle = "rgba(10, 17, 19, .88)";
    ctx.fillRect(box.x + RACK_DEVICE_INSET, bayTop, box.width - RACK_DEVICE_INSET * 2, bayHeight);
    ctx.fillStyle = darken(rack.color, 30);
    ctx.fillRect(box.x + 8, bayTop, 18, bayHeight);
    ctx.fillRect(box.x + box.width - 26, bayTop, 18, bayHeight);
    for (let index = 0; index <= rack.heightU; index += 1) {
      const y = bayTop + index * RACK_UNIT_HEIGHT;
      ctx.strokeStyle = index % 5 === 0 ? "rgba(104, 152, 154, .44)" : "rgba(91, 122, 126, .24)";
      ctx.lineWidth = index % 5 === 0 ? 1.5 : 1;
      ctx.beginPath(); ctx.moveTo(box.x + RACK_DEVICE_INSET, y); ctx.lineTo(box.x + box.width - RACK_DEVICE_INSET, y); ctx.stroke();
      if (index === rack.heightU) continue;
      const unit = rack.heightU - index;
      ctx.fillStyle = unit % 5 === 0 || unit === 1 ? "#91aaad" : "#536b6f";
      ctx.font = "700 8px Bahnschrift Condensed, sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(`U${unit}`, box.x + 17, y + RACK_UNIT_HEIGHT / 2);
      ctx.fillText(`U${unit}`, box.x + box.width - 17, y + RACK_UNIT_HEIGHT / 2);
      for (const railX of [box.x + 17, box.x + box.width - 17]) {
        for (const offset of [25, 50, 75]) {
          ctx.fillStyle = "#071012";
          ctx.beginPath(); ctx.arc(railX, y + offset, 2.2, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  rackFaceControls(box) {
    if (box.expanded && !box.primary) return [];
    const width = 57;
    const gap = 5;
    const definitions = [
      { action: "face", face: RackFace.FRONT, label: "FRONT" },
      { action: "face", face: RackFace.REAR, label: "REAR" },
      { action: "dual", label: "DUAL" },
    ];
    const startX = box.x + box.width - width * definitions.length - gap * (definitions.length - 1) - 24;
    return definitions.map((definition, index) => ({
      rack: box.rack, ...definition,
      x: startX + index * (width + gap), y: box.y + 17, width, height: 28,
    }));
  }

  drawRackFaceControls(ctx, rackBoxes) {
    for (const box of rackBoxes) {
      const controls = this.rackFaceControls(box);
      if (!controls.length) continue;
      const first = controls[0];
      const last = controls.at(-1);
      ctx.save();
      ctx.fillStyle = "rgba(5, 14, 16, .98)";
      ctx.strokeStyle = "rgba(90, 151, 154, .58)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(first.x - 5, first.y - 4, last.x + last.width - first.x + 10, first.height + 8, 6);
      ctx.fill(); ctx.stroke();
      for (const control of controls) {
        const active = control.action === "dual"
          ? this.state.isRackDualFace?.(box.rack.id)
          : control.face === box.face;
        ctx.fillStyle = active ? "#174b47" : "#0a1719";
        ctx.strokeStyle = active ? "#8ff4e8" : "#415d60";
        ctx.lineWidth = active ? 1.5 : 1;
        ctx.beginPath(); ctx.roundRect(control.x, control.y, control.width, control.height, 4); ctx.fill(); ctx.stroke();
        ctx.fillStyle = active ? "#d7fffa" : "#9bb1b2";
        ctx.font = "700 9px Bahnschrift Condensed, sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(control.label, control.x + control.width / 2, control.y + control.height / 2);
      }
      ctx.restore();
    }
  }

  drawDeviceShadow(ctx, box) {
    ctx.save();
    ctx.globalAlpha = .18;
    ctx.fillStyle = "#718185";
    ctx.strokeStyle = "#a9b8ba";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([10, 8]);
    ctx.beginPath(); ctx.roundRect(box.x, box.y, box.width, box.height, 6); ctx.fill(); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(8, 14, 16, .55)";
    ctx.fillRect(box.x + 22, box.y + box.height * .34, box.width - 44, Math.max(8, box.height * .32));
    ctx.restore();
  }

  drawRackPortals(ctx) {
    for (const marker of this.rackPortalMarkers) {
      ctx.save();
      ctx.fillStyle = "rgba(7, 16, 19, .94)";
      ctx.strokeStyle = "#56c9db";
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(marker.x, marker.y, marker.width, marker.height, 6); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#b9f7f1";
      ctx.font = "700 9px Bahnschrift Condensed, sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(`${marker.face.toUpperCase()} · ${marker.linkIDs.size} LINK${marker.linkIDs.size === 1 ? "" : "S"}`,
        marker.x + marker.width / 2, marker.y + marker.height / 2);
      ctx.restore();
    }
  }

  drawRackLanding(ctx) {
    const preview = this.rackDropPreview;
    if (!preview) return;
    const units = Math.max(1, preview.device.faceplate.unitsU || 1);
    ctx.save();
    ctx.fillStyle = preview.isValid ? "rgba(66, 217, 200, .18)" : "rgba(243, 108, 99, .2)";
    ctx.strokeStyle = preview.isValid ? "#66eddd" : "#f36c63";
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 7]);
    ctx.fillRect(preview.position.x, preview.position.y, DEVICE_WIDTH, units * UNIT_HEIGHT);
    ctx.strokeRect(preview.position.x, preview.position.y, DEVICE_WIDTH, units * UNIT_HEIGHT);
    ctx.setLineDash([]);
    ctx.fillStyle = preview.isValid ? "#8ff4e8" : "#ff9189";
    ctx.font = "700 11px Bahnschrift Condensed, sans-serif";
    ctx.textAlign = "center";
    const face = normalizeRackFace(preview.rackFace).toUpperCase();
    const label = preview.isValid ? `MOUNT ${face} · U${preview.rackUnit}` :
      preview.reason === "capacity" ? `DEVICE EXCEEDS ${preview.rack.heightU}U ${face} CAPACITY` : `${face} · U${preview.rackUnit} RANGE OCCUPIED`;
    ctx.fillText(label, preview.position.x + DEVICE_WIDTH / 2, preview.position.y - 10);
    ctx.restore();
  }

  cableTrackPlan(orderedLinks = orderedCableLinks(this.state.topology)) {
    const groupSignature = (this.state.topology?.linkGroups || []).map((group) =>
      `${group.id}:${group.mode}:${group.linkIds.join(",")}:${group.primaryLinkId || ""}`).join("|");
    const structureKey = `${(this.state.topology?.racks || []).map((rack) => rack.id).join(",")}|${
      (this.state.topology?.devices || []).map((device) => `${device.id}:${device.rackId || "free"}:${normalizeRackFace(device.rackFace)}:${
        (device.ports || []).map((port) => `${port.id}:${port.portIndex || 0}:${port.label}:${port.type}:${port.mediaType || ""}`).join(",")}`).join("|")}|${orderedLinks.map((link) =>
      `${link.id}:${link.sourcePortId}:${link.sourceSide || "front"}:${link.targetPortId}:${link.targetSide || "front"}:${link.cableType}:${link.rearChannelId || ""}:${link.rearChannelType || ""}`).join("|")}|${groupSignature}|${
      (this.state.topology?.racks || []).map((rack) => `${rack.id}:${this.state.rackFace?.(rack.id) || RackFace.FRONT}`).join(",")}|${[...(this.state.traceLinkIDs || [])].sort().join(",")}|${[...(this.state.dualFaceRackIDs || [])].sort().join(",")}`;
    if (this.trackPlanCache?.structureKey === structureKey && this.trackPlanCache?.geometryKey === this.routingGeometryKey) {
      this.lastRoutingStats = {
        mode: "reused", totalLinks: orderedLinks.length, reroutedLinks: 0, crossingPairs: 0,
      };
      return this.trackPlanCache;
    }

    const canIncrement = this.trackPlanCache?.structureKey === structureKey && !this.routingChanges.full;
    const affectedLinkIDs = canIncrement ? this.affectedRoutingLinkIDs(orderedLinks) : new Set(orderedLinks.map((link) => link.id));
    const incrementalLimit = Math.max(1, Math.ceil(orderedLinks.length * .6));
    const incremental = canIncrement && affectedLinkIDs.size > 0 && affectedLinkIDs.size <= incrementalLimit;
    if (canIncrement && affectedLinkIDs.size === 0) {
      this.trackPlanCache = {
        ...this.trackPlanCache,
        geometryKey: this.routingGeometryKey,
        key: `route-plan-${++this.routingPlanRevision}`,
      };
      this.lastRoutingStats = {
        mode: "reused", totalLinks: orderedLinks.length, reroutedLinks: 0, crossingPairs: 0,
      };
      return this.trackPlanCache;
    }
    const previousBaseTracks = incremental
      ? new Map([...this.trackPlanCache.tracks].map(([linkID, track]) => [linkID, track.route]))
      : null;
    const baseTracks = assignCableTracks({
      links: orderedLinks,
      portBoxes: this.routingPortBoxes || this.portBoxes,
      deviceBoxes: this.routingDeviceBoxes || this.deviceBoxes,
      rackBoxes: this.routingRackBoxes || this.rackFaceBoxes || this.rackBoxes,
      linkGroups: this.state.topology?.linkGroups || [],
    }, incremental ? { previousTracks: previousBaseTracks, rerouteLinkIDs: affectedLinkIDs } : undefined);
    const planned = orderedLinks.map((link) => ({ link, route: baseTracks.get(link.id) })).filter(({ route }) => route);
    const crossingStats = { pairsExamined: 0 };
    const previousRoutes = incremental
      ? planned.map(({ link }) => this.trackPlanCache.tracks.get(link.id)?.curve)
      : null;
    const affectedIndices = incremental
      ? new Set(planned.flatMap(({ link }, index) => affectedLinkIDs.has(link.id) ? [index] : []))
      : null;
    const bridgedRoutes = routesWithCrossingBridges(planned.map(({ route }) => route), incremental ? {
      previousRoutes, affectedIndices, stats: crossingStats,
    } : { stats: crossingStats });
    const tracks = new Map(planned.map(({ link, route }, index) => [link.id, { route, curve: bridgedRoutes[index] }]));
    this.trackPlanCache = {
      key: `route-plan-${++this.routingPlanRevision}`,
      structureKey,
      geometryKey: this.routingGeometryKey,
      tracks,
    };
    this.lastRoutingStats = {
      mode: incremental ? "incremental" : "full",
      totalLinks: orderedLinks.length,
      reroutedLinks: incremental ? affectedLinkIDs.size : orderedLinks.length,
      crossingPairs: crossingStats.pairsExamined,
    };
    return this.trackPlanCache;
  }

  affectedRoutingLinkIDs(orderedLinks) {
    const affected = new Set();
    for (const deviceID of this.routingChanges.changedDeviceIDs) {
      for (const linkID of this.linkIDsByDevice.get(deviceID) || []) affected.add(linkID);
    }
    for (const [linkID, track] of this.trackPlanCache?.tracks || []) {
      if (affected.has(linkID)) continue;
      const crossesChangedObstacle = this.routingChanges.obstacleBounds.some((bounds) =>
        routeSegments(track.route).some((segment) =>
          segmentIntersectsRectangle(segment.source, segment.target, expand(bounds, 10))));
      if (crossesChangedObstacle) affected.add(linkID);
    }
    // Span-ranked lanes are a shared-spine invariant. If one route in a spine
    // moves, every route reserving that spine must be reconsidered so a stale
    // cached ordinal cannot leave a longer span inside a shorter one.
    let expanded = true;
    while (expanded) {
      expanded = false;
      for (const linkID of [...affected]) {
        for (const memberID of this.groupLinkIDsByLink.get(linkID) || []) {
          if (!affected.has(memberID)) { affected.add(memberID); expanded = true; }
        }
      }
      const affectedSpines = new Set([...affected].flatMap((linkID) =>
        this.trackPlanCache?.tracks.get(linkID)?.route?.verticalSpineKeys || []));
      if (!affectedSpines.size) continue;
      for (const [linkID, track] of this.trackPlanCache?.tracks || []) {
        if (affected.has(linkID)) continue;
        if ((track.route.verticalSpineKeys || []).some((key) => affectedSpines.has(key))) {
          affected.add(linkID);
          expanded = true;
        }
      }
    }
    const liveLinkIDs = new Set(orderedLinks.map((link) => link.id));
    return new Set([...affected].filter((linkID) => liveLinkIDs.has(linkID)));
  }

  drawLinks(ctx, time, showAllLabels = false, showInteractionHighlights = true) {
    const topology = this.state.topology;
    if (!topology) return;
    const routingPortBoxes = this.routingPortBoxes || this.portBoxes || [];
    const portMap = this.routingPortBoxByID || new Map(routingPortBoxes.map((box) => [box.port.id, box]));
    const vlanMap = this.vlanByID || new Map((topology.vlans || []).map((vlan) => [vlan.id, vlan]));
    const groupByLink = this.groupByLink || new Map((topology.linkGroups || []).flatMap((group) =>
      (group.linkIds || []).map((linkID) => [linkID, group])));
    const selectedLinkID = this.state.selection?.type === "link" ? this.state.selection.id : "";
    const selectedPeerLinkIDs = peerLinkIDs(topology, selectedLinkID);
    const selectedGroup = groupByLink.get(selectedLinkID);
    const warnings = new Set();
    for (const issue of this.state.analysis?.issues || []) {
      if (issue.linkId) warnings.add(issue.linkId);
      if (issue.groupId) {
        const group = (topology.linkGroups || []).find((candidate) => candidate.id === issue.groupId);
        for (const linkID of group?.linkIds || []) warnings.add(linkID);
      }
    }
    const profile = this.activeGraphicsProfile || QUALITY_FALLBACK;
    const activeLinkIDs = new Set();
    const orderedLinks = this.orderedLinks || orderedCableLinks(topology);
    const trackPlan = this.cableTrackPlan(orderedLinks);
    const hoverFocusLinkIDs = showInteractionHighlights ? this.hoverFocusLinkIDs(topology) : new Set();
    const hasHoverFocus = hoverFocusLinkIDs.size > 0;
    const rearHoverIsolation = showInteractionHighlights && this.rearHoverIsolationActive(topology);
    const deviceHover = Boolean(this.hoveredDevice?.device.id);
    this.linkCurves = [];
    let rearChannelSheathsDrawn = false;
    const drawRearChannelSheaths = () => {
      if (rearChannelSheathsDrawn) return;
      rearChannelSheathsDrawn = true;
      this.drawRearChannelSheaths(ctx, trackPlan.tracks, {
        hoverFocusLinkIDs,
        hasHoverFocus,
      });
    };
    for (const link of orderedLinks) {
      const source = portMap.get(link.sourcePortId);
      const target = portMap.get(link.targetPortId);
      if (!source || !target) continue;
      const group = groupByLink.get(link.id);
      activeLinkIDs.add(link.id);
      const cached = trackPlan.tracks.get(link.id);
      if (!cached) continue;
      const baseCurve = cached.route;
      const curve = cached.curve;
      this.routeCache.set(link.id, { key: trackPlan.key, ...cached });
      const sourceSpeed = source.port.speedMbps || 1000;
      const targetSpeed = target.port.speedMbps || 1000;
      const speed = Math.min(sourceSpeed, targetSpeed);
      const speedThickness = speed >= 40000 ? 6 : speed >= 10000 ? 4 : 2.5;
      const selected = this.state.selection?.type === "link" && this.state.selection.id === link.id;
      const selectedPeer = selectedPeerLinkIDs.has(link.id);
      const traced = this.state.traceLinkIDs.has(link.id);
      const rearMapping = isRearPanelLink(link);
      // Rear strands are painted first as panel-end fan-outs. Their shared tube
      // then covers the common run before any solid front cable is painted.
      if (!rearMapping) drawRearChannelSheaths();
      const thickness = rearMapping ? RearPanelLinkVisual.strokeWidth :
        baseCurve.tightBundle ? Math.min(speedThickness, 1.5) : speedThickness;
      const vlanPalette = linkVLANPalette(topology, link);
      const role = cableRole(link, source, target, { crossRack: baseCurve.crossRack, group });
      const dash = cableDashPattern(link, source, target, { group, role });
      const primaryColor = rearMapping ? RearPanelLinkVisual.color : role.color;
      const failoverRole = group?.mode === "Failover" ? (group.primaryLinkId === link.id ? "primary" : "backup") : "";
      const baseCableAlpha = rearMapping ? RearPanelLinkVisual.opacity : failoverRole === "backup" ? .72 : .96;
      const hoverFocused = hoverFocusLinkIDs.has(link.id);
      const effectiveHoverFocus = hoverFocused && !(rearHoverIsolation && !rearMapping);
      const hoverAlphaFactor = cableHoverAlphaFactor({
        rearIsolation: rearHoverIsolation,
        rearMapping,
        hasHoverFocus,
        hoverFocused,
      });
      const cableAlpha = baseCableAlpha * hoverAlphaFactor;
      const groupTarget = this.linkDrag?.targetLinkID === link.id;
      const detailedHoverFocus = effectiveHoverFocus && !deviceHover;
      const focused = selected || selectedPeer || traced || groupTarget || detailedHoverFocus;
      const animateEffect = graphicsEffectActive(profile, focused);
      const effectTime = animateEffect ? time : 0;
      const entry = {
        link, curve, baseCurve, source, target, thickness, selected, selectedPeer, traced, primaryColor, group,
        vlanPalette, cableAlpha, rearMapping, role, dash, hoverFocused: detailedHoverFocus, warning: warnings.has(link.id),
      };
      this.linkCurves.push(entry);
      if (groupTarget) {
        this.strokeCurve(ctx, curve, "#f0b35a", thickness + 13, .28);
        this.strokeCurve(ctx, curve, "#ffe0a7", thickness + 5, .9);
      }
      if (selected || traced) {
        this.strokeCurve(ctx, curve, traced ? "#f6f8ca" : "#7affee", thickness + 8, .25);
      }
      if (selectedPeer) {
        const peerAccent = groupAccent(selectedGroup?.mode);
        const peerAlpha = .2 + Math.sin(effectTime / 420) * .045;
        this.strokeCurve(ctx, curve, peerAccent, thickness + 10, peerAlpha);
        this.strokeCurve(ctx, curve, peerAccent, thickness + 4, .78);
      }
      if (rearMapping) {
        this.strokeCurve(ctx, curve, "#020607", RearPanelLinkVisual.casingWidth, Math.min(cableAlpha, RearPanelLinkVisual.casingOpacity));
        this.strokeCurve(ctx, curve, primaryColor, thickness, cableAlpha, { dash: RearPanelLinkVisual.dash, lineCap: "butt" });
        if (detailedHoverFocus) this.drawHoveredLinkHighlightEntry(ctx, time, entry);
      } else {
        const roleWidth = thickness + 1.25;
        this.strokeCurve(ctx, curve, "#020607", roleWidth + CABLE_OUTLINE_WIDTH * 2, cableAlpha);
        this.strokeCurve(ctx, curve, role.color, roleWidth, cableAlpha * .78, { dash });
        this.drawVLANColors(ctx, curve, vlanPalette, Math.max(1.5, thickness - .5), effectTime, cableAlpha, dash);
        if (profile.pulses === "all" || (profile.pulses === "focused" && focused)) this.drawPulse(ctx, curve, effectTime, primaryColor);
      }
      if (warnings.has(link.id)) this.drawWarning(ctx, pointOnRoute(curve, .57), hoverAlphaFactor);
    }
    drawRearChannelSheaths();
    this.drawBridgeJumpers(ctx, time, profile);
    for (const linkID of this.routeCache.keys()) if (!activeLinkIDs.has(linkID)) this.routeCache.delete(linkID);
    if (showInteractionHighlights) this.drawHoveredLinkHighlight(ctx, time, hoverFocusLinkIDs);
    this.drawLinkGroupPortBadges(ctx, topology);
    this.drawCableLabels(ctx, topology, vlanMap, showAllLabels);
    if (showAllLabels) this.drawExportEndpointLabels(ctx, topology);
  }

  drawRearChannelSheaths(ctx, tracks, { hoverFocusLinkIDs, hasHoverFocus }) {
    const rendered = new Set();
    for (const { route } of tracks.values()) {
      const sheath = route.rearChannelSheath;
      if (!sheath || rendered.has(sheath.key)) continue;
      rendered.add(sheath.key);
      const focused = sheath.linkIds.some((linkID) => hoverFocusLinkIDs.has(linkID));
      const alphaFactor = !hasHoverFocus || focused ? 1 : .16;
      if (focused) {
        this.strokeCurve(ctx, sheath.route, "#ffd786", sheath.width + 14, .28, { glow: true, lineCap: "round" });
        this.strokeCurve(ctx, sheath.route, "#ffe7a8", sheath.width + 6, .52, { glow: true, lineCap: "round" });
      }
      this.strokeCurve(ctx, sheath.route, "#020607", sheath.width + 4, .82 * alphaFactor, { lineCap: "round" });
      this.strokeCurve(ctx, sheath.route, RearPanelLinkVisual.color, sheath.width + 1, .78 * alphaFactor, { lineCap: "round" });
      this.strokeCurve(ctx, sheath.route, "#152326", Math.max(2, sheath.width - 2), .94 * alphaFactor, { lineCap: "round" });
      this.strokeCurve(ctx, sheath.route, focused ? "#fff1c2" : "#e6bd72", focused ? 1.75 : 1.25,
        (focused ? .98 : .72) * alphaFactor, { dash: [9, 5], lineCap: "butt" });
    }
  }

  drawBridgeJumpers(ctx, time, profile = this.activeGraphicsProfile || QUALITY_FALLBACK) {
    for (const upperEntry of this.linkCurves) {
      if (upperEntry.rearMapping) continue;
      for (const bridge of upperEntry.curve.bridges || []) {
        const underEntry = this.linkCurves[bridge.underRouteIndex];
        if (!underEntry || underEntry === upperEntry) continue;
        const focused = upperEntry.selected || upperEntry.selectedPeer || upperEntry.traced || upperEntry.hoverFocused;
        const effectTime = graphicsEffectActive(profile, focused) ? time : 0;
        ctx.save();
        ctx.beginPath();
        ctx.arc(bridge.crossing.x, bridge.crossing.y, bridge.openingRadius || 5, 0, Math.PI * 2);
        ctx.clip();
        if (upperEntry.rearMapping) {
          this.strokeCurve(
            ctx,
            upperEntry.curve,
            "#020607",
            RearPanelLinkVisual.casingWidth,
            Math.min(upperEntry.cableAlpha, RearPanelLinkVisual.casingOpacity),
          );
          this.strokeCurve(ctx, upperEntry.curve, upperEntry.primaryColor, upperEntry.thickness, upperEntry.cableAlpha, { dash: RearPanelLinkVisual.dash, lineCap: "butt" });
        } else {
          const roleWidth = upperEntry.thickness + 1.25;
          this.strokeCurve(ctx, upperEntry.curve, "#020607", roleWidth + CABLE_OUTLINE_WIDTH * 2, upperEntry.cableAlpha);
          this.strokeCurve(
            ctx,
            upperEntry.curve,
            upperEntry.role.color,
            roleWidth,
            upperEntry.cableAlpha * .78,
            { dash: upperEntry.dash },
          );
          this.drawVLANColors(
            ctx,
            upperEntry.curve,
            upperEntry.vlanPalette,
            upperEntry.thickness,
            effectTime,
            upperEntry.cableAlpha,
            upperEntry.dash,
          );
        }
        ctx.restore();
      }
    }
  }

  drawHoveredLinkHighlight(ctx, time, focusedIDs = this.hoverFocusLinkIDs()) {
    if (!focusedIDs.size) return;
    if (this.hoveredDevice?.device.id) return;
    if (this.rearHoverIsolationActive()) return;
    for (const entry of this.linkCurves.filter((candidate) => focusedIDs.has(candidate.link.id) && !candidate.rearMapping)) {
      this.drawHoveredLinkHighlightEntry(ctx, time, entry);
    }
  }

  drawHoveredLinkHighlightEntry(ctx, time, entry) {
    const profile = this.activeGraphicsProfile || QUALITY_FALLBACK;
    const effectTime = graphicsEffectActive(profile, true) ? time : 0;
    const focusColor = entry.rearMapping ? entry.primaryColor : entry.role?.color || "#7affee";
    this.strokeCurve(ctx, entry.curve, focusColor, entry.thickness + 12, .12, { glow: true });
    this.strokeCurve(ctx, entry.curve, focusColor, entry.thickness + 6, .58, { glow: true });
    this.strokeCurve(ctx, entry.curve, "#020607", entry.thickness + 3, .96);
    if (entry.rearMapping) {
      this.strokeCurve(ctx, entry.curve, entry.primaryColor, entry.thickness + .75, 1, { dash: RearPanelLinkVisual.dash, lineCap: "butt" });
    } else {
      this.strokeCurve(ctx, entry.curve, entry.role?.color || entry.primaryColor, entry.thickness + 1.4, .88);
      this.drawVLANColors(ctx, entry.curve, entry.vlanPalette, entry.thickness + .25, effectTime, 1, entry.dash);
    }
    if (entry.warning) this.drawWarning(ctx, pointOnRoute(entry.curve, .57));
  }

  rearHoverIsolationActive(topology = this.state?.topology) {
    if (this.hoveredLink?.link && isRearPanelLink(this.hoveredLink.link)) return true;
    const hoveredDevice = this.hoveredPort?.device || this.hoveredDevice?.device;
    if (hoveredDevice?.category === "PatchPanel") return true;
    if (!hoveredDevice?.id || !topology) return false;
    return topology.devices?.some((device) => device.id === hoveredDevice.id && device.category === "PatchPanel") || false;
  }

  hoverFocusLinkIDs(topology = this.state?.topology) {
    if (this.hoveredLink?.link.id) {
      const hoveredLink = this.hoveredLink.link;
      const linkID = hoveredLink.id;
      const indexedMembers = this.groupLinkIDsByLink?.get(linkID);
      let focusedLinkIDs = indexedMembers;
      if (!focusedLinkIDs && !topology) focusedLinkIDs = new Set([linkID]);
      if (!focusedLinkIDs && hoveredLink.rearChannelId) {
        const channelMembers = new Set(topology.links
          .filter((link) => link.rearChannelId === hoveredLink.rearChannelId)
          .map((link) => link.id));
        if (channelMembers.size) focusedLinkIDs = channelMembers;
      }
      if (!focusedLinkIDs && topology) {
        const group = (topology.linkGroups || []).find((candidate) => candidate.linkIds?.includes(linkID));
        if (group) {
          const liveLinkIDs = new Set((topology.links || []).map((link) => link.id));
          const memberLinkIDs = new Set((group.linkIds || []).filter((memberID) => liveLinkIDs.has(memberID)));
          if (memberLinkIDs.size) focusedLinkIDs = memberLinkIDs;
        }
      }
      return this.expandPatchPanelHoverFocus(focusedLinkIDs || new Set([linkID]));
    }
    if (!topology) return new Set();
    if (this.hoveredPort?.port.id) {
      const indexed = this.linkIDsByPort?.get(this.hoveredPort.port.id);
      if (indexed) return indexed;
      const portID = this.hoveredPort.port.id;
      return new Set((topology.links || []).filter((link) => link.sourcePortId === portID || link.targetPortId === portID).map((link) => link.id));
    }
    if (this.hoveredDevice?.device.id) {
      const deviceID = this.hoveredDevice.device.id;
      const indexed = this.linkIDsByDevice?.get(deviceID);
      if (indexed) return this.expandPatchPanelHoverFocus(indexed);
      const portIDs = new Set(topology.devices.find((device) => device.id === deviceID)?.ports.map((port) => port.id) || []);
      const attachedLinkIDs = new Set((topology.links || []).filter((link) =>
        portIDs.has(link.sourcePortId) || portIDs.has(link.targetPortId)).map((link) => link.id));
      return this.expandPatchPanelHoverFocus(attachedLinkIDs);
    }
    return new Set();
  }

  expandPatchPanelHoverFocus(linkIDs) {
    const pathIndex = this.patchPanelPathLinkIDsByLink;
    if (!pathIndex?.size) return linkIDs;
    const pathSets = [...linkIDs]
      .map((linkID) => pathIndex.get(linkID))
      .filter((pathLinkIDs) => pathLinkIDs?.size > 1);
    if (!pathSets.length) return linkIDs;
    const expanded = new Set(linkIDs);
    for (const pathLinkIDs of pathSets) {
      for (const linkID of pathLinkIDs) expanded.add(linkID);
    }
    return expanded;
  }

  drawVLANColors(ctx, curve, palette, thickness, time, alpha, dash = []) {
    if (!palette.isRainbow) {
      this.strokeCurve(ctx, curve, palette.nativeColor, thickness, alpha, { dash });
      return;
    }
    this.strokeCurve(ctx, curve, palette.nativeColor, thickness + 1, alpha * .9);
    const rainbowWidth = Math.max(1.5, thickness - .35);
    palette.channels.forEach((channel, index) => {
      const pattern = vlanBandPattern(palette.channels.length, index, time);
      this.strokeCurve(ctx, curve, channel.color, rainbowWidth, alpha, {
        dash: pattern.dash,
        dashOffset: pattern.offset,
        lineCap: "butt",
      });
    });
  }

  strokeCurve(ctx, curve, color, width, alpha = 1, options = {}) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = options.lineCap || "round";
    if (options.glow && (this.activeGraphicsProfile || QUALITY_FALLBACK).glows) {
      ctx.shadowBlur = 8;
      ctx.shadowColor = color;
    }
    if (options.dash) ctx.setLineDash(options.dash);
    if (options.dashOffset !== undefined) ctx.lineDashOffset = options.dashOffset;
    const segments = routeSegments(curve);
    if (!segments.length) { ctx.restore(); return; }
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(segments[0].source.x, segments[0].source.y);
    for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex += 1) {
      const segment = segments[segmentIndex];
      const bridges = (curve.bridges || []).filter((bridge) => bridge.segmentIndex === segmentIndex)
        .sort((left, right) => segment.target.x >= segment.source.x
          ? left.crossing.x - right.crossing.x
          : right.crossing.x - left.crossing.x);
      if (!bridges.length || Math.abs(segment.source.y - segment.target.y) >= .001) {
        ctx.lineTo(segment.target.x, segment.target.y);
        continue;
      }
      const direction = segment.target.x >= segment.source.x ? 1 : -1;
      for (const bridge of bridges) {
        const radius = bridge.radius || 4;
        ctx.lineTo(bridge.crossing.x - direction * radius, bridge.crossing.y);
        ctx.arc(
          bridge.crossing.x,
          bridge.crossing.y,
          radius,
          direction > 0 ? Math.PI : 0,
          direction > 0 ? Math.PI * 2 : -Math.PI,
          direction < 0,
        );
      }
      ctx.lineTo(segment.target.x, segment.target.y);
    }
    ctx.stroke();
    ctx.restore();
  }

  drawExportEndpointLabels(ctx, topology) {
    const badges = layoutEndpointBadges(this.linkCurves.flatMap((entry) =>
      linkEndpointBadges(topology, entry.link, entry.curve)), { charWidth: 3.8, height: 10, padding: 5 });
    for (const badge of badges) {
      ctx.save();
      ctx.fillStyle = "rgba(5, 10, 12, .94)";
      ctx.strokeStyle = "rgba(225, 239, 239, .72)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(badge.x - badge.width / 2, badge.y - badge.height / 2, badge.width, badge.height, 2.5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#edf7f6";
      ctx.font = "700 6px Bahnschrift Condensed, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(badge.text, badge.x, badge.y + .25, badge.width - 6);
      ctx.restore();
    }
  }

  drawLinkGroupPortBadges(ctx, topology) {
    const badges = linkGroupPortBadges(topology);
    for (const box of this.portBoxes) {
      const badge = badges.get(box.port.id);
      if (!badge) continue;
      const size = Math.max(6, Math.min(9, Math.min(box.width, box.height) - 4));
      const x = box.centerX - size / 2;
      const y = box.centerY - size / 2;
      ctx.save();
      ctx.fillStyle = "rgba(5, 13, 15, .96)";
      ctx.strokeStyle = badge.color;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(x, y, size, size, 1.5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = badge.color;
      ctx.font = `700 ${Math.max(5, size - 3)}px Bahnschrift Condensed, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(badge.role, box.centerX, box.centerY + .4);
      ctx.restore();
    }
  }

  drawCableLabels(ctx, topology, vlanMap, showAllLabels = false) {
    const selectedLinkID = this.state.selection?.type === "link" ? this.state.selection.id : "";
    const fixedLinkID = this.hoveredLink ? "" : selectedLinkID;
    const visibility = cableLabelVisibility(topology, fixedLinkID, showAllLabels);
    if (!visibility.groupIDs.size && !visibility.linkIDs.size) return;
    const specs = [];
    for (const group of topology.linkGroups || []) {
      if (!visibility.groupIDs.has(group.id)) continue;
      const entries = this.linkCurves.filter((entry) => group.linkIds.includes(entry.link.id));
      if (!entries.length) continue;
      const memberPoints = entries.map((entry) => pointOnRoute(entry.curve, .5));
      const anchor = {
        x: memberPoints.reduce((sum, point) => sum + point.x, 0) / memberPoints.length,
        y: memberPoints.reduce((sum, point) => sum + point.y, 0) / memberPoints.length,
      };
      const summary = summarizeLinkGroup(topology, group);
      ctx.font = "700 10px Bahnschrift Condensed, sans-serif";
      const titleWidth = ctx.measureText(summary.title).width;
      ctx.font = "700 7px Bahnschrift Condensed, sans-serif";
      const detailWidth = ctx.measureText(summary.detail).width;
      specs.push({
        id: `group:${group.id}`, kind: "group", anchor, candidates: radialCandidates(anchor),
        width: Math.min(340, Math.max(116, Math.max(titleWidth, detailWidth) + 28)), height: 34,
        title: summary.title, detail: summary.detail, accent: groupAccent(group.mode),
      });
    }
    for (const entry of this.linkCurves) {
      if (!visibility.linkIDs.has(entry.link.id)) continue;
      const text = entry.rearMapping ? `REAR · ${entry.link.cableType}` :
        entry.link.vlanIds?.length > 1 ? `TRUNK · ${entry.link.vlanIds.join("/")}` : `VLAN ${entry.link.primaryVlan || 1}`;
      ctx.font = "700 9px Bahnschrift Condensed, sans-serif";
      specs.push({
        id: `link:${entry.link.id}`, kind: "link", anchor: pointOnRoute(entry.curve, .5),
        candidates: curveLabelCandidates(entry.curve), width: ctx.measureText(text).width + 14, height: 20,
        text, accent: entry.rearMapping ? "#f0b35a" : vlanMap.get(entry.link.primaryVlan)?.colorHex || "#60757a",
      });
    }
    const obstacles = this.deviceBoxes.map((box) => ({ x: box.x, y: box.y, width: box.width, height: box.height }));
    for (const label of placeCableLabels(specs, obstacles)) this.drawPlacedCableLabel(ctx, label);
  }

  drawPlacedCableLabel(ctx, label) {
    const distance = Math.hypot(label.x - label.anchor.x, label.y - label.anchor.y);
    if (distance > 12) {
      const edge = {
        x: Math.max(label.rect.x, Math.min(label.anchor.x, label.rect.x + label.rect.width)),
        y: Math.max(label.rect.y, Math.min(label.anchor.y, label.rect.y + label.rect.height)),
      };
      ctx.save();
      ctx.strokeStyle = label.accent; ctx.globalAlpha = .55; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(label.anchor.x, label.anchor.y); ctx.lineTo(edge.x, edge.y); ctx.stroke();
      ctx.restore();
    }
    ctx.save();
    ctx.fillStyle = "rgba(7, 13, 15, .96)"; ctx.strokeStyle = label.accent; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(label.rect.x, label.rect.y, label.rect.width, label.rect.height, 5); ctx.fill(); ctx.stroke();
    if (label.kind === "group") {
      ctx.fillStyle = label.accent; ctx.fillRect(label.rect.x, label.rect.y + 4, 3, label.rect.height - 8);
      ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.fillStyle = "#e4eeee"; ctx.font = "700 10px Bahnschrift Condensed, sans-serif";
      ctx.fillText(label.title, label.rect.x + 11, label.y - 6, label.rect.width - 18);
      ctx.fillStyle = "#83979a"; ctx.font = "700 7px Bahnschrift Condensed, sans-serif";
      ctx.fillText(label.detail, label.rect.x + 11, label.y + 7, label.rect.width - 18);
    } else {
      ctx.fillStyle = "#c9d6d7"; ctx.font = "700 9px Bahnschrift Condensed, sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(label.text, label.x, label.y + .5);
    }
    ctx.restore();
  }

  drawPulse(ctx, curve, time, color) {
    const point = pointOnRoute(curve, ((time / 2200) % 1));
    ctx.save();
    if ((this.activeGraphicsProfile || QUALITY_FALLBACK).glows) {
      ctx.shadowBlur = 9; ctx.shadowColor = color;
    }
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(point.x, point.y, 2.3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  drawWarning(ctx, point, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(point.x, point.y);
    ctx.fillStyle = "#f0b35a"; ctx.strokeStyle = "#20170b"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(10, 8); ctx.lineTo(-10, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#20170b"; ctx.font = "bold 12px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("!", 0, 3);
    ctx.restore();
  }

  drawDevice(ctx, device, time) {
    const box = this.deviceBoxByID?.get(device.id) || this.deviceBoxes.find((candidate) => candidate.device.id === device.id);
    if (!box) return;
    const selected = this.state.selection?.type === "device" && this.state.selection.id === device.id;
    const multiSelected = this.selectedDevices.has(device.id);
    const system = switchSystemForDevice(this.state.topology, device.id);
    const cluster = firewallClusterForDevice(this.state.topology, device.id);
    const selectedSystem = this.state.selection?.type === "device" ? switchSystemForDevice(this.state.topology, this.state.selection.id) : null;
    const selectedCluster = this.state.selection?.type === "device" ? firewallClusterForDevice(this.state.topology, this.state.selection.id) : null;
    const systemPeer = Boolean(system && selectedSystem?.id === system.id && !selected);
    const clusterPeer = Boolean(cluster && selectedCluster?.id === cluster.id && !selected);
    const logicalPeer = systemPeer || clusterPeer;
    const logicalPeerAccent = systemPeer ? switchSystemAccent(system.mode) : clusterPeer ? firewallClusterAccent(cluster, device.id) : "#52666b";
    const template = resolveFaceplateTemplate(device);
    const profile = this.activeGraphicsProfile || QUALITY_FALLBACK;
    ctx.save();
    if (profile.shadows) {
      ctx.shadowColor = "rgba(0,0,0,.55)"; ctx.shadowBlur = 16; ctx.shadowOffsetY = 7;
    }
    const gradient = ctx.createLinearGradient(box.x, box.y, box.x, box.y + box.height);
    gradient.addColorStop(0, lighten(template.surface, 16));
    gradient.addColorStop(.13, template.surface);
    gradient.addColorStop(.86, template.surfaceDark);
    gradient.addColorStop(1, darken(template.surfaceDark, 16));
    ctx.fillStyle = gradient;
    ctx.strokeStyle = selected || multiSelected ? "#66eddd" : logicalPeer ? logicalPeerAccent : "#52666b";
    ctx.lineWidth = selected || multiSelected ? 2.5 : logicalPeer ? 2 : 1;
    if (logicalPeer) ctx.setLineDash([7, 4]);
    ctx.beginPath(); ctx.roundRect(box.x, box.y, box.width, box.height, 8); ctx.fill(); ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    this.drawRackEars(ctx, box);
    this.drawDeviceIdentity(ctx, device, box, template);
    this.drawFaceplateDetails(ctx, device, box, template);
    for (const portBox of this.portBoxesByDevice?.get(device.id) || this.portBoxes.filter((candidate) => candidate.device.id === device.id)) {
      this.drawPort(ctx, portBox);
    }
    const portIDs = new Set((device.ports || []).map((port) => port.id));
    const photoCount = (this.state.topology?.photos || []).filter((photo) =>
      (photo.targetKind === "device" && photo.targetId === device.id)
      || (photo.targetKind === "port" && portIDs.has(photo.targetId))).length;
    if (photoCount) this.drawPhotoBadge(ctx, box, photoCount);
    if (system) this.drawSwitchSystemBadge(ctx, box, system, device.id);
    if (cluster) this.drawFirewallClusterBadge(ctx, box, cluster, device.id);
    ctx.restore();
  }

  drawPhotoBadge(ctx, box, count) {
    const x = box.x + box.width - 48;
    const y = box.y + 9;
    ctx.save();
    ctx.fillStyle = "rgba(5, 14, 16, .94)";
    ctx.strokeStyle = "#66eddd";
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.roundRect(x, y, 34, 19, 4); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(x + 5, y + 6, 12, 8, 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(x + 11, y + 10, 2.4, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#66eddd";
    ctx.beginPath(); ctx.roundRect(x + 8, y + 3, 6, 3, 1); ctx.fill();
    ctx.font = "700 8px Bahnschrift Condensed, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(count), x + 25, y + 10.5);
    ctx.restore();
  }

  drawSwitchSystemBadge(ctx, box, system, deviceID) {
    const memberIndex = system.deviceIds.indexOf(deviceID);
    const accent = switchSystemAccent(system.mode);
    const mode = system.mode === "VirtualChassis" ? "VC" : system.mode === "StackWise" ? "STACKWISE" : system.mode === "MCLAG" ? "MC-LAG" : system.mode;
    const text = `${mode} · M${memberIndex + 1}/${system.deviceIds.length}`;
    ctx.save();
    ctx.fillStyle = "rgba(5, 13, 15, .9)";
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(box.x + 31, box.y + 79, 114, 13, 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = accent;
    ctx.font = "700 7px Bahnschrift Condensed, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, box.x + 88, box.y + 85.5, 108);
    ctx.restore();
  }

  drawFirewallClusterBadge(ctx, box, cluster, deviceID) {
    const memberIndex = cluster.deviceIds.indexOf(deviceID);
    const role = firewallClusterRole(cluster, deviceID);
    const accent = firewallClusterAccent(cluster, deviceID);
    const mode = cluster.mode === "ActiveActive" ? "A/A" : "A/P";
    const roleLabel = role === "PASSIVE" ? `PASSIVE ${memberIndex + 1}/${cluster.deviceIds.length}` : `ACTIVE ${memberIndex + 1}/${cluster.deviceIds.length}`;
    ctx.save();
    ctx.fillStyle = "rgba(5, 13, 15, .9)";
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(box.x + 31, box.y + 79, 114, 13, 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = accent;
    ctx.font = "700 7px Bahnschrift Condensed, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${mode} · ${roleLabel}`, box.x + 88, box.y + 85.5, 108);
    ctx.restore();
  }

  drawRackEars(ctx, box) {
    ctx.fillStyle = "rgba(5, 9, 10, .62)";
    ctx.fillRect(box.x + 5, box.y + 8, 14, box.height - 16);
    ctx.fillRect(box.x + box.width - 19, box.y + 8, 14, box.height - 16);
    for (const x of [box.x + 12, box.x + box.width - 12]) {
      for (const y of [box.y + 20, box.y + box.height - 20]) {
        ctx.fillStyle = "#050808"; ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#607176"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.stroke();
      }
    }
  }


  drawFaceplateDetails(ctx, device, box, template) {
    const ports = this.portBoxesByDevice?.get(device.id) || this.portBoxes.filter((candidate) => candidate.device.id === device.id);
    const minPortX = ports.length ? Math.min(...ports.map((port) => port.x)) : box.x + 330;
    const maxPortX = ports.length ? Math.max(...ports.map((port) => port.x + port.width)) : box.x + 520;
    const top = box.y + 10;
    const bottom = box.y + box.height - 10;
    const statusArea = template.statusArea || { kind: template.control, x: .219, y: .5, width: 38, height: 40 };
    const statusX = box.x + statusArea.x * box.width;
    const statusCenterY = box.y + statusArea.y * box.height;
    const profile = this.activeGraphicsProfile || QUALITY_FALLBACK;
    ctx.save();

    if (profile.deviceDetail !== "minimal") {
      ctx.strokeStyle = "rgba(255,255,255,.08)";
      ctx.lineWidth = 1;
      const textureStep = profile.deviceDetail === "reduced" ? 14 : 7;
      for (let y = box.y + 4; y < box.y + box.height; y += textureStep) {
        ctx.beginPath(); ctx.moveTo(box.x + 21, y); ctx.lineTo(box.x + box.width - 21, y); ctx.stroke();
      }
    }

    if (template.modules) {
      const bayLeft = Math.max(box.x + 205, minPortX - 14);
      const bayRight = Math.min(box.x + box.width - 58, maxPortX + 14);
      ctx.fillStyle = "rgba(3,7,8,.2)"; ctx.strokeStyle = "rgba(224,236,234,.28)";
      ctx.beginPath(); ctx.roundRect(bayLeft, top + 4, Math.max(30, bayRight - bayLeft), bottom - top - 8, 3); ctx.fill(); ctx.stroke();
      for (let x = bayLeft + 7; x < bayRight; x += 56) {
        ctx.strokeStyle = "rgba(232,240,239,.13)";
        ctx.beginPath(); ctx.moveTo(x, top + 7); ctx.lineTo(x, bottom - 7); ctx.stroke();
      }
    }

    this.drawVentField(ctx, template, box.x + 151, box.y + box.height * .22, Math.max(24, minPortX - box.x - 169), box.height * .56);
    if (box.x + box.width - maxPortX > 76) {
      this.drawVentField(ctx, template, maxPortX + 16, box.y + box.height * .22, box.x + box.width - maxPortX - 69, box.height * .56);
    }

    if (statusArea.compact) {
      for (let index = 0; index < 4; index += 1) {
        const color = index === 0 ? template.accent : index === 1 ? "#55c98e" : "#536265";
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(statusX + index * 6, box.y + 7, 1.6, 0, Math.PI * 2); ctx.fill();
      }
    } else if (template.control === "lcm") {
      const screenX = statusX; const screenY = statusCenterY - statusArea.height / 2;
      ctx.fillStyle = "#0b1113"; ctx.strokeStyle = "#889497"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(screenX, screenY, statusArea.width, statusArea.height, 3); ctx.fill(); ctx.stroke();
      ctx.fillStyle = template.accent; ctx.globalAlpha = .82;
      ctx.fillRect(screenX + 7, screenY + 8, 25, 2); ctx.fillRect(screenX + 7, screenY + 14, 17, 2);
      ctx.globalAlpha = 1;
    } else if (template.control === "server") {
      const moduleY = statusCenterY - statusArea.height / 2;
      const moduleWidth = (statusArea.width - 5) / 2;
      for (let column = 0; column < 2; column += 1) {
        const x = statusX + column * (moduleWidth + 5);
        ctx.fillStyle = "rgba(5,9,10,.7)"; ctx.strokeStyle = column === 0 ? template.accent : "#718186";
        ctx.beginPath(); ctx.roundRect(x, moduleY, moduleWidth, statusArea.height, 2); ctx.fill(); ctx.stroke();
        const fanX = x + moduleWidth / 2; const fanY = moduleY + statusArea.height * .43;
        ctx.strokeStyle = "#536467"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(fanX, fanY, Math.min(15, moduleWidth * .27), 0, Math.PI * 2); ctx.stroke();
        for (let blade = 0; blade < 6; blade += 1) {
          const angle = blade * Math.PI / 3;
          ctx.beginPath(); ctx.moveTo(fanX, fanY);
          ctx.lineTo(fanX + Math.cos(angle) * 12, fanY + Math.sin(angle) * 12); ctx.stroke();
        }
        ctx.fillStyle = column === 0 ? template.accent : "#7a898b";
        ctx.font = "700 6px Bahnschrift Condensed, sans-serif"; ctx.textAlign = "center";
        ctx.fillText(`REAR ${column + 1}`, fanX, moduleY + statusArea.height - 5);
      }
    } else {
      const panelX = statusX; const panelY = statusCenterY - statusArea.height / 2;
      ctx.fillStyle = "rgba(4,9,10,.34)"; ctx.strokeStyle = "rgba(215,228,227,.22)";
      ctx.beginPath(); ctx.roundRect(panelX, panelY, statusArea.width, statusArea.height, 3); ctx.fill(); ctx.stroke();
      for (let index = 0; index < 4; index += 1) {
        const color = index === 0 ? template.accent : index === 1 ? "#55c98e" : "#536265";
        ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = profile.glows && index < 2 ? 4 : 0;
        ctx.beginPath(); ctx.arc(panelX + 10 + (index % 2) * 13, panelY + 10 + Math.floor(index / 2) * 14, 2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.shadowBlur = 0;
    }

    const groups = new Map();
    for (const port of ports) {
      const key = `${port.port.group || "PORTS"}:${connectorKind(port.port.type)}`;
      const group = groups.get(key) || [];
      group.push(port); groups.set(key, group);
    }
    for (const [name, group] of groups) {
      if (group.length < 2 && template.control !== "server") continue;
      let left = Math.min(...group.map((port) => port.x)) - 5;
      let right = Math.max(...group.map((port) => port.x + port.width)) + 5;
      let groupTop = Math.min(...group.map((port) => port.y)) - 7;
      let groupBottom = Math.max(...group.map((port) => port.y + port.height)) + 7;
      const serverSlot = template.control === "server" ? Number(name.match(/^S(\d+)/)?.[1] || 0) : 0;
      if (serverSlot) {
        const units = Math.max(1, Number(device.faceplate.unitsU) || 1);
        const slotIndex = serverSlot - 1;
        const row = Math.floor(slotIndex / 4);
        const column = slotIndex % 4;
        left = box.x + box.width * (.43 + column * .135) - 4;
        right = left + box.width * .12 + 8;
        groupTop = box.y + box.height * (.13 + row * (.74 / units)) - 4;
        groupBottom = groupTop + box.height * (.74 / units) + 8;
      }
      ctx.fillStyle = "rgba(2,6,7,.1)"; ctx.strokeStyle = "rgba(3,8,9,.38)";
      ctx.beginPath(); ctx.roundRect(left, groupTop, right - left, groupBottom - groupTop, 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = template.ink; ctx.globalAlpha = .48; ctx.font = "700 6px Bahnschrift Condensed, sans-serif"; ctx.textAlign = "left";
      ctx.fillText(name.split(":")[0].toUpperCase(), left + 3, Math.max(box.y + 8, groupTop - 2)); ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  drawVentField(ctx, template, x, y, width, height) {
    const detail = (this.activeGraphicsProfile || QUALITY_FALLBACK).deviceDetail;
    if (width < 12 || template.vent === "minimal" || detail === "minimal") return;
    const density = detail === "reduced" ? 2 : 1;
    ctx.save(); ctx.fillStyle = "rgba(3,7,8,.48)"; ctx.strokeStyle = "rgba(235,242,241,.1)";
    const clippedWidth = Math.max(0, width);
    if (template.vent === "slots" || template.vent === "louvers") {
      for (let row = 0; row < Math.max(1, Math.floor(height / (10 * density))); row += 1) {
        for (let column = 0; column < Math.max(1, Math.floor(clippedWidth / (13 * density))); column += 1) {
          const slotX = x + column * 13 * density; const slotY = y + row * 10 * density;
          ctx.beginPath(); ctx.roundRect(slotX, slotY, template.vent === "louvers" ? 10 : 8, 3, 1.5); ctx.fill();
        }
      }
    } else {
      const step = (template.vent === "mesh" ? 6 : 8) * density;
      for (let row = 0; row < Math.max(1, Math.floor(height / step)); row += 1) {
        for (let column = 0; column < Math.max(1, Math.floor(clippedWidth / step)); column += 1) {
          ctx.beginPath(); ctx.arc(x + column * step, y + row * step, template.vent === "mesh" ? 1.4 : 1.1, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  drawDeviceIdentity(ctx, device, box, template) {
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
	if (template.id === "fortinet-dense-core-switch") {
		ctx.fillStyle = template.ink; ctx.font = "700 6px Bahnschrift Condensed, sans-serif";
		ctx.fillText(device.name, box.x + 270, box.y + 9, 120);
		return;
	}
	if (template.id === "fortinet-core-switch") {
		ctx.fillStyle = template.accent; ctx.font = "700 6px Bahnschrift Condensed, sans-serif";
		ctx.fillText((device.faceplate.vendor || "FORTINET").toUpperCase(), box.x + 27, box.y + 9, 90);
		ctx.fillStyle = template.ink; ctx.font = "700 8px Bahnschrift Condensed, sans-serif";
		ctx.fillText(device.name, box.x + 27, box.y + 18, 118);
		return;
	}
	if (template.id === "fortinet-campus-switch") {
		ctx.fillStyle = template.accent; ctx.font = "700 6px Bahnschrift Condensed, sans-serif";
		ctx.fillText((device.faceplate.vendor || "FORTINET").toUpperCase(), box.x + 27, box.y + 9, 70);
		ctx.fillStyle = template.ink; ctx.font = "700 8px Bahnschrift Condensed, sans-serif";
		const dataPorts = (this.portBoxesByDevice.get(device.id) || []).filter((port) =>
			!/MGMT|CONSOLE|OOB|BMC|ILO|IDRAC/i.test(`${port.port.group || ""} ${port.port.label || ""}`));
		const firstDataX = dataPorts.length ? Math.min(...dataPorts.map((port) => port.x)) : box.x + 160;
		ctx.fillText(device.name, box.x + 27, box.y + 18, Math.max(50, firstDataX - box.x - 35));
		return;
	}
	if (template.id === "fortinet-compact-switch") {
		ctx.fillStyle = template.accent; ctx.font = "700 6px Bahnschrift Condensed, sans-serif";
		ctx.fillText((device.faceplate.vendor || "FORTINET").toUpperCase(), box.x + 27, box.y + 9, 70);
		ctx.fillStyle = template.ink; ctx.font = "700 8px Bahnschrift Condensed, sans-serif";
		ctx.fillText(device.name, box.x + 555, box.y + 18, 105);
		return;
	}
	if (template.id === "fortinet-rugged-switch") {
		ctx.fillStyle = template.ink; ctx.font = "700 7px Bahnschrift Condensed, sans-serif";
		ctx.fillText(device.name, box.x + 27, box.y + 13, 155);
		return;
	}
	if (/^fortinet-(?:desktop|rack|datacenter)$/.test(template.id)) {
		ctx.fillStyle = template.accent; ctx.font = "700 7px Bahnschrift Condensed, sans-serif";
		ctx.fillText((device.faceplate.vendor || "FORTINET").toUpperCase(), box.x + 28, box.y + 16, 95);
		ctx.fillStyle = template.ink; ctx.font = "700 11px Bahnschrift Condensed, sans-serif";
		ctx.fillText(device.name, box.x + 28, box.y + 31, 94);
		ctx.globalAlpha = .68; ctx.font = "8px Bahnschrift Condensed, sans-serif";
		ctx.fillText(device.model || device.category, box.x + 28, box.y + 43, 94);
		ctx.globalAlpha = 1;
		return;
	}
	const vendor = device.faceplate.vendor || "WIREDRAFT";
	ctx.fillStyle = template.accent;
	ctx.font = "700 8px Bahnschrift Condensed, sans-serif";
	ctx.fillText(vendor.toUpperCase(), box.x + 31, box.y + 18, 125);
	ctx.fillStyle = template.ink; ctx.font = "700 14px Bahnschrift Condensed, sans-serif";
	ctx.fillText(device.name, box.x + 31, box.y + 34, 125);
    ctx.fillStyle = template.ink; ctx.globalAlpha = .68; ctx.font = "9px Bahnschrift Condensed, sans-serif";
	ctx.fillText(device.model || device.category, box.x + 31, box.y + 47, 125);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(4, 8, 9, .45)";
	ctx.fillRect(box.x + 31, box.y + 57, 114, 18);
    ctx.fillStyle = "#d8e3e2"; ctx.globalAlpha = .8; ctx.font = "700 8px Bahnschrift Condensed, sans-serif";
	ctx.fillText(`${device.category.toUpperCase()} · ${device.faceplate.unitsU}U`, box.x + 38, box.y + 69);
    ctx.globalAlpha = 1;
  }

  drawPort(ctx, box) {
    const { port } = box;
    const kind = connectorKind(port.type);
    const hovered = this.hoveredPort?.port.id === port.id;
    const selected = this.state.selection?.type === "port" && this.state.selection.id === port.id;
    const draftTarget = this.draft?.target?.port.id === port.id;
    const invalid = this.draft && !this.isEligibleTarget(this.draft.source, box);
    const profile = this.activeGraphicsProfile || QUALITY_FALLBACK;
    ctx.save();
    if (profile.glows && (hovered || selected || draftTarget)) {
      ctx.shadowColor = draftTarget ? "#42d9c8" : "#7affee"; ctx.shadowBlur = 11;
    }
    const optical = ["sfp", "qsfp", "cfp", "osfp"].includes(kind);
    const passiveFiber = ["lc", "sc", "mpo"].includes(kind);
    const management = /MGMT|OOB|ILO|IDRAC|BMC|NMC|NETWORK|UNITY/i.test(port.group || port.label || "");
    const connectorEdge = management ? "#55b9d8" : ["console", "usb-mini", "usb-micro", "usb-c"].includes(kind) ? "#5a9ec8" :
      optical ? "#879397" : passiveFiber ? "#52bac8" : kind === "stack" ? "#d39a48" : "#60757a";
    ctx.fillStyle = invalid ? "#2d1717" : optical ? "#182124" : passiveFiber ? "#10272b" : "#080d0f";
    ctx.strokeStyle = invalid ? "#743b38" : hovered || selected || draftTarget ? "#7affee" : connectorEdge;
    ctx.lineWidth = hovered || selected ? 1.8 : 1;
    ctx.beginPath(); ctx.roundRect(box.x, box.y, box.width, box.height, 2); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    if (optical) {
      ctx.fillStyle = "#586568"; ctx.fillRect(box.x + 3, box.y + 3, box.width - 6, 2);
      ctx.fillStyle = "#0a1012"; ctx.fillRect(box.x + 4, box.y + 7, box.width - 8, Math.max(2, box.height - 10));
      if (["qsfp", "cfp", "osfp"].includes(kind)) {
        ctx.strokeStyle = "#899699"; ctx.lineWidth = .7;
        ctx.beginPath(); ctx.moveTo(box.centerX, box.y + 2); ctx.lineTo(box.centerX, box.y + box.height - 2); ctx.stroke();
      }
      ctx.strokeStyle = "#a8b2b4"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(box.x + 3, box.y + box.height - 2); ctx.quadraticCurveTo(box.centerX, box.y + box.height + 3, box.x + box.width - 3, box.y + box.height - 2); ctx.stroke();
    } else if (kind === "lc") {
      ctx.strokeStyle = "#6cd2de"; ctx.lineWidth = 1;
      for (const dx of [-3.2, 3.2]) { ctx.beginPath(); ctx.arc(box.centerX + dx, box.centerY, 2.4, 0, Math.PI * 2); ctx.stroke(); }
    } else if (kind === "sc") {
      ctx.strokeStyle = "#6cd2de"; ctx.strokeRect(box.centerX - 4, box.centerY - 4, 8, 8);
    } else if (kind === "mpo") {
      ctx.fillStyle = "#6cd2de";
      for (let pin = 0; pin < 6; pin += 1) { ctx.beginPath(); ctx.arc(box.x + 4 + pin * 2.4, box.centerY, .7, 0, Math.PI * 2); ctx.fill(); }
    } else if (kind === "usb-c" || kind === "usb-mini" || kind === "usb-micro") {
      ctx.strokeStyle = "#7eb9d8"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(box.x + 2, box.y + 2, box.width - 4, box.height - 4, kind === "usb-c" ? 3 : kind === "usb-mini" ? 2 : 1); ctx.stroke();
    } else if (kind === "stack") {
      ctx.strokeStyle = "#d39a48"; ctx.lineWidth = 1;
      ctx.strokeRect(box.x + 3, box.y + 3, box.width - 6, box.height - 6);
      ctx.beginPath(); ctx.moveTo(box.x + 5, box.centerY); ctx.lineTo(box.x + box.width - 5, box.centerY); ctx.stroke();
    } else if (kind === "coax") {
      ctx.strokeStyle = "#c8d0cf"; ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.arc(box.centerX, box.centerY, Math.min(box.width, box.height) * .32, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#273032";
      ctx.beginPath(); ctx.arc(box.centerX, box.centerY, 1.5, 0, Math.PI * 2); ctx.fill();
    } else if (kind === "power") {
      ctx.strokeStyle = "#a5b0b2"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(box.centerX, box.centerY, Math.min(box.width, box.height) * .28, 0, Math.PI * 2); ctx.stroke();
    } else {
      ctx.strokeStyle = "#6b512b"; ctx.lineWidth = .7;
      const pins = kind === "dsl" ? 4 : 6;
      for (let pin = 0; pin < pins; pin += 1) {
        const x = box.x + 3 + pin * ((box.width - 6) / Math.max(1, pins - 1));
        ctx.beginPath(); ctx.moveTo(x, box.y + 3); ctx.lineTo(x, box.y + Math.min(7, box.height - 3)); ctx.stroke();
      }
      ctx.fillStyle = "rgba(213,225,224,.16)";
      ctx.fillRect(box.x + 3, box.y + box.height - 4, box.width - 6, 2);
    }
    if (port.isPoe) {
      ctx.fillStyle = "#f0b35a"; ctx.font = "bold 5px Bahnschrift Condensed, sans-serif"; ctx.textAlign = "left";
      ctx.fillText("P", box.x + 1, box.y - 2);
    }
    const active = port.status === "up";
    ctx.fillStyle = portLinkLEDColor(port.status);
    if (active && profile.glows) { ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 5; }
    ctx.beginPath(); ctx.arc(box.x + box.width - 2, box.y - 3, 1.8, 0, Math.PI * 2); ctx.fill();
    const stpRole = this.stpPortRole(port.id);
    if (stpRole) {
      const roleColor = stpRole === "Blocked" ? "#f0b35a" : stpRole === "Root" ? "#42d9c8" : "#79c99b";
      ctx.shadowBlur = 0;
      ctx.globalAlpha = stpRole === "Designated" && !hovered && !selected ? .68 : 1;
      ctx.fillStyle = "#071012";
      ctx.strokeStyle = roleColor;
      ctx.lineWidth = .8;
      ctx.beginPath(); ctx.arc(box.x + 2, box.y + box.height - 2, 3.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = roleColor; ctx.font = "700 4.5px Bahnschrift Condensed, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(stpRole[0], box.x + 2, box.y + box.height - 1.8);
    }
    ctx.restore();
  }

  stpPortStates(portID) {
    return this.stpPortStateCache.get(portID) || [];
  }

  rebuildSTPPortStateCache() {
    const cache = new Map();
    for (const instance of this.state.analysis?.stp || []) {
      for (const port of instance.ports || []) {
        const states = cache.get(port.portId) || [];
        states.push({ ...port, vlanId: instance.vlanId });
        cache.set(port.portId, states);
      }
    }
    this.stpPortStateCache = cache;
  }

  stpPortRole(portID) {
    const roles = this.stpPortStates(portID).map((port) => port.role);
    if (roles.includes("Blocked")) return "Blocked";
    if (roles.includes("Root")) return "Root";
    if (roles.includes("Designated")) return "Designated";
    return "";
  }

  drawPortDescriptions(ctx) {
    for (const box of this.portBoxes) {
      const deviceBox = this.deviceBoxByID?.get(box.device.id) || this.deviceBoxes.find((candidate) => candidate.device.id === box.device.id);
      if (!deviceBox) continue;
      const template = resolveFaceplateTemplate(box.device);
      const placement = portDescriptionPlacement(box, deviceBox);
      const hovered = this.hoveredPort?.port.id === box.port.id;
      const selected = this.state.selection?.type === "port" && this.state.selection.id === box.port.id;
      ctx.save();
      ctx.font = `700 ${placement.fontSize}px Bahnschrift Condensed, sans-serif`;
      const textWidth = Math.min(placement.maxWidth, ctx.measureText(box.port.label).width);
      const width = Math.max(12, textWidth + 6); const height = 11;
      const x = placement.x - width / 2; const y = placement.y - height / 2;
      ctx.globalAlpha = .94; ctx.fillStyle = template.surface; ctx.strokeStyle = hovered || selected ? "#42d9c8" : template.ink;
      ctx.lineWidth = hovered || selected ? 1.2 : .55;
      ctx.beginPath(); ctx.roundRect(x, y, width, height, 2); ctx.fill();
      ctx.globalAlpha = hovered || selected ? .9 : .35; ctx.stroke();
      ctx.globalAlpha = 1; ctx.fillStyle = template.ink; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(box.port.label, placement.x, placement.y + .25, placement.maxWidth);
      ctx.restore();
    }
  }

  drawDraft(ctx) {
    if (!this.draft) return;
    const source = { x: this.draft.source.centerX, y: this.draft.source.centerY };
    const target = this.draft.target ? { x: this.draft.target.centerX, y: this.draft.target.centerY } : this.pointerWorld;
    const curve = cableBezier(source, target);
    ctx.save(); ctx.setLineDash([8, 6]);
    this.strokeCurve(ctx, curve, this.draft.target ? "#42d9c8" : "#8fa4a7", 2.5, .9);
    ctx.restore();
  }

  drawSelectionBox(ctx) {
    if (!this.selectionBox) return;
    const x = Math.min(this.selectionBox.start.x, this.selectionBox.end.x);
    const y = Math.min(this.selectionBox.start.y, this.selectionBox.end.y);
    const width = Math.abs(this.selectionBox.end.x - this.selectionBox.start.x);
    const height = Math.abs(this.selectionBox.end.y - this.selectionBox.start.y);
    ctx.fillStyle = "rgba(66, 217, 200, .08)"; ctx.strokeStyle = "rgba(66, 217, 200, .72)"; ctx.lineWidth = 1 / this.camera.zoom; ctx.setLineDash([6 / this.camera.zoom, 4 / this.camera.zoom]);
    ctx.fillRect(x, y, width, height); ctx.strokeRect(x, y, width, height); ctx.setLineDash([]);
  }

  drawTooltip(ctx) {
    if (this.drag || this.rackDrag || this.pan || this.draft || this.selectionBox || this.linkDrag?.active) return;
    const topology = this.state.topology;
    let lines = [];
    let accent = "#42d9c8";
    let highlightLine = -1;
    let commentStart = -1;
    const appendComments = (kind, targetID) => {
      const commentLines = commentPreviewLines(topology, kind, targetID);
      if (!commentLines.length) return;
      commentStart = lines.length;
      lines.push(...commentLines);
    };
    if (this.hoveredPort) {
      const box = this.hoveredPort;
      const port = box.port;
      const attachedLinks = this.linksByPort?.get(port.id) || topology.links.filter((link) =>
        link.sourcePortId === port.id || link.targetPortId === port.id);
      const frontConnection = attachedLinks.find((link) =>
        (link.sourcePortId === port.id && (link.sourceSide || "front") === "front") ||
        (link.targetPortId === port.id && (link.targetSide || "front") === "front"));
      const rearConnection = attachedLinks.find((link) =>
        (link.sourcePortId === port.id && link.sourceSide === "rear") ||
        (link.targetPortId === port.id && link.targetSide === "rear"));
      let endpoint = "FRONT · UNPATCHED";
      if (frontConnection) {
        endpoint = `FRONT · ${linkEndpointTooltip(topology, frontConnection)}`;
      }
      let rearEndpoint = "";
      if (box.device.category === "PatchPanel") {
        rearEndpoint = "REAR · UNMAPPED";
        if (rearConnection) {
          rearEndpoint = `REAR · ${linkEndpointTooltip(topology, rearConnection)}`;
        }
      }
      const stpStates = this.stpPortStates(port.id);
      const stpSummary = stpStates.length ? stpStates.slice(0, 4).map((state) => `VLAN ${state.vlanId} ${state.role.toUpperCase()}`).join(" · ") + (stpStates.length > 4 ? ` · +${stpStates.length - 4}` : "") : "STP NOT PARTICIPATING";
      lines = [
        `${box.device.name} · PORT ${port.label}`,
        `${port.type}  /  ${port.speedMbps} Mbps`,
        `${port.mode.toUpperCase()} · NATIVE ${port.nativeVlan || "—"}`,
        `TAGGED ${port.allowedVlans?.join(", ") || "NONE"}`,
        stpSummary,
        endpoint,
        ...(rearEndpoint ? [rearEndpoint] : []),
      ];
      highlightLine = lines.length - 1;
      appendComments("port", port.id);
    } else if (this.hoveredLink) {
      const { link, group, primaryColor, role } = this.hoveredLink;
      accent = role?.color || (group ? groupAccent(group.mode) : primaryColor);
      const endpoints = linkEndpointTooltip(topology, link);
      if (group) {
        const summary = summarizeLinkGroup(topology, group);
        lines = [summary.title, endpoints, `${role?.label || group.mode.toUpperCase()} · ${summary.detail}`];
      } else {
        if (isRearPanelLink(link)) {
          lines = [
            `REAR PANEL MAP · ${link.cableType}`,
            endpoints,
            `${link.rearChannelName || "INDEPENDENT RUN"} · ${link.rearChannelType === "tube" ? "TUBE / BÜNDELADER" : link.rearChannelType === "discrete" ? "DISCRETE BUNDLE" : "NO SHARED CHANNEL"}`,
            "FRONT JACKS REMAIN INDEPENDENT",
          ];
          accent = "#f0b35a";
        } else {
          const taggedVLANs = (link.vlanIds || []).filter((vlanID) => vlanID !== link.primaryVlan);
          const vlan = taggedVLANs.length
            ? `TRUNK · NATIVE ${link.primaryVlan || "—"} · TAGGED ${taggedVLANs.join("/")}`
            : `VLAN ${link.primaryVlan || 1}`;
          lines = [
            `${role?.label || "STANDARD ACCESS"} · ${vlan} · ${link.cableType}`,
            endpoints,
          ];
        }
      }
      appendComments("link", link.id);
    } else if (this.hoveredDevice) {
      const device = this.hoveredDevice.device;
      const links = this.linksByDevice?.get(device.id) || (() => {
        const portIDs = new Set(device.ports.map((port) => port.id));
        return (topology.links || []).filter((link) => portIDs.has(link.sourcePortId) || portIDs.has(link.targetPortId));
      })();
      lines = [
        `${rackLabel(topology, device)} · ${device.name}`,
        `${links.length} CONNECTED PHYSICAL PATH${links.length === 1 ? "" : "S"}`,
        ...links.slice(0, 4).map((link) => linkEndpointTooltip(topology, link)),
        ...(links.length > 4 ? [`+${links.length - 4} MORE PATHS`] : []),
      ];
      appendComments("device", device.id);
    }
    if (!lines.length) return;
    this.drawPointerSpeechBubble(ctx, lines, accent, { highlightLine, commentStart });
  }

  drawPointerSpeechBubble(ctx, lines, accent, { highlightLine = -1, commentStart = -1 } = {}) {
    ctx.save();
    ctx.font = "10px Bahnschrift Condensed, sans-serif";
    const width = Math.min(Math.max(132, this.width - 20), 520, Math.max(132, Math.max(...lines.map((line) => ctx.measureText(line).width)) + 24));
    const height = 14 + lines.length * 13;
    const bubble = pointerBubblePlacement(this.pointerScreen, { width, height }, { width: this.width, height: this.height });
    ctx.fillStyle = "rgba(7, 13, 15, .97)";
    ctx.strokeStyle = accent || "#476168";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bubble.tail.point.x, bubble.tail.point.y);
    ctx.lineTo(bubble.tail.first.x, bubble.tail.first.y);
    ctx.lineTo(bubble.tail.second.x, bubble.tail.second.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(bubble.x, bubble.y, bubble.width, bubble.height, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = accent || "#42d9c8";
    ctx.fillRect(bubble.x, bubble.y + 5, 3, bubble.height - 10);
    lines.forEach((line, index) => {
      const isCommentHeading = index === commentStart;
      const isCommentBody = commentStart >= 0 && index > commentStart;
      ctx.fillStyle = index === 0 ? "#e9ffff"
        : index === highlightLine || isCommentHeading ? "#f0b35a"
          : isCommentBody ? "#d8c6aa" : "#aebebf";
      ctx.font = index === 0 || isCommentHeading ? "700 10px Bahnschrift Condensed, sans-serif" : "9px Bahnschrift Condensed, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(line, bubble.x + 12, bubble.y + 15 + index * 13, bubble.width - 20);
    });
    ctx.restore();
  }

  pointerDown(event) {
    this.invalidate();
    this.canvas.setPointerCapture(event.pointerId);
    const screen = this.eventPoint(event);
    const world = this.screenToWorld(screen);
    if (event.button === 1 || (event.button === 0 && this.isSpaceDown)) {
      event.preventDefault();
      this.pan = { screen, camera: { ...this.camera } };
      this.canvas.style.cursor = "grabbing";
      return;
    }
    if (event.button !== 0) return;
    const rackFaceControl = this.hitRackFaceControl(world);
    if (rackFaceControl) {
      if (rackFaceControl.action === "dual") {
        this.state.setRackDualFace(rackFaceControl.rack.id, !this.state.isRackDualFace(rackFaceControl.rack.id));
      } else {
        this.state.setRackFace(rackFaceControl.rack.id, rackFaceControl.face);
      }
      return;
    }
    if (this.activeTool && this.activeTool !== "select") {
      const type = this.activeTool.replace("annotation-", "");
      this.annotationDraft = { type, start: world, end: world };
      if (type === "text") this.callbacks.onAnnotationTextRequest?.(world);
      return;
    }
    const annotation = this.hitAnnotation(world);
    if (annotation) {
      this.state.select("annotation", annotation.id);
      return;
    }
    const port = this.hitPort(world);
    if (port) {
      this.state.select("port", port.port.id);
	  const isOccupied = isPortSideOccupied(this.state.topology, port.port.id, LinkEndpointSide.FRONT);
	  if (isOccupied) return;
      this.mode = CableMode.DRAFTING_CABLE;
      this.draft = { source: port, target: null };
      return;
    }
    const link = this.hitLink(world);
    if (link) {
      this.mode = CableMode.SELECTED_LINK;
      this.state.select("link", link.link.id);
      this.state.setTrace?.([link.link.id]);
      if (!isRearPanelLink(link.link)) this.linkDrag = { sourceLinkID: link.link.id, start: world, targetLinkID: null, active: false };
      return;
    }
    const device = this.hitDevice(world);
    if (device) {
      if (!event.shiftKey || !this.selectedDevices.has(device.device.id)) {
        if (!event.shiftKey) this.selectedDevices.clear();
        this.selectedDevices.add(device.device.id);
      }
      this.state.select("device", device.device.id);
      this.drag = {
        start: world,
        startScreen: screen,
        active: false,
        originals: new Map(),
        invalidIDs: new Set(),
        snapshot: structuredClone(this.state.topology),
      };
      for (const selectedID of this.selectedDevices) {
        const selected = this.state.topology.devices.find((item) => item.id === selectedID);
        const selectedBox = this.deviceBoxes.find((item) => item.device.id === selectedID);
        if (selected && selectedBox) {
          this.drag.originals.set(selectedID, {
            x: selectedBox.x,
            y: selectedBox.y,
            device: structuredClone(selected),
          });
        }
      }
      return;
    }
    const rack = this.hitRack(world);
    if (rack) {
      this.state.select("rack", rack.rack.id);
      if (world.y <= rack.y + RACK_HEADER_HEIGHT) {
        this.rackDrag = {
          start: world,
          startScreen: screen,
          active: false,
          original: { x: rack.rack.positionX, y: rack.rack.positionY },
          snapshot: structuredClone(this.state.topology),
        };
        this.canvas.style.cursor = "grabbing";
      }
      return;
    }
    this.state.select(null, null);
    this.selectedDevices.clear();
    if (emptyCanvasAction(event.shiftKey) === EmptyCanvasAction.SELECT) {
      this.selectionBox = { start: world, end: world };
    } else {
      event.preventDefault();
      this.pan = { screen, camera: { ...this.camera } };
      this.canvas.style.cursor = "grabbing";
    }
  }

  pointerMove(event) {
    this.invalidate();
    const screen = this.eventPoint(event);
    const world = this.screenToWorld(screen);
    this.pointerScreen = screen;
    this.pointerWorld = world;
    this.callbacks.onPointer?.(world, this.camera.zoom);
    this.hoveredLink = null;
    this.hoveredDevice = null;
    if (this.pan) {
      this.camera.x = this.pan.camera.x + screen.x - this.pan.screen.x;
      this.camera.y = this.pan.camera.y + screen.y - this.pan.screen.y;
      this.callbacks.onViewChange?.(this.viewportWorldRect());
      return;
    }
    if (this.annotationDraft) {
      this.annotationDraft.end = world;
      return;
    }
    if (this.rackDrag) {
      if (!this.rackDrag.active) {
        if (screenDistance(screen, this.rackDrag.startScreen) < DRAG_ACTIVATION_DISTANCE) return;
        this.rackDrag.active = true;
      }
      const rack = this.state.topology.racks.find((item) => item.id === this.state.selection?.id);
      if (!rack) return;
      const dx = world.x - this.rackDrag.start.x;
      const dy = world.y - this.rackDrag.start.y;
      rack.positionX = Math.max(0, Math.round((this.rackDrag.original.x + dx) / GRID) * GRID);
      rack.positionY = Math.max(0, Math.round((this.rackDrag.original.y + dy) / GRID) * GRID);
      this.state.emit("topology");
      return;
    }
    if (this.drag) {
      if (!this.drag.active) {
        if (screenDistance(screen, this.drag.startScreen) < DRAG_ACTIVATION_DISTANCE) return;
        this.drag.active = true;
        this.canvas.style.cursor = "grabbing";
      }
      const dx = world.x - this.drag.start.x;
      const dy = world.y - this.drag.start.y;
      this.drag.invalidIDs.clear();
      this.rackDropPreview = null;
      for (const [id, original] of this.drag.originals) {
        const device = this.state.topology.devices.find((item) => item.id === id);
        if (!device) continue;
        const proposed = {
          x: Math.max(0, Math.round((original.x + dx) / GRID) * GRID),
          y: Math.max(0, Math.round((original.y + dy) / GRID) * GRID),
        };
        device.rackId = "";
        device.rackUnit = 0;
        device.rackFace = "";
        device.positionX = proposed.x;
        device.positionY = proposed.y;
        const landing = findRackFaceLanding(this.state.topology, device, proposed, this.rackFaceBoxes);
        if (!landing) continue;
        this.rackDropPreview = { ...landing, device };
        if (!landing.isValid) {
          this.drag.invalidIDs.add(id);
          continue;
        }
        device.rackId = landing.rack.id;
        device.rackUnit = landing.rackUnit;
        device.rackFace = landing.rackFace;
        device.positionX = landing.position.x;
        device.positionY = landing.position.y;
      }
      this.state.emit("topology");
      return;
    }
    if (this.selectionBox) {
      this.selectionBox.end = world;
      return;
    }
    if (this.linkDrag) {
      const distance = Math.hypot(world.x - this.linkDrag.start.x, world.y - this.linkDrag.start.y);
      if (distance > 7 / this.camera.zoom) this.linkDrag.active = true;
      if (this.linkDrag.active) {
        const target = this.hitLink(world);
        this.linkDrag.targetLinkID = target && target.link.id !== this.linkDrag.sourceLinkID && !isRearPanelLink(target.link) ? target.link.id : null;
        this.canvas.style.cursor = this.linkDrag.targetLinkID ? "copy" : "grabbing";
      }
      return;
    }
    if (this.draft) {
      const candidate = this.nearestPort(world, 18 / this.camera.zoom);
      this.draft.target = candidate && this.isEligibleTarget(this.draft.source, candidate) ? candidate : null;
    }
    this.hoveredAnnotation = this.activeTool === "select" ? this.hitAnnotation(world) : null;
    this.hoveredPort = this.hoveredAnnotation ? null : this.hitPort(world, 4 / this.camera.zoom);
    this.hoveredLink = this.hoveredAnnotation || this.hoveredPort || this.draft ? null : this.hitLink(world);
    this.hoveredDevice = this.hoveredAnnotation || this.hoveredPort || this.hoveredLink || this.draft ? null : this.hitDevice(world);
    const faceControl = this.hitRackFaceControl(world);
    const rack = this.hitRack(world);
    const rackHeader = rack && world.y <= rack.y + RACK_HEADER_HEIGHT;
    this.canvas.style.cursor = faceControl || this.hoveredAnnotation || this.hoveredPort || this.hoveredLink || this.hoveredDevice ? "pointer" : this.draft ? "crosshair" : rackHeader ? "grab" : "default";
  }

  pointerUp(event) {
    this.invalidate();
    const wasDrag = this.drag;
    if (this.annotationDraft) {
      const draft = this.annotationDraft;
      this.annotationDraft = null;
      if (draft.type !== "text" && Math.hypot(draft.end.x - draft.start.x, draft.end.y - draft.start.y) > 8 / this.camera.zoom) {
        this.callbacks.onAnnotationCreate?.({ type: draft.type, x1: draft.start.x, y1: draft.start.y, x2: draft.end.x, y2: draft.end.y });
      }
    } else if (this.pan) {
      this.pan = null; this.canvas.style.cursor = "default";
    } else if (this.rackDrag) {
      const rack = this.state.topology.racks.find((item) => item.id === this.state.selection?.id);
      if (this.rackDrag.active) {
        this.state.history.push(this.rackDrag.snapshot);
        this.state.history = this.state.history.slice(-50);
        this.state.future = [];
        if (rack) this.callbacks.onRackUpdate?.(structuredClone(rack));
      }
      this.rackDrag = null;
      this.canvas.style.cursor = "default";
    } else if (this.draft) {
      const { source, target } = this.draft;
      if (target) this.callbacks.onLinkCreate?.(source, target);
      this.draft = null; this.mode = CableMode.IDLE;
    } else if (this.linkDrag) {
      const { sourceLinkID, targetLinkID, active } = this.linkDrag;
      if (active && targetLinkID) {
        const sourceLink = this.state.topology.links.find((link) => link.id === sourceLinkID);
        const targetLink = this.state.topology.links.find((link) => link.id === targetLinkID);
        if (sourceLink && targetLink) this.callbacks.onLinkGroupRequest?.(sourceLink, targetLink);
      }
      this.linkDrag = null;
      this.canvas.style.cursor = "default";
    } else if (wasDrag) {
      if (wasDrag.active) {
        this.state.history.push(wasDrag.snapshot);
        this.state.history = this.state.history.slice(-50);
        this.state.future = [];
        for (const id of wasDrag.originals.keys()) {
          const device = this.state.topology.devices.find((item) => item.id === id);
          if (device && wasDrag.invalidIDs.has(id)) Object.assign(device, structuredClone(wasDrag.originals.get(id).device));
          if (device) this.callbacks.onDeviceUpdate?.(structuredClone(device));
        }
      }
      this.drag = null;
      this.rackDropPreview = null;
      this.canvas.style.cursor = "default";
    } else if (this.selectionBox) {
      const left = Math.min(this.selectionBox.start.x, this.selectionBox.end.x);
      const top = Math.min(this.selectionBox.start.y, this.selectionBox.end.y);
      const right = Math.max(this.selectionBox.start.x, this.selectionBox.end.x);
      const bottom = Math.max(this.selectionBox.start.y, this.selectionBox.end.y);
      this.selectedDevices = new Set(this.deviceBoxes.filter((box) => box.x < right && box.x + box.width > left && box.y < bottom && box.y + box.height > top).map((box) => box.device.id));
      const first = this.selectedDevices.values().next().value;
      if (first) this.state.select("device", first);
      this.selectionBox = null;
    }
    if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
  }

  wheel(event) {
    event.preventDefault();
    const screen = this.eventPoint(event);
    const input = classifyWheelGesture(event, this.navigationMode, this.navigationDetector);
    const delta = normalizeWheelDelta(event, this.height);
    this.pendingNavigation ||= { panX: 0, panY: 0, zoomLog: 0, zoomAnchor: null };
    if (input.gesture === NavigationGesture.PAN) {
      this.pendingNavigation.panX -= delta.x;
      this.pendingNavigation.panY -= delta.y;
    } else {
      this.pendingNavigation.zoomLog += wheelZoomLogDelta(delta.y);
      this.pendingNavigation.zoomAnchor = screen;
    }
    this.pointerScreen = screen;
    if (input.detectedMode !== this.lastDetectedNavigationMode) {
      this.lastDetectedNavigationMode = input.detectedMode;
      this.callbacks.onNavigationInput?.({ mode: this.navigationMode, ...input });
    }
    if (!this.navigationFrame) this.navigationFrame = requestAnimationFrame(this.flushNavigation);
  }

  flushNavigation() {
    this.navigationFrame = 0;
    if (!this.pendingNavigation) return;
    this.camera = applyNavigationFrame(this.camera, this.pendingNavigation);
    this.pendingNavigation = null;
    this.pointerWorld = this.screenToWorld(this.pointerScreen);
    this.callbacks.onPointer?.(this.pointerWorld, this.camera.zoom);
    this.callbacks.onViewChange?.(this.viewportWorldRect());
    this.invalidate();
  }

  contextMenu(event) {
    event.preventDefault();
    const link = this.hitLink(this.screenToWorld(this.eventPoint(event)));
    if (link) this.callbacks.onLinkDelete?.(link.link);
  }

  cancelInteraction() {
    if (this.drag?.snapshot) this.state.setTopology(this.drag.snapshot);
    if (this.rackDrag?.snapshot) this.state.setTopology(this.rackDrag.snapshot);
    this.draft = null; this.linkDrag = null; this.drag = null; this.rackDrag = null; this.rackDropPreview = null;
    this.pan = null; this.selectionBox = null; this.annotationDraft = null; this.mode = CableMode.IDLE;
    this.canvas.style.cursor = "default";
    this.invalidate();
  }

  isEligibleTarget(source, target) {
    if (!source || !target || source.port.id === target.port.id || source.device.id === target.device.id) return false;
    return !isPortSideOccupied(this.state.topology, target.port.id, LinkEndpointSide.FRONT);
  }

  eventPoint(event) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  screenToWorld(point) {
    return { x: (point.x - this.camera.x) / this.camera.zoom, y: (point.y - this.camera.y) / this.camera.zoom };
  }

  hitPort(point, tolerance = 0) {
    for (let index = this.portBoxes.length - 1; index >= 0; index -= 1) {
      const box = this.portBoxes[index];
      if (point.x >= box.x - tolerance && point.x <= box.x + box.width + tolerance && point.y >= box.y - tolerance && point.y <= box.y + box.height + tolerance) return box;
    }
    return null;
  }

  nearestPort(point, radius) {
    let nearest = null; let distance = radius;
    for (const box of this.portBoxes) {
      const current = Math.hypot(point.x - box.centerX, point.y - box.centerY);
      if (current < distance) { nearest = box; distance = current; }
    }
    return nearest;
  }

  hitDevice(point) {
    for (let index = this.deviceBoxes.length - 1; index >= 0; index -= 1) {
      const box = this.deviceBoxes[index];
      if (point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height) return box;
    }
    return null;
  }

  hitRack(point) {
    const boxes = this.rackFaceBoxes || this.rackBoxes || [];
    for (let index = boxes.length - 1; index >= 0; index -= 1) {
      const box = boxes[index];
      if (point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height) return box;
    }
    return null;
  }

  hitRackFaceControl(point) {
    const boxes = this.rackFaceBoxes || [];
    for (let index = boxes.length - 1; index >= 0; index -= 1) {
      for (const control of this.rackFaceControls(boxes[index])) {
        if (point.x >= control.x && point.x <= control.x + control.width &&
          point.y >= control.y && point.y <= control.y + control.height) return control;
      }
    }
    return null;
  }

  hitLink(point) {
    for (let index = this.linkCurves.length - 1; index >= 0; index -= 1) {
      if (distanceToRoute(point, this.linkCurves[index].curve) <= 8 / this.camera.zoom) return this.linkCurves[index];
    }
    return null;
  }

  hitAnnotation(point) {
    const annotations = this.state.topology?.annotations || [];
    const tolerance = 9 / this.camera.zoom;
    for (let index = annotations.length - 1; index >= 0; index -= 1) {
      const annotation = annotations[index];
      if (annotation.type === "text") {
        const bounds = this.annotationBounds(annotation);
        if (point.x >= bounds.x - tolerance && point.x <= bounds.x + bounds.width + tolerance
          && point.y >= bounds.y - tolerance && point.y <= bounds.y + bounds.height + tolerance) return annotation;
        continue;
      }
      if (annotation.type === "arrow") {
        if (distanceToLineSegment(point, annotation) <= tolerance) return annotation;
        continue;
      }
      if (annotation.type === "rectangle") {
        const left = Math.min(annotation.x1, annotation.x2);
        const right = Math.max(annotation.x1, annotation.x2);
        const top = Math.min(annotation.y1, annotation.y2);
        const bottom = Math.max(annotation.y1, annotation.y2);
        const onHorizontal = point.x >= left - tolerance && point.x <= right + tolerance
          && (Math.abs(point.y - top) <= tolerance || Math.abs(point.y - bottom) <= tolerance);
        const onVertical = point.y >= top - tolerance && point.y <= bottom + tolerance
          && (Math.abs(point.x - left) <= tolerance || Math.abs(point.x - right) <= tolerance);
        if (onHorizontal || onVertical) return annotation;
      }
    }
    return null;
  }

  fit() {
    const bounds = this.worldBounds();
    const zoom = Math.max(.1, Math.min(1.5, Math.min((this.width - 70) / bounds.width, (this.height - 70) / bounds.height)));
    this.camera.zoom = zoom;
    this.camera.x = (this.width - bounds.width * zoom) / 2 - bounds.x * zoom;
    this.camera.y = (this.height - bounds.height * zoom) / 2 - bounds.y * zoom;
    this.callbacks.onPointer?.(this.pointerWorld, this.camera.zoom);
    this.callbacks.onViewChange?.(this.viewportWorldRect());
    this.invalidate();
  }

  viewportWorldRect(camera = this.camera, width = this.width, height = this.height, padding = 0) {
    return {
      x: (-camera.x / camera.zoom) - padding,
      y: (-camera.y / camera.zoom) - padding,
      width: width / camera.zoom + padding * 2,
      height: height / camera.zoom + padding * 2,
    };
  }

  centerOn(x, y) {
    this.camera.x = this.width / 2 - x * this.camera.zoom;
    this.camera.y = this.height / 2 - y * this.camera.zoom;
    this.callbacks.onViewChange?.(this.viewportWorldRect());
    this.invalidate();
  }

  focusDevice(deviceID) {
    const box = this.deviceRectangles().find((candidate) => candidate.device.id === deviceID);
    if (box) this.centerOn(box.x + box.width / 2, box.y + box.height / 2);
  }

  worldBounds() {
    this.layoutScene();
    const boxes = [...this.rackBoxes, ...this.deviceBoxes];
    if (!boxes.length) return { x: 0, y: 0, width: 800, height: 500 };
    const routePoints = this.state.topology
      ? [...this.cableTrackPlan().tracks.values()].flatMap(({ route }) => route.points || [])
      : [];
    const left = Math.min(...boxes.map((box) => box.x), ...routePoints.map((point) => point.x));
    const top = Math.min(...boxes.map((box) => box.y), ...routePoints.map((point) => point.y));
    const right = Math.max(...boxes.map((box) => box.x + box.width), ...routePoints.map((point) => point.x));
    const bottom = Math.max(...boxes.map((box) => box.y + box.height), ...routePoints.map((point) => point.y));
    return { x: left, y: top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
  }

  portCenters() {
    this.layoutScene();
    return new Map(this.portBoxes.map((box) => [box.port.id, { x: box.centerX, y: box.centerY }]));
  }

  rackRectangles() {
    this.layoutScene();
    return this.rackBoxes.map((box) => ({ ...box }));
  }

  deviceRectangles() {
    this.layoutScene();
    return this.deviceBoxes.map((box) => ({ ...box }));
  }

  renderExport() {
    const bounds = this.worldBounds();
    const scale = Math.min(2, 7000 / Math.max(bounds.width + 100, bounds.height + 100));
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil((bounds.width + 100) * scale);
    canvas.height = Math.ceil((bounds.height + 100) * scale);
    const context = canvas.getContext("2d");
    const oldRatio = this.ratio;
    this.ratio = 1;
    const exportProfile = {
      ...resolveGraphicsProfile(GraphicsMode.QUALITY, this.state.topology),
      animationScope: "none", pulses: "none",
    };
    this.renderFrame(context, canvas.width, canvas.height, { x: (50 - bounds.x) * scale, y: (50 - bounds.y) * scale, zoom: scale }, 0, false, exportProfile);
    this.ratio = oldRatio;
    this.activeGraphicsProfile = this.graphicsProfile();
    return canvas;
  }
}

function linkEndpointTooltip(topology, link) {
  const source = findPort(topology, link.sourcePortId);
  const target = findPort(topology, link.targetPortId);
  return `${endpointTooltip(topology, source, link.sourceSide)} ➔ ${endpointTooltip(topology, target, link.targetSide)}`;
}

function endpointTooltip(topology, endpoint, side = "front") {
  if (!endpoint) return "[UNKNOWN ENDPOINT]";
  const sideLabel = side === "rear" ? "REAR " : "";
  return `[${rackLabel(topology, endpoint.device)} - ${endpoint.device.name}: ${sideLabel}${endpoint.port.label}]`;
}

function rackLabel(topology, device) {
  return topology.racks?.find((rack) => rack.id === device.rackId)?.name || "FREE CANVAS";
}

export function tracedRackIDs(topology, traceLinkIDs) {
  if (!traceLinkIDs?.size) return new Set();
  const devices = new Map((topology?.devices || []).map((device) => [device.id, device]));
  const racks = new Set();
  for (const link of topology?.links || []) {
    if (!traceLinkIDs.has(link.id)) continue;
    for (const deviceID of [link.sourceDeviceId, link.targetDeviceId]) {
      const rackID = devices.get(deviceID)?.rackId;
      if (rackID) racks.add(rackID);
    }
  }
  return racks;
}

function addMapSetValue(map, key, value) {
  const values = map.get(key) || new Set();
  values.add(value);
  map.set(key, values);
}

function addMapArrayValue(map, key, value) {
  const values = map.get(key) || [];
  values.push(value);
  map.set(key, values);
}

function captureRoutingGeometry(deviceBoxes = [], rackBoxes = [], portBoxes = []) {
  const portsByDevice = new Map();
  for (const box of portBoxes) {
    const entries = portsByDevice.get(box.device.id) || [];
    entries.push(`${box.port.id}:${fixedGeometry(box.centerX)}:${fixedGeometry(box.centerY)}`);
    portsByDevice.set(box.device.id, entries);
  }
  const devices = new Map(deviceBoxes.map((box) => [box.device.id, {
    id: box.device.id,
    rackID: box.device.rackId || box.rack?.id || "",
    x: box.x, y: box.y, width: box.width, height: box.height,
    portKey: (portsByDevice.get(box.device.id) || []).sort().join(","),
  }]));
  const racks = new Map(rackBoxes.map((box) => [box.rack.id, {
    id: box.rack.id, x: box.x, y: box.y, width: box.width, height: box.height,
  }]));
  const key = `${[...racks.values()].sort(compareGeometryIDs).map(geometryKey).join("|")}::${
    [...devices.values()].sort(compareGeometryIDs).map((box) => `${geometryKey(box)}:${box.rackID}:${box.portKey}`).join("|")}`;
  return { devices, racks, key };
}

function compareRoutingGeometry(previous, current, isInitial) {
  if (isInitial || !sameMapKeys(previous.devices, current.devices) || !sameMapKeys(previous.racks, current.racks)) {
    return { full: true, changedDeviceIDs: new Set(current.devices.keys()), obstacleBounds: [] };
  }
  const changedDeviceIDs = new Set();
  const obstacleBounds = [];
  for (const [deviceID, currentBox] of current.devices) {
    const previousBox = previous.devices.get(deviceID);
    if (sameGeometry(previousBox, currentBox) && previousBox.portKey === currentBox.portKey && previousBox.rackID === currentBox.rackID) continue;
    changedDeviceIDs.add(deviceID);
    obstacleBounds.push(previousBox, currentBox);
  }
  for (const [rackID, currentBox] of current.racks) {
    const previousBox = previous.racks.get(rackID);
    if (sameGeometry(previousBox, currentBox)) continue;
    obstacleBounds.push(previousBox, currentBox);
    for (const device of current.devices.values()) {
      if (device.rackID === rackID) changedDeviceIDs.add(device.id);
    }
  }
  return { full: false, changedDeviceIDs, obstacleBounds };
}

function sameMapKeys(left, right) {
  return left.size === right.size && [...left.keys()].every((key) => right.has(key));
}

function sameGeometry(left, right) {
  return left && right && left.x === right.x && left.y === right.y &&
    left.width === right.width && left.height === right.height;
}

function geometryKey(box) {
  return `${box.id}:${fixedGeometry(box.x)}:${fixedGeometry(box.y)}:${fixedGeometry(box.width)}:${fixedGeometry(box.height)}`;
}

function compareGeometryIDs(left, right) {
  return left.id.localeCompare(right.id);
}

function fixedGeometry(value) {
  return Number(value || 0).toFixed(3);
}

function isFormField(target) {
  return target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement || target instanceof HTMLButtonElement;
}

function intersects(left, right) {
  return left.x < right.x + right.width && left.x + left.width > right.x &&
    left.y < right.y + right.height && left.y + left.height > right.y;
}

function expand(box, amount) {
  return { x: box.x - amount, y: box.y - amount, width: box.width + amount * 2, height: box.height + amount * 2 };
}

function screenDistance(left, right) {
  return Math.hypot((left?.x || 0) - (right?.x || 0), (left?.y || 0) - (right?.y || 0));
}

function distanceToLineSegment(point, line) {
  const dx = line.x2 - line.x1;
  const dy = line.y2 - line.y1;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return Math.hypot(point.x - line.x1, point.y - line.y1);
  const position = Math.max(0, Math.min(1, ((point.x - line.x1) * dx + (point.y - line.y1) * dy) / lengthSquared));
  return Math.hypot(point.x - (line.x1 + position * dx), point.y - (line.y1 + position * dy));
}

function lighten(hex, amount) { return shift(hex, amount); }
function darken(hex, amount) { return shift(hex, -amount); }
function shift(hex, amount) {
  const value = /^#[0-9a-f]{6}$/i.test(hex || "") ? hex.slice(1) : "243438";
  const parts = [0, 2, 4].map((index) => Math.max(0, Math.min(255, parseInt(value.slice(index, index + 2), 16) + amount)));
  return `rgb(${parts.join(",")})`;
}

function vendorColor(vendor) {
	const colors = { Static: "#a9b9bc", Fortinet: "#ef4b45", Cisco: "#65bde8", "HPE Aruba": "#f28c28", Juniper: "#7fba46", Ubiquiti: "#73d4ff", MikroTik: "#d8e5e8", Dell: "#6fc3e8", NETGEAR: "#9c7bd8", "TP-Link Omada": "#58bf68", Arista: "#53b7d4", Extreme: "#bd7be0", Ruckus: "#f0a34a", "Palo Alto": "#f0a34a", Sophos: "#62a8df", "Check Point": "#e56f9d" };
  return colors[vendor] || "#42d9c8";
}
