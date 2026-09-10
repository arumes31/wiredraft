import assert from "node:assert/strict";
import test from "node:test";
import { hardwareCatalog, instantiateProfile } from "./static/js/catalog.js";
import { resolveAccessPointFaceplate } from "./static/js/faceplate-access-point-models.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";

/** Instantiate the exact AP-635 catalog entry with an independent inventory. */
function fixture() {
  return instantiateProfile(hardwareCatalog.find((item) => item.vendor === "HPE Aruba" && item.model === "AP-635"), "AP-635", { x: 0, y: 0 });
}

test("AP-635 traces square front indicators and the actual underside Ethernet/service positions", () => {
  const device = fixture();
  const profile = resolveAccessPointFaceplate(device);
  assert.equal(profile.sku, "AP-635");
  assert.equal(profile.fidelity, "model");
  assert.equal(profile.defaultFace, "rear");
  assert.equal(profile.chassis.shape, "square");
  assert.match(profile.evidence.front, /#page=6$/);
  assert.match(profile.evidence.rear, /#page=9$/);
  assert.equal(profile.faces.front.ports.length, 0);
  assert.equal(profile.faces.front.components.filter((part) => part.kind === "led").length, 4);
  const [e0, e1, console] = profile.faces.rear.ports;
  assert.deepEqual([e0.portIndex, e1.portIndex, console.portIndex], [1, 2, 3]);
  assert.deepEqual([e0.type, e1.type, console.type], ["RJ45_MGIG", "RJ45_MGIG", "USB_MICRO_CONSOLE"]);
  assert.ok(e0.x < e1.x && e0.y > e1.y, "Ethernet ports follow the underside's diagonal edge");
  assert.ok(console.y < .2 && console.x > .4 && console.x < .6);
  assert.ok(profile.faces.rear.components.some((part) => part.kind === "power" && part.variant === "dc-barrel"));
  assert.equal(profile.faces.rear.components.filter((part) => part.kind === "usb").length, 1, "USB host is artwork, console is a typed endpoint");
  const before = JSON.stringify(profile);
  device.ports.reverse();
  device.ports[0].label = "Installer console";
  assert.equal(resolveAccessPointFaceplate(device), profile);
  assert.equal(JSON.stringify(profile), before);
});

test("AP-635 front/rear projection preserves saved two-port inventories and custom labels", () => {
  const device = fixture();
  device.ports = device.ports.slice(0, 2);
  device.ports[1].label = "Backup uplink";
  const before = structuredClone(device);
  const bounds = { x: 10, y: 15, width: 450, height: 250 };
  const rear = buildFaceplateScene(device, bounds, { face: "rear" });
  const front = buildFaceplateScene(device, bounds, { face: "front" });
  assert.equal(rear.chassis.width, rear.chassis.height);
  assert.deepEqual(rear.ports.map((slot) => slot.port.id), device.ports.map((port) => port.id));
  assert.equal(rear.ports[1].displayLabel, "Backup uplink");
  assert.equal(rear.unmappedPorts.length, 0);
  assert.equal(front.ports.length, 0);
  assert.equal(front.hiddenPorts.length, 2);
  assert.deepEqual(device, before);
});

test("access-point tracing refuses other vendors and untraced model suffixes", () => {
  assert.equal(resolveAccessPointFaceplate({}), null);
  assert.equal(resolveAccessPointFaceplate({ model: "AP-635", faceplate: { vendor: "Cisco" } }), null);
  assert.equal(resolveAccessPointFaceplate({ model: "AP-635A", faceplate: { vendor: "HPE Aruba" } }), null);
});
