import assert from "node:assert/strict";
import test from "node:test";
import { hardwareCatalog, instantiateProfile, upgradeInstalledPhysicalPorts } from "./static/js/catalog.js";
import { resolveArubaFaceplate } from "./static/js/faceplate-aruba-models.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";

const models = ["CX 6100 24G 4SFP+", "CX 6100 48G 4SFP+", "CX 6200F 24G 4SFP+", "CX 6200F 48G 4SFP+", "CX 6300M 48G", "CX 8325-48Y8C"];

/** Build uniquely identified catalog inventory for scene and compatibility assertions. */
function deviceFor(model) {
  const device = instantiateProfile(hardwareCatalog.find((row) => row.model === model), model, { x: 0, y: 0 });
  device.id = model;
  for (const port of device.ports) { port.id = `${model}-${port.portIndex}`; port.deviceId = model; }
  return device;
}

test("Aruba exact profiles retain model-specific evidence and separate all front sockets from rear cooling", () => {
  for (const model of models) {
    const device = deviceFor(model);
    const profile = resolveArubaFaceplate(device);
    assert.equal(profile.fidelity, "model");
    assert.match(profile.sku, /^JL/);
    for (const reference of [profile.evidence.front, profile.evidence.rear]) {
      const url = new URL(reference);
      assert.equal(url.protocol, "https:");
      assert.equal(url.hostname, "arubanetworking.hpe.com");
    }
    assert.equal(profile.faces.front.ports.length, device.ports.length, model);
    const bounds = { x: 20, y: 30, width: 690, height: 100 };
    const front = buildFaceplateScene(device, bounds, { face: "front" });
    const rear = buildFaceplateScene(device, bounds, { face: "rear" });
    assert.equal(front.unmappedPorts.length, 0, model);
    assert.equal(rear.ports.length, 0, model);
    assert.deepEqual(rear.hiddenPorts.map((box) => box.port.id), device.ports.map((port) => port.id));
    assert.equal(resolveArubaFaceplate(device), profile, "immutable model geometry is cached");
  }
  assert.equal(resolveArubaFaceplate({}), null);
  assert.equal(resolveArubaFaceplate(deviceFor("CX 6400 family")), null, "untraced modular chassis remain pending");
});

test("6100 and 6200F use opposite optical banks and their documented service connectors", () => {
  for (const count of [24, 48]) {
    const basic = resolveArubaFaceplate(deviceFor(`CX 6100 ${count}G 4SFP+`));
    const stackable = resolveArubaFaceplate(deviceFor(`CX 6200F ${count}G 4SFP+`));
    assert.ok(basic.faces.front.ports.slice(count, count + 4).every((slot) => slot.x < .1));
    assert.ok(stackable.faces.front.ports.slice(count, count + 4).every((slot) => slot.x > .85));
    assert.equal(basic.faces.front.ports[count + 4].connectorKind, "usb-c");
    assert.equal(stackable.faces.front.ports[count + 5].physicalLabel, "MGMT");
    assert.equal(basic.faces.rear.components.filter((part) => part.kind === "fan").length, 0);
    assert.equal(stackable.faces.rear.components.filter((part) => part.kind === "fan").length, 3);
  }
});

test("8325 has three-row SFP28 numbering, two-row QSFP28, six fans and both console connectors", () => {
  const profile = resolveArubaFaceplate(deviceFor("CX 8325-48Y8C"));
  const ports = profile.faces.front.ports;
  assert.equal(new Set(ports.slice(0, 48).map((slot) => slot.y)).size, 3);
  assert.equal(ports[0].x, ports[2].x);
  assert.ok(ports[3].x > ports[2].x);
  assert.deepEqual(ports.slice(0, 6).map((slot) => slot.physicalLabel), ["1", "2", "3", "4", "5", "6"]);
  assert.equal(new Set(ports.slice(48, 56).map((slot) => slot.y)).size, 2);
  assert.equal(ports[56].connectorKind, "console");
  assert.equal(ports[58].connectorKind, "usb-micro");
  assert.equal(profile.faces.rear.components.filter((part) => part.kind === "fan").length, 6);
  assert.equal(profile.faces.rear.components.filter((part) => part.kind === "psu").length, 2);
});

test("6300M JL661A has two JL669B dual-fan trays and two JL086A AC supplies", () => {
  const device = deviceFor("CX 6300M 48G");
  const profile = resolveArubaFaceplate(device);
  assert.equal(profile.sku, "JL661A");
  assert.equal(device.ports.length, 54);
  assert.equal(device.ports[52].type, "USB_C_CONSOLE");
  assert.equal(device.ports[53].label, "MGMT");
  assert.ok(device.ports.slice(0, 48).every((port) => port.type === "RJ45_1G" && port.isPoe));
  assert.ok(profile.faces.front.ports.slice(48, 52).every((port) => port.type === "SFP56_50G" && port.x > .85));
  const rear = profile.faces.rear.components;
  assert.equal(rear.filter((part) => part.kind === "fan" && part.variant === "aruba-dual-hex").length, 2);
  assert.equal(rear.filter((part) => part.kind === "module-bay").length, 0);
  assert.equal(rear.filter((part) => part.kind === "psu").length, 2);
  assert.ok(rear.filter((part) => part.kind === "fan").every((part) => part.x + part.width < .62));
  assert.match(profile.limitations.join(" "), /two fan trays/);
  assert.match(profile.limitations.join(" "), /JL086A.*680W/);
  assert.match(profile.limitations.join(" "), /JL669B/);
});

test("identical selected Aruba SKUs share physical artwork without sharing catalog port indices", () => {
  for (const [exact, alias, serviceIndices] of [
    ["CX 6300M 48G", "CX 6300 family", { CONSOLE: [53, 54], MGMT: [54, 53] }],
    ["CX 8325-48Y8C", "CX 8325 family", { CONSOLE: [57, 59], MGMT: [58, 57], "USB CONSOLE": [59, 58] }],
  ]) {
    const profiles = [exact, alias].map((model) => resolveArubaFaceplate(deviceFor(model)));
    assert.equal(profiles[0].sku, profiles[1].sku);
    for (const face of ["front", "rear"]) {
      assert.deepEqual(profiles[0].faces[face].components, profiles[1].faces[face].components, `${exact} ${face} hardware`);
      const geometry = profiles.map((profile) => Object.fromEntries(profile.faces[face].ports.map((slot) => [slot.physicalLabel,
        { x: slot.x, y: slot.y, width: slot.width, height: slot.height, connectorKind: slot.connectorKind, descriptionAnchor: slot.descriptionAnchor }])));
      assert.deepEqual(geometry[0], geometry[1], `${exact} ${face} physical sockets`);
    }
    for (const [label, indices] of Object.entries(serviceIndices)) {
      assert.deepEqual(profiles.map((profile) => profile.faces.front.ports.find((slot) => slot.physicalLabel === label).portIndex), indices);
    }
    if (profiles[0].sku === "JL624A") {
      assert.equal(profiles[0].faces.rear.components.filter((part) => part.variant === "aruba-8325").length, 6);
      assert.equal(profiles[0].faces.rear.components.filter((part) => part.variant === "aruba-8325-ac").length, 2);
      assert.equal(profiles[0].faces.front.ports.find((slot) => slot.physicalLabel === "MGMT").connectorKind, "rj45-inverted");
    }
  }
});

test("exact JL661A and JL624A drawings never reset saved current settings with generated captions", () => {
  for (const model of ["CX 6300M 48G", "CX 8325-48Y8C"]) {
    for (const sparse of [false, true]) {
      const device = deviceFor(model);
      if (sparse) device.ports = device.ports.filter((port) => port.portIndex !== 17);
      device.ports.reverse();
      for (const port of device.ports) {
        port.speedMbps = 100; port.isPoe = !port.isPoe; port.group = "Saved group";
        port.nativeVlan = 17; port.allowedVlans = [17, 91];
      }
      const before = structuredClone(device);
      assert.equal(upgradeInstalledPhysicalPorts({ devices: [device] }), false, model);
      for (const width of [460, 690]) {
        const scene = buildFaceplateScene(device, { x: 0, y: 0, width, height: 100 });
        assert.equal(scene.ports.length, device.ports.length);
        assert.equal(scene.unmappedPorts.length, 0);
      }
      assert.deepEqual(device, before, `${model}: stored types, speeds, captions and endpoint identities survive`);
      device.faceplate.inventoryRevision = 99;
      const unknown = buildFaceplateScene(device, { x: 0, y: 0, width: 690, height: 100 });
      assert.equal(unknown.ports.length, 0);
      assert.equal(unknown.unmappedPorts.length, device.ports.length);
    }
  }
});

test("historical Aruba console types and renamed endpoint identities survive the catalog corrections", () => {
  for (const model of models) {
    const device = deviceFor(model);
    const profile = resolveArubaFaceplate(device);
    const originalCount = Object.keys(profile.legacyLayouts[0].portIndexMap).length;
    const originalConsole = device.ports[originalCount - 1];
    device.ports = device.ports.slice(0, originalCount);
    originalConsole.type = "Console";
    originalConsole.label = "Operator console name";
    delete device.faceplate.inventoryRevision;
    const original = structuredClone(device);
    assert.equal(upgradeInstalledPhysicalPorts({ devices: [device] }), false);
    const scene = buildFaceplateScene(device, { x: 0, y: 0, width: 690, height: 100 });
    assert.equal(scene.ports.length, originalCount, model);
    assert.equal(scene.unmappedPorts.length, 0, model);
    assert.equal(scene.ports.find((box) => box.port.id === originalConsole.id).displayLabel, "Operator console name");
    assert.deepEqual(device, original, "rendering and refreshing must preserve saved cable endpoints and configuration");
  }
});
