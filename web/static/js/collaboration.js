import { APIError } from "./api.js";

export const COLLABORATION_EVENT_TYPES = Object.freeze([
  "topology_updated", "rack_created", "rack_updated", "rack_deleted",
  "device_created", "device_moved", "device_deleted", "port_updated",
  "link_created", "links_created", "link_configured", "link_deleted",
  "link_group_created", "link_group_updated", "link_group_deleted",
  "switch_system_created", "switch_system_updated", "switch_system_deleted",
  "firewall_cluster_created", "firewall_cluster_updated", "firewall_cluster_deleted",
  "vlan_changed", "comment_created", "comment_replied", "comment_updated",
  "comment_deleted", "documentation_link_created", "documentation_link_deleted",
  "share_created", "share_deleted",
]);

export function isRevisionConflict(error) {
  return error instanceof APIError && error.status === 409
    && Number.isSafeInteger(error.details?.currentRevision);
}

export function validateDocumentationURL(value) {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const parsed = new URL(value);
    return ["http:", "https:"].includes(parsed.protocol)
      && Boolean(parsed.hostname) && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

export function absoluteShareURL(path, origin = globalThis.location?.origin) {
  if (!origin || typeof path !== "string" || !path.startsWith("/api/v1/shared/")) return "";
  return new URL(path, origin).href;
}

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

export class TopologyCollaboration {
  constructor({ onTopology, onStatus = () => {}, onRevisionGap = () => {}, eventSourceFactory } = {}) {
    this.onTopology = onTopology;
    this.onStatus = onStatus;
    this.onRevisionGap = onRevisionGap;
    this.eventSourceFactory = eventSourceFactory || ((url) => new EventSource(url));
    this.source = null;
    this.topologyID = "";
    this.revision = 0;
  }

  connect(topology) {
    this.close();
    if (!topology?.id) return;
    this.topologyID = topology.id;
    this.revision = Number.isSafeInteger(topology.revision) ? topology.revision : 0;
    this.onStatus("connecting");
    const source = this.eventSourceFactory(`/api/v1/topologies/${encodeURIComponent(topology.id)}/events`);
    this.source = source;
    source.onopen = () => this.onStatus("online");
    source.onerror = () => this.onStatus("offline");
    for (const eventType of COLLABORATION_EVENT_TYPES) {
      source.addEventListener(eventType, (event) => this.receive(event, eventType));
    }
  }

  receive(event, eventType) {
    let topology;
    try {
      topology = JSON.parse(event.data);
    } catch {
      return false;
    }
    if (topology.id !== this.topologyID || !Number.isSafeInteger(topology.revision)) return false;
    if (topology.revision <= this.revision) return false;
    if (this.revision > 0 && topology.revision > this.revision + 1) {
      this.onRevisionGap({ expected: this.revision + 1, received: topology.revision });
    }
    this.revision = topology.revision;
    this.onTopology?.(topology, eventType);
    return true;
  }

  close() {
    this.source?.close();
    this.source = null;
    this.topologyID = "";
    this.revision = 0;
  }
}
