import assert from "node:assert/strict";
import test from "node:test";
import { defaultCableProperties } from "./static/js/cable-defaults.js";
import { hardwareCatalog, instantiateProfile, registerProfiles } from "./static/js/catalog.js";

/** Build an endpoint with intentionally configured VLANs to catch telephone/Ethernet confusion. */
function port(type, overrides = {}) {
  return { type, mode: "Access", nativeVlan: 20, allowedVlans: [], ...overrides };
}

test("POTS catalog imports initialize a non-Ethernet endpoint without assigning VLANs or PoE", () => {
  const original = [...hardwareCatalog];
  try {
    const profile = { vendor: "Telephone test", model: "Analogue modem", category: "Modem", units: 1, color: "#333333",
      groups: [{ zone: "access", count: 1, type: "POTS_RJ11", speed: 0, poe: false, prefix: "MODEM" }] };
    assert.equal(registerProfiles([profile]), 1, "the additive type is accepted by the catalog importer");
    const imported = hardwareCatalog.find((entry) => entry.vendor === profile.vendor && entry.model === profile.model);
    const device = instantiateProfile(imported, "Telephone", { x: 0, y: 0 });
    const modem = device.ports[0];
    assert.equal(modem.type, "POTS_RJ11");
    assert.equal(modem.mode, "Unconfigured");
    assert.equal(modem.speedMbps, 0);
    assert.equal(modem.nativeVlan, 0);
    assert.deepEqual(modem.allowedVlans, []);
    assert.equal(modem.isPoe, false);
    assert.throws(() => registerProfiles([{ ...profile, model: "Invalid", groups: [{ ...profile.groups[0], type: "POTS_RJ12" }] }]), /Invalid hardware profile/);
  } finally {
    hardwareCatalog.splice(0, hardwareCatalog.length, ...original);
  }
});

test("telephone cables use no Ethernet VLANs regardless of endpoint direction or saved configuration", () => {
  for (const types of [["POTS_RJ11", "POTS_RJ11"], ["POTS_RJ11", "RJ45_1G"], ["RJ45_1G", "POTS_RJ11"]]) {
    const endpoints = types.map((type) => port(type, { mode: "Trunk", nativeVlan: 30, allowedVlans: [40, 50] }));
    const before = structuredClone(endpoints);
    assert.deepEqual(defaultCableProperties(...endpoints), { cableType: "TELEPHONE", vlanIds: [], primaryVlan: 0 });
    assert.deepEqual(endpoints, before);
  }
});

test("existing copper, coax, optical, serial and DSL cable defaults remain unchanged", () => {
  for (const [type, cableType] of [["RJ45_1G", "CAT6A"], ["COAX_F", "COAX"], ["SFP_PLUS_10G", "FIBER"],
    ["FIBER_LC", "FIBER"], ["DSL_RJ11", "CAT6A"]]) {
    for (const endpoints of [[port(type), port("RJ45_1G")], [port("RJ45_1G"), port(type)]]) {
      assert.deepEqual(defaultCableProperties(...endpoints), { cableType, vlanIds: [20], primaryVlan: 20 });
    }
  }
  assert.deepEqual(defaultCableProperties(port("RJ45_1G", { mode: "Trunk", allowedVlans: [30] }),
    port("RJ45_1G", { nativeVlan: 30 })), { cableType: "CAT6A", vlanIds: [30], primaryVlan: 30 });
  assert.deepEqual(defaultCableProperties(port("Console", { mode: "Unconfigured", nativeVlan: 0 }),
    port("Console", { mode: "Unconfigured", nativeVlan: 0 })), { cableType: "CAT6A", vlanIds: [1], primaryVlan: 1 });
  assert.deepEqual(defaultCableProperties(port("RJ45_1G"), port("RJ45_1G", { nativeVlan: 30 })),
    { cableType: "CAT6A", vlanIds: [20], primaryVlan: 20 });
});
