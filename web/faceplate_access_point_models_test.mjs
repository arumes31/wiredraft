import assert from "node:assert/strict";
import test from "node:test";
import { hardwareCatalog, instantiateProfile } from "./static/js/catalog.js";
import { resolveAccessPointFaceplate } from "./static/js/faceplate-access-point-models.js";
import { buildFaceplateScene, faceplateDisplaySize } from "./static/js/faceplate-scene.js";
import { resolveModelFaceplate } from "./static/js/faceplate-models.js";
import { buildSVGDocument } from "./static/js/export.js";

/** Instantiate the exact AP-635 catalog entry with an independent inventory. */
function fixture() {
  return instantiateProfile(hardwareCatalog.find((item) => item.vendor === "HPE Aruba" && item.model === "AP-635"), "AP-635", { x: 0, y: 0 });
}

test("AP-635 traces square front indicators and the actual underside Ethernet/service positions", () => {
  const device = fixture();
  const profile = resolveAccessPointFaceplate(device);
  assert.equal(profile.sku, "AP-635");
  assert.equal(profile.fidelity, "model");
  assert.equal(profile.defaultFace, "rear");
  assert.equal(profile.chassis.shape, "square");
  assert.match(profile.evidence.front, /#page=6$/);
  assert.match(profile.evidence.rear, /#page=9$/);
  assert.equal(profile.faces.front.ports.length, 0);
  assert.equal(profile.faces.front.components.filter((part) => part.kind === "led").length, 4);
  const [e0, e1, console] = profile.faces.rear.ports;
  assert.deepEqual([e0.portIndex, e1.portIndex, console.portIndex], [1, 2, 3]);
  assert.deepEqual([e0.type, e1.type, console.type], ["RJ45_MGIG", "RJ45_MGIG", "USB_MICRO_CONSOLE"]);
  assert.ok(e0.x < e1.x && e0.y > e1.y, "Ethernet ports follow the underside's diagonal edge");
  assert.ok(console.y < .2 && console.x > .4 && console.x < .6);
  assert.ok(profile.faces.rear.components.some((part) => part.kind === "power" && part.variant === "dc-barrel"));
  assert.equal(profile.faces.rear.components.filter((part) => part.kind === "usb").length, 1, "USB host is artwork, console is a typed endpoint");
  const before = JSON.stringify(profile);
  device.ports.reverse();
  device.ports[0].label = "Installer console";
  assert.equal(resolveAccessPointFaceplate(device), profile);
  assert.equal(JSON.stringify(profile), before);
});

test("AP-635 front/rear projection preserves saved two-port inventories and custom labels", () => {
  const device = fixture();
  device.ports = device.ports.slice(0, 2);
  device.ports[1].label = "Backup uplink";
  const before = structuredClone(device);
  const bounds = { x: 10, y: 15, width: 450, height: 250 };
  const rear = buildFaceplateScene(device, bounds, { face: "rear" });
  const front = buildFaceplateScene(device, bounds, { face: "front" });
  assert.equal(rear.chassis.width, rear.chassis.height);
  assert.deepEqual(rear.ports.map((slot) => slot.port.id), device.ports.map((port) => port.id));
  assert.equal(rear.ports[1].displayLabel, "Backup uplink");
  assert.equal(rear.unmappedPorts.length, 0);
  assert.equal(front.ports.length, 0);
  assert.equal(front.hiddenPorts.length, 2);
  assert.deepEqual(device, before);
});

test("access-point tracing refuses other vendors and untraced model suffixes", () => {
  assert.equal(resolveAccessPointFaceplate({}), null);
  assert.equal(resolveAccessPointFaceplate({ model: "AP-635", faceplate: { vendor: "Cisco" } }), null);
  assert.equal(resolveAccessPointFaceplate({ model: "AP-635A", faceplate: { vendor: "HPE Aruba" } }), null);
  assert.equal(resolveAccessPointFaceplate({ model: "Catalyst 9166D1", faceplate: { vendor: "Cisco" } }), null);
  assert.equal(resolveAccessPointFaceplate({ model: "Catalyst 9166I", faceplate: { vendor: "HPE Aruba" } }), null);
});

/** Reconstruct the pre-trace CW9166I inventory independently to guard saved topology identities. */
function ciscoFixture() {
  return instantiateProfile({ vendor: "Cisco", model: "Catalyst 9166I", category: "AccessPoint", units: 1, color: "#e5e8e7",
    groups: [
      { zone: "access", count: 1, type: "RJ45_MGIG", speed: 5000, labels: ["2.5/5G PoE"], prefix: "", poe: false },
      { zone: "management", count: 1, type: "Console", speed: 0, labels: ["CONSOLE"], prefix: "", poe: false },
    ],
  }, "Existing ceiling AP", { x: 0, y: 0 });
}

test("CW9166I traces the individual cover and recessed underside without adding network interfaces", () => {
  const device = ciscoFixture();
  const profile = resolveModelFaceplate(device);
  assert.equal(profile, resolveAccessPointFaceplate(device), "public registry selects the exact AP override");
  assert.equal(profile.sku, "CW9166I");
  assert.equal(profile.fidelity, "model");
  assert.equal(profile.defaultFace, "rear");
  assert.equal(profile.chassis.shape, "square");
  assert.deepEqual(profile.panelFidelity, { front: "model", rear: "model" });
  assert.match(profile.evidence.front, /357830\.jpg$/);
  assert.match(profile.evidence.rear, /357831\.jpg$/);
  assert.match(profile.limitations.join(" "), /vertical connector wall is shown face-on/);
  const current = instantiateProfile(hardwareCatalog.find((item) => item.vendor === "Cisco" && item.model === "Catalyst 9166I"),
    "New ceiling AP", { x: 0, y: 0 });
  const inventory = (ports) => ports.map(({ portIndex, type, speedMbps, label, isPoe }) => ({ portIndex, type, speedMbps, label, isPoe }));
  assert.deepEqual(inventory(current.ports), inventory(device.ports));
  assert.equal(profile.faces.front.ports.length, 0);
  assert.deepEqual(profile.faces.rear.ports.map(({ portIndex, connectorKind }) => [portIndex, connectorKind]), [[1, "rj45"], [2, "console"]]);
  const [ethernet, console] = profile.faces.rear.ports;
  assert.ok(console.x < ethernet.x && console.y === ethernet.y, "console is left of Ethernet on the recessed wall");
  const parts = profile.faces.rear.components;
  const power = parts.find((part) => part.role === "54VDC");
  assert.ok(power.x > ethernet.x + ethernet.width / 2);
  assert.equal(power.variant, "dc-barrel");
  assert.equal(parts.filter((part) => part.role === "mounting-foot").length, 4);
  assert.equal(parts.filter((part) => part.role === "environment-sensor").length, 2);
  assert.equal(parts.filter((part) => part.role === "usb-host").length, 1);
  assert.equal(parts.filter((part) => ["psu", "fan"].includes(part.kind)).length, 0);
  assert.equal(profile.faces.front.components.filter((part) => part.kind === "led").length, 1);
});

test("CW9166I saved reordered and gapped inventories retain IDs, custom labels and VLAN settings", () => {
  for (const retained of [[1, 2], [1], [2]]) {
    const device = ciscoFixture();
    device.ports = device.ports.filter((port) => retained.includes(port.portIndex)).reverse();
    for (const port of device.ports) Object.assign(port, { label: `Installed ${port.portIndex}`, vlanId: "customer-vlan", nativeVlan: 207 });
    const original = structuredClone(device);
    const bounds = { x: 14, y: 19, ...faceplateDisplaySize(device) };
    const rear = buildFaceplateScene(device, bounds, { face: "rear" });
    const front = buildFaceplateScene(device, bounds, { face: "front" });
    assert.deepEqual(rear.ports.map((box) => box.port.id), device.ports.map((port) => port.id));
    assert.deepEqual(rear.ports.map((box) => box.displayLabel), device.ports.map((port) => port.label));
    assert.equal(rear.unmappedPorts.length, 0);
    assert.equal(front.hiddenPorts.length, retained.length);
    assert.equal(front.ports.length, 0);
    assert.deepEqual(device, original);
  }
});

test("CW9166I square scenes stay bounded and export the same two rear socket identities", () => {
  const device = ciscoFixture();
  for (const mounted of [false, true]) {
    const dimensions = faceplateDisplaySize(device, { mounted });
    assert.equal(dimensions.height, mounted ? 100 : 345);
    const bounds = { x: 0, y: 0, ...dimensions };
    const rear = buildFaceplateScene(device, bounds, { face: "rear" });
    assert.equal(rear.chassis.width, rear.chassis.height);
    for (const box of [...rear.ports, ...rear.components]) {
      assert.ok([box.x, box.y, box.width, box.height].every(Number.isFinite));
      assert.ok(box.x >= bounds.x && box.y >= bounds.y && box.x + box.width <= bounds.width && box.y + box.height <= bounds.height);
    }
    const topology = { name: "AP", devices: [device], links: [], racks: [], vlans: [], linkGroups: [] };
    const svg = buildSVGDocument(topology, {
      ctx: { save() {}, restore() {}, measureText: (text) => ({ width: text.length * 4 }) }, worldBounds: () => bounds,
      portCenters: () => new Map(), portGeometry: () => rear.ports, routingPortGeometry: () => rear.ports,
      faceplateScenes: () => new Map([[device.id, rear]]), deviceRectangles: () => [{ ...bounds, device }], rackRectangles: () => [],
    });
    for (const port of device.ports) assert.ok(svg.includes(`data-port-id="${port.id}"`));
    assert.doesNotMatch(svg, /\b(?:NaN|Infinity)\b/);
  }
  assert.equal(device.faceplate.unitsU, 1);
});

/** Reconstruct the original two-Ethernet FAP-231F inventory independently of its corrected catalog row. */
function fortiApFixture() {
  const device = instantiateProfile({ vendor: "Fortinet", model: "FortiAP 231F", category: "AccessPoint", units: 1, color: "#e5e7e4",
    groups: [{ zone: "access", count: 2, type: "RJ45_1G", speed: 1000, labels: ["ETH0", "ETH1"], prefix: "", poe: false }],
  }, "Existing FortiAP", { x: 0, y: 0 });
  device.id = "saved-fap";
  for (const port of device.ports) { port.id = `saved-fap-${port.portIndex}`; port.deviceId = device.id; }
  delete device.faceplate.inventoryRevision;
  return device;
}

test("FAP-231F traces its cover and unfolded connector edges while appending only the missing console", () => {
  const current = instantiateProfile(hardwareCatalog.find((item) => item.vendor === "Fortinet" && item.model === "FortiAP 231F"),
    "New FortiAP", { x: 0, y: 0 });
  const profile = resolveAccessPointFaceplate(current);
  assert.equal(resolveModelFaceplate(current), profile, "exact AP takes priority over the old Fortinet fallback");
  assert.equal(profile.sku, "FAP-231F");
  assert.equal(profile.fidelity, "model");
  assert.equal(profile.inventoryRevision, 1);
  assert.equal(current.faceplate.inventoryRevision, 1);
  assert.equal(profile.chassis.shape, "square");
  assert.match(profile.evidence.rear, /FortiAP-231F-QSG\.pdf#page=3$/);
  assert.match(profile.limitations.join(" "), /folded out.*CONSOLE, LAN2, LAN1\/PoE, RESET, DC/);
  assert.deepEqual(current.ports.map(({ portIndex, type, speedMbps, label, isPoe }) => ({ portIndex, type, speedMbps, label, isPoe })), [
    { portIndex: 1, type: "RJ45_1G", speedMbps: 1000, label: "LAN1/PoE", isPoe: false },
    { portIndex: 2, type: "RJ45_1G", speedMbps: 1000, label: "LAN2", isPoe: false },
    { portIndex: 3, type: "Console", speedMbps: 0, label: "CONSOLE", isPoe: false },
  ]);
  assert.deepEqual(profile.faces.front.ports, []);
  assert.equal(profile.faces.front.components.filter((part) => part.kind === "led").length, 5);
  const sockets = [...profile.faces.rear.ports].sort((a, b) => a.x - b.x);
  assert.deepEqual(sockets.map((slot) => slot.physicalLabel), ["CONSOLE", "LAN2", "LAN1/PoE"]);
  const parts = profile.faces.rear.components;
  const reset = parts.find((part) => part.role === "reset");
  const dc = parts.find((part) => part.role === "12VDC");
  assert.ok(sockets.at(-1).x < reset.x && reset.x < dc.x);
  assert.ok(parts.find((part) => part.role === "usb-host").y < .1);
  assert.equal(parts.filter((part) => part.role === "mounting-keyhole").length, 2);
  assert.equal(parts.filter((part) => part.role === "cover-screw").length, 4);
  assert.equal(parts.filter((part) => ["fan", "psu"].includes(part.kind)).length, 0);
  assert.equal(resolveAccessPointFaceplate({ ...current, model: "FortiAP U231F" }), null);
});

test("FAP-231F revision-zero identities and custom labels survive reordered, partial saved inventories", () => {
  for (const retained of [[1, 2], [1], [2]]) {
    const device = fortiApFixture();
    device.ports = device.ports.filter((port) => retained.includes(port.portIndex)).reverse();
    for (const port of device.ports) Object.assign(port, { label: `Site ${port.portIndex}`, speedMbps: 100, nativeVlan: 237, allowedVlans: [237, 238] });
    const before = structuredClone(device);
    const bounds = { x: 15, y: 10, ...faceplateDisplaySize(device) };
    const rear = buildFaceplateScene(device, bounds, { face: "rear" });
    const front = buildFaceplateScene(device, bounds, { face: "front" });
    assert.deepEqual(rear.ports.map((box) => box.port.id), device.ports.map((port) => port.id));
    assert.deepEqual(rear.ports.map((box) => box.displayLabel), device.ports.map((port) => port.label));
    assert.equal(rear.unmappedPorts.length, 0);
    assert.equal(front.hiddenPorts.length, retained.length);
    assert.deepEqual(device, before);
    device.faceplate.inventoryRevision = 99;
    assert.equal(buildFaceplateScene(device, bounds).unmappedPorts.length, retained.length);
  }
  const legacy = fortiApFixture();
  const bounds = { x: 0, y: 0, ...faceplateDisplaySize(legacy) };
  assert.deepEqual(buildFaceplateScene(legacy, bounds).ports.map((box) => box.displayLabel), ["LAN1/PoE", "LAN2"]);
  legacy.ports[1].label = "ETH0";
  assert.equal(buildFaceplateScene(legacy, bounds).ports.find((box) => box.port.id === "saved-fap-2").displayLabel, "ETH0",
    "a user rename to another old generated label must not move the port or be hidden");
});

test("FAP-231F square scenes and SVG keep all three connectors bounded on both mounting sizes", () => {
  const device = instantiateProfile(hardwareCatalog.find((item) => item.vendor === "Fortinet" && item.model === "FortiAP 231F"),
    "FortiAP", { x: 0, y: 0 });
  device.id = "new-fap";
  for (const port of device.ports) { port.id = `new-fap-${port.portIndex}`; port.deviceId = device.id; }
  for (const mounted of [false, true]) {
    const bounds = { x: 0, y: 0, ...faceplateDisplaySize(device, { mounted }) };
    assert.equal(bounds.height, mounted ? 100 : 345);
    const rear = buildFaceplateScene(device, bounds, { face: "rear" });
    assert.equal(rear.chassis.width, rear.chassis.height);
    assert.equal(rear.ports.length, 3);
    assert.equal(rear.unmappedPorts.length, 0);
    for (const box of [...rear.ports, ...rear.components]) {
      assert.ok([box.x, box.y, box.width, box.height].every(Number.isFinite));
      assert.ok(box.x >= bounds.x && box.y >= bounds.y && box.x + box.width <= bounds.width && box.y + box.height <= bounds.height);
    }
    const topology = { name: "FAP", devices: [device], links: [], racks: [], vlans: [], linkGroups: [] };
    const svg = buildSVGDocument(topology, {
      ctx: { save() {}, restore() {}, measureText: (text) => ({ width: text.length * 4 }) }, worldBounds: () => bounds,
      portCenters: () => new Map(), portGeometry: () => rear.ports, routingPortGeometry: () => rear.ports,
      faceplateScenes: () => new Map([[device.id, rear]]), deviceRectangles: () => [{ ...bounds, device }], rackRectangles: () => [],
    });
    for (const port of device.ports) assert.ok(svg.includes(`data-port-id="${port.id}"`));
    assert.doesNotMatch(svg, /\b(?:NaN|Infinity)\b/);
  }
});
