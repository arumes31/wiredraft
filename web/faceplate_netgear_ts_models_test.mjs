import assert from "node:assert/strict";
import test from "node:test";
import { hardwareCatalog, instantiateProfile, upgradeInstalledPhysicalPorts } from "./static/js/catalog.js";
import { resolveNetgearFaceplate } from "./static/js/faceplate-netgear-models.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";

const models = [{ model: "GS728T", sku: "GS728TS", copper: 24, pages: [12, 13] },
  { model: "GS752T", sku: "GS752TS", copper: 48, pages: [15, 15] }];

/** Reconstruct the original non-PoE copper/four-SFP inventory independently of the new combo entries. */
function fixture(definition, legacy = false) {
  let entry = hardwareCatalog.find((row) => row.vendor === "NETGEAR" && row.model === definition.model);
  if (legacy) entry = { ...entry, inventoryRevision: 0, groups: [
    { zone: "access", count: definition.copper, type: "RJ45_1G", speed: 1000, prefix: "", poe: false,
      labels: Array.from({ length: definition.copper }, (_, i) => String(i + 1)) },
    { zone: "uplink", count: 4, type: "SFP_1G", speed: 1000, prefix: "SFP", poe: false,
      labels: Array.from({ length: 4 }, (_, i) => String(definition.copper + i + 1)) },
  ] };
  const device = instantiateProfile(entry, definition.model, { x: 17, y: 23 });
  device.id = `saved-${definition.model}`;
  for (const port of device.ports) { port.id = `${device.id}-${port.portIndex}`; port.deviceId = device.id; }
  return device;
}

/** Detect positive-area collisions between sockets, captions and source components. */
function overlaps(a, b) {
  return a.x < b.x + b.width - 1e-8 && a.x + a.width > b.x + 1e-8 &&
    a.y < b.y + b.height - 1e-8 && a.y + a.height > b.y + 1e-8;
}

for (const definition of models) {
  test(`${definition.model} selects the documented non-PoE ${definition.sku} with all six SFP openings`, () => {
    const device = fixture(definition); const profile = resolveNetgearFaceplate(device);
    assert.equal(profile?.sku, definition.sku);
    assert.equal(profile.fidelity, "model"); assert.equal(profile.inventoryComplete, true);
    assert.equal(profile.inventoryRevision, 1); assert.equal(profile.rearHardwareVerified, true);
    assert.equal(profile.evidence.catalogAlias, definition.model);
    assert.ok(profile.evidence.front.endsWith(`#page=${definition.pages[0]}`));
    assert.ok(profile.evidence.rear.endsWith(`#page=${definition.pages[1]}`));
    assert.equal(device.ports.length, definition.copper + 6);
    assert.equal(device.ports.filter((port) => port.type === "SFP_1G").length, 6);
    assert.ok(device.ports.every((port) => !port.isPoe && port.speedMbps === 1000));
    assert.equal(profile.faces.front.ports.length, device.ports.length);
    assert.deepEqual(profile.faces.rear.ports, []);
    assert.match(profile.limitations.join(" "), /alternative media/);
    assert.match(profile.limitations.join(" "), /2\.5/);
  });

  test(`${definition.sku} preserves the different copper-bank placement and combo-to-stack optical order`, () => {
    const profile = resolveNetgearFaceplate(fixture(definition));
    const slots = new Map(profile.faces.front.ports.map((slot) => [slot.portIndex, slot]));
    for (let index = 1; index <= definition.copper; index += 2) {
      assert.equal(slots.get(index).x, slots.get(index + 1).x);
      assert.ok(slots.get(index).y < slots.get(index + 1).y);
      assert.equal(slots.get(index).connectorKind, "rj45-inverted");
      assert.equal(slots.get(index + 1).connectorKind, "rj45");
    }
    assert.ok(slots.get(13).x - slots.get(11).x > slots.get(3).x - slots.get(1).x);
    assert.ok(definition.copper === 24 ? slots.get(1).x > .4 : slots.get(1).x < .15);
    const combo = slots.get(definition.copper + 5), dedicated = slots.get(definition.copper + 1);
    assert.equal(combo.physicalLabel, String(definition.copper - 1));
    assert.ok(combo.x < dedicated.x && dedicated.x < slots.get(definition.copper + 3).x);
    assert.equal(combo.x, slots.get(definition.copper + 6).x);
    const rear = profile.faces.rear.components;
    assert.equal(rear.filter((part) => part.kind === "power" && part.variant === "ac-c14").length, 1);
    assert.ok(rear.every((part) => !["fan", "psu", "usb"].includes(part.kind)));
    assert.ok(rear.some((part) => part.role === "security-lock"));
  });

  test(`${definition.sku} leaves saved endpoints and cables intact for default and misleading custom captions`, () => {
    for (const legacy of [true, false]) for (const renamed of [false, true]) {
      const device = fixture(definition, legacy);
      if (legacy) delete device.faceplate.inventoryRevision;
      device.rackId = "retained-rack"; device.rackPosition = 7;
      device.ports.reverse();
      for (const port of device.ports) {
        if (renamed) port.label = port.portIndex === 1 ? String(definition.copper + 1) : `Saved ${port.portIndex}`;
        port.speedMbps = 100; port.isPoe = true; port.nativeVlan = 73; port.allowedVlans = [73, 91]; port.group = "Saved";
      }
      const topology = { devices: [device], links: [{ id: "cable", sourceDeviceId: device.id,
        sourcePortId: device.ports[0].id, targetDeviceId: "peer", targetPortId: "peer-1" }] };
      const before = structuredClone(topology);
      assert.equal(upgradeInstalledPhysicalPorts(topology), false);
      const bounds = { x: 0, y: 0, width: 690, height: 100 };
      const current = buildFaceplateScene(fixture(definition), bounds, { face: "front" });
      const scene = buildFaceplateScene(device, bounds, { face: "front" });
      assert.equal(scene.ports.length, device.ports.length); assert.equal(scene.unmappedPorts.length, 0);
      for (const slot of scene.ports) {
        const canonical = current.ports.find((box) => box.port.portIndex === slot.port.portIndex);
        assert.deepEqual([slot.centerX, slot.centerY], [canonical.centerX, canonical.centerY]);
        assert.equal(slot.port.id, `${device.id}-${slot.port.portIndex}`);
      }
      assert.deepEqual(topology, before);
      device.ports = device.ports.filter((port) => [1, definition.copper + 2].includes(port.portIndex));
      assert.equal(buildFaceplateScene(device, bounds, { face: "front" }).ports.length, 2);
      device.faceplate.inventoryRevision = 99;
      const unknown = buildFaceplateScene(device, bounds, { face: "front" });
      assert.equal(unknown.ports.length, 0); assert.equal(unknown.unmappedPorts.length, 2);
    }
  });

  test(`${definition.sku} captions remain inside the body and clear source hardware at both display widths`, () => {
    for (const width of [460, 690]) {
      const scene = buildFaceplateScene(fixture(definition), { x: 0, y: 0, width, height: 100 }, { face: "front" });
      const captions = [];
      for (const port of scene.ports) {
        const label = port.labelPlacement;
        const captionWidth = Math.min(label.boxMaxWidth, Math.max(12, Math.min(label.maxWidth, port.displayLabel.length * label.fontSize) + 6));
        const caption = { x: label.x - captionWidth / 2, y: label.y - label.boxHeight / 2, width: captionWidth, height: label.boxHeight };
        assert.ok(caption.x >= scene.chassis.x && caption.x + caption.width <= scene.chassis.x + scene.chassis.width);
        assert.ok(caption.y >= scene.chassis.y && caption.y + caption.height <= scene.chassis.y + scene.chassis.height);
        for (const box of [...captions, ...scene.ports, ...scene.components.filter((part) => !part.applicationOverlay && part.kind !== "panel-accent")]) {
          assert.ok(!overlaps(caption, box), `${definition.sku}: ${port.displayLabel} overlaps ${box.role || box.kind || "another caption"}`);
        }
        captions.push(caption);
      }
    }
  });
}
