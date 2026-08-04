import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildLoginBackdropScene,
  partialOrthogonalPath,
  renderLoginBackdrop,
  seededRandom,
} from "./static/js/login-background.js";

const source = await readFile(new URL("./static/js/login-background.js", import.meta.url), "utf8");

function assertOrthogonal(points) {
  points.slice(1).forEach((point, index) => {
    const previous = points[index];
    assert.ok(
      point.x === previous.x || point.y === previous.y,
      `segment ${index} is diagonal: ${JSON.stringify(previous)} -> ${JSON.stringify(point)}`,
    );
  });
}

test("ambient topology generation is deterministic, bounded, and fully synthetic", () => {
  const first = buildLoginBackdropScene(1440, 900, seededRandom(4815));
  const second = buildLoginBackdropScene(1440, 900, seededRandom(4815));
  assert.deepEqual(first, second);
  assert.ok(first.racks.length >= 2 && first.racks.length <= 4);
  assert.ok(first.devices.length >= first.racks.length * 3);
  assert.ok(first.links.length > first.racks.length);

  const racks = new Map(first.racks.map((rack) => [rack.id, rack]));
  first.devices.forEach((device) => {
    const rack = racks.get(device.rackId);
    assert.ok(rack);
    assert.ok(device.x >= rack.x && device.x + device.width <= rack.x + rack.width);
    assert.ok(device.y >= rack.y && device.y + device.height <= rack.y + rack.height);
    assert.ok(device.ports.length >= 4);
  });
  first.racks.forEach((rack) => {
    const rackDevices = first.devices.filter((device) => device.rackId === rack.id).sort((left, right) => left.y - right.y);
    rackDevices.slice(1).forEach((device, index) => {
      assert.ok(rackDevices[index].y + rackDevices[index].height <= device.y, `${rack.id} devices overlap`);
    });
  });
});

test("different entropy seeds vary racks, inventory, ports, and cable structure", () => {
  const scenes = Array.from({ length: 12 }, (_, seed) => buildLoginBackdropScene(1680, 940, seededRandom(seed + 1)));
  const rackCounts = new Set(scenes.map((scene) => scene.racks.length));
  const rackStyles = new Set(scenes.flatMap((scene) => scene.racks.map((rack) => `${rack.unitsU}:${rack.palette.header}`)));
  const inventories = new Set(scenes.map((scene) => scene.devices.map((device) => `${device.kind}:${device.portCount}`).join("|")));
  const linkPlans = new Set(scenes.map((scene) => scene.links.map((link) => `${link.sourceDeviceId}>${link.targetDeviceId}:${link.role}`).join("|")));

  assert.ok(rackCounts.size >= 2, "rack count should vary at the same desktop viewport");
  assert.ok(rackStyles.size >= 6, "rack capacities and color families should vary");
  assert.ok(inventories.size >= 10, "device kinds and port densities should vary by scene");
  assert.ok(linkPlans.size >= 10, "endpoint selection, direction, and roles should vary by scene");
});

test("procedural variants remain bounded and orthogonal across viewport classes", () => {
  const viewports = [[390, 640], [1024, 768], [1920, 1080]];
  for (const [width, height] of viewports) {
    for (let seed = 1; seed <= 40; seed += 1) {
      const scene = buildLoginBackdropScene(width, height, seededRandom((width * seed) + height));
      const rackByID = new Map(scene.racks.map((rack) => [rack.id, rack]));
      const endpointIDs = new Set();
      scene.racks.forEach((rack) => {
        assert.ok(rack.x >= 0 && rack.y >= 0);
        assert.ok(rack.x + rack.width <= scene.width && rack.y + rack.height <= scene.height);
      });
      scene.devices.forEach((device) => {
        const rack = rackByID.get(device.rackId);
        assert.ok(device.x >= rack.x && device.x + device.width <= rack.x + rack.width);
        assert.ok(device.y >= rack.y && device.y + device.height <= rack.y + rack.height);
      });
      scene.links.forEach((link) => {
        assertOrthogonal(link.path);
        for (const endpointID of [link.sourcePortId, link.targetPortId]) {
          assert.equal(endpointIDs.has(endpointID), false, `${endpointID} reused at ${width}x${height} seed ${seed}`);
          endpointIDs.add(endpointID);
        }
      });
    }
  }
});

test("every ambient cable terminates on its exact ports using Manhattan segments", () => {
  const scene = buildLoginBackdropScene(1680, 1000, seededRandom(90210));
  const ports = new Map(scene.devices.flatMap((device) => device.ports.map((port) => [port.id, port])));
  const routeSignatures = new Set();
  const usedEndpoints = new Set();

  scene.links.forEach((link) => {
    assertOrthogonal(link.path);
    assert.deepEqual(link.path[0], { x: ports.get(link.sourcePortId).x, y: ports.get(link.sourcePortId).y });
    assert.deepEqual(link.path.at(-1), { x: ports.get(link.targetPortId).x, y: ports.get(link.targetPortId).y });
    const signature = link.path.map(({ x, y }) => `${x}:${y}`).join("|");
    assert.equal(routeSignatures.has(signature), false);
    routeSignatures.add(signature);
    assert.equal(usedEndpoints.has(link.sourcePortId), false, `${link.sourcePortId} is reused`);
    assert.equal(usedEndpoints.has(link.targetPortId), false, `${link.targetPortId} is reused`);
    usedEndpoints.add(link.sourcePortId);
    usedEndpoints.add(link.targetPortId);
    assert.equal(ports.get(link.sourcePortId).connected, true);
    assert.equal(ports.get(link.targetPortId).connected, true);
  });
});

test("partial cable drawing preserves orthogonality and stops at the requested length", () => {
  const path = [
    { x: 10, y: 20 },
    { x: 70, y: 20 },
    { x: 70, y: 80 },
    { x: 130, y: 80 },
  ];
  assert.deepEqual(partialOrthogonalPath(path, 0), []);
  assert.deepEqual(partialOrthogonalPath(path, 1), path);
  const half = partialOrthogonalPath(path, .5);
  assertOrthogonal(half);
  assert.deepEqual(half, [{ x: 10, y: 20 }, { x: 70, y: 20 }, { x: 70, y: 50 }]);
});

test("renderer supports construction, connection, and completed-scene phases", () => {
  const calls = [];
  const context = new Proxy({}, {
    get(target, property) {
      if (property in target) return target[property];
      if (typeof property === "symbol") return undefined;
      const method = (...args) => calls.push([property, ...args]);
      target[property] = method;
      return method;
    },
    set(target, property, value) {
      target[property] = value;
      calls.push([`set:${String(property)}`, value]);
      return true;
    },
  });
  const scene = buildLoginBackdropScene(1280, 800, seededRandom(7));
  renderLoginBackdrop(context, scene, 2400);
  renderLoginBackdrop(context, scene, 9200);
  renderLoginBackdrop(context, scene, 13700);
  assert.ok(calls.some(([name]) => name === "fillText"));
  assert.ok(calls.some(([name]) => name === "lineTo"));
  assert.ok(calls.some(([name]) => name === "setLineDash"));
});

test("browser adapter is performance-capped, non-editor, and motion-aware", () => {
  assert.match(source, /1000 \/ 24/);
  assert.match(source, /MAX_PIXEL_RATIO = 1\.5/);
  assert.match(source, /prefers-reduced-motion: reduce/);
  assert.match(source, /document\.hidden/);
  assert.match(source, /dataset\.animation = "static"/);
  assert.match(source, /crypto\?\.getRandomValues/);
  assert.match(source, /sceneSequence/);
  assert.doesNotMatch(source, /from ["'].+(canvas|cabling|app)\.js["']/);
  assert.doesNotMatch(source, /fetch\s*\(/);
});
