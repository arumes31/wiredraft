export const CableMode = Object.freeze({
  IDLE: "IDLE",
  DRAFTING_CABLE: "DRAFTING_CABLE",
  SELECTED_LINK: "SELECTED_LINK",
});

export const CABLE_TRACK_SPACING = 9;
export const FACEPLATE_MICRO_LANE_SPACING = 8;
export const CABLE_JUMPER_RADIUS = 5;
export const CABLE_OUTLINE_WIDTH = 1;

const FACEPLATE_INSET = 5;
const FACEPLATE_ESCAPE = 0;
const GUTTER_INSET = 12;
const PERIMETER_INSET = 24;
const BRIDGE_ENDPOINT_CLEARANCE = 20;
const DENSE_MICRO_LANE_SPACING = .5;

// Kept as the public draft-cable helper. The returned route is now a strict
// Manhattan polyline despite the historic function name.
export function cableBezier(source, target) {
  const middleX = source.x + (target.x - source.x) / 2;
  return routeFromPoints([source, { x: middleX, y: source.y }, { x: middleX, y: target.y }, target]);
}

export function routeFromPoints(inputPoints, metadata = {}) {
  const points = simplifyPath(orthogonalize(inputPoints));
  const safePoints = points.length >= 2 ? points : [
    points[0] || { x: 0, y: 0 },
    points[0] || { x: 0, y: 0 },
  ];
  const segments = [];
  for (let index = 1; index < safePoints.length; index += 1) {
    const source = safePoints[index - 1];
    const target = safePoints[index];
    if (distance(source, target) <= .01) continue;
    segments.push(lineSegment(source, target));
  }
  if (!segments.length) segments.push(lineSegment(safePoints[0], safePoints.at(-1)));
  return {
    ...metadata,
    source: segments[0].source,
    target: segments.at(-1).target,
    points: [segments[0].source, ...segments.map((segment) => segment.target)],
    segments,
    lengths: segments.map((segment) => distance(segment.source, segment.target)),
  };
}

/**
 * Assign every visible cable an individual orthogonal track in one batch.
 * Port and device boxes use the same shape as CanvasEngine's scene geometry.
 */
export function assignCableTracks(scene, options = {}) {
  const laneSpacing = clamp(Number(options.laneSpacing) || CABLE_TRACK_SPACING, 8, 10);
  const microSpacing = clamp(Number(options.microSpacing) || FACEPLATE_MICRO_LANE_SPACING, 8, 10);
  const links = scene?.links || [];
  const portMap = new Map((scene?.portBoxes || []).map((box) => [box.port.id, box]));
  const deviceMap = new Map((scene?.deviceBoxes || []).map((box) => [box.device.id, box]));
  const rackMap = new Map((scene?.rackBoxes || []).map((box) => [box.rack.id, box]));
  const descriptors = [];

  for (const link of links) {
    const source = portMap.get(link.sourcePortId);
    const target = portMap.get(link.targetPortId);
    const sourceDevice = source ? deviceMap.get(source.device.id) : null;
    const targetDevice = target ? deviceMap.get(target.device.id) : null;
    if (!source || !target || !sourceDevice || !targetDevice) continue;
    const deviceIDs = [source.device.id, target.device.id].sort();
    descriptors.push({
      link,
      source,
      target,
      sourceDevice,
      targetDevice,
      sourceRack: rackMap.get(source.device.rackId || sourceDevice.rack?.id) || null,
      targetRack: rackMap.get(target.device.rackId || targetDevice.rack?.id) || null,
      bundleKey: `${deviceIDs[0]}::${deviceIDs[1]}`,
      canonicalDeviceIDs: deviceIDs,
    });
  }

  const bundles = new Map();
  for (const descriptor of descriptors) {
    const members = bundles.get(descriptor.bundleKey) || [];
    members.push(descriptor);
    bundles.set(descriptor.bundleKey, members);
  }
  for (const members of bundles.values()) members.sort(compareBundleMembers);

  const routingState = {
    laneSpacing,
    microSpacing,
    deviceMap,
    rackMap,
    allDeviceBoxes: [...deviceMap.values()],
    allRackBoxes: [...rackMap.values()],
    microY: new Map(),
    microRows: new Map(),
    corridorOrdinals: new Map(),
    crossPairTotals: countCrossRackPairs(descriptors),
  };
  const tracks = new Map();

  for (const bundleKey of [...bundles.keys()].sort()) {
    const members = bundles.get(bundleKey);
    for (let bundleIndex = 0; bundleIndex < members.length; bundleIndex += 1) {
      const descriptor = members[bundleIndex];
      const route = planDescriptorTrack(descriptor, {
        ...routingState,
        bundleIndex,
        bundleSize: members.length,
      });
      tracks.set(descriptor.link.id, routeFromPoints(route.points, {
        linkId: descriptor.link.id,
        bundleKey,
        bundleIndex,
        bundleSize: members.length,
        trackOffset: bundleIndex * laneSpacing,
        laneSpacing,
        microSpacing,
        ...route.metadata,
      }));
    }
  }
  return tracks;
}

function planDescriptorTrack(descriptor, state) {
  const {
    source, target, sourceDevice, targetDevice, sourceRack, targetRack,
  } = descriptor;
  const sameRack = Boolean(sourceRack && targetRack && rackID(sourceRack) === rackID(targetRack));
  const crossRack = Boolean(sourceRack && targetRack && rackID(sourceRack) !== rackID(targetRack));
  const sourceRow = portRow(source, sourceDevice);
  const targetRow = portRow(target, targetDevice);
  let sourceSide;
  let targetSide;
  let routeKind;
  let gutterX = null;
  let sourceGutterX = null;
  let targetGutterX = null;
  let bridgeY = null;

  if (sameRack) {
    const preferred = sameRackSide(source, target, sourceDevice, targetDevice);
    const alternate = oppositeSide(preferred);
    const preferredAvailable = microLaneAvailable(state, sourceDevice, preferred, sourceRow) &&
      microLaneAvailable(state, targetDevice, preferred, targetRow);
    sourceSide = targetSide = preferredAvailable ? preferred : alternate;
    const corridor = `rack:${rackID(sourceRack)}:${sourceSide}`;
    const ordinal = nextOrdinal(state.corridorOrdinals, corridor);
    gutterX = outerRackGutter(sourceRack, sourceSide, ordinal, state.laneSpacing);
    routeKind = "intra-rack";
  } else if (crossRack) {
    const sourceRackBox = sourceRack;
    const targetRackBox = targetRack;
    const sourceIsLeft = rackCenterX(sourceRackBox) <= rackCenterX(targetRackBox);
    sourceSide = sourceIsLeft ? "right" : "left";
    targetSide = sourceIsLeft ? "left" : "right";
    const adjacent = horizontallyAdjacentRacks(sourceRackBox, targetRackBox, state.allRackBoxes);
    const preferredAvailable = microLaneAvailable(state, sourceDevice, sourceSide, sourceRow) &&
      microLaneAvailable(state, targetDevice, targetSide, targetRow);
    if (adjacent && preferredAvailable) {
      const pairKey = canonicalPair(rackID(sourceRack), rackID(targetRack));
      const ordinal = nextOrdinal(state.corridorOrdinals, `rack-pair:${pairKey}`);
      gutterX = interRackChannel(
        sourceRackBox,
        targetRackBox,
        ordinal,
        state.crossPairTotals.get(pairKey) || 1,
        state.laneSpacing,
      );
      routeKind = "inter-rack";
    } else {
      if (!preferredAvailable) {
        sourceSide = oppositeSide(sourceSide);
        targetSide = oppositeSide(targetSide);
      }
      const ordinal = nextOrdinal(state.corridorOrdinals, `rack-perimeter:${canonicalPair(rackID(sourceRack), rackID(targetRack))}`);
      sourceGutterX = outerRackGutter(sourceRackBox, sourceSide, ordinal, state.laneSpacing);
      targetGutterX = outerRackGutter(targetRackBox, targetSide, ordinal, state.laneSpacing);
      bridgeY = perimeterBridgeY(sourceRackBox, targetRackBox, state.allRackBoxes, ordinal, state.laneSpacing);
      routeKind = "inter-rack-perimeter";
    }
  } else {
    const sourceCenter = boxCenterX(sourceDevice);
    const targetCenter = boxCenterX(targetDevice);
    sourceSide = sourceCenter <= targetCenter ? "right" : "left";
    targetSide = sourceCenter <= targetCenter ? "left" : "right";
    const gap = horizontalDeviceGap(sourceDevice, targetDevice);
    if (gap && verticalChannelClear(gap.center, sourceDevice, targetDevice, state.allDeviceBoxes)) {
      const ordinal = nextOrdinal(state.corridorOrdinals, `free-gap:${descriptor.bundleKey}`);
      gutterX = gap.center + centeredOffset(ordinal, state.bundleSize, state.laneSpacing);
      routeKind = "free-canvas-gutter";
    } else {
      const ordinal = nextOrdinal(state.corridorOrdinals, `free-perimeter:${descriptor.bundleKey}`);
      sourceGutterX = outerDeviceGutter(sourceDevice, sourceSide, ordinal, state.laneSpacing);
      targetGutterX = outerDeviceGutter(targetDevice, targetSide, ordinal, state.laneSpacing);
      bridgeY = perimeterBridgeY(sourceDevice, targetDevice, state.allDeviceBoxes, ordinal, state.laneSpacing);
      routeKind = "free-canvas-perimeter";
    }
  }

  const sourceLane = allocateEndpointLane(source, sourceDevice, sourceSide, sourceRow, state);
  const targetLane = allocateEndpointLane(target, targetDevice, targetSide, targetRow, state);
  const finalSourceGutter = gutterX ?? sourceGutterX;
  const finalTargetGutter = gutterX ?? targetGutterX;
  const sourceLead = endpointLead(source, sourceDevice, sourceSide, sourceLane, finalSourceGutter);
  const targetLead = endpointLead(target, targetDevice, targetSide, targetLane, finalTargetGutter);
  const points = [...sourceLead];
  if (bridgeY === null) {
    points.push({ x: finalTargetGutter, y: targetLane.y });
  } else {
    points.push(
      { x: finalSourceGutter, y: bridgeY },
      { x: finalTargetGutter, y: bridgeY },
      { x: finalTargetGutter, y: targetLane.y },
    );
  }
  points.push(...targetLead.slice(0, -1).reverse(), { x: target.centerX, y: target.centerY });

  return {
    points,
    metadata: {
      routeKind,
      sameRack,
      crossRack,
      sourceSide,
      targetSide,
      sourceRow,
      targetRow,
      sourceMicroLaneY: sourceLane.y,
      targetMicroLaneY: targetLane.y,
      sourceMicroLaneIndex: sourceLane.index,
      targetMicroLaneIndex: targetLane.index,
      gutterX,
      sourceGutterX: finalSourceGutter,
      targetGutterX: finalTargetGutter,
      bridgeY,
    },
  };
}

function endpointLead(portBox, deviceBox, side, lane, gutterX) {
  const direction = side === "right" ? 1 : -1;
  const connectorEdge = portBox.centerX + direction * (portBox.width / 2 + FACEPLATE_ESCAPE);
  const escapeX = lane.escapeX ?? clamp(
    connectorEdge,
    deviceBox.x + FACEPLATE_INSET,
    deviceBox.x + deviceBox.width - FACEPLATE_INSET,
  );
  return [
    { x: portBox.centerX, y: portBox.centerY },
    { x: escapeX, y: portBox.centerY },
    { x: escapeX, y: lane.y },
    { x: gutterX, y: lane.y },
  ];
}

function allocateEndpointLane(portBox, deviceBox, side, row, state) {
  const yKey = `${deviceBox.device.id}:${side}`;
  const usedY = state.microY.get(yKey) || new Set();
  const capacity = microRowCapacity(deviceBox, state.microSpacing);
  let y = row === "top" ? deviceBox.y + FACEPLATE_INSET : deviceBox.y + deviceBox.height - FACEPLATE_INSET;
  let index = 0;
  let assigned = false;
  for (; index < capacity; index += 1) {
    const candidate = row === "top"
      ? deviceBox.y + FACEPLATE_INSET + index * state.microSpacing
      : deviceBox.y + deviceBox.height - FACEPLATE_INSET - index * state.microSpacing;
    const key = coordinateKey(candidate);
    if (usedY.has(key)) continue;
    y = candidate;
    usedY.add(key);
    assigned = true;
    break;
  }
  if (!assigned) {
    // A fully patched 48/96-port 1U faceplate cannot physically retain an 8px
    // pitch for every endpoint. Preserve unique in-device tracks and row
    // ownership while compressing only the overflow lanes.
    const bandStart = row === "top" ? deviceBox.y + FACEPLATE_INSET : deviceBox.y + deviceBox.height / 2 + DENSE_MICRO_LANE_SPACING;
    const bandEnd = row === "top" ? deviceBox.y + deviceBox.height / 2 - DENSE_MICRO_LANE_SPACING : deviceBox.y + deviceBox.height - FACEPLATE_INSET;
    const totalCapacity = Math.max(1, Math.floor((bandEnd - bandStart) / DENSE_MICRO_LANE_SPACING) + 1);
    for (let overflowIndex = 0; overflowIndex < totalCapacity; overflowIndex += 1) {
      const candidate = row === "top"
        ? bandStart + overflowIndex * DENSE_MICRO_LANE_SPACING
        : bandEnd - overflowIndex * DENSE_MICRO_LANE_SPACING;
      const key = coordinateKey(candidate);
      if (usedY.has(key)) continue;
      y = candidate;
      index = overflowIndex;
      usedY.add(key);
      assigned = true;
      break;
    }
  }
  state.microY.set(yKey, usedY);
  const rowKey = `${deviceBox.device.id}:${side}:${row}`;
  state.microRows.set(rowKey, (state.microRows.get(rowKey) || 0) + 1);

  const direction = side === "right" ? 1 : -1;
  const preferredEscape = portBox.centerX + direction * (portBox.width / 2 + FACEPLATE_ESCAPE);
  const escapeX = clamp(
    preferredEscape,
    deviceBox.x + FACEPLATE_INSET,
    deviceBox.x + deviceBox.width - FACEPLATE_INSET,
  );
  return { y, index, escapeX };
}

function microLaneAvailable(state, deviceBox, side, row) {
  const used = state.microRows.get(`${deviceBox.device.id}:${side}:${row}`) || 0;
  const capacity = microRowCapacity(deviceBox, state.microSpacing);
  return used < capacity;
}

function microRowCapacity(deviceBox, spacing) {
  return Math.max(1, Math.floor((deviceBox.height / 2 - FACEPLATE_INSET - spacing) / spacing) + 1);
}

function compareBundleMembers(left, right) {
  const leftKey = canonicalEndpointKey(left);
  const rightKey = canonicalEndpointKey(right);
  return leftKey.localeCompare(rightKey) || String(left.link.id).localeCompare(String(right.link.id));
}

function canonicalEndpointKey(descriptor) {
  const endpoints = [
    { deviceID: descriptor.source.device.id, port: descriptor.source },
    { deviceID: descriptor.target.device.id, port: descriptor.target },
  ].sort((left, right) => left.deviceID.localeCompare(right.deviceID));
  return endpoints.map(({ deviceID, port }) => [
    deviceID,
    fixedCoordinate(port.centerY),
    fixedCoordinate(port.centerX),
    String(port.port.label || port.port.id),
  ].join(":" )).join("|");
}

function countCrossRackPairs(descriptors) {
  const counts = new Map();
  for (const descriptor of descriptors) {
    if (!descriptor.sourceRack || !descriptor.targetRack || rackID(descriptor.sourceRack) === rackID(descriptor.targetRack)) continue;
    const key = canonicalPair(rackID(descriptor.sourceRack), rackID(descriptor.targetRack));
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

function interRackChannel(sourceRack, targetRack, ordinal, total, spacing) {
  const [left, right] = rackCenterX(sourceRack) <= rackCenterX(targetRack)
    ? [sourceRack, targetRack]
    : [targetRack, sourceRack];
  const gapLeft = left.x + left.width + GUTTER_INSET;
  const gapRight = right.x - GUTTER_INSET;
  const available = Math.max(0, gapRight - gapLeft);
  const required = Math.max(0, (total - 1) * spacing);
  const base = gapLeft + Math.max(0, (available - required) / 2);
  return clamp(base + ordinal * spacing, gapLeft, gapRight);
}

function outerRackGutter(rack, side, ordinal, spacing) {
  return side === "left"
    ? rack.x - GUTTER_INSET - ordinal * spacing
    : rack.x + rack.width + GUTTER_INSET + ordinal * spacing;
}

function outerDeviceGutter(device, side, ordinal, spacing) {
  return side === "left"
    ? device.x - GUTTER_INSET - ordinal * spacing
    : device.x + device.width + GUTTER_INSET + ordinal * spacing;
}

function perimeterBridgeY(sourceBox, targetBox, allBoxes, ordinal, spacing) {
  const top = Math.min(...allBoxes.map((box) => box.y));
  const bottom = Math.max(...allBoxes.map((box) => box.y + box.height));
  const sourceY = sourceBox.y + sourceBox.height / 2;
  const targetY = targetBox.y + targetBox.height / 2;
  const topCost = Math.abs(sourceY - top) + Math.abs(targetY - top);
  const bottomCost = Math.abs(sourceY - bottom) + Math.abs(targetY - bottom);
  return topCost <= bottomCost
    ? top - PERIMETER_INSET - ordinal * spacing
    : bottom + PERIMETER_INSET + ordinal * spacing;
}

function horizontallyAdjacentRacks(sourceRack, targetRack, rackBoxes) {
  if (!sourceRack || !targetRack) return false;
  const [left, right] = rackCenterX(sourceRack) <= rackCenterX(targetRack)
    ? [sourceRack, targetRack]
    : [targetRack, sourceRack];
  if (right.x - (left.x + left.width) < GUTTER_INSET * 2 + CABLE_TRACK_SPACING) return false;
  return !rackBoxes.some((rack) => rack !== left && rack !== right &&
    rack.x < right.x && rack.x + rack.width > left.x + left.width);
}

function horizontalDeviceGap(source, target) {
  if (source.x + source.width < target.x) {
    return { left: source.x + source.width, right: target.x, center: (source.x + source.width + target.x) / 2 };
  }
  if (target.x + target.width < source.x) {
    return { left: target.x + target.width, right: source.x, center: (target.x + target.width + source.x) / 2 };
  }
  return null;
}

function verticalChannelClear(x, source, target, deviceBoxes) {
  const top = Math.min(source.y, target.y);
  const bottom = Math.max(source.y + source.height, target.y + target.height);
  return !deviceBoxes.some((box) => box !== source && box !== target &&
    x > box.x && x < box.x + box.width && bottom > box.y && top < box.y + box.height);
}

function sameRackSide(source, target, sourceBox, targetBox) {
  const leftCost = Math.abs(source.centerX - sourceBox.x) + Math.abs(target.centerX - targetBox.x);
  const rightCost = Math.abs(sourceBox.x + sourceBox.width - source.centerX) +
    Math.abs(targetBox.x + targetBox.width - target.centerX);
  return rightCost <= leftCost ? "right" : "left";
}

function portRow(portBox, deviceBox) {
  return portBox.centerY <= deviceBox.y + deviceBox.height / 2 ? "top" : "bottom";
}

export function cableRole(link, source, target, context = {}) {
  const sourcePort = source?.port || source || {};
  const targetPort = target?.port || target || {};
  const text = [
    link?.role,
    link?.cableType,
    sourcePort.label,
    sourcePort.group,
    targetPort.label,
    targetPort.group,
  ].filter(Boolean).join(" ");
  if (/MGMT|MANAGEMENT|OOB|ILO|IDRAC|BMC|NMC|CONSOLE/i.test(text)) {
    return { key: "management", label: "MANAGEMENT", color: "#f0b35a" };
  }
  const speed = Math.min(
    positiveSpeed(sourcePort.speedMbps),
    positiveSpeed(targetPort.speedMbps),
  );
  if (context.crossRack && speed >= 50000) {
    return { key: "inter-rack-high-speed", label: `${speed / 1000}G INTER-RACK`, color: "#3de5e5" };
  }
  if (["Trunk", "LACP", "MC-LAG"].includes(context.group?.mode)) {
    return { key: "trunk", label: context.group.mode.toUpperCase(), color: "#42d9c8" };
  }
  if (context.crossRack) return { key: "inter-rack", label: "INTER-RACK", color: "#62c8f2" };
  return { key: "access", label: "STANDARD ACCESS", color: "#4e9cf5" };
}

export function cableDashPattern(link, source, target, context = {}) {
  const sourcePort = source?.port || source || {};
  const targetPort = target?.port || target || {};
  const text = [link?.role, link?.notes, sourcePort.label, sourcePort.group, targetPort.label, targetPort.group]
    .filter(Boolean).join(" ");
  if (context.group?.mode === "Failover" && context.group.primaryLinkId !== link?.id) return [10, 5];
  if (/\bHA\d*\b|HEARTBEAT|SYNC/i.test(text)) return [8, 4];
  if (context.role?.key === "management" || /MGMT|MANAGEMENT|OOB/i.test(text)) return [4, 4];
  return [];
}

// Compatibility route for callers without complete scene geometry. Canvas and
// exports use assignCableTracks(), which is the authoritative batch planner.
export function obstacleAwareCableRoute(source, target, options = {}) {
  const { sourceBounds, targetBounds, obstacles = [] } = options;
  if (!sourceBounds || !targetBounds) return cableBezier(source, target);
  const all = obstacles.length ? obstacles : [sourceBounds, targetBounds];
  const sourceIsLeft = boxCenterX(sourceBounds) <= boxCenterX(targetBounds);
  const sourceSide = sourceIsLeft ? "left" : "right";
  const targetSide = sourceIsLeft ? "right" : "left";
  const sourceGutter = outerDeviceGutter(sourceBounds, sourceSide, 0, CABLE_TRACK_SPACING);
  const targetGutter = outerDeviceGutter(targetBounds, targetSide, 0, CABLE_TRACK_SPACING);
  const bridgeY = perimeterBridgeY(sourceBounds, targetBounds, all, 0, CABLE_TRACK_SPACING);
  const sourceMicroY = source.y <= sourceBounds.y + sourceBounds.height / 2
    ? sourceBounds.y + FACEPLATE_INSET
    : sourceBounds.y + sourceBounds.height - FACEPLATE_INSET;
  const targetMicroY = target.y <= targetBounds.y + targetBounds.height / 2
    ? targetBounds.y + FACEPLATE_INSET
    : targetBounds.y + targetBounds.height - FACEPLATE_INSET;
  const sourceEscapeX = clamp(
    source.x + (sourceSide === "right" ? FACEPLATE_ESCAPE : -FACEPLATE_ESCAPE),
    sourceBounds.x + FACEPLATE_INSET,
    sourceBounds.x + sourceBounds.width - FACEPLATE_INSET,
  );
  const targetEscapeX = clamp(
    target.x + (targetSide === "right" ? FACEPLATE_ESCAPE : -FACEPLATE_ESCAPE),
    targetBounds.x + FACEPLATE_INSET,
    targetBounds.x + targetBounds.width - FACEPLATE_INSET,
  );
  return routeFromPoints([
    source,
    { x: sourceEscapeX, y: source.y },
    { x: sourceEscapeX, y: sourceMicroY },
    { x: sourceGutter, y: sourceMicroY },
    { x: sourceGutter, y: bridgeY },
    { x: targetGutter, y: bridgeY },
    { x: targetGutter, y: targetMicroY },
    { x: targetEscapeX, y: targetMicroY },
    { x: targetEscapeX, y: target.y },
    target,
  ], { routeKind: "compatibility-perimeter" });
}

export function orderedCableLinks(topology) {
  const links = topology?.links || [];
  const linkByID = new Map(links.map((link) => [link.id, link]));
  const groupByLink = new Map();
  for (const group of topology?.linkGroups || []) {
    for (const linkID of group.linkIds || []) groupByLink.set(linkID, group);
  }
  const ordered = [];
  const appended = new Set();
  for (const link of links) {
    if (appended.has(link.id)) continue;
    const group = groupByLink.get(link.id);
    for (const memberID of group?.linkIds || [link.id]) {
      const member = linkByID.get(memberID);
      if (!member || appended.has(memberID)) continue;
      ordered.push(member);
      appended.add(memberID);
    }
  }
  return ordered;
}

export function routeSegments(route) {
  return route?.segments?.length ? route.segments : route?.source && route?.target ? [route] : [];
}

export function pointOnRoute(route, t) {
  const segments = routeSegments(route);
  if (!segments.length) return { x: 0, y: 0 };
  const lengths = route.lengths?.length === segments.length
    ? route.lengths
    : segments.map((segment) => distance(segment.source, segment.target));
  const total = lengths.reduce((sum, length) => sum + length, 0) || 1;
  let remaining = clamp(Number(t) || 0, 0, 1) * total;
  for (let index = 0; index < segments.length; index += 1) {
    const length = lengths[index];
    if (remaining <= length || index === segments.length - 1) {
      const ratio = length ? remaining / length : 0;
      return interpolate(segments[index].source, segments[index].target, ratio);
    }
    remaining -= length;
  }
  return { ...segments.at(-1).target };
}

export function distanceToRoute(point, route) {
  const segments = routeSegments(route);
  if (!segments.length) return Number.POSITIVE_INFINITY;
  return Math.min(...segments.map((segment) => distanceToSegment(point, segment.source, segment.target)));
}

// Assign every perpendicular crossing to the horizontal route, independent of
// link order. The reserved/base geometry remains Manhattan; renderers replace
// only the short crossing span with the described semicircular jumper.
export function routesWithCrossingBridges(routes = [], options = {}) {
  const endpointClearance = Math.max(8, Number(options.endpointClearance) || BRIDGE_ENDPOINT_CLEARANCE);
  const radius = clamp(Number(options.radius) || CABLE_JUMPER_RADIUS, 4, 6);
  const decorated = routes.map((route) => route ? { ...route, bridges: [] } : route);
  const metrics = routes.map(routeMetrics);
  for (let leftIndex = 0; leftIndex < routes.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < routes.length; rightIndex += 1) {
      const leftSegments = routeSegments(routes[leftIndex]);
      const rightSegments = routeSegments(routes[rightIndex]);
      for (let leftSegmentIndex = 0; leftSegmentIndex < leftSegments.length; leftSegmentIndex += 1) {
        for (let rightSegmentIndex = 0; rightSegmentIndex < rightSegments.length; rightSegmentIndex += 1) {
          const leftSegment = leftSegments[leftSegmentIndex];
          const rightSegment = rightSegments[rightSegmentIndex];
          const crossing = orthogonalIntersection(leftSegment, rightSegment);
          if (!crossing) continue;
          const leftHorizontal = horizontalSegment(leftSegment);
          const ownerIndex = leftHorizontal ? leftIndex : rightIndex;
          const underRouteIndex = leftHorizontal ? rightIndex : leftIndex;
          const segmentIndex = leftHorizontal ? leftSegmentIndex : rightSegmentIndex;
          const segment = leftHorizontal ? leftSegment : rightSegment;
          const ownerMetrics = metrics[ownerIndex];
          const routeDistance = ownerMetrics.prefix[segmentIndex] + distance(segment.source, crossing);
          if (routeDistance <= endpointClearance || routeDistance >= ownerMetrics.total - endpointClearance) continue;
          if (distance(segment.source, crossing) <= radius + 1 || distance(crossing, segment.target) <= radius + 1) continue;
          const bridges = decorated[ownerIndex].bridges;
          if (bridges.some((bridge) => distance(bridge.crossing, crossing) < radius * 2 + 2)) continue;
          bridges.push({
            crossing,
            apex: { x: crossing.x, y: crossing.y - radius },
            segmentIndex,
            underRouteIndex,
            openingRadius: radius + 4,
            radius,
            horizontal: true,
            jumperArc: true,
          });
        }
      }
    }
  }
  for (const route of decorated.filter(Boolean)) {
    route.bridges.sort((left, right) => left.segmentIndex - right.segmentIndex || left.crossing.x - right.crossing.x);
  }
  return decorated;
}

// Compatibility helper for callers that append one horizontal route at a time.
export function routeWithCrossingBridges(route, underRoutes = [], options = {}) {
  if (!route || !underRoutes.length) return route;
  return routesWithCrossingBridges([...underRoutes, route], options).at(-1);
}

export function pointOnBezier(curve, t) {
  const mt = 1 - t;
  return {
    x: mt ** 3 * curve.source.x + 3 * mt ** 2 * t * curve.cp1.x + 3 * mt * t ** 2 * curve.cp2.x + t ** 3 * curve.target.x,
    y: mt ** 3 * curve.source.y + 3 * mt ** 2 * t * curve.cp1.y + 3 * mt * t ** 2 * curve.cp2.y + t ** 3 * curve.target.y,
  };
}

export function distanceToCurve(point, curve) {
  if (axisAligned(curve.source, curve.target)) return distanceToSegment(point, curve.source, curve.target);
  let minimum = Number.POSITIVE_INFINITY;
  let previous = curve.source;
  for (let index = 1; index <= 32; index += 1) {
    const current = pointOnBezier(curve, index / 32);
    minimum = Math.min(minimum, distanceToSegment(point, previous, current));
    previous = current;
  }
  return minimum;
}

export function segmentIntersectsRectangle(source, target, box) {
  const epsilon = .01;
  const left = box.x + epsilon;
  const right = box.x + box.width - epsilon;
  const top = box.y + epsilon;
  const bottom = box.y + box.height - epsilon;
  if (right <= left || bottom <= top) return false;
  if (source.x === target.x) {
    return source.x > left && source.x < right &&
      Math.max(Math.min(source.y, target.y), top) <= Math.min(Math.max(source.y, target.y), bottom);
  }
  if (source.y === target.y) {
    return source.y > top && source.y < bottom &&
      Math.max(Math.min(source.x, target.x), left) <= Math.min(Math.max(source.x, target.x), right);
  }
  return false;
}

function orthogonalIntersection(left, right) {
  const leftHorizontal = horizontalSegment(left);
  const rightHorizontal = horizontalSegment(right);
  if (leftHorizontal === rightHorizontal) return null;
  const horizontal = leftHorizontal ? left : right;
  const vertical = leftHorizontal ? right : left;
  const x = vertical.source.x;
  const y = horizontal.source.y;
  const withinHorizontal = x > Math.min(horizontal.source.x, horizontal.target.x) &&
    x < Math.max(horizontal.source.x, horizontal.target.x);
  const withinVertical = y > Math.min(vertical.source.y, vertical.target.y) &&
    y < Math.max(vertical.source.y, vertical.target.y);
  return withinHorizontal && withinVertical ? { x, y } : null;
}

function routeMetrics(route) {
  const segments = routeSegments(route);
  const prefix = [];
  let total = 0;
  for (const segment of segments) {
    prefix.push(total);
    total += distance(segment.source, segment.target);
  }
  return { prefix, total };
}

function horizontalSegment(segment) {
  return Math.abs(segment.source.y - segment.target.y) < .001;
}

function lineSegment(source, target) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  return {
    source: { x: source.x, y: source.y },
    cp1: { x: source.x + dx / 3, y: source.y + dy / 3 },
    cp2: { x: source.x + dx * 2 / 3, y: source.y + dy * 2 / 3 },
    target: { x: target.x, y: target.y },
  };
}

function orthogonalize(points) {
  const result = [];
  for (const point of points.filter(Boolean)) {
    const next = { x: Number(point.x) || 0, y: Number(point.y) || 0 };
    const previous = result.at(-1);
    if (previous && !axisAligned(previous, next)) result.push({ x: next.x, y: previous.y });
    result.push(next);
  }
  return result;
}

function simplifyPath(points) {
  const unique = [];
  for (const point of points) {
    if (!unique.length || distance(unique.at(-1), point) > .01) unique.push({ x: point.x, y: point.y });
  }
  let index = 1;
  while (index < unique.length - 1) {
    if (collinear(unique[index - 1], unique[index], unique[index + 1])) unique.splice(index, 1);
    else index += 1;
  }
  return unique;
}

function distanceToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return distance(point, start);
  const ratio = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy), 0, 1);
  return Math.hypot(point.x - (start.x + ratio * dx), point.y - (start.y + ratio * dy));
}

function nextOrdinal(registry, key) {
  const ordinal = registry.get(key) || 0;
  registry.set(key, ordinal + 1);
  return ordinal;
}

function centeredOffset(index, count, spacing) {
  return (index - (count - 1) / 2) * spacing;
}

function positiveSpeed(value) {
  const speed = Number(value);
  return Number.isFinite(speed) && speed > 0 ? speed : 1000;
}

function fixedCoordinate(value) {
  return Number(value || 0).toFixed(3).padStart(12, "0");
}

function coordinateKey(value) {
  return Number(value).toFixed(3);
}

function canonicalPair(left, right) {
  return [String(left), String(right)].sort().join("::");
}

function oppositeSide(side) {
  return side === "left" ? "right" : "left";
}

function rackCenterX(box) {
  return box ? box.x + box.width / 2 : 0;
}

function rackID(box) {
  return box?.rack?.id || box?.id || "";
}

function boxCenterX(box) {
  return box.x + box.width / 2;
}

function axisAligned(source, target) {
  return Math.abs(source.x - target.x) < .001 || Math.abs(source.y - target.y) < .001;
}

function collinear(first, middle, last) {
  return Math.abs((middle.x - first.x) * (last.y - middle.y) -
    (middle.y - first.y) * (last.x - middle.x)) < .001;
}

function interpolate(source, target, t) {
  return { x: source.x + (target.x - source.x) * t, y: source.y + (target.y - source.y) * t };
}

function distance(source, target) {
  return Math.hypot(target.x - source.x, target.y - source.y);
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}
