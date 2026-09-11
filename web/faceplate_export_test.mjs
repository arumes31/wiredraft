import assert from "node:assert/strict";
import test from "node:test";

import { hardwareCatalog, instantiateProfile } from "./static/js/catalog.js";
import { buildSVGDocument } from "./static/js/export.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";
import { hardwareComponentSVG } from "./static/js/hardware-components.js";
import { connectorKind } from "./static/js/termination.js";

/** Give a real catalog device stable identities without mutating the catalog. */
function deviceFor(model, id) {
  const profile = hardwareCatalog.find((candidate) => candidate.model === model);
  assert.ok(profile, `${model} must remain an installed catalog model`);
  const device = instantiateProfile(profile, `${model} & LAB`, { x: 0, y: 0 });
  device.id = id;
  device.ports.forEach((port, index) => { port.id = `${id}-${index}`; port.deviceId = id; });
  return device;
}

/** Export a real model's scene through the same geometry contract as Canvas. */
function exportScene(face, { hiddenRearRail = false } = {}) {
  const device = deviceFor("FortiGate 100F", "firewall");
  const peer = deviceFor("FortiGate 100F", "peer");
  if (hiddenRearRail) Object.assign(peer, { rackId: "hidden-rack", rackFace: "rear", rackUnit: 1 });
  const deviceBox = { device, x: 20, y: 30, width: 690, height: 100 };
  const peerBox = { device: peer, x: 820, y: 230, width: 690, height: 100 };
  const scene = buildFaceplateScene(device, deviceBox, { face });
  const peerScene = buildFaceplateScene(peer, peerBox, { face: "front" });
  const topology = {
    name: "Physical panels", devices: [device, peer], racks: [], vlans: [], linkGroups: [],
    links: [{
      id: "connected-port", sourceDeviceId: device.id, sourcePortId: device.ports[0].id,
      targetDeviceId: peer.id, targetPortId: peer.ports[0].id, cableType: "CAT6A", vlanIds: [],
    }],
  };
  const visiblePorts = [...scene.ports, ...(hiddenRearRail ? [] : peerScene.ports)];
  const routedPorts = [...scene.ports, ...scene.hiddenPorts, ...peerScene.ports, ...peerScene.hiddenPorts]
    .map((box) => hiddenRearRail && box.device.id === peer.id
      ? { ...box, portal: true, x: 840, y: 45, width: 6, height: 6, centerX: 843, centerY: 48 }
      : box);
  const engine = {
    worldBounds: () => ({ x: 0, y: 0, width: 1600, height: 400 }),
    portCenters: () => new Map(visiblePorts.map((box) => [box.port.id, { x: -999, y: -999 }])),
    portGeometry: () => visiblePorts,
    routingPortGeometry: () => routedPorts,
    faceplateScenes: () => new Map([[device.id, scene], ...(hiddenRearRail ? [] : [[peer.id, peerScene]])]),
    deviceRectangles: () => [deviceBox, ...(hiddenRearRail ? [] : [peerBox])],
    rackRectangles: () => [],
  };
  return { svg: buildSVGDocument(topology, engine), scene, device };
}

test("SVG shares authored front-panel chassis and socket bounds with Canvas", () => {
  const { svg, scene } = exportScene("front");
  assert.ok(scene.profile);
  assert.match(svg, /data-hardware-face="front"/);
  assert.ok(svg.includes(`data-layer="physical-chassis" x="${scene.chassis.x + 50}" y="${scene.chassis.y + 50}" width="${scene.chassis.width}" height="${scene.chassis.height}"`));
  for (const box of scene.ports) {
    const start = svg.indexOf(`data-port-id="${box.port.id}"`);
    assert.ok(start >= 0, `${box.port.label} must be exported`);
    const portMarkup = svg.slice(start, svg.indexOf("</g>", start));
    const art = hardwareComponentSVG({ kind: connectorKind(box.port.type), x: box.x + 50, y: box.y + 50,
      width: box.width, height: box.height }, scene.template);
    assert.ok(portMarkup.includes(art),
      `${box.port.label} SVG socket must use the actual Canvas hit box`);
  }
  assert.doesNotMatch(svg, /-999/, "legacy centers must not override scene geometry");
  assert.match(svg, /data-link-id="connected-port"/);
  assert.match(svg, /FortiGate 100F &amp; LAB/, "physical identity must stay XML escaped");
});

test("SVG omits cables to hidden rack rails while keeping visible-device panel anchors", () => {
  const { svg, scene } = exportScene("rear", { hiddenRearRail: true });
  assert.ok(scene.hiddenPorts.length > 0, "the visible device still has its opposite-panel anchors");
  assert.match(svg, /data-layer="opposite-panel-portal"/);
  assert.doesNotMatch(svg, /data-entity="device" data-device-id="peer"/);
  assert.doesNotMatch(svg, /data-link-id="connected-port"/,
    "a hidden rack device cannot introduce an unlabeled endpoint or fallback route into this export");
});

test("rear-panel export preserves hidden front-port connectivity through its marker", () => {
  const { svg, scene, device } = exportScene("rear");
  assert.ok(scene.profile);
  assert.ok(scene.portal);
  assert.ok(scene.hiddenPorts.some((box) => box.port.id === device.ports[0].id));
  assert.match(svg, /data-hardware-face="rear"/);
  assert.match(svg, /data-layer="opposite-panel-portal"/);
  assert.ok(svg.includes(scene.portal.label));
  assert.match(svg, /data-link-id="connected-port"/, "the cable cannot disappear when its socket is on the opposite panel");
  assert.ok(svg.indexOf('data-layer="opposite-panel-portal"') > svg.lastIndexOf('data-layer="cable"'),
    "connection-marker labels must stay legible above routed cables");
  assert.doesNotMatch(svg, new RegExp(`data-entity="port" data-port-id="${device.ports[0].id}"`),
    "a hidden front socket must not be painted on the rear face");
  assert.equal((svg.match(/data-component="power"/g) || []).length, 2,
    "100F rear hardware must show its two fixed AC inlets");
});
