import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  COLLABORATION_EVENT_TYPES, TopologyCollaboration, absoluteShareURL, isRevisionConflict, validateDocumentationURL,
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

test("client subscribes to every collaboration event published by the server", () => {
  const sources = [
    readFileSync(new URL("../internal/handler/server.go", import.meta.url), "utf8"),
    readFileSync(new URL("../internal/handler/photos.go", import.meta.url), "utf8"),
  ].join("\n");
  const published = new Set([...sources.matchAll(/s\.publish\([^,]+,\s*"([a-z_]+)"/g)].map((match) => match[1]));
  assert.deepEqual([...COLLABORATION_EVENT_TYPES].sort(), [...published].sort());
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
  const opens = [];
  let closed = 0;
  const source = {
    addEventListener(type, listener) { listeners.set(type, listener); },
    close() { closed += 1; },
  };
  const collaboration = new TopologyCollaboration({
    eventSourceFactory: () => source,
    onStatus: (status) => statuses.push(status),
    onOpen: (detail) => opens.push(detail),
  });
  collaboration.connect(null);
  assert.equal(collaboration.source, null);
  collaboration.connect({ id: "map / one", revision: "invalid" });
  source.onopen();
  source.onopen();
  source.onerror();
  assert.deepEqual(statuses, ["connecting", "online", "online", "offline"]);
  assert.deepEqual(opens, [
    { topologyID: "map / one", revision: 0 },
    { topologyID: "map / one", revision: 0 },
  ]);
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

test("collaboration explicitly reconnects with bounded backoff", () => {
  const sources = [];
  const timers = [];
  const statuses = [];
  const opens = [];
  const collaboration = new TopologyCollaboration({
    eventSourceFactory: (url) => {
      const source = {
        url,
        closed: false,
        listeners: new Map(),
        addEventListener(type, listener) { this.listeners.set(type, listener); },
        close() { this.closed = true; },
      };
      sources.push(source);
      return source;
    },
    setTimeoutFn: (callback, delay) => {
      timers.push({ callback, delay });
      return timers.length;
    },
    clearTimeoutFn: () => {},
    onStatus: (status) => statuses.push(status),
    onOpen: (detail) => opens.push(detail),
  });

  collaboration.connect({ id: "shared topology", revision: 7 });
  assert.equal(sources[0].url, "/api/v1/topologies/shared%20topology/events");
  sources[0].onerror();
  assert.equal(sources[0].closed, true);
  assert.equal(timers[0].delay, 1000);
  timers[0].callback();
  assert.equal(sources.length, 2);
  sources[1].onopen();
  assert.deepEqual(statuses, ["connecting", "offline", "connecting", "online"]);
  assert.deepEqual(opens, [{ topologyID: "shared topology", revision: 7 }]);
  assert.equal(collaboration.retry, 1000, "a successful reconnect must reset backoff");

  collaboration.close();
  const sourceCount = sources.length;
  sources[1].onerror();
  assert.equal(sources.length, sourceCount, "closed collaboration must ignore stale source callbacks");
});
