import assert from "node:assert/strict";
import { test } from "node:test";
import { hardwareCatalog, instantiateProfile, upgradeInstalledPhysicalPorts } from "./static/js/catalog.js";
import { buildCiscoMerakiModelFaceplate } from "./static/js/faceplate-cisco-meraki-models.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";
import { hardwarePrimitives } from "./static/js/hardware-components.js";

const bounds = { x: 0, y: 0, width: 690, height: 100 };
const cases = [{ model: "Meraki MS120-24P", copper: 24, rear: 1 }, { model: "Meraki MS225-48FP", copper: 48, rear: 3 }];

/** Instantiate one verified Meraki SKU with stable saved endpoint identifiers. */
function deviceFor(model) {
  const device = instantiateProfile(hardwareCatalog.find((entry) => entry.vendor === "Cisco" && entry.model === model), model, { x: 0, y: 0 });
  for (const port of device.ports) port.id = `port-${port.portIndex}`;
  return device;
}

for (const expected of cases) {
  test(`${expected.model} traces fixed management, optical and stacking sockets without a serial console`, () => {
    const device = deviceFor(expected.model);
    const profile = buildCiscoMerakiModelFaceplate(device);
    assert.equal(device.faceplate.inventoryRevision, 1);
    assert.equal(profile.fidelity, "model");
    assert.deepEqual(profile.evidence.models, [device.model]);
    assert.equal(new URL(profile.source).hostname, "documentation.meraki.com");
    assert.equal(new URL(profile.source).protocol, "https:");
    assert.equal(device.ports.some((port) => port.type === "Console"), false);
    const front = buildFaceplateScene(device, bounds, { face: "front" });
    const rear = buildFaceplateScene(device, bounds, { face: "rear" });
    assert.equal(front.ports.length, expected.copper + 4);
    assert.equal(rear.ports.length, expected.rear);
    assert.equal(front.hiddenPorts.length, expected.rear);
    assert.equal(front.unmappedPorts.length + rear.unmappedPorts.length, 0);
    assert.deepEqual([...front.ports, ...rear.ports].map((box) => box.port.id).sort(), device.ports.map((port) => port.id).sort());
    assert.ok(rear.ports.some((box) => box.port.type === "RJ45_1G" && box.displayLabel === "MGMT"));
    assert.equal(profile.faces.rear.components.some((part) => part.kind === "psu" || part.kind === "fan"), false,
      "fixed internal power and a perforated exhaust do not become replaceable FRUs");
    const optics = profile.faces.front.ports.filter((slot) => slot.type.includes("SFP"));
    assert.equal(optics.length, 4);
    if (expected.copper === 24) {
      assert.ok(profile.faces.front.ports[0].x > .48);
      assert.equal(new Set(optics.map((slot) => slot.x)).size, 2);
      assert.equal(new Set(optics.map((slot) => slot.y)).size, 2);
    } else {
      assert.ok(profile.faces.front.ports[0].x < .1);
      assert.equal(new Set(optics.map((slot) => slot.y)).size, 1);
      const stack = rear.ports.filter((box) => box.port.type === "Stack");
      assert.equal(stack.length, 2);
      assert.ok(stack.every((box) => box.connectorKind === "qsfp" && box.port.speedMbps === 40000));
      const rps = profile.faces.rear.components.find((part) => part.label === "RPS 22-PIN");
      assert.equal(rps.columns, 11);
      assert.equal(hardwarePrimitives(rps).filter((primitive) => primitive.kind === "rect" && primitive.fill === "#b9c3c4").length, 22);
    }
  });

  test(`${expected.model} leaves the obsolete saved Console unmapped even when its index matches current hardware`, () => {
    const device = deviceFor(expected.model);
    delete device.faceplate.inventoryRevision;
    device.ports = device.ports.filter((port) => port.portIndex <= expected.copper + 4);
    const obsolete = { id: "old-console", portIndex: expected.copper + 5, label: "Renamed obsolete connector", type: "Console", speedMbps: 0, isPoe: false };
    device.ports.push(obsolete);
    device.ports.reverse();
    const snapshot = structuredClone(device);
    assert.equal(upgradeInstalledPhysicalPorts({ devices: [device] }), false);
    for (const face of ["front", "rear"]) {
      const scene = buildFaceplateScene(device, bounds, { face });
      assert.deepEqual(scene.unmappedPorts, [obsolete]);
      assert.ok(scene.hiddenPorts.some((box) => box.port.id === obsolete.id && box.portal));
      assert.equal(scene.ports.some((box) => box.port.id === obsolete.id), false);
      assert.equal(scene.ports.length, face === "front" ? expected.copper + 4 : 0);
    }
    assert.deepEqual(device, snapshot);
  });
}
assert.equal(buildCiscoMerakiModelFaceplate({ model: "Meraki MS120" }), null);
