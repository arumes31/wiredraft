import assert from "node:assert/strict";
import test from "node:test";
import { planCableRepatch, repatchEndpointLabel } from "./static/js/link-repatch.js";
import { CanvasEngine } from "./static/js/canvas.js";

function fixture() {
  return {
    devices: ["a", "b", "c"].map(id => ({ id, name: id, category: "Switch", ports: [1, 2, 3].map(n => ({ id: `${id}${n}`, deviceId: id, label: `${n}` })) })),
    links: [
      { id: "one", sourceDeviceId: "a", sourcePortId: "a1", targetDeviceId: "b", targetPortId: "b1", notes: "Keep" },
      { id: "two", sourceDeviceId: "a", sourcePortId: "a2", targetDeviceId: "c", targetPortId: "c1" },
    ],
  };
}

test("repatch preview names the moved end and preserves the input topology", () => {
  const topology = fixture(), before = structuredClone(topology);
  const plan = planCableRepatch(topology, "one", "target", "c3");
  assert.deepEqual(plan.input, { endpoint: "target", portId: "c3" });
  assert.equal(plan.from.port.id, "b1");
  assert.equal(plan.to.device.id, "c");
  assert.equal(plan.swapLink, null);
  assert.deepEqual(topology, before);
});

test("occupied targets identify exactly the cable and end requiring confirmation", () => {
  const plan = planCableRepatch(fixture(), "one", "target", "a2");
  assert.equal(plan.input.swapLinkId, "two");
  assert.equal(plan.swapEndpoint, "source");
  assert.equal(plan.swapLink.id, "two");
});

test("invalid endpoints and dropping onto the original cable are rejected", () => {
  for (const [link, end, port] of [["missing", "source", "a3"], ["one", "both", "a3"], ["one", "source", "missing"], ["one", "source", "a1"], ["one", "source", "b1"]]) {
    assert.equal(planCableRepatch(fixture(), link, end, port), null);
  }
});

test("front and rear occupancy are independent and rear targets require patch panels", () => {
  const topology = fixture();
  topology.devices.forEach(device => { device.category = "PatchPanel"; });
  topology.links[1].sourceSide = topology.links[1].targetSide = "rear";
  assert.equal(planCableRepatch(topology, "one", "source", "a2").swapLink, null);
  assert.equal(planCableRepatch(topology, "two", "source", "a1").swapLink, null);
  topology.devices[0].category = "Switch";
  assert.equal(planCableRepatch(topology, "two", "source", "a3"), null);
});

test("confirmation labels identify the physical device, port and rear plane", () => {
  const endpoint = { device: { name: "Panel A" }, port: { label: "12" } };
  assert.equal(repatchEndpointLabel(endpoint, "front"), "Panel A / 12");
  assert.equal(repatchEndpointLabel(endpoint, "rear"), "Panel A / 12 (rear)");
});

test("relocking during an active repatch cancels the preview without submitting it", () => {
  const topology = fixture(), before = structuredClone(topology);
  const engine = Object.create(CanvasEngine.prototype);
  let submitted = false;
  Object.assign(engine, {
    state: { topology, editLock: { checkExpiry() {}, allows: () => false } },
    canvas: { style: {}, hasPointerCapture: () => false },
    repatch: { active: true, plan: planCableRepatch(topology, "one", "source", "a3") },
    callbacks: { onLinkRepatch() { submitted = true; } }, invalidate() {},
  });
  engine.pointerUp({ pointerId: 1 });
  assert.equal(engine.repatch, null);
  assert.equal(submitted, false);
  assert.deepEqual(topology, before);
});

test("repatch handles belong only to the selected editable cable and visible ports", () => {
  const topology = fixture(), engine = Object.create(CanvasEngine.prototype);
  Object.assign(engine, {
    state: { topology, selection: { type: "link", id: "one" } },
    camera: { zoom: 1 },
    portBoxByID: new Map([["a1", { centerX: 100, centerY: 100 }]]),
  });
  assert.equal(engine.repatchHandles().length, 1);
  assert.equal(engine.hitRepatchHandle({ x: 108, y: 100 }).endpoint, "source");
  assert.equal(engine.hitRepatchHandle({ x: 110, y: 100 }), undefined);
  engine.state.editLock = { allows: () => false };
  assert.deepEqual(engine.repatchHandles(), []);
  delete engine.state.editLock;
  engine.state.selection = { type: "link", id: "deleted" };
  assert.deepEqual(engine.repatchHandles(), []);
  engine.state.selection = { type: "port", id: "a1" };
  assert.deepEqual(engine.repatchHandles(), []);
});
