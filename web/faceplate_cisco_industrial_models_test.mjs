import assert from "node:assert/strict";
import test from "node:test";
import { hardwareCatalog, instantiateProfile, upgradeInstalledPhysicalPorts } from "./static/js/catalog.js";
import { resolveEnterpriseFaceplate } from "./static/js/faceplate-enterprise-models.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";

/** Reconstruct current or original IR1101 inventory with stable endpoint identities. */
function fixture(legacy = false) {
  let entry = hardwareCatalog.find((item) => item.vendor === "Cisco" && item.model === "Catalyst IR1101");
  if (legacy) entry = { ...entry, inventoryRevision: 0, groups: entry.groups.slice(0, 4).map((group, index) =>
    index === 3 ? { ...group, type: "USB_MICRO_CONSOLE" } : group) };
  const device = instantiateProfile(entry, "Plant router", { x: 31, y: 47 });
  device.id = "ir1101";
  device.ports.forEach((port) => { port.id = `ir1101-${port.portIndex}`; });
  return device;
}

test("IR1101-K9 distinguishes its mini-B console from the independent RJ45 RS232 serial port", () => {
  const device = fixture();
  const profile = resolveEnterpriseFaceplate(device);
  assert.equal(profile.fidelity, "model");
  assert.equal(profile.sku, "IR1101-K9");
  assert.equal(device.faceplate.inventoryRevision, 1);
  assert.equal(profile.inventoryComplete, true);
  assert.deepEqual(profile.evidence.models, ["Catalyst IR1101"]);
  assert.equal(new URL(profile.source).hostname, "www.cisco.com");
  assert.equal(new URL(profile.evidence.front).protocol, "https:");
  assert.match(profile.evidence.configuration, /no PIM|without a PIM/);
  assert.equal(device.ports.length, 8);
  assert.deepEqual(device.ports.slice(0, 4).map((port) => port.speedMbps), [100, 100, 100, 100]);
  assert.deepEqual(device.ports.slice(4).map((port) => port.type), ["RJ45_1G", "SFP_1G", "USB_MINI_CONSOLE", "Console"]);
  assert.ok(device.ports.every((port) => !port.isPoe));
  assert.match(profile.limitations.join(" "), /combo/);
  assert.match(profile.limitations.join(" "), /RS232 DTE/);
});

test("IR1101 traces the SFP/USB and stacked GE/serial column beside its four Fast Ethernet sockets", () => {
  const profile = resolveEnterpriseFaceplate(fixture());
  const slots = new Map(profile.faces.front.ports.map((slot) => [slot.portIndex, slot]));
  assert.equal(profile.faces.front.ports.length, 8);
  assert.equal(profile.faces.rear.ports.length, 0);
  assert.ok(slots.get(6).x < slots.get(5).x && slots.get(5).x < slots.get(1).x);
  assert.equal(slots.get(5).x, slots.get(8).x);
  assert.ok(slots.get(5).y < slots.get(8).y && slots.get(8).y < slots.get(7).y);
  assert.equal(slots.get(7).connectorKind, "usb-mini");
  assert.equal(slots.get(8).connectorKind, "console");
  assert.deepEqual([1, 2, 3, 4].map((index) => slots.get(index).physicalLabel), ["1", "2", "3", "4"]);
  for (const index of [2, 3, 4]) assert.ok(slots.get(index).x > slots.get(index - 1).x);
  const front = profile.faces.front.components;
  const supply = front.find((part) => part.role === "power-alarm");
  assert.equal(supply.kind, "terminal");
  assert.equal(supply.pins, 4);
  assert.equal(supply.variant, "pluggable");
  assert.equal(front.filter((part) => part.role === "pim-blank").length, 1);
  assert.equal(front.filter((part) => part.kind === "usb").length, 1);
  assert.equal(front.filter((part) => part.role === "lan-status").length, 4);
  assert.equal(front.filter((part) => part.kind === "coax").length, 0);
  const rear = profile.faces.rear.components;
  assert.equal(rear.filter((part) => part.role === "panel-fastener").length, 4);
  assert.equal(rear.filter((part) => part.role === "din-mount-hole").length, 2);
  assert.ok(rear.every((part) => ["screw", "service-jack"].includes(part.kind)));
});

test("IR1101 revision-zero records preserve renamed, reordered and gapped identities and the old USB type", () => {
  const device = fixture(true);
  delete device.faceplate.inventoryRevision;
  device.faceplate.unitsU = 2;
  device.rackPosition = 19;
  device.ports[0].label = "PLC";
  device.ports[0].nativeVlan = 18;
  device.ports[0].allowedVlans = [18, 27];
  device.ports[6].label = "Local service";
  device.ports.reverse();
  const snapshot = structuredClone(device);
  assert.equal(upgradeInstalledPhysicalPorts({ devices: [device] }), false);
  const bounds = { x: 31, y: 47, width: 690, height: 200 };
  const front = buildFaceplateScene(device, bounds, { face: "front" });
  const rear = buildFaceplateScene(device, bounds, { face: "rear" });
  assert.equal(front.ports.length, 7);
  assert.equal(rear.ports.length, 0);
  assert.equal(front.unmappedPorts.length, 0);
  assert.equal(rear.hiddenPorts.length, 7);
  const consolePort = front.ports.find((box) => box.port.id === "ir1101-7");
  assert.equal(consolePort.port.type, "USB_MICRO_CONSOLE");
  assert.equal(consolePort.connectorKind, "usb-mini");
  assert.equal(consolePort.displayLabel, "Local service");
  assert.equal(front.ports.find((box) => box.port.id === "ir1101-1").displayLabel, "PLC");
  assert.deepEqual(device, snapshot);
  device.ports = device.ports.filter((port) => [1, 5, 7].includes(port.portIndex));
  const gapped = buildFaceplateScene(device, bounds, { face: "front" });
  assert.deepEqual(gapped.ports.map((box) => box.port.id), ["ir1101-7", "ir1101-5", "ir1101-1"]);
  device.faceplate.inventoryRevision = 99;
  const unknown = buildFaceplateScene(device, bounds, { face: "front" });
  assert.equal(unknown.ports.length, 0);
  assert.equal(unknown.unmappedPorts.length, 3);
});

test("IR1101 actual scenes keep compact sockets and caption boxes clear of adjacent hardware", () => {
  const device = fixture();
  for (const width of [460, 690]) {
    const bounds = { x: 17, y: 23, width, height: 100 };
    for (const face of ["front", "rear"]) {
      const scene = buildFaceplateScene(device, bounds, { face });
      assert.equal(scene.ports.length, face === "front" ? 8 : 0);
      for (const box of [...scene.ports, ...scene.components.filter((part) => !part.applicationOverlay)]) {
        assert.ok([box.x, box.y, box.width, box.height].every(Number.isFinite));
        assert.ok(box.x >= scene.chassis.x && box.x + box.width <= scene.chassis.x + scene.chassis.width);
        assert.ok(box.y >= scene.chassis.y && box.y + box.height <= scene.chassis.y + scene.chassis.height);
      }
      for (const port of scene.ports) {
        assert.ok(port.height <= 23);
        const label = port.labelPlacement;
        const caption = { x: label.x - label.boxMaxWidth / 2, y: label.y - label.boxHeight / 2,
          width: label.boxMaxWidth, height: label.boxHeight };
        assert.ok(caption.y >= scene.chassis.y && caption.y + caption.height <= scene.chassis.y + scene.chassis.height);
        for (const other of scene.ports) assert.ok(!overlap(caption, other), `${port.port.label} caption covers ${other.port.label}`);
      }
    }
  }
});

/** Detect positive-area intersections without treating shared edges as collisions. */
function overlap(a, b) {
  return a.x < b.x + b.width - 1e-6 && a.x + a.width > b.x + 1e-6 &&
    a.y < b.y + b.height - 1e-6 && a.y + a.height > b.y + 1e-6;
}
