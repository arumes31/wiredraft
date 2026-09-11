import assert from "node:assert/strict";
import test from "node:test";
import { hardwareCatalog, instantiateProfile, upgradeInstalledPhysicalPorts } from "./static/js/catalog.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";
import { resolveFaceplateTemplate } from "./static/js/faceplate.js";
import { hardwarePrimitives, hardwareComponentSVG, drawHardwareComponent } from "./static/js/hardware-components.js";

const cases = [["X440-G2", 54, 50, 4, 1, 441.5], ["X450-G2", 56, 54, 2, 3, 441], ["X460-G2", 54, 54, 0, 1, 441]];

/** Reproduce the separately executed frozen438 constructor without importing private audit snapshots into committed tests. */
function fixture(model, legacy = false) {
  let profile = hardwareCatalog.find((entry) => entry.vendor === "Extreme" && entry.model === model);
  if (legacy) profile = { ...profile, units: 1, inventoryRevision: 0, groups: [
    { zone: "access", count: 48, type: "RJ45_MGIG", speed: 2500, poe: true, prefix: "" },
    { zone: "uplink", count: 8, type: "SFP28_25G", speed: 25000, poe: false, prefix: "SFP28" },
    { zone: "management", count: 1, type: "RJ45_1G", speed: 1000, poe: false, prefix: "MGMT" },
    { zone: "uplink", count: 2, type: "Stack", speed: 40000, poe: false, prefix: "STACK" },
  ] };
  const device = instantiateProfile(profile, model, { x: 17, y: 34 }); device.id = model;
  device.ports.forEach((port) => { port.id = `${model}-${port.portIndex}`; port.deviceId = model; });
  return device;
}

/** Build the actual physical face within the retained rack reservation. */
function scene(device, width = 460, face = "front") {
  return buildFaceplateScene(device, { x: 0, y: 0, width, height: device.faceplate.unitsU * 100 }, { face });
}

/** Detect overlapping areas while permitting touching outlines. */
function overlaps(a, b) { return a.x < b.x + b.width - 1e-8 && a.x + a.width > b.x + 1e-8 && a.y < b.y + b.height - 1e-8 && a.y + a.height > b.y + 1e-8; }

/** Compute conservative primitive bounds including stroke thickness. */
function bounds(part) {
  const half = part.stroke ? (part.strokeWidth || 0) / 2 : 0;
  if (part.kind === "text") return [part.x - part.text.length * part.fontSize * .31, part.y - part.fontSize / 2, part.x + part.text.length * part.fontSize * .31, part.y + part.fontSize / 2];
  if (part.kind === "polygon") return [Math.min(...part.points.map(([x]) => x)) - half, Math.min(...part.points.map(([, y]) => y)) - half, Math.max(...part.points.map(([x]) => x)) + half, Math.max(...part.points.map(([, y]) => y)) + half];
  if (part.kind === "circle") return [part.cx - part.r - half, part.cy - part.r - half, part.cx + part.r + half, part.cy + part.r + half];
  if (part.kind === "line") return [Math.min(part.x1, part.x2) - half, Math.min(part.y1, part.y2) - half, Math.max(part.x1, part.x2) + half, Math.max(part.y1, part.y2) + half];
  return [part.x - half, part.y - half, part.x + part.width + half, part.y + part.height + half];
}

for (const [model, total, frontCount, rearCount, mapped, bodyWidth] of cases) {
  test(`${model} discloses its exact SKU, source configuration and complete selected logical inventory`, () => {
    const device = fixture(model), front = scene(device), rear = scene(device, 460, "rear");
    assert.equal(device.ports.length, total); assert.equal(device.faceplate.unitsU, 1);
    assert.equal(front.profile.sku, `${model}-48p-10GE4`); assert.equal(front.profile.fidelity, "model");
    assert.deepEqual(front.profile.evidence.models, [`${model}-48p-10GE4`]); assert.equal(front.profile.evidence.selectedModel, front.profile.sku);
    assert.equal(front.profile.rearHardwareVerified, true); assert.equal(front.ports.length, frontCount); assert.equal(rear.ports.length, rearCount);
    assert.ok(device.ports.slice(0, 48).every((port) => port.type === "RJ45_1G" && port.speedMbps === 1000));
    assert.equal([...front.components, ...rear.components].filter((part) => part.ancillarySocket).length, 0);
    if (model !== "X440-G2") {
      const fan = rear.components.find((part) => part.kind === "fan"), supply = rear.components.find((part) => part.kind === "psu");
      assert.equal(fan.model, "10945"); assert.equal(fan.rotors, 3); assert.equal(supply.model, "10951"); assert.equal(supply.watts, 715);
      assert.equal(supply.inlet, "IEC C16"); assert.equal(rear.components.filter((part) => part.kind === "psu").length, 1);
      assert.ok(rear.components.some((part) => part.role === "psu-left-cover"));
    } else assert.equal(rear.components.filter((part) => ["fan", "psu"].includes(part.kind)).length, 0);
    if (model === "X450-G2") assert.deepEqual(device.ports.filter((port) => port.type === "Stack").map((port) => [port.portIndex, port.speedMbps]), [[53, 21000], [54, 21000]]);
    if (model === "X460-G2") assert.ok(["tm-clk-cover", "vim-cover"].every((role) => rear.components.some((part) => part.role === role)));
  });

  test(`${model} preserves true438 IDs, settings, cables and explicit compatible identities`, () => {
    const device = fixture(model, true);
    assert.equal(device.ports.length, 59);
    assert.deepEqual(device.ports.slice(56).map((port) => [port.portIndex, port.type, port.label]), [[57, "Stack", "STACK1"], [58, "Stack", "STACK2"], [59, "RJ45_1G", "MGMT"]]);
    device.ports.reverse(); device.rackId = "saved-rack"; device.rackPosition = 27;
    device.ports.forEach((port) => { port.label = `Saved caption ${port.portIndex}`; port.speedMbps = 40000; port.isPoe = true; port.nativeVlan = 29; port.allowedVlans = [29, 70]; });
    const topology = { devices: [device], links: [{ sourceDeviceId: device.id, sourcePortId: `${model}-57`, targetDeviceId: "peer", targetPortId: "unchanged" }] };
    const before = structuredClone(topology), faces = [scene(device), scene(device, 690, "rear")];
    assert.equal(faces.flatMap((face) => face.ports).length, mapped); assert.equal(faces[0].unmappedPorts.length, 59 - mapped);
    assert.equal(faces.flatMap((face) => face.components.filter((part) => part.ancillarySocket)).length, total - mapped);
    assert.equal(upgradeInstalledPhysicalPorts(device), false); assert.deepEqual(topology, before);
    assert.deepEqual(faces.flatMap((face) => face.ports).map((port) => port.port.portIndex).sort((a, b) => a - b), model === "X450-G2" ? [57, 58, 59] : [59]);
    const sparse = structuredClone(device); sparse.ports = sparse.ports.filter((port) => [1, 49, 57, 59].includes(port.portIndex));
    const sparseMapped = model === "X450-G2" ? 2 : 1;
    assert.equal(scene(sparse).ports.length + scene(sparse, 690, "rear").ports.length, sparseMapped);
    const duplicate = structuredClone(sparse); duplicate.ports.push({ ...duplicate.ports.find((port) => port.portIndex === 59), id: "duplicate" });
    assert.equal(scene(duplicate).unmappedPorts.length, 5 - sparseMapped);
    const mismatch = structuredClone(device); mismatch.ports.forEach((port) => { port.type = "QSFP_PLUS_40G"; });
    assert.equal(scene(mismatch).ports.length + scene(mismatch, 690, "rear").ports.length, 0);
    const unknown = structuredClone(device); unknown.faceplate.inventoryRevision = 98;
    assert.equal(scene(unknown).ports.length + scene(unknown, 690, "rear").ports.length, 0); assert.equal(scene(unknown).unmappedPorts.length, 59);
  });

  test(`${model} fits manufacturer native aspect at460 and retains the same body in edited2U allocations`, () => {
    const current = fixture(model), old = fixture(model, true), larger = structuredClone(old); larger.faceplate.unitsU = 2;
    assert.ok(Math.abs(scene(current).chassis.height / scene(current).chassis.width - 44 / bodyWidth) < 1e-9);
    for (const width of [460, 690]) {
      assert.deepEqual(scene(current, width).chassis, scene(old, width).chassis);
      assert.deepEqual(scene(current, width).chassis, scene(larger, width).chassis);
      assert.equal(larger.faceplate.unitsU, 2); assert.equal(larger.ports.length, 59);
    }
  });

  test(`${model} finite native and saved captions clear all source hardware at460/690`, () => {
    for (const width of [460, 690]) for (const legacy of [false, true]) for (const custom of [false, true]) for (const face of ["front", "rear"]) {
      const device = fixture(model, legacy); if (custom) device.ports.forEach((port) => { port.label = `Long saved service label ${port.portIndex}`; });
      const result = scene(device, width, face);
      for (const port of result.ports) {
        const label = port.labelPlacement, caption = { x: label.x - label.boxMaxWidth / 2, y: label.y - label.boxHeight / 2, width: label.boxMaxWidth, height: label.boxHeight };
        assert.ok([label.x, label.y, label.maxWidth, label.boxMaxWidth].every(Number.isFinite));
        if (!custom && /^\d{2}$/.test(port.displayLabel)) assert.ok(label.maxWidth >= 6.6, `${model} caption${port.displayLabel} native text budget`);
        for (const component of result.components) {
          assert.ok(!overlaps(port, component), `${model} ${width} ${face} socket${port.port.portIndex}/${component.role || component.kind}`);
          assert.ok(!overlaps(caption, component), `${model} ${width} ${face} caption${port.port.portIndex}/${component.role || component.kind}`);
        }
        for (const other of result.ports) assert.ok(!overlaps(caption, other), `${model} caption${port.port.portIndex}/socket${other.port.portIndex}`);
      }
      for (const socket of result.components.filter((part) => part.ancillarySocket || part.comboAlternative)) for (const component of result.components.filter((part) => !part.ancillarySocket && !part.comboAlternative)) assert.ok(!overlaps(socket, component), `${model} physical alternative/${component.role || component.kind}`);
    }
  });

  test(`${model} component and connector primitives stay inside physical bounds at460/6901x/2x`, () => {
    for (const width of [460, 690]) for (const legacy of [false, true]) for (const face of ["front", "rear"]) for (const scale of [1, 2]) {
      const result = scene(fixture(model, legacy), width, face);
      for (const part of [...result.components, ...result.ports.map((port) => ({ ...port, kind: port.connectorKind }))]) {
        const component = { ...part, x: part.x * scale, y: part.y * scale, width: part.width * scale, height: part.height * scale };
        const primitives = hardwarePrimitives(component); assert.ok(primitives.length > 0);
        for (const primitive of primitives) {
          const box = bounds(primitive); assert.ok(box.every(Number.isFinite));
          assert.ok(box[0] >= component.x - 1e-5 && box[1] >= component.y - 1e-5 && box[2] <= component.x + component.width + 1e-5 && box[3] <= component.y + component.height + 1e-5,
            `${model} ${width} ${legacy} ${scale} ${part.role || part.kind} ${JSON.stringify(primitive)}`);
        }
      }
    }
  });
}

test("X440 alternatives share physical identities and its redundant connector matches the source18-pin receptacle", () => {
  const device = fixture("X440-G2"), front = scene(device), rear = scene(device, 460, "rear");
  assert.deepEqual(front.components.filter((part) => part.comboAlternative).map((part) => part.sharedWithPortIndex), [45, 46, 47, 48]);
  assert.deepEqual(rear.components.filter((part) => part.comboAlternative).map((part) => part.sharedWithPortIndex), [51, 52]);
  const connector = rear.components.find((part) => part.role === "redundant-power-input");
  assert.equal(hardwarePrimitives(connector).filter((part) => part.kind === "rect" && part.fill === "#cbd4d7").length, 18);
  assert.equal(connector.installedExternalSupply, false);
});

test("source management above console and opposed copper/optical orientations remain explicit", () => {
  for (const [model] of cases) {
    const profile = scene(fixture(model)).profile, slots = profile.faces.front.ports;
    const management = slots.find((port) => port.physicalLabel === "MGMT"), console = slots.find((port) => port.physicalLabel === "CON");
    assert.ok(management.y < console.y); assert.equal(management.connectorKind, "rj45-inverted"); assert.equal(console.connectorKind, "rj45");
    assert.ok(slots.filter((port) => port.portIndex <= 48 && port.portIndex % 2).every((port) => port.connectorKind === "rj45-inverted"));
    assert.ok(slots.filter((port) => port.portIndex <= 48 && !(port.portIndex % 2)).every((port) => port.connectorKind === "rj45"));
  }
});

test("G2 management captions retain their measured native font width within the shorter source body", () => {
  for (const [model] of cases) {
    const management = scene(fixture(model)).ports.find((port) => port.port.portIndex === (model === "X450-G2" ? 55 : 53));
    assert.ok(management.labelPlacement.maxWidth >= 12.762, `${model} actual Chromium Bahnschrift Condensed MGMT width12.76171875px`);
  }
});

test("source-informed purple palette covers inspected G2 aliases and excludes Cisco", () => {
  for (const [model] of cases) {
    const palette = resolveFaceplateTemplate(fixture(model));
    assert.equal(palette.id, "extreme-g2"); assert.equal(palette.surface, "#756497"); assert.equal(palette.surfaceDark, "#4f4269");
    assert.equal(palette.ink, "#f3eff8"); assert.equal(palette.accent, "#d9d339");
    assert.equal(palette.source, "https://documentation.extremenetworks.com/extremeswitching/downloads/EXOS30_HWInstall.pdf");
  }
  const other = resolveFaceplateTemplate({ ...fixture("X870"), faceplate: { ...fixture("X870").faceplate, vendor: "Cisco" } });
  assert.notEqual(other.id, "extreme-g2"); assert.notEqual(other.surface, "#756497");
});

test("10945 protective grille rings use truly unfilled primitives in Canvas and SVG", () => {
  const fan = scene(fixture("X450-G2"), 460, "rear").components.find((part) => part.kind === "fan");
  const primitives = hardwarePrimitives(fan);
  assert.ok(primitives.every((part) => part.fill !== "none"), "Canvas does not accept the SVG-only string none as a fillStyle");
  assert.equal(primitives.filter((part) => part.kind === "circle" && part.fill === undefined).length, 9);
  const svg = hardwareComponentSVG(fan);
  assert.equal((svg.match(/<circle[^>]*fill="none"/g) || []).length, 9);
  const calls = [], context = new Proxy({}, { get: (_object, key) => (...args) => calls.push([key, ...args]), set: () => true });
  drawHardwareComponent(context, fan);
  assert.equal(calls.filter(([name]) => name === "fill").length, 6, "Only tray, handle and four screws fill; the nine guard rings must remain open");
});

test("G2 hardware uses identical primitives for Canvas and SVG and preserves sparse current inventories", () => {
  for (const [model, total] of cases) {
    for (const face of ["front", "rear"]) for (const component of scene(fixture(model), 460, face).components) {
      const primitives = hardwarePrimitives(component), svg = hardwareComponentSVG(component), calls = [];
      const context = new Proxy({}, { get: (_object, key) => (...args) => calls.push([key, ...args]), set: () => true });
      drawHardwareComponent(context, component);
      assert.deepEqual(calls.filter(([name]) => name === "arc").map(([, x, y, radius]) => [x, y, radius]), primitives.filter((part) => part.kind === "circle").map((part) => [part.cx, part.cy, part.r]));
      assert.equal((svg.match(/<polygon\b/g) || []).length, primitives.filter((part) => part.kind === "polygon").length);
    }
    const sparse = fixture(model); sparse.ports = sparse.ports.filter((port) => [1, 49, total].includes(port.portIndex)).reverse();
    const before = structuredClone(sparse), faces = [scene(sparse), scene(sparse, 690, "rear")];
    assert.equal(faces.flatMap((face) => face.ports).length, 3); assert.equal(faces.flatMap((face) => face.components.filter((part) => part.ancillarySocket)).length, total - 3); assert.deepEqual(sparse, before);
    for (const revision of [1, 98]) {
      const empty = fixture(model); empty.ports = []; empty.faceplate.inventoryRevision = revision;
      const emptyFaces = [scene(empty), scene(empty, 690, "rear")];
      assert.equal(emptyFaces.flatMap((face) => face.ports).length, 0); assert.equal(emptyFaces.flatMap((face) => face.components.filter((part) => part.ancillarySocket)).length, total);
    }
  }
});
