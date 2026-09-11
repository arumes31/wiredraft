import assert from "node:assert/strict";
import test from "node:test";
import { hardwareCatalog, instantiateProfile, upgradeInstalledPhysicalPorts } from "./static/js/catalog.js";
import { canonicalFaceplateDevice, layoutPanelPorts } from "./static/js/faceplate-profile.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";

test("catalog refresh preserves historical inventory and unknown revisions remain routable", () => {
  const profile = hardwareCatalog.find((item) => item.model === "Secure Firewall 1010");
  const device = instantiateProfile(profile, "Old firewall", { x: 0, y: 0 });
  assert.equal(device.faceplate.inventoryRevision, 1);
  delete device.faceplate.inventoryRevision;
  device.ports[0].label = "PORT1";
  const original = structuredClone(device);
  assert.equal(upgradeInstalledPhysicalPorts({ devices: [device] }), false);
  assert.deepEqual(device, original, "catalog refresh must not rewrite an older index namespace");
  device.faceplate.inventoryRevision = 2;
  const scene = buildFaceplateScene(device, { x: 0, y: 0, width: 690, height: 100 });
  assert.equal(scene.ports.length, 0, "unknown revisions must not guess physical socket identities");
  assert.deepEqual(scene.unmappedPorts, device.ports);
  assert.deepEqual(scene.hiddenPorts.map((box) => box.port), device.ports);
});

test("catalog refresh matches reordered saved ports by unique stable index", () => {
  const profile = hardwareCatalog.find((item) => item.model === "Secure Firewall 1010");
  const device = instantiateProfile(profile, "Reordered firewall", { x: 0, y: 0 });
  [device.ports[0], device.ports[1]] = [device.ports[1], device.ports[0]];
  const reordered = structuredClone(device);
  assert.equal(upgradeInstalledPhysicalPorts({ devices: [device] }), false);
  assert.deepEqual(device, reordered, "default names and configuration belong to stable indices, not array order");
  device.ports[0].portIndex = device.ports[1].portIndex;
  device.ports[0].label = "PORT2";
  device.ports[1].label = "PORT1";
  device.ports[2].portIndex = 500;
  device.ports[2].label = "PORT3";
  const ambiguous = structuredClone(device);
  assert.equal(upgradeInstalledPhysicalPorts({ devices: [device] }), false);
  assert.deepEqual(device, ambiguous, "duplicate and unknown indices must not be guessed during refresh");
});

test("canonical panels reuse catalog geometry while keeping edited device data separate", () => {
  const profile = hardwareCatalog.find((item) => item.model === "UniFi Standard 24");
  const device = instantiateProfile(profile, "Edited name", { x: 23, y: 87 });
  device.ports[0].label = "Renamed uplink";
  const canonical = canonicalFaceplateDevice(device);
  assert.equal(canonical.device.ports[0].label, "1");
  assert.equal(canonicalFaceplateDevice(device), canonical);
  assert.notEqual(canonical.device, device);
  assert.throws(() => { canonical.device.ports[0].label = "mutated"; }, TypeError);
  assert.equal(canonicalFaceplateDevice({ ...device, faceplate: { vendor: "Other" } }), null);
  assert.equal(canonicalFaceplateDevice({}), null);
});

test("grouped panel layouts fit every catalog inventory without overlapping sockets", () => {
  const rect = { x: .2, y: .2, width: .76, height: .6 };
  for (const profile of hardwareCatalog) {
    const device = instantiateProfile(profile, profile.model, { x: 0, y: 0 });
    const slots = layoutPanelPorts(device.ports, rect);
    assert.equal(slots.length, device.ports.length, profile.model);
    assert.deepEqual(slots.map((slot) => slot.portIndex), device.ports.map((port) => port.portIndex));
    for (const slot of slots) {
      assert.ok(slot.width > 0 && slot.height > 0);
      assert.ok(slot.x - slot.width / 2 >= rect.x - 1e-9 && slot.x + slot.width / 2 <= rect.x + rect.width + 1e-9, profile.model);
      assert.ok(slot.y - slot.height / 2 >= rect.y && slot.y + slot.height / 2 <= rect.y + rect.height, profile.model);
    }
    for (let index = 0; index < slots.length; index++) {
      for (const other of slots.slice(index + 1)) {
        const slot = slots[index];
        assert.ok(Math.abs(slot.x - other.x) >= (slot.width + other.width) / 2 ||
          Math.abs(slot.y - other.y) >= (slot.height + other.height) / 2, `${profile.model} overlapping sockets`);
      }
    }
  }
  assert.deepEqual(layoutPanelPorts([]), []);
  assert.equal(layoutPanelPorts([{ portIndex: 1, label: "only", type: "Console" }], rect, { rows: 0 })[0].y, .5);
});
