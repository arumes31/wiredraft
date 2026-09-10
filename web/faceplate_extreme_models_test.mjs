import assert from "node:assert/strict";
import { test } from "node:test";
import { hardwareCatalog, instantiateProfile, upgradeInstalledPhysicalPorts } from "./static/js/catalog.js";
import { resolveExtremeFaceplate } from "./static/js/faceplate-extreme-models.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";

const bounds = { x: 20, y: 30, width: 690, height: 100 };
const cases = [
  { model: "5320-24P-8XE", front: 34, rear: 0, old: 33, fans: 0, supplies: 0 },
  { model: "5520-48W", front: 55, rear: 2, old: 53, fans: 3, supplies: 1 },
  { model: "VSP 7400-48Y-8C", front: 58, rear: 0, old: 57, fans: 6, supplies: 1 },
];

/** Recreate the actual old catalog separately from the new mapping under test. */
function deviceFor(model, legacy = false) {
  let catalog = hardwareCatalog.find((entry) => entry.vendor === "Extreme" && entry.model === model);
  if (legacy) {
    /** Build one unchanged revision-zero inventory group for migration verification. */
    const group = (zone, count, type, speed, prefix, poe = false) => ({ zone, count, type, speed, prefix, poe });
    const console = group("management", 1, "Console", 0, "CONSOLE");
    const groups = model === "5320-24P-8XE"
      ? [group("access", 24, "RJ45_1G", 1000, "PORT", true), group("uplink", 8, "SFP_PLUS_10G", 10000, "SFP+"), console]
      : model === "5520-48W"
        ? [group("access", 48, "RJ45_10G", 2500, "MGE", true), group("uplink", 4, "SFP28_25G", 25000, "SFP28"), console]
        : [group("uplink", 48, "SFP28_25G", 25000, "SFP28"), group("uplink", 8, "QSFP28_100G", 100000, "QSFP"), console];
    catalog = { ...catalog, groups, inventoryRevision: 0 };
  }
  const device = instantiateProfile(catalog, model, { x: 20, y: 30 });
  for (const port of device.ports) port.id = `port-${port.portIndex}`;
  return device;
}

for (const expected of cases) {
  test(`${expected.model} resolves an individual configuration and every endpoint on one face`, () => {
    const device = deviceFor(expected.model);
    const profile = resolveExtremeFaceplate(device);
    assert.equal(profile.fidelity, "model");
    assert.equal(profile.inventoryRevision, 1);
    assert.equal(device.faceplate.inventoryRevision, 1);
    assert.equal(profile.inventoryComplete, true);
    assert.deepEqual(profile.evidence.models, [expected.model]);
    for (const face of ["front", "rear"]) assert.equal(new URL(profile.evidence[face]).hostname, "documentation.extremenetworks.com");
    const scenes = ["front", "rear"].map((face) => buildFaceplateScene(device, bounds, { face }));
    assert.equal(scenes[0].profile.id, profile.id, "exact drawings take precedence over family fallback");
    assert.equal(scenes[0].ports.length, expected.front);
    assert.equal(scenes[1].ports.length, expected.rear);
    assert.equal(scenes.flatMap((scene) => scene.unmappedPorts).length, 0);
    assert.deepEqual(scenes.flatMap((scene) => scene.ports.map((box) => box.port.id)).sort(), device.ports.map((port) => port.id).sort());
    assert.equal(profile.faces.rear.components.filter((part) => part.role === "fan-tray").length, expected.fans);
    assert.equal(profile.faces.rear.components.filter((part) => part.kind === "psu").length, expected.supplies);
    for (const scene of scenes) for (const item of [...scene.ports, ...scene.components]) {
      const enclosure = item.applicationOverlay ? bounds : scene.chassis;
      assert.ok([item.x, item.y, item.width, item.height].every(Number.isFinite));
      assert.ok(item.width > 0 && item.height > 0);
      assert.ok(item.x >= enclosure.x - 1e-8 && item.y >= enclosure.y - 1e-8);
      assert.ok(item.x + item.width <= enclosure.x + enclosure.width + 1e-8);
      assert.ok(item.y + item.height <= enclosure.y + enclosure.height + 1e-8);
    }
  });

  test(`${expected.model} keeps old IDs and custom settings after array reordering or missing ports`, () => {
    const device = deviceFor(expected.model, true);
    delete device.faceplate.inventoryRevision;
    device.ports.reverse();
    device.ports.find((port) => port.portIndex === 1).label = "Production uplink";
    device.ports.find((port) => port.portIndex === 1).nativeVlan = 37;
    device.ports.find((port) => port.portIndex === 1).allowedVlans = [37, 45];
    device.ports.find((port) => port.portIndex === expected.old).label = "Custom console";
    const snapshot = structuredClone(device);
    assert.equal(upgradeInstalledPhysicalPorts({ devices: [device] }), false);
    const scenes = ["front", "rear"].map((face) => buildFaceplateScene(device, bounds, { face }));
    const boxes = scenes.flatMap((scene) => scene.ports);
    assert.equal(boxes.length, expected.old);
    assert.equal(scenes.flatMap((scene) => scene.unmappedPorts).length, 0);
    assert.equal(boxes.find((box) => box.port.portIndex === 1).displayLabel, "Production uplink");
    assert.equal(boxes.find((box) => box.port.portIndex === expected.old).displayLabel, "Custom console");
    assert.deepEqual(device, snapshot, "rendering cannot rewrite saved types, speeds, labels or VLANs");
    const current = deviceFor(expected.model);
    const currentBoxes = ["front", "rear"].flatMap((face) => buildFaceplateScene(current, bounds, { face }).ports);
    for (const box of boxes) {
      const index = expected.model === "5520-48W" && box.port.portIndex === 53 ? 55 : box.port.portIndex;
      const slot = currentBoxes.find((candidate) => candidate.port.portIndex === index);
      assert.deepEqual([box.centerX, box.centerY], [slot.centerX, slot.centerY]);
    }
    device.ports = device.ports.filter((port) => [1, 3, expected.old].includes(port.portIndex));
    assert.equal(["front", "rear"].flatMap((face) => buildFaceplateScene(device, bounds, { face }).ports).length, 3);
    device.faceplate.inventoryRevision = 8;
    assert.equal(buildFaceplateScene(device, bounds).unmappedPorts.length, 3);
  });
}

test("5320 preserves the large left blank, right copper banks, universal pair and front serial services", () => {
  const profile = resolveExtremeFaceplate(deviceFor("5320-24P-8XE"));
  const ports = profile.faces.front.ports;
  assert.ok(ports.filter((port) => port.portIndex <= 24).every((port) => port.x > .45 && port.x < .85));
  assert.deepEqual(ports.filter((port) => [31, 32].includes(port.portIndex)).map((port) => port.physicalLabel), ["U1", "U2"]);
  assert.equal(ports.find((port) => port.portIndex === 33).type, "Console");
  assert.equal(ports.find((port) => port.portIndex === 34).type, "USB_MICRO_CONSOLE");
  assert.equal(profile.faces.rear.components.filter((part) => part.kind === "power").length, 1);
  assert.ok(profile.faces.rear.components.every((part) => part.kind !== "fan" && part.kind !== "psu"));
});

test("5520 corrects copper speed and uses proven VIM odd-top numbering without native100G universal ports", () => {
  const device = deviceFor("5520-48W");
  assert.ok(device.ports.slice(0, 48).every((port) => port.type === "RJ45_1G" && port.speedMbps === 1000 && port.isPoe));
  const profile = resolveExtremeFaceplate(device);
  const slots = profile.faces.front.ports;
  const vim = [49, 50, 51, 52].map((index) => slots.find((slot) => slot.portIndex === index));
  assert.deepEqual(vim.map((slot) => slot.physicalLabel), ["1", "2", "3", "4"]);
  assert.equal(vim[0].x, vim[1].x);
  assert.equal(vim[2].x, vim[3].x);
  assert.ok(vim[0].y < vim[1].y && vim[2].y < vim[3].y && vim[0].x < vim[2].x);
  assert.deepEqual(device.ports.filter((port) => port.type.startsWith("QSFP")).map((port) => [port.type, port.speedMbps]),
    [["QSFP_PLUS_40G", 40000], ["QSFP_PLUS_40G", 40000]]);
  assert.equal(profile.legacyLayouts[0].portIndexMap[53], 55);
  assert.match(profile.evidence.configuration, /5520-VIM-4YE/);
  assert.ok(profile.limitations.some((note) => note.includes("100G")));
  const old = deviceFor("5520-48W", true);
  const scene = buildFaceplateScene(old, bounds, { face: "front" });
  assert.equal(scene.ports.find((box) => box.port.portIndex === 49).displayLabel, "1");
  assert.equal(scene.ports.find((box) => box.port.portIndex === 1).port.type, "RJ45_10G");
  old.ports.find((port) => port.portIndex === 49).label = "Datacenter fibre";
  assert.equal(buildFaceplateScene(old, bounds).ports.find((box) => box.port.portIndex === 49).displayLabel, "Datacenter fibre");
});

test("VSP keeps its reserved physical cages and front management with opposite-end rear supply bays", () => {
  const profile = resolveExtremeFaceplate(deviceFor("VSP 7400-48Y-8C"));
  assert.equal(profile.faces.front.ports.filter((port) => port.type === "QSFP28_100G").length, 8);
  assert.ok(profile.limitations.some((note) => note.includes("Fabric Connect") && note.includes("55") && note.includes("56")));
  assert.ok(profile.faces.front.ports.find((port) => port.portIndex === 57).y < .3);
  assert.ok(profile.faces.front.ports.find((port) => port.portIndex === 58).y < .3);
  assert.deepEqual(profile.faces.front.ports.filter((slot) => [55, 56].includes(slot.portIndex)).map((slot) => slot.physicalLabel), ["55", "56"]);
  assert.ok(profile.faces.front.components.some((part) => part.label === "Reserved"));
  const psu = profile.faces.rear.components.find((part) => part.kind === "psu");
  assert.ok(psu.x > .8 && psu.variant === "ac-fan-right");
  assert.ok(profile.faces.rear.components.some((part) => part.role === "psu-blank" && part.x < .1));
});

test("source-tight front captions clear every socket, each other and the device boundaries", () => {
  for (const model of ["5520-48W", "VSP 7400-48Y-8C"]) {
    const scene = buildFaceplateScene(deviceFor(model), bounds);
    const labels = scene.ports.map((box) => {
      const label = box.labelPlacement;
      const width = Math.min(label.boxMaxWidth, Math.max(12, label.maxWidth + 6));
      return { x: label.x - width / 2, y: label.y - label.boxHeight / 2, width, height: label.boxHeight, portIndex: box.port.portIndex };
    });
    for (const label of labels) {
      assert.ok(label.y >= bounds.y && label.y + label.height <= bounds.y + bounds.height,
        `${model} caption${label.portIndex} is outside the device`);
      for (const socket of scene.ports) assert.ok(!intersects(label, socket), `${model} caption${label.portIndex} covers socket${socket.port.portIndex}`);
      for (const other of labels) if (label !== other) assert.ok(!intersects(label, other), `${model} captions${label.portIndex}/${other.portIndex} overlap`);
    }
  }
});

/** Compare nonempty intersections so touching edges remain a valid bounded layout. */
function intersects(first, second) {
  return first.x < second.x + second.width && first.x + first.width > second.x &&
    first.y < second.y + second.height && first.y + first.height > second.y;
}

test("Extreme exact resolver rejects neighboring model names and another vendor", () => {
  for (const device of [null, {}, { model: "5320-24P-8XE", faceplate: { vendor: "Other" } },
    { model: "5320-24T-8XE", faceplate: { vendor: "Extreme" } },
    { model: "5520 family", faceplate: { vendor: "Extreme" } }]) assert.equal(resolveExtremeFaceplate(device), null);
});
