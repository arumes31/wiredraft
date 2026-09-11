import assert from "node:assert/strict";
import { test } from "node:test";
import { hardwareCatalog, instantiateProfile, upgradeInstalledPhysicalPorts } from "./static/js/catalog.js";
import { resolveArubaChassisFaceplate } from "./static/js/faceplate-aruba-chassis.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";
import { hardwarePrimitives, hardwareComponentSVG } from "./static/js/hardware-components.js";

/** Reconstruct historical59-endpoint modular placeholders with the actual catalog constructor. */
function deviceFor(model, old = false) {
  let row = hardwareCatalog.find((item) => item.vendor === "HPE Aruba" && item.model === model);
  if (old) row = { ...row, units: 4, inventoryRevision: 0, groups: [
    { zone: "uplink", count: 48, type: "SFP28_25G", speed: 25000, prefix: "SFP28" },
    { zone: "uplink", count: 8, type: "QSFP_DD_400G", speed: 400000, prefix: "QSFP-DD" },
    { zone: "management", count: 2, type: "RJ45_1G", speed: 1000, prefix: "MGMT" },
    { zone: "management", count: 1, type: "USB_C_CONSOLE", speed: 0, prefix: "CONSOLE" },
  ] };
  const device = instantiateProfile(row, model, { x: 31, y: 87 }); device.id = "saved-chassis";
  for (const port of device.ports) { port.id = `saved-${port.portIndex}`; port.deviceId = device.id; }
  return device;
}

/** Exercise the real scene resolver with the saved allocation and supported rack width. */
function sceneFor(device, width = 690, face = "front") {
  return buildFaceplateScene(device, { x: 0, y: 0, width, height: device.faceplate.unitsU * 100 }, { face });
}

/** Determine whether two strict bounding rectangles overlap rather than merely touching. */
function overlaps(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

for (const [model, sku, units, count] of [["CX 6400 family", "R0X26A", 7, 51], ["CX 8400 family", "JL376A", 8, 43]]) {
  test(`${model} selects its specific installed cards, service ports, blank slots and rear cooling`, () => {
    const device = deviceFor(model); const profile = resolveArubaChassisFaceplate(device);
    assert.equal(profile.sku, sku); assert.equal(profile.fidelity, "model"); assert.equal(profile.inventoryComplete, true);
    assert.equal(profile.rearHardwareVerified, true); assert.equal(device.faceplate.unitsU, units); assert.equal(device.ports.length, count);
    assert.equal(hardwareCatalog.find((row) => row.model === model).preserveInstalledPorts, true);
    assert.equal(sceneFor(device).ports.length, count); assert.equal(sceneFor(device).unmappedPorts.length, 0);
    assert.equal(sceneFor(device, 690, "rear").ports.length, 0);
    const rear = profile.faces.rear.components;
    assert.equal(rear.filter((part) => part.kind === "psu").length, 0, "supplies are behind the front bezel");
    if (units === 7) {
      assert.match(profile.evidence.configuration, /R0X44A/); assert.match(profile.evidence.configuration, /R0X36A/);
      assert.equal(rear.filter((part) => part.variant === "aruba-6405-fan-tray").length, 2);
      assert.equal(rear.filter((part) => part.variant === "aruba-6405-inlet").length, 2);
      assert.equal(profile.faces.front.components.filter((part) => part.variant === "aruba-chassis-blank").length, 5);
      const ports = sceneFor(device).ports;
      for (let i = 0; i < 48; i += 2) { assert.equal(ports[i].centerX, ports[i + 1].centerX); assert.ok(ports[i].centerY < ports[i + 1].centerY); }
    } else {
      assert.match(profile.evidence.configuration, /JL363A/); assert.match(profile.evidence.configuration, /JL365A/);
      assert.equal(rear.filter((part) => part.variant === "aruba-8400-fan").length, 18);
      assert.equal(rear.filter((part) => part.variant === "aruba-8400-inlet").length, 4);
      assert.equal(profile.faces.front.components.filter((part) => part.variant === "aruba-chassis-blank").length, 7);
      const ports = sceneFor(device).ports;
      assert.equal(ports.filter((port) => port.connectorKind === "sfp-vertical").length, 32);
      assert.equal(ports.filter((port) => port.connectorKind === "qsfp-vertical").length, 8);
      assert.equal(ports[0].centerY, ports[1].centerY); assert.ok(ports[0].centerX < ports[1].centerX);
    }
  });

  test(`${model} preserves historical identities, edits, cables and sparse inventories in the original4U allocation`, () => {
    const old = deviceFor(model, true); delete old.faceplate.inventoryRevision; old.ports.reverse();
    for (const port of old.ports) { port.label = "edited"; port.speedMbps = 100; port.nativeVlan = 123; port.allowedVlans = [123,456]; port.isPoe = true; port.group = "Custom"; }
    const topology = { devices: [old], links: [{ id: "retained-wire", sourcePortId: "saved-59", targetPortId: "peer" }],
      racks: [{ id: "rack", units: 42, devices: [{ deviceId: old.id, startUnit: 7, units: 4 }] }] };
    const before = structuredClone(topology); assert.equal(upgradeInstalledPhysicalPorts(topology), false);
    const scene = sceneFor(old); const fresh = sceneFor(deviceFor(model));
    assert.deepEqual(topology, before); assert.equal(scene.ports.length, units === 7 ? 50 : 42);
    const unmapped = units === 7 ? [49,50,51,52,53,54,55,56,58] : [...Array.from({ length: 16 }, (_, i) => i + 33),58];
    assert.deepEqual(scene.unmappedPorts.map((port) => port.portIndex).sort((a,b) => a-b), unmapped);
    assert.ok(Math.abs(scene.chassis.width / fresh.chassis.width - scene.chassis.height / fresh.chassis.height) < 1e-10, "physical body keeps its proportions");
    assert.ok(scene.chassis.y + scene.chassis.height <= 400); assert.equal(old.faceplate.unitsU, 4);
    assert.equal(scene.ports.find((slot) => slot.port.portIndex === 59).port.id, "saved-59");
    old.ports = old.ports.filter((port) => [1,32,48,49,57,58,59].includes(port.portIndex));
    assert.deepEqual(sceneFor(old).ports.map((slot) => slot.port.portIndex).sort((a,b) => a-b), units === 7 ? [1,32,48,57,59] : [1,32,49,57,59]);
    old.faceplate.inventoryRevision = 77;
    assert.equal(sceneFor(old).ports.length, 0); assert.equal(sceneFor(old).unmappedPorts.length, 7);
  });

  test(`${model} captions and sockets are bounded and separated at460 and690`, () => {
    for (const width of [460,690]) {
      const scene = sceneFor(deviceFor(model), width); const captions = [];
      for (const port of scene.ports) {
        assert.ok(port.x >= scene.chassis.x && port.x + port.width <= scene.chassis.x + scene.chassis.width);
        assert.ok(port.y >= scene.chassis.y && port.y + port.height <= scene.chassis.y + scene.chassis.height);
        const p = port.labelPlacement; const captionWidth = Math.min(p.boxMaxWidth, port.displayLabel.length * p.fontSize * .7 + 6);
        const box = { x: p.x - captionWidth / 2, y: p.y - p.boxHeight / 2, width: captionWidth, height: p.boxHeight };
        for (const other of [...captions, ...scene.ports, ...scene.components.filter((part) => !part.applicationOverlay)])
          assert.ok(!overlaps(box, other), `${width}: ${port.displayLabel} overlaps ${other.kind || other.displayLabel || "caption"}`);
        captions.push(box);
      }
    }
  });
}

test("Aruba modular rear guards and portrait cages serialize the same bounded primitives for Canvas and SVG", () => {
  for (const component of [
    { kind: "fan", variant: "aruba-6405-fan-tray", width: 440, height: 90 },
    { kind: "fan", variant: "aruba-8400-fan", width: 60, height: 72 },
    { kind: "sfp-vertical", width: 8, height: 16 }, { kind: "qsfp-vertical", width: 10, height: 20 },
  ]) {
    const part = { ...component, x: 13, y: 21 }; const primitives = hardwarePrimitives(part);
    assert.ok(primitives.length > 5); assert.ok(!hardwareComponentSVG(part).includes("NaN"));
    assert.ok(primitives.every((item) => item.fill !== "none"), "Canvas requires a CSS color for transparent fan-guard fills");
    if (part.kind === "fan") assert.ok(primitives.some((item) => item.kind === "polygon" && item.points.length === 6));
    for (const primitive of primitives.filter((item) => item.kind === "polygon")) for (const [x,y] of primitive.points)
      assert.ok(x >= part.x && x <= part.x + part.width && y >= part.y && y <= part.y + part.height);
  }
});

test("8400 long saved labels fit the reserved local card caption width without changing endpoint data", () => {
  for (const width of [460,690]) {
    const old = deviceFor("CX 8400 family", true);
    old.ports = old.ports.filter((port) => [49,55,57,59].includes(port.portIndex)).reverse();
    for (const port of old.ports) port.label = "Customer edited port label with a long description";
    const before = structuredClone(old); const scene = sceneFor(old, width);
    const layout = resolveArubaChassisFaceplate(old);
    for (const port of scene.ports) {
      const index = layout.legacyLayouts[0].portIndexMap[port.port.portIndex];
      const slot = layout.faces.front.ports.find((candidate) => candidate.portIndex === index);
      const cap = slot.descriptionAnchor.boxWidth * scene.chassis.width;
      assert.ok(port.labelPlacement.boxMaxWidth <= cap + 1e-8, "the normalized local caption cap must reach the actual scene");
      const p = port.labelPlacement;
      const box = { x: p.x - p.boxMaxWidth / 2, y: p.y - p.boxHeight / 2, width: p.boxMaxWidth, height: p.boxHeight };
      for (const other of scene.ports) assert.ok(!overlaps(box, other), "long saved captions stay clear of physical sockets");
      assert.equal(port.displayLabel, before.ports.find((candidate) => candidate.id === port.port.id).label);
    }
    assert.deepEqual(old, before);
  }
});
