import assert from "node:assert/strict";
import test from "node:test";
import { hardwareCatalog, instantiateProfile } from "./static/js/catalog.js";
import { resolveModelFaceplate } from "./static/js/faceplate-models.js";
import { resolveUbiquitiFaceplate } from "./static/js/faceplate-ubiquiti-models.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";

/** Instantiate the requested catalog item without depending on display names or IDs. */
function deviceFor(model) {
  return instantiateProfile(hardwareCatalog.find((item) => item.vendor === "Ubiquiti" && item.model === model), model, { x: 0, y: 0 });
}

test("Standard switches retain their actual banks and fanless rear power arrangement", () => {
  const small = resolveModelFaceplate(deviceFor("UniFi Standard 24"));
  const large = resolveModelFaceplate(deviceFor("UniFi Standard 48 PoE"));
  assert.ok(small.faces.front.ports[0].x > .48, "USW-24 begins in the right half of the chassis");
  assert.ok(large.faces.front.ports[0].x < .11, "USW-48-POE starts immediately after the display");
  assert.equal(small.faces.front.ports.length, 26);
  assert.equal(large.faces.front.ports.length, 52);
  for (const profile of [small, large]) {
    assert.equal(profile.fidelity, "model");
    assert.equal(profile.panelsVerified, true);
    for (const reference of [profile.evidence.front, profile.evidence.rear]) {
      const url = new URL(reference);
      assert.equal(url.protocol, "https:");
      assert.equal(url.hostname, "dl.ui.com");
    }
    assert.equal(profile.faces.rear.ports.length, 0);
    assert.equal(profile.faces.rear.components.filter((part) => part.kind === "power").length, 1);
    assert.ok(!profile.faces.rear.components.some((part) => ["fan", "psu"].includes(part.kind)));
    assert.equal(profile.faces.front.ports[0].x, profile.faces.front.ports[1].x);
    assert.ok(profile.faces.front.ports[0].y < profile.faces.front.ports[1].y);
  }
  assert.match(large.catalogDiscrepancies[0], /1–32/);
});

test("exact Ubiquiti panels preserve inventory identity and hidden connections after port renaming", () => {
  for (const model of ["UniFi Standard 24", "UniFi Standard 48 PoE"]) {
    const device = deviceFor(model);
    const original = structuredClone(device);
    const bounds = { x: 0, y: 0, width: 690, height: 100 };
    const front = buildFaceplateScene(device, bounds, { face: "front" });
    const rear = buildFaceplateScene(device, bounds, { face: "rear" });
    assert.deepEqual(front.ports.map((box) => box.port.id), device.ports.map((port) => port.id));
    assert.equal(rear.ports.length, 0);
    assert.equal(rear.hiddenPorts.length, device.ports.length);
    assert.deepEqual(device, original);
    device.ports[0].label = "Renamed uplink";
    const renamed = buildFaceplateScene(device, bounds, { face: "front" });
    assert.equal(renamed.ports[0].x, front.ports[0].x);
    assert.equal(renamed.ports[0].y, front.ports[0].y);
  }
  assert.equal(resolveUbiquitiFaceplate({}), null);
  assert.equal(resolveUbiquitiFaceplate({ model: "USW-24", faceplate: { vendor: "Ubiquiti" } }), null);
  assert.equal(resolveUbiquitiFaceplate(deviceFor("EdgeRouter legacy family")), null);
});

test("Pro rows, cooling and UDM port roles follow the individual product diagrams", () => {
  for (const [model, rows, fans] of [["UniFi Pro Max 24 PoE", 1, 0], ["UniFi Pro Max 48 PoE", 2, 4],
    ["UniFi Pro XG 24 PoE", 1, 5], ["UniFi Pro XG 48 PoE", 2, 5], ["USW-Enterprise-48-PoE", 2, 4]]) {
    const device = deviceFor(model);
    const profile = resolveModelFaceplate(device);
    const copper = profile.faces.front.ports.filter((slot) => slot.type.startsWith("RJ45"));
    assert.equal(new Set(copper.map((slot) => slot.y)).size, rows, model);
    assert.equal(profile.faces.rear.components.filter((part) => part.kind === "fan").length, fans, model);
    assert.equal(profile.faces.front.ports.length, device.ports.length);
  }
  const udm = deviceFor("UDM-Pro-Max");
  assert.ok(udm.ports.slice(0, 8).every((port) => port.speedMbps === 1000 && !port.isPoe));
  assert.equal(udm.ports[10].label, "9");
  assert.equal(udm.ports[10].speedMbps, 2500);
  const ecs = resolveModelFaceplate(deviceFor("UniFi Enterprise Campus Aggregation"));
  assert.equal(ecs.faces.rear.components.filter((part) => part.kind === "fan").length, 5);
  assert.equal(ecs.faces.rear.components.filter((part) => part.kind === "psu").length, 2);
  for (const [model, slowPorts, slow, fast] of [["UniFi Pro Max 24 PoE", 16, 1000, 2500],
    ["UniFi Pro Max 48 PoE", 32, 1000, 2500], ["UniFi Pro XG 24 PoE", 8, 2500, 10000],
    ["UniFi Pro XG 48 PoE", 16, 2500, 10000]]) {
    const ports = deviceFor(model).ports;
    assert.ok(ports.slice(0, slowPorts).every((port) => port.speedMbps === slow), model);
    assert.equal(ports[slowPorts].speedMbps, fast, model);
  }
  assert.ok(deviceFor("UniFi Standard 48 PoE").ports.slice(32, 48).every((port) => !port.isPoe));
});

test("obsolete MGMT endpoints remain routable outside the physical switch without mutating old data", () => {
  const device = deviceFor("USW-Pro-Max-48-PoE");
  assert.equal(device.ports.length, 52, "new instances have no fictitious dedicated management port");
  device.ports.slice(0, 48).forEach((port) => { port.type = "RJ45_MGIG"; port.speedMbps = 2500; });
  const oldManagement = { ...device.ports[0], id: "old-mgmt", portIndex: 53, label: "MGMT", type: "RJ45_1G" };
  device.ports.push(oldManagement);
  const before = structuredClone(device);
  for (const face of ["front", "rear"]) {
    const scene = buildFaceplateScene(device, { x: 0, y: 0, width: 690, height: 100 }, { face });
    assert.ok(!scene.ports.some((box) => box.port.id === oldManagement.id));
    assert.ok(scene.hiddenPorts.some((box) => box.port.id === oldManagement.id));
    assert.deepEqual(scene.unmappedPorts.map((port) => port.id), [oldManagement.id]);
    if (face === "front") {
      assert.equal(scene.ports.length, 52, "old copper type assignments still map to their original sockets");
      assert.equal(scene.portal.label, "UNMAPPED INVENTORY");
      assert.ok(scene.portal.y + scene.portal.height < scene.chassis.y);
    }
  }
  assert.deepEqual(device, before);
  oldManagement.label = device.ports[0].label;
  const renamed = buildFaceplateScene(device, { x: 0, y: 0, width: 690, height: 100 });
  assert.equal(renamed.ports.length, 52, "a duplicate display name cannot turn obsolete inventory into a real socket");
  assert.deepEqual(renamed.unmappedPorts.map((port) => port.id), [oldManagement.id]);
});

test("U7 uses a circular cover and an underside inlet instead of a rack-switch face", () => {
  const device = deviceFor("UniFi U7 Pro");
  const bounds = { x: 30, y: 40, width: 690, height: 100 };
  const front = buildFaceplateScene(device, bounds, { face: "front" });
  const rear = buildFaceplateScene(device, bounds, { face: "rear" });
  assert.equal(front.profile.fidelity, "model");
  assert.equal(front.chassis.shape, "circle");
  assert.equal(front.chassis.width, front.chassis.height);
  assert.equal(front.ports.length, 0);
  assert.equal(front.hiddenPorts[0].port.id, device.ports[0].id);
  assert.ok(front.portal.y + front.portal.height < front.chassis.y);
  assert.equal(rear.ports.length, 1);
  assert.ok(rear.ports[0].centerX > rear.chassis.x + rear.chassis.width / 2);
  assert.equal(rear.portal, null);
});
