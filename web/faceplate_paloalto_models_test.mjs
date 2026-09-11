import assert from "node:assert/strict";
import test from "node:test";
import { hardwareCatalog, instantiateProfile, upgradeInstalledPhysicalPorts } from "./static/js/catalog.js";
import { buildPaloAltoModelFaceplate } from "./static/js/faceplate-paloalto-models.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";

/** Build an individual Palo Alto model from its immutable catalog entry. */
function model(name) {
  return buildPaloAltoModelFaceplate(instantiateProfile(hardwareCatalog.find((entry) => entry.vendor === "Palo Alto"
    && entry.model === name), name, { x: 0, y: 0 }));
}

for (const name of ["PA-220", "PA-440", "PA-450", "PA-460", "PA-850"]) {
  const profile = model(name);
  assert.equal(profile.fidelity, "model");
  assert.deepEqual(profile.evidence.models, [name]);
  assert.match(profile.evidence.front, /-front-panel$/);
  assert.match(profile.evidence.rear, /-back-panel$/);
  assert.equal(profile.faces.rear.ports.length, 0);
  const first = profile.faces.front.ports.find((port) => port.label === "ethernet1/1");
  const second = profile.faces.front.ports.find((port) => port.label === "ethernet1/2");
  assert.equal(first.x, second.x);
  assert.ok(first.y < second.y, `${name} labels odd-numbered network ports above even ones`);
  const portal = profile.faces.rear.connectionMarker;
  assert.ok(portal, "opposite-panel marker has an explicitly reserved region");
  for (const part of profile.faces.rear.components) {
    assert.ok(portal.x + portal.width <= part.x || part.x + part.width <= portal.x
      || portal.y + portal.height <= part.y || part.y + part.height <= portal.y,
    `${name}: routing marker cannot cover ${part.kind}`);
  }
}
const p220 = model("PA-220");
assert.equal(p220.faces.front.components.filter((part) => part.kind === "led").length, 5);
assert.equal(p220.faces.front.ports.find((port) => port.label === "MGT").x,
  p220.faces.front.ports.find((port) => port.label === "CONSOLE").x, "220 management and RJ45 console are stacked");
for (const name of ["PA-440", "PA-450", "PA-460"]) {
  const profile = model(name);
  assert.match(profile.evidence.sharedChassis, /identical/);
  assert.equal(profile.faces.front.components.filter((part) => part.kind === "led").length, 6);
  assert.equal(profile.faces.front.components.filter((part) => part.kind === "usb").length, 2);
  const rearPowerLEDs = profile.faces.rear.components.filter((part) => part.kind === "led" && part.role === "power-status");
  assert.equal(rearPowerLEDs.length, 2, "the official shared rear panel shows a status lens beside each DC input");
  for (const [index, inlet] of profile.faces.rear.components.filter((part) => part.kind === "power").entries()) {
    assert.ok(rearPowerLEDs[index].x > inlet.x + inlet.width, "each PWR lens is beside its inlet, not inside the power connector");
  }
  assert.equal(profile.faces.front.components.filter((part) => part.kind === "console").length, 1);
  assert.ok(profile.catalogDiscrepancies.some((note) => note.includes("RJ45 CONSOLE")));
  assert.equal(profile.faces.front.ports.filter((port) => port.type === "Console").length, 0,
    "an omitted catalog connector must not be invented as routable inventory");
  assert.deepEqual(profile.faces.front.ports, model("PA-440").faces.front.ports,
    "the manufacturer explicitly confirms identical panel geometry for these three models");
}
const p850 = model("PA-850");
assert.equal(p850.faces.rear.components.filter((part) => part.kind === "psu").length, 2);
assert.equal(p850.faces.rear.components.filter((part) => part.kind === "fan").length, 3);
assert.ok(p850.faces.rear.components.filter((part) => part.kind === "psu").every((part) => part.x < .26));
assert.ok(p850.faces.rear.components.filter((part) => part.kind === "fan").every((part) => part.x > .6));
assert.equal(p850.faces.front.ports.filter((port) => port.type === "SFP_PLUS_10G").length, 4);
assert.equal(p850.faces.front.ports.find((port) => port.label === "HA1").x,
  p850.faces.front.ports.find((port) => port.label === "HA2").x);
assert.equal(buildPaloAltoModelFaceplate({ model: "PA-440 / PA-450" }), null);
assert.equal(buildPaloAltoModelFaceplate({ model: "PA-440", faceplate: { vendor: "Other" } }), null);
assert.equal(buildPaloAltoModelFaceplate({ model: "PA-441" }), null);

test("the PA-440 / PA-450 alias uses manufacturer-confirmed identical panels and appends the missing console", () => {
  const alias = model("PA-440 / PA-450");
  assert.equal(alias.fidelity, "model");
  assert.equal(alias.inventoryComplete, true);
  assert.equal(alias.sku, "PA-440 / PA-450 (identical panels)");
  assert.deepEqual(alias.evidence.models, ["PA-440", "PA-450"]);
  assert.match(alias.evidence.sharedChassis, /identical/);
  assert.equal(alias.faces.front.ports.length, 11);
  assert.equal(alias.faces.front.ports.find((slot) => slot.type === "Console").portIndex, 11);
  assert.equal(alias.faces.front.components.filter((part) => part.kind === "console").length, 0);
  assert.deepEqual(alias.faces.rear.components, model("PA-440").faces.rear.components);
  const device = instantiateProfile(hardwareCatalog.find((entry) => entry.model === "PA-440 / PA-450"), "Saved firewall", { x: 0, y: 0 });
  assert.equal(device.faceplate.inventoryRevision, 1);
  delete device.faceplate.inventoryRevision;
  device.ports = device.ports.slice(0, 10).filter((port) => port.portIndex !== 4).reverse();
  device.ports.forEach((port) => { port.id = `saved-${port.portIndex}`; port.label = "Operator label"; port.allowedVlans = [107]; });
  const before = structuredClone(device);
  const scene = buildFaceplateScene(device, { x: 0, y: 0, width: 690, height: 100 });
  assert.equal(scene.unmappedPorts.length, 0);
  assert.deepEqual(scene.ports.map((box) => box.port.id), device.ports.map((port) => port.id));
  assert.ok(scene.ports.every((box) => box.displayLabel === "Operator label"));
  assert.deepEqual(device, before);
  device.faceplate.inventoryRevision = 99;
  assert.equal(buildFaceplateScene(device, { x: 0, y: 0, width: 690, height: 100 }).unmappedPorts.length, device.ports.length);
});

/** Rebuild each pre-revision PA-1400 inventory rather than deriving it from the replacement. */
function device1400(name, legacy = false) {
  let catalog = hardwareCatalog.find((entry) => entry.vendor === "Palo Alto" && entry.model === name);
  const family = name === "PA-1400 family";
  if (legacy) catalog = { ...catalog, units: family ? 2 : 1, inventoryRevision: 0, groups: [
    { zone: "access", count: family ? 16 : 12, type: "RJ45_1G", speed: 1000, poe: false },
    { zone: "uplink", count: family ? 8 : 4, type: family ? "SFP28_25G" : "SFP_PLUS_10G", speed: family ? 25000 : 10000, poe: false },
    ...(family ? [{ zone: "management", count: 2, type: "RJ45_1G", speed: 1000, prefix: "MGMT", poe: false }] : []),
    { zone: "management", count: family ? 1 : 2, type: "Console", speed: 0, prefix: "CONSOLE", poe: false },
  ] };
  const device = instantiateProfile(catalog, name, { x: 10, y: 20 });
  device.id = name;
  device.ports.forEach((port) => { port.id = `saved-${port.portIndex}`; });
  return device;
}

for (const name of ["PA-1400 family", "PA-1410 / PA-1420"]) {
  test(`${name} explicitly selects the PA-1410 with its 28 real connectors and dual AC rear`, () => {
    const device = device1400(name);
    const profile = model(name);
    assert.ok(profile, "the selected PA-1410 requires its own traced model profile");
    assert.equal(profile.fidelity, "model");
    assert.equal(profile.inventoryComplete, true);
    assert.equal(profile.inventoryRevision, 1);
    assert.equal(device.faceplate.inventoryRevision, 1);
    assert.equal(device.faceplate.unitsU, 1);
    assert.equal(profile.sku, "PA-1410 · dual AC power supplies");
    assert.deepEqual(profile.evidence.models, ["PA-1410"]);
    assert.equal(profile.evidence.catalogAlias, name);
    assert.equal(profile.evidence.selectedModel, "PA-1410");
    assert.equal(new URL(profile.source).hostname, "docs.paloaltonetworks.com");
    assert.match(profile.evidence.configuration, /PS1.*PS2/);
    assert.equal(profile.faces.front.ports.length, 28);
    assert.equal(profile.faces.rear.ports.length, 0);
    assert.deepEqual(device.ports.map((port) => [port.type, port.speedMbps, port.isPoe]), [
      ...Array.from({ length: 8 }, () => ["RJ45_1G", 1000, false]),
      ...Array.from({ length: 4 }, () => ["RJ45_MGIG", 5000, true]),
      ...Array.from({ length: 6 }, () => ["SFP_1G", 1000, false]),
      ...Array.from({ length: 4 }, () => ["SFP_PLUS_10G", 10000, false]),
      ["SFP_PLUS_10G", 10000, false], ...Array.from({ length: 3 }, () => ["RJ45_1G", 1000, false]),
      ["Console", 0, false], ["USB_MICRO_CONSOLE", 0, false],
    ]);
    assert.deepEqual(profile.faces.front.ports.slice(22).map((slot) => slot.physicalLabel),
      ["HSCI", "HA1-A", "HA1-B", "MGT", "CONSOLE", "MICRO-USB"]);
    const front = profile.faces.front;
    for (let index = 0; index < 22; index += 2) {
      assert.equal(front.ports[index].x, front.ports[index + 1].x);
      assert.ok(front.ports[index].y < front.ports[index + 1].y, "each physical pair has odd above even");
    }
    const gap8 = front.ports[8].x - front.ports[6].x;
    const gap6 = front.ports[6].x - front.ports[4].x;
    assert.ok(gap8 > gap6, "the 9–12 multigig block has its own physical separation");
    assert.ok(front.components.some((part) => part.kind === "text" && part.label === "PA-1410"));
    assert.ok(!front.components.some((part) => part.label === "PA-1420"));
    const status = front.components.filter((part) => part.role?.startsWith("status-"));
    assert.equal(status.length, 9);
    assert.ok(status.every((part) => part.color === "#42d98b"), "powered PA status lenses use the documented green, independent of template accent");
    assert.deepEqual(status.filter((part) => !part.active).map((part) => part.role).sort(), ["status-alarm", "status-ha", "status-service"]);
    const rear = profile.faces.rear.components;
    assert.deepEqual(rear.filter((part) => part.kind === "psu").map((part) => [part.role, part.variant]),
      [["PS2", "pa-1400-ac"], ["PS1", "pa-1400-ac"]]);
    assert.equal(rear.filter((part) => part.role === "fixed-fan-grille")[0].fanCount, 5);
    assert.equal(rear.filter((part) => part.kind === "fan").length, 0, "the reference exposes a grille, not five visible fan disks");
    assert.equal(rear.find((part) => part.role === "ground")?.kind, "screw", "the grounding stud must not appear as an illuminated pushbutton");
    assert.deepEqual(rear.filter((part) => part.kind === "text").map((part) => part.label), ["ASSY REV", "SERIAL", "CLAIM"]);
  });

  test(`${name} conservatively preserves its distinct old identities and ambiguous service endpoints`, () => {
    const device = device1400(name, true);
    const family = name === "PA-1400 family";
    const mapped = family ? [...Array.from({ length: 12 }, (_, index) => index + 1), 17, 18, 19, 20, 21, 22, 27]
      : Array.from({ length: 16 }, (_, index) => index + 1);
    const unmapped = family ? [13, 14, 15, 16, 23, 24, 25, 26] : [17, 18];
    delete device.faceplate.inventoryRevision;
    device.rackId = "existing-rack";
    device.rackPosition = 11;
    device.ports.reverse();
    for (const port of device.ports) { port.allowedVlans = [18, 81]; port.nativeVlan = 18; }
    device.ports.find((port) => port.portIndex === 9).label = "Operator trunk";
    device.ports.find((port) => port.portIndex === 17).label = "Operator seventeen";
    if (family) {
      device.ports.find((port) => port.portIndex === 25).label = "MGT";
      device.ports.find((port) => port.portIndex === 27).label = "Terminal";
    }
    const before = structuredClone(device);
    assert.equal(upgradeInstalledPhysicalPorts({ devices: [device] }), false);
    const bounds = { x: 0, y: 0, width: 690, height: family ? 200 : 100 };
    const scene = buildFaceplateScene(device, bounds);
    assert.deepEqual(scene.ports.map((box) => box.port.portIndex), mapped.toReversed());
    assert.deepEqual(scene.unmappedPorts.map((port) => port.portIndex), unmapped.toReversed());
    assert.equal(scene.ports.find((box) => box.port.portIndex === 9).displayLabel, "Operator trunk");
    assert.equal(scene.ports.find((box) => box.port.portIndex === 1).displayLabel, "1");
    if (family) assert.equal(scene.ports.find((box) => box.port.portIndex === 27).displayLabel, "Terminal");
    const current = buildFaceplateScene(device1400(name), bounds);
    for (const index of mapped) {
      const old = scene.ports.find((box) => box.port.portIndex === index);
      const fresh = current.ports.find((box) => box.port.portIndex === index);
      assert.deepEqual([old.centerX, old.centerY, old.connectorKind], [fresh.centerX, fresh.centerY, fresh.connectorKind]);
    }
    assert.deepEqual(device, before, "rendering must retain speed, PoE, IDs, labels, VLANs and saved rack height");
    assert.equal(buildFaceplateScene(device, bounds, { face: "rear" }).hiddenPorts.length, device.ports.length);
    device.ports = device.ports.filter((port) => port.portIndex !== 2);
    assert.equal(buildFaceplateScene(device, bounds).ports.length, mapped.length - 1, "gaps do not reassign physical indices");
    device.faceplate.inventoryRevision = 99;
    const unknown = buildFaceplateScene(device, bounds);
    assert.equal(unknown.ports.length, 0);
    assert.equal(unknown.unmappedPorts.length, device.ports.length);
  });
}

/** Compare rendered caption and hardware rectangles, allowing shared edges. */
function overlaps1400(a, b) {
  return a.x < b.x + b.width - 1e-6 && a.x + a.width > b.x + 1e-6
    && a.y < b.y + b.height - 1e-6 && a.y + a.height > b.y + 1e-6;
}

test("PA-1410 anchored captions clear all sockets and ancillary hardware at compact and rack widths", () => {
  for (const name of ["PA-1400 family", "PA-1410 / PA-1420"]) for (const width of [460, 690]) {
    const device = device1400(name);
    const scene = buildFaceplateScene(device, { x: 10, y: 40, width, height: 100 });
    assert.equal(scene.unmappedPorts.length, 0);
    for (const port of scene.ports) {
      const label = port.labelPlacement;
      const captionWidth = Math.min(label.boxMaxWidth, Math.max(12, Math.min(label.maxWidth, port.displayLabel.length * label.fontSize) + 6));
      const caption = { x: label.x - captionWidth / 2, y: label.y - label.boxHeight / 2, width: captionWidth, height: label.boxHeight };
      assert.ok(caption.x >= scene.chassis.x && caption.x + caption.width <= scene.chassis.x + scene.chassis.width);
      assert.ok(caption.y >= scene.chassis.y && caption.y + caption.height <= scene.chassis.y + scene.chassis.height);
      for (const hardware of [...scene.ports, ...scene.components.filter((part) => !part.applicationOverlay)]) {
        assert.ok(!overlaps1400(caption, hardware), `${name} ${port.displayLabel} caption overlaps ${hardware.displayLabel || hardware.role || hardware.kind}`);
      }
    }
  }
});
