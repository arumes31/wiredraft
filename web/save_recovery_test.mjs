import assert from "node:assert/strict";
import { test } from "node:test";
import { AutosaveController } from "./static/js/autosave.js";

const storage = { getItem: () => null, setItem() {} };

test("edits made during a save remain dirty after its response", async () => {
  let finish;
  const saves = new AutosaveController(() => new Promise((resolve) => { finish = resolve; }), { storage });
  try {
    saves.markDirty();
    const saving = saves.flush();
    saves.markDirty();
    finish(true);
    await saving;
    assert.equal(saves.isDirty, true);
    assert.equal(saves.isSaving, false);
    assert.ok(saves.lastSavedAt > 0);
  } finally { saves.destroy(); }
});

test("manual saves work with autosave disabled and failures persist until success", async () => {
  let fail = true;
  const error = new Error("Connection lost");
  const saves = new AutosaveController(async () => { if (fail) throw error; return true; }, { storage });
  try {
    saves.configure({ enabled: false });
    saves.markDirty();
    await assert.rejects(saves.flush("manual"), error);
    assert.equal(saves.error, error);
    saves.configure({ enabled: false, intervalSeconds: 60 });
    assert.equal(saves.error, error);
    fail = false;
    assert.equal(await saves.flush("manual"), true);
    assert.equal(saves.error, null);
    assert.equal(saves.isDirty, false);
    assert.ok(saves.lastSavedAt > 0);
  } finally { saves.destroy(); }
});
