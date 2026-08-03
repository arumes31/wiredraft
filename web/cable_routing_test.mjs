import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  distanceToRoute, obstacleAwareCableRoute, orderedCableLinks, pointOnRoute, routeSegments, routeWithCrossingBridges,
  segmentIntersectsRectangle,
} from "./static/js/cabling.js";
import { endpointRouteSegment, portDescriptionPlacement } from "./static/js/termination.js";

const source = { x: 150, y: 165 };
const target = { x: 650, y: 135 };
const sourceBounds = { x: 50, y: 100, width: 200, height: 100 };
const targetBounds = { x: 600, y: 100, width: 200, height: 100 };
const blocker = { x: 330, y: 40, width: 150, height: 230 };
const options = { sourceBounds, targetBounds, obstacles: [sourceBounds, targetBounds, blocker] };
const route = obstacleAwareCableRoute(source, target, options);

assert.deepEqual(route.source, source, "route must begin at the real source port");
assert.deepEqual(route.target, target, "route must end at the real target port");
assert.ok(route.segments.length >= 3, "an obstructed cable should use multiple route segments");
for (let index = 0; index <= 200; index += 1) {
  const point = pointOnRoute(route, index / 200);
  const insideBlocker = point.x > blocker.x - 11 && point.x < blocker.x + blocker.width + 11 &&
    point.y > blocker.y - 11 && point.y < blocker.y + blocker.height + 11;
  assert.equal(insideBlocker, false, `route entered the unrelated device near ${JSON.stringify(point)}`);
}
assert.deepEqual(obstacleAwareCableRoute(source, target, options), route, "route selection must be deterministic");
assert.ok(distanceToRoute(pointOnRoute(route, .5), route) < .5, "route hit testing should follow every segment");

const nearbySource = { x: source.x + 15, y: source.y };
const nearbyTarget = { x: target.x + 15, y: target.y };
const overlappingRoute = obstacleAwareCableRoute(nearbySource, nearbyTarget, options);
const separatedRoute = obstacleAwareCableRoute(nearbySource, nearbyTarget, { ...options, occupiedRoutes: [route] });
const averageClearance = (candidate) => {
  let total = 0;
  for (let index = 2; index < 19; index += 1) total += distanceToRoute(pointOnRoute(candidate, index / 20), route);
  return total / 17;
};
const laneClearance = averageClearance(separatedRoute);
assert.ok(laneClearance > averageClearance(overlappingRoute) + 4,
  "a later cable should leave enough separation to remain individually visible");
assert.ok(laneClearance < 16,
  "cables following the same corridor should use adjacent lanes instead of distant detours");

const groupedLinks = [{ id: "bundle-a" }, { id: "unrelated" }, { id: "bundle-b" }];
assert.deepEqual(
  orderedCableLinks({ links: groupedLinks, linkGroups: [{ id: "group-1", linkIds: ["bundle-a", "bundle-b"] }] }).map(({ id }) => id),
  ["bundle-a", "bundle-b", "unrelated"],
  "link-group members must be routed together before unrelated cables can claim their corridor",
);
const reverseBundleRoute = obstacleAwareCableRoute(
  { x: nearbyTarget.x, y: nearbyTarget.y },
  { x: nearbySource.x, y: nearbySource.y },
  {
    sourceBounds: targetBounds,
    targetBounds: sourceBounds,
    obstacles: [sourceBounds, targetBounds, blocker],
    occupiedRoutes: [route],
    preferredRoutes: [route],
  },
);
assert.ok(distanceToRoute(pointOnRoute(reverseBundleRoute, .1), route) <= 16,
  "a reversed bundle member should join its reference corridor immediately after leaving the source device");
assert.ok(distanceToRoute(pointOnRoute(reverseBundleRoute, .9), route) <= 16,
  "a bundle member should remain beside its reference until it must enter the target device");
const canvasSource = readFileSync(new URL("./static/js/canvas.js", import.meta.url), "utf8");
const exportSource = readFileSync(new URL("./static/js/export.js", import.meta.url), "utf8");
for (const [name, sourceText] of [["canvas", canvasSource], ["SVG export", exportSource]]) {
  assert.match(sourceText, /orderedCableLinks\(topology\)/, `${name} routing must process group members contiguously`);
  assert.match(sourceText, /preferredRoutes/, `${name} routing must pass the group's existing corridor to later members`);
}

const lineRoute = (start, end) => ({
  source: start,
  target: end,
  segments: [{
    source: start,
    cp1: { x: start.x + (end.x - start.x) / 3, y: start.y + (end.y - start.y) / 3 },
    cp2: { x: start.x + (end.x - start.x) * 2 / 3, y: start.y + (end.y - start.y) * 2 / 3 },
    target: end,
  }],
});
const horizontal = lineRoute({ x: 0, y: 50 }, { x: 100, y: 50 });
const vertical = lineRoute({ x: 50, y: 0 }, { x: 50, y: 100 });
const bridged = routeWithCrossingBridges(horizontal, [vertical], { key: "upper-cable" });
assert.equal(bridged.bridges.length, 1, "an unavoidable right-angle crossing should create one jump-over bridge");
assert.equal(bridged.bridges[0].underRouteIndex, 0, "a bridge must identify the cable that remains visible underneath");
assert.ok(bridged.bridges[0].openingRadius >= 5, "a bridge must reserve a visible opening for the underlying cable");
assert.deepEqual(bridged.source, horizontal.source, "a bridge must preserve the real source endpoint");
assert.deepEqual(bridged.target, horizontal.target, "a bridge must preserve the real target endpoint");
assert.ok(Math.hypot(bridged.bridges[0].apex.x - 50, bridged.bridges[0].apex.y - 50) >= 8,
  "the bridge apex should visibly lift away from the crossing");
assert.ok(distanceToRoute({ x: 50, y: 50 }, bridged) >= 4,
  "the bridged cable should no longer run through the underlying cable");
const parallel = lineRoute({ x: 0, y: 60 }, { x: 100, y: 60 });
assert.equal(routeWithCrossingBridges(horizontal, [parallel]), horizontal,
  "parallel adjacent lanes should not receive crossing bridges");

const sourceTermination = endpointRouteSegment(route, "source", sourceBounds);
const targetTermination = endpointRouteSegment(route, "target", targetBounds);
assert.deepEqual(sourceTermination.source, source);
assert.deepEqual(targetTermination.target, target);

const topPort = { x: 140, y: 128, width: 20, height: 14 };
const portInExitLane = { x: 140, y: 102, width: 20, height: 14 };
const portAwareRoute = obstacleAwareCableRoute({ x: 150, y: 135 }, target, {
  sourceBounds, targetBounds, obstacles: [sourceBounds, targetBounds, blocker],
  portObstacles: [topPort, portInExitLane],
});
const firstSegment = routeSegments(portAwareRoute)[0];
assert.equal(firstSegment.source.x, firstSegment.target.x,
  "the endpoint lead must leave the faceplate straight instead of bending sideways inside it");
assert.equal(firstSegment.cp1.x, firstSegment.source.x,
  "the source control point must preserve the port-normal faceplate exit");
assert.equal(firstSegment.cp2.x, firstSegment.source.x,
  "the outer control point must preserve the port-normal faceplate exit");
assert.ok(firstSegment.target.y > sourceBounds.y + sourceBounds.height,
  "an occupied nearest exit should use the clear opposite faceplate edge without a lateral detour");
assert.equal(segmentIntersectsRectangle(firstSegment.source, firstSegment.target, portInExitLane), false,
  "the straight endpoint lead should choose a faceplate edge that avoids unrelated ports");

const clearTopRoute = obstacleAwareCableRoute({ x: 180, y: 125 }, target, {
  sourceBounds, targetBounds, obstacles: [sourceBounds, targetBounds, blocker], portObstacles: [],
});
const clearTopLead = routeSegments(clearTopRoute)[0];
assert.equal(clearTopLead.source.x, clearTopLead.target.x,
  "a clear top-row port must leave directly above its faceplate position");
assert.ok(clearTopLead.target.y < sourceBounds.y,
  "a clear top-row port should use the nearest faceplate edge");
const clearTargetLead = routeSegments(clearTopRoute).at(-1);
assert.equal(clearTargetLead.source.x, clearTargetLead.target.x,
  "the target lead must enter the faceplate straight above its exact port position");
assert.equal(clearTargetLead.cp1.x, clearTargetLead.target.x,
  "the target outer control point must preserve the port-normal faceplate entry");
assert.equal(clearTargetLead.cp2.x, clearTargetLead.target.x,
  "the target control point must preserve the port-normal faceplate entry");

const upperPort = { port: { label: "WAN1" }, x: 100, y: 118, width: 18, height: 14, centerX: 109, centerY: 125 };
const lowerPort = { port: { label: "ethernet1/12" }, x: 100, y: 168, width: 18, height: 14, centerX: 109, centerY: 175 };
assert.equal(portDescriptionPlacement(upperPort, sourceBounds).side, "above");
assert.equal(portDescriptionPlacement(lowerPort, sourceBounds).side, "below");
assert.ok(portDescriptionPlacement(lowerPort, sourceBounds).fontSize < portDescriptionPlacement(upperPort, sourceBounds).fontSize);

console.log("obstacle-aware cable routing checks passed");
