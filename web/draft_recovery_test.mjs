import assert from "node:assert/strict";
import { test } from "node:test";
import { DraftRecovery } from "./static/js/draft-recovery.js";

const map = { id: "map", organizationId: "org", revision: 1, name: "Network", annotations: [] };
function storage() {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}

test("a newer server revision retains a downloadable local draft across reloads", () => {
  const disk = storage();
  const drafts = new DraftRecovery("alice", disk);
  const local = { ...map, annotations: [{ id: "note", text: "Local work" }] };
  drafts.capture(local);
  drafts.accept({ ...map, revision: 2, name: "Remote work" });
  local.annotations[0].text = "Changed again";
  assert.equal(drafts.recoveries[0].topology.annotations[0].text, "Local work");
  assert.equal(new DraftRecovery("alice", disk).recoveries.length, 1);
  assert.equal(new DraftRecovery("bob", disk).recoveries.length, 0);
});

test("acknowledging identical saved content clears only its pending draft", () => {
  const drafts = new DraftRecovery("alice", storage());
  drafts.capture(map);
  drafts.accept({ ...map, revision: 2, updatedAt: "now" });
  assert.equal(drafts.recoveries.length, 0);
  drafts.capture(map);
  drafts.accept({ ...map, name: "Remote", revision: 3 });
  drafts.capture({ ...map, name: "Next" });
  drafts.accept({ ...map, name: "Next", revision: 4 });
  assert.equal(drafts.recoveries.length, 1);
  drafts.discard(drafts.recoveries[0].id);
  assert.equal(drafts.recoveries.length, 0);
});

test("reload offers unfinished drafts, while explicit discard removes pending work", () => {
  const disk = storage();
  const drafts = new DraftRecovery("alice", disk);
  drafts.capture(map);
  assert.equal(new DraftRecovery("alice", disk).recoveries.length, 1);
  drafts.discardPending(map.id);
  assert.equal(new DraftRecovery("alice", disk).recoveries.length, 0);
});

test("blocked or corrupt storage does not destroy the in-memory recovery", () => {
  const drafts = new DraftRecovery("alice", { getItem() { throw Error("blocked"); }, setItem() { throw Error("full"); } });
  drafts.capture(map);
  drafts.accept({ ...map, name: "Remote" });
  assert.equal(drafts.recoveries.length, 1);
  assert.ok(drafts.storageError);
  assert.equal(new DraftRecovery("alice", { getItem: () => "invalid", setItem() {} }).recoveries.length, 0);
});

test("successful writes acknowledge the submitted draft despite server JSON normalization", () => {
  const drafts = new DraftRecovery("alice", storage());
  const submitted = { ...map, annotations: [{ id: "box", type: "rectangle", text: "", x2: 0 }] };
  drafts.capture(submitted);
  drafts.acknowledge(submitted);
  drafts.accept({ ...map, revision: 2, annotations: [{ id: "box", type: "rectangle" }] });
  assert.equal(drafts.recoveries.length, 0);
  drafts.capture({ ...submitted, name: "Edited during the request" });
  drafts.acknowledge(submitted);
  drafts.accept({ ...map, revision: 3 });
  assert.equal(drafts.recoveries[0].topology.name, "Edited during the request");
});
