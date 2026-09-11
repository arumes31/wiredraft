import assert from "node:assert/strict";
import test from "node:test";
import { EditorLock, EditMode, IDLE_LOCK_MS, sameDocument, connectionChangesOnly, requiredRequestCapability } from "./static/js/editor-lock.js";
import { AppState } from "./static/js/state.js";
import { api } from "./static/js/api.js";

function fixture() {
  let now = 1000;
  let scheduled;
  const lock = new EditorLock({ now: () => now, schedule: (fn) => { scheduled = fn; return 1; }, unschedule: () => {} });
  return { lock, advance: (ms) => { now += ms; }, fire: () => scheduled() };
}
function topology() {
  return { id: "map", revision: 1, devices: [{ id: "device", positionX: 10, ports: [{ id: "p", mode: "Access", nativeVlan: 1 }] }], links: [], racks: [], vlans: [] };
}

test("default browser timers keep their global receiver when the editor unlocks", () => {
  const originalSchedule = globalThis.setTimeout;
  const originalUnschedule = globalThis.clearTimeout;
  let scheduled = 0;
  let cancelled = 0;
  globalThis.setTimeout = function () {
    assert.equal(this, globalThis);
    scheduled++;
    return 42;
  };
  globalThis.clearTimeout = function () {
    assert.equal(this, globalThis);
    cancelled++;
  };
  try {
    const lock = new EditorLock();
    lock.setMode(EditMode.ALL);
    assert.equal(lock.mode, EditMode.ALL);
    assert.equal(scheduled, 1);
    lock.destroy();
    assert.equal(cancelled, 2);
  } finally {
    globalThis.setTimeout = originalSchedule;
    globalThis.clearTimeout = originalUnschedule;
  }
});

test("editor starts locked and separates cabling from equipment", () => {
  const { lock } = fixture();
  assert.equal(lock.mode, EditMode.READ_ONLY);
  assert.equal(lock.allows("cabling"), false);
  lock.setMode(EditMode.CABLING);
  assert.equal(lock.allows("cabling"), true);
  assert.equal(lock.allows("all"), false);
  lock.setMode(EditMode.ALL);
  assert.equal(lock.allows("all"), true);
  lock.setMode("invalid");
  assert.equal(lock.mode, EditMode.READ_ONLY);
});

test("wall-clock expiry is checked before edits even when the timer was suspended", () => {
  const { lock, advance } = fixture();
  lock.setMode(EditMode.ALL);
  advance(IDLE_LOCK_MS);
  assert.equal(lock.allows("all"), false);
  assert.equal(lock.mode, EditMode.READ_ONLY);
});

test("actual edits extend the deadline; navigation, no-ops and mode changes do not", () => {
  const { lock, advance, fire } = fixture();
  lock.setMode(EditMode.ALL);
  advance(IDLE_LOCK_MS - 1);
  lock.allows("all");
  lock.setMode(EditMode.CABLING);
  lock.recordChange(topology(), { ...topology(), revision: 2, updatedAt: "later" });
  advance(1);
  fire();
  assert.equal(lock.mode, EditMode.READ_ONLY);
  lock.setMode(EditMode.ALL);
  advance(1000);
  lock.recordChange(topology(), { ...topology(), name: "Changed" });
  advance(IDLE_LOCK_MS - 1);
  assert.equal(lock.allows("all"), true);
  advance(1);
  assert.equal(lock.allows("all"), false);
});

test("late responses cannot unlock an expired or explicitly locked editor", () => {
  const { lock, advance } = fixture();
  lock.setMode(EditMode.ALL);
  advance(IDLE_LOCK_MS);
  lock.recordChange(topology(), { ...topology(), name: "Changed" });
  assert.equal(lock.mode, EditMode.READ_ONLY);
  lock.setMode(EditMode.ALL);
  lock.setMode(EditMode.READ_ONLY);
  lock.recordChange(topology(), { ...topology(), name: "Changed" });
  assert.equal(lock.mode, EditMode.READ_ONLY);
});

test("connection history allows linked port profiles but rejects equipment changes", () => {
  const before = topology();
  const after = structuredClone(before);
  after.links.push({ id: "link", sourcePortId: "p", targetPortId: "q", primaryVlan: 2 });
  after.devices[0].ports[0].nativeVlan = 2;
  assert.equal(connectionChangesOnly(before, after), true);
  after.devices[0].positionX = 20;
  assert.equal(connectionChangesOnly(before, after), false);
  assert.equal(sameDocument(before, { ...before, revision: 9 }), true);
});

test("state blocks commits and equipment undo without losing history", () => {
  const { lock } = fixture();
  const state = new AppState({ editLock: lock });
  state.setTopology(topology());
  assert.equal(state.commit((map) => { map.name = "Blocked"; }), false);
  assert.equal(state.topology.name, undefined);
  lock.setMode(EditMode.ALL);
  state.commit((map) => { map.name = "Allowed"; });
  lock.setMode(EditMode.CABLING);
  assert.equal(state.undo(), false);
  assert.equal(state.history.length, 1);
  state.commit((map) => { map.links.push({ id: "link" }); });
  assert.equal(state.undo(), true);
  assert.equal(state.undo(), false);
  assert.equal(state.redo(), true);
  lock.setMode(EditMode.READ_ONLY);
  assert.equal(state.undo(), false);
});

test("API guard blocks writes before fetch but allows read requests", async () => {
  const originalFetch = globalThis.fetch;
  let fetched = 0;
  globalThis.fetch = async () => { fetched++; return { ok: true, status: 200, json: async () => topology() }; };
  api.setMutationGuard(() => { throw new Error("Locked"); });
  try {
    await assert.rejects(api.deleteLink("map", "link"), /Locked/);
    assert.equal(fetched, 0);
    await api.getTopology("map");
    assert.equal(fetched, 1);
  } finally {
    api.setMutationGuard(null);
    globalThis.fetch = originalFetch;
  }
});

test("every topology mutation uses a capability, including whole-document replacements", () => {
  const current = topology();
  for (const resource of ["links", "link-groups"]) {
    for (const method of ["POST", "PUT", "DELETE"]) assert.equal(requiredRequestCapability(`/api/v1/topologies/map/${resource}/id`, method), "cabling");
  }
  for (const resource of ["devices", "ports", "racks", "vlans", "annotations", "photos", "shares", "documentation-links", "comments", "switch-systems", "firewall-clusters", "unknown"]) {
    assert.equal(requiredRequestCapability(`/api/v1/topologies/map/${resource}`, "POST"), "all");
  }
  assert.equal(requiredRequestCapability("/api/v1/topologies/map", "DELETE"), "all");
  assert.equal(requiredRequestCapability("/api/v1/topologies/map", "PUT", JSON.stringify(current), current), null);
  assert.equal(requiredRequestCapability("/api/v1/topologies/map", "PUT", JSON.stringify({ ...current, links: [{ id: "new" }] }), current), "cabling");
  assert.equal(requiredRequestCapability("/api/v1/topologies/map", "PUT", JSON.stringify({ ...current, name: "Changed" }), current), "all");
  assert.equal(requiredRequestCapability("/api/v1/auth/logout", "POST"), null);
});

test("no-op commits leave history and idle deadline untouched, and switching maps locks", () => {
  const { lock, advance } = fixture();
  const state = new AppState({ editLock: lock });
  state.setTopology(topology());
  lock.setMode(EditMode.ALL);
  const deadline = lock.deadline;
  advance(1000);
  assert.equal(state.commit(() => {}), false);
  assert.equal(state.history.length, 0);
  assert.equal(lock.deadline, deadline);
  state.setTopology({ ...topology(), revision: 2 });
  assert.equal(lock.mode, EditMode.ALL, "remote updates do not relock or reset idle time");
  assert.equal(lock.deadline, deadline);
  state.setTopology({ ...topology(), id: "other" });
  assert.equal(lock.mode, EditMode.READ_ONLY);
  lock.destroy();
});
