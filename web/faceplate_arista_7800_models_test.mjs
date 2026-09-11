import assert from "node:assert/strict";
import test from "node:test";
import { hardwareCatalog, instantiateProfile, upgradeInstalledPhysicalPorts } from "./static/js/catalog.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";
import { hardwarePrimitives } from "./static/js/hardware-components.js";

const mapping = new Map([...Array.from({ length: 8 }, (_, i) => [49 + i, 1 + i]), [57, 37], [58, 39]]);

/** Independently reconstruct the actual original58-port2U constructor while preserving stable identities. */
function fixture(legacy = false) {
  let catalog = hardwareCatalog.find((row) => row.vendor === "Arista" && row.model === "7800 family");
  if (legacy) catalog = { ...catalog, units: 2, inventoryRevision: 0, groups: [
    { zone: "uplink", count: 48, type: "SFP28_25G", speed: 25000, poe: false, prefix: "SFP28" },
    { zone: "uplink", count: 8, type: "QSFP_DD_400G", speed: 400000, poe: false, prefix: "QSFP-DD" },
    { zone: "management", count: 1, type: "RJ45_1G", speed: 1000, poe: false, prefix: "MGMT" },
    { zone: "management", count: 1, type: "Console", speed: 0, poe: false, prefix: "CONSOLE" },
  ] };
  const device = instantiateProfile(catalog, "7800 family", { x: 21, y: 35 });
  device.id = "saved7800";
  for (const port of device.ports) { port.id = `${device.id}-${port.portIndex}`; port.deviceId = device.id; }
  return device;
}

/** Build the chosen face at its actual current or saved allocation. */
function scene(device, width = 690, face = "front") {
  return buildFaceplateScene(device, { x: 0, y: 0, width, height: device.faceplate.unitsU * 100 }, { face });
}

/** Detect positive-area intersections while allowing adjacent traced boundaries. */
function overlaps(a, b) {
  return a.x < b.x + b.width - 1e-8 && a.x + a.width > b.x + 1e-8 && a.y < b.y + b.height - 1e-8 && a.y + a.height > b.y + 1e-8;
}

/** Account for strokes and conservative text bounds in all shared hardware primitive types. */
function primitiveBounds(part) {
  const half = part.stroke ? (part.strokeWidth || 0) / 2 : 0;
  if (part.kind === "text") return [part.x - part.text.length * part.fontSize * .31, part.y - part.fontSize / 2, part.x + part.text.length * part.fontSize * .31, part.y + part.fontSize / 2];
  if (part.kind === "polygon") return [Math.min(...part.points.map(([x]) => x)) - half, Math.min(...part.points.map(([, y]) => y)) - half, Math.max(...part.points.map(([x]) => x)) + half, Math.max(...part.points.map(([, y]) => y)) + half];
  if (part.kind === "circle") return [part.cx - part.r - half, part.cy - part.r - half, part.cx + part.r + half, part.cy + part.r + half];
  if (part.kind === "line") return [Math.min(part.x1, part.x2) - half, Math.min(part.y1, part.y2) - half, Math.max(part.x1, part.x2) + half, Math.max(part.y1, part.y2) + half];
  return [part.x - half, part.y - half, part.x + part.width + half, part.y + part.height + half];
}

test("7800 discloses exact7804R3 hardware population and native39-endpoint10U inventory", () => {
  const device = fixture(), front = scene(device), profile = front.profile;
  assert.equal(device.faceplate.unitsU, 10); assert.equal(device.ports.length, 39);
  assert.equal(profile.sku, "DCS-7804R3-BND"); assert.equal(profile.inventoryRevision, 1);
  assert.equal(profile.fidelity, "model"); assert.equal(profile.rearHardwareVerified, true);
  assert.deepEqual(profile.evidence.models, ["DCS-7804R3-BND"]);
  assert.equal(profile.evidence.selectedModel, "DCS-7804R3-BND"); assert.equal(profile.evidence.catalogAlias, "7800 family");
  assert.equal(front.ports.length, 39); assert.equal(scene(device, 690, "rear").ports.length, 0);
  assert.deepEqual(device.ports.slice(36).map((port) => port.type), ["RJ45_1G", "SFP_1G", "Console"]);
  assert.ok(device.ports.slice(0, 36).every((port) => port.type === "QSFP_DD_400G"));
  const parts = profile.faces.front.components, fabrics = profile.faces.rear.components.filter((part) => part.kind === "fabric-module");
  assert.equal(parts.filter((part) => part.sku === "PWR-D1-3041-AC-BLUE").length, 6);
  assert.deepEqual(parts.filter((part) => part.kind === "psu").map((part) => [part.role, part.inputCount]), [["PS3", 2], ["PS4", 2], ["PS5", 2], ["PS6", 2], ["PS7", 2], ["PS8", 2]]);
  assert.equal(parts.filter((part) => part.sku === "DCS-7800-PCVR").length, 2);
  assert.equal(parts.filter((part) => part.sku === "DCS-7800-LCVR").length, 3);
  assert.equal(parts.filter((part) => part.sku === "DCS-7800-SCVR").length, 1);
  assert.equal(fabrics.length, 6); assert.ok(fabrics.every((part) => part.sku === "DCS-7804R3-FM" && part.fanCount === 4 && part.fanSKU === "FAN-7802-H"));
  assert.equal(profile.faces.rear.components.filter((part) => part.kind === "psu").length, 0);
});

test("true saved constructor preserves every endpoint and cable while mapping only compatible indices", () => {
  for (const renamed of [false, true]) {
    const device = fixture(true); device.ports.reverse(); device.rackId = "original-rack"; device.rackPosition = 19;
    for (const port of device.ports) { if (renamed) port.label = `Edited ${port.portIndex}`; port.speedMbps = 100; port.nativeVlan = 31; port.allowedVlans = [31, 81]; port.isPoe = true; }
    const topology = { devices: [device], links: [{ id: "original-link", sourceDeviceId: device.id, sourcePortId: "saved7800-49", targetDeviceId: "peer", targetPortId: "peer-port" }] };
    const before = structuredClone(topology), front = scene(device);
    assert.equal(device.ports.length, 58); assert.equal(device.faceplate.unitsU, 2);
    assert.equal(upgradeInstalledPhysicalPorts(topology), false);
    assert.equal(front.ports.length, 10); assert.equal(front.unmappedPorts.length, 48);
    assert.deepEqual(front.ports.map((slot) => slot.port.portIndex).sort((a, b) => a - b), [...mapping.keys()]);
    assert.equal(front.components.filter((part) => part.ancillarySocket).length, 29);
    assert.deepEqual(topology, before);
    if (renamed) assert.ok(front.ports.every((slot) => slot.displayLabel === slot.port.label));
    for (const slot of front.ports) {
      const physical = front.profile.faces.front.ports.find((entry) => entry.portIndex === mapping.get(slot.port.portIndex));
      assert.ok(Math.abs((slot.centerX - front.chassis.x) / front.chassis.width - physical.x) < 1e-8);
      assert.equal(slot.connectorKind, physical.connectorKind);
    }
  }
});

test("sparse reordered, edited-type, duplicate and unknown revision inventories remain unmigrated", () => {
  const device = fixture(true); delete device.faceplate.inventoryRevision;
  device.ports = device.ports.filter((port) => [1, 49, 57, 58].includes(port.portIndex)).reverse();
  const before = structuredClone(device); assert.equal(scene(device).ports.length, 3); assert.deepEqual(device, before);
  device.ports.find((port) => port.portIndex === 49).type = "SFP28_25G";
  assert.equal(scene(device).ports.length, 2);
  device.ports.push({ ...device.ports.find((port) => port.portIndex === 57), id: "duplicate-mgmt" });
  assert.equal(scene(device).ports.length, 2); assert.equal(scene(device).unmappedPorts.length, 3);
  device.faceplate.inventoryRevision = 987;
  for (const face of ["front", "rear"]) { const panel = scene(device, 690, face); assert.equal(panel.ports.length, 0); assert.equal(panel.unmappedPorts.length, 5); }
  assert.equal(scene(device).components.filter((part) => part.ancillarySocket).length, 39);
});

test("native and saved proportions retain physical socket scaling at460/690 without changing occupancy", () => {
  for (const width of [460, 690]) {
    const saved = fixture(true), before = structuredClone(saved), native = scene(fixture(), width), old = scene(saved, width);
    assert.ok(Math.abs(native.chassis.width / native.chassis.height - old.chassis.width / old.chassis.height) < 1e-8);
    assert.ok(old.chassis.height <= 184 && old.chassis.width < native.chassis.width);
    for (const slot of old.ports) {
      const current = native.ports.find((entry) => entry.port.portIndex === mapping.get(slot.port.portIndex));
      assert.ok(Math.abs(slot.width / current.width - old.chassis.width / native.chassis.width) < 1e-8);
      assert.ok(Math.abs(slot.height / current.height - old.chassis.height / native.chassis.height) < 1e-8);
    }
    if (width === 460) assert.ok(Math.abs(native.chassis.height / native.chassis.width - 439 / 441) < 1e-8);
    assert.deepEqual(saved, before);
  }
});

test("source36D card keeps odd/even vertical cages and separate copper/optical supervisor management", () => {
  const ports = scene(fixture(), 460).profile.faces.front.ports;
  for (let index = 1; index <= 36; index += 2) {
    const odd = ports.find((part) => part.portIndex === index), even = ports.find((part) => part.portIndex === index + 1);
    assert.equal(odd.x, even.x); assert.ok(odd.y < even.y); assert.ok(odd.width < odd.height);
    assert.equal(odd.connectorKind, "qsfp-vertical"); assert.equal(even.connectorKind, "qsfp-vertical");
    assert.equal(odd.width, .019); assert.equal(even.width, .019);
  }
  for (const width of [460, 690]) for (const legacy of [false, true]) {
    const result = scene(fixture(legacy), width), physical = [...result.ports.filter((slot) => slot.connectorKind === "qsfp-vertical"), ...result.components.filter((part) => part.kind === "qsfp-vertical")];
    assert.equal(physical.length, 36);
    for (const slot of physical) {
      const ratio = slot.height / slot.width;
      assert.ok(width === 460 ? ratio > 1.9 && ratio < 2.1 : ratio > 1.3 && ratio < 1.4, `${width} portrait ratio ${ratio}`);
    }
  }
  assert.equal(ports.find((part) => part.portIndex === 38).connectorKind, "sfp");
  for (const slot of scene(fixture(), 460).ports.filter((part) => part.port.portIndex <= 36)) {
    assert.ok(slot.labelPlacement.maxWidth >= 6.6, "Native two-digit port numbers retain readable reserved caption width");
  }
});

test("current and saved sockets/captions clear all source hardware at460/690", () => {
  for (const width of [460, 690]) for (const legacy of [false, true]) for (const renamed of [false, true]) for (const face of ["front", "rear"]) {
    const device = fixture(legacy); if (renamed) for (const port of device.ports) port.label = `Long saved custom caption ${port.portIndex}`;
    const panel = scene(device, width, face), captions = [], hardware = panel.components.filter((part) => !part.applicationOverlay);
    for (const slot of panel.ports) {
      const label = slot.labelPlacement, w = Math.min(label.boxMaxWidth, Math.max(12, Math.min(label.maxWidth, slot.displayLabel.length * label.fontSize) + 6));
      const box = { x: label.x - w / 2, y: label.y - label.boxHeight / 2, width: w, height: label.boxHeight };
      assert.ok(box.x >= panel.chassis.x && box.y >= panel.chassis.y && box.x + box.width <= panel.chassis.x + panel.chassis.width + 1e-8 && box.y + box.height <= panel.chassis.y + panel.chassis.height + 1e-8);
      for (const other of [...hardware, ...panel.ports, ...captions]) assert.ok(!overlaps(box, other), `${width} ${legacy} caption${slot.port.portIndex} overlaps${other.role || "socket/caption"}`);
      for (const other of hardware) assert.ok(!overlaps(slot, other), `${width} ${legacy} socket${slot.port.portIndex} overlaps${other.role}`);
      captions.push(box);
    }
  }
});

test("all source housing and ancillary socket primitives stay inside component bounds at1x/2x", () => {
  for (const width of [460, 690]) for (const legacy of [false, true]) for (const scale of [1, 2]) for (const face of ["front", "rear"]) {
    const panel = scene(fixture(legacy), width, face);
    for (const part of panel.components.filter((entry) => !entry.applicationOverlay)) {
      const component = { ...part, x: part.x * scale, y: part.y * scale, width: part.width * scale, height: part.height * scale };
      const primitives = hardwarePrimitives(component); assert.ok(primitives.length);
      for (const primitive of primitives) {
        const [left, top, right, bottom] = primitiveBounds(primitive);
        assert.ok(left >= component.x - 1e-8 && top >= component.y - 1e-8 && right <= component.x + component.width + 1e-8 && bottom <= component.y + component.height + 1e-8, `${width} ${legacy} ${scale} ${part.role} ${JSON.stringify(primitive)}`);
      }
    }
  }
});
