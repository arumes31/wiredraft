import assert from "node:assert/strict";
import test from "node:test";
import { hardwareCatalog, instantiateProfile, upgradeInstalledPhysicalPorts } from "./static/js/catalog.js";
import { resolveNetgearFaceplate } from "./static/js/faceplate-netgear-models.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";

const models = [
  { model: "M4250 family", sku: "GSM4248PX", count: 51, front: 0, rear: 51, mapped: 45, unsupported: [41, 42, 43, 44, 45, 46, 47, 48] },
  { model: "M4300 family", sku: "GSM4352PA", count: 55, front: 54, rear: 1, mapped: 51, unsupported: [51, 52] },
  { model: "M4350 family", sku: "GSM4352", count: 54, front: 53, rear: 1, mapped: 53, unsupported: [] },
  { model: "M4500 family", sku: "XSM4556", count: 58, front: 58, rear: 0, mapped: 5, unsupported: Array.from({ length: 48 }, (_, i) => i + 1) },
];

/** Reconstruct the original family inventory independently of corrected physical catalog groups. */
function fixture(model, legacy = false) {
  let entry = hardwareCatalog.find((row) => row.vendor === "NETGEAR" && row.model === model);
  if (legacy) entry = { ...entry, inventoryRevision: 0, groups: [
    { zone: "access", count: 48, type: "RJ45_1G", speed: 1000, poe: true, prefix: "" },
    { zone: "uplink", count: 4, type: "SFP_PLUS_10G", speed: 10000, poe: false, prefix: "SFP+" },
    { zone: "management", count: 1, type: "RJ45_1G", speed: 1000, poe: false, prefix: "MGMT" },
  ] };
  const device = instantiateProfile(entry, model, { x: 19, y: 27 });
  device.id = `saved-${model}`;
  for (const port of device.ports) { port.id = `${device.id}-${port.portIndex}`; port.deviceId = device.id; }
  return device;
}

/** Build both faces so each inventory endpoint must have exactly one physical aperture or an explicit unmapped result. */
function scenes(device, width = 690) {
  return ["front", "rear"].map((face) => buildFaceplateScene(device, { x: 0, y: 0, width, height: 100 }, { face }));
}

/** Detect positive-area intersections between panel controls, socket apertures and reserved caption boxes. */
function overlaps(a, b) {
  return a.x < b.x + b.width - 1e-8 && a.x + a.width > b.x + 1e-8 &&
    a.y < b.y + b.height - 1e-8 && a.y + a.height > b.y + 1e-8;
}

for (const definition of models) {
  test(`${definition.model} selects ${definition.sku} with source-complete distinct front/rear geometry`, () => {
    const device = fixture(definition.model), profile = resolveNetgearFaceplate(device);
    assert.equal(profile?.sku, definition.sku);
    assert.equal(profile.fidelity, "model"); assert.equal(profile.inventoryRevision, 1);
    assert.equal(profile.inventoryComplete, true); assert.equal(profile.rearHardwareVerified, true);
    assert.equal(profile.evidence.catalogAlias, definition.model);
    const source = new URL(profile.evidence.front);
    assert.equal(source.origin, "https://www.downloads.netgear.com");
    assert.match(source.hash, /^#page=\d+$/);
    assert.equal(device.ports.length, definition.count);
    const [front, rear] = scenes(device);
    assert.equal(front.ports.length, definition.front); assert.equal(rear.ports.length, definition.rear);
    assert.equal(front.unmappedPorts.length, 0); assert.equal(rear.unmappedPorts.length, 0);
  });

  test(`${definition.model} preserves historical identities, unsupported ports, settings and sparse/reordered inventories`, () => {
    for (const legacy of [true, false]) for (const renamed of [true, false]) {
      const device = fixture(definition.model, legacy);
      if (legacy) delete device.faceplate.inventoryRevision;
      device.rackId = "saved-rack"; device.rackPosition = 14;
      device.ports.reverse();
      for (const port of device.ports) {
        if (renamed) port.label = port.portIndex === 1 ? "52" : `Edited ${port.portIndex}`;
        port.speedMbps = 100; port.isPoe = false; port.nativeVlan = 81; port.allowedVlans = [81, 99]; port.group = "Custom";
      }
      const topology = { devices: [device], links: [{ id: "existing-cable", sourceDeviceId: device.id,
        sourcePortId: device.ports[0].id, targetDeviceId: "peer", targetPortId: "peer-port" }] };
      const before = structuredClone(topology);
      assert.equal(upgradeInstalledPhysicalPorts(topology), false);
      const rendered = scenes(device).flatMap((scene) => scene.ports);
      assert.equal(rendered.length, legacy ? definition.mapped : definition.count);
      const missing = device.ports.filter((port) => !rendered.some((slot) => slot.port.id === port.id)).map((port) => port.portIndex).sort((a, b) => a - b);
      assert.deepEqual(missing, legacy ? definition.unsupported : []);
      const current = scenes(fixture(definition.model)).flatMap((scene) => scene.ports);
      for (const slot of rendered) {
        let index = slot.port.portIndex;
        if (legacy && definition.model === "M4250 family" && index >= 49) index = index === 53 ? 49 : index - 8;
        if (legacy && definition.model === "M4300 family" && index >= 49 && index <= 50) index += 2;
        if (legacy && definition.model === "M4500 family") index = index === 53 ? 57 : index - 48;
        const canonical = current.find((candidate) => candidate.port.portIndex === index);
        assert.deepEqual([slot.centerX, slot.centerY, slot.connectorKind], [canonical.centerX, canonical.centerY, canonical.connectorKind]);
        assert.equal(slot.displayLabel, renamed ? slot.port.label : canonical.displayLabel);
      }
      assert.deepEqual(topology, before);
      device.ports = device.ports.filter((port) => [1, 49, 53].includes(port.portIndex));
      const sparseBefore = structuredClone(device);
      for (const slot of scenes(device).flatMap((scene) => scene.ports)) assert.ok(device.ports.includes(slot.port));
      assert.deepEqual(device, sparseBefore);
      device.faceplate.inventoryRevision = 99;
      for (const scene of scenes(device)) { assert.equal(scene.ports.length, 0); assert.equal(scene.unmappedPorts.length, device.ports.length); }
      device.faceplate.inventoryRevision = legacy ? 0 : 1;
      device.ports[0].type = "USB_MICRO_CONSOLE";
      const editedBefore = structuredClone(device);
      scenes(device); assert.deepEqual(device, editedBefore);
    }
  });

  test(`${definition.sku} aperture and caption geometry is collision-free at 460 and 690 pixels`, () => {
    for (const width of [460, 690]) for (const scene of scenes(fixture(definition.model), width)) {
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
    }
  });
}

test("manufacturer rear figures retain the exact fan counts, power configurations and control positions", () => {
  const get = (model) => resolveNetgearFaceplate(fixture(`${model} family`));
  assert.equal(get("M4250").faces.rear.components.filter((part) => part.kind === "fan").length, 0);
  for (const model of ["M4300", "M4350"]) assert.equal(get(model).faces.rear.components.filter((part) => part.variant === "netgear-fixed-swept").length, 4);
  const m4350 = get("M4350").faces.rear.components;
  assert.equal(m4350.filter((part) => part.kind === "psu").length, 0);
  assert.equal(m4350.filter((part) => part.role?.startsWith("empty-aps")).length, 2);
  assert.equal(m4350.filter((part) => part.kind === "usb").length, 2);
  const m4500 = get("M4500").faces.rear.components;
  assert.equal(m4500.filter((part) => part.variant === "netgear-m4500-tray").length, 6);
  assert.deepEqual(m4500.filter((part) => part.kind === "psu").map((part) => part.role), ["PSU2", "PSU1"]);
  assert.match(get("M4500").limitations.join(" "), /four.*six|six.*four/);
});
