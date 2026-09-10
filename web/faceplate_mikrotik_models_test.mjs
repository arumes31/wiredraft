import assert from "node:assert/strict";
import test from "node:test";
import { hardwareCatalog, instantiateProfile } from "./static/js/catalog.js";
import { resolveMikroTikFaceplate } from "./static/js/faceplate-mikrotik-models.js";
import { buildFaceplateScene } from "./static/js/faceplate-scene.js";

test("new CRS354 and CRS518 management endpoints use the documented 10/100 link speed", () => {
  for (const model of ["CRS354-48G-4S+2Q+RM", "CRS518-16XS-2XQ-RM"]) {
    const catalog = hardwareCatalog.find((item) => item.model === model);
    const device = instantiateProfile(catalog, model, { x: 0, y: 0 });
    assert.equal(device.ports.find((port) => port.label === "MGMT").speedMbps, 100);
  }
});

/** Resolve one catalog device and its explicitly traced MikroTik geometry. */
function fixture(model) {
  const catalog = hardwareCatalog.find((item) => item.model === model);
  const device = instantiateProfile(catalog, model, { x: 0, y: 0 });
  return { device, profile: resolveMikroTikFaceplate(device) };
}

test("CRS310, desktop CRS326 and CRS504 expose their exact panel inventories without rewriting old devices", () => {
  for (const [model, count, oldCount] of [["CRS310", 11, 10], ["CRS326", 27, 27], ["CRS504", 6, 6]]) {
    const { device, profile } = fixture(model);
    assert.equal(profile?.fidelity, "model", model);
    assert.equal(device.ports.length, count);
    const legacy = structuredClone(device);
    delete legacy.faceplate.inventoryRevision;
    legacy.ports = legacy.ports.filter((port) => port.portIndex <= oldCount).reverse();
    legacy.ports[0].label = "Customer service";
    legacy.ports[0].nativeVlan = 177;
    legacy.ports[0].speedMbps = 1000;
    const before = structuredClone(legacy);
    const scene = buildFaceplateScene(legacy, { x: 0, y: 0, width: 690, height: 100 });
    assert.equal(scene.ports.length, oldCount);
    assert.equal(scene.unmappedPorts.length, 0);
    assert.deepEqual(legacy, before);
    if (model === "CRS310") {
      assert.equal(profile.faces.front.ports.find((slot) => slot.type === "Console").portIndex, 11);
      assert.equal(profile.faces.front.ports.filter((slot) => slot.type === "SFP_1G").length, 5);
      assert.deepEqual(profile.faces.front.ports.filter((slot) => slot.type === "SFP_PLUS_10G").map((slot) => slot.physicalLabel), ["1+", "2+", "3+", "4+"]);
      assert.equal(profile.faces.rear.components.filter((part) => part.kind === "fan").length, 1);
      legacy.faceplate.inventoryRevision = 99;
      assert.equal(buildFaceplateScene(legacy, { x: 0, y: 0, width: 690, height: 100 }).unmappedPorts.length, oldCount);
    } else if (model === "CRS326") {
      assert.equal(profile.sku, "CRS326-24G-2S+IN");
      assert.ok(profile.chassis.width < 1);
      assert.ok(profile.faces.rear.components.every((part) => part.kind !== "fan"), "circular passive grille is not an installed fan");
    } else {
      assert.equal(profile.faces.front.components.filter((part) => part.kind === "psu").length, 2);
      assert.equal(profile.faces.rear.components.filter((part) => part.kind === "psu").length, 0);
      assert.equal(profile.faces.rear.components.filter((part) => part.kind === "fan").length, 2);
      assert.ok(profile.faces.front.components.some((part) => part.kind === "terminal" && part.pins === 2));
      assert.equal(device.ports.find((port) => port.group === "MGMT").speedMbps, 100);
    }
  }
});

test("the five full SKUs preserve every typed port with explicit panel evidence", () => {
  for (const model of ["CRS317-1G-16S+RM", "CRS326-24G-2S+RM", "CRS328-24P-4S+RM", "CRS354-48G-4S+2Q+RM", "CRS518-16XS-2XQ-RM"]) {
    const { device, profile } = fixture(model);
    assert.deepEqual(profile.faces.front.ports.map((port) => [port.portIndex, port.type]).sort((a, b) => a[0] - b[0]),
      device.ports.map((port) => [port.portIndex, port.type]));
    assert.deepEqual(profile.faces.rear.ports, []);
    assert.equal(resolveMikroTikFaceplate(device), profile);
    assert.ok(Array.isArray(profile.evidence) ? profile.evidence.length >= 3 : profile.evidence.front && profile.evidence.rear);
    assert.ok(profile.catalogDiscrepancies.length);
    assert.ok(profile.faces.rear.connectionMarker);
    device.ports[0].label = "Edited logical name";
    assert.equal(resolveMikroTikFaceplate(device), profile);
    assert.equal(profile.faces.front.ports.some((port) => port.label === "Edited logical name"), false);
  }
  assert.equal(resolveMikroTikFaceplate({}), null);
  assert.equal(resolveMikroTikFaceplate({ model: "CRS317-1G-16S+RM", faceplate: { vendor: "Other" } }), null);
});

test("CCR1072, CRS305 and CRS309 use their photographed enclosures and preserve edited saved endpoints", () => {
  for (const [model, count, sku] of [["CCR1072", 10, "CCR1072-1G-8S+"],
    ["CRS305", 5, "CRS305-1G-4S+IN"], ["CRS309", 10, "CRS309-1G-8S+IN"]]) {
    const { device, profile } = fixture(model);
    assert.equal(profile.fidelity, "model");
    assert.equal(profile.sku, sku);
    assert.equal(profile.inventoryComplete, true);
    assert.equal(device.ports.length, count);
    device.ports.reverse();
    device.ports[0].label = "Site service connection";
    device.ports[0].nativeVlan = 201;
    const before = structuredClone(device);
    const scenes = ["front", "rear"].map((face) => buildFaceplateScene(device, { x: 0, y: 0, width: 690, height: 100 }, { face }));
    assert.equal(scenes.flatMap((scene) => scene.unmappedPorts).length, 0);
    assert.deepEqual(scenes.flatMap((scene) => scene.ports.map((box) => box.port.id)).sort(), device.ports.map((port) => port.id).sort());
    assert.deepEqual(device, before);
    const selected = scenes.flatMap((scene) => scene.ports).find((box) => box.port.id === device.ports[0].id);
    assert.equal(selected.displayLabel, "Site service connection");
    device.ports = device.ports.filter((port) => port.portIndex % 2);
    assert.equal(buildFaceplateScene(device, { x: 0, y: 0, width: 690, height: 100 }).ports.length, device.ports.length);
  }
});

test("CCR1072 retains its LCD, horizontal services, eight optical ports and four fixed rear fans", () => {
  const { profile } = fixture("CCR1072");
  const slots = profile.faces.front.ports;
  assert.equal(new Set(slots.filter((slot) => slot.type === "SFP_PLUS_10G").map((slot) => slot.y)).size, 1);
  const console = slots.find((slot) => slot.type === "Console");
  const ethernet = slots.find((slot) => slot.type === "RJ45_1G");
  assert.ok(ethernet.x < console.x && ethernet.y === console.y);
  assert.ok(profile.faces.front.components.some((part) => part.kind === "lcd"));
  assert.deepEqual(profile.faces.front.components.filter((part) => part.kind.startsWith("usb")).map((part) => part.kind), ["usb", "usb-micro"]);
  assert.equal(profile.faces.rear.components.filter((part) => part.kind === "fan").length, 4);
  assert.equal(profile.faces.rear.components.filter((part) => part.kind === "psu").length, 2);
});

test("CRS305 keeps its passive desktop body, five front sockets and two rear DC jacks", () => {
  const { device, profile } = fixture("CRS305");
  assert.ok(profile.chassis.width < .6);
  assert.deepEqual(profile.faces.front.ports.map((port) => port.physicalLabel), ["ETH/BOOT", "1", "2", "3", "4"]);
  assert.equal(profile.faces.rear.components.filter((part) => part.kind === "power" && part.variant === "dc-barrel").length, 2);
  assert.ok(Object.values(profile.faces).flatMap((face) => face.components).every((part) => part.kind !== "fan" && part.kind !== "usb"));
  assert.ok(device.ports.every((port) => !port.isPoe), "PoE input must not become PoE output");
});

test("CRS309 adds its actual DB9 console without moving any revision-zero socket", () => {
  const { device, profile } = fixture("CRS309");
  assert.equal(profile.inventoryRevision, 1);
  assert.equal(device.faceplate.inventoryRevision, 1);
  assert.equal(profile.faces.front.ports.find((slot) => slot.portIndex === 10).connectorKind, "db9");
  assert.ok(profile.faces.rear.components.some((part) => part.variant === "fins"));
  assert.equal(profile.faces.rear.components.filter((part) => part.kind === "fan").length, 0);
  const legacy = structuredClone(device);
  delete legacy.faceplate.inventoryRevision;
  legacy.ports = legacy.ports.filter((port) => port.portIndex < 10).reverse();
  legacy.ports[0].label = "Customized management";
  const before = structuredClone(legacy);
  const scene = buildFaceplateScene(legacy, { x: 0, y: 0, width: 690, height: 100 });
  assert.equal(scene.ports.length, 9);
  assert.equal(scene.unmappedPorts.length, 0);
  assert.deepEqual(legacy, before);
  legacy.ports = legacy.ports.filter((port) => [2, 7, 9].includes(port.portIndex));
  assert.equal(buildFaceplateScene(legacy, { x: 0, y: 0, width: 690, height: 100 }).ports.length, 3);
  legacy.faceplate.inventoryRevision = 99;
  assert.equal(buildFaceplateScene(legacy, { x: 0, y: 0, width: 690, height: 100 }).unmappedPorts.length, 3);
});

test("documented CRS317, CRS354 and CRS518 short names resolve the same physical SKU with their own inventory indices", () => {
  for (const [model, sku] of [["CRS317", "CRS317-1G-16S+RM"], ["CRS354", "CRS354-48G-4S+2Q+RM"], ["CRS518", "CRS518-16XS-2XQ-RM"]]) {
    const { device, profile } = fixture(model);
    const full = fixture(sku).profile;
    assert.equal(profile.fidelity, "model");
    assert.equal(profile.sku, sku);
    assert.deepEqual(profile.faces.rear.components, full.faces.rear.components);
    for (const type of new Set(device.ports.map((port) => port.type))) {
      const geometry = (candidate) => candidate.faces.front.ports.filter((port) => port.type === type).map(({ x, y, width, height }) => ({ x, y, width, height }));
      assert.deepEqual(geometry(profile), geometry(full));
    }
    const before = structuredClone(device);
    const scene = buildFaceplateScene(device, { x: 0, y: 0, width: 690, height: 100 });
    assert.equal(scene.ports.length, device.ports.length);
    assert.equal(scene.unmappedPorts.length, 0);
    assert.deepEqual(device, before);
    if (model !== "CRS317") assert.equal(device.ports.find((port) => port.type === "RJ45_1G" && port.group === "MGMT").speedMbps, 100);
  }
});

test("CRS317 has one optical row followed by the console/Ethernet stack and its rear heatsink", () => {
  const { profile } = fixture("CRS317-1G-16S+RM");
  const optical = profile.faces.front.ports.filter((port) => port.type === "SFP_PLUS_10G");
  assert.equal(new Set(optical.map((port) => port.y)).size, 1);
  assert.equal(optical.length, 16);
  assert.deepEqual(optical.map((port) => port.physicalLabel), Array.from({ length: 16 }, (_, index) => String(index + 1)));
  assert.ok(optical[4].x - optical[3].x > optical[1].x - optical[0].x);
  const management = profile.faces.front.ports.find((port) => port.type === "RJ45_1G");
  const console = profile.faces.front.ports.find((port) => port.type === "Console");
  assert.equal(management.x, console.x);
  assert.ok(console.y < management.y && management.x > optical.at(-1).x);
  assert.equal(profile.faces.rear.components.filter((part) => part.kind === "fan").length, 2);
  assert.equal(profile.faces.rear.components.filter((part) => part.kind === "power").length, 2);
  assert.ok(profile.faces.rear.components.some((part) => part.variant === "fins"));
  assert.equal(profile.fidelity, "model");
});

test("CRS326 has three paired copper banks and a passive DC rear without claimed fans", () => {
  const { profile } = fixture("CRS326-24G-2S+RM");
  const copper = profile.faces.front.ports.filter((port) => port.type === "RJ45_1G");
  assert.equal(copper[0].x, copper[1].x);
  assert.ok(copper[0].y > copper[1].y, "odd physical ports occupy the bottom row");
  assert.ok(copper[8].x - copper[6].x > copper[2].x - copper[0].x);
  assert.equal(profile.faces.rear.components.filter((part) => part.kind === "fan").length, 0);
  assert.equal(profile.faces.rear.components.find((part) => part.kind === "power").variant, "dc-barrel");
  assert.equal(profile.fidelity, "model");
});

test("CRS354 groups its 48 copper sockets ahead of optical and rightmost service stacks", () => {
  const { profile } = fixture("CRS354-48G-4S+2Q+RM");
  const slots = profile.faces.front.ports;
  assert.ok(slots.find((port) => port.portIndex === 48).x < slots.find((port) => port.portIndex === 49).x);
  assert.ok(slots.find((port) => port.portIndex === 52).x < slots.find((port) => port.portIndex === 53).x);
  assert.ok(slots.find((port) => port.label === "MGMT").x > slots.find((port) => port.portIndex === 54).x);
  assert.equal(profile.faces.rear.components.filter((part) => part.kind === "fan").length, 3);
  assert.equal(profile.faces.rear.components.filter((part) => part.kind === "power").length, 2);
  assert.equal(profile.fidelity, "model");
});

test("CRS518 places QSFPs before eight SFP28 pairs and exposes four distinct rear fan modules", () => {
  const { profile } = fixture("CRS518-16XS-2XQ-RM");
  const slots = profile.faces.front.ports;
  const qsfp = slots.filter((port) => port.type === "QSFP28_100G");
  const sfp = slots.filter((port) => port.type === "SFP28_25G");
  assert.ok(qsfp.at(-1).x < sfp[0].x);
  assert.equal(new Set(sfp.map((port) => port.x)).size, 8);
  assert.equal(profile.faces.rear.components.filter((part) => part.kind === "psu").length, 2);
  assert.equal(profile.faces.rear.components.filter((part) => part.kind === "fan").length, 4);
  assert.equal(profile.faces.rear.components.filter((part) => part.kind === "handle").length, 4);
  assert.ok(profile.faces.front.components.some((part) => part.kind === "usb" && part.height > part.width));
  assert.ok(profile.faces.front.components.some((part) => part.variant === "chevron"));
  assert.equal(profile.fidelity, "model");
});

test("CRS328 traces the original review rear and preserves the full-SKU and alias inventory", () => {
  const { profile } = fixture("CRS328-24P-4S+RM");
  assert.equal(profile.fidelity, "model");
  assert.deepEqual(profile.panelFidelity, { front: "model", rear: "model" });
  assert.match(profile.evidence.rear, /servethehome.*Rear\.jpg$/);
  assert.match(profile.evidence.configuration, /2020.*ServeTheHome/);
  assert.equal(profile.faces.front.ports.filter((port) => port.type === "RJ45_1G").length, 24);
  assert.equal(profile.faces.rear.components.filter((part) => part.kind === "power").length, 1);
  assert.equal(profile.faces.rear.components.filter((part) => part.kind === "fan").length, 0);
  assert.ok(profile.faces.rear.components.find((part) => part.kind === "power").x > .8);
  assert.equal(profile.faces.rear.components.filter((part) => part.kind === "screw").length, 3);
  assert.deepEqual(fixture("CRS328").profile.faces, profile.faces);
});

test("CCR2216 resolves its explicit 1G-12XS-2XQ configuration with independently numbered optical banks", () => {
  const { device, profile } = fixture("CCR2216");
  assert.ok(profile);
  assert.equal(profile.fidelity, "model");
  assert.equal(profile.sku, "CCR2216-1G-12XS-2XQ");
  assert.ok(profile.inventoryComplete);
  assert.match(profile.evidence.configuration, /two.*AC/i);
  const optical = profile.faces.front.ports.filter((slot) => slot.type === "SFP28_25G");
  const qsfp = profile.faces.front.ports.filter((slot) => slot.type === "QSFP28_100G");
  assert.equal(optical.length, 12);
  assert.equal(qsfp.length, 2);
  assert.deepEqual(qsfp.map((slot) => slot.physicalLabel), ["1", "2"]);
  for (let index = 0; index < 12; index += 2) {
    assert.equal(optical[index].x, optical[index + 1].x);
    assert.ok(optical[index].y > optical[index + 1].y, "odd SFP28 ports occupy the bottom row");
  }
  assert.ok(qsfp.every((slot) => slot.x < optical[0].x));
  const serial = profile.faces.front.ports.find((slot) => slot.type === "Console");
  const ethernet = profile.faces.front.ports.find((slot) => slot.type === "RJ45_1G");
  assert.equal(serial.x, ethernet.x);
  assert.ok(serial.y < ethernet.y && serial.x > optical.at(-1).x);
  assert.equal(profile.faces.front.ports.length, 16);
  assert.equal(profile.faces.rear.ports.length, 0);
  const fans = profile.faces.rear.components.filter((part) => part.kind === "fan");
  const supplies = profile.faces.rear.components.filter((part) => part.kind === "psu");
  assert.equal(fans.length, 4);
  assert.equal(supplies.length, 2);
  assert.ok(supplies.every((part) => part.variant === "ac-inlet-right" && part.x < fans[0].x));
  assert.equal(profile.faces.front.components.some((part) => part.kind === "usb"), false);
  device.ports.forEach((port) => { port.id = `ccr-${port.portIndex}`; });
  device.ports[0].label = "Transit";
  device.ports[0].nativeVlan = 48;
  device.ports.reverse();
  const before = structuredClone(device);
  const scene = buildFaceplateScene(device, { x: 0, y: 0, width: 690, height: 100 });
  assert.equal(scene.unmappedPorts.length, 0);
  assert.equal(scene.ports.length, 16);
  assert.equal(scene.ports.find((box) => box.port.id === "ccr-1").displayLabel, "Transit");
  assert.deepEqual(device, before);
});

for (const [model, sku, count, fanCount] of [["CCR2004", "CCR2004-1G-12S+2XS", 16, 2], ["CCR2116", "CCR2116-12G-4S+", 18, 4]]) {
  test(`${model} uses its selected chassis and retains all saved endpoint identities`, () => {
    const { device, profile } = fixture(model);
    assert.ok(profile);
    assert.equal(profile.sku, sku);
    assert.equal(profile.fidelity, "model");
    assert.equal(profile.inventoryComplete, true);
    assert.equal(profile.faces.front.ports.length, count);
    assert.equal(profile.faces.rear.ports.length, 0);
    assert.equal(profile.faces.rear.components.filter((part) => part.kind === "fan").length, fanCount);
    assert.equal(profile.faces.rear.components.filter((part) => part.kind === "power").length, 2);
    assert.equal(profile.faces.rear.components.filter((part) => part.kind === "psu").length, 0, "fixed rear inlets are not hot-swap supply modules");
    const serial = profile.faces.front.ports.find((slot) => slot.type === "Console");
    const management = profile.faces.front.ports.find((slot) => slot.portIndex === count - 1);
    assert.equal(serial.x, management.x);
    assert.ok(serial.y < management.y);
    if (model === "CCR2004") {
      const sfp = profile.faces.front.ports.filter((slot) => slot.type === "SFP_PLUS_10G");
      const sfp28 = profile.faces.front.ports.filter((slot) => slot.type === "SFP28_25G");
      assert.equal(new Set(sfp.map((slot) => slot.y)).size, 1);
      assert.equal(sfp28[0].x, sfp28[1].x);
      assert.ok(sfp28[0].x < sfp[0].x && sfp28[0].y > sfp28[1].y);
      assert.ok(profile.faces.rear.components.some((part) => part.variant === "fins"));
    } else {
      const copper = profile.faces.front.ports.filter((slot) => slot.portIndex <= 12);
      assert.equal(new Set(copper.map((slot) => slot.y)).size, 1);
      assert.ok(copper[4].x - copper[3].x > copper[1].x - copper[0].x);
      assert.ok(profile.faces.front.components.some((part) => part.kind === "usb" && part.width < part.height));
    }
    device.ports.forEach((port) => { port.id = `saved-${port.portIndex}`; });
    device.ports[0].label = "Customer transit";
    device.ports[0].nativeVlan = 97;
    device.ports.reverse();
    const before = structuredClone(device);
    const scene = buildFaceplateScene(device, { x: 0, y: 0, width: 690, height: 100 });
    assert.equal(scene.unmappedPorts.length, 0);
    assert.equal(scene.ports.length, count);
    assert.equal(scene.ports.find((box) => box.port.id === "saved-1").displayLabel, "Customer transit");
    assert.deepEqual(device, before);
  });
}
