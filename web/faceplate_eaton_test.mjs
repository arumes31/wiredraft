import assert from "node:assert/strict";
import test from "node:test";
import { hardwareCatalog, instantiateProfile, upgradeInstalledPhysicalPorts } from "./static/js/catalog.js";
import { resolveEquipmentFaceplate } from "./static/js/faceplate-equipment-models.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";
import { hardwarePrimitives, hardwareComponentSVG } from "./static/js/hardware-components.js";

/** Reconstruct the actual former two-endpoint UPS or the selected current installation. */
function fixture(legacy = false) {
  const current = hardwareCatalog.find((p) => p.vendor === "Eaton" && p.model === "Network UPS family");
  const entry = legacy ? { ...current, inventoryRevision: 0, groups: [
    { zone: "management", count: 1, type: "RJ45_1G", speed: 1000, prefix: "NETWORK" },
    { zone: "management", count: 1, type: "Power", speed: 0, prefix: "AC" },
  ] } : current;
  return instantiateProfile(entry, "Eaton", { x: 0, y: 0 });
}

/** Compare component rectangles, including caption boxes, without treating touching edges as collisions. */
function overlaps(a, b) {
  return a.x < b.x + b.width - 1e-8 && a.x + a.width > b.x + 1e-8 && a.y < b.y + b.height - 1e-8 && a.y + a.height > b.y + 1e-8;
}

test("Eaton selects the eight-output 1500VA 2U chassis and installed M2 card", () => {
  const device = fixture(), profile = resolveEquipmentFaceplate(device);
  assert.equal(profile.fidelity, "model");
  assert.equal(profile.sku, "5PX1500IRT2UG2 + NETWORK-M2");
  assert.deepEqual(device.ports.map((p) => p.type), ["RJ45_1G", "Power", "Console", "USB_MICRO_CONSOLE"]);
  assert.equal(profile.faces.front.ports.length, 0);
  assert.equal(profile.faces.rear.components.filter((p) => p.role === "c13-output").length, 8);
  assert.equal(profile.faces.rear.components.filter((p) => p.kind === "fan").length, 0);
  assert.equal(profile.faces.rear.components.filter((p) => p.role === "rear-exhaust").length, 1);
  assert.equal(profile.faces.rear.ports[2].connectorKind, "eaton-db9");
  assert.equal(profile.faces.rear.ports[3].connectorKind, "eaton-micro");
});

test("Eaton preserves complete former topology and explicitly maps only its two stored endpoints", () => {
  for (const sparse of [false, true]) {
    const device = fixture(true); device.id = "ups"; device.rackId = "rack"; device.rackPosition = 7;
    device.ports.reverse(); if (sparse) device.ports.pop();
    for (const port of device.ports) Object.assign(port, { id: `saved-${port.portIndex}`, deviceId: "ups", label: "Edited label", speedMbps: 100, nativeVlan: 9, allowedVlans: [9, 20] });
    const topology = { devices: [device], links: [{ sourceDeviceId: "ups", sourcePortId: device.ports[0].id, targetDeviceId: "peer", targetPortId: "peer-port" }] };
    const before = structuredClone(topology);
    assert.equal(upgradeInstalledPhysicalPorts(topology), false);
    const scene = buildFaceplateScene(device, { x: 0, y: 0, width: 690, height: 200 }, { face: "rear" });
    assert.equal(scene.ports.length, device.ports.length); assert.equal(scene.unmappedPorts.length, 0);
    assert.deepEqual(topology, before);
    device.faceplate.inventoryRevision = 99;
    const unknown = buildFaceplateScene(device, { x: 0, y: 0, width: 690, height: 200 }, { face: "rear" });
    assert.equal(unknown.ports.length, 0); assert.equal(unknown.unmappedPorts.length, device.ports.length);
  }
});

test("Eaton keeps native body proportions and clear captions in current and saved allocations", () => {
  for (const width of [460, 690]) {
    const native = buildFaceplateScene(fixture(), { x: 0, y: 0, width, height: 200 }, { face: "rear" });
    for (const units of [1, 2, 4]) for (const legacy of [false, true]) for (const face of ["front", "rear"]) {
      const device = fixture(legacy); device.faceplate.unitsU = units;
      for (const port of device.ports) port.label = "A deliberately long saved customer circuit caption";
      const scene = buildFaceplateScene(device, { x: 0, y: 0, width, height: units * 100 }, { face });
      assert.ok(Math.abs(scene.chassis.height / scene.chassis.width - native.chassis.height / native.chassis.width) < 1e-9);
      for (const port of scene.ports) {
        const l = port.labelPlacement, caption = { x: l.x - l.boxMaxWidth / 2, y: l.y - l.boxHeight / 2, width: l.boxMaxWidth, height: l.boxHeight };
        assert.ok(caption.x >= scene.chassis.x && caption.x + caption.width <= scene.chassis.x + scene.chassis.width);
        assert.ok(caption.y >= scene.chassis.y && caption.y + caption.height <= scene.chassis.y + scene.chassis.height);
        for (const other of [...scene.ports, ...scene.components.filter((p) => !p.applicationOverlay)]) assert.ok(!overlaps(caption, other), `${units}U ${width} caption${port.port.portIndex} overlaps ${other.role || other.kind}`);
      }
    }
  }
});

test("Eaton's keyed inlet, DB9 and portrait card sockets render bounded shared primitives", () => {
  for (const width of [460, 690]) for (const units of [1, 2, 4]) for (const face of ["front", "rear"]) {
    const device = fixture(); device.faceplate.unitsU = units;
    const scene = buildFaceplateScene(device, { x: 0, y: 0, width, height: units * 100 }, { face });
    for (const component of [...scene.components.filter((p) => !p.applicationOverlay), ...scene.ports.map((p) => ({ ...p, kind: p.connectorKind }))]) {
      const parts = hardwarePrimitives(component); assert.ok(parts.length); assert.ok(hardwareComponentSVG(component));
      for (const p of parts) {
        const points = p.kind === "rect" ? [[p.x,p.y],[p.x+p.width,p.y+p.height]] : p.kind === "circle" ? [[p.cx-p.r,p.cy-p.r],[p.cx+p.r,p.cy+p.r]] : p.kind === "line" ? [[p.x1,p.y1],[p.x2,p.y2]] : p.kind === "polygon" ? p.points : [];
        const stroke = p.stroke ? p.strokeWidth / 2 : 0;
        for (const [x,y] of points) assert.ok(x-stroke >= component.x-1e-6 && x+stroke <= component.x+component.width+1e-6 && y-stroke >= component.y-1e-6 && y+stroke <= component.y+component.height+1e-6, `${component.role || component.kind}: ${p.kind} bounds`);
      }
    }
  }
});
