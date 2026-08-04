const COMMENT_TARGET_KINDS = new Set(["device", "port", "link"]);

export function selectedCommentAnchor(selection) {
  if (!COMMENT_TARGET_KINDS.has(selection?.type) || !selection.id) return null;
  return { kind: selection.type, targetId: selection.id };
}

export function commentThreadsForAnchor(topology, kind, targetId, { includeResolved = false } = {}) {
  return (topology?.commentThreads || [])
    .filter((thread) => thread.anchor?.kind === kind
      && thread.anchor?.targetId === targetId
      && (includeResolved || !thread.resolved))
    .sort((left, right) => String(right.updatedAt || "").localeCompare(String(left.updatedAt || "")));
}

export function commentPreview(topology, kind, targetId, { maxThreads = 2, maxBodyLength = 110 } = {}) {
  const threads = commentThreadsForAnchor(topology, kind, targetId);
  const entries = threads.slice(0, maxThreads).map((thread) => {
    const message = thread.messages?.[thread.messages.length - 1] || {};
    return {
      author: compactCommentText(message.author || "Operator", 40),
      body: compactCommentText(message.body || "", maxBodyLength),
    };
  });
  return { count: threads.length, entries, remaining: Math.max(0, threads.length - entries.length) };
}

export function commentPreviewLines(topology, kind, targetId, options) {
  const preview = commentPreview(topology, kind, targetId, options);
  if (!preview.count) return [];
  return [
    `COMMENTS · ${preview.count} OPEN`,
    ...preview.entries.map((entry) => `${entry.author} · ${entry.body}`),
    ...(preview.remaining ? [`+${preview.remaining} MORE COMMENT${preview.remaining === 1 ? "" : "S"}`] : []),
  ];
}

export function commentAnchorLabel(topology, anchor) {
  if (!anchor) return "TOPOLOGY";
  if (anchor.kind === "canvas") return `CANVAS · ${Math.round(anchor.x || 0)}, ${Math.round(anchor.y || 0)}`;
  if (anchor.kind === "device") {
    const device = topology?.devices?.find((item) => item.id === anchor.targetId);
    return `DEVICE · ${device?.name || shortID(anchor.targetId)}`;
  }
  if (anchor.kind === "port") {
    const found = findTopologyPort(topology, anchor.targetId);
    return `PORT · ${found ? `${found.device.name} / ${found.port.label}` : shortID(anchor.targetId)}`;
  }
  if (anchor.kind === "link") {
    const link = topology?.links?.find((item) => item.id === anchor.targetId);
    if (link) {
      const source = findTopologyPort(topology, link.sourcePortId);
      const target = findTopologyPort(topology, link.targetPortId);
      if (source && target) return `LINK · ${source.device.name}:${source.port.label} → ${target.device.name}:${target.port.label}`;
    }
    return `LINK · ${shortID(anchor.targetId)}`;
  }
  return `${String(anchor.kind || "target").toUpperCase()} · ${shortID(anchor.targetId)}`;
}

function compactCommentText(value, maximumLength) {
  const compact = String(value).replace(/\s+/g, " ").trim();
  if (compact.length <= maximumLength) return compact;
  return `${compact.slice(0, Math.max(0, maximumLength - 1)).trimEnd()}…`;
}

function findTopologyPort(topology, portID) {
  for (const device of topology?.devices || []) {
    const port = device.ports?.find((item) => item.id === portID);
    if (port) return { device, port };
  }
  return null;
}

function shortID(value) {
  return String(value || "UNKNOWN").slice(0, 8);
}
