import assert from "node:assert/strict";
import test from "node:test";
import { hardwareCatalog, instantiateProfile } from "./static/js/catalog.js";
import { resolveMikroTikFaceplate } from "./static/js/faceplate-mikrotik-models.js";

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

test("the five full SKUs preserve every typed port while shorter family names remain unresolved", () => {
  for (const model of ["CRS317-1G-16S+RM", "CRS326-24G-2S+RM", "CRS328-24P-4S+RM", "CRS354-48G-4S+2Q+RM", "CRS518-16XS-2XQ-RM"]) {
    const { device, profile } = fixture(model);
    assert.deepEqual(profile.faces.front.ports.map((port) => [port.portIndex, port.type]).sort((a, b) => a[0] - b[0]),
      device.ports.map((port) => [port.portIndex, port.type]));
    assert.deepEqual(profile.faces.rear.ports, []);
    assert.equal(resolveMikroTikFaceplate(device), profile);
    assert.ok(profile.evidence.length >= 3);
    assert.ok(profile.catalogDiscrepancies.length);
    assert.ok(profile.faces.rear.connectionMarker);
    device.ports[0].label = "Edited logical name";
    assert.equal(resolveMikroTikFaceplate(device), profile);
    assert.equal(profile.faces.front.ports.some((port) => port.label === "Edited logical name"), false);
  }
  for (const model of ["CRS317", "CRS326", "CRS328", "CCR2004"]) assert.equal(fixture(model).profile, null);
  assert.equal(resolveMikroTikFaceplate({}), null);
  assert.equal(resolveMikroTikFaceplate({ model: "CRS317-1G-16S+RM", faceplate: { vendor: "Other" } }), null);
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

test("CRS328's verified front does not hide its unresolved rear illustration gap", () => {
  const { profile } = fixture("CRS328-24P-4S+RM");
  assert.equal(profile.fidelity, "family");
  assert.deepEqual(profile.panelFidelity, { front: "model", rear: "schematic" });
  assert.match(profile.limitations[0], /provisional/);
  assert.equal(profile.faces.front.ports.filter((port) => port.type === "RJ45_1G").length, 24);
  assert.equal(profile.faces.rear.components.filter((part) => part.kind === "power").length, 1);
  assert.equal(profile.faces.rear.components.filter((part) => part.kind === "fan").length, 0);
});
