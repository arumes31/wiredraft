export const AUTOSAVE_STORAGE_KEY = "netdiagram.autosave.v1";
export const AutosaveIntervals = Object.freeze([30, 60, 300]);

export function loadAutosaveSettings(storage = globalThis.localStorage) {
  const defaults = { enabled: true, intervalSeconds: 30 };
  try {
    const stored = JSON.parse(storage?.getItem(AUTOSAVE_STORAGE_KEY) || "null");
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
    this.timer = 0;
    this.schedule();
  }

  configure(settings) {
    this.settings = normalizeAutosaveSettings(settings);
    try { this.storage?.setItem(AUTOSAVE_STORAGE_KEY, JSON.stringify(this.settings)); } catch { /* storage is optional */ }
    this.schedule();
    this.emit();
  }

  markDirty() {
    if (this.isDirty) return;
    this.isDirty = true;
    this.emit();
  }

  markSaved() {
    this.isDirty = false;
    this.isSaving = false;
    this.emit();
  }

  async flush(reason = "auto") {
    if (!this.settings.enabled || !this.isDirty || this.isSaving) return false;
    this.isSaving = true;
    this.emit();
    try {
      await this.save(reason);
      this.markSaved();
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

  emit(error = null) {
    this.dispatchEvent(new CustomEvent("status", { detail: { ...this.settings, isDirty: this.isDirty, isSaving: this.isSaving, error } }));
  }
}
