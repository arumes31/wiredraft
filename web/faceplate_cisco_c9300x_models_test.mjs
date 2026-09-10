import assert from "node:assert/strict";
import test from "node:test";
import { hardwareCatalog, instantiateProfile, upgradeInstalledPhysicalPorts } from "./static/js/catalog.js";
import { buildCiscoCatalystModelFaceplate } from "./static/js/faceplate-cisco-catalyst-models.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";

const bounds = { x: 0, y: 0, width: 690, height: 100 };

/** Create the selected C9300X chassis and assign predictable identities to its physical sockets. */
function deviceFor() {
  const catalog = hardwareCatalog.find((entry) => entry.vendor === "Cisco" && entry.model === "Catalyst C9300X-24Y");
  const device = instantiateProfile(catalog, catalog.model, { x: 0, y: 0 });
  device.ports.forEach((port) => { port.id = `port-${port.portIndex}`; });
  return device;
}

test("C9300X-24Y selects the eight-SFP28 module and its documented front banks", () => {
  const device = deviceFor();
  const profile = buildCiscoCatalystModelFaceplate(device);
  assert.equal(profile?.fidelity, "model");
  assert.deepEqual(profile.evidence.models, [device.model]);
  assert.equal(profile.inventoryRevision, 1);
  assert.equal(device.faceplate.inventoryRevision, 1);
  assert.match(profile.evidence.configuration, /C9300X-NM-8Y/);
  assert.equal(device.ports.length, 37);
  const data = profile.faces.front.ports.filter((slot) => slot.portIndex <= 24);
  const uplinks = profile.faces.front.ports.filter((slot) => slot.portIndex >= 25 && slot.portIndex <= 32);
  assert.equal(data.length, 24);
  assert.equal(new Set(data.map((slot) => slot.y)).size, 1, "24 downlinks occupy a single row in four banks");
  assert.ok(data[6].x - data[5].x > data[1].x - data[0].x);
  assert.ok(data[12].x - data[11].x > data[1].x - data[0].x);
  assert.ok(data[18].x - data[17].x > data[1].x - data[0].x);
  assert.equal(uplinks.length, 8);
  assert.ok([...data, ...uplinks].every((slot) => slot.type === "SFP28_25G"));
  assert.ok(device.ports.filter((port) => port.portIndex <= 32).every((port) => port.speedMbps === 25000));
  for (let index = 0; index < 8; index += 2) {
    assert.equal(uplinks[index].x, uplinks[index + 1].x);
    assert.ok(uplinks[index].y < uplinks[index + 1].y, "NM-8Y odd port numbers are above even numbers");
    assert.equal(uplinks[index].physicalLabel, String(index + 1));
  }
  assert.equal(profile.faces.front.ports.find((slot) => slot.type === "USB_MINI_CONSOLE").portIndex, 34);
  assert.equal(profile.faces.front.components.filter((part) => part.kind === "usb").length, 1);
  assert.equal(profile.faces.front.components.filter((part) => part.kind === "usb-c").length, 1);
  assert.ok(!device.ports.some((port) => port.type === "USB_C_CONSOLE"), "Type-C is storage, not a console endpoint");
  assert.ok(!profile.faces.front.components.some((part) => part.kind === "text" && part.label === "25G"),
    "the redundant rate caption must not occupy the lower NM-8Y port-label plates");
});

/** Compare visible rectangles while treating touching boundaries as non-overlapping. */
function overlaps(a, b) {
  return a.x < b.x + b.width - 1e-8 && a.x + a.width > b.x + 1e-8 &&
    a.y < b.y + b.height - 1e-8 && a.y + a.height > b.y + 1e-8;
}

test("rear service captions clear their neighbors and hardware without entering the next device", () => {
  for (const renamed of [false, true]) {
    const device = deviceFor();
    if (renamed) for (const port of device.ports) port.label = `Long custom caption for port ${port.portIndex}`;
    const scene = buildFaceplateScene(device, bounds, { face: "rear" });
    const plates = scene.ports.filter((box) => [33, 35].includes(box.port.portIndex)).map((box) => {
      const { x, y, maxWidth, boxMaxWidth } = box.labelPlacement;
      assert.equal(box.labelPlacement.side, "anchored");
      const width = Math.min(boxMaxWidth, Math.max(12, maxWidth + 6));
      return { x: x - width / 2, y: y - 5.5, width, height: 11 };
    });
    assert.equal(plates.length, 2);
    assert.ok(!overlaps(plates[0], plates[1]), "the full label plates remain separate even for long custom names");
    for (const plate of plates) {
      assert.ok(plate.x >= bounds.x && plate.y >= bounds.y && plate.x + plate.width <= bounds.width &&
        plate.y + plate.height <= bounds.height, "captions stay inside the device/export bounds");
      assert.ok(scene.components.filter((part) => !part.applicationOverlay).every((part) => !overlaps(plate, part)),
        "captions cannot cover the SSD cover, beacon or fan module");
      assert.ok(scene.ports.every((port) => !overlaps(plate, port)), "captions cannot cover the physical sockets");
    }
  }
});

test("C9300X rear retains side-by-side management, tall StackWise sockets and distinct StackPower", () => {
  const device = deviceFor();
  const profile = buildCiscoCatalystModelFaceplate(device);
  const rear = profile.faces.rear;
  const console = rear.ports.find((slot) => slot.portIndex === 33);
  const mgmt = rear.ports.find((slot) => slot.portIndex === 35);
  assert.equal(console.y, mgmt.y);
  assert.ok(console.x < mgmt.x && mgmt.x < .11);
  const stacks = rear.ports.filter((slot) => slot.type === "Stack");
  assert.deepEqual(stacks.map((slot) => slot.portIndex), [36, 37]);
  assert.ok(stacks.every((slot) => slot.height > .7 && slot.width < .05));
  assert.ok(device.ports.filter((port) => port.type === "Stack").every((port) => port.speedMbps === 0));
  const fans = rear.components.filter((part) => part.kind === "fan");
  assert.equal(fans.length, 3);
  assert.ok(fans[0].x < stacks[0].x && stacks[0].x < fans[1].x);
  assert.ok(fans[1].x < stacks[1].x && stacks[1].x < fans[2].x);
  const powerPair = rear.components.filter((part) => part.role === "stack-power");
  assert.equal(powerPair.length, 2);
  assert.ok(powerPair.every((part) => part.kind === "power" && part.variant === "stack-power"));
  assert.equal(powerPair[0].x, powerPair[1].x);
  assert.ok(powerPair[0].y < powerPair[1].y);
  assert.equal(rear.components.filter((part) => part.kind === "psu").length, 1);
  assert.match(rear.components.find((part) => part.kind === "psu").label, /715WAC-P/);
  assert.equal(rear.components.find((part) => part.label === "OPTIONAL PSU 2").variant, "blank");
  assert.equal(rear.components.find((part) => part.role === "usb-ssd").variant, "blank");
  const scenes = ["front", "rear"].map((face) => buildFaceplateScene(device, bounds, { face }));
  assert.ok(scenes.every((scene) => scene.unmappedPorts.length === 0));
  assert.deepEqual(scenes.flatMap((scene) => scene.ports.map((box) => box.port.id)).sort(), device.ports.map((port) => port.id).sort());
  assert.ok(scenes[1].ports.filter((box) => box.port.type === "Stack").every((box) => box.height > box.width),
    "actual rear StackWise cavities retain their portrait shape after world scaling");
});

test("revision-zero C9300X uplinks keep all old identities and names while using SFP28 cage art", () => {
  const device = deviceFor();
  delete device.faceplate.inventoryRevision;
  device.ports = device.ports.filter((port) => port.portIndex <= 33);
  for (const port of device.ports) {
    if (port.portIndex <= 24) port.label = String(port.portIndex);
    else if (port.portIndex <= 32) Object.assign(port, { label: String(port.portIndex), type: "QSFP28_100G", speedMbps: 100000 });
    else port.label = "CONSOLE";
  }
  device.ports.find((port) => port.portIndex === 26).label = "Renamed core uplink";
  device.ports.reverse();
  device.faceplate.totalPorts = 33;
  const original = structuredClone(device);
  assert.equal(upgradeInstalledPhysicalPorts({ devices: [device] }), false);
  const front = buildFaceplateScene(device, bounds, { face: "front" });
  const rear = buildFaceplateScene(device, bounds, { face: "rear" });
  assert.equal(front.ports.length, 32);
  assert.equal(rear.ports.length, 1);
  assert.equal(front.unmappedPorts.length + rear.unmappedPorts.length, 0);
  const oldUplink = front.ports.find((box) => box.port.portIndex === 25);
  assert.equal(oldUplink.port.id, "port-25");
  assert.equal(oldUplink.port.type, "QSFP28_100G");
  assert.equal(oldUplink.connectorKind, "sfp");
  assert.equal(oldUplink.displayLabel, "1");
  assert.equal(front.ports.find((box) => box.port.portIndex === 26).displayLabel, "Renamed core uplink");
  assert.equal(rear.ports[0].port.id, "port-33");
  assert.deepEqual(device, original, "drawing never rewrites stored inventory or appends newly cataloged sockets");
});
