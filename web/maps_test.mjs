import assert from "node:assert/strict";
import test from "node:test";

import { nextMapName, preferredTopologyID } from "./static/js/maps.js";

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
