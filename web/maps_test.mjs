import assert from "node:assert/strict";
import test from "node:test";

import {
  nextMapName, organizationLocationOptions, preferredTopologyID, topologyOptionLabel,
} from "./static/js/maps.js";

test("the remembered map is restored only while it still exists", () => {
  const topologies = [{ id: "newest", name: "Newest" }, { id: "remembered", name: "Remembered" }];
  assert.equal(preferredTopologyID(topologies, "remembered"), "remembered");
  assert.equal(preferredTopologyID(topologies, "deleted"), "newest");
  assert.equal(preferredTopologyID([], "remembered"), "");
});

test("new maps receive the first available control-room sequence", () => {
  assert.equal(nextMapName([]), "NETWORK MAP 01");
  assert.equal(nextMapName([{ name: "Network Map 01" }, { name: "NETWORK MAP 03" }]), "NETWORK MAP 02");
});

test("organization choices retain all of their distinct locations", () => {
  assert.deepEqual(organizationLocationOptions([
    { organization: "Example Corp", location: "Vienna DC1" },
    { organization: "Example Corp", location: "Graz Branch" },
    { organization: "Another Org", location: "Berlin" },
    { organization: "Example Corp", location: "Vienna DC1" },
    { organization: "", location: "Legacy" },
  ]), [
    { organization: "Another Org", locations: ["Berlin"] },
    { organization: "Example Corp", locations: ["Graz Branch", "Vienna DC1"] },
  ]);
});

test("map labels expose organization and location without hiding the map name", () => {
  assert.equal(topologyOptionLabel({ name: "Core", organization: "Example Corp", location: "Vienna" }),
    "Example Corp · Vienna / Core");
  assert.equal(topologyOptionLabel({ name: "Legacy" }), "UNASSIGNED / Legacy");
});
