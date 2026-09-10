import assert from "node:assert/strict";
import test from "node:test";
import { hardwareCatalog, instantiateProfile } from "./static/js/catalog.js";
import { resolveEquipmentFaceplate } from "./static/js/faceplate-equipment-models.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";

/** Give the RUTX50 stable saved identities without depending on mutable port array order. */
function fixture() {
  const entry = hardwareCatalog.find((item) => item.vendor === "Teltonika Networks" && item.model === "RUTX50");
  const device = instantiateProfile(entry, entry.model, { x: 0, y: 0 });
  device.ports.forEach((port) => { port.id = `rutx50-${port.portIndex}`; });
  return device;
}

test("RUTX50 has four front LAN sockets followed by WAN with its own measured compact chassis", () => {
  const device = fixture();
  const profile = resolveEquipmentFaceplate(device);
  assert.equal(profile.fidelity, "model");
  assert.deepEqual(profile.evidence.models, ["RUTX50"]);
  assert.match(profile.evidence.supplemental, /spatial_measurements.pdf#page=2$/);
  assert.ok(profile.chassis.width < .4);
  assert.equal(device.ports.length, 5);
  assert.ok(device.ports.every((port) => port.type === "RJ45_1G" && port.speedMbps === 1000 && !port.isPoe));
  assert.deepEqual(profile.faces.front.ports.map((slot) => slot.physicalLabel), ["LAN1", "LAN2", "LAN3", "LAN4", "WAN"]);
  assert.equal(new Set(profile.faces.front.ports.map((slot) => slot.y)).size, 1);
  for (let index = 1; index < 5; index++) assert.ok(profile.faces.front.ports[index].x > profile.faces.front.ports[index - 1].x);
  assert.equal(profile.faces.rear.ports.length, 0);
  assert.match(profile.limitations.join(" "), /PoE input/);
});

test("RUTX50 separates its two SIM holders and power controls from seven rear antenna connectors", () => {
  const profile = resolveEquipmentFaceplate(fixture());
  const front = profile.faces.front.components;
  assert.equal(front.filter((part) => part.role === "sim-holder").length, 2);
  assert.equal(front.filter((part) => part.role === "sim-needle").length, 1);
  assert.equal(front.filter((part) => part.role === "reset").length, 1);
  assert.equal(front.find((part) => part.kind === "power").variant, "dc-keyed4");
  const rear = profile.faces.rear.components;
  const antennas = rear.filter((part) => part.kind === "coax");
  assert.equal(antennas.length, 7);
  assert.deepEqual(antennas.filter((part) => part.y < .4).map((part) => part.role), ["mobile", "mobile", "gnss", "mobile", "mobile"]);
  assert.equal(antennas.filter((part) => part.role === "wifi" && part.y > .5).length, 2);
  assert.equal(rear.filter((part) => part.kind === "usb").length, 1);
  assert.equal(rear.filter((part) => part.role === "ground").length, 1);
  assert.equal(rear.filter((part) => part.kind === "fan" || part.kind === "psu").length, 0);
});

test("RUTX50 renamed and reordered saved ports stay on the same sockets without data mutation", () => {
  const device = fixture();
  const canonical = resolveEquipmentFaceplate(device);
  device.ports[0].label = "Factory PLC";
  device.ports[0].nativeVlan = 72;
  device.ports[4].label = "Carrier handoff";
  device.ports.reverse();
  const before = structuredClone(device);
  assert.equal(resolveEquipmentFaceplate(device), canonical);
  for (const width of [460, 690]) {
    const bounds = { x: 17, y: 23, width, height: 100 };
    const front = buildFaceplateScene(device, bounds, { face: "front" });
    const rear = buildFaceplateScene(device, bounds, { face: "rear" });
    assert.equal(front.ports.length, 5);
    assert.equal(rear.ports.length, 0);
    assert.equal(front.unmappedPorts.length + rear.unmappedPorts.length, 0);
    const spatialOrder = front.ports.toSorted((a, b) => a.x - b.x);
    assert.deepEqual(spatialOrder.map((box) => box.port.id), ["rutx50-1", "rutx50-2", "rutx50-3", "rutx50-4", "rutx50-5"]);
    assert.equal(spatialOrder[0].displayLabel, "Factory PLC");
    assert.equal(spatialOrder[4].displayLabel, "Carrier handoff");
    for (const box of [...front.ports, ...front.components, ...rear.components]) {
      assert.ok([box.x, box.y, box.width, box.height].every(Number.isFinite));
      assert.ok(box.x >= bounds.x && box.x + box.width <= bounds.x + bounds.width);
      assert.ok(box.y >= bounds.y && box.y + box.height <= bounds.y + bounds.height);
    }
  }
  assert.deepEqual(device, before);
});
