import assert from "node:assert/strict";
import test from "node:test";
import { hardwareCatalog, instantiateProfile, registerProfiles } from "./static/js/catalog.js";
import { resolveRackAccessoryFaceplate } from "./static/js/faceplate-rack-accessories-models.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";
import { connectorKind, connectorSize } from "./static/js/termination.js";
import { hardwarePrimitives, hardwareComponentSVG } from "./static/js/hardware-components.js";
import { defaultCableProperties } from "./static/js/cable-defaults.js";
import { planPatchPanelMapping } from "./static/js/patch-panels.js";

/** Build a saved-style accessory from the public catalog with stable endpoint IDs. */
function fixture(model) {
  const entry = hardwareCatalog.find(p => p.model === model);
  const d = instantiateProfile(entry, model, { x: 20, y: 30 });
  d.id = "accessory"; d.ports.forEach(p => { p.id = `port-${p.portIndex}`; p.deviceId = d.id; });
  return d;
}

/** Render the same physical inventory in each application display width. */
function scene(d, face, width = 690) { return buildFaceplateScene(d, { x: 0, y: 0, width, height: d.faceplate.unitsU * 100 }, { face }); }

/** Include painted strokes when checking the true bounds of connector and housing primitives. */
function paintedBounds(p) {
  const stroke = p.stroke ? (p.strokeWidth || 0) / 2 : 0;
  if (p.kind === "circle") return [p.cx - p.r - stroke, p.cy - p.r - stroke, p.cx + p.r + stroke, p.cy + p.r + stroke];
  if (p.kind === "line") return [Math.min(p.x1, p.x2) - stroke, Math.min(p.y1, p.y2) - stroke, Math.max(p.x1, p.x2) + stroke, Math.max(p.y1, p.y2) + stroke];
  if (p.kind === "polygon") return [Math.min(...p.points.map(v => v[0])) - stroke, Math.min(...p.points.map(v => v[1])) - stroke, Math.max(...p.points.map(v => v[0])) + stroke, Math.max(...p.points.map(v => v[1])) + stroke];
  if (p.kind === "text") return [p.x - p.text.length * p.fontSize * .31, p.y - p.fontSize / 2, p.x + p.text.length * p.fontSize * .31, p.y + p.fontSize / 2];
  return [p.x - stroke, p.y - stroke, p.x + p.width + stroke, p.y + p.height + stroke];
}

test("rack accessory housings and outlets contain every painted stroke460/6901x/2x", () => {
  for (const model of ["myUTN-80", "Rack power strip 8 Schuko", "Rack power strip 8 C13 + 2 C19"]) {
    for (const width of [460, 690]) for (const face of ["front", "rear"]) for (const scale of [1, 2]) {
      const result = scene(fixture(model), face, width);
      for (const raw of [...result.components, ...result.ports.map(p => ({ ...p, kind: p.connectorKind }))]) {
        const c = { ...raw, x: raw.x * scale, y: raw.y * scale, width: raw.width * scale, height: raw.height * scale };
        for (const p of hardwarePrimitives(c)) {
          assert.notEqual(p.fill, "none"); const b = paintedBounds(p);
          assert.ok(b.every(Number.isFinite));
          assert.ok(b[0] >= c.x - 1e-7 && b[1] >= c.y - 1e-7 && b[2] <= c.x + c.width + 1e-7 && b[3] <= c.y + c.height + 1e-7,
            `${model} ${width} ${face} ${raw.role || raw.kind}: ${JSON.stringify(p)}`);
        }
      }
    }
  }
});

test("SEH closed RMK1 exposes front100Mb LAN and rear DC, with USB safely inside the lid", () => {
  const d = fixture("myUTN-80"), p = resolveRackAccessoryFaceplate(d);
  assert.equal(p.sku, "myUTN-80 + RMK1"); assert.equal(p.fidelity, "model");
  assert.equal(new URL(p.source).origin, "https://www.seh-technology.com");
  assert.deepEqual(d.ports.map(p => [p.label, p.type, p.speedMbps]), [["LAN", "RJ45_1G", 100], ["DC IN", "Power", 0]]);
  assert.equal(scene(d, "front").ports[0].port.portIndex, 1);
  assert.equal(scene(d, "rear").ports[0].connectorKind, "rack-dc-barrel");
  assert.ok(scene(d, "front").components.some(c => c.role === "locked-dongle-cover"));
  assert.ok(!scene(d, "front").components.some(c => c.kind === "usb"));
  assert.match(p.note, /Eight USB 2\.0/);
});

for (const [model, count, kinds] of [
  ["Rack power strip 8 Schuko", 8, { "rack-schuko": 8 }],
  ["Rack power strip 8 C13 + 2 C19", 10, { "rack-c13": 8, "rack-c19": 2 }],
]) test(`${model} has distinct outlets, rear input and explicitly schematic provenance`, () => {
  const d = fixture(model), p = resolveRackAccessoryFaceplate(d), front = scene(d, "front"), rear = scene(d, "rear");
  assert.equal(p.fidelity, "schematic"); assert.equal(d.ports.length, count + 1);
  assert.ok(d.ports.every(p => p.mode === "Unconfigured" && p.nativeVlan === 0 && p.type === "Power"));
  assert.equal(front.ports.length, count); assert.equal(rear.ports.length, 1); assert.equal(rear.ports[0].connectorKind, "rack-c20");
  for (const [kind, n] of Object.entries(kinds)) assert.equal(front.ports.filter(p => p.connectorKind === kind).length, n);
  const ids = [...front.ports, ...rear.ports].map(p => p.port.id); assert.equal(new Set(ids).size, count + 1);
});

for (const model of ["myUTN-80", "Rack power strip 8 Schuko", "Rack power strip 8 C13 + 2 C19"]) {
  test(`${model} keeps sparse and reordered saved records and cables unchanged`, () => {
    const d = fixture(model); d.ports.reverse(); d.ports = d.ports.filter(p => p.portIndex % 2 === 0);
    d.rackId = "rack"; d.rackPosition = 12; d.faceplate.unitsU = 3;
    for (const p of d.ports) p.label = "A long renamed connection";
    const topology = { devices: [d], links: [{ sourceDeviceId: d.id, sourcePortId: d.ports[0].id, targetPortId: "peer" }] };
    const saved = structuredClone(topology);
    for (const width of [460, 690]) {
      const views = [scene(d, "front", width), scene(d, "rear", width)];
      assert.equal(views.flatMap(v => v.ports).length, d.ports.length);
      assert.ok(views.every(v => v.chassis.y + v.chassis.height <= 100));
      for (const v of views) for (const box of v.ports) assert.equal(box.displayLabel, "A long renamed connection");
    }
    assert.deepEqual(topology, saved);
  });
  test(`${model} produces finite bounded connector artwork at both renderer widths`, () => {
    const d = fixture(model);
    for (const width of [460, 690]) for (const face of ["front", "rear"]) {
      const v = scene(d, face, width);
      for (const box of v.ports) {
        assert.ok(box.x >= v.chassis.x && box.x + box.width <= v.chassis.x + v.chassis.width);
        const c = { ...box, kind: box.connectorKind || connectorKind(box.port.type) };
        assert.ok(hardwarePrimitives(c).length >= 3); assert.ok(!/NaN|Infinity/.test(hardwareComponentSVG(c)));
      }
    }
  });
}

test("SEH unknown revisions and incompatible inventory remain unmapped without replacing endpoint identity", () => {
  for (const revision of [0, 99]) {
    const d = fixture("myUTN-80"); d.faceplate.inventoryRevision = revision;
    const v = scene(d, "front"); assert.equal(v.ports.length, 0); assert.equal(v.unmappedPorts.length, 2);
  }
  const d = fixture("myUTN-80"); d.ports[0].type = "SFP_1G";
  assert.equal(scene(d, "front").unmappedPorts.length, 1);
  assert.equal(resolveRackAccessoryFaceplate({ model: "constructor", faceplate: { vendor: "SEH" } }), null);
});

test("storage media have distinct connector art and registration accepts their passive inventory", () => {
  const expected = [["SAS_MINI_HD_12G", "sas-mini-hd", 18], ["SAS_MINI_6G", "sas-mini", 23], ["FC_SFP_16G", "sfp", 17]];
  for (const [type, kind, width] of expected) {
    assert.equal(connectorKind(type), kind); assert.equal(connectorSize(type).width, width);
    const c = { kind, x: 0, y: 0, width: 36, height: 20 };
    assert.ok(hardwarePrimitives(c).length > 5); assert.ok(!/NaN|Infinity/.test(hardwareComponentSVG(c)));
  }
  const regular = hardwarePrimitives({ kind: "sas-mini-hd", x: 0, y: 0, width: 36, height: 20 });
  const inverted = hardwarePrimitives({ kind: "sas-mini-hd-inverted", x: 0, y: 0, width: 36, height: 20 });
  assert.equal(regular.length, inverted.length); assert.notDeepEqual(regular, inverted);
  const profile = { vendor: "Generic Test", model: "Storage connector import", category: "Server", units: 1, color: "#888888",
    groups: expected.map(([type]) => ({ zone: "access", count: 1, type, speed: 0, poe: false, prefix: type })) };
  try {
    assert.equal(registerProfiles([profile]), 1);
    const d = instantiateProfile(hardwareCatalog.find(p => p.model === profile.model), "test", { x: 0, y: 0 });
    assert.ok(d.ports.every(p => p.mode === "Unconfigured" && p.nativeVlan === 0));
  } finally {
    const index = hardwareCatalog.findIndex(p => p.model === profile.model); if (index >= 0) hardwareCatalog.splice(index, 1);
  }
});

test("new storage and power cables carry their actual media without inventing Ethernet VLANs", () => {
  for (const [type, cableType] of [["SAS_MINI_HD_12G", "SAS"], ["SAS_MINI_6G", "SAS"], ["FC_SFP_16G", "FIBER"], ["Power", "POWER"]]) {
    const device = { type, mode: "Unconfigured", nativeVlan: 0, allowedVlans: [] };
    const custom = { type, mode: "Access", nativeVlan: 77, allowedVlans: [77] };
    const before = structuredClone([device, custom]);
    for (const pair of [[device, custom], [custom, device]]) assert.deepEqual(defaultCableProperties(...pair), { cableType, primaryVlan: 0, vlanIds: [] });
    assert.deepEqual([device, custom], before);
  }
});

test("power strip rear mappings preserve power media and leave endpoint records unchanged", () => {
  const source = fixture("Rack power strip 8 Schuko");
  const target = fixture("Rack power strip 8 Schuko");
  target.id = "peer";
  target.ports.forEach(port => { port.id = `peer-${port.portIndex}`; port.deviceId = target.id; });
  const topology = { devices: [source, target], links: [] };
  const saved = structuredClone(topology);
  const result = planPatchPanelMapping(topology, {
    sourceDeviceId: source.id, sourceStart: 1, sourceEnd: 2, targetDeviceId: target.id, targetStart: 1,
  });
  assert.equal(result.links.length, 2);
  for (const link of result.links) {
    assert.equal(link.cableType, "POWER");
    assert.equal(link.primaryVlan, 0);
    assert.deepEqual(link.vlanIds, []);
  }
  assert.deepEqual(topology, saved);
});
