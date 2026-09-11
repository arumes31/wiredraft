import assert from "node:assert/strict";
import test from "node:test";
import { hardwareCatalog, instantiateProfile, upgradeInstalledPhysicalPorts } from "./static/js/catalog.js";
import { resolveAristaFaceplate } from "./static/js/faceplate-arista-models.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";
import { hardwarePrimitives, hardwareComponentSVG, drawHardwareComponent } from "./static/js/hardware-components.js";

const models = [
  { model: "7010 family", sku: "DCS-7010T-48-F", count: 54, front: 54, rear: 0, map: [[57, 53], [58, 54]] },
  { model: "7020 family", sku: "DCS-7020TR-48-F", count: 56, front: 54, rear: 2, map: [[57, 55], [58, 56]] },
  { model: "7050 family", sku: "DCS-7050SX3-48YC8-F", count: 58, front: 56, rear: 2,
    map: [...Array.from({ length: 48 }, (_, i) => [i + 1, i + 1]), [57, 58], [58, 57]] },
  { model: "7060 family", sku: "DCS-7060CX2-32S-F", count: 36, front: 36, rear: 0, map: [[57, 36], [58, 35]] },
];

/** Reconstruct the original 2U family placeholder independently of the corrected catalog inventory. */
function fixture(model, legacy = false) {
  let entry = hardwareCatalog.find((row) => row.vendor === "Arista" && row.model === model);
  if (legacy) entry = { ...entry, units: 2, inventoryRevision: 0, groups: [
    { zone: "uplink", count: 48, type: "SFP28_25G", speed: 25000, poe: false, prefix: "SFP28" },
    { zone: "uplink", count: 8, type: "QSFP_DD_400G", speed: 400000, poe: false, prefix: "QSFP-DD" },
    { zone: "management", count: 1, type: "RJ45_1G", speed: 1000, poe: false, prefix: "MGMT" },
    { zone: "management", count: 1, type: "Console", speed: 0, poe: false, prefix: "CONSOLE" },
  ] };
  const device = instantiateProfile(entry, model, { x: 21, y: 35 });
  device.id = `saved-${model}`;
  for (const port of device.ports) { port.id = `${device.id}-${port.portIndex}`; port.deviceId = device.id; }
  return device;
}

/** Build both physical faces with identical device coordinates. */
function scenes(device, width = 690) {
  return ["front", "rear"].map((face) => buildFaceplateScene(device, { x: 0, y: 0, width, height: device.faceplate.unitsU * 100 }, { face }));
}

/** Detect a positive-area intersection without counting adjacent borders as collisions. */
function overlaps(a, b) {
  return a.x < b.x + b.width - 1e-8 && a.x + a.width > b.x + 1e-8 && a.y < b.y + b.height - 1e-8 && a.y + a.height > b.y + 1e-8;
}

/** Include strokes and conservative text extents when checking rendered component containment. */
function primitiveBounds(part) {
  const half = part.stroke ? (part.strokeWidth || 0) / 2 : 0;
  if (part.kind === "text") return [part.x - part.text.length * part.fontSize * .31, part.y - part.fontSize / 2,
    part.x + part.text.length * part.fontSize * .31, part.y + part.fontSize / 2];
  if (part.kind === "polygon") {
    const xs = part.points.map(([x]) => x), ys = part.points.map(([, y]) => y);
    return [Math.min(...xs) - half, Math.min(...ys) - half, Math.max(...xs) + half, Math.max(...ys) + half];
  }
  if (part.kind === "circle") return [part.cx - part.r - half, part.cy - part.r - half, part.cx + part.r + half, part.cy + part.r + half];
  if (part.kind === "line") return [Math.min(part.x1, part.x2) - half, Math.min(part.y1, part.y2) - half, Math.max(part.x1, part.x2) + half, Math.max(part.y1, part.y2) + half];
  return [part.x - half, part.y - half, part.x + part.width + half, part.y + part.height + half];
}

for (const definition of models) {
  test(`${definition.model} discloses the selected exact 1U inventory and source-complete front/rear panels`, () => {
    const device = fixture(definition.model), profile = resolveAristaFaceplate(device);
    assert.equal(profile?.sku, definition.sku); assert.equal(profile.fidelity, "model");
    assert.equal(profile.inventoryRevision, 1); assert.equal(profile.inventoryComplete, true);
    assert.equal(profile.rearHardwareVerified, true); assert.equal(profile.evidence.catalogAlias, definition.model);
    assert.deepEqual(profile.evidence.models, [definition.sku]); assert.equal(profile.evidence.selectedModel, definition.sku);
    for (const source of [profile.evidence.front, profile.evidence.rear]) {
      const url = new URL(source);
      assert.equal(url.origin, "https://www.arista.com");
      assert.match(url.hash, /^#page=\d+$/);
    }
    assert.equal(device.faceplate.unitsU, 1); assert.equal(device.ports.length, definition.count);
    const [front, rear] = scenes(device);
    assert.equal(front.ports.length, definition.front); assert.equal(rear.ports.length, definition.rear);
    assert.equal(front.unmappedPorts.length, 0); assert.equal(rear.unmappedPorts.length, 0);
  });

  test(`${definition.model} preserves old IDs/cables/settings and explicitly leaves unsupported endpoints unmapped`, () => {
    for (const legacy of [false, true]) for (const renamed of [false, true]) {
      const device = fixture(definition.model, legacy);
      if (legacy) delete device.faceplate.inventoryRevision;
      device.rackId = "saved-rack"; device.rackPosition = 17;
      device.ports.reverse();
      for (const port of device.ports) {
        if (renamed) port.label = port.portIndex === 1 ? "56" : `Edited ${port.portIndex}`;
        port.speedMbps = 100; port.isPoe = true; port.nativeVlan = 31; port.allowedVlans = [31, 81]; port.group = "Custom";
      }
      const topology = { devices: [device], links: [{ id: "saved-cable", sourceDeviceId: device.id,
        sourcePortId: device.ports[0].id, targetDeviceId: "peer", targetPortId: "peer-port" }] };
      const before = structuredClone(topology);
      assert.equal(device.faceplate.unitsU, legacy ? 2 : 1);
      assert.equal(upgradeInstalledPhysicalPorts(topology), false);
      const rendered = scenes(device).flatMap((scene) => scene.ports);
      const mapping = new Map(legacy ? definition.map : device.ports.map((port) => [port.portIndex, port.portIndex]));
      assert.equal(rendered.length, mapping.size);
      assert.deepEqual(rendered.map((slot) => slot.port.portIndex).sort((a, b) => a - b), [...mapping.keys()].sort((a, b) => a - b));
      const current = scenes(fixture(definition.model)).flatMap((scene) => scene.ports);
      for (const slot of rendered) {
        const canonical = current.find((candidate) => candidate.port.portIndex === mapping.get(slot.port.portIndex));
        assert.deepEqual([slot.centerX, slot.centerY, slot.connectorKind], [canonical.centerX, canonical.centerY, canonical.connectorKind]);
        assert.equal(slot.displayLabel, renamed ? slot.port.label : canonical.displayLabel);
      }
      assert.deepEqual(topology, before);
      device.ports = device.ports.filter((port) => [1, 49, 57, 58].includes(port.portIndex));
      const sparseBefore = structuredClone(device);
      scenes(device); assert.deepEqual(device, sparseBefore);
      device.faceplate.inventoryRevision = 99;
      for (const scene of scenes(device)) { assert.equal(scene.ports.length, 0); assert.equal(scene.unmappedPorts.length, device.ports.length); }
      device.faceplate.inventoryRevision = legacy ? 0 : 1;
      device.ports[0].type = "USB_MICRO_CONSOLE";
      const editedBefore = structuredClone(device);
      scenes(device); assert.deepEqual(device, editedBefore);
    }
  });

  test(`${definition.sku} sockets and captions avoid all hardware components at 460/690`, () => {
    for (const width of [460, 690]) for (const legacy of [false, true]) for (const scene of scenes(fixture(definition.model, legacy), width)) {
      const captions = [];
      for (const slot of scene.ports) {
        const label = slot.labelPlacement;
        const captionWidth = Math.min(label.boxMaxWidth, Math.max(12, Math.min(label.maxWidth, slot.displayLabel.length * label.fontSize) + 6));
        const box = { x: label.x - captionWidth / 2, y: label.y - label.boxHeight / 2, width: captionWidth, height: label.boxHeight };
        assert.ok(box.x >= scene.chassis.x - 1e-8 && box.x + box.width <= scene.chassis.x + scene.chassis.width + 1e-8);
        assert.ok(box.y >= scene.chassis.y && box.y + box.height <= scene.chassis.y + scene.chassis.height);
        for (const other of [...captions, ...scene.ports, ...scene.components.filter((part) => !part.applicationOverlay)]) {
          assert.ok(!overlaps(box, other), `${definition.sku} ${width} ${scene.face} caption ${slot.displayLabel} overlaps ${other.role || other.kind || "caption"}`);
        }
        for (const other of scene.ports) if (other !== slot) assert.ok(!overlaps(slot, other));
        for (const component of scene.components.filter((part) => !part.applicationOverlay)) {
          assert.ok(!overlaps(slot, component), `${definition.sku} ${width} ${scene.face} socket ${slot.displayLabel} overlaps ${component.role || component.kind}`);
        }
        captions.push(box);
      }
      for (const component of scene.components.filter((part) => !part.applicationOverlay)) {
        assert.ok(component.x >= scene.chassis.x && component.x + component.width <= scene.chassis.x + scene.chassis.width + 1e-8);
        assert.ok(component.y >= scene.chassis.y && component.y + component.height <= scene.chassis.y + scene.chassis.height + 1e-8);
        assert.ok(hardwarePrimitives(component).length > 0, `missing artwork for ${component.kind}`);
      }
    }
  });

  test(`${definition.sku} every hardware primitive remains inside its component at native/doubled scale`, () => {
    for (const width of [460, 690]) for (const scale of [1, 2]) for (const legacy of [false, true]) for (const scene of scenes(fixture(definition.model, legacy), width)) {
      for (const original of scene.components.filter((part) => !part.applicationOverlay)) {
        const component = { ...original, x: original.x * scale, y: original.y * scale, width: original.width * scale, height: original.height * scale };
        for (const primitive of hardwarePrimitives(component)) {
          const [left, top, right, bottom] = primitiveBounds(primitive);
          assert.ok(left >= component.x - 1e-8 && top >= component.y - 1e-8 && right <= component.x + component.width + 1e-8 && bottom <= component.y + component.height + 1e-8,
            `${definition.sku} ${width} ${scale} ${scene.face} ${component.kind}/${component.role || component.label || component.variant} ${JSON.stringify(primitive)}`);
        }
      }
    }
  });
}

test("source diagrams keep integrated 7010 power separate from modular 7020 power and their exact fan topology", () => {
  const get = (name) => resolveAristaFaceplate(fixture(`${name} family`));
  const rear7010 = get("7010").faces.rear.components;
  assert.equal(rear7010.filter((part) => part.kind === "psu").length, 0);
  assert.equal(rear7010.filter((part) => part.kind === "power").length, 2);
  assert.equal(rear7010.filter((part) => part.role === "reversible-fan-module").length, 1);
  assert.equal(rear7010.find((part) => part.role === "reversible-fan-module").fanCount, 2);
  const rear7020 = get("7020").faces.rear.components;
  assert.equal(rear7020.filter((part) => part.kind === "psu").length, 2);
  assert.equal(rear7020.filter((part) => part.role?.startsWith("fan-tray-")).length, 4);
  const uplinks = get("7020").faces.front.ports.filter((port) => port.portIndex >= 49);
  assert.ok(uplinks.every((port) => port.x > .43 && port.x < .57));
});

test("matching 7050/7060 exact profiles are reused without mutating their artwork or inventory metadata", () => {
  for (const [family, model] of [["7050 family", "7050SX3-48YC8"], ["7060 family", "7060CX2-32S"]]) {
    const exact = resolveAristaFaceplate(fixture(model)), before = structuredClone(exact);
    const selected = resolveAristaFaceplate(fixture(family));
    assert.notEqual(selected, exact); assert.deepEqual(exact, before);
    for (const face of ["front", "rear"]) {
      assert.deepEqual(selected.faces[face].components, exact.faces[face].components);
      assert.deepEqual(selected.faces[face].ports.map(({ x, y, width, height }) => [x, y, width, height]),
        exact.faces[face].ports.map(({ x, y, width, height }) => [x, y, width, height]));
    }
  }
});

test("corrected PWR-511/PWR-500 artwork stays bounded in existing exact models and shares Canvas/SVG paths", () => {
  for (const model of ["7050SX3-48YC8", "7060CX2-32S"]) for (const width of [460, 690]) for (const scale of [1, 2]) {
    for (const original of scenes(fixture(model), width)[1].components.filter((part) => part.kind === "psu")) {
      const component = { ...original, x: original.x * scale, y: original.y * scale, width: original.width * scale, height: original.height * scale };
      const primitives = hardwarePrimitives(component), svg = hardwareComponentSVG(component);
      assert.equal(primitives.filter((part) => part.fill === "#ad2942").length, 1);
      for (const primitive of primitives) {
        const [left, top, right, bottom] = primitiveBounds(primitive);
        assert.ok(left >= component.x && top >= component.y && right <= component.x + component.width && bottom <= component.y + component.height);
      }
      const calls = [];
      const context = new Proxy({}, { get: (_object, key) => (...args) => calls.push([key, ...args]), set: () => true });
      drawHardwareComponent(context, component);
      assert.equal(calls.filter(([name]) => name === "closePath").length, primitives.filter((part) => part.kind === "polygon").length);
      assert.deepEqual([...svg.matchAll(/<polygon[^>]*points="([^"]+)"/g)].map((match) => match[1].split(" ").map((point) => point.split(",").map(Number))),
        primitives.filter((part) => part.kind === "polygon").map((part) => part.points));
    }
  }
});

test("exact and selected profiles share safe captions, including long custom service labels", () => {
  for (const [family, model] of [["7050 family", "7050SX3-48YC8"], ["7060 family", "7060CX2-32S"]]) {
    for (const face of ["front", "rear"]) {
      assert.deepEqual(resolveAristaFaceplate(fixture(family)).faces[face].ports.map(({ descriptionAnchor, physicalLabel }) => ({ descriptionAnchor, physicalLabel })),
        resolveAristaFaceplate(fixture(model)).faces[face].ports.map(({ descriptionAnchor, physicalLabel }) => ({ descriptionAnchor, physicalLabel })));
    }
  }
  for (const model of [...models.map((entry) => entry.model), "7050SX3-48YC8", "7060CX2-32S"]) {
    for (const custom of [false, true]) for (const width of [460, 690]) for (const legacy of [false, true]) {
      const device = fixture(model, legacy && model.includes("family"));
      if (custom) for (const port of device.ports) port.label = `Long custom uplink/service caption ${port.portIndex}`;
      const before = structuredClone(device);
      for (const scene of scenes(device, width)) {
        const captions = [];
        for (const slot of scene.ports) {
          if (custom) assert.equal(slot.displayLabel, slot.port.label);
          const label = slot.labelPlacement;
          const w = Math.min(label.boxMaxWidth, Math.max(12, Math.min(label.maxWidth, slot.displayLabel.length * label.fontSize) + 6));
          const box = { x: label.x - w / 2, y: label.y - label.boxHeight / 2, width: w, height: label.boxHeight };
          assert.ok(box.x >= scene.chassis.x && box.y >= scene.chassis.y && box.x + box.width <= scene.chassis.x + scene.chassis.width && box.y + box.height <= scene.chassis.y + scene.chassis.height);
          for (const other of [...captions, ...scene.ports, ...scene.components.filter((part) => !part.applicationOverlay)]) {
            assert.ok(!overlaps(box, other), `${model} ${width} ${scene.face} ${slot.displayLabel} overlaps ${other.role || other.kind || "caption/socket"}`);
          }
          captions.push(box);
        }
      }
      assert.deepEqual(device, before);
    }
  }
});

test("all four selected 1U bodies retain their native dimensions inside historical 2U allocations", () => {
  for (const definition of models) for (const width of [460, 690]) {
    const native = fixture(definition.model), saved = fixture(definition.model, true), before = structuredClone(saved);
    const nativeScenes = scenes(native, width), savedScenes = scenes(saved, width);
    for (let face = 0; face < 2; face++) {
      const a = nativeScenes[face].chassis, b = savedScenes[face].chassis;
      assert.ok(Math.abs(a.width / a.height - b.width / b.height) < 1e-8);
      assert.ok(Math.abs(a.width - b.width) < 1e-8 && Math.abs(a.height - b.height) < 1e-8);
      for (const slot of savedScenes[face].ports) {
        const canonicalIndex = new Map(definition.map).get(slot.port.portIndex);
        const current = nativeScenes[face].ports.find((entry) => entry.port.portIndex === canonicalIndex);
        assert.ok(current); assert.ok(Math.abs(slot.width - current.width) < 1e-8 && Math.abs(slot.height - current.height) < 1e-8);
      }
    }
    assert.equal(saved.faceplate.unitsU, 2); assert.deepEqual(saved, before);
  }
});
