import assert from "node:assert/strict";
import { test } from "node:test";
import { searchInstalledDevices } from "./static/js/topology-tree.js";
import { analysisTargets } from "./static/js/analysis-ui.js";
import { diagnosticsText } from "./static/js/diagnostics.js";
import { pdfTilePlan, buildTiledPDF, exportTiledPDF } from "./static/js/pdf-tiles.js";

test("installed search matches every inventory field and combines terms", () => {
  const device = { id: "a", name: "Core Switch", hostname: "core-01", managementIp: "10.20.1.4", serialNumber: "SN123", assetTag: "ASSET9", model: "C9300" };
  const topology = { devices: [device, { id: "b", name: "Other" }] };
  for (const query of ["core", "CORE-01", "10.20.1.4", "sn123", "asset9", "c9300", "core c9300"]) {
    assert.deepEqual(searchInstalledDevices(topology, query), [device], query);
  }
  assert.deepEqual(searchInstalledDevices(topology, "core absent"), []);
  assert.equal(searchInstalledDevices(topology, "  ").length, 2);
});

test("alerts resolve cables, groups and loop equipment, ignoring deleted cables", () => {
  const topology = { devices: [{ id: "a", ports: [{ id: "p1" }] }, { id: "b", ports: [{ id: "p2" }] }],
    links: [{ id: "l", sourcePortId: "p1", targetPortId: "p2" }], linkGroups: [{ id: "g", linkIds: ["l", "deleted"] }] };
  const analysis = { issues: [{ linkId: "l" }, { groupId: "g" }], loops: [{ linkIds: ["l"], deviceIds: ["b", "a"] }] };
  for (const index of [0, 1, 2]) {
    const targets = analysisTargets(analysis, topology, index);
    assert.deepEqual(targets.linkIds, ["l"]);
    assert.deepEqual(new Set(targets.deviceIds), new Set(["a", "b"]));
  }
  assert.deepEqual(analysisTargets(analysis, topology, 99), { linkIds: [], deviceIds: [] });
});

test("copied diagnostics omit private inventory and arbitrary context", () => {
  const text = diagnosticsText({ revision: "abc123", goVersion: "go1", secret: "PRIVATE" }, {
    topology: { name: "PRIVATE", revision: 7, devices: [{ hostname: "PRIVATE" }], organization: "PRIVATE" },
    token: "PRIVATE", connection: "PRIVATE", graphics: "auto", editMode: "read-only", dirty: false,
  });
  assert.match(text, /abc123/);
  assert.match(text, /Map revision: 7/);
  assert.doesNotMatch(text, /PRIVATE/);
});

test("PDF tiles cover the full extent with overlap in reading order", () => {
  const bounds = { x: -900, y: 250, width: 4000, height: 2800 };
  const tiles = pdfTilePlan(bounds, 1);
  assert.ok(tiles.length > 1);
  assert.equal(tiles[0].row, 1);
  assert.equal(tiles[1].column, 2);
  assert.ok(tiles[0].x + tiles[0].width > tiles[1].x);
  assert.ok(tiles.at(-1).x + tiles.at(-1).width >= bounds.x + bounds.width);
  assert.ok(tiles.at(-1).y + tiles.at(-1).height >= bounds.y + bounds.height);
  assert.equal(pdfTilePlan({ x: 0, y: 0, width: 100, height: 100 }).length, 1);
  assert.throws(() => pdfTilePlan({ x: 0, y: 0, width: 1e7, height: 1e7 }), /100 pages/);
});

test("multipage PDF declares every page and correct byte offsets", () => {
  const tiles = pdfTilePlan({ x: 0, y: 0, width: 2400, height: 1000 }, 1);
  const pages = tiles.map((tile) => ({ ...tile, bytes: new Uint8Array([255, 216, 255, 217]), pixelWidth: 20, pixelHeight: 10 }));
  const bytes = buildTiledPDF(pages, "Vienna ü (network)");
  const text = Buffer.from(bytes).toString("latin1");
  assert.match(text, new RegExp(`/Count ${pages.length} `));
  assert.equal((text.match(/\/Type \/Page /g) || []).length, pages.length);
  const xref = Number(text.match(/startxref\n(\d+)/)[1]);
  assert.equal(text.slice(xref, xref + 4), "xref");
  const entries = text.slice(xref).split("\n").slice(3, 3 + pages.length * 3 + 4);
  entries.forEach((entry, i) => assert.ok(text.slice(Number(entry.slice(0, 10))).startsWith(`${i + 1} 0 obj`)));
});

test("PDF cancellation and changed snapshots stop before rendering or downloading", async () => {
  const topology = { id: "map", name: "Source", revision: 1 };
  const engine = { state: { topology: { ...topology, revision: 2 } },
    worldBounds: () => ({ x: 0, y: 0, width: 100, height: 100 }),
    renderExport: () => assert.fail("must not render a stale or cancelled export") };
  await assert.rejects(exportTiledPDF(topology, engine, 1), /map changed/);
  engine.state.topology = topology;
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(exportTiledPDF(topology, engine, 1, undefined, controller.signal), { name: "AbortError" });
});
