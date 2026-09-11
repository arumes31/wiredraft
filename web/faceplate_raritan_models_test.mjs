import assert from "node:assert/strict";
import test from "node:test";
import { hardwareCatalog, instantiateProfile, upgradeInstalledPhysicalPorts } from "./static/js/catalog.js";
import { resolveEquipmentFaceplate } from "./static/js/faceplate-equipment-models.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";

/** Recreate the original 50-entry serial-server inventory before the selected modem chassis was authored. */
function fixture(legacy = false) {
  const catalog = hardwareCatalog.find((item) => item.vendor === "Raritan" && item.model === "Dominion Serial family");
  const old = { ...catalog, inventoryRevision: 0, groups: [
    { zone: "access", count: 48, type: "Console", speed: 0, prefix: "SERIAL", poe: false },
    { zone: "management", count: 2, type: "RJ45_1G", speed: 1000, prefix: "MGMT", poe: false },
  ] };
  const device = instantiateProfile(legacy ? old : catalog, catalog.model, { x: 20, y: 40 });
  device.ports.forEach((port) => { port.id = `raritan-${port.portIndex}`; });
  return device;
}

/** Treat touching rectangle edges as clear space when checking actual rendered captions. */
function overlaps(a, b) {
  return a.x < b.x + b.width - 1e-9 && a.x + a.width > b.x + 1e-9 &&
    a.y < b.y + b.height - 1e-9 && a.y + a.height > b.y + 1e-9;
}

test("Raritan explicitly selects the DSX2-48M dual-AC modem chassis and its 53 distinct cable endpoints", () => {
  const device = fixture();
  const profile = resolveEquipmentFaceplate(device);
  assert.equal(profile.fidelity, "model");
  assert.equal(profile.inventoryRevision, 1);
  assert.equal(profile.inventoryComplete, true);
  assert.match(profile.sku, /DSX2-48M.*dual AC/);
  assert.equal(device.faceplate.inventoryRevision, 1);
  assert.equal(profile.defaultFace, "rear");
  assert.equal(new URL(profile.evidence.stencil).hostname, "www.raritan.com");
  assert.match(profile.evidence.provenance, /manufacturer.*stencil/i);
  assert.match(profile.limitations.join(" "), /56.*POTS/);
  assert.deepEqual(device.ports.map((port) => [port.type, port.speedMbps]), [
    ...Array.from({ length: 48 }, () => ["Console", 0]), ["RJ45_1G", 1000], ["RJ45_1G", 1000],
    ["Console", 0], ["USB_MINI_CONSOLE", 0], ["POTS_RJ11", 0],
  ]);
  assert.deepEqual(device.ports.slice(48).map((port) => port.label), ["LAN1", "LAN2", "TERMINAL", "ADMIN", "MODEM"]);
  assert.deepEqual(device.ports.slice(50).map((port) => [port.mode, port.nativeVlan, port.allowedVlans, port.isPoe]),
    Array.from({ length: 3 }, () => ["Unconfigured", 0, [], false]));
  assert.equal(profile.faces.front.ports.length, 0);
  assert.equal(profile.faces.rear.ports.length, 53);
});

test("DSX2-48M follows each sixteen-port bank, LAN2 above LAN1, and the separate local service sockets", () => {
  const profile = resolveEquipmentFaceplate(fixture());
  const slots = new Map(profile.faces.rear.ports.map((slot) => [slot.portIndex, slot]));
  for (const first of [1, 17, 33]) for (let offset = 0; offset < 8; offset++) {
    const lower = slots.get(first + offset), upper = slots.get(first + offset + 8);
    assert.equal(lower.x, upper.x);
    assert.ok(lower.y > upper.y);
    assert.equal(lower.physicalLabel, String(first + offset));
    assert.equal(upper.physicalLabel, String(first + offset + 8));
    assert.equal(upper.connectorKind, "console-inverted");
    assert.equal(lower.connectorKind, undefined);
    if (offset) assert.ok(lower.x > slots.get(first + offset - 1).x);
  }
  assert.equal(slots.get(49).x, slots.get(50).x);
  assert.ok(slots.get(50).y < slots.get(49).y);
  assert.equal(slots.get(50).connectorKind, "rj45-inverted");
  assert.equal(slots.get(49).connectorKind, undefined);
  assert.ok(slots.get(51).x < slots.get(52).x && slots.get(52).x < slots.get(53).x);
  assert.equal(slots.get(52).connectorKind, "usb-mini");
  assert.equal(slots.get(53).connectorKind, "rj11");
  const front = profile.faces.front.components, rear = profile.faces.rear.components;
  const power = front.filter((part) => part.kind === "power");
  assert.equal(power.length, 2);
  assert.ok(power.every((part) => part.variant === "ac-c14-inverted"));
  assert.ok(power.find((part) => part.role === "power-2").x < power.find((part) => part.role === "power-1").x);
  assert.equal(front.filter((part) => part.kind === "led" && part.variant === "square").length, 48);
  assert.equal(front.find((part) => part.role === "power-status").color, front.find((part) => part.role === "serial-status-1").color);
  assert.equal(front.filter((part) => part.kind === "usb").length, 1);
  assert.equal(rear.filter((part) => part.kind === "usb").length, 3);
  assert.equal(rear.filter((part) => part.kind === "dvi-d").length, 1);
  assert.equal(rear.filter((part) => part.kind === "led").length, 0);
  for (const panel of [front, rear]) {
    assert.equal(panel.filter((part) => part.role === "rack-mount" && part.kind === "mounting-slot").length, 4);
    assert.ok(panel.every((part) => part.kind !== "handle"));
  }
  assert.ok(rear.every((part) => !["power", "psu", "fan"].includes(part.kind)));
});

test("DSX2-48M keeps all original 50 port identities and settings without appending services to saved devices", () => {
  const device = fixture(true);
  delete device.faceplate.inventoryRevision;
  assert.deepEqual(device.ports.slice(0, 3).map((port) => port.label), ["1", "2", "3"]);
  device.rackId = "serial-rack"; device.rackPosition = 19;
  device.ports[0].label = "MGMT1"; // A user label that resembles an unrelated generated caption remains a rename.
  device.ports[0].speedMbps = 100; device.ports[0].nativeVlan = 73;
  device.ports[0].allowedVlans = [73, 91]; device.ports[0].isPoe = true;
  device.ports[49].label = "Secondary network";
  device.ports.reverse();
  const before = structuredClone(device);
  assert.equal(upgradeInstalledPhysicalPorts({ devices: [device] }), false);
  const bounds = { x: 10, y: 20, width: 690, height: 100 };
  const scene = buildFaceplateScene(device, bounds, { face: "rear" });
  const current = buildFaceplateScene(fixture(), bounds, { face: "rear" });
  assert.equal(scene.ports.length, 50);
  assert.equal(scene.unmappedPorts.length, 0);
  assert.ok(scene.components.every((part) => part.role !== "admin-caption-leader"));
  for (const box of scene.ports) {
    const canonical = current.ports.find((item) => item.port.portIndex === box.port.portIndex);
    assert.deepEqual([box.centerX, box.centerY], [canonical.centerX, canonical.centerY]);
  }
  assert.equal(scene.ports.find((box) => box.port.id === "raritan-1").displayLabel, "MGMT1");
  assert.equal(scene.ports.find((box) => box.port.id === "raritan-49").displayLabel, "LAN1");
  assert.equal(scene.ports.find((box) => box.port.id === "raritan-50").displayLabel, "Secondary network");
  assert.deepEqual(device, before);
  device.ports = device.ports.filter((port) => [1, 23, 50].includes(port.portIndex));
  assert.equal(buildFaceplateScene(device, bounds, { face: "rear" }).ports.length, 3);
  device.faceplate.inventoryRevision = 99;
  const unknown = buildFaceplateScene(device, bounds, { face: "rear" });
  assert.equal(unknown.ports.length, 0);
  assert.equal(unknown.unmappedPorts.length, 3);
  assert.ok(unknown.components.every((part) => part.role !== "admin-caption-leader"));
});

test("ADMIN annotations disappear when that exact physical endpoint is absent or no longer bindable", () => {
  for (const change of [
    (device) => { device.ports = device.ports.filter((port) => port.portIndex !== 52); },
    (device) => { device.ports[51].type = "RJ45_1G"; },
    (device) => { device.faceplate.inventoryRevision = 99; },
  ]) {
    const device = fixture(); change(device);
    const scene = buildFaceplateScene(device, { x: 10, y: 40, width: 690, height: 100 }, { face: "rear" });
    assert.ok(scene.ports.every((box) => box.port.portIndex !== 52));
    assert.ok(scene.components.every((part) => part.role !== "admin-caption-leader"));
  }
});

test("DSX2-48M preserves settings even when current inventories retain their generated captions", () => {
  const device = fixture();
  const network = device.ports[48];
  network.speedMbps = 100; network.mode = "Trunk"; network.group = "saved group";
  network.nativeVlan = 27; network.allowedVlans = [27, 90]; network.isPoe = true;
  const before = structuredClone(device);
  assert.equal(upgradeInstalledPhysicalPorts({ devices: [device] }), false);
  assert.deepEqual(device, before);
});

test("ADMIN leader reaches the center of its own caption at every supported display width", () => {
  for (const width of [460, 690]) for (const label of ["ADMIN", "A", "Saved admin console"]) {
    const device = fixture(); device.ports[51].label = label;
    const scene = buildFaceplateScene(device, { x: 10, y: 40, width, height: 100 }, { face: "rear" });
    const admin = scene.ports.find((box) => box.port.portIndex === 52);
    const last = scene.components.filter((part) => part.role === "admin-caption-leader").at(-1);
    assert.ok(last.x <= admin.labelPlacement.x && last.x + last.width >= admin.labelPlacement.x,
      `${width}/${label}: the leader must meet the caption rather than stop in a visible gap`);
    assert.equal(last.captionPortIndex, 52);
  }
});

test("DSX2-48M captions and source-sized sockets stay clear at compact and normal widths", () => {
  const device = fixture();
  for (const width of [460, 690]) for (const face of ["front", "rear"]) {
    const scene = buildFaceplateScene(device, { x: 10, y: 40, width, height: 100 }, { face });
    assert.equal(scene.unmappedPorts.length, 0);
    const captions = [];
    for (const port of scene.ports) {
      assert.ok(port.height <= 23);
      const label = port.labelPlacement;
      const captionWidth = Math.min(label.boxMaxWidth, Math.max(12,
        Math.min(label.maxWidth, port.displayLabel.length * label.fontSize) + 6));
      const caption = { x: label.x - captionWidth / 2, y: label.y - label.boxHeight / 2,
        width: captionWidth, height: label.boxHeight };
      captions.push({ ...caption, label: port.displayLabel });
      assert.ok(caption.y >= scene.chassis.y && caption.y + caption.height <= scene.chassis.y + scene.chassis.height);
      for (const obstacle of [...scene.ports, ...scene.components.filter((part) => part.kind !== "text")]) {
        // The caption renders above only its explicitly associated annotation endpoint.
        if (obstacle.applicationOverlay && obstacle.captionPortIndex === port.port.portIndex) continue;
        assert.ok(!overlaps(caption, obstacle), `${width}: ${port.displayLabel} caption overlaps ${obstacle.role || obstacle.kind || obstacle.port.id}`);
      }
    }
    for (const [index, caption] of captions.entries()) for (const other of captions.slice(index + 1)) {
      assert.ok(!overlaps(caption, other), `${width}: captions ${caption.label}/${other.label} overlap`);
    }
    const leaders = scene.components.filter((part) => part.role === "admin-caption-leader");
    if (face === "rear") {
      assert.equal(leaders.length, 4);
      assert.ok(leaders.every((part) => part.kind === "leader-line" && part.applicationOverlay));
      const mini = scene.ports.find((port) => port.port.portIndex === 52);
      assert.equal(leaders[0].y, mini.y + mini.height);
      assert.ok(Math.abs(leaders[0].x + leaders[0].width / 2 - mini.centerX) < 1e-8);
      const dviCaption = scene.components.find((part) => part.kind === "text" && part.label === "DVI");
      assert.ok(dviCaption);
      assert.ok(!overlaps(captions.find((caption) => caption.label === "ADMIN"), dviCaption));
    }
    for (const leader of leaders) for (const obstacle of [...scene.ports,
      ...scene.components.filter((part) => !["text"].includes(part.kind) && !part.annotation)]) {
      assert.ok(!overlaps(leader, obstacle), `${width}: ADMIN leader overlaps ${obstacle.role || obstacle.port?.id}`);
    }
  }
});
