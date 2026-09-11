import assert from "node:assert/strict";
import test from "node:test";
import { hardwareCatalog, instantiateProfile, upgradeInstalledPhysicalPorts } from "./static/js/catalog.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";
import { hardwarePrimitives, hardwareComponentSVG, drawHardwareComponent } from "./static/js/hardware-components.js";

const cases = [["ICX 7450 family", "ICX7450-48P", 56, 54, 2, 1], ["ICX 7550 family", "ICX7550-48ZP", 54, 52, 2, 37]];

/** Reproduce the independently executed frozen438 constructor without introducing a test dependency on local audit snapshots. */
function fixture(model, legacy = false) {
  let catalog = hardwareCatalog.find((row) => row.vendor === "Ruckus" && row.model === model);
  if (legacy) catalog = { ...catalog, units: 1, inventoryRevision: 0, groups: [
    { zone: "access", count: 48, type: "RJ45_MGIG", speed: 2500, poe: true, prefix: "" },
    { zone: "uplink", count: 8, type: "SFP28_25G", speed: 25000, poe: false, prefix: "SFP28" },
    { zone: "management", count: 1, type: "RJ45_1G", speed: 1000, poe: false, prefix: "MGMT" },
    { zone: "uplink", count: 2, type: "Stack", speed: 40000, poe: false, prefix: "STACK" },
  ] };
  const device = instantiateProfile(catalog, model, { x: 23, y: 51 });
  device.id = model; device.ports.forEach((port) => { port.id = `${model}-${port.portIndex}`; port.deviceId = model; });
  return device;
}

/** Build the selected face within the real stored allocation. */
function scene(device, width = 690, face = "front") {
  return buildFaceplateScene(device, { x: 0, y: 0, width, height: device.faceplate.unitsU * 100 }, { face });
}

/** Detect area intersections while permitting touching boundaries. */
function overlaps(a, b) { return a.x < b.x + b.width - 1e-8 && a.x + a.width > b.x + 1e-8 && a.y < b.y + b.height - 1e-8 && a.y + a.height > b.y + 1e-8; }

/** Include stroke extents and conservative glyph width in primitive bounds. */
function bounds(part) {
  const half = part.stroke ? (part.strokeWidth || 0) / 2 : 0;
  if (part.kind === "text") return [part.x - part.text.length * part.fontSize * .31, part.y - part.fontSize / 2, part.x + part.text.length * part.fontSize * .31, part.y + part.fontSize / 2];
  if (part.kind === "polygon") return [Math.min(...part.points.map(([x]) => x)) - half, Math.min(...part.points.map(([, y]) => y)) - half, Math.max(...part.points.map(([x]) => x)) + half, Math.max(...part.points.map(([, y]) => y)) + half];
  if (part.kind === "circle") return [part.cx - part.r - half, part.cy - part.r - half, part.cx + part.r + half, part.cy + part.r + half];
  if (part.kind === "line") return [Math.min(part.x1, part.x2) - half, Math.min(part.y1, part.y2) - half, Math.max(part.x1, part.x2) + half, Math.max(part.y1, part.y2) + half];
  return [part.x - half, part.y - half, part.x + part.width + half, part.y + part.height + half];
}

for (const [model, sku, total, frontCount, rearCount, oldMapped] of cases) {
  test(`${model} uses the complete selected canonical inventory and disclosed chassis population`, () => {
    const device = fixture(model), front = scene(device), rear = scene(device, 690, "rear");
    assert.equal(device.ports.length, total); assert.equal(device.faceplate.unitsU, 1);
    assert.equal(front.profile.sku, sku); assert.equal(front.profile.fidelity, "model"); assert.equal(front.profile.rearHardwareVerified, true);
    assert.deepEqual(front.profile.evidence.models, [sku]); assert.equal(front.profile.evidence.selectedModel, sku);
    assert.equal(front.ports.length, frontCount); assert.equal(rear.ports.length, rearCount);
    assert.equal(front.components.filter((part) => part.ancillarySocket).length + rear.components.filter((part) => part.ancillarySocket).length, 0);
    assert.equal(rear.profile.faces.rear.components.filter((part) => part.kind === "fan").length, model.includes("7450") ? 2 : 3);
    assert.equal(rear.profile.faces.rear.components.filter((part) => part.kind === "psu").length, 2);
    assert.ok(device.ports.slice(0, 36).every((port) => port.type === (model.includes("7450") ? "RJ45_1G" : "RJ45_MGIG")));
    assert.ok(device.ports.slice(36, 48).every((port) => port.type === (model.includes("7450") ? "RJ45_1G" : "RJ45_10G")));
    if (model.includes("7550")) assert.equal(device.ports.find((port) => port.portIndex === 53).label, "USB-C");
  });

  test(`${model} maps actual frozen438 endpoints by index and type while preserving every stored value`, () => {
    const device = fixture(model, true);
    assert.equal(device.ports.length, 59); assert.equal(device.faceplate.unitsU, 1);
    assert.deepEqual(device.ports.slice(56).map((port) => [port.portIndex, port.type, port.label]), [[57, "Stack", "STACK1"], [58, "Stack", "STACK2"], [59, "RJ45_1G", "MGMT"]]);
    device.ports.reverse(); device.rackId = "saved-rack"; device.rackPosition = 19;
    device.ports.forEach((port) => { port.label = `Edited ${port.portIndex}`; port.nativeVlan = 73; port.allowedVlans = [10, 73]; port.isPoe = true; port.speedMbps = 1234; });
    const topology = { devices: [device], links: [{ sourceDeviceId: device.id, sourcePortId: `${model}-49`, targetDeviceId: "peer", targetPortId: "saved-peer" }] };
    const before = structuredClone(topology), front = scene(device), rear = scene(device, 690, "rear");
    assert.equal(front.ports.length + rear.ports.length, oldMapped);
    assert.equal(front.unmappedPorts.length, 59 - oldMapped);
    assert.equal(front.components.filter((part) => part.ancillarySocket).length + rear.components.filter((part) => part.ancillarySocket).length, total - oldMapped);
    assert.ok([...front.ports, ...rear.ports].some((port) => port.port.portIndex === 59));
    assert.equal(upgradeInstalledPhysicalPorts(device), false); assert.deepEqual(topology, before);
    const sparse = structuredClone(device); sparse.ports = sparse.ports.filter((port) => [1, 37, 49, 57, 59].includes(port.portIndex));
    const sparseCount = model.includes("7450") ? 1 : 2;
    assert.equal(scene(sparse).ports.length + scene(sparse, 690, "rear").ports.length, sparseCount);
    const duplicate = structuredClone(sparse); duplicate.ports.push({ ...duplicate.ports.find((port) => port.portIndex === 59), id: "duplicate" });
    assert.equal(scene(duplicate).unmappedPorts.length, 6 - sparseCount);
    const mismatch = structuredClone(sparse); mismatch.ports.forEach((port) => { port.type = "SFP28_25G"; });
    assert.equal(scene(mismatch).ports.length + scene(mismatch, 690, "rear").ports.length, 0);
    const unknown = structuredClone(device); unknown.faceplate.inventoryRevision = 99;
    assert.equal(scene(unknown).ports.length + scene(unknown, 690, "rear").ports.length, 0);
    assert.equal(scene(unknown).unmappedPorts.length, 59);
  });

  test(`${model} retains native body dimensions within real1U and edited2U saved allocations`, () => {
    for (const width of [460, 690]) {
      const current = fixture(model), old = fixture(model, true), larger = structuredClone(old); larger.faceplate.unitsU = 2;
      assert.deepEqual(scene(current, width).chassis, scene(old, width).chassis);
      assert.equal(scene(current, width).chassis.width, scene(larger, width).chassis.width);
      assert.equal(scene(current, width).chassis.height, scene(larger, width).chassis.height);
      assert.equal(larger.faceplate.unitsU, 2); assert.equal(larger.ports.length, 59);
    }
  });

  test(`${model} captions clear sockets and source hardware at460/690 with saved custom labels`, () => {
    for (const width of [460, 690]) for (const legacy of [false, true]) for (const custom of [false, true]) for (const face of ["front", "rear"]) {
      const device = fixture(model, legacy); if (custom) device.ports.forEach((port) => { port.label = `Long saved custom caption ${port.portIndex}`; });
      const result = scene(device, width, face);
      for (const port of result.ports) {
        const label = port.labelPlacement, caption = { x: label.x - label.boxMaxWidth / 2, y: label.y - label.boxHeight / 2, width: label.boxMaxWidth, height: label.boxHeight };
        assert.ok([label.x, label.y, label.maxWidth, label.boxMaxWidth].every(Number.isFinite), `${model} caption${port.port.portIndex} must have finite placement`);
        if (!custom && /^\d{2}$/.test(port.displayLabel)) assert.ok(label.maxWidth >= 6.6, `${model} two-digit caption${port.displayLabel} needs its native-width text budget`);
        // The selected7550 module bay is the observed socket enclosure, drawn behind its contents.
        for (const component of result.components.filter((part) => part.kind !== "module-bay")) {
          assert.ok(!overlaps(port, component), `${model} ${width} ${face} socket${port.port.portIndex}/${component.role || component.kind}`);
          assert.ok(!overlaps(caption, component), `${model} ${width} ${face} caption${port.port.portIndex}/${component.role || component.kind}`);
        }
        for (const other of result.ports) if (other !== port) assert.ok(!overlaps(caption, other), `${model} caption${port.port.portIndex}/socket${other.port.portIndex}`);
      }
      for (const socket of result.components.filter((part) => part.ancillarySocket)) for (const component of result.components.filter((part) => !part.ancillarySocket && part.kind !== "module-bay")) assert.ok(!overlaps(socket, component), `${model} ancillary/${component.role || component.kind}`);
    }
  });

  test(`${model} all component and ancillary primitives remain bounded at native/doubled460/690`, () => {
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

test("7550 selected physical components and connector geometry equal the matching exact SKU", () => {
  const family = scene(fixture("ICX 7550 family")).profile, exact = scene(fixture("ICX 7550-48ZP")).profile;
  for (const face of ["front", "rear"]) {
    assert.deepEqual(family.faces[face].components, exact.faces[face].components);
    const physical = (slot) => [slot.portIndex, slot.x, slot.y, slot.width, slot.height, slot.connectorKind, slot.physicalLabel];
    assert.deepEqual(family.faces[face].ports.map(physical), exact.faces[face].ports.map(physical));
    assert.ok(family.faces[face].ports.every((slot) => slot.compatibleTypes === undefined));
  }
});

test("exact7550 USB-C caption clears the application name overlay at460 and690 with default or edited labels", () => {
  for (const width of [460, 690]) for (const custom of [false, true]) {
    const device = fixture("ICX 7550-48ZP");
    if (custom) device.ports.find((port) => port.portIndex === 53).label = "Long saved USB-C console caption";
    const before = structuredClone(device), result = scene(device, width), port = result.ports.find((port) => port.port.portIndex === 53);
    const label = port.labelPlacement, caption = { x: label.x - label.boxMaxWidth / 2, y: label.y - label.boxHeight / 2, width: label.boxMaxWidth, height: label.boxHeight };
    for (const component of result.components) assert.ok(!overlaps(caption, component), `exact7550 USB-C caption/${component.kind} at${width}`);
    assert.ok(label.maxWidth >= 5 * label.fontSize * .62, "Default USB-C caption must remain legible rather than clipped to one character");
    const family = scene(fixture("ICX 7550 family"), width).ports.find((entry) => entry.port.portIndex === 53);
    assert.deepEqual(port.descriptionAnchor, family.descriptionAnchor);
    assert.deepEqual(device, before);
  }
});

test("7450 front optical odd/even order, rear slots4/3 and named power/fan population match guide", () => {
  const profile = scene(fixture("ICX 7450 family")).profile;
  const optical = profile.faces.front.ports.filter((slot) => slot.portIndex >= 49 && slot.portIndex <= 52);
  assert.deepEqual(optical.filter((slot) => slot.y < .5).map((slot) => slot.portIndex), [49, 51]);
  assert.deepEqual(optical.filter((slot) => slot.y > .5).map((slot) => slot.portIndex), [50, 52]);
  assert.deepEqual([...profile.faces.rear.ports].sort((a, b) => a.x - b.x).map((slot) => slot.physicalLabel), ["4/1", "3/1"]);
  assert.ok(profile.faces.rear.components.filter((part) => part.kind === "psu").every((part) => part.model === "RPS16-E" && part.watts === 1000));
  assert.ok(profile.faces.rear.components.filter((part) => part.kind === "fan").every((part) => part.model === "ICX-FAN10-E"));
  assert.equal(profile.faces.front.ports.find((slot) => slot.portIndex === 56).connectorKind, "usb-mini");
});

test("7450 source-specific artwork uses identical Canvas and SVG primitives", () => {
  for (const face of ["front", "rear"]) for (const component of scene(fixture("ICX 7450 family"), 460, face).components.filter((part) => part.variant?.startsWith("ruckus-7450"))) {
    const primitives = hardwarePrimitives(component), svg = hardwareComponentSVG(component), calls = [];
    const context = new Proxy({}, { get: (_object, key) => (...args) => calls.push([key, ...args]), set: () => true });
    drawHardwareComponent(context, component);
    assert.deepEqual(calls.filter(([name]) => name === "arc").map(([, x, y, radius]) => [x, y, radius]), primitives.filter((part) => part.kind === "circle").map((part) => [part.cx, part.cy, part.r]));
    assert.equal((svg.match(/<circle\b/g) || []).length, primitives.filter((part) => part.kind === "circle").length);
    assert.equal((svg.match(/<polygon\b/g) || []).length, primitives.filter((part) => part.kind === "polygon").length);
    assert.ok(primitives.length >= 1);
  }
});

test("current sparse reversed, empty and unknown inventories retain canonical hardware without adding endpoints", () => {
  for (const [model, , total] of cases) {
    const device = fixture(model); device.ports = device.ports.filter((port) => [1, 49, total].includes(port.portIndex)).reverse();
    const before = structuredClone(device), front = scene(device), rear = scene(device, 460, "rear");
    assert.equal(front.ports.length + rear.ports.length, 3);
    assert.equal(front.components.filter((part) => part.ancillarySocket).length + rear.components.filter((part) => part.ancillarySocket).length, total - 3);
    assert.deepEqual(device, before);
    for (const revision of [1, 88]) {
      const empty = fixture(model); empty.faceplate.inventoryRevision = revision; empty.ports = [];
      const faces = [scene(empty), scene(empty, 460, "rear")];
      assert.equal(faces.flatMap((face) => face.ports).length, 0);
      assert.equal(faces.flatMap((face) => face.components.filter((part) => part.ancillarySocket)).length, total);
      assert.equal(empty.ports.length, 0);
    }
  }
});
