import assert from "node:assert/strict";
import test from "node:test";

import { CanvasEngine } from "./static/js/canvas.js";

function topologyFixture() {
  return {
    racks: [{ id: "rack-a", name: "RACK A01" }],
    devices: [
      { id: "device-a", rackId: "rack-a", name: "CORE 01", category: "Switch", ports: [{ id: "port-a", label: "1/1/48", type: "SFP28", speedMbps: 25000, mode: "Trunk", nativeVlan: 10, allowedVlans: [20], status: "up" }] },
      { id: "device-b", rackId: "rack-a", name: "EDGE 01", category: "Switch", ports: [{ id: "port-b", label: "1/1/1", type: "SFP28", speedMbps: 25000, mode: "Trunk", nativeVlan: 10, allowedVlans: [20], status: "up" }] },
    ],
    links: [{ id: "link-a", sourcePortId: "port-a", targetPortId: "port-b", sourceDeviceId: "device-a", targetDeviceId: "device-b", cableType: "SMF", primaryVlan: 10, vlanIds: [10, 20] }],
    linkGroups: [],
    commentThreads: [
      { id: "device-note", anchor: { kind: "device", targetId: "device-a" }, updatedAt: "2026-08-04T08:00:00Z", messages: [{ author: "NOC", body: "Device maintenance due" }] },
      { id: "port-note", anchor: { kind: "port", targetId: "port-a" }, updatedAt: "2026-08-04T09:00:00Z", messages: [{ author: "Alex", body: "Clean optic" }] },
      { id: "link-note", anchor: { kind: "link", targetId: "link-a" }, updatedAt: "2026-08-04T10:00:00Z", messages: [{ author: "Daniel", body: "Carrier change window" }] },
    ],
  };
}

function tooltipEngine(topology) {
  const engine = Object.create(CanvasEngine.prototype);
  Object.assign(engine, {
    state: { topology }, width: 1200, height: 800, camera: { zoom: 1 }, pointerScreen: { x: 100, y: 100 },
    drag: null, rackDrag: null, pan: null, draft: null, selectionBox: null, linkDrag: null,
    hoveredPort: null, hoveredLink: null, hoveredDevice: null,
  });
  engine.stpPortStates = () => [];
  engine.drawPointerSpeechBubble = (_ctx, lines, accent, options) => { engine.capturedTooltip = { lines, accent, options }; };
  return engine;
}

test("device, port, and link hover bubbles include their anchored open comments", () => {
  const topology = topologyFixture();
  const engine = tooltipEngine(topology);
  const sourceDevice = topology.devices[0];
  const sourcePort = sourceDevice.ports[0];
  const link = topology.links[0];

  engine.hoveredLink = { link, group: null, primaryColor: "#45a6ff" };
  engine.drawTooltip({});
  assert.ok(engine.capturedTooltip.lines.includes("Daniel · Carrier change window"));
  assert.equal(engine.capturedTooltip.lines[engine.capturedTooltip.options.commentStart], "COMMENTS · 1 OPEN");

  engine.hoveredLink = null;
  engine.hoveredPort = { device: sourceDevice, port: sourcePort };
  engine.drawTooltip({});
  assert.ok(engine.capturedTooltip.lines.includes("Alex · Clean optic"));

  engine.hoveredPort = null;
  engine.hoveredDevice = { device: sourceDevice };
  engine.drawTooltip({});
  assert.ok(engine.capturedTooltip.lines.includes("NOC · Device maintenance due"));
});
