function clone(value) {
  return value == null ? value : structuredClone(value);
}

export class AppState extends EventTarget {
  constructor() {
    super();
    this.topology = null;
    this.selection = null;
    this.analysis = { issues: [], loops: [] };
    this.traceLinkIDs = new Set();
    this.history = [];
    this.future = [];
  }

  setTopology(topology, { remember = false } = {}) {
    if (remember && this.topology) {
      this.history.push(clone(this.topology));
      this.history = this.history.slice(-50);
      this.future = [];
    }
    this.topology = clone(topology);
    this.ensureSelection();
    this.emit("topology");
  }

  commit(mutator) {
    if (!this.topology) return;
    this.history.push(clone(this.topology));
    this.history = this.history.slice(-50);
    this.future = [];
    mutator(this.topology);
    this.emit("topology");
  }

  select(type, id) {
    this.selection = type && id ? { type, id } : null;
    this.emit("selection");
  }

  setAnalysis(analysis) {
    this.analysis = analysis || { issues: [], loops: [] };
    this.emit("analysis");
  }

  setTrace(linkIDs) {
    this.traceLinkIDs = new Set(linkIDs || []);
    this.emit("analysis");
  }

  undo() {
    if (!this.history.length || !this.topology) return false;
    this.future.push(clone(this.topology));
    this.topology = this.history.pop();
    this.ensureSelection();
    this.emit("topology");
    return true;
  }

  redo() {
    if (!this.future.length || !this.topology) return false;
    this.history.push(clone(this.topology));
    this.topology = this.future.pop();
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
    if (type === "device") exists = this.topology.devices.some((item) => item.id === id);
    if (type === "link") exists = this.topology.links.some((item) => item.id === id);
    if (type === "port") exists = this.topology.devices.some((device) => device.ports.some((item) => item.id === id));
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
