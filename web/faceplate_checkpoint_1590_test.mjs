import assert from "node:assert/strict";
import test from "node:test";
import { hardwareCatalog, instantiateProfile, upgradeInstalledPhysicalPorts } from "./static/js/catalog.js";
import { resolveEnterpriseFaceplate } from "./static/js/faceplate-enterprise-models.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";

/** Instantiate the unchanged twelve-port Quantum1500 catalog with durable saved endpoint identities. */
function fixture() {
  const catalog = hardwareCatalog.find((item) => item.vendor === "Check Point" && item.model === "Quantum 1500");
  const device = instantiateProfile(catalog, catalog.model, { x: 17, y: 29 });
  device.ports.forEach((port) => { port.id = `spark1590-${port.portIndex}`; });
  return device;
}

/** Detect occupied areas while permitting adjacent hardware to share an edge. */
function overlaps(a, b) {
  return a.x < b.x + b.width - 1e-9 && a.x + a.width > b.x + 1e-9 &&
    a.y < b.y + b.height - 1e-9 && a.y + a.height > b.y + 1e-9;
}

test("Quantum1500 explicitly selects wired1590 with all twelve original sockets on the rear", () => {
  const device = fixture();
  const profile = resolveEnterpriseFaceplate(device);
  assert.equal(profile.fidelity, "model");
  assert.equal(profile.sku, "Quantum Spark 1590 Wired (V-81)");
  assert.equal(profile.evidence.catalogAlias, "Quantum 1500");
  assert.equal(profile.evidence.selectedModel, "Quantum Spark 1590");
  assert.deepEqual(profile.evidence.models, ["Quantum Spark 1590"]);
  assert.match(profile.evidence.front, /V1_front_new_wired\.jpg$/);
  assert.match(profile.evidence.rear, /V1_Back_Wired_17Jul\.jpg$/);
  assert.equal(profile.defaultFace, "rear");
  assert.equal(profile.inventoryRevision, 0);
  assert.equal(device.faceplate.inventoryRevision, 0);
  assert.equal(device.ports.length, 12);
  assert.deepEqual(device.ports.map((port) => [port.label, port.type, port.speedMbps]), [
    ...Array.from({ length: 8 }, (_, index) => [String(index + 1), "RJ45_1G", 1000]),
    ["WAN", "RJ45_1G", 1000], ["DMZ", "RJ45_1G", 1000], ["DMZ-SFP", "SFP_1G", 1000], ["CONSOLE", "USB_C_CONSOLE", 0],
  ]);
  assert.ok(device.ports.every((port) => !port.isPoe));
  assert.equal(profile.faces.front.ports.length, 0);
  assert.equal(profile.faces.rear.ports.length, 12);
  assert.match(profile.limitations.join(" "), /alternative media/);
  assert.equal(resolveEnterpriseFaceplate(device), profile);
});

test("wired1590 has even LANs above odds, left DMZ fiber and separate WAN, USB and DC power", () => {
  const profile = resolveEnterpriseFaceplate(fixture());
  const slots = new Map(profile.faces.rear.ports.map((slot) => [slot.portIndex, slot]));
  for (const index of [1, 3, 5, 7]) {
    assert.equal(slots.get(index).x, slots.get(index + 1).x);
    assert.ok(slots.get(index + 1).y < slots.get(index).y);
  }
  assert.equal(slots.get(2).physicalLabel, "2/SYNC");
  assert.ok(slots.get(8).x < slots.get(11).x && slots.get(11).x < slots.get(10).x && slots.get(10).x < slots.get(9).x);
  assert.ok(slots.get(9).x < slots.get(12).x);
  assert.equal(profile.faces.rear.components.filter((part) => part.kind === "usb").length, 1);
  assert.equal(profile.faces.rear.components.filter((part) => part.kind === "power" && part.variant === "dc-barrel").length, 1);
  assert.equal(profile.faces.rear.components.filter((part) => part.role === "reset" || part.role === "factory-default").length, 2);
  assert.equal(profile.faces.rear.components.find((part) => part.role === "ground").kind, "screw");
  assert.equal(profile.faces.front.components.find((part) => part.role === "wifi").active, false);
  assert.ok(Object.values(profile.faces).flatMap((face) => face.components).every((part) => !["coax", "fan", "psu", "card-slot"].includes(part.kind)));
});

test("wired1590 preserves labels, gaps and settings without upgrading its already-correct inventory", () => {
  const device = fixture();
  delete device.faceplate.inventoryRevision;
  device.rackId = "branch-office";
  device.rackPosition = 16;
  device.ports[1].label = "Customer sync";
  device.ports[8].label = "Internet uplink";
  device.ports[8].nativeVlan = 203;
  device.ports[8].speedMbps = 100;
  device.ports[8].isPoe = true;
  device.ports[8].allowedVlans = [203, 209];
  device.ports.reverse();
  const before = structuredClone(device);
  assert.equal(upgradeInstalledPhysicalPorts({ devices: [device] }), false);
  const bounds = { x: 20, y: 40, width: 690, height: 100 };
  const scene = buildFaceplateScene(device, bounds, { face: "rear" });
  const canonical = buildFaceplateScene(fixture(), bounds, { face: "rear" });
  assert.equal(scene.ports.length, 12);
  assert.equal(scene.unmappedPorts.length, 0);
  for (const port of scene.ports) {
    const source = canonical.ports.find((box) => box.port.portIndex === port.port.portIndex);
    assert.deepEqual([port.centerX, port.centerY], [source.centerX, source.centerY]);
  }
  assert.equal(scene.ports.find((box) => box.port.portIndex === 2).displayLabel, "Customer sync");
  assert.equal(scene.ports.find((box) => box.port.portIndex === 9).displayLabel, "Internet uplink");
  assert.deepEqual(device, before);
  device.ports = device.ports.filter((port) => [2, 9, 11, 12].includes(port.portIndex));
  assert.deepEqual(buildFaceplateScene(device, bounds, { face: "rear" }).ports.map((box) => box.port.portIndex), [12, 11, 9, 2]);
  assert.equal(buildFaceplateScene(device, bounds, { face: "front" }).hiddenPorts.length, 4);
  device.faceplate.inventoryRevision = 99;
  assert.equal(buildFaceplateScene(device, bounds, { face: "rear" }).unmappedPorts.length, 4);
});

test("wired1590 keeps saved numeric-label settings and never rebuilds a sparse LAN inventory", () => {
  for (const sparse of [false, true]) for (const revision of [undefined, 0]) {
    const device = fixture();
    if (revision === undefined) delete device.faceplate.inventoryRevision;
    device.rackId = "saved-branch";
    device.rackPosition = 12;
    device.ports.reverse();
    for (const port of device.ports) {
      port.speedMbps = 100;
      port.isPoe = true;
      port.group = "User group";
      port.nativeVlan = 37;
      port.allowedVlans = [37, 49];
    }
    if (sparse) device.ports = device.ports.filter((port) => [2, 5, 8].includes(port.portIndex));
    const before = structuredClone(device);
    const topology = { devices: [device] };
    assert.equal(upgradeInstalledPhysicalPorts(topology), false);
    assert.equal(Object.hasOwn(topology, "linkGroups"), false);
    const scene = buildFaceplateScene(device, { x: 0, y: 0, width: 690, height: 100 }, { face: "rear" });
    assert.deepEqual(scene.ports.map((box) => box.port.id), before.ports.map((port) => port.id));
    assert.equal(scene.unmappedPorts.length, 0);
    assert.deepEqual(device, before);
  }
});

test("wired1590 has a native five-to-one chassis and readable captions at compact and normal widths", () => {
  for (const width of [460, 690]) for (const face of ["front", "rear"]) {
    const scene = buildFaceplateScene(fixture(), { x: 10, y: 20, width, height: 100 }, { face });
    if (width === 690) assert.ok(Math.abs(scene.chassis.width / scene.chassis.height - 5) < .01);
    for (const port of scene.ports) {
      const label = port.labelPlacement;
      const captionWidth = Math.min(label.boxMaxWidth, Math.max(12,
        Math.min(label.maxWidth, port.displayLabel.length * label.fontSize) + 6));
      const caption = { x: label.x - captionWidth / 2, y: label.y - label.boxHeight / 2,
        width: captionWidth, height: label.boxHeight };
      assert.ok(caption.y >= scene.chassis.y && caption.y + caption.height <= scene.chassis.y + scene.chassis.height);
      for (const obstacle of [...scene.ports, ...scene.components.filter((part) => part.kind !== "text")]) {
        assert.ok(!overlaps(caption, obstacle), `${port.displayLabel} overlaps ${obstacle.role || obstacle.kind || obstacle.port.id}`);
      }
    }
  }
});
