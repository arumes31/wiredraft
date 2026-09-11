import assert from "node:assert/strict";
import test from "node:test";
import { accessAdditionProfiles } from "./static/js/catalog-access-additions.js";
import { hardwareCatalog, instantiateProfile, upgradeInstalledPhysicalPorts } from "./static/js/catalog.js";
import { resolveAccessAdditionFaceplate } from "./static/js/faceplate-access-additions-models.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";
import { hardwarePrimitives, hardwareComponentSVG, drawHardwareComponent } from "./static/js/hardware-components.js";
import { resolveFaceplateTemplate } from "./static/js/faceplate.js";
import { addAccessAdditionComponent } from "./static/js/hardware-access-additions-components.js";

const counts = [5, 54, 30, 26];

/** Construct a real registered device with distinct saved endpoint identities. */
function fixture(row) {
  const registered = hardwareCatalog.find(p => p.vendor === row.vendor && p.model === row.model);
  assert.ok(registered, `${row.model} must be integrated into the real catalog`);
  const device = instantiateProfile(registered, "User equipment", { x: 37, y: 51 });
  device.id = row.sku;
  device.ports.forEach(port => { port.id = `${row.sku}-${port.portIndex}`; port.deviceId = device.id; });
  return device;
}

/** Build the production scene within the actual retained allocation. */
function scene(device, width = 690, face = "front") {
  return buildFaceplateScene(device, { x: 11, y: 17, width, height: device.faceplate.unitsU * 100 }, { face });
}

/** Detect positive occupied-area intersection without rejecting touching edges. */
function overlaps(a, b) {
  return a.x < b.x + b.width - 1e-8 && a.x + a.width > b.x + 1e-8 &&
    a.y < b.y + b.height - 1e-8 && a.y + a.height > b.y + 1e-8;
}

/** Bound every drawn primitive including its stroke for both renderer contracts. */
function bounds(p) {
  const half = p.stroke ? (p.strokeWidth || 0) / 2 : 0;
  if (p.kind === "circle") return [p.cx - p.r - half, p.cy - p.r - half, p.cx + p.r + half, p.cy + p.r + half];
  if (p.kind === "polygon") return [Math.min(...p.points.map(v => v[0])) - half, Math.min(...p.points.map(v => v[1])) - half,
    Math.max(...p.points.map(v => v[0])) + half, Math.max(...p.points.map(v => v[1])) + half];
  if (p.kind === "line") return [Math.min(p.x1, p.x2) - half, Math.min(p.y1, p.y2) - half, Math.max(p.x1, p.x2) + half, Math.max(p.y1, p.y2) + half];
  if (p.kind === "text") return [p.x - p.text.length * p.fontSize * .31, p.y - p.fontSize / 2, p.x + p.text.length * p.fontSize * .31, p.y + p.fontSize / 2];
  return [p.x - half, p.y - half, p.x + p.width + half, p.y + p.height + half];
}

test("four source-selected rack rows have exact inventories and scoped palette", () => {
  accessAdditionProfiles.forEach((row, index) => {
    const d = fixture(row), s = scene(d);
    assert.equal(d.ports.length, counts[index]); assert.equal(d.faceplate.unitsU, 1);
    assert.equal(d.faceplate.inventoryRevision, 1); assert.equal(row.preserveInstalledPorts, true);
    assert.equal(s.profile.fidelity, "model"); assert.equal(s.profile.sku, row.sku);
    assert.equal(s.ports.length, counts[index]); assert.equal(s.unmappedPorts.length, 0);
    assert.ok(d.ports.every(p => !p.isPoe)); assert.equal(scene(d, 690, "rear").ports.length, 0);
    assert.ok(!["#263b4b", "#27383a"].includes(resolveFaceplateTemplate(d).surface));
  });
  assert.deepEqual(fixture(accessAdditionProfiles[0]).ports.map(p => [p.type, p.label]), [
    ["RJ45_1G", "GE0/0/0"], ["RJ45_1G", "GE0/0/1"], ["SFP_1G", "GE0/0/2"], ["SFP_1G", "GE0/0/3"], ["Console", "CONSOLE"]]);
  for (const row of accessAdditionProfiles.slice(1, 3)) {
    const d = fixture(row); assert.deepEqual(d.ports.slice(-2).map(p => [p.type, p.label]), [["Console", "CONSOLE"], ["USB_MICRO_CONSOLE", "USB CONSOLE"]]);
  }
  assert.ok(fixture(accessAdditionProfiles[3]).ports.every(p => ["RJ45_1G", "SFP_1G"].includes(p.type)));
});

test("incoming IDs, numeric labels, edited settings, sparse arrays and allocations remain unchanged", () => {
  for (const row of accessAdditionProfiles) for (const sparse of [false, true]) {
    const d = fixture(row); d.faceplate.unitsU = 4; d.rackId = "rack"; d.rackPosition = 13; d.ports.reverse();
    if (sparse) d.ports = d.ports.filter((_, index) => index % 3 === 0);
    d.ports.forEach(p => Object.assign(p, { speedMbps: 123, group: "user group", nativeVlan: 13, allowedVlans: [13, 97], isPoe: true }));
    const topology = { devices: [d], links: d.ports.map(p => ({ id: `cable-${p.id}`, sourceDeviceId: d.id, sourcePortId: p.id, targetPortId: "peer", points: [{ x: 4, y: 9 }] })) };
    const before = structuredClone(topology); assert.equal(upgradeInstalledPhysicalPorts(topology), false);
    for (const width of [460, 690]) {
      const s = scene(d, width); assert.equal(s.ports.length, d.ports.length); assert.equal(s.unmappedPorts.length, 0);
      assert.equal(s.components.filter(c => c.ancillarySocket).length, counts[accessAdditionProfiles.indexOf(row)] - d.ports.length);
      assert.deepEqual(s.chassis, scene(fixture(row), width).chassis, "4U saved allocation retains the same native1U body");
    }
    assert.deepEqual(topology, before);
    for (const revision of [0, 99]) { d.faceplate.inventoryRevision = revision; assert.equal(scene(d).ports.length, 0); assert.equal(scene(d).unmappedPorts.length, d.ports.length); }
  }
});

test("unsupported media, duplicate identities and unknown keys cannot claim a physical socket", () => {
  for (const row of accessAdditionProfiles) {
    const d = fixture(row); d.ports[0].type = "SFP28_25G"; assert.equal(scene(d).unmappedPorts.length, 1);
    const duplicate = fixture(row); duplicate.ports.push({ ...duplicate.ports[0], id: "duplicate" });
    assert.equal(scene(duplicate).unmappedPorts.length, 1);
    const empty = fixture(row); empty.ports = []; assert.equal(scene(empty).ports.length, 0);
    assert.equal(scene(empty).components.filter(c => c.ancillarySocket).length, counts[accessAdditionProfiles.indexOf(row)]);
  }
  for (const model of ["constructor", "toString", "__proto__", "2530-48G-PoE+"]) assert.equal(resolveAccessAdditionFaceplate({ model, faceplate: { vendor: "HPE Aruba" } }), null);
  assert.equal(resolveAccessAdditionFaceplate({ model: "C8200-1N-4T", faceplate: { vendor: "Other" } }), null);
  assert.equal(resolveAccessAdditionFaceplate(null), null);
});

test("source assembly populations exclude invented management, expansion, fans and PSUs", () => {
  const cisco = scene(fixture(accessAdditionProfiles[0]));
  for (const role of ["pim-cover", "nim-cover", "m2-storage", "usb-storage"]) assert.equal(cisco.components.filter(c => c.role === role).length, 1);
  const rear = scene(fixture(accessAdditionProfiles[0]), 690, "rear");
  assert.equal(rear.components.filter(c => c.role === "fixed-fan").length, 2);
  assert.equal(rear.components.filter(c => c.role === "ac-inlet").length, 1);
  for (const row of accessAdditionProfiles.slice(1)) {
    const s = scene(fixture(row), 690, "rear");
    assert.equal(s.components.filter(c => c.role === "ac-inlet").length, 1);
    assert.equal(s.components.filter(c => c.kind === "fan" || c.kind === "psu").length, 0);
  }
});

test("source body aspect and inward contact pairs survive both display widths", () => {
  for (const row of accessAdditionProfiles) for (const width of [460, 690]) {
    const s = scene(fixture(row), width), body = s.components.find(c => c.role === "source-body"), dimensions = s.profile.evidence.physicalDimensions;
    assert.ok(Math.abs(body.height / body.width - dimensions.heightMm / dimensions.widthMm * 690 / width) < 1e-8);
    const top = s.ports.find(p => p.port.portIndex === 1), bottom = s.ports.find(p => p.port.portIndex === 2);
    for (const [port, upper] of [[top, true], [bottom, false]]) {
      const pins = hardwarePrimitives({ ...port, kind: port.connectorKind }).filter(p => p.kind === "rect" && p.fill === "#d7b76c");
      assert.equal(pins.length, 8); assert.ok(pins.every(p => upper ? p.y > port.y + port.height / 2 : p.y + p.height < port.y + port.height / 2));
    }
  }
});

test("all sockets, restored apertures and captions clear hardware at460/690", () => {
  for (const row of accessAdditionProfiles) for (const width of [460, 690]) for (const sparse of [false, true]) {
    const d = fixture(row); if (sparse) d.ports = d.ports.filter(p => p.portIndex % 2);
    d.ports.forEach(p => p.label = `Custom customer circuit ${p.portIndex}`);
    const s = scene(d, width), hardware = s.components.filter(c => !c.applicationOverlay && c.hardwareLayer !== "chassis-container");
    const all = [...s.ports, ...hardware];
    for (const p of s.ports) {
      const l = p.labelPlacement, box = { x: l.x - l.boxMaxWidth / 2, y: l.y - l.boxHeight / 2, width: l.boxMaxWidth, height: l.boxHeight };
      assert.ok(!l.hidden); assert.ok(l.fontSize >= 5.5); assert.ok(l.boxHeight >= 7);
      for (const q of all) { if (q !== p) assert.ok(!overlaps(p, q), `${row.sku} socket${p.port.portIndex}/${q.role || q.port?.portIndex || q.kind}`);
        assert.ok(!overlaps(box, q), `${row.sku} caption${p.port.portIndex}/${q.role || q.port?.portIndex || q.kind}`); }
    }
  }
});

test("source hardware primitives fit their bounds and Canvas/SVG share the same paths", () => {
  for (const row of accessAdditionProfiles) for (const width of [460, 690]) for (const face of ["front", "rear"]) {
    const s = scene(fixture(row), width, face);
    for (const c of s.components.filter(c => !c.applicationOverlay)) {
      const art = hardwarePrimitives(c); assert.ok(art.length, `${row.sku} ${c.variant || c.kind} artwork`);
      for (const p of art) { const b = bounds(p); assert.ok(b.every(Number.isFinite));
        assert.ok(b[0] >= c.x - 1e-7 && b[1] >= c.y - 1e-7 && b[2] <= c.x + c.width + 1e-7 && b[3] <= c.y + c.height + 1e-7,
          `${row.sku} ${width} ${c.variant || c.kind}: ${JSON.stringify(p)}`); }
      const calls = [], context = new Proxy({}, { get: (_, key) => (...args) => calls.push([key, ...args]), set: () => true });
      drawHardwareComponent(context, c);
      assert.equal(calls.filter(call => call[0] === "arc").length, art.filter(p => p.kind === "circle").length);
      assert.equal((hardwareComponentSVG(c).match(/<polygon\b/g) || []).length, art.filter(p => p.kind === "polygon").length);
    }
  }
  for (const variant of [undefined, null, 123, {}, "access-addition-unknown"]) assert.equal(addAccessAdditionComponent({}, { variant }), false);
});
