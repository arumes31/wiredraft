import assert from "node:assert/strict";
import test from "node:test";

import {
  TopologyCollaboration, absoluteShareURL, validateDocumentationURL,
} from "./static/js/collaboration.js";

test("documentation URLs allow only credential-free HTTP(S)", () => {
  assert.equal(validateDocumentationURL("https://docs.example.test/runbook?id=4"), true);
  assert.equal(validateDocumentationURL("javascript:alert(1)"), false);
  assert.equal(validateDocumentationURL("https://user:secret@example.test/doc"), false);
});

test("share paths become absolute only below the read-only API", () => {
  assert.equal(
    absoluteShareURL("/api/v1/shared/topology/token", "https://diagram.example.test"),
    "https://diagram.example.test/api/v1/shared/topology/token",
  );
  assert.equal(absoluteShareURL("/api/v1/topologies/topology", "https://diagram.example.test"), "");
});

test("collaboration applies fresh snapshots and ignores stale echoes", () => {
  const listeners = new Map();
  const received = [];
  const gaps = [];
  const source = {
    addEventListener(type, listener) { listeners.set(type, listener); },
    close() {},
  };
  const collaboration = new TopologyCollaboration({
    eventSourceFactory: () => source,
    onTopology: (topology, type) => received.push([topology.revision, type]),
    onRevisionGap: (gap) => gaps.push(gap),
  });
  collaboration.connect({ id: "topology-a", revision: 4 });
  listeners.get("device_moved")({ data: JSON.stringify({ id: "topology-a", revision: 5 }) });
  listeners.get("device_moved")({ data: JSON.stringify({ id: "topology-a", revision: 4 }) });
  listeners.get("comment_created")({ data: JSON.stringify({ id: "topology-a", revision: 8 }) });
  assert.deepEqual(received, [[5, "device_moved"], [8, "comment_created"]]);
  assert.deepEqual(gaps, [{ expected: 6, received: 8 }]);
});
