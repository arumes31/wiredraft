import assert from "node:assert/strict";

import {
  catalogFamilies,
  catalogVendors,
  hardwareCatalog,
  instantiateProfile,
  modelsForVendor,
  registerProfiles,
} from "./static/js/catalog.js";
import { resolveFaceplateTemplate } from "./static/js/faceplate.js";
import { connectorKind, connectorSize } from "./static/js/termination.js";

const families = new Map(catalogFamilies().map((family) => [family.id, family]));
for (const family of ["Access Points", "Carrier Handoffs", "Modems & ONTs", "Cellular Routers"]) {
  assert.ok(families.get(family)?.count >= 3, `${family} must be a populated installer option`);
}

assert.deepEqual(catalogVendors("Access Points"), ["Cisco", "Fortinet", "Generic Edge", "HPE Aruba", "Ubiquiti"]);
assert.ok(modelsForVendor("Cisco", "Access Points").every((profile) => profile.family === "Access Points"));
assert.ok(modelsForVendor("Cisco", "Access Points").some((profile) => profile.model === "Catalyst 9166I"));

function installed(vendor, model) {
  const profile = hardwareCatalog.find((candidate) => candidate.vendor === vendor && candidate.model === model);
  assert.ok(profile, `missing edge profile ${vendor} ${model}`);
  return instantiateProfile(profile, model, { x: 10, y: 20 });
}

const accessPoint = installed("HPE Aruba", "AP-635");
assert.equal(accessPoint.category, "AccessPoint");
assert.deepEqual(accessPoint.ports.map((port) => port.label), ["E0", "E1"]);
assert.ok(accessPoint.ports.every((port) => port.type === "RJ45_MGIG" && port.speedMbps === 2500));
assert.equal(resolveFaceplateTemplate(accessPoint).id, "wireless-ap");

const handoff = installed("Generic Edge", "10G fiber Ethernet handoff");
assert.deepEqual(handoff.ports.map((port) => port.label).sort(), ["NNI", "UNI"]);
assert.ok(handoff.ports.every((port) => port.type === "SFP_PLUS_10G"));
assert.equal(resolveFaceplateTemplate(handoff).id, "carrier-edge");

const cableModem = installed("Ubiquiti", "UniFi Cable Internet");
assert.ok(cableModem.ports.some((port) => port.label === "DOCSIS" && port.type === "COAX_F"));
assert.ok(cableModem.ports.some((port) => port.label === "2.5 GbE" && port.type === "RJ45_MGIG"));
assert.equal(connectorKind("COAX_F"), "coax");
assert.deepEqual(connectorSize("COAX_F"), { width: 15, height: 15 });

const cellular = installed("Fortinet", "FortiExtender 511F");
assert.equal(cellular.category, "Router");
assert.ok(["WAN", "SFP WAN", "LAN4/PoE"].every((label) => cellular.ports.some((port) => port.label === label)));
assert.equal(resolveFaceplateTemplate(cellular).id, "cellular-edge");

assert.equal(registerProfiles([{
  vendor: "Lab ISP", model: "Coax demarc", category: "Modem", family: "Carrier Handoffs",
  units: 1, color: "#29383b",
  groups: [{ zone: "uplink", count: 1, type: "COAX_F", speed: 2500, poe: false, labels: ["RF"] }],
}]), 1);
assert.ok(modelsForVendor("Lab ISP", "Carrier Handoffs").some((profile) => profile.model === "Coax demarc"));

console.log(`edge catalog checks passed: ${families.get("all").count} installable profiles`);
