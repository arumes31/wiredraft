import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  assignCableTracks, BACKEND_CHANNEL_GAP, BACKEND_DISCRETE_STRAND_SPACING, BACKEND_TUBE_STRAND_SPACING,
  cableDashPattern, CableRoutingPlane, CABLE_JUMPER_RADIUS, cableRole, CABLE_TRACK_SPACING,
  FACEPLATE_MICRO_LANE_SPACING, distanceToRoute, orderedCableLinks, pointOnRoute,
  routeFromPoints, routeSegments, routesWithCrossingBridges, routeWithCrossingBridges, segmentIntersectsRectangle,
  TRUNK_BUNDLE_LANE_SPACING, VERTICAL_TRACK_MIN_GAP,
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

const expandedRack = { id: "expanded-rack", name: "EXPANDED RACK", positionX: 0 };
const expandedFront = {
  rack: expandedRack, face: "front", routingKey: "expanded-rack:front",
  x: 0, y: 0, width: 750, height: 1000,
};
const expandedRear = {
  rack: expandedRack, face: "rear", routingKey: "expanded-rack:rear",
  x: 840, y: 0, width: 750, height: 1000,
};
const expandedPeerRack = rack("expanded-peer", 1800);
expandedPeerRack.face = "front";
expandedPeerRack.routingKey = "expanded-peer:front";
const expandedSource = device("expanded-source", expandedFront, 300);
expandedSource.device.rackFace = "front";
const expandedTarget = device("expanded-target", expandedPeerRack, 400);
expandedTarget.device.rackFace = "front";
const expandedSourcePort = port(expandedSource, "expanded-source-port", 650, 340);
const expandedTargetPort = port(expandedTarget, "expanded-target-port", 1840, 440);
const expandedLink = link("expanded-front-link", expandedSourcePort, expandedTargetPort);
const expandedTrack = assignCableTracks({
  links: [expandedLink],
  portBoxes: [expandedSourcePort, expandedTargetPort],
  deviceBoxes: [expandedSource, expandedTarget],
  rackBoxes: [expandedFront, expandedRear, expandedPeerRack],
}).get(expandedLink.id);
assert.ok(expandedTrack.sourceGutterX < expandedRear.x,
  "a front-face cable must leave through the front face gutter before the adjacent rear face");
const rearFaceInterior = {
  x: expandedRear.x + 1,
  y: expandedRear.y + 1,
  width: expandedRear.width - 2,
  height: expandedRear.height - 2,
};
for (const segment of routeSegments(expandedTrack)) {
  assert.equal(segmentIntersectsRectangle(segment.source, segment.target, rearFaceInterior), false,
    "a front-face cable must not cross the expanded rear faceplate");
}

const trunkAndNormalTracks = assignCableTracks({
  links,
  portBoxes,
  deviceBoxes,
  rackBoxes: [rackA, rackB],
  linkGroups: [{ id: "cross-rack-trunk", mode: "LACP", linkIds: crossRackLinks.map(({ id }) => id) }],
});
const sharedRightRackEdgeTracks = links.map(({ id }) => trunkAndNormalTracks.get(id));
assert.equal(crossRackLinks.every(({ id }) => trunkAndNormalTracks.get(id).tightBundle), true,
  "the regression fixture must route the cross-rack members as a trunk");
for (let leftIndex = 0; leftIndex < sharedRightRackEdgeTracks.length; leftIndex += 1) {
  for (let rightIndex = leftIndex + 1; rightIndex < sharedRightRackEdgeTracks.length; rightIndex += 1) {
    assert.ok(
      Math.abs(sharedRightRackEdgeTracks[leftIndex].gutterX - sharedRightRackEdgeTracks[rightIndex].gutterX) >=
        VERTICAL_TRACK_MIN_GAP,
      "same-rack cables and cross-rack trunks must keep separate vertical lanes at a shared rack edge",
    );
  }
}

const spanRack = rack("span-rack", 1900);
const spanSourceDevice = device("span-source", spanRack, 100);
const spanShortTarget = device("span-short-target", spanRack, 330);
const spanMediumTarget = device("span-medium-target", spanRack, 600);
const spanLongTarget = device("span-long-target", spanRack, 900);
const spanSourcePorts = [
  port(spanSourceDevice, "span-source-long", spanRack.x + 620, 130),
  port(spanSourceDevice, "span-source-short", spanRack.x + 585, 134),
  port(spanSourceDevice, "span-source-medium", spanRack.x + 550, 138),
];
const spanTargetPorts = [
  port(spanLongTarget, "span-target-long", spanRack.x + 620, 930),
  port(spanShortTarget, "span-target-short", spanRack.x + 620, 360),
  port(spanMediumTarget, "span-target-medium", spanRack.x + 620, 630),
];
const spanLinks = [
  link("span-long", spanSourcePorts[0], spanTargetPorts[0]),
  link("span-short", spanSourcePorts[1], spanTargetPorts[1]),
  link("span-medium", spanSourcePorts[2], spanTargetPorts[2]),
];
const spanTracks = assignCableTracks({
  links: spanLinks,
  portBoxes: [...spanSourcePorts, ...spanTargetPorts],
  deviceBoxes: [spanSourceDevice, spanShortTarget, spanMediumTarget, spanLongTarget],
  rackBoxes: [spanRack],
});
const [longSpanTrack, shortSpanTrack, mediumSpanTrack] = spanLinks.map(({ id }) => spanTracks.get(id));
assert.deepEqual(
  [shortSpanTrack, mediumSpanTrack, longSpanTrack].map(({ spineLaneIndex }) => spineLaneIndex),
  [0, 1, 2],
  "span sorting must allocate the shortest shared-spine link to the innermost lane",
);
assert.ok(shortSpanTrack.gutterX < mediumSpanTrack.gutterX && mediumSpanTrack.gutterX < longSpanTrack.gutterX,
  "right-side shared spines must expand away from the rack as vertical spans grow");
assert.deepEqual(
  [shortSpanTrack, mediumSpanTrack, longSpanTrack].map(({ verticalSpan }) => verticalSpan),
  [226, 492, 800],
  "routes must retain their measured source-to-target vertical span for diagnostics",
);

const mixedRack = rack("mixed-span-rack", 2800);
const mixedSource = device("mixed-span-source", mixedRack, 100);
const mixedTargets = [
  device("mixed-span-short", mixedRack, 320),
  device("mixed-span-medium", mixedRack, 560),
  device("mixed-span-long", mixedRack, 860),
];
const mixedSources = [0, 1, 2].map((index) =>
  port(mixedSource, `mixed-source-${index}`, mixedRack.x + 620 - index * 30, 130 + index * 4));
const mixedTargetPorts = mixedTargets.map((target, index) =>
  port(target, `mixed-target-${index}`, mixedRack.x + 620, target.y + 30));
const mixedLinks = mixedSources.map((source, index) => link(`mixed-${index}`, source, mixedTargetPorts[index]));
const mixedTracks = assignCableTracks({
  links: [mixedLinks[2], mixedLinks[1], mixedLinks[0]],
  portBoxes: [...mixedSources, ...mixedTargetPorts],
  deviceBoxes: [mixedSource, ...mixedTargets],
  rackBoxes: [mixedRack],
  linkGroups: [{ id: "mixed-tight-group", mode: "LACP", linkIds: [mixedLinks[0].id, mixedLinks[2].id] }],
});
const mixedGutters = mixedLinks.map(({ id }) => mixedTracks.get(id).gutterX);
assert.deepEqual(mixedGutters.slice(1).map((gutterX, index) => gutterX - mixedGutters[index]), [9, 9],
  "mixed 5px and 9px lane pitches must reserve non-overlapping physical offsets in span order");
assert.deepEqual(mixedLinks.map(({ id }) => mixedTracks.get(id).spineLaneIndex), [0, 1, 2]);

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
  "every trunk member needs its own stable 4–5px offset");
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
assert.equal(rearPanelTrack.targetSide, "right", "same-rack rear runs must descend through a separate destination breakout");
assert.equal(rearPanelTrack.routeKind, "rear-intra-rack-overhead");
assert.ok(rearPanelTrack.bridgeY < rackA.y, "same-rack rear mappings must also use the overhead corridor");
assert.ok(rearPanelTrack.sourceGutterX < rackA.x && rearPanelTrack.targetGutterX > rackA.x + rackA.width,
  "same-rack rear mappings must keep all vertical travel in the two outer gutters");
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

const channelSource = device("channel-source", rackA, 420, "PatchPanel");
const channelTarget = device("channel-target", rackB, 620, "PatchPanel");
const channelPorts = [];
const channelLinks = [];
for (let index = 0; index < 12; index += 1) {
  const sourcePort = port(channelSource, `channel-source-${index + 1}`, 90 + index * 24, 450, String(index + 1));
  const targetPort = port(channelTarget, `channel-target-${index + 1}`, 990 + index * 24, 650, String(index + 1));
  sourcePort.port.portIndex = index + 1;
  targetPort.port.portIndex = index + 1;
  channelPorts.push(sourcePort, targetPort);
  channelLinks.push({
    ...link(`channel-link-${index + 1}`, sourcePort, targetPort),
    sourceSide: "rear",
    targetSide: "rear",
    cableType: index < 8 ? "FIBER" : "CAT6A",
    rearChannelId: `channel-${Math.floor(index / 4) + 1}`,
    rearChannelName: index < 4 ? "TUBE 1–4" : index < 8 ? "TUBE 5–8" : "BUNDLE 9–12",
    rearChannelType: index < 8 ? "tube" : "discrete",
  });
}
const channelTracks = assignCableTracks({
  links: channelLinks,
  portBoxes: channelPorts,
  deviceBoxes: [channelSource, channelTarget],
  rackBoxes: [rackA, rackB],
});
const channelTrackList = channelLinks.map(({ id }) => channelTracks.get(id));
assert.equal(new Set(channelTrackList.map(({ rearCorridorKey }) => rearCorridorKey)).size, 1,
  "one source/target panel pair must own one consolidated overhead corridor");
assert.deepEqual(channelTrackList.map(({ rearChannelIndex }) => rearChannelIndex),
  [0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2],
  "contiguous four-port blocks must remain distinct inner channels");
assert.deepEqual(channelTrackList.map(({ rearChannelType }) => rearChannelType),
  ["tube", "tube", "tube", "tube", "tube", "tube", "tube", "tube", "discrete", "discrete", "discrete", "discrete"]);
assert.equal(new Set(channelTrackList.slice(0, 8).map(({ strandSpacing }) => strandSpacing)).has(BACKEND_TUBE_STRAND_SPACING), true);
assert.equal(new Set(channelTrackList.slice(8).map(({ strandSpacing }) => strandSpacing)).has(BACKEND_DISCRETE_STRAND_SPACING), true);
for (const [start, spacing] of [[0, BACKEND_TUBE_STRAND_SPACING], [4, BACKEND_TUBE_STRAND_SPACING], [8, BACKEND_DISCRETE_STRAND_SPACING]]) {
  const members = channelTrackList.slice(start, start + 4);
  assert.deepEqual(members.slice(1).map((track, index) => Math.abs(track.sourceGutterX - members[index].sourceGutterX)),
    [spacing, spacing, spacing], "strands must retain their channel-specific tight pitch along the source spine");
  assert.deepEqual(members.slice(1).map((track, index) => Math.abs(track.bridgeY - members[index].bridgeY)),
    [spacing, spacing, spacing], "strands must retain their channel-specific tight pitch through the overhead corridor");
}
const firstTubeSheath = channelTrackList[0].rearChannelSheath;
const secondTubeSheath = channelTrackList[4].rearChannelSheath;
const tubeBoundaryGap = Math.abs(channelTrackList[4].rearChannelCenterOffset - channelTrackList[0].rearChannelCenterOffset) -
  firstTubeSheath.width / 2 - secondTubeSheath.width / 2;
assert.equal(tubeBoundaryGap, BACKEND_CHANNEL_GAP,
  "tube sheath boundaries must retain the configured 8px physical clearance");
const tubeToDiscreteGap = Math.abs(channelTrackList[8].bridgeY - channelTrackList[7].bridgeY) -
  (secondTubeSheath.width - BACKEND_TUBE_STRAND_SPACING * 3) / 2;
assert.equal(tubeToDiscreteGap, BACKEND_CHANNEL_GAP,
  "tube boundaries and discrete strands must retain the configured 8px physical clearance");
assert.equal(BACKEND_CHANNEL_GAP, 8, "rear tubes must use the requested compact 8px boundary gap");
assert.equal(new Set(channelTrackList.map(({ sourceGutterX }) => sourceGutterX)).size, channelTrackList.length,
  "the consolidated source spine must remain a compact bank of unique individual tracks");
assert.equal(channelTrackList.every(({ bridgeY }) => bridgeY < Math.min(rackA.y, rackB.y)), true,
  "all rear channels must use the overhead routing corridor");
assert.equal(new Set(channelTrackList.slice(0, 8).map(({ rearChannelSheath }) => rearChannelSheath?.key)).size, 2,
  "each tube channel must expose one shared sheath without merging its strands");
assert.equal(channelTrackList.slice(0, 8).every(({ rearChannelSheath }) => rearChannelSheath?.strandCount === 4), true);
assert.equal(firstTubeSheath.route.points[0].x, channelSource.x,
  "the thick tube must begin at the source panel edge so only the on-panel strands fan out");
assert.equal(firstTubeSheath.route.points.at(-1).x, channelTarget.x + channelTarget.width,
  "the thick tube must reach the target panel edge before splitting into individual strands");
assert.ok(firstTubeSheath.width > BACKEND_TUBE_STRAND_SPACING,
  "the shared tube run must be visibly thicker than an individual rear strand");
assert.equal(channelTrackList.slice(8).every(({ rearChannelSheath }) => rearChannelSheath === undefined), true,
  "discrete bundles must remain loose cables without an outer sheath");
const independentRearLinks = channelLinks.slice(0, 2).map((link) => {
  const independent = { ...link };
  delete independent.rearChannelId;
  delete independent.rearChannelName;
  delete independent.rearChannelType;
  return independent;
});
const independentRearTracks = assignCableTracks({
  links: independentRearLinks,
  portBoxes: channelPorts,
  deviceBoxes: [channelSource, channelTarget],
  rackBoxes: [rackA, rackB],
});
const independentTrackList = independentRearLinks.map(({ id }) => independentRearTracks.get(id));
assert.equal(new Set(independentTrackList.map(({ rearChannelKey }) => rearChannelKey)).size, independentRearLinks.length,
  "independent rear runs must never be auto-merged into one physical channel");
assert.equal(independentTrackList.every(({ rearChannelType, rearChannelSheath }) =>
  rearChannelType === "independent" && rearChannelSheath === undefined), true,
  "independent rear runs must remain loose and must never render a tube sheath");
for (const track of channelTrackList) {
  assert.equal(track.routeKind, "rear-inter-rack-overhead");
  assert.equal(routeSegments(track).some((segment) => segment.source.y === track.bridgeY && segment.target.y === track.bridgeY), true,
    "each strand must traverse horizontally in its own overhead slot");
  assert.equal(routeSegments(track).some((segment) => segment.source.x === track.targetGutterX && segment.target.x === track.targetGutterX), true,
    "each strand must break out vertically at its target gutter coordinate");
}

const horizontal = routeFromPoints([{ x: 0, y: 50 }, { x: 100, y: 50 }]);
const vertical = routeFromPoints([{ x: 50, y: 0 }, { x: 50, y: 100 }]);
const bridged = routeWithCrossingBridges(horizontal, [vertical]);
assert.equal(bridged.bridges.length, 1, "right-angle crossings should create jumper metadata");
assert.equal(bridged.bridges[0].jumperArc, true);
assert.equal(bridged.bridges[0].radius, CABLE_JUMPER_RADIUS, "the jumper bow needs a compact 4px radius");
assert.deepEqual(bridged.bridges[0].apex, { x: 50, y: 50 - CABLE_JUMPER_RADIUS });
assert.deepEqual(bridged.points, horizontal.points, "a bridge must preserve the reserved Manhattan track geometry");
const [verticalFirst, horizontalSecond] = routesWithCrossingBridges([vertical, horizontal]);
assert.equal(verticalFirst.bridges.length, 0, "vertical tracks must never own a jumper bow");
assert.equal(horizontalSecond.bridges.length, 1, "horizontal tracks must own the bow even when routed later");
assert.equal(horizontalSecond.bridges[0].underRouteIndex, 0);
const compactBridge = routeWithCrossingBridges(horizontal, [vertical], { radius: 3 });
assert.equal(compactBridge.bridges[0].radius, 3, "dense layouts may reduce bridge bows to the permitted 3px radius");
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
assert.match(canvasSource, /rackBoxes: this\.routingRackBoxes/,
  "canvas routing must use independent face bounds instead of the expanded rack group boundary");
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
