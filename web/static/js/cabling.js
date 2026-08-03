export const CableMode = Object.freeze({
  IDLE: "IDLE",
  DRAFTING_CABLE: "DRAFTING_CABLE",
  SELECTED_LINK: "SELECTED_LINK",
});

export function cableBezier(source, target) {
  const distance = Math.hypot(target.x - source.x, target.y - source.y);
  const slack = Math.max(55, Math.min(220, distance * 0.34));
  return {
    source,
    target,
    cp1: { x: source.x, y: source.y + slack },
    cp2: { x: target.x, y: target.y - slack },
  };
}

const DEVICE_CLEARANCE = 12;
const LANE_CLEARANCE = 18;
const CORNER_RADIUS = 14;
const CABLE_LANE_SPACING = 12;
const MIN_CABLE_CLEARANCE = 8;
const CABLE_LANE_AFFINITY = 1200;
const BUNDLE_LANE_AFFINITY = 3600;
const BUNDLE_ENDPOINT_REACH = 650;
const CROSSING_PENALTY = 180;
const BRIDGE_RADIUS = 12;
const BRIDGE_HEIGHT = 13;
const BRIDGE_ENDPOINT_CLEARANCE = 28;

export function obstacleAwareCableRoute(source, target, options = {}) {
  const {
    sourceBounds, targetBounds, obstacles = [], portObstacles = [], occupiedRoutes = [], preferredRoutes = [],
  } = options;
  if (!sourceBounds || !targetBounds) return routeFromCurves([cableBezier(source, target)]);

  const expanded = obstacles.map((bounds) => expandRectangle(bounds, DEVICE_CLEARANCE));
  const sourceExit = nearestVerticalExit(source, sourceBounds, DEVICE_CLEARANCE, target, portObstacles);
  const targetExit = nearestVerticalExit(target, targetBounds, DEVICE_CLEARANCE, source, portObstacles);
  const middle = shortestClearPath(sourceExit, targetExit, expanded, occupiedRoutes, preferredRoutes);
  return roundedRoute([source, ...middle, target], expanded);
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
    const memberIDs = group?.linkIds || [link.id];
    for (const memberID of memberIDs) {
      const member = linkByID.get(memberID);
      if (!member || appended.has(memberID)) continue;
      ordered.push(member);
      appended.add(memberID);
    }
  }
  return ordered;
}

export function routeSegments(route) {
  return route?.segments?.length ? route.segments : route ? [route] : [];
}

export function pointOnRoute(route, t) {
  const segments = routeSegments(route);
  if (!segments.length) return { x: 0, y: 0 };
  if (segments.length === 1) return pointOnBezier(segments[0], t);
  const lengths = route.lengths?.length === segments.length ? route.lengths : segments.map(approximateCurveLength);
  const total = lengths.reduce((sum, length) => sum + length, 0) || 1;
  let remaining = Math.max(0, Math.min(1, t)) * total;
  for (let index = 0; index < segments.length; index += 1) {
    if (remaining <= lengths[index] || index === segments.length - 1) {
      return pointOnBezier(segments[index], lengths[index] ? remaining / lengths[index] : 0);
    }
    remaining -= lengths[index];
  }
  return segments.at(-1).target;
}

export function distanceToRoute(point, route) {
  return Math.min(...routeSegments(route).map((curve) => distanceToCurve(point, curve)));
}

export function routeWithCrossingBridges(route, underRoutes = [], options = {}) {
  if (!route || !underRoutes.length) return route;
  const radius = Math.max(4, Number(options.radius) || BRIDGE_RADIUS);
  const height = Math.max(3, Number(options.height) || BRIDGE_HEIGHT);
  const endpointClearance = Math.max(radius * 2, Number(options.endpointClearance) || BRIDGE_ENDPOINT_CLEARANCE);
  const polyline = flattenRoute(route);
  const totalLength = polyline.at(-1)?.distance || 0;
  if (totalLength <= endpointClearance * 2) return route;

  const crossings = [];
  const underSegments = underRoutes.flatMap((underRoute, underRouteIndex) =>
    polylineSegments(flattenRoute(underRoute)).map((segment) => ({ ...segment, underRouteIndex })));
  for (const ownSegment of polylineSegments(polyline)) {
    for (const underSegment of underSegments) {
      const intersection = properSegmentIntersection(
        ownSegment.source,
        ownSegment.target,
        underSegment.source,
        underSegment.target,
      );
      if (!intersection || intersection.angleSine < .32) continue;
      const routeDistance = ownSegment.startDistance + distance(ownSegment.source, intersection.point);
      if (routeDistance <= endpointClearance || routeDistance >= totalLength - endpointClearance) continue;
      crossings.push({
        distance: routeDistance,
        point: intersection.point,
        underRouteIndex: underSegment.underRouteIndex,
      });
    }
  }
  crossings.sort((left, right) => left.distance - right.distance);
  const distinct = crossings.filter((crossing, index) =>
    index === 0 || crossing.distance - crossings[index - 1].distance >= radius * 2.5);
  if (!distinct.length) return route;

  const side = stableBridgeSide(options.key);
  const curves = [];
  const bridges = [];
  let cursorDistance = 0;
  for (const crossing of distinct) {
    const startDistance = crossing.distance - radius;
    const endDistance = crossing.distance + radius;
    appendPolylineRange(curves, polyline, cursorDistance, startDistance);
    const start = pointAtPolylineDistance(polyline, startDistance);
    const end = pointAtPolylineDistance(polyline, endDistance);
    const span = { x: end.x - start.x, y: end.y - start.y };
    const spanLength = Math.hypot(span.x, span.y) || 1;
    const normal = { x: -span.y / spanLength * side, y: span.x / spanLength * side };
    const controlLift = height * 1.34;
    const bridge = {
      source: start,
      cp1: {
        x: start.x + span.x * .28 + normal.x * controlLift,
        y: start.y + span.y * .28 + normal.y * controlLift,
      },
      cp2: {
        x: end.x - span.x * .28 + normal.x * controlLift,
        y: end.y - span.y * .28 + normal.y * controlLift,
      },
      target: end,
    };
    curves.push(bridge);
    bridges.push({
      crossing: crossing.point,
      apex: pointOnBezier(bridge, .5),
      start,
      end,
      underRouteIndex: crossing.underRouteIndex,
      openingRadius: Math.max(5, Math.min(radius * .64, height * .62)),
    });
    cursorDistance = endDistance;
  }
  appendPolylineRange(curves, polyline, cursorDistance, totalLength);
  return { ...routeFromCurves(curves), bridges };
}

export function pointOnBezier(curve, t) {
  const mt = 1 - t;
  return {
    x: mt ** 3 * curve.source.x + 3 * mt ** 2 * t * curve.cp1.x + 3 * mt * t ** 2 * curve.cp2.x + t ** 3 * curve.target.x,
    y: mt ** 3 * curve.source.y + 3 * mt ** 2 * t * curve.cp1.y + 3 * mt * t ** 2 * curve.cp2.y + t ** 3 * curve.target.y,
  };
}

export function distanceToCurve(point, curve) {
  let minimum = Number.POSITIVE_INFINITY;
  let previous = curve.source;
  for (let index = 1; index <= 32; index += 1) {
    const current = pointOnBezier(curve, index / 32);
    minimum = Math.min(minimum, distanceToSegment(point, previous, current));
    previous = current;
  }
  return minimum;
}

function distanceToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

function nearestVerticalExit(point, bounds, clearance, peer, portObstacles) {
  const otherPorts = portObstacles.filter((box) => !containsPoint(box, point));
  const preferredSide = peer.y < point.y ? "top" : "bottom";
  const candidates = [
    { side: "top", edgeY: bounds.y, y: bounds.y - clearance },
    { side: "bottom", edgeY: bounds.y + bounds.height, y: bounds.y + bounds.height + clearance },
  ].map((candidate) => ({
    ...candidate,
    collisions: otherPorts.filter((box) => segmentIntersectsRectangle(
      point,
      { x: point.x, y: candidate.y },
      expandRectangle(box, 3),
    )).length,
    edgeDistance: Math.abs(point.y - candidate.edgeY),
  }));
  candidates.sort((left, right) =>
    left.collisions - right.collisions ||
    left.edgeDistance - right.edgeDistance ||
    Number(right.side === preferredSide) - Number(left.side === preferredSide));
  return { x: point.x, y: candidates[0].y };
}

function shortestClearPath(source, target, obstacles, occupiedRoutes, preferredRoutes = []) {
  const occupiedSegments = occupiedRoutes.flatMap((route) => routeSegments(route));
  const candidates = [
    [source, target],
    [source, { x: source.x, y: target.y }, target],
    [source, { x: target.x, y: source.y }, target],
  ];
  const diagonalOffset = CABLE_LANE_SPACING / Math.sqrt(2);
  const laneOffsets = [
    { x: -CABLE_LANE_SPACING, y: 0 }, { x: CABLE_LANE_SPACING, y: 0 },
    { x: 0, y: -CABLE_LANE_SPACING }, { x: 0, y: CABLE_LANE_SPACING },
    { x: -diagonalOffset, y: -diagonalOffset }, { x: diagonalOffset, y: -diagonalOffset },
    { x: -diagonalOffset, y: diagonalOffset }, { x: diagonalOffset, y: diagonalOffset },
  ];
  const preferredSet = new Set(preferredRoutes);
  const affinityRoutes = [...preferredRoutes, ...occupiedRoutes.filter((route) => !preferredSet.has(route))];
  for (const route of affinityRoutes) {
    let vertices = routeVertices(route);
    if (vertices.length < 2) continue;
    const directEndpointSpread = Math.max(distance(source, vertices[0]), distance(target, vertices.at(-1)));
    const reverseEndpointSpread = Math.max(distance(source, vertices.at(-1)), distance(target, vertices[0]));
    const isBundleRoute = preferredSet.has(route);
    const reach = isBundleRoute ? BUNDLE_ENDPOINT_REACH : 420;
    if (Math.min(directEndpointSpread, reverseEndpointSpread) > reach) continue;
    if (reverseEndpointSpread < directEndpointSpread) vertices = [...vertices].reverse();
    for (const offset of laneOffsets) {
      const shifted = vertices
        .map((point) => ({ x: point.x + offset.x, y: point.y + offset.y }))
        .filter((point) => obstacles.every((box) => !containsPoint(box, point)));
      if (shifted.length >= 2) {
        const laneCandidate = [source, ...shifted, target];
        laneCandidate.laneAffinity = !isBundleRoute;
        laneCandidate.bundleAffinity = isBundleRoute;
        laneCandidate.sharedLength = polylineLength(shifted);
        candidates.push(laneCandidate);
      }
    }
  }
  const allX = [source.x, target.x, ...obstacles.flatMap((box) => [box.x - LANE_CLEARANCE, box.x + box.width + LANE_CLEARANCE])];
  const allY = [source.y, target.y, ...obstacles.flatMap((box) => [box.y - LANE_CLEARANCE, box.y + box.height + LANE_CLEARANCE])];
  for (const segment of occupiedSegments) {
    const dx = Math.abs(segment.target.x - segment.source.x);
    const dy = Math.abs(segment.target.y - segment.source.y);
    if (dx <= 2 && dy > 8) {
      allX.push(segment.source.x - CABLE_LANE_SPACING, segment.source.x + CABLE_LANE_SPACING);
    }
    if (dy <= 2 && dx > 8) {
      allY.push(segment.source.y - CABLE_LANE_SPACING, segment.source.y + CABLE_LANE_SPACING);
    }
  }
  if (obstacles.length) {
    allX.push(Math.min(...obstacles.map((box) => box.x)) - LANE_CLEARANCE * 2);
    allX.push(Math.max(...obstacles.map((box) => box.x + box.width)) + LANE_CLEARANCE * 2);
    allY.push(Math.min(...obstacles.map((box) => box.y)) - LANE_CLEARANCE * 2);
    allY.push(Math.max(...obstacles.map((box) => box.y + box.height)) + LANE_CLEARANCE * 2);
  }
  const xLanes = uniqueNumbers(allX);
  const yLanes = uniqueNumbers(allY);
  for (const x of xLanes) candidates.push([source, { x, y: source.y }, { x, y: target.y }, target]);
  for (const y of yLanes) candidates.push([source, { x: source.x, y }, { x: target.x, y }, target]);

  const perimeterCandidates = [];
  if (occupiedSegments.length) {
    for (const x of xLanes) for (const y of yLanes) {
      perimeterCandidates.push([source, { x, y: source.y }, { x, y }, { x: target.x, y }, target]);
      perimeterCandidates.push([source, { x: source.x, y }, { x, y }, { x, y: target.y }, target]);
    }
  }

  let valid = [...candidates, ...perimeterCandidates].map(prepareCandidate).filter((points) => pathClearsObstacles(points, obstacles));
  if (!valid.length && !perimeterCandidates.length) {
    for (const x of xLanes) for (const y of yLanes) {
      perimeterCandidates.push([source, { x, y: source.y }, { x, y }, { x: target.x, y }, target]);
      perimeterCandidates.push([source, { x: source.x, y }, { x, y }, { x, y: target.y }, target]);
    }
    valid = perimeterCandidates.map(prepareCandidate).filter((points) => pathClearsObstacles(points, obstacles));
  }
  if (!valid.length) return [source, target];
  valid.sort((left, right) => routeScore(left, occupiedSegments) - routeScore(right, occupiedSegments));
  return valid[0];
}

function roundedRoute(inputPoints, obstacles) {
  const points = simplifyPath(inputPoints);
  const curves = [];
  let cursor = points[0];
  for (let index = 1; index < points.length; index += 1) {
    const corner = points[index];
    const canRound = index > 1 && index < points.length - 2 &&
      !collinear(points[index - 1], corner, points[index + 1]) &&
      obstacles.every((box) => pointRectangleDistance(corner, box) > CORNER_RADIUS);
    if (!canRound) {
      pushLine(curves, cursor, corner);
      cursor = corner;
      continue;
    }
    const before = moveToward(corner, points[index - 1], Math.min(CORNER_RADIUS, distance(corner, points[index - 1]) / 2));
    const after = moveToward(corner, points[index + 1], Math.min(CORNER_RADIUS, distance(corner, points[index + 1]) / 2));
    pushLine(curves, cursor, before);
    curves.push({
      source: before,
      cp1: moveToward(before, corner, distance(before, corner) * 2 / 3),
      cp2: moveToward(after, corner, distance(after, corner) * 2 / 3),
      target: after,
    });
    cursor = after;
  }
  return routeFromCurves(curves);
}

function routeFromCurves(segments) {
  const safeSegments = segments.filter((curve) => distance(curve.source, curve.target) > .01);
  const fallback = safeSegments.length ? safeSegments : [cableBezier({ x: 0, y: 0 }, { x: 0, y: 0 })];
  return {
    source: fallback[0].source,
    target: fallback.at(-1).target,
    segments: fallback,
    lengths: fallback.map(approximateCurveLength),
  };
}

function pushLine(curves, source, target) {
  if (distance(source, target) <= .01) return;
  curves.push({
    source,
    cp1: moveToward(source, target, distance(source, target) / 3),
    cp2: moveToward(source, target, distance(source, target) * 2 / 3),
    target,
  });
}

function simplifyPath(points) {
  const unique = [];
  for (const point of points) {
    if (!unique.length || distance(unique.at(-1), point) > .01) unique.push({ x: point.x, y: point.y });
  }
  let changed = true;
  while (changed && unique.length > 2) {
    changed = false;
    for (let index = 1; index < unique.length - 1; index += 1) {
      if (!collinear(unique[index - 1], unique[index], unique[index + 1])) continue;
      unique.splice(index, 1); changed = true; break;
    }
  }
  return unique;
}

function prepareCandidate(points) {
  const simplified = simplifyPath(points);
  if (points.laneAffinity) simplified.laneAffinity = true;
  if (points.bundleAffinity) simplified.bundleAffinity = true;
  if (points.sharedLength) simplified.sharedLength = points.sharedLength;
  return simplified;
}

function pathClearsObstacles(points, obstacles) {
  for (let index = 1; index < points.length; index += 1) {
    if (obstacles.some((box) => segmentIntersectsRectangle(points[index - 1], points[index], box))) return false;
  }
  return true;
}

export function segmentIntersectsRectangle(source, target, box) {
  const epsilon = .01;
  const left = box.x + epsilon; const right = box.x + box.width - epsilon;
  const top = box.y + epsilon; const bottom = box.y + box.height - epsilon;
  if (right <= left || bottom <= top) return false;
  let near = 0; let far = 1;
  const dx = target.x - source.x; const dy = target.y - source.y;
  for (const [p, q] of [[-dx, source.x - left], [dx, right - source.x], [-dy, source.y - top], [dy, bottom - source.y]]) {
    if (Math.abs(p) < 1e-9) {
      if (q < 0) return false;
      continue;
    }
    const ratio = q / p;
    if (p < 0) near = Math.max(near, ratio); else far = Math.min(far, ratio);
    if (near > far) return false;
  }
  return far >= 0 && near <= 1;
}

function routeScore(points, occupiedSegments = []) {
  let length = 0;
  for (let index = 1; index < points.length; index += 1) length += distance(points[index - 1], points[index]);
  const laneAffinity = points.laneAffinity ? CABLE_LANE_AFFINITY : 0;
  const bundleAffinity = points.bundleAffinity ? BUNDLE_LANE_AFFINITY + Math.min(1800, points.sharedLength * .8) : 0;
  return length + Math.max(0, points.length - 2) * 24 + routeConflictPenalty(points, occupiedSegments) - laneAffinity - bundleAffinity;
}

function polylineLength(points) {
  let length = 0;
  for (let index = 1; index < points.length; index += 1) length += distance(points[index - 1], points[index]);
  return length;
}

function routeConflictPenalty(points, occupiedSegments) {
  if (!occupiedSegments.length) return 0;
  let penalty = 0;
  for (let index = 1; index < points.length; index += 1) {
    const source = points[index - 1];
    const target = points[index];
    const lengthWeight = Math.max(1, Math.min(8, distance(source, target) / 80));
    for (const segment of occupiedSegments) {
      const clearance = segmentDistance(source, target, segment.source, segment.target);
      const angleSine = segmentAngleSine(source, target, segment.source, segment.target);
      if (angleSine < .16) {
        if (clearance < MIN_CABLE_CLEARANCE) {
          penalty += (MIN_CABLE_CLEARANCE - clearance + 1) ** 2 * 8 * lengthWeight;
        } else if (clearance < CABLE_LANE_SPACING) {
          penalty += (CABLE_LANE_SPACING - clearance) ** 2 * 8 * lengthWeight;
        }
        continue;
      }
      if (segmentsIntersect(source, target, segment.source, segment.target)) {
        penalty += CROSSING_PENALTY / Math.max(.32, angleSine);
      } else if (clearance < MIN_CABLE_CLEARANCE) {
        penalty += (MIN_CABLE_CLEARANCE - clearance) ** 2 * 18 * lengthWeight;
      }
    }
  }
  return penalty;
}

function segmentAngleSine(leftSource, leftTarget, rightSource, rightTarget) {
  const left = { x: leftTarget.x - leftSource.x, y: leftTarget.y - leftSource.y };
  const right = { x: rightTarget.x - rightSource.x, y: rightTarget.y - rightSource.y };
  const denominator = Math.hypot(left.x, left.y) * Math.hypot(right.x, right.y);
  return denominator ? Math.abs(left.x * right.y - left.y * right.x) / denominator : 0;
}

function segmentDistance(leftSource, leftTarget, rightSource, rightTarget) {
  if (segmentsIntersect(leftSource, leftTarget, rightSource, rightTarget)) return 0;
  return Math.min(
    distanceToSegment(leftSource, rightSource, rightTarget),
    distanceToSegment(leftTarget, rightSource, rightTarget),
    distanceToSegment(rightSource, leftSource, leftTarget),
    distanceToSegment(rightTarget, leftSource, leftTarget),
  );
}

function segmentsIntersect(leftSource, leftTarget, rightSource, rightTarget) {
  const cross = (origin, first, second) =>
    (first.x - origin.x) * (second.y - origin.y) - (first.y - origin.y) * (second.x - origin.x);
  const leftA = cross(leftSource, leftTarget, rightSource);
  const leftB = cross(leftSource, leftTarget, rightTarget);
  const rightA = cross(rightSource, rightTarget, leftSource);
  const rightB = cross(rightSource, rightTarget, leftTarget);
  const boundsOverlap = Math.max(Math.min(leftSource.x, leftTarget.x), Math.min(rightSource.x, rightTarget.x)) <=
      Math.min(Math.max(leftSource.x, leftTarget.x), Math.max(rightSource.x, rightTarget.x)) + .01 &&
    Math.max(Math.min(leftSource.y, leftTarget.y), Math.min(rightSource.y, rightTarget.y)) <=
      Math.min(Math.max(leftSource.y, leftTarget.y), Math.max(rightSource.y, rightTarget.y)) + .01;
  return boundsOverlap && leftA * leftB <= 0 && rightA * rightB <= 0;
}

function properSegmentIntersection(leftSource, leftTarget, rightSource, rightTarget) {
  const left = { x: leftTarget.x - leftSource.x, y: leftTarget.y - leftSource.y };
  const right = { x: rightTarget.x - rightSource.x, y: rightTarget.y - rightSource.y };
  const denominator = left.x * right.y - left.y * right.x;
  if (Math.abs(denominator) < 1e-7) return null;
  const offset = { x: rightSource.x - leftSource.x, y: rightSource.y - leftSource.y };
  const leftRatio = (offset.x * right.y - offset.y * right.x) / denominator;
  const rightRatio = (offset.x * left.y - offset.y * left.x) / denominator;
  const epsilon = 1e-6;
  if (leftRatio < -epsilon || leftRatio > 1 + epsilon || rightRatio < -epsilon || rightRatio > 1 + epsilon) return null;
  return {
    point: { x: leftSource.x + left.x * leftRatio, y: leftSource.y + left.y * leftRatio },
    angleSine: segmentAngleSine(leftSource, leftTarget, rightSource, rightTarget),
  };
}

function flattenRoute(route) {
  const points = [];
  let total = 0;
  for (const curve of routeSegments(route)) {
    const samples = Math.max(4, Math.ceil(approximateCurveLength(curve) / 7));
    for (let index = 0; index <= samples; index += 1) {
      if (points.length && index === 0) continue;
      const point = pointOnBezier(curve, index / samples);
      if (points.length) total += distance(points.at(-1), point);
      points.push({ x: point.x, y: point.y, distance: total });
    }
  }
  return points;
}

function routeVertices(route) {
  const segments = routeSegments(route);
  if (!segments.length) return [];
  return [segments[0].source, ...segments.map((segment) => segment.target)];
}

function polylineSegments(polyline) {
  const segments = [];
  for (let index = 1; index < polyline.length; index += 1) {
    segments.push({
      source: polyline[index - 1],
      target: polyline[index],
      startDistance: polyline[index - 1].distance,
      endDistance: polyline[index].distance,
    });
  }
  return segments;
}

function pointAtPolylineDistance(polyline, targetDistance) {
  if (!polyline.length) return { x: 0, y: 0 };
  const clamped = Math.max(0, Math.min(polyline.at(-1).distance, targetDistance));
  for (let index = 1; index < polyline.length; index += 1) {
    const start = polyline[index - 1];
    const end = polyline[index];
    if (clamped > end.distance) continue;
    const span = end.distance - start.distance;
    const ratio = span ? (clamped - start.distance) / span : 0;
    return { x: start.x + (end.x - start.x) * ratio, y: start.y + (end.y - start.y) * ratio };
  }
  return { x: polyline.at(-1).x, y: polyline.at(-1).y };
}

function appendPolylineRange(curves, polyline, startDistance, endDistance) {
  if (endDistance - startDistance <= .01) return;
  let cursor = pointAtPolylineDistance(polyline, startDistance);
  for (const point of polyline) {
    if (point.distance <= startDistance || point.distance >= endDistance) continue;
    pushLine(curves, cursor, point);
    cursor = point;
  }
  pushLine(curves, cursor, pointAtPolylineDistance(polyline, endDistance));
}

function stableBridgeSide(key) {
  const value = String(key || "bridge");
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = (hash * 31 + value.charCodeAt(index)) | 0;
  return hash & 1 ? 1 : -1;
}

function expandRectangle(bounds, amount) {
  return { x: bounds.x - amount, y: bounds.y - amount, width: bounds.width + amount * 2, height: bounds.height + amount * 2 };
}

function pointRectangleDistance(point, box) {
  const dx = Math.max(box.x - point.x, 0, point.x - (box.x + box.width));
  const dy = Math.max(box.y - point.y, 0, point.y - (box.y + box.height));
  return Math.hypot(dx, dy);
}

function containsPoint(bounds, point) {
  return point.x >= bounds.x && point.x <= bounds.x + bounds.width &&
    point.y >= bounds.y && point.y <= bounds.y + bounds.height;
}

function uniqueNumbers(values) {
  return [...new Set(values.map((value) => Math.round(value * 100) / 100))];
}

function collinear(first, middle, last) {
  return Math.abs((middle.x - first.x) * (last.y - middle.y) - (middle.y - first.y) * (last.x - middle.x)) < .01;
}

function moveToward(source, target, amount) {
  const total = distance(source, target);
  if (!total) return { ...source };
  return { x: source.x + (target.x - source.x) * amount / total, y: source.y + (target.y - source.y) * amount / total };
}

function distance(source, target) {
  return Math.hypot(target.x - source.x, target.y - source.y);
}

function approximateCurveLength(curve) {
  let length = 0; let previous = curve.source;
  for (let index = 1; index <= 12; index += 1) {
    const point = pointOnBezier(curve, index / 12);
    length += distance(previous, point); previous = point;
  }
  return length;
}
