import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  assignCableTracks, cableDashPattern, CableRoutingPlane, CABLE_JUMPER_RADIUS, cableRole, CABLE_TRACK_SPACING,
  FACEPLATE_MICRO_LANE_SPACING, distanceToRoute, orderedCableLinks, pointOnRoute,
  routeFromPoints, routeSegments, routesWithCrossingBridges, routeWithCrossingBridges, segmentIntersectsRectangle,
  TRUNK_BUNDLE_LANE_SPACING,
} from "./static/js/cabling.js";
import { endpointRouteSegment, portDescriptionPlacement } from "./static/js/termination.js";

const rack = (id, x) => ({ rack: { id, name: id.toUpperCase(), positionX: x }, x, y: 0, width: 750, height: 1000 });
const device = (id, rackBox, y, category = "Switch") => ({
  device: { id, name: id.toUpperCase(), rackId: rackBox?.rack.id || "", category, ports: [] },
  rack: rackBox?.rack || null,
  x: (rackBox?.x || 0) + 30,
  y,
  width: 690,
  height: 100,
});
const port = (deviceBox, id, x, y, label = id, speedMbps = 10000, group = "access") => {
  const box = {
    port: { id, label, speedMbps, group, type: "RJ45_10G" },
    device: deviceBox.device,
    x: x - 9,
    y: y - 7,
    width: 18,
    height: 14,
    centerX: x,
    centerY: y,
  };
  deviceBox.device.ports.push(box.port);
  return box;
};
const link = (id, source, target) => ({
  id,
  sourcePortId: source.port.id,
  targetPortId: target.port.id,
  cableType: "CAT6A",
  primaryVlan: 1,
  vlanIds: [1],
});

const rackA = rack("rack-a", 0);
const rackB = rack("rack-b", 900);
const sourceDevice = device("source", rackA, 100);
const sameRackDevice = device("same-rack", rackA, 500);
const crossRackDevice = device("cross-rack", rackB, 300);
const deviceBoxes = [sourceDevice, sameRackDevice, crossRackDevice];
const portBoxes = [];
const sameRackLinks = [];
const crossRackLinks = [];
for (let index = 0; index < 3; index += 1) {
  const sourcePort = port(sourceDevice, `source-same-${index}`, 600 - index * 35, 130 + index * 4);
  const targetPort = port(sameRackDevice, `target-same-${index}`, 610 - index * 35, 530 + index * 4);
  portBoxes.push(sourcePort, targetPort);
  sameRackLinks.push(link(`same-${index}`, sourcePort, targetPort));
}
for (let index = 0; index < 2; index += 1) {
  const sourcePort = port(sourceDevice, `source-cross-${index}`, 470 - index * 35, 170 - index * 4, `QSFP${index + 1}`, 50000, "uplink");
  const targetPort = port(crossRackDevice, `target-cross-${index}`, 1000 + index * 35, 330 + index * 4, `QSFP${index + 1}`, 50000, "uplink");
  portBoxes.push(sourcePort, targetPort);
  crossRackLinks.push(link(`cross-${index}`, sourcePort, targetPort));
}
const links = [...sameRackLinks, ...crossRackLinks];
const tracks = assignCableTracks({ links, portBoxes, deviceBoxes, rackBoxes: [rackA, rackB] });

assert.equal(tracks.size, links.length);
for (const track of tracks.values()) {
  assert.deepEqual(track.source, routeSegments(track)[0].source, "track must begin at the physical source port");
  assert.deepEqual(track.target, routeSegments(track).at(-1).target, "track must end at the physical target port");
  for (const segment of routeSegments(track)) {
    assert.ok(segment.source.x === segment.target.x || segment.source.y === segment.target.y,
      `every cable segment must be orthogonal: ${JSON.stringify(segment)}`);
  }
  const first = routeSegments(track)[0];
  const last = routeSegments(track).at(-1);
  assert.equal(first.source.y, first.target.y, "the source cable must turn horizontally at the connector without an outer stub");
  assert.equal(last.source.y, last.target.y, "the target cable must enter horizontally at the connector without an outer stub");
  assert.ok(distanceToRoute(pointOnRoute(track, .5), track) < .001, "hit testing must follow the complete orthogonal route");
}

const sameTracks = sameRackLinks.map(({ id }) => tracks.get(id));
assert.deepEqual(sameTracks.map(({ bundleIndex }) => bundleIndex), [0, 1, 2], "device-pair members need stable bundle indices");
assert.equal(new Set(sameTracks.map(({ bundleKey }) => bundleKey)).size, 1, "same device pairs must form one trunk bundle");
assert.deepEqual(sameTracks.map(({ trackOffset }) => trackOffset), [0, CABLE_TRACK_SPACING, CABLE_TRACK_SPACING * 2]);
assert.equal(sameTracks.every(({ routeKind }) => routeKind === "intra-rack"), true);
assert.equal(sameTracks.every(({ gutterX }) => gutterX > rackA.x + rackA.width), true,
  "same-rack vertical travel must stay outside the rack frame");
const gutterXs = sameTracks.map(({ gutterX }) => gutterX).sort((a, b) => a - b);
assert.deepEqual(gutterXs.slice(1).map((x, index) => x - gutterXs[index]), [CABLE_TRACK_SPACING, CABLE_TRACK_SPACING]);
assert.equal(new Set(sameTracks.map(({ sourceMicroLaneY }) => sourceMicroLaneY)).size, sameTracks.length);
const sourceMicroYs = sameTracks.map(({ sourceMicroLaneY }) => sourceMicroLaneY).sort((left, right) => left - right);
assert.deepEqual(sourceMicroYs.slice(1).map((value, index) => value - sourceMicroYs[index]),
  [FACEPLATE_MICRO_LANE_SPACING, FACEPLATE_MICRO_LANE_SPACING],
  "normal faceplate tracks need the full 8px micro-lane pitch");
assert.equal(sameTracks.every(({ sourceMicroLaneY }) =>
  sourceMicroLaneY >= sourceDevice.y && sourceMicroLaneY <= sourceDevice.y + sourceDevice.height), true,
"source faceplate travel must remain inside the host device height");

const crossTracks = crossRackLinks.map(({ id }) => tracks.get(id));
assert.equal(crossTracks.every(({ routeKind }) => routeKind === "inter-rack"), true);
assert.equal(crossTracks.every(({ gutterX }) => gutterX > rackA.x + rackA.width && gutterX < rackB.x), true,
  "cross-rack channels must stay inside the gap between racks");
assert.equal(Math.abs(crossTracks[1].gutterX - crossTracks[0].gutterX), CABLE_TRACK_SPACING,
  "cross-rack bundle lanes need the fixed track pitch");

const explicitTrunkTracks = assignCableTracks({
  links: sameRackLinks,
  portBoxes,
  deviceBoxes,
  rackBoxes: [rackA, rackB],
  linkGroups: [{ id: "tight-trunk", mode: "LACP", linkIds: sameRackLinks.map(({ id }) => id) }],
});
const trunkTracks = sameRackLinks.map(({ id }) => explicitTrunkTracks.get(id));
assert.equal(trunkTracks.every(({ tightBundle, linkGroupId }) => tightBundle && linkGroupId === "tight-trunk"), true,
  "explicit trunk members must be planned as one physical multi-lane bundle");
assert.deepEqual(trunkTracks.map(({ trackOffset }) => trackOffset),
  [0, TRUNK_BUNDLE_LANE_SPACING, TRUNK_BUNDLE_LANE_SPACING * 2],
  "every trunk member needs its own stable 3–5px offset");
const trunkGutterXs = trunkTracks.map(({ gutterX }) => gutterX).sort((left, right) => left - right);
assert.deepEqual(trunkGutterXs.slice(1).map((value, index) => value - trunkGutterXs[index]),
  [TRUNK_BUNDLE_LANE_SPACING, TRUNK_BUNDLE_LANE_SPACING],
  "trunk vertical lanes must run tightly side-by-side without merging");
const trunkSourceYs = trunkTracks.map(({ sourceMicroLaneY }) => sourceMicroLaneY).sort((left, right) => left - right);
assert.deepEqual(trunkSourceYs.slice(1).map((value, index) => value - trunkSourceYs[index]),
  [TRUNK_BUNDLE_LANE_SPACING, TRUNK_BUNDLE_LANE_SPACING],
  "fan-out must retain one faceplate micro-lane per physical member");
for (let leftIndex = 0; leftIndex < trunkTracks.length; leftIndex += 1) {
  for (let rightIndex = leftIndex + 1; rightIndex < trunkTracks.length; rightIndex += 1) {
    for (const leftSegment of routeSegments(trunkTracks[leftIndex])) {
      for (const rightSegment of routeSegments(trunkTracks[rightIndex])) {
        assert.equal(collinearOverlap(leftSegment, rightSegment), false,
          "parallel trunk members must never share a physical routed span");
      }
    }
  }
}

const splitTargetDevice = device("split-target", rackA, 720);
const splitSourceOne = port(sourceDevice, "split-source-1", 515, 128);
const splitSourceTwo = port(sourceDevice, "split-source-2", 480, 132);
const splitTargetOne = port(sameRackDevice, "split-target-1", 520, 528);
const splitTargetTwo = port(splitTargetDevice, "split-target-2", 525, 748);
const splitLinks = [
  link("split-1", splitSourceOne, splitTargetOne),
  link("split-2", splitSourceTwo, splitTargetTwo),
];
const splitTracks = assignCableTracks({
  links: splitLinks,
  portBoxes: [splitSourceOne, splitSourceTwo, splitTargetOne, splitTargetTwo],
  deviceBoxes: [sourceDevice, sameRackDevice, splitTargetDevice],
  rackBoxes: [rackA],
  linkGroups: [{ id: "split-mclag", mode: "MCLAG", linkIds: splitLinks.map(({ id }) => id) }],
});
const splitTrackList = splitLinks.map(({ id }) => splitTracks.get(id));
assert.equal(Math.abs(splitTrackList[1].gutterX - splitTrackList[0].gutterX), TRUNK_BUNDLE_LANE_SPACING,
  "split groups spanning different peer devices must retain adjacent dedicated gutter lanes");
assert.equal(new Set(splitTrackList.map(({ sourceMicroLaneY }) => sourceMicroLaneY)).size, 2,
  "split members must fan out from independent source faceplate micro-lanes");
for (const track of splitTrackList) assert.equal(routeSegments(track).every((segment) =>
  segment.source.x === segment.target.x || segment.source.y === segment.target.y), true,
"split member routes must stay strictly orthogonal through their individual fan-out");

for (const track of tracks.values()) {
  for (const segment of routeSegments(track)) {
    if (segment.source.x !== segment.target.x) continue;
    for (const blocker of deviceBoxes) {
      const isEndpointDevice = blocker.device.id === track.bundleKey.split("::")[0] || blocker.device.id === track.bundleKey.split("::")[1];
      if (!isEndpointDevice) assert.equal(segmentIntersectsRectangle(segment.source, segment.target, blocker), false,
        "vertical gutter traversal must not cross an intermediate device");
    }
  }
}

const denseSource = device("dense-source", rackA, 700);
const denseTarget = device("dense-target", rackA, 850);
const densePorts = [];
const denseLinks = [];
for (let index = 0; index < 48; index += 1) {
  const rowY = index % 2 === 0 ? denseSource.y + 30 : denseSource.y + 70;
  const targetY = index % 2 === 0 ? denseTarget.y + 30 : denseTarget.y + 70;
  const sourcePort = port(denseSource, `dense-source-${index}`, denseSource.x + 175 + Math.floor(index / 2) * 20, rowY);
  const targetPort = port(denseTarget, `dense-target-${index}`, denseTarget.x + 175 + Math.floor(index / 2) * 20, targetY);
  densePorts.push(sourcePort, targetPort);
  denseLinks.push(link(`dense-${index}`, sourcePort, targetPort));
}
const denseTracks = assignCableTracks({
  links: denseLinks,
  portBoxes: densePorts,
  deviceBoxes: [denseSource, denseTarget],
  rackBoxes: [rackA],
});
assert.equal(denseTracks.size, 48, "a fully populated 48-port switch must receive one route per cable");
assert.equal(new Set([...denseTracks.values()].map(({ sourceSide, sourceMicroLaneY }) => `${sourceSide}:${sourceMicroLaneY}`)).size, 48,
  "high-density source micro-lanes must remain individually addressable");
assert.equal([...denseTracks.values()].every(({ sourceRow, sourceMicroLaneY }) => sourceRow === "top"
  ? sourceMicroLaneY < denseSource.y + denseSource.height / 2
  : sourceMicroLaneY > denseSource.y + denseSource.height / 2), true,
"top and bottom port rows must retain separate faceplate routing bands at 48-port density");
assert.equal([...denseTracks.values()].every((track) => routeSegments(track).every((segment) =>
  segment.source.x === segment.target.x || segment.source.y === segment.target.y)), true);
const denseTrackList = [...denseTracks.values()];
for (let leftIndex = 0; leftIndex < denseTrackList.length; leftIndex += 1) {
  for (let rightIndex = leftIndex + 1; rightIndex < denseTrackList.length; rightIndex += 1) {
    for (const leftSegment of routeSegments(denseTrackList[leftIndex])) {
      for (const rightSegment of routeSegments(denseTrackList[rightIndex])) {
        assert.equal(collinearOverlap(leftSegment, rightSegment), false,
          `dense tracks ${leftIndex} and ${rightIndex} must not share an exact routed span`);
      }
    }
  }
}

const groupedLinks = [{ id: "bundle-a" }, { id: "unrelated" }, { id: "bundle-b" }];
assert.deepEqual(
  orderedCableLinks({ links: groupedLinks, linkGroups: [{ id: "group-1", linkIds: ["bundle-a", "bundle-b"] }] }).map(({ id }) => id),
  ["bundle-a", "bundle-b", "unrelated"],
);

const panelSource = device("panel-source", rackA, 240, "PatchPanel");
const panelTarget = device("panel-target", rackA, 640, "PatchPanel");
const frontSourcePort = port(panelSource, "panel-source-front", 90, 270);
const frontTargetPort = port(panelTarget, "panel-target-front", 100, 670);
const rearSourcePort = port(panelSource, "panel-source-rear", 120, 290);
const rearTargetPort = port(panelTarget, "panel-target-rear", 130, 690);
const frontPanelLink = link("panel-front", frontSourcePort, frontTargetPort);
const rearPanelLink = {
  ...link("panel-rear", rearSourcePort, rearTargetPort),
  sourceSide: "rear",
  targetSide: "rear",
};
const segregatedTracks = assignCableTracks({
  links: [frontPanelLink, rearPanelLink],
  portBoxes: [frontSourcePort, frontTargetPort, rearSourcePort, rearTargetPort],
  deviceBoxes: [panelSource, panelTarget],
  rackBoxes: [rackA],
});
const frontPanelTrack = segregatedTracks.get(frontPanelLink.id);
const rearPanelTrack = segregatedTracks.get(rearPanelLink.id);
assert.equal(frontPanelTrack.routingPlane, CableRoutingPlane.FRONT);
assert.equal(rearPanelTrack.routingPlane, CableRoutingPlane.REAR);
assert.notEqual(frontPanelTrack.bundleKey, rearPanelTrack.bundleKey,
  "front and rear runs between the same devices must be separate bundles");
assert.equal(frontPanelTrack.sourceSide, "left");
assert.equal(rearPanelTrack.sourceSide, "left", "rear patch-panel exits must face the outer rack edge");
assert.ok(rearPanelTrack.gutterX < frontPanelTrack.gutterX,
  "the backend lane bank must be farther outside the rack than every primary lane");
assert.ok(Math.abs(rearPanelTrack.gutterX - frontPanelTrack.gutterX) >= CABLE_TRACK_SPACING * 3,
  "the dedicated backend bank must include a channel gap beyond the reserved front range");
assert.deepEqual(
  orderedCableLinks({ links: [frontPanelLink, rearPanelLink], linkGroups: [] }).map(({ id }) => id),
  [rearPanelLink.id, frontPanelLink.id],
  "rear links must be painted before the solid front layer",
);

const rackC = rack("rack-c", 1800);
const multiRearSource = device("multi-rear-source", rackA, 760, "PatchPanel");
const multiRearTargetB = device("multi-rear-target-b", rackB, 760, "PatchPanel");
const multiRearTargetC = device("multi-rear-target-c", rackC, 760, "PatchPanel");
const multiRearSourceOne = port(multiRearSource, "multi-rear-source-1", 110, 790);
const multiRearSourceTwo = port(multiRearSource, "multi-rear-source-2", 140, 810);
const multiRearTargetOne = port(multiRearTargetB, "multi-rear-target-1", 1000, 790);
const multiRearTargetTwo = port(multiRearTargetC, "multi-rear-target-2", 1900, 810);
const multiRearLinks = [
  { ...link("multi-rear-ab", multiRearSourceOne, multiRearTargetOne), sourceSide: "rear", targetSide: "rear" },
  { ...link("multi-rear-ac", multiRearSourceTwo, multiRearTargetTwo), sourceSide: "rear", targetSide: "rear" },
];
const multiRearTracks = assignCableTracks({
  links: multiRearLinks,
  portBoxes: [multiRearSourceOne, multiRearSourceTwo, multiRearTargetOne, multiRearTargetTwo],
  deviceBoxes: [multiRearSource, multiRearTargetB, multiRearTargetC],
  rackBoxes: [rackA, rackB, rackC],
});
assert.equal(new Set(multiRearLinks.map(({ id }) => multiRearTracks.get(id).sourceGutterX)).size, 2,
  "backend routes from one rack to different rack pairs must keep unique vertical X tracks");

const horizontal = routeFromPoints([{ x: 0, y: 50 }, { x: 100, y: 50 }]);
const vertical = routeFromPoints([{ x: 50, y: 0 }, { x: 50, y: 100 }]);
const bridged = routeWithCrossingBridges(horizontal, [vertical]);
assert.equal(bridged.bridges.length, 1, "right-angle crossings should create jumper metadata");
assert.equal(bridged.bridges[0].jumperArc, true);
assert.equal(bridged.bridges[0].radius, CABLE_JUMPER_RADIUS, "the jumper bow needs a compact 5px radius");
assert.deepEqual(bridged.bridges[0].apex, { x: 50, y: 50 - CABLE_JUMPER_RADIUS });
assert.deepEqual(bridged.points, horizontal.points, "a bridge must preserve the reserved Manhattan track geometry");
const [verticalFirst, horizontalSecond] = routesWithCrossingBridges([vertical, horizontal]);
assert.equal(verticalFirst.bridges.length, 0, "vertical tracks must never own a jumper bow");
assert.equal(horizontalSecond.bridges.length, 1, "horizontal tracks must own the bow even when routed later");
assert.equal(horizontalSecond.bridges[0].underRouteIndex, 0);
const rearHorizontal = routeFromPoints([{ x: 0, y: 70 }, { x: 100, y: 70 }], { routingPlane: CableRoutingPlane.REAR });
const frontVertical = routeFromPoints([{ x: 50, y: 20 }, { x: 50, y: 120 }], { routingPlane: CableRoutingPlane.FRONT });
const [rearUnderFront, frontOverRear] = routesWithCrossingBridges([rearHorizontal, frontVertical]);
assert.equal(rearUnderFront.bridges.length, 0, "backend/dashed routes must never own jumper bows");
assert.equal(frontOverRear.bridges.length, 0, "a solid vertical route stays above by layer order without inventing a vertical bow");
const rearVertical = routeFromPoints([{ x: 60, y: 20 }, { x: 60, y: 120 }], { routingPlane: CableRoutingPlane.REAR });
const frontHorizontal = routeFromPoints([{ x: 0, y: 80 }, { x: 100, y: 80 }], { routingPlane: CableRoutingPlane.FRONT });
const [, frontJumper] = routesWithCrossingBridges([rearVertical, frontHorizontal]);
assert.equal(frontJumper.bridges.length, 1, "a solid horizontal route must jump over a backend vertical track");
assert.equal(frontJumper.bridges[0].underRouteIndex, 0);

const managementRole = cableRole({}, { label: "MGMT", speedMbps: 1000 }, { label: "1", speedMbps: 1000 });
assert.equal(managementRole.color, "#f0b35a");
const interRackRole = cableRole({}, { label: "49", speedMbps: 50000 }, { label: "49", speedMbps: 50000 }, { crossRack: true });
assert.equal(interRackRole.color, "#3de5e5");
const accessRole = cableRole({}, { label: "1", speedMbps: 1000 }, { label: "2", speedMbps: 1000 });
assert.equal(accessRole.color, "#4e9cf5");
assert.deepEqual(cableDashPattern({ id: "mgmt" }, { label: "MGMT" }, { label: "1" }, { role: managementRole }), [4, 4],
  "management links should remain identifiable without color");
assert.deepEqual(cableDashPattern({ id: "backup" }, { label: "1" }, { label: "2" }, {
  role: accessRole, group: { mode: "Failover", primaryLinkId: "primary" },
}), [10, 5], "backup links should use a separate documentation dash pattern");

const sourceTermination = endpointRouteSegment(sameTracks[0], "source", sourceDevice);
const targetTermination = endpointRouteSegment(sameTracks[0], "target", sameRackDevice);
assert.deepEqual(sourceTermination.source, sameTracks[0].source);
assert.deepEqual(targetTermination.target, sameTracks[0].target);

const upperPort = { port: { label: "WAN1" }, x: 100, y: 118, width: 18, height: 14, centerX: 109, centerY: 125 };
const lowerPort = { port: { label: "ethernet1/12" }, x: 100, y: 168, width: 18, height: 14, centerX: 109, centerY: 175 };
const bounds = { x: 50, y: 100, width: 200, height: 100 };
assert.equal(portDescriptionPlacement(upperPort, bounds).side, "above");
assert.equal(portDescriptionPlacement(lowerPort, bounds).side, "below");
assert.ok(portDescriptionPlacement(lowerPort, bounds).fontSize < portDescriptionPlacement(upperPort, bounds).fontSize);

const canvasSource = readFileSync(new URL("./static/js/canvas.js", import.meta.url), "utf8");
const exportSource = readFileSync(new URL("./static/js/export.js", import.meta.url), "utf8");
assert.match(canvasSource, /assignCableTracks\(\{/);
assert.match(canvasSource, /ctx\.lineTo\(segment\.target\.x, segment\.target\.y\)/);
assert.match(exportSource, /`H\$\{segment\.target\.x\}`/);
assert.match(exportSource, /`V\$\{segment\.target\.y\}`/);
assert.doesNotMatch(canvasSource, /drawLinkGroupGuides|drawGroupMemberMarker/,
  "the canvas must not draw synthetic group spines or gutter junction nodes");
assert.match(canvasSource, /drawLinkGroupPortBadges/,
  "group state markers must be owned by the physical port overlay");

console.log("individual-track orthogonal cable routing checks passed");

function collinearOverlap(left, right) {
  const leftHorizontal = left.source.y === left.target.y;
  const rightHorizontal = right.source.y === right.target.y;
  if (leftHorizontal && rightHorizontal && left.source.y === right.source.y) {
    return overlapLength(left.source.x, left.target.x, right.source.x, right.target.x) > .01;
  }
  const leftVertical = left.source.x === left.target.x;
  const rightVertical = right.source.x === right.target.x;
  if (leftVertical && rightVertical && left.source.x === right.source.x) {
    return overlapLength(left.source.y, left.target.y, right.source.y, right.target.y) > .01;
  }
  return false;
}

function overlapLength(leftStart, leftEnd, rightStart, rightEnd) {
  return Math.min(Math.max(leftStart, leftEnd), Math.max(rightStart, rightEnd)) -
    Math.max(Math.min(leftStart, leftEnd), Math.min(rightStart, rightEnd));
}
