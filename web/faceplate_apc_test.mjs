import assert from "node:assert/strict";
import test from "node:test";
import { hardwareCatalog, instantiateProfile, upgradeInstalledPhysicalPorts } from "./static/js/catalog.js";
import { resolveEquipmentFaceplate } from "./static/js/faceplate-equipment-models.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";
import { hardwarePrimitives, hardwareComponentSVG } from "./static/js/hardware-components.js";

/** Construct the current selection or the actual former two-endpoint UPS inventory. */
function fixture(legacy = false) {
  const current = hardwareCatalog.find((p) => p.vendor === "APC" && p.model === "Smart-UPS Network family");
  const entry = legacy ? { ...current, inventoryRevision: 0, groups: [
    { zone: "management", count: 1, type: "RJ45_1G", speed: 1000, prefix: "NMC" },
    { zone: "management", count: 1, type: "Power", speed: 0, prefix: "AC" },
  ] } : current;
  return instantiateProfile(entry, "UPS", { x: 10, y: 20 });
}

test("APC selects the 230V four-outlet SMT1500RMI2U and installed AP9641 card", () => {
  const device = fixture(), profile = resolveEquipmentFaceplate(device);
  assert.equal(profile.fidelity, "model");
  assert.equal(profile.sku, "SMT1500RMI2U + AP9641");
  assert.equal(device.ports.length, 4);
  assert.deepEqual(profile.faces.front.ports, []);
  assert.equal(profile.faces.rear.ports.length, 4);
  assert.equal(profile.faces.rear.components.filter((p) => p.role === "c13-output").length, 4);
  assert.equal(profile.faces.rear.components.filter((p) => p.kind === "fan").length, 1);
  assert.equal(profile.faces.rear.components.filter((p) => p.role === "environmental-io").length, 2);
  assert.equal(profile.faces.rear.ports[2].type, "Console");
  assert.equal(profile.faces.rear.ports[3].type, "USB_MICRO_CONSOLE");
});

test("APC preserves old power and NMC endpoints without appending new service connectors", () => {
  for (const sparse of [false, true]) {
    const device = fixture(true); device.id = "ups"; device.rackId = "rack"; device.rackPosition = 10;
    device.ports.reverse(); if (sparse) device.ports.pop();
    for (const port of device.ports) Object.assign(port, { id: `saved-${port.portIndex}`, deviceId: "ups", label: "Custom", speedMbps: 100, nativeVlan: 7, allowedVlans: [7, 9], isPoe: true });
    const topology = { devices: [device], links: [{ sourceDeviceId: "ups", sourcePortId: device.ports[0].id, targetDeviceId: "peer", targetPortId: "peer-port" }] };
    const before = structuredClone(topology);
    assert.equal(upgradeInstalledPhysicalPorts(topology), false);
    const scene = buildFaceplateScene(device, { x: 0, y: 0, width: 690, height: 200 }, { face: "rear" });
    assert.equal(scene.ports.length, device.ports.length); assert.equal(scene.unmappedPorts.length, 0);
    assert.ok(scene.ports.every((slot) => slot.displayLabel === "Custom"));
    assert.deepEqual(topology, before);
    device.faceplate.inventoryRevision = 99;
    const unknown = buildFaceplateScene(device, { x: 0, y: 0, width: 690, height: 200 }, { face: "rear" });
    assert.equal(unknown.ports.length, 0); assert.equal(unknown.unmappedPorts.length, device.ports.length);
  }
});

test("APC sockets and captions avoid the card, outlets and rear fan at both rack widths", () => {
  for (const width of [460, 690]) for (const face of ["front", "rear"]) {
    const scene = buildFaceplateScene(fixture(), { x: 0, y: 0, width, height: 200 }, { face });
    for (const slot of scene.ports) {
      const label = slot.labelPlacement;
      const w = Math.min(label.boxMaxWidth, slot.displayLabel.length * label.fontSize * .7 + 6);
      const box = { x: label.x - w / 2, y: label.y - label.boxHeight / 2, width: w, height: label.boxHeight };
      for (const other of [...scene.ports, ...scene.components]) assert.ok(
        box.x + box.width <= other.x || other.x + other.width <= box.x || box.y + box.height <= other.y || other.y + other.height <= box.y,
        `${slot.displayLabel} overlaps ${other.kind || other.port?.portIndex}`);
    }
  }
});

test("APC physical proportions and hardware stay bounded in saved allocations and both renderers", () => {
  const native = buildFaceplateScene(fixture(), { x: 0, y: 0, width: 690, height: 200 }, { face: "rear" });
  for (const width of [460, 690]) for (const units of [1, 2, 4]) for (const face of ["front", "rear"]) {
    const device = fixture(); device.faceplate.unitsU = units;
    const scene = buildFaceplateScene(device, { x: 0, y: 0, width, height: units * 100 }, { face });
    assert.ok(Math.abs(scene.chassis.height / scene.chassis.width * width / 690 - native.chassis.height / native.chassis.width) < 1e-9);
    for (const component of [...scene.components, ...scene.ports.map((p) => ({ ...p, kind: p.connectorKind }))]) {
      const primitives = hardwarePrimitives(component);
      assert.ok(primitives.length > 0);
      assert.ok(hardwareComponentSVG(component).length > 0);
      for (const p of primitives) {
        const points = p.kind === "rect" ? [[p.x,p.y],[p.x+p.width,p.y+p.height]]
          : p.kind === "circle" ? [[p.cx-p.r,p.cy-p.r],[p.cx+p.r,p.cy+p.r]]
            : p.kind === "line" ? [[p.x1,p.y1],[p.x2,p.y2]] : p.kind === "polygon" ? p.points : [];
        const stroke = p.stroke ? p.strokeWidth / 2 : 0;
        for (const [x,y] of points) assert.ok(x-stroke >= component.x-1e-6 && x+stroke <= component.x+component.width+1e-6 &&
          y-stroke >= component.y-1e-6 && y+stroke <= component.y+component.height+1e-6, `${component.role || component.kind}: ${p.kind} outside bounds`);
      }
    }
  }
});
