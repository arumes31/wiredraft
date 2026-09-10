import { sameDocument } from "./editor-lock.js";

function clone(value) {
  return value == null ? value : structuredClone(value);
}

export class AppState extends EventTarget {
  /** Initialize topology history and independent local view preferences. */
  constructor({ editLock = null } = {}) {
    super();
    this.editLock = editLock;
    this.topology = null;
    this.selection = null;
    this.analysis = { issues: [], loops: [], stp: [] };
    this.traceLinkIDs = new Set();
    this.rackFaces = new Map();
    this.deviceFaceplateFaces = new Map();
    this.dualFaceRackIDs = new Set();
    this.history = [];
    this.future = [];
  }

  /** Replace the map snapshot and retain local views only for live entities. */
  setTopology(topology, { remember = false } = {}) {
    if (this.editLock && this.topology?.id !== topology?.id) this.editLock.setMode("read-only", "map");
    if (remember && this.topology) {
      this.history.push(clone(this.topology));
      this.history = this.history.slice(-50);
      this.future = [];
    }
    this.topology = clone(topology);
    const liveRackIDs = new Set((this.topology?.racks || []).map((rack) => rack.id));
    const liveLinkIDs = new Set((this.topology?.links || []).map((link) => link.id));
    const liveDeviceIDs = new Set((this.topology?.devices || []).map((device) => device.id));
    this.deviceFaceplateFaces = new Map([...this.deviceFaceplateFaces].filter(([deviceID]) => liveDeviceIDs.has(deviceID)));
    this.rackFaces = new Map([...this.rackFaces].filter(([rackID]) => liveRackIDs.has(rackID)));
    this.dualFaceRackIDs = new Set([...this.dualFaceRackIDs].filter((rackID) => liveRackIDs.has(rackID)));
    this.traceLinkIDs = new Set([...this.traceLinkIDs].filter((linkID) => liveLinkIDs.has(linkID)));
    this.ensureSelection();
    this.emit("topology");
  }

  commit(mutator) {
    if (!this.topology) return false;
    const next = clone(this.topology);
    mutator(next);
    if (this.editLock && (!this.editLock.allowsChange(this.topology, next) || sameDocument(this.topology, next))) return false;
    this.history.push(clone(this.topology));
    this.history = this.history.slice(-50);
    this.future = [];
    this.editLock?.recordChange(this.topology, next);
    this.topology = next;
    this.emit("topology");
    return true;
  }

  select(type, id) {
    this.selection = type && id ? { type, id } : null;
    this.emit("selection");
  }

  setAnalysis(analysis) {
    this.analysis = analysis || { issues: [], loops: [], stp: [] };
    this.emit("analysis");
  }

  setTrace(linkIDs) {
    this.traceLinkIDs = new Set(linkIDs || []);
    this.emit("trace");
  }

  rackFace(rackID) {
    return this.rackFaces.get(rackID) === "rear" ? "rear" : "front";
  }

  setRackFace(rackID, face) {
    if (!rackID) return;
    this.rackFaces.set(rackID, face === "rear" ? "rear" : "front");
    this.emit("rack-view");
  }

  /** Resolve the local hardware panel selection, honoring the model's default. */
  deviceFaceplateFace(deviceID, defaultFace = "front") {
    return (this.deviceFaceplateFaces.get(deviceID) ?? defaultFace) === "rear" ? "rear" : "front";
  }

  /** Change a hardware panel view without modifying inventory or rack mounting. */
  setDeviceFaceplateFace(deviceID, face) {
    if (!deviceID) return;
    const next = face === "rear" ? "rear" : "front";
    if (this.deviceFaceplateFaces.get(deviceID) === next) return;
    this.deviceFaceplateFaces.set(deviceID, next);
    this.emit("device-view");
  }

  isRackDualFace(rackID) {
    return this.dualFaceRackIDs.has(rackID);
  }

  setRackDualFace(rackID, expanded) {
    if (!rackID) return;
    const next = new Set(this.dualFaceRackIDs);
    if (expanded) next.add(rackID);
    else next.delete(rackID);
    if (next.size === this.dualFaceRackIDs.size && [...next].every((id) => this.dualFaceRackIDs.has(id))) return;
    this.dualFaceRackIDs = next;
    this.emit("rack-view");
  }

  setAllRacksDualFace(expanded) {
    const next = expanded
      ? new Set((this.topology?.racks || []).map((rack) => rack.id))
      : new Set();
    if (next.size === this.dualFaceRackIDs.size && [...next].every((id) => this.dualFaceRackIDs.has(id))) return;
    this.dualFaceRackIDs = next;
    this.emit("rack-view");
  }

  undo() {
    if (!this.history.length || !this.topology) return false;
    if (this.editLock && !this.editLock.allowsChange(this.topology, this.history.at(-1))) return false;
    this.editLock?.recordChange(this.topology, this.history.at(-1));
    const revision = this.topology.revision;
    this.future.push(clone(this.topology));
    this.topology = this.history.pop();
    if (revision !== undefined) this.topology.revision = revision;
    this.ensureSelection();
    this.emit("topology");
    return true;
  }

  redo() {
    if (!this.future.length || !this.topology) return false;
    if (this.editLock && !this.editLock.allowsChange(this.topology, this.future.at(-1))) return false;
    this.editLock?.recordChange(this.topology, this.future.at(-1));
    const revision = this.topology.revision;
    this.history.push(clone(this.topology));
    this.topology = this.future.pop();
    if (revision !== undefined) this.topology.revision = revision;
    this.ensureSelection();
    this.emit("topology");
    return true;
  }

  emit(kind) {
    this.dispatchEvent(new CustomEvent("change", { detail: { kind } }));
  }

  ensureSelection() {
    if (!this.selection || !this.topology) return;
    const { type, id } = this.selection;
    let exists = false;
    if (type === "rack") exists = (this.topology.racks || []).some((item) => item.id === id);
    if (type === "device") exists = this.topology.devices.some((item) => item.id === id);
    if (type === "link") exists = this.topology.links.some((item) => item.id === id);
    if (type === "port") exists = this.topology.devices.some((device) => device.ports.some((item) => item.id === id));
    if (type === "annotation") exists = (this.topology.annotations || []).some((item) => item.id === id);
    if (!exists) this.selection = null;
  }
}

export function findPort(topology, portID) {
  for (const device of topology?.devices || []) {
    const port = device.ports.find((candidate) => candidate.id === portID);
    if (port) return { device, port };
  }
  return null;
}
