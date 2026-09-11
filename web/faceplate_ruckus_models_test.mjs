import assert from "node:assert/strict";
import test from "node:test";
import { hardwareCatalog, instantiateProfile, upgradeInstalledPhysicalPorts } from "./static/js/catalog.js";
import { buildRuckusModelFaceplate } from "./static/js/faceplate-ruckus-models.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";

const bounds = { x: 0, y: 0, width: 690, height: 100 };

/** Give a Ruckus catalog device stable endpoint identities for both physical faces. */
function deviceFor7550(legacy = false) {
  let entry = hardwareCatalog.find((item) => item.vendor === "Ruckus" && item.model === "ICX 7550-48ZP");
  if (legacy) entry = { ...entry, inventoryRevision: 0, groups: [
    { zone: "access", count: 48, type: "RJ45_10G", speed: 2500, poe: true, prefix: "MGE" },
    { zone: "uplink", count: 8, type: "SFP28_25G", speed: 25000, poe: false, prefix: "SFP28" },
    { zone: "management", count: 1, type: "Console", speed: 0, poe: false, prefix: "CONSOLE" },
  ] };
  const device = instantiateProfile(entry, entry.model, { x: 0, y: 0 });
  for (const port of device.ports) port.id = `saved-${port.portIndex}`;
  return device;
}

test("ICX7550-48ZP has its mixed-speed copper banks, selected single-cage module and fixed QSFP pair", () => {
  const device = deviceFor7550();
  const profile = buildRuckusModelFaceplate(device);
  assert.equal(profile.fidelity, "model");
  assert.deepEqual(profile.evidence.models, [device.model]);
  assert.match(profile.evidence.configuration, /ICX7650-1X100GQ/);
  assert.match(profile.evidence.front, /#page=17$/);
  assert.match(profile.evidence.rear, /#page=20$/);
  assert.equal(device.ports.length, 54);
  assert.equal(device.ports.filter((port) => port.type === "RJ45_MGIG" && port.speedMbps === 2500 && port.isPoe).length, 36);
  assert.equal(device.ports.filter((port) => port.type === "RJ45_10G" && port.speedMbps === 10000 && port.isPoe).length, 12);
  const copper = profile.faces.front.ports.filter((slot) => slot.portIndex <= 48);
  for (let index = 0; index < 48; index += 2) {
    assert.equal(copper[index].x, copper[index + 1].x);
    assert.ok(copper[index].y < copper[index + 1].y, "odd numbers are above even numbers");
  }
  const expansion = profile.faces.front.ports.filter((slot) => slot.physicalLabel.startsWith("3/"));
  assert.equal(expansion.length, 1);
  assert.equal(expansion[0].type, "QSFP28_100G");
  assert.equal(expansion[0].physicalLabel, "3/1");
  assert.ok(expansion[0].y > .5, "the single module cage is below its ventilation and indicators");
  const stack = profile.faces.front.ports.filter((slot) => slot.portIndex === 50 || slot.portIndex === 51);
  assert.equal(stack[0].x, stack[1].x);
  assert.ok(stack.every((slot) => slot.type === "QSFP28_100G" && slot.x < expansion[0].x));
  assert.deepEqual(stack.map((slot) => slot.physicalLabel), ["2/1", "2/2"]);
  const front = buildFaceplateScene(device, bounds, { face: "front" });
  const rear = buildFaceplateScene(device, bounds, { face: "rear" });
  assert.equal(front.ports.length, 52);
  assert.equal(rear.ports.length, 2);
  assert.equal(new Set([...front.ports, ...rear.ports].map((box) => box.port.id)).size, 54);
  assert.equal(front.unmappedPorts.length + rear.unmappedPorts.length, 0);
  const usb = front.ports.find((box) => box.port.type === "USB_C_CONSOLE");
  assert.ok(usb.labelPlacement.maxWidth >= 25, "USB-C caption retains readable width above the dense copper labels");
  assert.ok(usb.labelPlacement.y - 5.5 >= bounds.y);
  assert.ok(usb.labelPlacement.y + 5.5 < usb.y, "the caption stays clear of the USB socket");
});

test("ICX7550-48ZP rear keeps console above management, separate clock input, three fans and two RPS22 supplies", () => {
  const profile = buildRuckusModelFaceplate(deviceFor7550());
  const rear = profile.faces.rear;
  const serial = rear.ports.find((slot) => slot.type === "Console");
  const management = rear.ports.find((slot) => slot.type === "RJ45_1G");
  assert.equal(serial.x, management.x);
  assert.ok(serial.y < management.y);
  const fans = rear.components.filter((part) => part.kind === "fan");
  assert.equal(fans.length, 3);
  assert.ok(fans.every((part) => part.x + part.width < serial.x));
  const clock = rear.components.find((part) => part.role === "reference-clock");
  assert.equal(clock.kind, "coax");
  assert.ok(clock.x > serial.x);
  const supplies = rear.components.filter((part) => part.kind === "psu");
  assert.equal(supplies.length, 2);
  assert.ok(supplies.every((part) => part.variant === "ac-fan-right" && part.x > clock.x));
});

test("ICX7550 legacy surplus optical endpoints cannot bind to new service sockets at the same indices", () => {
  const device = deviceFor7550(true);
  delete device.faceplate.inventoryRevision;
  assert.equal(device.ports.length, 57);
  device.ports.find((port) => port.portIndex === 53).label = "Customer uplink";
  device.ports.find((port) => port.portIndex === 57).nativeVlan = 71;
  device.ports.reverse();
  const before = structuredClone(device);
  assert.equal(upgradeInstalledPhysicalPorts({ devices: [device] }), false);
  const front = buildFaceplateScene(device, bounds, { face: "front" });
  const rear = buildFaceplateScene(device, bounds, { face: "rear" });
  assert.equal(front.ports.length, 51);
  assert.equal(rear.ports.length, 1);
  assert.equal(rear.ports[0].port.id, "saved-57");
  assert.equal(rear.ports[0].port.type, "Console");
  const oldOptical = front.ports.find((box) => box.port.portIndex === 53);
  assert.equal(oldOptical.connectorKind, "qsfp");
  assert.equal(oldOptical.port.type, "SFP28_25G");
  assert.equal(oldOptical.displayLabel, "Customer uplink");
  assert.deepEqual(front.unmappedPorts.map((port) => port.portIndex).sort(), [50, 51, 52, 55, 56]);
  const currentFront = buildFaceplateScene(deviceFor7550(), bounds, { face: "front" });
  for (const [oldIndex, newIndex] of [[49, 49], [53, 50], [54, 51]]) {
    const oldBox = front.ports.find((box) => box.port.portIndex === oldIndex);
    const currentBox = currentFront.ports.find((box) => box.port.portIndex === newIndex);
    assert.deepEqual([oldBox.centerX, oldBox.centerY], [currentBox.centerX, currentBox.centerY]);
  }
  assert.deepEqual(device, before);
});

test("ICX7550 gapped and unknown revisions never reinterpret obsolete inventory as corrected service ports", () => {
  const device = deviceFor7550(true);
  device.ports = device.ports.filter((port) => [49, 50, 52, 54, 55, 57].includes(port.portIndex));
  const front = buildFaceplateScene(device, bounds, { face: "front" });
  const rear = buildFaceplateScene(device, bounds, { face: "rear" });
  assert.deepEqual(front.ports.map((box) => box.port.portIndex), [49, 54]);
  assert.deepEqual(front.ports.map((box) => box.displayLabel), ["3/1", "2/2"]);
  assert.deepEqual(rear.ports.map((box) => box.port.portIndex), [57]);
  assert.deepEqual(rear.ports.map((box) => box.displayLabel), ["CONSOLE"]);
  assert.deepEqual(front.unmappedPorts.map((port) => port.portIndex), [50, 52, 55]);
  device.faceplate.inventoryRevision = 7;
  assert.equal(buildFaceplateScene(device, bounds).unmappedPorts.length, device.ports.length);
});

/** Reconstruct each pre-revision ICX7150 inventory to exercise persisted endpoint compatibility. */
function deviceFor7150(count, legacy = false) {
  let entry = hardwareCatalog.find((item) => item.vendor === "Ruckus" && item.model === `ICX 7150-${count}P`);
  if (legacy) entry = { ...entry, inventoryRevision: 0, groups: [
    { zone: "access", count, type: "RJ45_1G", speed: 1000, poe: true, prefix: "" },
    { zone: "uplink", count: 4, type: "SFP_PLUS_10G", speed: 10000, poe: false, prefix: "SFP+" },
    { zone: "management", count: 1, type: "Console", speed: 0, poe: false, prefix: "CONSOLE" },
  ] };
  const device = instantiateProfile(entry, entry.model, { x: 0, y: 0 });
  for (const port of device.ports) port.id = `icx-${port.portIndex}`;
  return device;
}

for (const count of [24, 48]) {
  test(`ICX7150-${count}P includes the documented copper uplinks and service sockets in its selected 4X10GR chassis`, () => {
    const device = deviceFor7150(count);
    const profile = buildRuckusModelFaceplate(device);
    assert.ok(profile);
    assert.equal(profile.sku, `ICX7150-${count}P-4X10GR`);
    assert.equal(profile.fidelity, "model");
    assert.equal(profile.inventoryRevision, 1);
    assert.equal(device.faceplate.inventoryRevision, 1);
    assert.equal(profile.inventoryComplete, true);
    assert.match(profile.evidence.configuration, /370W/);
    assert.match(profile.evidence.front, /page=16$/);
    assert.match(profile.evidence.rear, /page=18$/);
    assert.equal(device.ports.length, count + 9);
    assert.equal(device.ports.filter((port) => port.isPoe).length, count);
    const front = profile.faces.front.ports;
    assert.equal(front.filter((slot) => slot.type === "SFP_PLUS_10G").length, 4);
    const uplinks = front.filter((slot) => ["C1", "C2"].includes(slot.physicalLabel));
    assert.equal(uplinks.length, 2);
    assert.ok(uplinks.every((slot) => slot.type === "RJ45_1G" && !device.ports[slot.portIndex - 1].isPoe));
    for (const slot of front.filter((slot) => slot.type === "SFP_PLUS_10G")) {
      assert.equal(device.ports[slot.portIndex - 1].speedMbps, 10000);
      assert.ok(slot.x > uplinks[0].x);
    }
    const optical = front.filter((slot) => slot.type === "SFP_PLUS_10G");
    assert.deepEqual(optical.map((slot) => slot.physicalLabel), ["X1", "X2", "X3", "X4"]);
    assert.equal(optical[0].x, optical[1].x);
    assert.equal(optical[2].x, optical[3].x);
    assert.ok(optical[0].y < optical[1].y && optical[2].y < optical[3].y);
    const serialFace = count === 24 ? "front" : "rear";
    assert.equal(profile.faces[serialFace].ports.filter((slot) => slot.type === "Console").length, 1);
    assert.equal(profile.faces[serialFace === "front" ? "rear" : "front"].ports.some((slot) => slot.type === "Console"), false);
    assert.equal(front.filter((slot) => slot.physicalLabel === "MGMT").length, 1);
    assert.equal(front.filter((slot) => slot.type === "USB_C_CONSOLE").length, 1);
    assert.ok(front.find((slot) => slot.portIndex === 1).x > (count === 24 ? .45 : .07));
    if (count === 48) assert.ok(front.find((slot) => slot.portIndex === 1).x < .12);
    assert.equal(profile.faces.rear.components.filter((part) => part.kind === "fan" && part.variant === "fixed").length, 2);
    assert.equal(profile.faces.rear.components.filter((part) => part.kind === "power").length, 1);
    assert.equal(profile.faces.rear.components.some((part) => part.kind === "psu"), false);
    const scenes = ["front", "rear"].map((face) => buildFaceplateScene(device, bounds, { face }));
    assert.equal(scenes.flatMap((scene) => scene.ports).length, count + 9);
    assert.equal(scenes.flatMap((scene) => scene.unmappedPorts).length, 0);
    const management = scenes[0].ports.find((box) => box.displayLabel === "MGMT");
    assert.ok(management.labelPlacement.maxWidth >= 20, "the full MGMT caption has clear space below storage");
    const serialScene = scenes[count === 24 ? 0 : 1];
    const serial = serialScene.ports.find((box) => box.port.type === "Console");
    assert.ok(serial.labelPlacement.y + serial.labelPlacement.boxHeight / 2 <= serialScene.chassis.y + serialScene.chassis.height,
      "the serial caption stays inside its physical panel");
    assert.equal(profile.faces.front.components.filter((part) => part.role?.startsWith("mode-")).length, 5);
    assert.equal(profile.faces.front.components.filter((part) => part.role?.startsWith("system-")).length, 6);
    assert.equal(profile.faces.front.components.find((part) => part.role === "system-CLOUD").active, false);
  });

  test(`ICX7150-${count}P revision zero retains old serial and optical identities across reordered, renamed and gapped saves`, () => {
    const device = deviceFor7150(count, true);
    delete device.faceplate.inventoryRevision;
    device.ports.find((port) => port.portIndex === count + 1).label = "Distribution A";
    device.ports.find((port) => port.portIndex === count + 5).label = "Recovery cable";
    device.ports.find((port) => port.portIndex === 1).nativeVlan = 84;
    device.ports.find((port) => port.portIndex === 1).allowedVlans = [84, 90];
    device.ports.reverse();
    const before = structuredClone(device);
    assert.equal(upgradeInstalledPhysicalPorts({ devices: [device] }), false);
    const current = deviceFor7150(count);
    const oldScenes = ["front", "rear"].map((face) => buildFaceplateScene(device, bounds, { face }));
    const newBoxes = ["front", "rear"].flatMap((face) => buildFaceplateScene(current, bounds, { face }).ports);
    const oldBoxes = oldScenes.flatMap((scene) => scene.ports);
    assert.equal(oldBoxes.length, count + 5);
    assert.equal(oldScenes.flatMap((scene) => scene.unmappedPorts).length, 0);
    for (let oldIndex = 1; oldIndex <= count + 5; oldIndex++) {
      const newIndex = oldIndex <= count ? oldIndex : oldIndex + 2;
      const oldBox = oldBoxes.find((box) => box.port.portIndex === oldIndex);
      const newBox = newBoxes.find((box) => box.port.portIndex === newIndex);
      assert.deepEqual([oldBox.centerX, oldBox.centerY], [newBox.centerX, newBox.centerY]);
      assert.equal(oldBox.port.id, `icx-${oldIndex}`);
    }
    assert.equal(oldBoxes.find((box) => box.port.portIndex === count + 1).displayLabel, "Distribution A");
    assert.equal(oldBoxes.find((box) => box.port.portIndex === count + 2).displayLabel, "X2");
    assert.equal(oldBoxes.find((box) => box.port.portIndex === count + 5).displayLabel, "Recovery cable");
    assert.deepEqual(device, before);
    device.ports = device.ports.filter((port) => [count + 2, count + 5].includes(port.portIndex));
    const gapped = ["front", "rear"].flatMap((face) => buildFaceplateScene(device, bounds, { face }).ports);
    assert.deepEqual(gapped.map((box) => box.port.id).sort(), [`icx-${count + 2}`, `icx-${count + 5}`].sort());
    device.faceplate.inventoryRevision = 8;
    assert.equal(buildFaceplateScene(device, bounds).unmappedPorts.length, 2);
  });
}
