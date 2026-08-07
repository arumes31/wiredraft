import { APIError } from "./api.js";

export const COLLABORATION_EVENT_TYPES = Object.freeze([
  "topology_updated", "rack_created", "rack_updated", "rack_deleted",
  "device_created", "device_moved", "device_deleted", "port_updated",
  "link_created", "links_created", "link_configured", "link_direction_updated", "link_deleted",
  "link_group_created", "link_group_updated", "link_group_deleted",
  "switch_system_created", "switch_system_updated", "switch_system_deleted",
  "firewall_cluster_created", "firewall_cluster_updated", "firewall_cluster_deleted",
  "vlan_changed", "comment_created", "comment_replied", "comment_updated",
  "comment_deleted", "documentation_link_created", "documentation_link_deleted",
  "share_created", "share_deleted",
  "photos_uploaded", "photo_updated", "photo_deleted",
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

export class TopologyCollaboration {
  constructor({
    onTopology,
    onStatus = () => {},
    onRevisionGap = () => {},
    onOpen = () => {},
    eventSourceFactory,
    setTimeoutFn = globalThis.setTimeout?.bind(globalThis),
    clearTimeoutFn = globalThis.clearTimeout?.bind(globalThis),
  } = {}) {
    this.onTopology = onTopology;
    this.onStatus = onStatus;
    this.onRevisionGap = onRevisionGap;
    this.onOpen = onOpen;
    this.eventSourceFactory = eventSourceFactory || ((url) => new EventSource(url));
    this.setTimeoutFn = setTimeoutFn;
    this.clearTimeoutFn = clearTimeoutFn;
    this.source = null;
    this.topologyID = "";
    this.revision = 0;
    this.retry = 1000;
    this.timer = 0;
    this.stopped = true;
  }

  connect(topology) {
    this.close();
    if (!topology?.id) return;
    this.topologyID = topology.id;
    this.revision = Number.isSafeInteger(topology.revision) ? topology.revision : 0;
    this.retry = 1000;
    this.stopped = false;
    this.open();
  }

  open() {
    if (this.stopped || !this.topologyID) return;
    this.onStatus("connecting");
    const source = this.eventSourceFactory(`/api/v1/topologies/${encodeURIComponent(this.topologyID)}/events`);
    this.source = source;
    source.onopen = () => {
      if (this.stopped || this.source !== source) return;
      this.retry = 1000;
      this.onStatus("online");
      this.onOpen({ topologyID: this.topologyID, revision: this.revision });
    };
    source.onerror = () => {
      if (this.stopped || this.source !== source) return;
      source.close();
      this.source = null;
      this.onStatus("offline");
      this.clearTimeoutFn?.(this.timer);
      const delay = this.retry;
      this.timer = this.setTimeoutFn?.(() => this.open(), delay) || 0;
      this.retry = Math.min(this.retry * 2, 30000);
    };
    for (const eventType of COLLABORATION_EVENT_TYPES) {
      source.addEventListener(eventType, (event) => {
        if (this.source === source) this.receive(event, eventType);
      });
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
    this.stopped = true;
    this.clearTimeoutFn?.(this.timer);
    this.timer = 0;
    this.source?.close();
    this.source = null;
    this.topologyID = "";
    this.revision = 0;
  }
}
