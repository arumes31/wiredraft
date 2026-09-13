export const AUTOSAVE_STORAGE_KEY = "wiredraft.autosave.v1";
const LEGACY_AUTOSAVE_STORAGE_KEY = "netdiagram.autosave.v1";
export const AutosaveIntervals = Object.freeze([30, 60, 300]);

export function loadAutosaveSettings(storage = globalThis.localStorage) {
  const defaults = { enabled: true, intervalSeconds: 30 };
  try {
    let serialized = storage?.getItem(AUTOSAVE_STORAGE_KEY);
    if (serialized === null || serialized === undefined) {
      serialized = storage?.getItem(LEGACY_AUTOSAVE_STORAGE_KEY);
      if (serialized !== null && serialized !== undefined) storage?.setItem(AUTOSAVE_STORAGE_KEY, serialized);
    }
    const stored = JSON.parse(serialized || "null");
    return normalizeAutosaveSettings(stored || defaults);
  } catch {
    return defaults;
  }
}

export function normalizeAutosaveSettings(input) {
  const intervalSeconds = AutosaveIntervals.includes(Number(input?.intervalSeconds)) ? Number(input.intervalSeconds) : 30;
  return { enabled: input?.enabled !== false, intervalSeconds };
}

export class AutosaveController extends EventTarget {
  constructor(save, options = {}) {
    super();
    this.save = save;
    this.storage = options.storage || globalThis.localStorage;
    this.settings = loadAutosaveSettings(this.storage);
    this.isDirty = false;
    this.isSaving = false;
    this.version = 0;
    this.error = null;
    this.lastSavedAt = null;
    this.timer = 0;
    this.schedule();
  }

  configure(settings) {
    this.settings = normalizeAutosaveSettings(settings);
    try { this.storage?.setItem(AUTOSAVE_STORAGE_KEY, JSON.stringify(this.settings)); } catch { /* storage is optional */ }
    this.schedule();
    this.emit();
  }

  markDirty({ capture = true } = {}) {
    this.version += 1;
    this.isDirty = true;
    this.emit(null, capture);
  }

  markSaved({ persisted = true } = {}) {
    this.isDirty = false;
    this.isSaving = false;
    this.error = null;
    this.lastSavedAt = persisted ? Date.now() : null;
    this.emit();
  }

  async flush(reason = "auto") {
    if ((reason !== "manual" && (!this.settings.enabled || !this.isDirty)) || this.isSaving) return false;
    const version = this.version;
    this.isSaving = true;
    this.emit();
    try {
      const saved = await this.save(reason, version);
      if (saved === false) {
        this.isSaving = false;
        this.emit();
        return false;
      }
      if (version === this.version) this.markSaved();
      else {
        this.isSaving = false;
        this.error = null;
        this.lastSavedAt = Date.now();
        this.emit();
      }
      return true;
    } catch (error) {
      this.isSaving = false;
      this.emit(error);
      throw error;
    }
  }

  destroy() {
    clearTimeout(this.timer);
  }

  schedule() {
    clearTimeout(this.timer);
    if (!this.settings.enabled) return;
    this.timer = setTimeout(async () => {
      try { await this.flush("auto"); } catch { /* status event exposes the failure to the UI */ } finally { this.schedule(); }
    }, this.settings.intervalSeconds * 1000);
  }

  emit(error = null, capture = false) {
    if (error) this.error = error;
    this.dispatchEvent(new CustomEvent("status", { detail: { ...this.settings, isDirty: this.isDirty, isSaving: this.isSaving, error: this.error, lastSavedAt: this.lastSavedAt, capture } }));
  }
}
