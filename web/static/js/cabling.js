export const CableMode = Object.freeze({
  IDLE: "IDLE",
  DRAFTING_CABLE: "DRAFTING_CABLE",
  SELECTED_LINK: "SELECTED_LINK",
});

export const CableRoutingPlane = Object.freeze({ FRONT: "front", REAR: "rear" });

export const CABLE_TRACK_SPACING = 9;
export const VERTICAL_TRACK_MIN_GAP = 4;
export const FACEPLATE_MICRO_LANE_SPACING = 8;
export const TRUNK_BUNDLE_LANE_SPACING = 5;
export const BACKEND_TUBE_STRAND_SPACING = 2.5;
export const BACKEND_DISCRETE_STRAND_SPACING = 4;
export const BACKEND_CHANNEL_GAP = 8;
export const BACKEND_CORRIDOR_GAP = 24;
export const CABLE_JUMPER_RADIUS = 4;
export const CABLE_OUTLINE_WIDTH = 1;

const FACEPLATE_INSET = 5;
const FACEPLATE_ESCAPE = 0;
const GUTTER_INSET = 12;
const PERIMETER_INSET = 24;
const BRIDGE_ENDPOINT_CLEARANCE = 20;
const DENSE_MICRO_LANE_SPACING = .5;
const BACKEND_CHANNEL_GAP_LANES = 2;
const BACKEND_CHANNEL_SIZE = 4;
const BACKEND_SHEATH_PADDING = 3;

export function cableRoutingPlane(link) {
  const sourceSide = String(link?.sourceSide || CableRoutingPlane.FRONT).toLowerCase();
  const targetSide = String(link?.targetSide || CableRoutingPlane.FRONT).toLowerCase();
  return sourceSide === CableRoutingPlane.REAR || targetSide === CableRoutingPlane.REAR
    ? CableRoutingPlane.REAR
    : CableRoutingPlane.FRONT;
}

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
  const bundleLaneSpacing = clamp(
    Number(options.bundleLaneSpacing) || TRUNK_BUNDLE_LANE_SPACING,
    VERTICAL_TRACK_MIN_GAP,
    TRUNK_BUNDLE_LANE_SPACING,
  );
  const links = scene?.links || [];
  const groupByLink = new Map();
  for (const group of scene?.linkGroups || options.linkGroups || []) {
    for (const linkID of group.linkIds || []) groupByLink.set(linkID, group);
  }
  const portMap = new Map((scene?.portBoxes || []).map((box) => [box.port.id, box]));
  const deviceMap = new Map((scene?.deviceBoxes || []).map((box) => [box.device.id, box]));
  const rackBoxes = scene?.rackBoxes || [];
  const rackMap = new Map(rackBoxes.map((box) => [rackID(box), box]));
  const rackByPhysicalID = new Map();
  for (const box of rackBoxes) {
    const physicalID = box?.rack?.id || box?.id || "";
    if (!physicalID || (rackByPhysicalID.has(physicalID) && !box.primary)) continue;
    rackByPhysicalID.set(physicalID, box);
  }
  const deviceRack = (mountedDevice, deviceBox) => {
    const physicalID = mountedDevice?.rackId || deviceBox?.rack?.id || "";
    if (!physicalID) return null;
    const face = mountedDevice?.rackFace === "rear" ? "rear" : "front";
    return rackMap.get(`${physicalID}:${face}`) || rackMap.get(physicalID) || rackByPhysicalID.get(physicalID) || null;
  };
  const descriptors = [];

  for (const link of links) {
    const source = portMap.get(link.sourcePortId);
    const target = portMap.get(link.targetPortId);
    const sourceDevice = source ? deviceMap.get(source.device.id) : null;
    const targetDevice = target ? deviceMap.get(target.device.id) : null;
    if (!source || !target || !sourceDevice || !targetDevice) continue;
    const deviceIDs = [source.device.id, target.device.id].sort();
    const routingPlane = cableRoutingPlane(link);
    const linkGroup = groupByLink.get(link.id) || null;
    descriptors.push({
      link,
      source,
      target,
      sourceDevice,
      targetDevice,
      sourceRack: deviceRack(source.device, sourceDevice),
      targetRack: deviceRack(target.device, targetDevice),
      bundleKey: linkGroup
        ? `group:${linkGroup.id}:${routingPlane}`
        : `${deviceIDs[0]}::${deviceIDs[1]}::${routingPlane}`,
      canonicalDeviceIDs: deviceIDs,
      linkGroup,
      routingPlane,
      verticalSpan: Math.abs(target.centerY - source.centerY),
    });
  }

  const bundles = new Map();
  for (const descriptor of descriptors) {
    const members = bundles.get(descriptor.bundleKey) || [];
    members.push(descriptor);
    bundles.set(descriptor.bundleKey, members);
  }
  for (const members of bundles.values()) members.sort(compareVerticalSpanThenBundleMembers);
  const rearCorridorAssignments = planRearCorridors(bundles);

  const routingState = {
    laneSpacing,
    microSpacing,
    deviceMap,
    rackMap,
    allDeviceBoxes: [...deviceMap.values()],
    allRackBoxes: [...rackMap.values()],
    microY: new Map(),
    microRows: new Map(),
    corridorLanes: new Map(),
    frontRackLaneCounts: countFrontRackLanes(descriptors),
    frontDeviceLaneCounts: countFrontDeviceLanes(descriptors),
    rearCorridorAssignments,
  };
  const tracks = new Map();
  const previousTracks = options.previousTracks instanceof Map ? options.previousTracks : null;
  const rerouteLinkIDs = options.rerouteLinkIDs instanceof Set ? options.rerouteLinkIDs : null;
  const reusableTracks = new Map();
  if (previousTracks && rerouteLinkIDs) {
    for (const descriptor of descriptors) {
      if (rerouteLinkIDs.has(descriptor.link.id)) continue;
      const previous = previousTracks.get(descriptor.link.id);
      if (trackHasRoutingReservations(previous)) reusableTracks.set(descriptor.link.id, previous);
    }
    for (const descriptor of descriptors) {
      const previous = reusableTracks.get(descriptor.link.id);
      if (previous) reserveTrackRoutingState(previous, descriptor, routingState);
    }
  }

  const orderedBundleKeys = [...bundles.keys()].sort((left, right) => {
    const leftExplicit = left.startsWith("group:");
    const rightExplicit = right.startsWith("group:");
    if (leftExplicit !== rightExplicit) return leftExplicit ? -1 : 1;
    return left.localeCompare(right);
  });
  const bundleContextByLink = new Map();
  for (const bundleKey of orderedBundleKeys) {
    const members = bundles.get(bundleKey);
    const rearBundle = members[0]?.routingPlane === CableRoutingPlane.REAR;
    const tightBundle = Boolean((members[0]?.linkGroup || rearBundle) && members.length > 1);
    const trackSpacing = tightBundle ? bundleLaneSpacing : laneSpacing;
    const trackMicroSpacing = tightBundle ? bundleLaneSpacing : microSpacing;
    members.forEach((descriptor, bundleIndex) => bundleContextByLink.set(descriptor.link.id, {
      bundleKey,
      bundleIndex,
      bundleSize: members.length,
      tightBundle,
      trackSpacing,
      trackMicroSpacing,
    }));
  }

  // Lane reservations are global to a physical spine, not to a device-pair
  // bundle. Planning every descriptor in ascending span order therefore makes
  // ordinal zero the innermost lane everywhere that links share a spine.
  const routingQueue = [...descriptors].sort(compareVerticalSpanThenBundleMembers);
  for (const descriptor of routingQueue) {
    const context = bundleContextByLink.get(descriptor.link.id);
    const reusable = reusableTracks.get(descriptor.link.id);
    if (reusable) {
      tracks.set(descriptor.link.id, reusable);
      continue;
    }
    const rearAssignment = rearCorridorAssignments.get(descriptor.link.id);
    const memberTrackSpacing = rearAssignment?.strandSpacing || context.trackSpacing;
    const route = planDescriptorTrack(descriptor, {
      ...routingState,
      bundleIndex: context.bundleIndex,
      bundleSize: context.bundleSize,
      trackSpacing: memberTrackSpacing,
      trackMicroSpacing: rearAssignment?.strandSpacing || context.trackMicroSpacing,
    });
    tracks.set(descriptor.link.id, routeFromPoints(route.points, {
      linkId: descriptor.link.id,
      bundleKey: context.bundleKey,
      bundleIndex: context.bundleIndex,
      bundleSize: context.bundleSize,
      trackOffset: rearAssignment?.corridorOffset ?? context.bundleIndex * context.trackSpacing,
      laneSpacing: memberTrackSpacing,
      microSpacing: rearAssignment?.strandSpacing || context.trackMicroSpacing,
      documentationLaneSpacing: laneSpacing,
      tightBundle: context.tightBundle,
      linkGroupId: descriptor.linkGroup?.id || "",
      ...route.metadata,
    }));
  }
  attachRearChannelSheaths(tracks);
  return tracks;
}

function planDescriptorTrack(descriptor, state) {
  const {
    source, target, sourceDevice, targetDevice, sourceRack, targetRack, routingPlane,
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
  const corridorReservations = [];
  const allocateCorridor = (key) => {
    const lane = nextCorridorLane(state.corridorLanes, key, state.trackSpacing);
    corridorReservations.push({ key, ...lane });
    return lane;
  };

  if (routingPlane === CableRoutingPlane.REAR) {
    const assignment = state.rearCorridorAssignments.get(descriptor.link.id);
    const corridorOffset = assignment?.corridorOffset || 0;
    if (sourceRack && targetRack) {
      sourceSide = outerFacingRackSide(sourceRack, state.allRackBoxes);
      targetSide = sameRack ? oppositeSide(sourceSide) : outerFacingRackSide(targetRack, state.allRackBoxes);
      sourceGutterX = consolidatedRearRackGutter(sourceRack, sourceSide, corridorOffset, state);
      targetGutterX = consolidatedRearRackGutter(targetRack, targetSide, corridorOffset, state);
      bridgeY = overheadBridgeY(state.allRackBoxes, corridorOffset);
      routeKind = sameRack ? "rear-intra-rack-overhead" : "rear-inter-rack-overhead";
    } else {
      sourceSide = outerFacingDeviceSide(sourceDevice, state.allDeviceBoxes);
      targetSide = outerFacingDeviceSide(targetDevice, state.allDeviceBoxes);
      sourceGutterX = consolidatedRearDeviceGutter(sourceDevice, sourceSide, corridorOffset, state);
      targetGutterX = consolidatedRearDeviceGutter(targetDevice, targetSide, corridorOffset, state);
      bridgeY = overheadBridgeY(state.allDeviceBoxes, corridorOffset);
      routeKind = "rear-free-canvas-overhead";
    }
    if (sameRack) gutterX = sourceGutterX;
  } else if (sameRack) {
    const preferred = sameRackSide(source, target, sourceDevice, targetDevice);
    const alternate = oppositeSide(preferred);
    const preferredAvailable = microLaneAvailable(state, sourceDevice, preferred, sourceRow) &&
      microLaneAvailable(state, targetDevice, preferred, targetRow);
    sourceSide = targetSide = preferredAvailable ? preferred : alternate;
    const corridor = `rack:${rackID(sourceRack)}:${sourceSide}:front`;
    const lane = allocateCorridor(corridor);
    gutterX = outerRackGutter(sourceRack, sourceSide, lane.offset, state.trackSpacing, routingPlane, state);
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
      // The inter-rack spine begins at the same physical X coordinate as the
      // right-side gutter of the left rack. Reserve both route kinds from the
      // same lane bank so a cross-rack trunk cannot sit on top of a normal
      // same-rack cable.
      const lane = allocateCorridor(interRackSpineKey(sourceRackBox, targetRackBox));
      gutterX = interRackChannel(sourceRackBox, targetRackBox, lane.offset);
      routeKind = "inter-rack";
    } else {
      if (!preferredAvailable) {
        sourceSide = oppositeSide(sourceSide);
        targetSide = oppositeSide(targetSide);
      }
      const pairKey = canonicalPair(rackID(sourceRack), rackID(targetRack));
      const sourceLane = allocateCorridor(`rack:${rackID(sourceRack)}:${sourceSide}:front`);
      const targetLane = allocateCorridor(`rack:${rackID(targetRack)}:${targetSide}:front`);
      const bridgeLane = allocateCorridor(`rack-perimeter:${pairKey}:front`);
      sourceGutterX = outerRackGutter(sourceRackBox, sourceSide, sourceLane.offset, state.trackSpacing, routingPlane, state);
      targetGutterX = outerRackGutter(targetRackBox, targetSide, targetLane.offset, state.trackSpacing, routingPlane, state);
      bridgeY = perimeterBridgeY(sourceRackBox, targetRackBox, state.allRackBoxes, bridgeLane.offset);
      routeKind = "inter-rack-perimeter";
    }
  } else {
    const sourceCenter = boxCenterX(sourceDevice);
    const targetCenter = boxCenterX(targetDevice);
    sourceSide = sourceCenter <= targetCenter ? "right" : "left";
    targetSide = sourceCenter <= targetCenter ? "left" : "right";
    const gap = horizontalDeviceGap(sourceDevice, targetDevice);
    if (gap && verticalChannelClear(gap.center, sourceDevice, targetDevice, state.allDeviceBoxes)) {
      const lane = allocateCorridor(`free-gap:${descriptor.bundleKey}`);
      gutterX = gap.center + lane.offset;
      routeKind = "free-canvas-gutter";
    } else {
      const sourceLane = allocateCorridor(`device:${sourceDevice.device.id}:${sourceSide}:front`);
      const targetLane = allocateCorridor(`device:${targetDevice.device.id}:${targetSide}:front`);
      const bridgeLane = allocateCorridor(`free-perimeter:${descriptor.bundleKey}:front`);
      sourceGutterX = outerDeviceGutter(sourceDevice, sourceSide, sourceLane.offset, state.trackSpacing, routingPlane, state);
      targetGutterX = outerDeviceGutter(targetDevice, targetSide, targetLane.offset, state.trackSpacing, routingPlane, state);
      bridgeY = perimeterBridgeY(sourceDevice, targetDevice, state.allDeviceBoxes, bridgeLane.offset);
      routeKind = "free-canvas-perimeter";
    }
  }

  const sourceLane = allocateEndpointLane(source, sourceDevice, sourceSide, sourceRow, state);
  const targetLane = allocateEndpointLane(target, targetDevice, targetSide, targetRow, state);
  const finalSourceGutter = sourceGutterX ?? gutterX;
  const finalTargetGutter = targetGutterX ?? gutterX;
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
      routingPlane,
      sameRack,
      crossRack,
      sourceSide,
      targetSide,
      sourceRow,
      targetRow,
      sourceMicroLaneY: sourceLane.y,
      targetMicroLaneY: targetLane.y,
      sourceDeviceEdgeX: sourceSide === "right" ? sourceDevice.x + sourceDevice.width : sourceDevice.x,
      targetDeviceEdgeX: targetSide === "right" ? targetDevice.x + targetDevice.width : targetDevice.x,
      sourceMicroLaneIndex: sourceLane.index,
      targetMicroLaneIndex: targetLane.index,
      gutterX,
      sourceGutterX: finalSourceGutter,
      targetGutterX: finalTargetGutter,
      bridgeY,
      corridorReservations,
      sourceDeviceId: source.device.id,
      targetDeviceId: target.device.id,
      corridorSourceDeviceId: descriptor.canonicalDeviceIDs[0],
      corridorTargetDeviceId: descriptor.canonicalDeviceIDs[1],
      verticalSpan: descriptor.verticalSpan,
      verticalSpineKeys: routingPlane === CableRoutingPlane.REAR
        ? [state.rearCorridorAssignments.get(descriptor.link.id)?.rearCorridorKey].filter(Boolean)
        : corridorReservations.map(({ key }) => key),
      spineLaneIndex: routingPlane === CableRoutingPlane.REAR
        ? state.rearCorridorAssignments.get(descriptor.link.id)?.rearStrandIndex || 0
        : corridorReservations[0]?.ordinal || 0,
      ...(state.rearCorridorAssignments.get(descriptor.link.id) || {}),
    },
  };
}

function trackHasRoutingReservations(track) {
  return track && Array.isArray(track.corridorReservations) &&
    Number.isFinite(track.sourceMicroLaneY) && Number.isFinite(track.targetMicroLaneY);
}

function reserveTrackRoutingState(track, descriptor, state) {
  reserveEndpointRoutingState(
    descriptor.sourceDevice,
    track.sourceSide,
    track.sourceRow,
    track.sourceMicroLaneY,
    state,
  );
  reserveEndpointRoutingState(
    descriptor.targetDevice,
    track.targetSide,
    track.targetRow,
    track.targetMicroLaneY,
    state,
  );
  for (const reservation of track.corridorReservations) {
    reserveCorridorLane(state.corridorLanes, reservation, track.laneSpacing || state.laneSpacing);
  }
}

function reserveEndpointRoutingState(deviceBox, side, row, y, state) {
  const yKey = `${deviceBox.device.id}:${side}`;
  const usedY = state.microY.get(yKey) || new Set();
  usedY.add(coordinateKey(y));
  state.microY.set(yKey, usedY);
  const rowKey = `${deviceBox.device.id}:${side}:${row}`;
  state.microRows.set(rowKey, (state.microRows.get(rowKey) || 0) + 1);
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
  const spacing = state.trackMicroSpacing || state.microSpacing;
  const capacity = microRowCapacity(deviceBox, spacing);
  let y = row === "top" ? deviceBox.y + FACEPLATE_INSET : deviceBox.y + deviceBox.height - FACEPLATE_INSET;
  let index = 0;
  let assigned = false;
  for (; index < capacity; index += 1) {
    const candidate = row === "top"
      ? deviceBox.y + FACEPLATE_INSET + index * spacing
      : deviceBox.y + deviceBox.height - FACEPLATE_INSET - index * spacing;
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
  const capacity = microRowCapacity(deviceBox, state.trackMicroSpacing || state.microSpacing);
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

function compareVerticalSpanThenBundleMembers(left, right) {
  return left.verticalSpan - right.verticalSpan || compareBundleMembers(left, right);
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

function planRearCorridors(bundles) {
  const assignments = new Map();
  const rearBundles = [...bundles.entries()]
    .filter(([, members]) => members[0]?.routingPlane === CableRoutingPlane.REAR)
    .sort(([left], [right]) => left.localeCompare(right));
  let corridorCursor = 0;

  for (let corridorIndex = 0; corridorIndex < rearBundles.length; corridorIndex += 1) {
    const [bundleKey, members] = rearBundles[corridorIndex];
    const channelsByKey = new Map();
    members.forEach((descriptor, memberIndex) => {
      const portOrdinal = canonicalRearPortOrdinal(descriptor, memberIndex);
      const blockIndex = Math.floor((portOrdinal - 1) / BACKEND_CHANNEL_SIZE);
      const explicitChannelID = String(descriptor.link.rearChannelId || "").trim();
      const explicitType = String(descriptor.link.rearChannelType || "").trim().toLowerCase();
      const channelType = ["tube", "discrete"].includes(explicitType) ? explicitType : rearChannelType(descriptor);
      const channelKey = explicitChannelID
        ? `${bundleKey}:channel:${explicitChannelID}`
        : `${bundleKey}:channel:${blockIndex}:${channelType}`;
      const channel = channelsByKey.get(channelKey) || {
        key: channelKey,
        type: channelType,
        blockIndex,
        name: String(descriptor.link.rearChannelName || "").trim(),
        members: [],
      };
      channel.members.push(descriptor);
      channelsByKey.set(channelKey, channel);
    });
    const channels = [...channelsByKey.values()].sort((left, right) =>
      rearChannelSpan(left) - rearChannelSpan(right) ||
      left.blockIndex - right.blockIndex || left.type.localeCompare(right.type));
    let channelCursor = 0;
    const plannedChannels = channels.map((channel, channelIndex) => {
      channel.members.sort(compareVerticalSpanThenBundleMembers);
      const strandSpacing = channel.type === "tube"
        ? BACKEND_TUBE_STRAND_SPACING
        : BACKEND_DISCRETE_STRAND_SPACING;
      const width = Math.max(0, (channel.members.length - 1) * strandSpacing);
      const edgePadding = channel.type === "tube" ? Math.max(BACKEND_SHEATH_PADDING, (8 - width) / 2) : 0;
      const planned = { ...channel, channelIndex, strandSpacing, start: channelCursor + edgePadding, width, edgePadding };
      channelCursor += edgePadding + width + edgePadding;
      if (channelIndex < channels.length - 1) channelCursor += BACKEND_CHANNEL_GAP;
      return planned;
    });
    const corridorWidth = channelCursor;

    for (const channel of plannedChannels) {
      channel.members.forEach((descriptor, strandIndex) => {
        const channelStartOffset = corridorCursor + channel.start;
        const corridorOffset = channelStartOffset + strandIndex * channel.strandSpacing;
        assignments.set(descriptor.link.id, {
          rearCorridorKey: bundleKey,
          rearCorridorIndex: corridorIndex,
          rearCorridorWidth: corridorWidth,
          rearChannelKey: channel.key,
          rearChannelName: channel.name,
          rearChannelType: channel.type,
          rearChannelIndex: channel.channelIndex,
          rearChannelCount: plannedChannels.length,
          rearChannelStartOffset: channelStartOffset,
          rearChannelEndOffset: channelStartOffset + channel.width,
          rearChannelCenterOffset: channelStartOffset + channel.width / 2,
          rearStrandIndex: strandIndex,
          rearStrandCount: channel.members.length,
          strandSpacing: channel.strandSpacing,
          corridorOffset,
          verticalSpan: descriptor.verticalSpan,
        });
      });
    }
    corridorCursor += corridorWidth;
    if (corridorIndex < rearBundles.length - 1) corridorCursor += BACKEND_CORRIDOR_GAP;
  }
  return assignments;
}

function rearChannelSpan(channel) {
  return Math.max(...channel.members.map((descriptor) => descriptor.verticalSpan));
}

function canonicalRearPortOrdinal(descriptor, fallbackIndex) {
  const canonicalDeviceID = descriptor.canonicalDeviceIDs[0];
  const endpoint = descriptor.source.device.id === canonicalDeviceID ? descriptor.source : descriptor.target;
  const explicit = Number(endpoint.port.portIndex);
  if (Number.isInteger(explicit) && explicit > 0) return explicit;
  const labelOrdinal = Number(String(endpoint.port.label || "").match(/^\d+/)?.[0]);
  return Number.isInteger(labelOrdinal) && labelOrdinal > 0 ? labelOrdinal : fallbackIndex + 1;
}

function rearChannelType(descriptor) {
  const media = [
    descriptor.link.cableType,
    descriptor.source.port.type,
    descriptor.target.port.type,
    descriptor.source.port.mediaType,
    descriptor.target.port.mediaType,
  ].filter(Boolean).join(" ");
  return /FIBER|FIBRE|\bLC\b|\bSC\b|MPO|MTP|OS\d|OM\d/i.test(media) ? "tube" : "discrete";
}

function attachRearChannelSheaths(tracks) {
  const channels = new Map();
  for (const track of tracks.values()) {
    if (track.routingPlane !== CableRoutingPlane.REAR || track.rearChannelType !== "tube") continue;
    const members = channels.get(track.rearChannelKey) || [];
    members.push(track);
    channels.set(track.rearChannelKey, members);
  }
  for (const [channelKey, members] of channels) {
    const first = members[0];
    const sourceDeviceID = first.corridorSourceDeviceId;
    const targetDeviceID = first.corridorTargetDeviceId;
    const sourceEnds = members.map((track) => canonicalTrackEnd(track, sourceDeviceID));
    const targetEnds = members.map((track) => canonicalTrackEnd(track, targetDeviceID));
    const bridgeY = average(members.map((track) => track.bridgeY));
    const sourceY = average(sourceEnds.map((end) => end.microLaneY));
    const targetY = average(targetEnds.map((end) => end.microLaneY));
    const sourceGutterX = average(sourceEnds.map((end) => end.gutterX));
    const targetGutterX = average(targetEnds.map((end) => end.gutterX));
    const centerRoute = routeFromPoints([
      { x: average(sourceEnds.map((end) => end.deviceEdgeX)), y: sourceY },
      { x: sourceGutterX, y: sourceY },
      { x: sourceGutterX, y: bridgeY },
      { x: targetGutterX, y: bridgeY },
      { x: targetGutterX, y: targetY },
      { x: average(targetEnds.map((end) => end.deviceEdgeX)), y: targetY },
    ], { routingPlane: CableRoutingPlane.REAR, routeKind: "rear-tube-sheath" });
    const sheath = {
      key: channelKey,
      name: first.rearChannelName,
      type: "tube",
      linkIds: members.map((track) => track.linkId),
      strandCount: members.length,
      width: Math.max(8, first.rearChannelEndOffset - first.rearChannelStartOffset + BACKEND_SHEATH_PADDING * 2),
      route: centerRoute,
    };
    for (const track of members) track.rearChannelSheath = sheath;
  }
}

function canonicalTrackEnd(track, deviceID) {
  if (track.sourceDeviceId === deviceID) {
    return { gutterX: track.sourceGutterX, microLaneY: track.sourceMicroLaneY, deviceEdgeX: track.sourceDeviceEdgeX };
  }
  return { gutterX: track.targetGutterX, microLaneY: track.targetMicroLaneY, deviceEdgeX: track.targetDeviceEdgeX };
}

function average(values) {
  const finite = values.filter(Number.isFinite);
  return finite.reduce((sum, value) => sum + value, 0) / Math.max(1, finite.length);
}

function countFrontRackLanes(descriptors) {
  const counts = new Map();
  for (const descriptor of descriptors) {
    if (descriptor.routingPlane !== CableRoutingPlane.FRONT) continue;
    const rackIDs = new Set([descriptor.sourceRack, descriptor.targetRack].filter(Boolean).map(rackID));
    for (const id of rackIDs) counts.set(id, (counts.get(id) || 0) + 1);
  }
  return counts;
}

function countFrontDeviceLanes(descriptors) {
  const counts = new Map();
  for (const descriptor of descriptors) {
    if (descriptor.routingPlane !== CableRoutingPlane.FRONT) continue;
    const deviceIDs = new Set([descriptor.sourceDevice?.device?.id, descriptor.targetDevice?.device?.id].filter(Boolean));
    for (const id of deviceIDs) counts.set(id, (counts.get(id) || 0) + 1);
  }
  return counts;
}

function interRackChannel(sourceRack, targetRack, laneOffset) {
  const [left, right] = rackCenterX(sourceRack) <= rackCenterX(targetRack)
    ? [sourceRack, targetRack]
    : [targetRack, sourceRack];
  const gapLeft = left.x + left.width + GUTTER_INSET;
  const gapRight = right.x - GUTTER_INSET;
  // The left rack edge is the canonical inner edge for the shared inter-rack
  // spine. Span-first ordinals then expand concentrically into the open gap.
  return clamp(gapLeft + laneOffset, gapLeft, gapRight);
}

function interRackSpineKey(sourceRack, targetRack) {
  const left = rackCenterX(sourceRack) <= rackCenterX(targetRack) ? sourceRack : targetRack;
  return `rack:${rackID(left)}:right:front`;
}

function consolidatedRearRackGutter(rack, side, corridorOffset, state) {
  const frontLaneCount = state.frontRackLaneCounts?.get(rackID(rack)) || 0;
  const frontClearance = (frontLaneCount + BACKEND_CHANNEL_GAP_LANES) * state.laneSpacing;
  const distanceFromFrame = GUTTER_INSET + frontClearance + corridorOffset;
  return side === "left" ? rack.x - distanceFromFrame : rack.x + rack.width + distanceFromFrame;
}

function consolidatedRearDeviceGutter(device, side, corridorOffset, state) {
  const frontLaneCount = state.frontDeviceLaneCounts?.get(device.device?.id) || 0;
  const frontClearance = (frontLaneCount + BACKEND_CHANNEL_GAP_LANES) * state.laneSpacing;
  const distanceFromFrame = GUTTER_INSET + frontClearance + corridorOffset;
  return side === "left"
    ? device.x - distanceFromFrame
    : device.x + device.width + distanceFromFrame;
}

function overheadBridgeY(allBoxes, corridorOffset) {
  const top = Math.min(...allBoxes.map((box) => box.y));
  return top - PERIMETER_INSET - corridorOffset;
}

function outerRackGutter(rack, side, laneOffset, spacing, routingPlane = CableRoutingPlane.FRONT, state = {}) {
  const frontLaneCount = state.frontRackLaneCounts?.get(rackID(rack)) || 0;
  const rearOffset = routingPlane === CableRoutingPlane.REAR
    ? (frontLaneCount + BACKEND_CHANNEL_GAP_LANES) * spacing
    : 0;
  const distanceFromFrame = GUTTER_INSET + rearOffset + laneOffset;
  return side === "left"
    ? rack.x - distanceFromFrame
    : rack.x + rack.width + distanceFromFrame;
}

function outerDeviceGutter(device, side, laneOffset, spacing, routingPlane = CableRoutingPlane.FRONT, state = {}) {
  const frontLaneCount = state.frontDeviceLaneCounts?.get(device.device?.id) || 0;
  const rearOffset = routingPlane === CableRoutingPlane.REAR
    ? (frontLaneCount + BACKEND_CHANNEL_GAP_LANES) * spacing
    : 0;
  const distanceFromFrame = GUTTER_INSET + rearOffset + laneOffset;
  return side === "left"
    ? device.x - distanceFromFrame
    : device.x + device.width + distanceFromFrame;
}

function outerFacingRackSide(rack, rackBoxes) {
  const centers = rackBoxes.map(rackCenterX);
  const center = centers.reduce((sum, value) => sum + value, 0) / Math.max(1, centers.length);
  return rackCenterX(rack) <= center ? "left" : "right";
}

function outerFacingDeviceSide(device, deviceBoxes) {
  const centers = deviceBoxes.map(boxCenterX);
  const center = centers.reduce((sum, value) => sum + value, 0) / Math.max(1, centers.length);
  return boxCenterX(device) <= center ? "left" : "right";
}

function perimeterBridgeY(sourceBox, targetBox, allBoxes, laneOffset) {
  const top = Math.min(...allBoxes.map((box) => box.y));
  const bottom = Math.max(...allBoxes.map((box) => box.y + box.height));
  const sourceY = sourceBox.y + sourceBox.height / 2;
  const targetY = targetBox.y + targetBox.height / 2;
  const topCost = Math.abs(sourceY - top) + Math.abs(targetY - top);
  const bottomCost = Math.abs(sourceY - bottom) + Math.abs(targetY - bottom);
  return topCost <= bottomCost
    ? top - PERIMETER_INSET - laneOffset
    : bottom + PERIMETER_INSET + laneOffset;
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
  const bridgeY = perimeterBridgeY(sourceBounds, targetBounds, all, 0);
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
  return [
    ...ordered.filter((link) => cableRoutingPlane(link) === CableRoutingPlane.REAR),
    ...ordered.filter((link) => cableRoutingPlane(link) === CableRoutingPlane.FRONT),
  ];
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
  const radius = clamp(Number(options.radius) || CABLE_JUMPER_RADIUS, 3, 4);
  const previousRoutes = Array.isArray(options.previousRoutes) ? options.previousRoutes : null;
  const affectedIndices = options.affectedIndices instanceof Set ? new Set(options.affectedIndices) : null;
  if (previousRoutes && affectedIndices) {
    for (let index = 0; index < routes.length; index += 1) {
      if (!previousRoutes[index]) affectedIndices.add(index);
    }
  }
  const incremental = Boolean(previousRoutes && affectedIndices);
  const decorated = routes.map((route, index) => {
    if (!route) return route;
    if (!incremental || affectedIndices.has(index)) return { ...route, bridges: [] };
    const bridges = (previousRoutes[index]?.bridges || [])
      .filter((bridge) => !affectedIndices.has(bridge.underRouteIndex))
      .map((bridge) => ({ ...bridge, crossing: { ...bridge.crossing }, apex: { ...bridge.apex } }));
    return { ...route, bridges };
  });
  const metrics = routes.map(routeMetrics);
  for (let leftIndex = 0; leftIndex < routes.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < routes.length; rightIndex += 1) {
      if (incremental && !affectedIndices.has(leftIndex) && !affectedIndices.has(rightIndex)) continue;
      if (options.stats) options.stats.pairsExamined = (options.stats.pairsExamined || 0) + 1;
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
          if (routes[ownerIndex]?.routingPlane === CableRoutingPlane.REAR) continue;
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

function nextCorridorLane(registry, key, spacing) {
  const lanes = registry.get(key) || [];
  const ordinals = new Set(lanes.map(({ ordinal }) => ordinal));
  let ordinal = 0;
  while (ordinals.has(ordinal)) ordinal += 1;
  const outermost = lanes.reduce((candidate, lane) =>
    !candidate || lane.offset > candidate.offset ? lane : candidate, null);
  const offset = outermost ? outermost.offset + Math.max(outermost.spacing, spacing) : 0;
  const lane = { ordinal, offset, spacing };
  lanes.push(lane);
  registry.set(key, lanes);
  return lane;
}

function reserveCorridorLane(registry, reservation, fallbackSpacing) {
  const lanes = registry.get(reservation.key) || [];
  if (lanes.some(({ ordinal }) => ordinal === reservation.ordinal)) return;
  const spacing = Number(reservation.spacing) || fallbackSpacing;
  lanes.push({
    ordinal: reservation.ordinal,
    offset: Number.isFinite(reservation.offset) ? reservation.offset : reservation.ordinal * spacing,
    spacing,
  });
  registry.set(reservation.key, lanes);
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
  if (box?.routingKey) return box.routingKey;
  const physicalID = box?.rack?.id || box?.id || "";
  if (!physicalID || !box?.face) return physicalID;
  return `${physicalID}:${box.face === "rear" ? "rear" : "front"}`;
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
