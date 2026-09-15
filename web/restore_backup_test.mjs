import assert from "node:assert/strict";
import { test } from "node:test";
import { parseTopologyBackup, restoreAsNewMap } from "./static/js/restore-backup.js";

const backup = { id: "original", revision: 99, name: "Original", devices: [], links: [], vlans: [], photos: [{ id: "photo" }], shareGrants: [{ token: "secret" }] };
const created = { id: "new", revision: 1, name: "Restored", createdAt: "today", organizationId: "target", organization: "Target" };

test("backup parsing rejects malformed documents before creating a map", () => {
  for (const text of ["null", "{}", "[]", "invalid", '{"devices":[],"links":[],"vlans":{}}']) assert.throws(() => parseTopologyBackup(text));
  assert.deepEqual(parseTopologyBackup(JSON.stringify(backup)), backup);
});

test("new-map restore uses the fresh identity and revision, excluding photos and share grants", async () => {
  const original = structuredClone(backup);
  const result = await restoreAsNewMap({
    createTopology: async (input) => { assert.equal(input.template, "blank"); return created; },
    replaceTopology: async (input) => input,
  }, backup, { name: "Restored", organizationId: "target", location: "Vienna" });
  assert.equal(result.id, "new");
  assert.equal(result.revision, 1);
  assert.equal(result.createdAt, "today");
  assert.equal(result.organizationId, "target");
  assert.equal(result.location, "Vienna");
  assert.deepEqual(result.photos, []);
  assert.deepEqual(result.shareGrants, []);
  assert.deepEqual(backup, original);
});

test("failed restore cleans up only the unchanged new map", async () => {
  const calls = [];
  await assert.rejects(restoreAsNewMap({
    createTopology: async () => created,
    replaceTopology: async () => { throw new Error("Invalid backup"); },
    deleteTopology: async (...args) => calls.push(args),
  }, backup, {}), /Invalid backup/);
  assert.deepEqual(calls, [["new", 1]]);
});

test("uncertain restore preserves changed maps and tells the user to check before retrying", async () => {
  await assert.rejects(restoreAsNewMap({
    createTopology: async () => created,
    replaceTopology: async () => { throw new Error("Connection lost"); },
    deleteTopology: async () => { throw new Error("Revision conflict"); },
  }, backup, {}), /Check the map list for "Restored" before retrying/);
});
