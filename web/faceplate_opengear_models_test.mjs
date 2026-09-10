import assert from "node:assert/strict";
import test from "node:test";
import { hardwareCatalog, instantiateProfile, upgradeInstalledPhysicalPorts } from "./static/js/catalog.js";
import { resolveEquipmentFaceplate } from "./static/js/faceplate-equipment-models.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";
import { hardwarePrimitives } from "./static/js/hardware-components.js";

/** Reconstruct the old fifty-port inventory independently of the revised model selection. */
function fixture(legacy = false) {
  let catalog = hardwareCatalog.find((entry) => entry.vendor === "Opengear" && entry.model === "Console Manager family");
  if (legacy) catalog = { ...catalog, inventoryRevision: 0, groups: [
    { zone: "access", count: 48, type: "Console", speed: 0, prefix: "SERIAL" },
    { zone: "management", count: 2, type: "RJ45_1G", speed: 1000, prefix: "MGMT" },
  ] };
  const device = instantiateProfile(catalog, "Console manager", { x: 17, y: 23 });
  for (const port of device.ports) port.id = `opengear-${port.portIndex}`;
  return device;
}

/** Compare positive-area socket, caption and ancillary-part intersections. */
function overlaps(a, b) {
  return a.x < b.x + b.width - 1e-8 && a.x + a.width > b.x + 1e-8 &&
    a.y < b.y + b.height - 1e-8 && a.y + a.height > b.y + 1e-8;
}

test("Opengear family selects CM8148 dual AC with all fifty-one interfaces on the front", () => {
  const device = fixture();
  const profile = resolveEquipmentFaceplate(device);
  assert.equal(profile.fidelity, "model");
  assert.equal(profile.evidence.selectedModel, "CM8148");
  assert.match(profile.evidence.front, /QuickStartGuide-CM8100\.pdf#page=3$/);
  assert.equal(profile.evidence.front, profile.evidence.rear);
  assert.equal(profile.inventoryRevision, 1);
  assert.equal(device.ports.length, 51);
  assert.equal(profile.defaultFace, "front");
  assert.equal(profile.faces.front.ports.length, 51);
  assert.deepEqual(profile.faces.rear.ports, []);
  assert.equal(device.ports.filter((port) => port.type === "Console").length, 49);
  assert.ok(device.ports.filter((port) => port.type === "Console").every((port) => port.speedMbps === 0));
  assert.ok(!device.ports.some((port) => /SFP|USB/.test(port.type)));
});

test("CM8148 preserves three odd-over-even banks and console-over-USB beside NET1-over-NET2", () => {
  const profile = resolveEquipmentFaceplate(fixture());
  const front = new Map(profile.faces.front.ports.map((port) => [port.portIndex, port]));
  for (let index = 1; index < 48; index += 2) {
    assert.equal(front.get(index).x, front.get(index + 1).x);
    assert.ok(front.get(index).y < front.get(index + 1).y);
  }
  assert.ok(front.get(16).x < front.get(17).x && front.get(32).x < front.get(33).x);
  assert.equal(front.get(49).x, front.get(50).x);
  assert.ok(front.get(49).y < front.get(50).y);
  assert.ok(front.get(48).x < front.get(51).x && front.get(51).x < front.get(49).x);
  assert.deepEqual([front.get(49).physicalLabel, front.get(50).physicalLabel], ["NET1", "NET2"]);
  const hosts = profile.faces.front.components.filter((part) => part.kind === "usb");
  assert.equal(hosts.length, 2);
  assert.ok(hosts.every((host) => host.x < front.get(51).x && host.x + host.width > front.get(51).x && host.y > front.get(51).y));
  assert.ok(profile.faces.front.components.some((part) => part.role === "factory-erase"));
  const supplies = profile.faces.rear.components.filter((part) => part.kind === "power");
  assert.equal(supplies.length, 2);
  assert.ok(supplies.every((part) => part.variant === "ac-sideways-left"));
  assert.ok(Object.values(profile.faces).flatMap((face) => face.components).every((part) => part.kind !== "fan"));
  assert.match(profile.limitations.join(" "), /[Pp]assive cooling/);
});

test("CM8148 old saves retain serial and Ethernet identities without inserting the new local console", () => {
  const device = fixture(true);
  delete device.faceplate.inventoryRevision;
  device.rackId = "console-rack"; device.rackPosition = 11;
  device.ports.reverse();
  for (const port of device.ports) {
    port.label = port.portIndex === 49 ? "1" : `Customer ${port.portIndex}`;
    port.speedMbps = 100; port.isPoe = true; port.nativeVlan = 7; port.allowedVlans = [7, 19]; port.group = "Custom";
  }
  device.ports = device.ports.filter((port) => port.portIndex !== 6);
  const topology = { devices: [device], links: [{ id: "cable", sourcePortId: device.ports[0].id }], linkGroups: [{ id: "bundle", linkIds: ["cable"] }] };
  const before = structuredClone(topology);
  assert.equal(upgradeInstalledPhysicalPorts(topology), false);
  const bounds = { x: 0, y: 0, width: 690, height: 100 };
  const scene = buildFaceplateScene(device, bounds, { face: "front" });
  assert.equal(scene.ports.length, 49);
  assert.equal(scene.unmappedPorts.length, 0);
  assert.deepEqual(scene.ports.map((port) => port.displayLabel), device.ports.map((port) => port.label));
  assert.deepEqual(topology, before);
  assert.equal(buildFaceplateScene(device, bounds, { face: "rear" }).ports.length, 0);
  device.faceplate.inventoryRevision = 99;
  assert.equal(buildFaceplateScene(device, bounds).unmappedPorts.length, 49);
});

test("CM8148 captions clear the three banks, service controls and chassis edges at both display widths", () => {
  for (const width of [460, 690]) {
    const scene = buildFaceplateScene(fixture(), { x: 0, y: 0, width, height: 100 }, { face: "front" });
    const captions = [];
    for (const port of scene.ports) {
      const label = port.labelPlacement;
      const captionWidth = Math.min(label.boxMaxWidth, Math.max(12, Math.min(label.maxWidth, port.displayLabel.length * label.fontSize) + 6));
      const caption = { x: label.x - captionWidth / 2, y: label.y - label.boxHeight / 2, width: captionWidth, height: label.boxHeight };
      assert.ok(caption.y >= scene.chassis.y && caption.y + caption.height <= scene.chassis.y + scene.chassis.height);
      for (const other of [...scene.ports, ...captions, ...scene.components.filter((part) => !["text", "panel-accent"].includes(part.kind))]) {
        assert.ok(!overlaps(caption, other), `${width}px ${port.displayLabel} caption overlaps ${other.role || other.displayLabel || "caption"}`);
      }
      captions.push(caption);
    }
  }
});

test("CM8148 current default-label ports preserve their configured speeds and groups on reload", () => {
  const device = fixture();
  device.ports[48].speedMbps = 100; device.ports[48].group = "Management network";
  const before = structuredClone(device);
  assert.equal(upgradeInstalledPhysicalPorts({ devices: [device] }), false);
  assert.deepEqual(device, before);
});

test("CM8148 decorative panels and left-keyed AC sockets produce the observed artwork", () => {
  const scene = buildFaceplateScene(fixture(), { x: 0, y: 0, width: 690, height: 100 }, { face: "rear" });
  const accent = scene.components.find((part) => part.role === "rear-red-panel");
  const accentArt = hardwarePrimitives(accent);
  assert.ok(accentArt.some((part) => part.kind === "polygon" && part.fill === "#cd1237"));
  assert.ok(!accentArt.some((part) => part.fill === "#d7b76c"), "decoration must not fall back to connector contacts");
  for (const component of scene.components.filter((part) => part.kind === "power")) {
    const art = hardwarePrimitives(component);
    const blades = art.filter((part) => part.kind === "rect" && part.fill === "#b9c3c4");
    assert.equal(blades.length, 3);
    const centers = blades.map((part) => ({ x: part.x + part.width / 2, y: part.y + part.height / 2 })).sort((a, b) => a.x - b.x);
    assert.ok(centers[0].x < centers[1].x && centers[0].y > Math.min(centers[1].y, centers[2].y) && centers[0].y < Math.max(centers[1].y, centers[2].y));
  }
});
