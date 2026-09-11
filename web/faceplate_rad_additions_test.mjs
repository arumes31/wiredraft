import assert from "node:assert/strict";
import test from "node:test";
import { radAdditionProfiles } from "./static/js/catalog-rad-additions.js";
import { hardwareCatalog, instantiateProfile, upgradeInstalledPhysicalPorts } from "./static/js/catalog.js";
import { resolveRadAdditionFaceplate } from "./static/js/faceplate-rad-additions-models.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";
import { hardwarePrimitives, hardwareComponentSVG, drawHardwareComponent } from "./static/js/hardware-components.js";
import { addRadAdditionComponent } from "./static/js/hardware-rad-additions-components.js";

/** Exercise the registered production constructor with fixed independent endpoint identities. */
function fixture() {
  const row = hardwareCatalog.find(row => row.vendor === "RAD" && row.model === "ETX-203AX");
  assert.ok(row, "RAD row must be integrated");
  const device = instantiateProfile(row, "Saved demarcation", { x: 15, y: 40 });
  device.id = "rad"; device.ports.forEach(port => { port.id = `rad-${port.portIndex}`; port.deviceId = "rad"; });
  return device;
}

/** Build actual geometry inside the existing saved allocation. */
function scene(device, width = 690, face = "rear") {
  return buildFaceplateScene(device, { x: 10, y: 10, width, height: device.faceplate.unitsU * 100 }, { face });
}

/** Test positive occupied-area intersection while allowing touching edges. */
function overlaps(a, b) {
  return a.x < b.x + b.width - 1e-7 && a.x + a.width > b.x + 1e-7 && a.y < b.y + b.height - 1e-7 && a.y + a.height > b.y + 1e-7;
}

/** Include primitive stroke extents in the shared rendering bounds contract. */
function bounds(p) {
  const half = p.stroke ? (p.strokeWidth || 0) / 2 : 0;
  if (p.kind === "circle") return [p.cx - p.r - half, p.cy - p.r - half, p.cx + p.r + half, p.cy + p.r + half];
  if (p.kind === "polygon") return [Math.min(...p.points.map(v => v[0])) - half, Math.min(...p.points.map(v => v[1])) - half,
    Math.max(...p.points.map(v => v[0])) + half, Math.max(...p.points.map(v => v[1])) + half];
  if (p.kind === "line") return [Math.min(p.x1, p.x2) - half, Math.min(p.y1, p.y2) - half, Math.max(p.x1, p.x2) + half, Math.max(p.y1, p.y2) + half];
  if (p.kind === "text") return [p.x - p.text.length * p.fontSize * .31, p.y - p.fontSize / 2, p.x + p.text.length * p.fontSize * .31, p.y + p.fontSize / 2];
  return [p.x - half, p.y - half, p.x + p.width + half, p.y + p.height + half];
}

test("selected plastic GE configuration has six data sockets plus distinct rear management/control", () => {
  const d = fixture(), s = scene(d), row = radAdditionProfiles[0];
  assert.equal(row.sku, "ETX-203AX/GE/2SFP/2SFP2UTP"); assert.equal(row.preserveInstalledPorts, true);
  assert.deepEqual(d.ports.map(p => [p.type, p.label, p.speedMbps]), [["RJ45_1G", "3", 1000], ["RJ45_1G", "4", 1000],
    ["SFP_1G", "1", 1000], ["SFP_1G", "2", 1000], ["SFP_1G", "5", 1000], ["SFP_1G", "6", 1000], ["RJ45_1G", "MNG-ETH", 100], ["Console", "CONTROL", 0]]);
  assert.equal(s.ports.length, 8); assert.equal(scene(d, 690, "front").ports.length, 0);
  assert.equal(s.profile.fidelity, "model"); assert.equal(s.profile.inventoryRevision, 1); assert.equal(s.chassis.componentDrawn, true);
  assert.equal(s.components.filter(c => c.role === "ac-inlet").length, 1);
  assert.equal(s.components.find(c => c.role === "ac-inlet").variant, "ac-sideways-left");
  assert.ok(!s.components.some(c => ["usb", "fan", "psu", "module-bay"].includes(c.kind)));
  assert.ok(s.components.filter(c => /schematic-rack/.test(c.role)).every(c => c.accessoryFidelity === "schematic"));
  const status = scene(d, 690, "front").components.find(c => c.role === "front-status");
  assert.ok(hardwarePrimitives(status, { ink: "#ffffff" }).filter(p => p.kind === "text").every(p => p.fill === "#394d53"), "front printing keeps source dark ink on pale plastic regardless of generic palette");
});

test("source identity mapping preserves edited numeric labels, sparse arrays, cables and rack allocation", () => {
  for (const sparse of [false, true]) {
    const d = fixture(); d.faceplate.unitsU = 4; d.rackId = "rack"; d.rackPosition = 19; d.ports.reverse();
    if (sparse) d.ports = d.ports.filter((_, index) => index % 2 === 0);
    d.ports.forEach((p, i) => Object.assign(p, { label: i % 2 ? "99" : "Saved <customer> & circuit", speedMbps: 123, nativeVlan: 47, allowedVlans: [47, 89], group: "edited", isPoe: true }));
    const topology = { devices: [d], links: d.ports.map(p => ({ id: `c-${p.id}`, sourceDeviceId: d.id, sourcePortId: p.id, targetPortId: "peer", points: [{ x: 3, y: 4 }] })) };
    const before = structuredClone(topology); assert.equal(upgradeInstalledPhysicalPorts(topology), false);
    for (const width of [460, 690]) {
      const s = scene(d, width); assert.equal(s.ports.length, d.ports.length); assert.equal(s.unmappedPorts.length, 0);
      assert.equal(s.components.filter(c => c.ancillarySocket).length, 8 - d.ports.length);
      assert.deepEqual(s.chassis, scene(fixture(), width).chassis);
      for (const p of s.ports) assert.equal(p.port, d.ports.find(q => q.id === p.port.id));
    }
    assert.deepEqual(topology, before);
    for (const revision of [0, 99]) { d.faceplate.inventoryRevision = revision; assert.equal(scene(d).ports.length, 0); assert.equal(scene(d).unmappedPorts.length, d.ports.length); }
  }
});

test("unsupported types, duplicate indices, unknown keys and empty inventory cannot fabricate endpoints", () => {
  const d = fixture(); d.ports[0].type = "SFP28_25G"; assert.equal(scene(d).unmappedPorts.length, 1);
  const duplicate = fixture(); duplicate.ports.push({ ...duplicate.ports[0], id: "duplicate" }); assert.equal(scene(duplicate).unmappedPorts.length, 1);
  const empty = fixture(); empty.ports = []; assert.equal(scene(empty).ports.length, 0); assert.equal(scene(empty).components.filter(c => c.ancillarySocket).length, 8);
  for (const model of ["constructor", "toString", "__proto__", "ETX-203AX-T"]) assert.equal(resolveRadAdditionFaceplate({ model, faceplate: { vendor: "RAD" } }), null);
  assert.equal(resolveRadAdditionFaceplate({ model: "ETX-203AX", faceplate: { vendor: "Other" } }), null);
  assert.equal(resolveRadAdditionFaceplate(null), null);
});

test("217mm body stays within schematic shelf and source aspect survives allocation at460/690", () => {
  for (const width of [460, 690]) for (const face of ["front", "rear"]) {
    const s = scene(fixture(), width, face), body = s.components.find(c => c.role === "source-body");
    assert.ok(Math.abs(body.width / s.chassis.width - 217 / (482.6 * .985)) < 1e-9);
    assert.ok(Math.abs(body.height / body.width - 43.7 / 217 * 690 / width) < 1e-8);
    assert.ok(body.x > s.chassis.x && body.x + body.width < s.chassis.x + s.chassis.width);
    assert.ok(s.components.every(c => c.applicationOverlay || (c.x >= s.chassis.x - 1e-7 && c.y >= s.chassis.y - 1e-7 && c.x + c.width <= s.chassis.x + s.chassis.width + 1e-7 && c.y + c.height <= s.chassis.y + s.chassis.height + 1e-7)));
  }
});

test("all rear sockets and readable captions clear source hardware at both widths with sparse custom records", () => {
  for (const width of [460, 690]) for (const sparse of [false, true]) {
    const d = fixture(); if (sparse) d.ports = d.ports.filter(p => p.portIndex % 2);
    d.ports.forEach(p => { p.label = "Very long saved <customer> & circuit " + p.portIndex; });
    const s = scene(d, width), all = [...s.ports, ...s.components.filter(c => !c.applicationOverlay && c.hardwareLayer !== "chassis-container")];
    for (const p of s.ports) {
      const l = p.labelPlacement, box = { x: l.x - l.boxMaxWidth / 2, y: l.y - l.boxHeight / 2, width: l.boxMaxWidth, height: l.boxHeight };
      assert.ok(!l.hidden); assert.ok(l.fontSize >= 5.5); assert.ok(l.boxHeight >= 7);
      for (const q of all) { if (p !== q) assert.ok(!overlaps(p, q), `socket${p.port.portIndex}/${q.role || q.port?.portIndex || q.kind}`);
        assert.ok(!overlaps(box, q), `caption${p.port.portIndex}/${q.role || q.port?.portIndex || q.kind}`); }
    }
  }
});

test("source and schematic hardware primitives fit bounds and share Canvas/SVG geometry", () => {
  for (const width of [460, 690]) for (const face of ["front", "rear"]) for (const c of scene(fixture(), width, face).components.filter(c => !c.applicationOverlay)) {
    const art = hardwarePrimitives(c); assert.ok(art.length, c.variant);
    for (const p of art) { const b = bounds(p); assert.ok(b.every(Number.isFinite));
      assert.ok(b[0] >= c.x - 1e-7 && b[1] >= c.y - 1e-7 && b[2] <= c.x + c.width + 1e-7 && b[3] <= c.y + c.height + 1e-7, `${width} ${c.variant}: ${JSON.stringify(p)}`); }
    const calls = [], context = new Proxy({}, { get: (_, key) => (...args) => calls.push([key, ...args]), set: () => true });
    drawHardwareComponent(context, c);
    assert.equal(calls.filter(call => call[0] === "arc").length, art.filter(p => p.kind === "circle").length);
    assert.equal((hardwareComponentSVG(c).match(/<polygon\b/g) || []).length, art.filter(p => p.kind === "polygon").length);
  }
  for (const variant of [undefined, null, 123, {}, "rad-addition-unknown"]) assert.equal(addRadAdditionComponent({}, { variant }), false);
});
