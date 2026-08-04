import assert from "node:assert/strict";
import test from "node:test";

import {
  TopologyCollaboration, absoluteShareURL, commentAnchorLabel, commentPreview, commentPreviewLines,
  commentThreadsForAnchor, selectedCommentAnchor, validateDocumentationURL,
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

test("object selections become persistent device, port, and link comment anchors", () => {
  assert.deepEqual(selectedCommentAnchor({ type: "device", id: "device-a" }), { kind: "device", targetId: "device-a" });
  assert.deepEqual(selectedCommentAnchor({ type: "port", id: "port-a" }), { kind: "port", targetId: "port-a" });
  assert.deepEqual(selectedCommentAnchor({ type: "link", id: "link-a" }), { kind: "link", targetId: "link-a" });
  assert.equal(selectedCommentAnchor({ type: "rack", id: "rack-a" }), null);
});

test("hover comment previews show recent open notes without unrelated or resolved threads", () => {
  const topology = {
    devices: [
      { id: "device-a", name: "CORE 01", ports: [{ id: "port-a", label: "1/1/48" }] },
      { id: "device-b", name: "EDGE 01", ports: [{ id: "port-b", label: "WAN1" }] },
    ],
    links: [{ id: "link-a", sourcePortId: "port-a", targetPortId: "port-b" }],
    commentThreads: [
      { id: "old", anchor: { kind: "link", targetId: "link-a" }, updatedAt: "2026-08-04T08:00:00Z", messages: [{ author: "Alex", body: "Older note" }] },
      { id: "new", anchor: { kind: "link", targetId: "link-a" }, updatedAt: "2026-08-04T10:00:00Z", messages: [{ author: "Daniel", body: "Check\noptical levels before migration" }] },
      { id: "resolved", anchor: { kind: "link", targetId: "link-a" }, resolved: true, updatedAt: "2026-08-04T11:00:00Z", messages: [{ author: "NOC", body: "Already fixed" }] },
      { id: "other", anchor: { kind: "port", targetId: "port-a" }, updatedAt: "2026-08-04T12:00:00Z", messages: [{ author: "NOC", body: "Port-only note" }] },
    ],
  };
  assert.deepEqual(commentThreadsForAnchor(topology, "link", "link-a").map((thread) => thread.id), ["new", "old"]);
  assert.deepEqual(commentThreadsForAnchor(topology, "link", "link-a", { includeResolved: true }).map((thread) => thread.id), ["resolved", "new", "old"]);
  assert.deepEqual(commentPreview(topology, "link", "link-a", { maxThreads: 1 }), {
    count: 2,
    entries: [{ author: "Daniel", body: "Check optical levels before migration" }],
    remaining: 1,
  });
  assert.deepEqual(commentPreviewLines(topology, "link", "link-a", { maxThreads: 1 }), [
    "COMMENTS · 2 OPEN", "Daniel · Check optical levels before migration", "+1 MORE COMMENT",
  ]);
  assert.equal(commentAnchorLabel(topology, { kind: "port", targetId: "port-a" }), "PORT · CORE 01 / 1/1/48");
  assert.equal(commentAnchorLabel(topology, { kind: "link", targetId: "link-a" }), "LINK · CORE 01:1/1/48 → EDGE 01:WAN1");
});
