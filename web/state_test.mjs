import assert from "node:assert/strict";
import test from "node:test";

import { AppState, findPort } from "./static/js/state.js";

function topology() {
  return {
    id: "topology-1",
    racks: [{ id: "rack-1" }],
    devices: [{ id: "device-1", ports: [{ id: "port-1", label: "1" }] }],
    links: [{ id: "link-1" }],
    annotations: [{ id: "annotation-1" }],
  };
}

test("topology state clones inputs and reports typed changes", () => {
  const state = new AppState();
  const changes = [];
  state.addEventListener("change", (event) => changes.push(event.detail.kind));
  const source = topology();
  state.setTopology(source);
  source.devices[0].ports[0].label = "mutated outside state";
  assert.equal(state.topology.devices[0].ports[0].label, "1");

  state.select("device", "device-1");
  state.setAnalysis({ issues: [{ code: "warning" }], loops: [], stp: [] });
  state.setTrace(["link-1", "link-2"]);
  state.setRackFace("rack-1", "rear");
  assert.deepEqual(changes, ["topology", "selection", "analysis", "trace", "rack-view"]);
  assert.deepEqual([...state.traceLinkIDs], ["link-1", "link-2"]);
  assert.equal(state.rackFace("rack-1"), "rear");
  state.setAnalysis(null);
  assert.deepEqual(state.analysis, { issues: [], loops: [], stp: [] });
  state.select("", "");
  assert.equal(state.selection, null);
});

test("commit, undo, and redo preserve independent snapshots", () => {
  const state = new AppState();
  let mutationCalled = false;
  state.commit(() => { mutationCalled = true; });
  assert.equal(mutationCalled, false);
  assert.equal(state.undo(), false);
  assert.equal(state.redo(), false);

  state.setTopology(topology());
  state.commit((current) => { current.devices[0].name = "Updated"; });
  assert.equal(state.topology.devices[0].name, "Updated");
  assert.equal(state.undo(), true);
  assert.equal(state.topology.devices[0].name, undefined);
  assert.equal(state.redo(), true);
  assert.equal(state.topology.devices[0].name, "Updated");

  state.undo();
  state.commit((current) => { current.devices[0].name = "Alternative"; });
  assert.equal(state.redo(), false, "a fresh commit must discard the redo branch");

  for (let index = 0; index < 55; index += 1) {
    state.setTopology({ ...topology(), id: `topology-${index}` }, { remember: true });
  }
  assert.equal(state.history.length, 50);
});

test("selection survives only while its object exists", () => {
  const cases = [
    ["rack", "rack-1", (value) => { value.racks = []; }],
    ["device", "device-1", (value) => { value.devices = []; }],
    ["link", "link-1", (value) => { value.links = []; }],
    ["port", "port-1", (value) => { value.devices[0].ports = []; }],
    ["annotation", "annotation-1", (value) => { value.annotations = []; }],
    ["unknown", "missing", () => {}],
  ];
  for (const [type, id, remove] of cases) {
    const state = new AppState();
    state.setTopology(topology());
    state.select(type, id);
    const replacement = topology();
    remove(replacement);
    state.setTopology(replacement);
    assert.equal(state.selection, null, `${type} selection should be cleared`);
  }
});

test("findPort returns its owning device and tolerates missing data", () => {
  const value = topology();
  assert.deepEqual(findPort(value, "port-1"), { device: value.devices[0], port: value.devices[0].ports[0] });
  assert.equal(findPort(value, "missing"), null);
  assert.equal(findPort(null, "port-1"), null);
});
