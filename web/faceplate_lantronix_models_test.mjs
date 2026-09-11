import assert from "node:assert/strict";
import test from "node:test";
import { hardwareCatalog, instantiateProfile, upgradeInstalledPhysicalPorts } from "./static/js/catalog.js";
import { resolveEquipmentFaceplate } from "./static/js/faceplate-equipment-models.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";
import { hardwarePrimitives } from "./static/js/hardware-components.js";

/** Instantiate the exact selection or the former fifty-port inventory with durable endpoint IDs. */
function fixture(legacy = false) {
  let catalog = hardwareCatalog.find((item) => item.vendor === "Lantronix" && item.model === "SLC Console Manager family");
  if (legacy) catalog = { ...catalog, inventoryRevision: 0, groups: [
    { zone: "access", count: 48, type: "Console", speed: 0, prefix: "SERIAL" },
    { zone: "management", count: 2, type: "RJ45_1G", speed: 1000, prefix: "MGMT" },
  ] };
  const device = instantiateProfile(catalog, "Console server", { x: 13, y: 27 });
  for (const port of device.ports) port.id = `slc-${port.portIndex}`;
  return device;
}

/** Check positive-area overlap of rendered socket or caption rectangles. */
function overlaps(a, b) {
  return a.x < b.x + b.width - 1e-8 && a.x + a.width > b.x + 1e-8 &&
    a.y < b.y + b.height - 1e-8 && a.y + a.height > b.y + 1e-8;
}

test("SLC family selects the photographed SLC80481201S with fifty rear endpoints and one local front console", () => {
  const device = fixture();
  const profile = resolveEquipmentFaceplate(device);
  assert.equal(profile.fidelity, "model");
  assert.equal(profile.sku, "SLC 8000 · SLC80481201S · 48 serial / single AC");
  assert.equal(profile.evidence.selectedModel, "SLC80481201S");
  assert.match(profile.evidence.front, /SLC8000_PB-CoBranded\.pdf#page=2$/);
  assert.equal(profile.evidence.front, profile.evidence.rear);
  assert.equal(profile.inventoryRevision, 1);
  assert.equal(device.ports.length, 51);
  assert.equal(profile.defaultFace, "rear");
  assert.deepEqual(profile.faces.front.ports.map((port) => port.portIndex), [51]);
  assert.equal(profile.faces.rear.ports.length, 50);
  assert.ok(device.ports.filter((port) => port.type === "Console").every((port) => port.speedMbps === 0));
  assert.ok(!device.ports.some((port) => port.type.includes("SFP") || port.type.startsWith("USB")));
  assert.match(profile.limitations.join(" "), /copper.*fiber/);
});

test("SLC80481201S preserves three serial module banks, copper numbering and the observed controls", () => {
  const profile = resolveEquipmentFaceplate(fixture());
  const rear = new Map(profile.faces.rear.ports.map((port) => [port.portIndex, port]));
  for (let index = 1; index < 48; index += 2) {
    assert.equal(rear.get(index).x, rear.get(index + 1).x);
    assert.ok(rear.get(index).y < rear.get(index + 1).y);
  }
  assert.ok(rear.get(16).x < rear.get(17).x && rear.get(32).x < rear.get(33).x);
  assert.ok(rear.get(49).x < rear.get(1).x && rear.get(49).y < rear.get(50).y);
  assert.deepEqual([rear.get(49).physicalLabel, rear.get(50).physicalLabel], ["ETH1", "ETH2"]);
  assert.equal(profile.faces.front.components.filter((part) => part.kind === "usb").length, 2);
  assert.ok(profile.faces.front.components.some((part) => part.kind === "lcd" && part.variant === "blank"));
  assert.ok(profile.faces.front.components.some((part) => part.kind === "button" && part.variant === "five-way"));
  assert.ok(profile.faces.front.components.some((part) => part.role === "modem-blank"));
  assert.equal(profile.faces.rear.components.filter((part) => part.kind === "power").length, 1);
  assert.ok(profile.faces.rear.components.some((part) => part.kind === "button" && part.variant === "rocker"));
  assert.ok(Object.values(profile.faces).flatMap((face) => face.components).every((part) => part.kind !== "fan"));
});

test("SLC old fifty-port saves retain names, settings, gaps and connections while the front console stays absent", () => {
  const device = fixture(true);
  delete device.faceplate.inventoryRevision;
  device.rackId = "serial-rack"; device.rackPosition = 17;
  device.ports.reverse();
  for (const port of device.ports) {
    port.label = port.portIndex === 49 ? "1" : `Custom ${port.portIndex}`;
    port.speedMbps = 100; port.isPoe = true; port.nativeVlan = 18; port.allowedVlans = [18, 22];
  }
  device.ports = device.ports.filter((port) => port.portIndex !== 3);
  const topology = { devices: [device], links: [{ id: "saved-link", sourcePortId: device.ports[0].id }] };
  const before = structuredClone(topology);
  assert.equal(upgradeInstalledPhysicalPorts(topology), false);
  const bounds = { x: 0, y: 0, width: 690, height: 100 };
  const rear = buildFaceplateScene(device, bounds, { face: "rear" });
  assert.equal(rear.ports.length, 49);
  assert.equal(rear.unmappedPorts.length, 0);
  assert.deepEqual(rear.ports.map((box) => box.displayLabel), device.ports.map((port) => port.label));
  const front = buildFaceplateScene(device, bounds, { face: "front" });
  assert.equal(front.ports.length, 0);
  assert.equal(front.hiddenPorts.length, 49);
  assert.deepEqual(topology, before);
  device.faceplate.inventoryRevision = 99;
  assert.equal(buildFaceplateScene(device, bounds).unmappedPorts.length, 49);
});

test("SLC captions stay within the chassis and clear sockets and controls at both display sizes", () => {
  for (const width of [460, 690]) for (const face of ["front", "rear"]) {
    const scene = buildFaceplateScene(fixture(), { x: 0, y: 0, width, height: 100 }, { face });
    const captions = [];
    for (const port of scene.ports) {
      const label = port.labelPlacement;
      const captionWidth = Math.min(label.boxMaxWidth, Math.max(12, Math.min(label.maxWidth, port.displayLabel.length * label.fontSize) + 6));
      const caption = { x: label.x - captionWidth / 2, y: label.y - label.boxHeight / 2, width: captionWidth, height: label.boxHeight };
      assert.ok(caption.y >= scene.chassis.y && caption.y + caption.height <= scene.chassis.y + scene.chassis.height);
      for (const other of [...scene.ports, ...captions, ...scene.components.filter((part) => part.kind !== "text")]) assert.ok(!overlaps(caption, other), `${face} ${port.displayLabel} overlaps another socket, caption or control`);
      captions.push(caption);
    }
  }
});

test("SLC current-revision reloads preserve configured default-label network ports", () => {
  const device = fixture();
  device.ports[48].speedMbps = 100;
  device.ports[48].group = "Management network";
  const before = structuredClone(device);
  assert.equal(upgradeInstalledPhysicalPorts({ devices: [device] }), false);
  assert.deepEqual(device, before);
});

test("SLC memory aperture and absent modem cover render without invented socket contacts or screws", () => {
  const scene = buildFaceplateScene(fixture(), { x: 0, y: 0, width: 690, height: 100 }, { face: "front" });
  for (const role of ["memory-card", "modem-blank"]) {
    const component = scene.components.find((part) => part.role === role);
    assert.ok(component, role);
    const art = hardwarePrimitives(component);
    assert.ok(art.some((part) => part.fill === "#07151a"), `${role} must have a visible dark aperture or cover`);
    assert.ok(!art.some((part) => part.kind === "circle" || ["#b9c3c4", "#d7b76c"].includes(part.fill)), `${role} has no screw heads or electrical contacts`);
  }
});
