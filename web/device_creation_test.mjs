import assert from "node:assert/strict";
import test from "node:test";
import { CanvasEngine } from "./static/js/canvas.js";

function engine() {
  const canvas = Object.create(CanvasEngine.prototype);
  const rack = { id: "rack", heightU: 6 };
  const requests = [];
  Object.assign(canvas, {
    state: { topology: { racks: [rack], devices: [] } },
    callbacks: { onDeviceCreateRequest: (target) => requests.push(target) },
    camera: { x: 50, y: 20, zoom: .5 },
    eventPoint: (event) => ({ x: event.clientX, y: event.clientY }),
    hitLink: () => null, hitDevice: () => null, hitAnnotation: () => null,
    rackFaceBoxes: [{ rack, face: "rear", x: 900, y: 100, width: 750, height: 684 }],
  });
  const click = (x, y) => canvas.contextMenu({ preventDefault() {}, clientX: x * .5 + 50, clientY: y * .5 + 20 });
  return { canvas, requests, click };
}

test("creation uses world coordinates and the rendered rack elevation", () => {
  const { requests, click } = engine();
  click(-100, 800);
  click(950, 414);
  assert.deepEqual(requests, [{ x: -100, y: 800 }, { rackId: "rack", rackUnit: 4, rackFace: "rear" }]);
});

test("rack headers, footers, occupied units and existing objects never offer creation", () => {
  const { canvas, requests, click } = engine();
  click(950, 110);
  click(950, 770);
  canvas.state.topology.devices.push({ id: "occupied", rackId: "rack", rackUnit: 4, rackFace: "rear", faceplate: { unitsU: 1 } });
  click(950, 414);
  canvas.hitDevice = () => ({ device: { id: "free" } });
  click(0, 0);
  assert.deepEqual(requests, []);
});

test("right-click keeps the existing cable action and checks edit capability", () => {
  const { canvas, requests, click } = engine();
  const deleted = [];
  const link = { id: "cable" };
  canvas.callbacks.onLinkDelete = (item) => deleted.push(item);
  canvas.hitLink = () => ({ link });
  click(0, 0);
  assert.deepEqual(deleted, [link]);
  canvas.state.editLock = { allows: () => false, checkExpiry() {} };
  click(0, 0);
  assert.equal(deleted.length, 1);
  canvas.hitLink = () => null;
  click(0, 0);
  assert.deepEqual(requests, []);
});
