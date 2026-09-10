export const EditMode = Object.freeze({ READ_ONLY: "read-only", CABLING: "cabling", ALL: "all" });
export const IDLE_LOCK_MS = 15 * 60 * 1000;

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

function documentContent(topology) {
  if (!topology) return topology;
  const { revision, updatedAt, ...content } = topology;
  return content;
}

export function sameDocument(before, after) {
  return JSON.stringify(canonical(documentContent(before))) === JSON.stringify(canonical(documentContent(after)));
}

/** Cable configuration also updates the VLAN profile of its physical endpoints. */
export function connectionChangesOnly(before, after) {
  if (!before || !after || before.id !== after.id) return false;
  const changedPorts = new Set();
  const previousLinks = new Map((before.links || []).map((link) => [link.id, link]));
  const nextLinks = new Map((after.links || []).map((link) => [link.id, link]));
  for (const id of new Set([...previousLinks.keys(), ...nextLinks.keys()])) {
    const previous = previousLinks.get(id), next = nextLinks.get(id);
    if (JSON.stringify(canonical(previous)) === JSON.stringify(canonical(next))) continue;
    for (const link of [previous, next]) {
      if (link) { changedPorts.add(link.sourcePortId); changedPorts.add(link.targetPortId); }
    }
  }
  const equipment = (topology) => {
    const { links, linkGroups, ...rest } = documentContent(topology);
    return { ...rest, devices: (rest.devices || []).map((device) => ({
      ...device, ports: (device.ports || []).map((port) => {
        if (!changedPorts.has(port.id)) return port;
        const { mode, nativeVlan, allowedVlans, ...physicalPort } = port;
        return physicalPort;
      }),
    })) };
  };
  return sameDocument(equipment(before), equipment(after));
}

export class EditorLock extends EventTarget {
  constructor({ now = () => Date.now(), schedule = setTimeout, unschedule = clearTimeout } = {}) {
    super();
    this.now = now;
    this.schedule = schedule;
    this.unschedule = unschedule;
    this.mode = EditMode.READ_ONLY;
    this.deadline = 0;
    this.timer = null;
  }

  setMode(mode, reason = "manual") {
    this.checkExpiry();
    const next = Object.values(EditMode).includes(mode) ? mode : EditMode.READ_ONLY;
    if (next === this.mode) return;
    const wasLocked = this.mode === EditMode.READ_ONLY;
    this.mode = next;
    if (next === EditMode.READ_ONLY) this.deadline = 0;
    else if (wasLocked) this.deadline = this.now() + IDLE_LOCK_MS;
    this.armTimer();
    this.dispatchEvent(new CustomEvent("change", { detail: { mode: next, reason } }));
  }

  checkExpiry() {
    if (this.mode === EditMode.READ_ONLY || this.now() < this.deadline) return;
    this.mode = EditMode.READ_ONLY;
    this.deadline = 0;
    this.armTimer();
    this.dispatchEvent(new CustomEvent("change", { detail: { mode: this.mode, reason: "idle" } }));
  }

  allows(capability) {
    this.checkExpiry();
    return this.mode === EditMode.ALL || (this.mode === EditMode.CABLING && capability === "cabling");
  }

  allowsChange(before, after) {
    this.checkExpiry();
    if (this.mode === EditMode.READ_ONLY) return false;
    return this.mode === EditMode.ALL || connectionChangesOnly(before, after);
  }

  recordChange(before, after) {
    this.checkExpiry();
    if (this.mode === EditMode.READ_ONLY || sameDocument(before, after)) return;
    this.deadline = this.now() + IDLE_LOCK_MS;
    this.armTimer();
  }

  armTimer() {
    this.unschedule(this.timer);
    this.timer = this.deadline ? this.schedule(() => this.checkExpiry(), Math.max(0, this.deadline - this.now())) : null;
  }

  destroy() { this.unschedule(this.timer); }
}

export function requiredRequestCapability(path, method, body, current) {
  const match = path.match(/^\/api\/v1\/topologies\/([^/]+)(?:\/([^/]+))?/);
  // Creating a separate map and managing accounts are outside the canvas lock.
  if (!match) return null;
  if (["links", "link-groups"].includes(match[2])) return "cabling";
  if (!match[2] && method === "PUT") {
    const next = JSON.parse(body);
    // Persisting an already accepted local edit must remain possible after relocking.
    if (sameDocument(current, next)) return null;
    return connectionChangesOnly(current, next) ? "cabling" : "all";
  }
  return "all";
}
