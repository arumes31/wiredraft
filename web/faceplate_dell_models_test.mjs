import assert from "node:assert/strict";
import { test } from "node:test";
import { hardwareCatalog, instantiateProfile, upgradeInstalledPhysicalPorts } from "./static/js/catalog.js";
import { buildDellModelFaceplate } from "./static/js/faceplate-dell-models.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";

const bounds = { x: 0, y: 0, width: 690, height: 100 };
const cases = [
  { model: "PowerSwitch N3248TE-ON", front: 55, rear: 2, fans: 3 },
  { model: "PowerSwitch S4148F-ON", front: 55, rear: 2, fans: 4 },
  { model: "PowerSwitch S5248F-ON", front: 54, rear: 3, fans: 4 },
];

/** Instantiate current or reconstructed revision-zero inventory with stable IDs for migration checks. */
function deviceFor(model, legacy = false) {
  let catalog = hardwareCatalog.find((entry) => entry.vendor === "Dell" && entry.model === model);
  if (legacy) {
    const type = model.includes("N3248") ? "RJ45_1G" : model.includes("S4148") ? "SFP_PLUS_10G" : "SFP28_25G";
    catalog = { ...catalog, inventoryRevision: 0, groups: [
      { zone: "access", count: 48, type, speed: type === "RJ45_1G" ? 1000 : type === "SFP_PLUS_10G" ? 10000 : 25000,
        poe: false, prefix: type === "RJ45_1G" ? "" : type === "SFP_PLUS_10G" ? "SFP+" : "SFP28" },
      { zone: "uplink", count: 6, type: "QSFP28_100G", speed: 100000, poe: false, prefix: "QSFP" },
      { zone: "management", count: 1, type: "Console", speed: 0, poe: false, prefix: "CONSOLE" },
    ] };
  }
  const device = instantiateProfile(catalog, model, { x: 0, y: 0 });
  for (const port of device.ports) port.id = `port-${port.portIndex}`;
  return device;
}

for (const expected of cases) {
  test(`${expected.model} has complete individual panels and its verified fan/power configuration`, () => {
    const device = deviceFor(expected.model);
    const profile = buildDellModelFaceplate(device);
    assert.equal(profile.fidelity, "model");
    assert.equal(profile.inventoryRevision, 1);
    assert.deepEqual(profile.evidence.models, [expected.model]);
    assert.equal(new URL(profile.source).hostname, "dl.dell.com");
    assert.equal(new URL(profile.source).protocol, "https:");
    assert.ok(profile.evidence.front.includes("#page="));
    assert.ok(profile.evidence.rear.includes("#page="));
    assert.equal(device.ports.length, 57);
    const front = buildFaceplateScene(device, bounds, { face: "front" });
    const rear = buildFaceplateScene(device, bounds, { face: "rear" });
    assert.equal(front.ports.length, expected.front);
    assert.equal(rear.ports.length, expected.rear);
    assert.equal(front.hiddenPorts.length, expected.rear);
    assert.equal(rear.hiddenPorts.length, expected.front);
    assert.equal(front.unmappedPorts.length + rear.unmappedPorts.length, 0);
    assert.equal(new Set([...front.ports, ...rear.ports].map((box) => box.port.id)).size, 57);
    assert.equal(profile.faces.rear.components.filter((component) => component.kind === "fan").length, expected.fans);
    assert.equal(profile.faces.rear.components.filter((component) => component.kind === "psu").length, 2);
  });

  test(`${expected.model} preserves reversed revision-zero endpoint identities and custom configuration`, () => {
    const device = deviceFor(expected.model, true);
    device.ports.reverse();
    device.ports.find((port) => port.portIndex === 55).label = "Custom serial name";
    const renamed = device.ports.find((port) => port.portIndex === 51);
    renamed.label = "Saved optical link";
    renamed.nativeVlan = 72;
    renamed.allowedVlans = [72, 81];
    const snapshot = structuredClone(device);
    assert.equal(upgradeInstalledPhysicalPorts({ devices: [device] }), false);
    const scenes = ["front", "rear"].map((face) => buildFaceplateScene(device, bounds, { face }));
    const ports = scenes.flatMap((scene) => scene.ports);
    assert.equal(ports.length, 55);
    assert.equal(scenes[0].unmappedPorts.length, 0);
    assert.equal(ports.find((box) => box.port.id === "port-55").displayLabel, "Custom serial name");
    assert.equal(ports.find((box) => box.port.id === "port-51").displayLabel, "Saved optical link");
    assert.equal(ports.find((box) => box.port.id === "port-51").port.type, "QSFP28_100G");
    assert.deepEqual(device, snapshot);
    device.ports.push({ ...device.ports[0], id: "obsolete", portIndex: 90 });
    assert.deepEqual(buildFaceplateScene(device, bounds).unmappedPorts.map((port) => port.id), ["obsolete"]);
    device.faceplate.inventoryRevision = 99;
    assert.equal(buildFaceplateScene(device, bounds).ports.length, 0);
    assert.equal(buildFaceplateScene(device, bounds).unmappedPorts.length, 56);
  });
}

test("N3248TE has four front 10G SFP cages, two rear 100G cages and three front service ports", () => {
  const device = deviceFor(cases[0].model);
  const profile = buildDellModelFaceplate(device);
  assert.equal(profile.faces.front.ports.filter((port) => port.type === "SFP_PLUS_10G").length, 4);
  assert.ok(device.ports.filter((port) => port.type === "SFP_PLUS_10G").every((port) => port.speedMbps === 10000));
  assert.ok(profile.faces.rear.ports.every((port) => port.type === "QSFP28_100G"));
  const console = profile.faces.front.ports.find((port) => port.portIndex === 55);
  const management = profile.faces.front.ports.find((port) => port.portIndex === 56);
  assert.ok(console.x < management.x);
  assert.equal(console.y, management.y);
  const legacy = buildFaceplateScene(deviceFor(cases[0].model, true), bounds);
  assert.equal(legacy.ports.find((box) => box.port.id === "port-49").connectorKind, "sfp");
});

test("S4148F puts its mixed 40G/100G bank between both SFP banks and maps old indices explicitly", () => {
  const profile = buildDellModelFaceplate(deviceFor(cases[1].model));
  const slots = new Map(profile.faces.front.ports.map((port) => [port.portIndex, port]));
  assert.ok(slots.get(24).x < slots.get(25).x);
  assert.ok(slots.get(30).x < slots.get(31).x);
  assert.deepEqual([25, 26, 27, 28, 29, 30].map((index) => slots.get(index).type),
    ["QSFP28_100G", "QSFP28_100G", "QSFP_PLUS_40G", "QSFP_PLUS_40G", "QSFP28_100G", "QSFP28_100G"]);
  const legacy = buildFaceplateScene(deviceFor(cases[1].model, true), bounds);
  assert.equal(legacy.ports.find((box) => box.port.id === "port-25").displayLabel, "31");
  assert.equal(legacy.ports.find((box) => box.port.id === "port-49").displayLabel, "25");
  assert.equal(legacy.ports.find((box) => box.port.id === "port-51").displayLabel, "27");
  assert.equal(profile.legacyLayouts[0].portIndexMap[25], 31);
  assert.equal(profile.legacyLayouts[0].portIndexMap[49], 25);
});

test("S5248F exposes two physical 200G DD cages with paired logical labels, not four fake sockets", () => {
  const device = deviceFor(cases[2].model);
  const profile = buildDellModelFaceplate(device);
  const dd = profile.faces.front.ports.filter((port) => port.type === "QSFP_DD_200G");
  assert.equal(dd.length, 2);
  assert.deepEqual(dd.map((slot) => slot.physicalLabel), ["49/50", "51/52"]);
  assert.ok(device.ports.filter((port) => port.type === "QSFP_DD_200G").every((port) => port.speedMbps === 200000));
  assert.deepEqual(profile.faces.front.ports.filter((port) => port.type === "QSFP28_100G").map((slot) => slot.physicalLabel), ["53", "54", "55", "56"]);
  assert.ok(profile.faces.rear.components.filter((component) => component.kind === "psu").every((component) => component.variant === "ac-fan-right"));
});

test("S4148F gapped saved inventory maps by revision/index while new custom numeric names remain unchanged", () => {
  const oldDevice = deviceFor(cases[1].model, true);
  oldDevice.ports = oldDevice.ports.filter((port) => [1, 25, 49, 51, 55].includes(port.portIndex)).reverse();
  const snapshot = structuredClone(oldDevice);
  const front = buildFaceplateScene(oldDevice, bounds, { face: "front" });
  assert.deepEqual(front.ports.map((box) => [box.port.id, box.displayLabel]),
    [["port-51", "27"], ["port-49", "25"], ["port-25", "31"], ["port-1", "1"]]);
  assert.deepEqual(front.hiddenPorts.map((box) => box.port.id), ["port-55"]);
  assert.deepEqual(oldDevice, snapshot);
  const newDevice = deviceFor(cases[1].model);
  newDevice.ports.find((port) => port.portIndex === 31).label = "25";
  assert.equal(buildFaceplateScene(newDevice, bounds).ports.find((box) => box.port.portIndex === 31).displayLabel, "25");
});

test("Dell service placement distinguishes upper console on S4148F from upper management on S5248F", () => {
  const s41 = buildDellModelFaceplate(deviceFor(cases[1].model));
  const s52 = buildDellModelFaceplate(deviceFor(cases[2].model));
  const slot = (profile, index) => profile.faces.rear.ports.find((port) => port.portIndex === index);
  assert.ok(slot(s41, 55).y < slot(s41, 56).y);
  assert.ok(slot(s52, 56).y < slot(s52, 55).y);
  assert.ok(slot(s52, 55).y < slot(s52, 57).y);
  assert.equal(slot(s52, 55).x, slot(s52, 57).x);
  assert.ok(s41.faces.front.ports.some((port) => port.type === "USB_MICRO_CONSOLE"));
  assert.ok(s52.faces.rear.ports.some((port) => port.type === "USB_MICRO_CONSOLE"));
});

test("Dell exact resolution rejects other models and vendors", () => {
  assert.equal(buildDellModelFaceplate({ model: "PowerSwitch S4100 family", faceplate: { vendor: "Dell" } }), null);
  assert.equal(buildDellModelFaceplate({ model: cases[0].model, faceplate: { vendor: "Other" } }), null);
});

test("S4148F's console caption stays below its storage socket without moving any physical hardware", () => {
  const device = deviceFor("PowerSwitch S4148F-ON");
  const before = structuredClone(device);
  for (const rectangle of [bounds, { x: 80, y: 50, width: 1380, height: 200 }]) {
    const scene = buildFaceplateScene(device, rectangle, { face: "front" });
    const console = scene.ports.find((port) => port.port.portIndex === 57);
    const storage = scene.components.find((component) => component.kind === "usb");
    const display = scene.components.find((component) => component.kind === "lcd");
    assert.ok(console.y > display.y + display.height && console.y + console.height < storage.y);
    assert.ok(console.labelPlacement.y - 5.5 > storage.y + storage.height,
      "the caption plate clears the storage connector and the display");
    assert.ok(console.labelPlacement.y + 5.5 <= scene.chassis.y + scene.chassis.height);
    assert.equal(console.labelPlacement.x, console.centerX);
  }
  assert.deepEqual(device, before);
});
