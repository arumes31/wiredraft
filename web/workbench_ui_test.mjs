import assert from "node:assert/strict";
import { AutosaveController, loadAutosaveSettings, normalizeAutosaveSettings } from "./static/js/autosave.js";
import { analysisView } from "./static/js/analysis-ui.js";
import { SceneTileIndex } from "./static/js/scene-tiles.js";
import { topologySize, topologySizeMessage } from "./static/js/topology-size.js";

const storage = {
  value: null,
  getItem() { return this.value; },
  setItem(_key, value) { this.value = value; },
};
assert.deepEqual(loadAutosaveSettings(storage), { enabled: true, intervalSeconds: 30 });
assert.deepEqual(normalizeAutosaveSettings({ enabled: false, intervalSeconds: 60 }), { enabled: false, intervalSeconds: 60 });
assert.deepEqual(normalizeAutosaveSettings({ enabled: true, intervalSeconds: 17 }), { enabled: true, intervalSeconds: 30 });

let saves = 0;
const autosave = new AutosaveController(async () => { saves += 1; }, { storage });
autosave.markDirty();
assert.equal(await autosave.flush(), true);
assert.equal(saves, 1);
assert.equal(autosave.isDirty, false);
autosave.configure({ enabled: false, intervalSeconds: 300 });
autosave.markDirty();
assert.equal(await autosave.flush(), false);
assert.equal(saves, 1);
autosave.destroy();

const tiles = new SceneTileIndex(100);
const first = { id: "a", x: 10, y: 10, width: 20, height: 20 };
const spanning = { id: "b", x: 90, y: 90, width: 40, height: 40 };
const distant = { id: "c", x: 500, y: 500, width: 20, height: 20 };
[first, spanning, distant].forEach((item) => tiles.insert(item));
assert.deepEqual(tiles.query({ x: 0, y: 0, width: 100, height: 100 }).map((item) => item.id).sort(), ["a", "b"]);
assert.deepEqual(tiles.query({ x: 100, y: 100, width: 100, height: 100 }).map((item) => item.id), ["b"]);

const normal = topologySize({ devices: [], links: [], annotations: [] });
assert.equal(normal.level, "normal");
assert.equal(topologySizeMessage(normal), "");
const large = topologySize({
  devices: Array.from({ length: 351 }, (_, index) => ({ id: String(index), ports: [] })),
  links: [],
});
assert.equal(large.level, "warning");
assert.match(topologySizeMessage(large), /Large topology: 351 devices/);

assert.equal(analysisView({ issues: [], loops: [] }).countText, "NOMINAL");
const warning = analysisView({ issues: [{ kind: "bad_<tag>", message: "unsafe <input>" }], loops: [] });
assert.equal(warning.countText, "1 ALERT");
assert.doesNotMatch(warning.markup, /<tag>|<input>/);
assert.match(warning.markup, /&lt;TAG&gt;|&lt;tag&gt;/);

console.log("workbench UI, autosave, tiling, and size guard checks passed");
