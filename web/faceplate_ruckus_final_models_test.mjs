import assert from "node:assert/strict";
import test from "node:test";
import { hardwareCatalog, instantiateProfile, upgradeInstalledPhysicalPorts } from "./static/js/catalog.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";
import { hardwarePrimitives, hardwareComponentSVG, drawHardwareComponent } from "./static/js/hardware-components.js";

const cases = [
  ["ICX 7650 family", "ICX7650-48ZP", 59, 55, 4, 25, 2, "RPS16-E", 1000],
  ["ICX 7850 family", "ICX7850-48F", 59, 57, 2, 1, 5, "RPS19-E", 650],
  ["ICX 8200 family", "ICX8200-48PF2", 55, 55, 0, 5, 2, "RPS23-E", 920],
];

/** Reproduce the independently executed frozen438 constructor; avoid a test dependency on local audit snapshots. */
function fixture(model, legacy = false) {
  let profile = hardwareCatalog.find((row) => row.vendor === "Ruckus" && row.model === model);
  if (legacy) profile = { ...profile, units: 1, inventoryRevision: 0, groups: [
    { zone: "access", count: 48, type: "RJ45_MGIG", speed: 2500, poe: true, prefix: "" },
    { zone: "uplink", count: 8, type: "SFP28_25G", speed: 25000, poe: false, prefix: "SFP28" },
    { zone: "management", count: 1, type: "RJ45_1G", speed: 1000, poe: false, prefix: "MGMT" },
    { zone: "uplink", count: 2, type: "Stack", speed: 40000, poe: false, prefix: "STACK" },
  ] };
  const device = instantiateProfile(profile, model, { x: 23, y: 51 });
  device.id = model;
  device.ports.forEach((port) => { port.id = `${model}-${port.portIndex}`; port.deviceId = model; });
  return device;
}

/** Build each face using the actual stored rack allocation. */
function scene(device, width = 690, face = "front") {
  return buildFaceplateScene(device, { x: 0, y: 0, width, height: device.faceplate.unitsU * 100 }, { face });
}

/** Detect area collisions while allowing touching boundaries. */
function overlaps(a, b) { return a.x < b.x + b.width - 1e-8 && a.x + a.width > b.x + 1e-8 && a.y < b.y + b.height - 1e-8 && a.y + a.height > b.y + 1e-8; }

/** Include stroke extents and conservative text dimensions when checking physical primitive containment. */
function bounds(part) {
  const half = part.stroke ? (part.strokeWidth || 0) / 2 : 0;
  if (part.kind === "text") return [part.x - part.text.length * part.fontSize * .31, part.y - part.fontSize / 2, part.x + part.text.length * part.fontSize * .31, part.y + part.fontSize / 2];
  if (part.kind === "polygon") return [Math.min(...part.points.map(([x]) => x)) - half, Math.min(...part.points.map(([, y]) => y)) - half, Math.max(...part.points.map(([x]) => x)) + half, Math.max(...part.points.map(([, y]) => y)) + half];
  if (part.kind === "circle") return [part.cx - part.r - half, part.cy - part.r - half, part.cx + part.r + half, part.cy + part.r + half];
  if (part.kind === "line") return [Math.min(part.x1, part.x2) - half, Math.min(part.y1, part.y2) - half, Math.max(part.x1, part.x2) + half, Math.max(part.y1, part.y2) + half];
  return [part.x - half, part.y - half, part.x + part.width + half, part.y + part.height + half];
}

for (const [model, sku, total, frontCount, rearCount, oldMapped, fans, supply, watts] of cases) {
  test(`${model} selects a complete exact SKU with the source PSU and fan population`, () => {
    const device = fixture(model), front = scene(device), rear = scene(device, 690, "rear");
    assert.equal(device.ports.length, total); assert.equal(device.faceplate.unitsU, 1);
    assert.equal(front.profile.sku, sku); assert.equal(front.profile.fidelity, "model"); assert.equal(front.profile.rearHardwareVerified, true);
    assert.deepEqual(front.profile.evidence.models, [sku]); assert.equal(front.profile.evidence.selectedModel, sku);
    assert.equal(front.ports.length, frontCount); assert.equal(rear.ports.length, rearCount);
    assert.equal([...front.components, ...rear.components].filter((part) => part.ancillarySocket).length, 0);
    const rearParts = rear.profile.faces.rear.components;
    assert.equal(rearParts.filter((part) => part.kind === "fan").length, fans);
    assert.ok(rearParts.filter((part) => part.kind === "fan").every((part) => part.model === (model.includes("8200") ? "ICX-FAN13-E" : "ICX-FAN12-E")));
    assert.equal(rearParts.filter((part) => part.kind === "psu").length, 2);
    assert.ok(rearParts.filter((part) => part.kind === "psu").every((part) => part.model === supply && part.watts === watts));
    assert.equal(device.ports.at(-1).type, "USB_C_CONSOLE"); assert.equal(device.ports.at(-1).label, "USB-C");
    if (model.includes("7650")) {
      assert.ok(device.ports.slice(0, 24).every((port) => port.type === "RJ45_1G"));
      assert.ok(device.ports.slice(24, 48).every((port) => port.type === "RJ45_MGIG" && port.speedMbps === 10000));
    }
    if (model.includes("7850")) assert.ok(device.ports.slice(0, 48).every((port) => port.type === "SFP28_25G" && port.speedMbps === 25000));
    if (model.includes("8200")) assert.equal(device.ports.filter((port) => port.type === "SFP28_25G").length, 4);
  });

  test(`${model} preserves actual438 endpoints, edited state, cables and explicit type-guarded mappings`, () => {
    const device = fixture(model, true);
    assert.equal(device.ports.length, 59);
    assert.deepEqual(device.ports.slice(56).map((port) => [port.portIndex, port.type, port.label]), [[57, "Stack", "STACK1"], [58, "Stack", "STACK2"], [59, "RJ45_1G", "MGMT"]]);
    device.ports.reverse(); device.rackId = "saved-rack"; device.rackPosition = 19;
    device.ports.forEach((port) => { port.label = `Edited ${port.portIndex}`; port.nativeVlan = 73; port.allowedVlans = [10, 73]; port.isPoe = true; port.speedMbps = 1234; });
    const topology = { devices: [device], links: [{ sourceDeviceId: device.id, sourcePortId: `${model}-49`, targetDeviceId: "peer", targetPortId: "saved-peer" }] };
    const before = structuredClone(topology), faces = [scene(device), scene(device, 690, "rear")];
    assert.equal(faces.flatMap((face) => face.ports).length, oldMapped); assert.equal(faces[0].unmappedPorts.length, 59 - oldMapped);
    assert.equal(faces.flatMap((face) => face.components.filter((part) => part.ancillarySocket)).length, total - oldMapped);
    assert.ok(faces.flatMap((face) => face.ports).some((port) => port.port.portIndex === 59));
    assert.equal(upgradeInstalledPhysicalPorts(device), false); assert.deepEqual(topology, before);
    const sparse = structuredClone(device); sparse.ports = sparse.ports.filter((port) => [1, 25, 49, 57, 59].includes(port.portIndex));
    const sparseCount = model.includes("7850") ? 1 : 2;
    assert.equal(scene(sparse).ports.length + scene(sparse, 690, "rear").ports.length, sparseCount);
    const duplicate = structuredClone(sparse); duplicate.ports.push({ ...duplicate.ports.find((port) => port.portIndex === 59), id: "duplicate" });
    assert.equal(scene(duplicate).unmappedPorts.length, 6 - sparseCount);
    const mismatch = structuredClone(sparse); mismatch.ports.forEach((port) => { port.type = "USB_MINI_CONSOLE"; });
    assert.equal(scene(mismatch).ports.length + scene(mismatch, 690, "rear").ports.length, 0);
    const unknown = structuredClone(device); unknown.faceplate.inventoryRevision = 99;
    assert.equal(scene(unknown).ports.length + scene(unknown, 690, "rear").ports.length, 0); assert.equal(scene(unknown).unmappedPorts.length, 59);
  });

  test(`${model} native body fits edited2U allocations at460 and690 without changing stored rack space`, () => {
    for (const width of [460, 690]) {
      const current = fixture(model), old = fixture(model, true), larger = structuredClone(old); larger.faceplate.unitsU = 2;
      assert.deepEqual(scene(current, width).chassis, scene(old, width).chassis);
      assert.equal(scene(current, width).chassis.width, scene(larger, width).chassis.width);
      assert.equal(scene(current, width).chassis.height, scene(larger, width).chassis.height);
      assert.equal(larger.faceplate.unitsU, 2); assert.equal(larger.ports.length, 59);
    }
  });

  test(`${model} finite default and custom captions clear sockets and physical components at460/690`, () => {
    for (const width of [460, 690]) for (const legacy of [false, true]) for (const custom of [false, true]) for (const face of ["front", "rear"]) {
      const device = fixture(model, legacy); if (custom) device.ports.forEach((port) => { port.label = `Long saved custom caption ${port.portIndex}`; });
      const result = scene(device, width, face);
      for (const port of result.ports) {
        const label = port.labelPlacement, caption = { x: label.x - label.boxMaxWidth / 2, y: label.y - label.boxHeight / 2, width: label.boxMaxWidth, height: label.boxHeight };
        assert.ok([label.x, label.y, label.maxWidth, label.boxMaxWidth].every(Number.isFinite));
        if (!custom && /^\d{2}$/.test(port.displayLabel)) assert.ok(label.maxWidth >= 6.6, `${model} caption${port.displayLabel} text budget`);
        for (const component of result.components) {
          assert.ok(!overlaps(port, component), `${model} ${width} ${face} socket${port.port.portIndex}/${component.role || component.kind}`);
          assert.ok(!overlaps(caption, component), `${model} ${width} ${face} caption${port.port.portIndex}/${component.role || component.kind}`);
        }
        for (const other of result.ports) if (other !== port) assert.ok(!overlaps(caption, other), `${model} caption${port.port.portIndex}/socket${other.port.portIndex}`);
      }
      for (const socket of result.components.filter((part) => part.ancillarySocket)) for (const component of result.components.filter((part) => !part.ancillarySocket)) assert.ok(!overlaps(socket, component), `${model} ancillary/${component.role || component.kind}`);
    }
  });

  test(`${model} all physical and ancillary primitive extents are bounded at460/6901x/2x`, () => {
    for (const width of [460, 690]) for (const legacy of [false, true]) for (const face of ["front", "rear"]) for (const scale of [1, 2]) {
      const result = scene(fixture(model, legacy), width, face);
      const parts = [...result.components, ...result.ports.map((port) => ({ ...port, kind: port.connectorKind }))];
      for (const part of parts) {
        const component = { ...part, x: part.x * scale, y: part.y * scale, width: part.width * scale, height: part.height * scale };
        const primitives = hardwarePrimitives(component); assert.ok(primitives.length > 0);
        for (const primitive of primitives) {
          const box = bounds(primitive);
          assert.ok(box.every(Number.isFinite));
          assert.ok(box[0] >= component.x - 1e-5 && box[1] >= component.y - 1e-5 && box[2] <= component.x + component.width + 1e-5 && box[3] <= component.y + component.height + 1e-5,
            `${model} ${width} ${legacy} ${scale} ${part.role || part.kind} ${JSON.stringify(primitive)}`);
        }
      }
    }
  });
}

test("source port order, service positions and landscape/portrait connector directions are retained", () => {
  const p7650 = scene(fixture("ICX 7650 family")).profile;
  assert.deepEqual([...p7650.faces.rear.ports].sort((a, b) => a.x - b.x).map((port) => [port.physicalLabel, port.type]),
    [["3/4", "QSFP_PLUS_40G"], ["3/3", "QSFP_PLUS_40G"], ["3/2", "QSFP28_100G"], ["3/1", "QSFP28_100G"]]);
  assert.ok(p7650.faces.front.ports.find((port) => port.portIndex === 58).y < p7650.faces.front.ports.find((port) => port.portIndex === 57).y);
  const p7850 = scene(fixture("ICX 7850 family"), 460);
  assert.deepEqual(p7850.profile.faces.front.ports.filter((port) => port.portIndex >= 49 && port.portIndex <= 56 && port.y < .5).map((port) => port.physicalLabel), ["1", "3", "5", "7"]);
  const usb = p7850.ports.find((port) => port.port.portIndex === 59);
  assert.equal(usb.connectorKind, "ruckus-usbc-vertical"); assert.ok(usb.height / usb.width > 2.8);
  const glyph = hardwarePrimitives({ ...usb, kind: usb.connectorKind });
  assert.ok(glyph[1].height > glyph[1].width * 4, "Portrait Type-C internal tongue must rotate as well as its outer aperture");
  assert.ok(p7850.ports.filter((port) => port.port.portIndex <= 56).every((port) => port.width > port.height * 1.3));
  const p8200 = scene(fixture("ICX 8200 family")).profile;
  assert.deepEqual(p8200.faces.front.ports.filter((port) => port.portIndex >= 49 && port.portIndex <= 52 && port.y < .5).map((port) => port.physicalLabel), ["1", "3"]);
  assert.ok(p8200.faces.front.ports.find((port) => port.portIndex === 53).y < p8200.faces.front.ports.find((port) => port.portIndex === 54).y);
});

test("8200 management caption accommodates its measured Bahnschrift Condensed glyph width at460", () => {
  const management = scene(fixture("ICX 8200 family"), 460).ports.find((port) => port.port.portIndex === 53);
  assert.ok(management.labelPlacement.maxWidth >= 12.762, "Actual Chromium font metrics measured MGMT at12.76171875px; preserve that full caption width");
});

test("source-specific Ruckus helper uses the same primitives for actual Canvas and SVG", () => {
  for (const [model] of cases) for (const face of ["front", "rear"]) {
    const result = scene(fixture(model), 460, face);
    for (const component of [...result.components, ...result.ports.map((port) => ({ ...port, kind: port.connectorKind }))]) {
      const primitives = hardwarePrimitives(component), svg = hardwareComponentSVG(component), calls = [];
      const context = new Proxy({}, { get: (_object, key) => (...args) => calls.push([key, ...args]), set: () => true });
      drawHardwareComponent(context, component);
      assert.deepEqual(calls.filter(([name]) => name === "arc").map(([, x, y, radius]) => [x, y, radius]), primitives.filter((part) => part.kind === "circle").map((part) => [part.cx, part.cy, part.r]));
      assert.equal((svg.match(/<circle\b/g) || []).length, primitives.filter((part) => part.kind === "circle").length);
      assert.equal((svg.match(/<polygon\b/g) || []).length, primitives.filter((part) => part.kind === "polygon").length);
    }
  }
});

test("sparse reversed, empty and unknown current inventories retain physical hardware without added endpoints", () => {
  for (const [model, , total] of cases) {
    const device = fixture(model); device.ports = device.ports.filter((port) => [1, 49, total].includes(port.portIndex)).reverse();
    const before = structuredClone(device), faces = [scene(device), scene(device, 460, "rear")];
    assert.equal(faces.flatMap((face) => face.ports).length, 3);
    assert.equal(faces.flatMap((face) => face.components.filter((part) => part.ancillarySocket)).length, total - 3); assert.deepEqual(device, before);
    for (const revision of [1, 88]) {
      const empty = fixture(model); empty.faceplate.inventoryRevision = revision; empty.ports = [];
      const emptyFaces = [scene(empty), scene(empty, 460, "rear")];
      assert.equal(emptyFaces.flatMap((face) => face.ports).length, 0);
      assert.equal(emptyFaces.flatMap((face) => face.components.filter((part) => part.ancillarySocket)).length, total); assert.equal(empty.ports.length, 0);
    }
  }
});
