import assert from "node:assert/strict";
import test from "node:test";

import {
  TopologyCollaboration, absoluteShareURL, isRevisionConflict, validateDocumentationURL,
} from "./static/js/collaboration.js";
import { APIError } from "./static/js/api.js";

test("documentation URLs allow only credential-free HTTP(S)", () => {
  assert.equal(validateDocumentationURL("https://docs.example.test/runbook?id=4"), true);
  assert.equal(validateDocumentationURL("javascript:alert(1)"), false);
  assert.equal(validateDocumentationURL("https://user:secret@example.test/doc"), false);
  assert.equal(validateDocumentationURL(null), false);
  assert.equal(validateDocumentationURL("x".repeat(2049)), false);
  assert.equal(validateDocumentationURL("not a URL"), false);
  assert.equal(validateDocumentationURL("ftp://example.test/doc"), false);
});

test("share paths become absolute only below the read-only API", () => {
  assert.equal(
    absoluteShareURL("/api/v1/shared/topology/token", "https://diagram.example.test"),
    "https://diagram.example.test/api/v1/shared/topology/token",
  );
  assert.equal(absoluteShareURL("/api/v1/topologies/topology", "https://diagram.example.test"), "");
  assert.equal(absoluteShareURL(null, "https://diagram.example.test"), "");
  assert.equal(absoluteShareURL("/api/v1/shared/topology/token", ""), "");
});

test("revision conflicts require a usable current revision", () => {
  assert.equal(isRevisionConflict(new APIError("conflict", 409, { currentRevision: 8 })), true);
  assert.equal(isRevisionConflict(new APIError("conflict", 409, { currentRevision: 8.5 })), false);
  assert.equal(isRevisionConflict(new APIError("failure", 500)), false);
  assert.equal(isRevisionConflict(new Error("conflict")), false);
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

test("collaboration connection reports status and rejects malformed events", () => {
  const listeners = new Map();
  const statuses = [];
  let closed = 0;
  const source = {
    addEventListener(type, listener) { listeners.set(type, listener); },
    close() { closed += 1; },
  };
  const collaboration = new TopologyCollaboration({
    eventSourceFactory: () => source,
    onStatus: (status) => statuses.push(status),
  });
  collaboration.connect(null);
  assert.equal(collaboration.source, null);
  collaboration.connect({ id: "map / one", revision: "invalid" });
  source.onopen();
  source.onerror();
  assert.deepEqual(statuses, ["connecting", "online", "offline"]);
  assert.equal(collaboration.revision, 0);
  assert.equal(collaboration.receive({ data: "{" }, "topology_updated"), false);
  assert.equal(collaboration.receive({ data: JSON.stringify({ id: "other", revision: 1 }) }, "topology_updated"), false);
  assert.equal(collaboration.receive({ data: JSON.stringify({ id: "map / one", revision: "1" }) }, "topology_updated"), false);
  assert.equal(collaboration.receive({ data: JSON.stringify({ id: "map / one", revision: 1 }) }, "topology_updated"), true);
  collaboration.close();
  assert.equal(closed, 1);
  assert.equal(collaboration.source, null);
  assert.equal(collaboration.topologyID, "");
});
