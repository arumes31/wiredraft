import assert from "node:assert/strict";
import { test } from "node:test";
import { hardwareCatalog, instantiateProfile, upgradeInstalledPhysicalPorts } from "./static/js/catalog.js";
import { resolveArubaFaceplate } from "./static/js/faceplate-aruba-models.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";

const cases = [
  { model: "CX 8320 family", sku: "JL479A", total: 56, data: 54, fans: 5, rear: 0 },
  { model: "CX 8325 family", sku: "JL624A", total: 59, data: 56, fans: 6, rear: 0 },
  { model: "CX 8360 family", sku: "JL704C", total: 57, data: 54, fans: 5, rear: 1 },
  { model: "CX 6300M 24-port Smart Rate", sku: "R8S89A", total: 31, data: 28, fans: 2, rear: 0 },
];

/** Reconstruct the verified prior groups using the actual constructor's zone ordering. */
function deviceFor(model, legacy = false) {
  let entry = hardwareCatalog.find((row) => row.vendor === "HPE Aruba" && row.model === model);
  if (legacy) entry = { ...entry, inventoryRevision: 0, groups: model.includes("Smart Rate") ? [
    { zone: "access", count: 24, type: "RJ45_10G", speed: 10000, poe: true, prefix: "" },
    { zone: "uplink", count: 4, type: "SFP56_50G", speed: 50000, prefix: "SFP56" },
    { zone: "management", count: 1, type: "Console", speed: 0, prefix: "CONSOLE" },
  ] : [
    { zone: "uplink", count: 48, type: "SFP28_25G", speed: 25000, prefix: "SFP28" },
    { zone: "uplink", count: 8, type: "QSFP28_100G", speed: 100000, prefix: "QSFP28" },
    { zone: "management", count: 1, type: "RJ45_1G", speed: 1000, prefix: "MGMT" },
    { zone: "management", count: 1, type: "USB_C_CONSOLE", speed: 0, prefix: "CONSOLE" },
  ] };
  const device = instantiateProfile(entry, model, { x: 17, y: 33 });
  for (const port of device.ports) port.id = `retained-${port.portIndex}`;
  return device;
}

/** Build the actual panel scene at a selectable rack width. */
function sceneFor(device, face = "front", width = 690) {
  return buildFaceplateScene(device, { x: 0, y: 0, width, height: 100 }, { face });
}

for (const expected of cases) {
  test(`${expected.model} selects both individually verified ${expected.sku} panels`, () => {
    const device = deviceFor(expected.model); const profile = resolveArubaFaceplate(device);
    assert.ok(profile, "an exact selected SKU must replace the family drawing");
    assert.equal(profile.sku, expected.sku); assert.equal(profile.inventoryRevision, 1);
    assert.equal(profile.fidelity, "model"); assert.equal(profile.rearHardwareVerified, true);
    assert.equal(profile.inventoryComplete, true); assert.equal(profile.evidence.catalogAlias, expected.model);
    assert.equal(hardwareCatalog.find((row) => row.model === expected.model).preserveInstalledPorts, true);
    assert.deepEqual(profile.evidence.models, [expected.sku]);
    assert.ok(profile.evidence.front && profile.evidence.rear && profile.evidence.configuration.includes(expected.sku));
    assert.equal(device.ports.length, expected.total);
    const front = sceneFor(device); const rear = sceneFor(device, "rear");
    assert.equal(front.ports.length, expected.total - expected.rear); assert.equal(rear.ports.length, expected.rear);
    assert.equal(front.unmappedPorts.length, 0); assert.equal(rear.unmappedPorts.length, 0);
    assert.equal(profile.faces.rear.components.filter((part) => part.kind === "fan").length, expected.fans);
    assert.equal(profile.faces.rear.components.filter((part) => part.kind === "psu").length, 2);
    assert.equal(resolveArubaFaceplate(device), profile, "canonical immutable geometry is cached");
  });

  test(`${expected.model} preserves edited current and historical endpoint identities`, () => {
    const current = deviceFor(expected.model);
    current.ports[0].speedMbps = 100; current.ports[0].isPoe = true; current.ports[0].group = "Saved group";
    const freshBefore = structuredClone(current);
    assert.equal(upgradeInstalledPhysicalPorts({ devices: [current] }), false); assert.deepEqual(current, freshBefore);
    const old = deviceFor(expected.model, true); const smart = expected.sku === "R8S89A";
    assert.deepEqual(old.ports.slice(- (smart ? 1 : 2)).map((port) => [port.portIndex, port.type, port.label]),
      smart ? [[29, "Console", "CONSOLE"]] : [[57, "RJ45_1G", "MGMT"], [58, "USB_C_CONSOLE", "CONSOLE"]]);
    delete old.faceplate.inventoryRevision; old.ports.reverse();
    for (const port of old.ports) {
      port.label = port.portIndex > expected.data ? "1" : `Custom ${port.portIndex}`;
      port.speedMbps = 100; port.isPoe = true; port.nativeVlan = 77; port.allowedVlans = [77, 99]; port.group = "Saved group";
    }
    const topology = { devices: [old], links: [{ id: "link", sourcePortId: old.ports[0].id, targetPortId: "external" }], racks: [{ id: "rack", units: 42 }] };
    const before = structuredClone(topology);
    assert.equal(upgradeInstalledPhysicalPorts(topology), false); assert.deepEqual(topology, before);
    const scene = sceneFor(old); const canonical = sceneFor(deviceFor(expected.model));
    const pairs = smart ? [[1, 1], [27, 27], [29, 29]] : [[1, 1], [49, 49], [54, 54], [57, expected.sku === "JL624A" ? 57 : 55], [58, expected.sku === "JL624A" ? 58 : 56]];
    for (const [previous, next] of pairs) {
      const saved = scene.ports.find((port) => port.port.portIndex === previous);
      const target = canonical.ports.find((port) => port.port.portIndex === next);
      assert.ok(saved); assert.equal(saved.centerX, target.centerX); assert.equal(saved.centerY, target.centerY);
      assert.equal(saved.port.id, `retained-${previous}`);
      if (previous > expected.data) assert.equal(saved.displayLabel, "1", "editable labels cannot select another socket");
    }
    assert.deepEqual(scene.unmappedPorts.map((port) => port.portIndex).sort((a, b) => a - b), expected.data === 54 ? [55, 56] : []);
    assert.deepEqual(topology, before);
    old.ports = old.ports.filter((port) => smart ? [1, 27, 29].includes(port.portIndex) : [1, 49, 55, 57, 58].includes(port.portIndex));
    assert.equal(sceneFor(old).ports.length, smart ? 3 : expected.data === 54 ? 4 : 5);
    old.faceplate.inventoryRevision = 99;
    assert.equal(sceneFor(old).ports.length, 0); assert.equal(sceneFor(old).unmappedPorts.length, old.ports.length);
  });
}

test("core models preserve their distinct source port orders and service connector roles", () => {
  const a = resolveArubaFaceplate(deviceFor("CX 8320 family"));
  assert.ok(a.faces.front.ports.slice(0, 48).every((slot) => slot.type === "SFP_PLUS_10G"));
  assert.ok(a.faces.front.ports.slice(48, 54).every((slot) => slot.type === "QSFP_PLUS_40G"));
  const qsfp = a.faces.front.ports.slice(48, 54);
  assert.deepEqual(qsfp.slice(0, 3).map((slot) => slot.x), [qsfp[0].x, qsfp[0].x, qsfp[0].x]);
  assert.ok(qsfp[0].y < qsfp[1].y && qsfp[1].y < qsfp[2].y && qsfp[3].x > qsfp[0].x);
  const b = resolveArubaFaceplate(deviceFor("CX 8325 family"));
  assert.equal(new Set(b.faces.front.ports.slice(0, 48).map((slot) => slot.y)).size, 3);
  assert.equal(b.faces.front.ports.find((slot) => slot.portIndex === 58).connectorKind, "usb-micro");
  assert.equal(b.faces.front.ports.find((slot) => slot.portIndex === 59).connectorKind, "console");
  const c = resolveArubaFaceplate(deviceFor("CX 8360 family"));
  assert.equal(c.faces.rear.ports[0].portIndex, 57); assert.equal(c.faces.rear.ports[0].connectorKind, "console-inverted");
  assert.equal(a.faces.front.ports.find((slot) => slot.portIndex === 55).connectorKind, "rj45-inverted");
  assert.equal(b.faces.front.ports.find((slot) => slot.portIndex === 57).connectorKind, "rj45-inverted");
  assert.equal(c.faces.front.ports.find((slot) => slot.portIndex === 55).connectorKind, "rj45-inverted");
  assert.match(c.evidence.numberedPhotoProvenance, /community illustration evidence/);
  assert.deepEqual(c.faces.front.ports.filter((slot) => slot.portIndex >= 49 && slot.portIndex <= 54 && slot.y < .5).map((slot) => slot.physicalLabel), ["49", "51", "53"]);
  for (const ports of [a.faces.front.ports.slice(0, 48), c.faces.front.ports.slice(0, 54)]) for (let i = 0; i < ports.length; i += 2) {
    assert.equal(ports[i].x, ports[i + 1].x); assert.ok(ports[i].y < ports[i + 1].y);
  }
});

test("R8S89A keeps three eight-port copper banks and two different uplink speed pairs", () => {
  const device = deviceFor("CX 6300M 24-port Smart Rate"); const profile = resolveArubaFaceplate(device);
  assert.ok(device.ports.slice(0, 24).every((port) => port.type === "RJ45_10G" && port.isPoe && port.speedMbps === 10000));
  assert.deepEqual(device.ports.slice(24, 28).map((port) => [port.type, port.speedMbps]),
    [["SFP56_50G", 50000], ["SFP56_50G", 50000], ["SFP28_25G", 25000], ["SFP28_25G", 25000]]);
  assert.ok(profile.faces.front.ports.slice(0, 24).every((slot) => slot.x > .28 && slot.x < .73));
  assert.ok(profile.faces.front.ports.slice(0, 24).every((slot) => slot.connectorKind === (slot.portIndex % 2 ? "rj45-inverted" : "rj45")));
  assert.equal(profile.faces.front.ports.find((slot) => slot.portIndex === 31).connectorKind, "rj45-inverted");
  assert.equal(profile.faces.front.ports.find((slot) => slot.portIndex === 29).connectorKind, "console");
  assert.ok(profile.faces.front.ports[8].x - profile.faces.front.ports[6].x > .04, "separate bank boundaries");
  assert.deepEqual(device.ports.slice(28).map((port) => port.type), ["Console", "USB_C_CONSOLE", "RJ45_1G"]);
  assert.match(profile.evidence.configuration, /JL087A.*1050W/);
  assert.match(profile.limitations.join(" "), /110.240/);
});

test("all selected core and Smart Rate captions remain inside hardware and clear every physical element", () => {
  for (const { model } of cases) for (const width of [460, 690]) for (const face of ["front", "rear"]) {
    const scene = sceneFor(deviceFor(model), face, width); const captions = [];
    for (const port of scene.ports) {
      const label = port.labelPlacement; const labelWidth = Math.min(label.boxMaxWidth, port.displayLabel.length * label.fontSize * .7 + 6);
      const caption = { x: label.x - labelWidth / 2, y: label.y - label.boxHeight / 2, width: labelWidth, height: label.boxHeight };
      assert.ok(caption.x >= scene.chassis.x && caption.x + caption.width <= scene.chassis.x + scene.chassis.width &&
        caption.y >= scene.chassis.y && caption.y + caption.height <= scene.chassis.y + scene.chassis.height, `${model} ${face} caption ${port.displayLabel} leaves the body at ${width}`);
      for (const box of [...captions, ...scene.ports, ...scene.components.filter((part) => !part.applicationOverlay)]) assert.ok(!(caption.x < box.x + box.width && caption.x + caption.width > box.x &&
        caption.y < box.y + box.height && caption.y + caption.height > box.y), `${model} ${face} caption ${port.displayLabel} overlaps hardware or another caption at ${width}`);
      captions.push(caption);
    }
  }
});
