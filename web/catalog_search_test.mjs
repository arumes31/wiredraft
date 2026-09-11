import assert from "node:assert/strict";
import { test } from "node:test";
import * as catalog from "./static/js/catalog.js";

test("device search finds models, SKUs and providers across all families", () => {
  const matches = catalog.searchHardwareProfiles("  hPe ArUbA   AP-635  ");
  assert.ok(matches.some((profile) => profile.vendor === "HPE Aruba" && profile.model === "AP-635"));
  assert.ok(catalog.searchHardwareProfiles("Teltonika").some((profile) => profile.model === "RUTX50"));
  const withSKU = catalog.hardwareCatalog.find((profile) => profile.sku && profile.vendor !== "Generic Patch");
  assert.ok(catalog.searchHardwareProfiles(withSKU.sku).includes(withSKU));
  assert.ok(catalog.searchHardwareProfiles("Access Points").some((profile) => profile.vendor === "HPE Aruba"));
});

test("device search has no phantom matches and keeps dedicated patch panels in their own installer", () => {
  assert.deepEqual(catalog.searchHardwareProfiles("no-such-device-xyz"), []);
  assert.deepEqual(catalog.searchHardwareProfiles("   "), []);
  assert.ok(catalog.searchHardwareProfiles("Generic Patch").every((profile) => profile.vendor !== "Generic Patch"));
});
