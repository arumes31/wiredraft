import assert from "node:assert/strict";
import test from "node:test";
import { hardwareCatalog, instantiateProfile, upgradeInstalledPhysicalPorts } from "./static/js/catalog.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";
import { hardwarePrimitives, hardwareComponentSVG, drawHardwareComponent } from "./static/js/hardware-components.js";

const cases = [["ICX 7150 family", "ICX7150-48P-4X10GR", 57, 56, 1], ["ICX 7250 family", "ICX7250-48", 58, 58, 0]];

/** Reconstruct the actual checkpoint438 constructor, including its two separate Stack endpoints and multi-gigabit type. */
function fixture(model, legacy = false) {
  let catalog = hardwareCatalog.find((row) => row.vendor === "Ruckus" && row.model === model);
  if (legacy) catalog = { ...catalog, inventoryRevision: 0, units: 1, groups: [
    { zone: "access", count: 48, type: "RJ45_MGIG", speed: 2500, poe: true, prefix: "" },
    { zone: "uplink", count: 8, type: "SFP28_25G", speed: 25000, poe: false, prefix: "SFP28" },
    { zone: "management", count: 1, type: "RJ45_1G", speed: 1000, poe: false, prefix: "MGMT" },
    { zone: "uplink", count: 2, type: "Stack", speed: 40000, poe: false, prefix: "STACK" },
  ] };
  const device = instantiateProfile(catalog, model, { x: 23, y: 51 });
  device.id = model; device.ports.forEach((port) => { port.id = `${model}-${port.portIndex}`; port.deviceId = model; });
  return device;
}

/** Build the requested physical face using the saved rack allocation. */
function scene(device, width = 690, face = "front") {
  return buildFaceplateScene(device, { x: 0, y: 0, width, height: device.faceplate.unitsU * 100 }, { face });
}

/** Detect genuine area intersections without treating adjacent boundaries as collisions. */
function overlaps(a, b) { return a.x < b.x + b.width - 1e-8 && a.x + a.width > b.x + 1e-8 && a.y < b.y + b.height - 1e-8 && a.y + a.height > b.y + 1e-8; }

/** Include strokes and conservative glyph extents when verifying every generated primitive. */
function bounds(part) {
  const half = part.stroke ? (part.strokeWidth || 0) / 2 : 0;
  if (part.kind === "text") return [part.x - part.text.length * part.fontSize * .31, part.y - part.fontSize / 2, part.x + part.text.length * part.fontSize * .31, part.y + part.fontSize / 2];
  if (part.kind === "polygon") return [Math.min(...part.points.map(([x]) => x)) - half, Math.min(...part.points.map(([, y]) => y)) - half, Math.max(...part.points.map(([x]) => x)) + half, Math.max(...part.points.map(([, y]) => y)) + half];
  if (part.kind === "circle") return [part.cx - part.r - half, part.cy - part.r - half, part.cx + part.r + half, part.cy + part.r + half];
  if (part.kind === "line") return [Math.min(part.x1, part.x2) - half, Math.min(part.y1, part.y2) - half, Math.max(part.x1, part.x2) + half, Math.max(part.y1, part.y2) + half];
  return [part.x - half, part.y - half, part.x + part.width + half, part.y + part.height + half];
}

for (const [model, sku, total, frontCount, rearCount] of cases) {
  test(`${model} discloses one complete exact selection with the source service connectors`, () => {
    const device = fixture(model), front = scene(device), rear = scene(device, 690, "rear");
    assert.equal(device.ports.length, total); assert.equal(device.faceplate.unitsU, 1);
    assert.equal(front.profile.sku, sku); assert.equal(front.profile.fidelity, "model"); assert.equal(front.profile.rearHardwareVerified, true);
    assert.deepEqual(front.profile.evidence.models, [sku]); assert.equal(front.profile.evidence.selectedModel, sku);
    assert.equal(front.ports.length, frontCount); assert.equal(rear.ports.length, rearCount);
    assert.equal(front.components.filter((part) => part.ancillarySocket).length, 0); assert.equal(rear.components.filter((part) => part.ancillarySocket).length, 0);
    assert.ok(device.ports.slice(0, 48).every((port) => port.type === "RJ45_1G"));
    assert.equal(rear.profile.faces.rear.components.filter((part) => part.kind === "fan").length, 2);
    assert.equal(rear.profile.faces.rear.components.filter((part) => part.kind === "power").length, 1);
    assert.equal(rear.profile.faces.rear.components.filter((part) => part.kind === "psu").length, 0);
  });

  test(`${model} preserves all59 historical IDs, cable references, settings and unsupported endpoints`, () => {
    const device = fixture(model, true); device.ports.reverse(); device.rackId = "old-rack"; device.rackPosition = 13;
    device.ports.forEach((port) => { port.label = `Edited ${port.portIndex}`; port.nativeVlan = 77; port.allowedVlans = [12, 77]; port.isPoe = true; });
    const topology = { devices: [device], links: [{ sourceDeviceId: device.id, sourcePortId: `${model}-49`, targetDeviceId: "peer", targetPortId: "untouched" }] };
    const before = structuredClone(topology), front = scene(device), rear = scene(device, 690, "rear");
    assert.equal(device.ports.length, 59); assert.equal(device.faceplate.unitsU, 1);
    assert.equal(device.ports.find((port) => port.portIndex === 1).type, "RJ45_MGIG");
    assert.deepEqual(device.ports.filter((port) => port.portIndex >= 57).map((port) => [port.portIndex, port.type]), [[59, "RJ45_1G"], [58, "Stack"], [57, "Stack"]]);
    assert.equal(front.ports.length, 1); assert.equal(front.ports[0].port.portIndex, 59); assert.equal(rear.ports.length, 0);
    assert.equal(front.unmappedPorts.length, 58); assert.equal(front.components.filter((part) => part.ancillarySocket).length, frontCount - 1);
    assert.equal(rear.components.filter((part) => part.ancillarySocket).length, rearCount);
    assert.equal(upgradeInstalledPhysicalPorts(device), false); assert.deepEqual(topology, before);
    const sparse = structuredClone(device); sparse.ports = sparse.ports.filter((port) => [1, 49, 57, 59].includes(port.portIndex));
    assert.equal(scene(sparse).ports.length, 1); assert.equal(scene(sparse).unmappedPorts.length, 3);
    const duplicate = structuredClone(sparse); duplicate.ports.push({ ...duplicate.ports.find((port) => port.portIndex === 59), id: "duplicate" });
    assert.equal(scene(duplicate).ports.length, 1); assert.equal(scene(duplicate).unmappedPorts.length, 4);
    const mismatch = structuredClone(sparse); mismatch.ports.find((port) => port.portIndex === 59).type = "SFP28_25G";
    assert.equal(scene(mismatch).ports.length, 0);
    const unknown = structuredClone(device); unknown.faceplate.inventoryRevision = 99;
    assert.equal(scene(unknown).ports.length, 0); assert.equal(scene(unknown).unmappedPorts.length, 59);
  });

  test(`${model} retains native body geometry in true saved1U and edited2U allocations at460/690`, () => {
    for (const width of [460, 690]) {
      const current = fixture(model), old = fixture(model, true), larger = structuredClone(old); larger.faceplate.unitsU = 2;
      assert.deepEqual(scene(current, width).chassis, scene(old, width).chassis);
      assert.equal(scene(current, width).chassis.width, scene(larger, width).chassis.width);
      assert.equal(scene(current, width).chassis.height, scene(larger, width).chassis.height);
      assert.equal(larger.faceplate.unitsU, 2); assert.equal(larger.ports.length, 59);
    }
  });

  test(`${model} captions and sockets clear each other and all traced hardware at460/690`, () => {
    for (const width of [460, 690]) for (const legacy of [false, true]) for (const custom of [false, true]) for (const face of ["front", "rear"]) {
      const device = fixture(model, legacy); if (custom) device.ports.forEach((port) => { port.label = `Long custom saved caption ${port.portIndex}`; });
      const result = scene(device, width, face), physical = result.components.filter((part) => part.ancillarySocket);
      for (const port of result.ports) {
        const label = port.labelPlacement, caption = { x: label.x - label.boxMaxWidth / 2, y: label.y - label.boxHeight / 2, width: label.boxMaxWidth, height: label.boxHeight };
        for (const component of result.components) {
          assert.ok(!overlaps(port, component), `${model} ${width} ${face} socket ${port.port.portIndex}/${component.role || component.kind}`);
          assert.ok(!overlaps(caption, component), `${model} ${width} ${face} caption ${port.port.portIndex}/${component.role || component.kind}`);
        }
        for (const other of result.ports) if (other !== port) assert.ok(!overlaps(caption, other), `${model} caption ${port.port.portIndex}/socket ${other.port.portIndex}`);
      }
      for (const socket of physical) for (const component of result.components) if (!component.ancillarySocket) assert.ok(!overlaps(socket, component), `${model} ancillary/housing ${component.role || component.kind}`);
    }
  });

  test(`${model} all current/legacy component and ancillary primitives stay inside bounds at1x/2x`, () => {
    for (const width of [460, 690]) for (const legacy of [false, true]) for (const face of ["front", "rear"]) for (const scale of [1, 2]) {
      for (const part of scene(fixture(model, legacy), width, face).components) {
        const component = { ...part, x: part.x * scale, y: part.y * scale, width: part.width * scale, height: part.height * scale };
        for (const primitive of hardwarePrimitives(component)) {
          const box = bounds(primitive);
          assert.ok(box[0] >= component.x - 1e-5 && box[1] >= component.y - 1e-5 && box[2] <= component.x + component.width + 1e-5 && box[3] <= component.y + component.height + 1e-5,
            `${model} ${width} ${legacy} ${scale} ${part.role || part.kind} ${JSON.stringify(primitive)}`);
        }
      }
    }
  });
}

test("7150 reused exact geometry and 7250 distinct optical/service/EPS hardware match source figures", () => {
  const family = scene(fixture("ICX 7150 family")).profile;
  const exact = scene(instantiateProfile(hardwareCatalog.find((row) => row.model === "ICX 7150-48P"), "exact", { x: 0, y: 0 })).profile;
  for (const face of ["front", "rear"]) {
    assert.deepEqual(family.faces[face].components, exact.faces[face].components);
    assert.deepEqual(family.faces[face].ports.map(({ portIndex, x, y, width, height, physicalLabel }) => [portIndex, x, y, width, height, physicalLabel]),
      exact.faces[face].ports.map(({ portIndex, x, y, width, height, physicalLabel }) => [portIndex, x, y, width, height, physicalLabel]));
  }
  const device = fixture("ICX 7250 family"), result = scene(device), cages = result.profile.faces.front.ports.filter((slot) => slot.portIndex >= 49 && slot.portIndex <= 56);
  assert.deepEqual(cages.filter((slot) => slot.y < .5).map((slot) => slot.physicalLabel), ["1", "3", "5", "7"]);
  assert.deepEqual(cages.filter((slot) => slot.y > .5).map((slot) => slot.physicalLabel), ["2", "4", "6", "8"]);
  assert.equal(result.profile.faces.front.ports.find((slot) => slot.portIndex === 58).connectorKind, "usb-mini");
  assert.equal(device.ports[57].type, "USB_MINI_CONSOLE");
  assert.equal(result.profile.faces.rear.components.filter((part) => part.role === "covered-eps-input").length, 1);
});

test("source-specific fixed fan guards and EPS cover have matching Canvas and SVG primitives", () => {
  for (const width of [460, 690]) for (const face of ["front", "rear"]) {
    for (const component of scene(fixture("ICX 7250 family"), width, face).components.filter((part) => part.variant?.startsWith("ruckus-7250"))) {
      const primitives = hardwarePrimitives(component), svg = hardwareComponentSVG(component), calls = [];
      const context = new Proxy({}, { get: (_object, key) => (...args) => calls.push([key, ...args]), set: () => true });
      drawHardwareComponent(context, component);
      const circles = primitives.filter((part) => part.kind === "circle");
      assert.deepEqual(calls.filter(([name]) => name === "arc").map(([, x, y, radius]) => [x, y, radius]), circles.map((part) => [part.cx, part.cy, part.r]));
      assert.equal((svg.match(/<circle\b/g) || []).length, circles.length);
      assert.equal((svg.match(/<line\b/g) || []).length, primitives.filter((part) => part.kind === "line").length);
      if (component.variant === "ruckus-7250-fixed-fan") {
        const outer = circles[0];
        for (const line of primitives.filter((part) => part.kind === "line")) for (const [x, y] of [[line.x1, line.y1], [line.x2, line.y2]]) {
          assert.ok(Math.hypot(x - outer.cx, y - outer.cy) <= outer.r + 1e-8, "Guard supports must terminate at the round housing, independent of component aspect");
        }
      }
      assert.ok(primitives.length > 5, component.variant);
    }
  }
});
