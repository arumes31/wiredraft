import assert from "node:assert/strict";
import test from "node:test";

import { assignCableTracks, routeFromPoints, routesWithCrossingBridges } from "./static/js/cabling.js";
import { CanvasEngine } from "./static/js/canvas.js";

test("incremental track assignment preserves every unaffected route", () => {
  const scene = routingScene();
  const original = assignCableTracks(scene);
  const movedDevice = scene.deviceBoxes.find(({ device }) => device.id === "target-0");
  const movedPort = scene.portBoxes.find(({ port }) => port.id === "target-port-0");
  movedDevice.y += 160;
  movedPort.y += 160;
  movedPort.centerY += 160;

  const updated = assignCableTracks(scene, {
    previousTracks: original,
    rerouteLinkIDs: new Set(["link-0"]),
  });

  assert.notEqual(updated.get("link-0"), original.get("link-0"), "the moved endpoint must receive a new route");
  assert.equal(updated.get("link-1"), original.get("link-1"), "unaffected routes must be reused by identity");
  assert.equal(updated.get("link-2"), original.get("link-2"), "unaffected routes must be reused by identity");
  assert.equal(updated.get("link-0").target.y, movedPort.centerY, "the affected route must terminate at the moved port");
});

test("incremental crossover decoration examines only pairs touching affected routes", () => {
  const routes = [];
  for (let index = 0; index < 40; index += 1) {
    routes.push(routeFromPoints([{ x: 30 + index * 20, y: 0 }, { x: 30 + index * 20, y: 900 }]));
  }
  for (let index = 0; index < 40; index += 1) {
    routes.push(routeFromPoints([{ x: 0, y: 30 + index * 20 }, { x: 900, y: 30 + index * 20 }]));
  }
  const previous = routesWithCrossingBridges(routes);
  const nextRoutes = [...routes];
  nextRoutes[0] = routeFromPoints([{ x: 37, y: 0 }, { x: 37, y: 900 }]);
  const stats = { pairsExamined: 0 };
  const incremental = routesWithCrossingBridges(nextRoutes, {
    previousRoutes: previous,
    affectedIndices: new Set([0]),
    stats,
  });
  const complete = routesWithCrossingBridges(nextRoutes);

  assert.equal(stats.pairsExamined, nextRoutes.length - 1);
  assert.ok(stats.pairsExamined < (nextRoutes.length * (nextRoutes.length - 1)) / 20,
    "one changed route should inspect far fewer pairs than a complete O(n²) pass");
  assert.deepEqual(incremental.map(bridgeSignature), complete.map(bridgeSignature),
    "incremental bows must be identical to a complete recomputation");
});

test("canvas routing reuses metadata-only updates and replans one moved endpoint", () => {
  const scene = routingScene();
  const engine = Object.create(CanvasEngine.prototype);
  engine.state = { topology: {
    racks: scene.rackBoxes.map(({ rack }) => rack),
    devices: scene.deviceBoxes.map(({ device }) => ({ ...device, ports: scene.portBoxes
      .filter((box) => box.device.id === device.id).map(({ port }) => port) })),
    links: scene.links,
    linkGroups: [],
  } };
  engine.portBoxes = scene.portBoxes;
  engine.deviceBoxes = scene.deviceBoxes;
  engine.rackBoxes = scene.rackBoxes;
  engine.groupLinkIDsByLink = new Map();
  engine.linkIDsByDevice = new Map([
    ["target-0", new Set(["link-0"])],
  ]);
  engine.routingChanges = { full: true, changedDeviceIDs: new Set(), obstacleBounds: [] };
  engine.routingGeometryKey = "geometry-1";
  engine.routingPlanRevision = 0;
  engine.trackPlanCache = null;

  const first = engine.cableTrackPlan(scene.links);
  const reused = engine.cableTrackPlan(scene.links);
  assert.equal(reused, first);
  assert.equal(engine.lastRoutingStats.mode, "reused");

  const movedDevice = scene.deviceBoxes.find(({ device }) => device.id === "target-0");
  const movedPort = scene.portBoxes.find(({ port }) => port.id === "target-port-0");
  const oldBounds = { ...movedDevice };
  movedDevice.y += 120;
  movedPort.y += 120;
  movedPort.centerY += 120;
  engine.routingGeometryKey = "geometry-2";
  engine.routingChanges = {
    full: false,
    changedDeviceIDs: new Set(["target-0"]),
    obstacleBounds: [oldBounds, movedDevice],
  };
  const incremental = engine.cableTrackPlan(scene.links);
  assert.notEqual(incremental, first);
  assert.deepEqual(engine.lastRoutingStats, {
    mode: "incremental",
    totalLinks: 3,
    reroutedLinks: 2,
    crossingPairs: 3,
  });
  assert.equal(incremental.tracks.get("link-2").route, first.tracks.get("link-2").route,
    "a route outside both the old and new obstacle bounds must remain untouched");
});

function routingScene() {
  const rackBox = { rack: { id: "rack-1" }, x: 0, y: 0, width: 760, height: 1800 };
  const deviceBoxes = [];
  const portBoxes = [];
  const links = [];
  for (let index = 0; index < 3; index += 1) {
    const source = deviceBox(`source-${index}`, rackBox, 100 + index * 220);
    const target = deviceBox(`target-${index}`, rackBox, 850 + index * 220);
    const sourcePort = portBox(source, `source-port-${index}`, 610 - index * 30, source.y + 32);
    const targetPort = portBox(target, `target-port-${index}`, 590 - index * 30, target.y + 32);
    deviceBoxes.push(source, target);
    portBoxes.push(sourcePort, targetPort);
    links.push({
      id: `link-${index}`,
      sourceDeviceId: source.device.id,
      sourcePortId: sourcePort.port.id,
      targetDeviceId: target.device.id,
      targetPortId: targetPort.port.id,
    });
  }
  return { links, portBoxes, deviceBoxes, rackBoxes: [rackBox], linkGroups: [] };
}

function deviceBox(id, rack, y) {
  return { device: { id, rackId: rack.rack.id }, rack, x: 35, y, width: 690, height: 100 };
}

function portBox(device, id, centerX, centerY) {
  return {
    port: { id, label: id, speedMbps: 10000 }, device: device.device,
    x: centerX - 7, y: centerY - 6, width: 14, height: 12, centerX, centerY,
  };
}

function bridgeSignature(route) {
  return (route.bridges || []).map(({ segmentIndex, underRouteIndex, crossing }) => ({
    segmentIndex, underRouteIndex, crossing,
  }));
}
