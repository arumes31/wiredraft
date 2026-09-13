import { sameDocument } from "./editor-lock.js";

/** Tab-local safety copies. A displaced draft is never replayed over shared work. */
export class DraftRecovery {
  constructor(account, storage) {
    this.key = `wiredraft.drafts.v1.${encodeURIComponent(account)}`;
    this.entries = [];
    this.storageError = null;
    try {
      this.storage = storage ?? globalThis.sessionStorage;
      const stored = JSON.parse(this.storage?.getItem(this.key) || "[]");
      if (Array.isArray(stored)) this.entries = stored.filter((entry) =>
        typeof entry?.id === "string" && typeof entry.topology?.id === "string" && Number.isFinite(entry.savedAt),
      ).map((entry) => ({ ...entry, pending: false }));
    } catch (error) { this.storageError = error; }
  }

  get recoveries() { return this.entries.filter((entry) => !entry.pending); }

  hasPending(mapID) { return this.entries.some((entry) => entry.pending && entry.topology.id === mapID); }

  /** A successful write acknowledges its submitted content, before server normalization. */
  acknowledge(submitted) {
    this.entries = this.entries.filter((entry) => !entry.pending || !sameDocument(entry.topology, submitted));
    this.persist();
  }

  capture(topology) {
    if (!topology?.id) return;
    const entry = this.entries.find((item) => item.pending && item.topology.id === topology.id);
    const snapshot = { topology: structuredClone(topology), savedAt: Date.now(), pending: true };
    if (entry) Object.assign(entry, snapshot);
    else this.entries.push({ id: crypto.randomUUID(), ...snapshot });
    this.persist();
  }

  accept(topology) {
    if (!topology) return false;
    let accepted = false;
    for (const entry of [...this.entries]) {
      if (!entry.pending || entry.topology.id !== topology.id) continue;
      accepted = true;
      if (sameDocument(entry.topology, topology)) this.entries = this.entries.filter((item) => item !== entry);
      else entry.pending = false;
    }
    this.persist();
    return accepted;
  }

  discardPending(mapID) {
    this.entries = this.entries.filter((entry) => !entry.pending || entry.topology.id !== mapID);
    this.persist();
  }

  discard(id) {
    this.entries = this.entries.filter((entry) => entry.id !== id);
    this.persist();
  }

  persist() {
    try {
      this.storage?.setItem(this.key, JSON.stringify(this.entries));
      this.storageError = this.storage ? null : new Error("Session storage unavailable");
    } catch (error) { this.storageError = error; }
  }
}
