import assert from "node:assert/strict";
import { test } from "node:test";
import { hardwareCatalog, instantiateProfile, upgradeInstalledPhysicalPorts } from "./static/js/catalog.js";
import { buildJuniperEXModelFaceplate } from "./static/js/faceplate-juniper-ex-models.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";

const cases = [
  { model: "EX2300-24T", oldCount: 29, front: 29, rear: 2, fans: 1, copper: 24, console: 29, usbConsole: 30 },
  { model: "EX2300-48P", oldCount: 53, front: 53, rear: 2, fans: 2, copper: 48, console: 53, usbConsole: 54 },
  { model: "EX3400-24P", oldCount: 31, front: 29, rear: 4, fans: 2, copper: 24, console: 31, usbConsole: 32 },
  { model: "EX4400-48P", oldCount: 53, front: 53, rear: 4, fans: 2, copper: 48, console: 55, legacyConsole: 53, usbConsole: 56 },
  { model: "EX4650-48Y", oldCount: 57, front: 56, rear: 2, fans: 5, console: 57 },
];
const bounds = { x: 0, y: 0, width: 690, height: 100 };

/** Instantiate one exact EX SKU with stable identities to test saved-inventory compatibility. */
function deviceFor(model) {
  const device = instantiateProfile(hardwareCatalog.find((entry) => entry.vendor === "Juniper" && entry.model === model), model, { x: 0, y: 0 });
  for (const port of device.ports) port.id = `port-${port.portIndex}`;
  return device;
}

for (const expected of cases) {
  test(`${expected.model} traces its documented front and rear configuration`, () => {
    const device = deviceFor(expected.model);
    const profile = buildJuniperEXModelFaceplate(device);
    assert.equal(profile.fidelity, "model");
    assert.equal(profile.inventoryRevision, 1);
    assert.equal(device.faceplate.inventoryRevision, 1);
    assert.deepEqual(profile.evidence.models, [device.model]);
    assert.equal(new URL(profile.source).hostname, "www.juniper.net");
    assert.equal(new URL(profile.source).protocol, "https:");
    const front = buildFaceplateScene(device, bounds, { face: "front" });
    const rear = buildFaceplateScene(device, bounds, { face: "rear" });
    assert.equal(front.ports.length, expected.front);
    assert.equal(rear.ports.length, expected.rear);
    assert.equal(front.unmappedPorts.length + rear.unmappedPorts.length, 0);
    assert.equal(front.hiddenPorts.length, expected.rear);
    assert.equal(rear.hiddenPorts.length, expected.front);
    assert.deepEqual([...front.ports, ...rear.ports].map((box) => box.port.id).sort(), device.ports.map((port) => port.id).sort());
    assert.ok(rear.ports.some((box) => box.port.portIndex === expected.console && box.port.type === "Console"));
    if (expected.usbConsole) assert.ok(front.ports.some((box) => box.port.portIndex === expected.usbConsole && box.port.type.includes("USB_")));
    assert.equal(profile.faces.rear.components.filter((part) => part.kind === "fan").length, expected.fans);
    const data = profile.faces.front.ports.filter((slot) => slot.portIndex <= (expected.copper || 48));
    assert.equal(data[0].x, data[1].x);
    assert.ok(data[0].y < data[1].y, "printed even-numbered sockets are above odd-numbered sockets");
    assert.equal(data[0].physicalLabel, "0");
    assert.equal(data.at(-1).physicalLabel, String((expected.copper || 48) - 1));
    if (expected.copper === 24) assert.ok(data[0].x > .43, "24-port access banks occupy the right half");
    if (expected.model.startsWith("EX2300")) {
      assert.ok(profile.faces.rear.components.filter((part) => part.kind === "fan").every((part) => part.variant === "fixed"));
      assert.equal(profile.faces.rear.components.filter((part) => part.kind === "psu").length, 0, "fixed AC inlet has no invented replaceable PSU housing");
    }
    if (expected.model === "EX3400-24P") {
      assert.equal(rear.ports.filter((box) => box.port.type === "QSFP_PLUS_40G").length, 2);
      assert.equal(profile.faces.rear.components.find((part) => part.kind === "psu").variant, "ac-fan-left");
    }
    if (expected.model === "EX4400-48P") {
      assert.match(profile.evidence.configuration, /EX4400-EM-4Y/);
      const module = profile.faces.front.components.find((part) => part.kind === "module-bay");
      assert.equal(module.variant, "populated");
      const uplinks = profile.faces.front.ports.filter((slot) => slot.type === "SFP28_25G");
      assert.equal(uplinks.length, 4);
      assert.equal(new Set(uplinks.map((slot) => slot.y)).size, 1);
      assert.equal(rear.ports.filter((box) => box.port.type === "QSFP28_100G").length, 2);
    }
    if (expected.model === "EX4650-48Y") {
      assert.match(profile.evidence.configuration, /EX4650-48Y-AFI/);
      assert.equal(profile.faces.rear.components.filter((part) => part.kind === "psu").length, 2);
      assert.equal(profile.faces.front.ports.filter((slot) => slot.type === "QSFP28_100G").length, 8);
      assert.equal(new Set(profile.faces.front.ports.filter((slot) => slot.type === "QSFP28_100G").map((slot) => slot.x)).size, 4);
    }
  });

  test(`${expected.model} preserves reordered revision-zero endpoints without adding absent sockets`, () => {
    const device = deviceFor(expected.model);
    delete device.faceplate.inventoryRevision;
    device.ports = device.ports.filter((port) => expected.legacyConsole
      ? port.portIndex < expected.legacyConsole || port.portIndex === expected.console
      : port.portIndex <= expected.oldCount).map((port) => {
      const oldIndex = expected.legacyConsole && port.portIndex === expected.console ? expected.legacyConsole : port.portIndex;
      return { ...port, portIndex: oldIndex, id: `port-${oldIndex}` };
    }).reverse();
    if (expected.model === "EX3400-24P") for (const port of device.ports.filter((port) => port.portIndex === 29 || port.portIndex === 30)) port.type = "QSFP28_100G";
    device.ports.find((port) => port.portIndex === 1).label = "Renamed legacy access";
    const snapshot = structuredClone(device);
    assert.equal(upgradeInstalledPhysicalPorts({ devices: [device] }), false);
    const front = buildFaceplateScene(device, bounds, { face: "front" });
    const rear = buildFaceplateScene(device, bounds, { face: "rear" });
    assert.equal(front.unmappedPorts.length + rear.unmappedPorts.length, 0);
    assert.equal(front.ports.length + rear.ports.length, expected.oldCount);
    assert.equal(front.ports.find((box) => box.port.portIndex === 1).displayLabel, "Renamed legacy access");
    assert.ok(rear.ports.some((box) => box.port.portIndex === (expected.legacyConsole || expected.console) && box.port.type === "Console"));
    assert.deepEqual(device, snapshot);
    device.faceplate.inventoryRevision = 77;
    assert.equal(buildFaceplateScene(device, bounds).unmappedPorts.length, expected.oldCount);
  });
}
assert.equal(buildJuniperEXModelFaceplate({ model: "EX2300 family" }), null);
assert.equal(buildJuniperEXModelFaceplate({ model: "EX2300-24T", faceplate: { vendor: "Cisco" } }), null);
