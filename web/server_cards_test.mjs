import assert from "node:assert/strict";

import {
  ServerCardTypes, defaultServerCards, instantiateGenericServerBack,
  normalizeServerCards, serverSlotCapacity,
} from "./static/js/server-cards.js";
import { buildSVGDocument } from "./static/js/export.js";

const supportedPortTypes = new Set([
  "RJ45_1G", "RJ45_MGIG", "RJ45_10G", "DSL_RJ11", "COAX_F", "SFP_1G", "SFP_PLUS_10G",
  "SFP28_25G", "SFP56_50G", "QSFP_PLUS_40G", "QSFP28_100G", "QSFP56_200G",
  "QSFP_DD_400G", "Console", "Power",
]);
assert.deepEqual(new Set(ServerCardTypes.map((card) => card.portType)), supportedPortTypes);
assert.equal(serverSlotCapacity(1), 4);
assert.equal(serverSlotCapacity(4), 16);
assert.equal(defaultServerCards().length, 3);

const server = instantiateGenericServerBack({
  name: "HV-01", model: "Generic virtualization host", units: 2, color: "#30383b",
  cards: [
    { typeKey: "bmc", label: "IPMI", portCount: 1 },
    { typeKey: "rj45-10g", label: "LAN", portCount: 4 },
    { typeKey: "qsfp28", label: "FABRIC", portCount: 2 },
    { typeKey: "power", label: "PSU", portCount: 2 },
  ],
}, { x: 120, y: 240 });

assert.equal(server.category, "Server");
assert.equal(server.faceplate.unitsU, 2);
assert.equal(server.faceplate.rows, 2);
assert.equal(server.faceplate.layout, "generic-server-back");
assert.equal(server.ports.length, 9);
assert.deepEqual(server.ports.map((port) => port.portIndex), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
assert.ok(server.ports.every((port) => port.faceplateX >= .02 && port.faceplateX <= .98));
assert.ok(server.ports.every((port) => port.faceplateY >= .08 && port.faceplateY <= .92));
assert.ok(server.ports.every((port) => /^S\d+ · /.test(port.group)));
assert.equal(server.ports.find((port) => port.label === "IPMI").mode, "Access");
assert.ok(server.ports.filter((port) => port.type === "Power").every((port) => port.mode === "Unconfigured"));

server.id = "server-1";
server.ports.forEach((port, index) => { port.id = `server-port-${index + 1}`; port.deviceId = server.id; });
const serverBox = { device: server, x: 20, y: 30, width: 690, height: 200 };
const svg = buildSVGDocument({ name: "Rear cards", racks: [], devices: [server], links: [], vlans: [] }, {
  worldBounds: () => ({ x: 0, y: 0, width: 760, height: 270 }),
  portCenters: () => new Map(server.ports.map((port) => [port.id, {
    x: serverBox.x + port.faceplateX * serverBox.width,
    y: serverBox.y + port.faceplateY * serverBox.height,
  }])),
  rackRectangles: () => [],
  deviceRectangles: () => [serverBox],
});
assert.match(svg, /data-layer="server-card"/);
assert.match(svg, />S1 · IPMI<\/text>/);

for (const card of ServerCardTypes) {
  const generated = instantiateGenericServerBack({
    units: 1,
    cards: [{ typeKey: card.key, label: card.defaultLabel, portCount: card.portCounts.at(-1) }],
  }, { x: 0, y: 0 });
  assert.equal(generated.ports.length, card.portCounts.at(-1));
  assert.ok(generated.ports.every((port) => port.type === card.portType));
}

assert.throws(() => normalizeServerCards(Array.from({ length: 5 }, () => ({
  typeKey: "bmc", label: "BMC", portCount: 1,
})), 1), /up to 4 cards/);
assert.throws(() => normalizeServerCards([{ typeKey: "qsfp28", label: "Q", portCount: 4 }], 1), /supports/);
assert.throws(() => normalizeServerCards([], 1), /at least one/);

console.log(`generic server back checks passed: ${ServerCardTypes.length} card families`);
