import assert from "node:assert/strict";
import test from "node:test";

import {
  commentAnchorLabel, commentPreview, commentPreviewLines, commentThreadsForAnchor, selectedCommentAnchor,
} from "./static/js/plan-comments.js";

test("object selections become persistent device, port, and link plan comment anchors", () => {
  assert.deepEqual(selectedCommentAnchor({ type: "device", id: "device-a" }), { kind: "device", targetId: "device-a" });
  assert.deepEqual(selectedCommentAnchor({ type: "port", id: "port-a" }), { kind: "port", targetId: "port-a" });
  assert.deepEqual(selectedCommentAnchor({ type: "link", id: "link-a" }), { kind: "link", targetId: "link-a" });
  assert.equal(selectedCommentAnchor({ type: "rack", id: "rack-a" }), null);
});

test("plan comment previews show recent open notes without unrelated or resolved threads", () => {
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
