import assert from "node:assert/strict";
import { test } from "node:test";
import { hardwareCatalog, instantiateProfile, upgradeInstalledPhysicalPorts } from "./static/js/catalog.js";
import { buildCiscoNexusModelFaceplate } from "./static/js/faceplate-cisco-nexus-models.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";

const bounds = { x: 0, y: 0, width: 690, height: 100 };
const cases = [{ model: "Nexus 93180YC-FX3", data: 54, rear: 2, fans: 4 }, { model: "Nexus 9336C-FX2", data: 36, rear: 3, fans: 3 }];

/** Instantiate one exact Nexus SKU with endpoint IDs suitable for saved-revision regressions. */
function deviceFor(model) {
  const device = instantiateProfile(hardwareCatalog.find((entry) => entry.vendor === "Cisco" && entry.model === model), model, { x: 0, y: 0 });
  for (const port of device.ports) port.id = `port-${port.portIndex}`;
  return device;
}

for (const expected of cases) {
  test(`${expected.model} preserves its individual port and power-side arrangement`, () => {
    const device = deviceFor(expected.model);
    const profile = buildCiscoNexusModelFaceplate(device);
    assert.equal(profile.fidelity, "model");
    assert.equal(profile.inventoryRevision, 1);
    assert.deepEqual(profile.evidence.models, [device.model]);
    assert.equal(new URL(profile.source).hostname, "www.cisco.com");
    assert.equal(new URL(profile.source).protocol, "https:");
    const front = buildFaceplateScene(device, bounds, { face: "front" });
    const rear = buildFaceplateScene(device, bounds, { face: "rear" });
    assert.equal(front.ports.length, expected.data);
    assert.equal(rear.ports.length, expected.rear);
    assert.equal(front.hiddenPorts.length, expected.rear);
    assert.equal(rear.hiddenPorts.length, expected.data);
    assert.equal(front.unmappedPorts.length + rear.unmappedPorts.length, 0);
    assert.deepEqual([...front.ports, ...rear.ports].map((box) => box.port.id).sort(), device.ports.map((port) => port.id).sort());
    assert.equal(profile.faces.rear.components.filter((part) => part.kind === "fan").length, expected.fans);
    assert.equal(profile.faces.rear.components.filter((part) => part.kind === "psu").length, 2);
    const first = profile.faces.front.ports[0];
    const second = profile.faces.front.ports[1];
    assert.equal(first.x, second.x);
    assert.ok(first.y < second.y);
    assert.equal(first.physicalLabel, "1");
    if (expected.data === 54) {
      assert.equal(profile.faces.front.ports.filter((slot) => slot.type === "SFP28_25G").length, 48);
      assert.equal(new Set(profile.faces.front.ports.filter((slot) => slot.type === "QSFP28_100G").map((slot) => slot.x)).size, 3);
      assert.deepEqual(profile.faces.front.components.filter((part) => part.kind === "coax").map((part) => part.label), ["1PPS", "10MHz", "ANT"]);
      assert.ok(profile.faces.rear.components.some((part) => part.kind === "rj45" && part.label === "ToD"));
      assert.ok(profile.faces.rear.components.filter((part) => part.kind === "psu").every((part) => part.variant === "ac-fan-left"));
    } else {
      assert.equal(new Set(profile.faces.front.ports.map((slot) => slot.x)).size, 18);
      const opticalManagement = rear.ports.find((box) => box.port.type === "SFP_1G");
      assert.equal(opticalManagement.port.speedMbps, 1000);
      assert.ok(profile.faces.rear.components.filter((part) => part.kind === "psu").every((part) => part.variant === "ac-fan-right"));
    }
  });

  test(`${expected.model} retains reordered legacy data and console identities without inventing management endpoints`, () => {
    const device = deviceFor(expected.model);
    delete device.faceplate.inventoryRevision;
    device.ports = device.ports.filter((port) => port.portIndex <= expected.data + 1).reverse();
    device.ports.find((port) => port.portIndex === expected.data + 1).label = "Renamed serial endpoint";
    const snapshot = structuredClone(device);
    assert.equal(upgradeInstalledPhysicalPorts({ devices: [device] }), false);
    const rear = buildFaceplateScene(device, bounds, { face: "rear" });
    assert.equal(rear.ports.length, 1);
    assert.equal(rear.ports[0].port.id, `port-${expected.data + 1}`);
    assert.equal(rear.ports[0].displayLabel, "Renamed serial endpoint");
    assert.equal(rear.unmappedPorts.length, 0);
    assert.deepEqual(device, snapshot);
  });
}
assert.equal(buildCiscoNexusModelFaceplate({ model: "Nexus 9000 family" }), null);
