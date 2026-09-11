import assert from "node:assert/strict";
import { test } from "node:test";
import { hardwareCatalog, instantiateProfile, upgradeInstalledPhysicalPorts } from "./static/js/catalog.js";
import { resolveAristaFaceplate } from "./static/js/faceplate-arista-models.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";

const bounds = { x: 0, y: 0, width: 690, height: 100 };
const cases = [
  { model: "7050SX3-48YC8", front: 56, rear: 2, old: 57, trays: 2, fans: 4 },
  { model: "7060CX2-32S", front: 36, rear: 0, old: 35, trays: 4, fans: 4 },
  { model: "720XP-48ZC2", front: 54, rear: 2, old: 51, trays: 3, fans: 3 },
];

/** Create one catalog device with stable endpoint IDs for physical-layout and migration checks. */
function deviceFor(model) {
  const profile = hardwareCatalog.find((entry) => entry.vendor === "Arista" && entry.model === model);
  const device = instantiateProfile(profile, model, { x: 0, y: 0 });
  for (const port of device.ports) port.id = `port-${port.portIndex}`;
  return device;
}

for (const expected of cases) {
  test(`${expected.model} has complete individual front/rear evidence and the selected fan/AC configuration`, () => {
    const device = deviceFor(expected.model);
    const profile = resolveAristaFaceplate(device);
    assert.equal(profile.fidelity, "model");
    assert.equal(profile.inventoryRevision, 1);
    assert.equal(profile.inventoryComplete, true);
    assert.ok(profile.evidence.models.includes(device.model));
    for (const key of ["front", "rear"]) {
      assert.equal(new URL(profile.evidence[key]).hostname, "www.arista.com");
      assert.equal(new URL(profile.evidence[key]).protocol, "https:");
    }
    const front = buildFaceplateScene(device, bounds, { face: "front" });
    const rear = buildFaceplateScene(device, bounds, { face: "rear" });
    assert.equal(front.profile.id, profile.id);
    assert.equal(front.ports.length, expected.front);
    assert.equal(rear.ports.length, expected.rear);
    assert.equal(front.hiddenPorts.length, expected.rear);
    assert.equal(rear.hiddenPorts.length, expected.front);
    assert.equal(front.unmappedPorts.length + rear.unmappedPorts.length, 0);
    assert.deepEqual([...front.ports, ...rear.ports].map((box) => box.port.id).sort(), device.ports.map((port) => port.id).sort());
    const trays = profile.faces.rear.components.filter((part) => part.role === "fan-tray");
    assert.equal(trays.length, expected.trays);
    assert.equal(trays.reduce((count, tray) => count + tray.fanCount, 0), expected.fans);
    assert.equal(profile.faces.rear.components.filter((part) => part.kind === "psu").length, 2);
    assert.equal(profile.faces[expected.rear ? "rear" : "front"].components.filter((part) => part.kind === "usb").length, 1);
  });

  test(`${expected.model} preserves every reordered revision-zero endpoint without creating missing inventory`, () => {
    const device = deviceFor(expected.model);
    const profile = resolveAristaFaceplate(device);
    const mapping = profile.legacyLayouts[0].portIndexMap;
    device.ports = Object.entries(mapping).map(([old, current]) => {
      const port = structuredClone(device.ports.find((candidate) => candidate.portIndex === current));
      port.id = `old-${old}`;
      port.portIndex = Number(old);
      port.label = profile.legacyLayouts[0].portLabels?.[old] ?? port.label;
      if (expected.model === "720XP-48ZC2" && Number(old) <= 48) {
        port.type = "RJ45_10G";
        port.speedMbps = 5000;
      }
      return port;
    }).reverse();
    delete device.faceplate.inventoryRevision;
    device.ports.find((port) => port.portIndex === expected.old).label = "Custom console";
    const snapshot = structuredClone(device);
    assert.equal(upgradeInstalledPhysicalPorts({ devices: [device] }), false);
    const scenes = ["front", "rear"].map((face) => buildFaceplateScene(device, bounds, { face }));
    const boxes = scenes.flatMap((scene) => scene.ports);
    assert.equal(boxes.length, expected.old);
    assert.equal(scenes.flatMap((scene) => scene.unmappedPorts).length, 0);
    assert.equal(boxes.find((box) => box.port.id === `old-${expected.old}`).displayLabel, "Custom console");
    assert.deepEqual(boxes.map((box) => box.port.id).sort(), device.ports.map((port) => port.id).sort());
    assert.deepEqual(device, snapshot);
    if (expected.model === "720XP-48ZC2") {
      assert.equal(boxes.find((box) => box.port.id === "old-49").displayLabel, "53");
      assert.equal(boxes.find((box) => box.port.id === "old-50").displayLabel, "54");
      const optical = boxes.filter((box) => box.port.type === "QSFP28_100G");
      assert.equal(optical.length, 2);
      assert.ok(optical.every((box) => box.x > bounds.width * .85), "old QSFP endpoints stay in the rightmost cages");
    }
  });
}

test("7050SX3 central QSFP cages separate its left and right SFP28 banks", () => {
  const profile = resolveAristaFaceplate(deviceFor("7050SX3-48YC8"));
  const slots = profile.faces.front.ports;
  const left = slots.filter((slot) => slot.portIndex <= 24);
  const middle = slots.filter((slot) => slot.portIndex > 48);
  const right = slots.filter((slot) => slot.portIndex >= 25 && slot.portIndex <= 48);
  assert.equal(middle.length, 8);
  assert.ok(Math.max(...left.map((slot) => slot.x)) < Math.min(...middle.map((slot) => slot.x)));
  assert.ok(Math.max(...middle.map((slot) => slot.x)) < Math.min(...right.map((slot) => slot.x)));
  assert.equal(left[0].x, left[1].x);
  assert.ok(left[0].y < left[1].y);
});

test("7060CX2 places its two SFP+ cages at the far left and management above console on the right", () => {
  const slots = resolveAristaFaceplate(deviceFor("7060CX2-32S")).faces.front.ports;
  const sfp = slots.filter((slot) => slot.type === "SFP_PLUS_10G");
  assert.equal(sfp.length, 2);
  assert.ok(sfp.every((slot) => slot.x < .06));
  const console = slots.find((slot) => slot.type === "Console");
  const management = slots.find((slot) => slot.portIndex === 36);
  assert.equal(console.x, management.x);
  assert.ok(console.y > management.y && console.x > .9);
});

test("720XP corrects copper speeds and four missing SFP28 uplinks without changing old-index meanings", () => {
  const device = deviceFor("720XP-48ZC2");
  assert.equal(device.ports.filter((port) => port.type === "RJ45_MGIG" && port.speedMbps === 2500).length, 40);
  assert.equal(device.ports.filter((port) => port.type === "RJ45_MGIG" && port.speedMbps === 5000).length, 8);
  assert.equal(device.ports.filter((port) => port.type === "SFP28_25G").length, 4);
  assert.equal(device.ports.filter((port) => port.type === "QSFP28_100G").length, 2);
  const profile = resolveAristaFaceplate(device);
  assert.equal(profile.legacyLayouts[0].portIndexMap[49], 53);
  assert.equal(profile.legacyLayouts[0].portIndexMap[50], 54);
  assert.equal(profile.legacyLayouts[0].portIndexMap[51], 55);
  const slots = profile.faces.front.ports;
  assert.ok(slots.find((slot) => slot.portIndex === 49).x > slots.find((slot) => slot.portIndex === 48).x);
  assert.ok(slots.find((slot) => slot.portIndex === 53).x > slots.find((slot) => slot.portIndex === 52).x);
});

test("Arista exact layouts do not absorb family placeholders, unknown SKUs or another vendor", () => {
  for (const device of [null, {}, { model: "Unlisted Arista chassis", faceplate: { vendor: "Arista" } },
    { model: "7050SX3-48YC8C", faceplate: { vendor: "Arista" } },
    { model: "7050SX3-48YC8", faceplate: { vendor: "Other" } }]) assert.equal(resolveAristaFaceplate(device), null);
});
