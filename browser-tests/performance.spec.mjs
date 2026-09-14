import { performance } from "node:perf_hooks";
import { writeFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import { fixtureTopology, serveFixture, nextPaint } from "./fixture.mjs";
import baseline from "./performance-budgets.json" with { type: "json" };

test.use({ trace: "off" });

test("large topology initial load, selection and drag baseline", async ({ page }, testInfo) => {
  const topology = fixtureTopology(baseline.devices);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await serveFixture(page, topology);
  const start = performance.now();
  await page.goto("/");
  await expect(page.locator("#loading-skeleton")).toBeHidden();
  await expect(page.locator("#device-count")).toHaveText(String(baseline.devices));
  await nextPaint(page);
  const loadMs = performance.now() - start;
  const selection = [], drag = [];
  await page.locator('[data-edit-mode="all"]').click();
  for (let sample = 0; sample < 6; sample++) {
    const selectionStart = performance.now();
    await page.locator(`[data-tree-id="device-${sample}"]`).click();
    await expect(page.locator("#selection-inspector")).toContainText(`Switch ${String(sample).padStart(3, "0")}`);
    await nextPaint(page);
    const elapsed = performance.now() - selectionStart;
    if (sample) selection.push(elapsed);
    const point = await page.evaluate((id) => {
      const engine = window.fixtureEngine;
      engine.focusDevices([id]);
      const box = engine.deviceRectangles().find((item) => item.device.id === id);
      const rect = engine.canvas.getBoundingClientRect();
      const point = { x: box.x + box.width * .18, y: box.y + box.height * .65 };
      if (engine.hitPort(point) || engine.hitLink(point) || engine.hitDevice(point)?.device.id !== id) throw new Error("Benchmark drag point is not free chassis space");
      return { x: rect.x + point.x * engine.camera.zoom + engine.camera.x,
        y: rect.y + point.y * engine.camera.zoom + engine.camera.y,
        before: window.fixtureState.topology.devices.find((device) => device.id === id).positionX };
    }, `device-${sample}`);
    await nextPaint(page);
    const dragStart = performance.now();
    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    await page.mouse.move(point.x + 80, point.y + 30, { steps: 5 });
    await page.mouse.up();
    await nextPaint(page);
    const dragMs = performance.now() - dragStart;
    expect(await page.evaluate((id) => window.fixtureState.topology.devices.find((device) => device.id === id).positionX, `device-${sample}`)).not.toBe(point.before);
    if (sample) drag.push(dragMs);
  }
  const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  const result = { devices: topology.devices.length, ports: topology.devices.reduce((n, d) => n + d.ports.length, 0), cables: topology.links.length,
    browser: testInfo.project.name || "chromium", viewport: testInfo.project.use.viewport, loadMs,
    selectionMedianMs: median(selection), dragMedianMs: median(drag), selectionSamplesMs: selection, dragSamplesMs: drag };
  const resultPath = testInfo.outputPath("large-topology-performance.json");
  await writeFile(resultPath, JSON.stringify(result, null, 2));
  await testInfo.attach("large-topology-performance.json", { path: resultPath, contentType: "application/json" });
  console.log(JSON.stringify(result));
  expect(errors).toEqual([]);
  expect(loadMs).toBeLessThan(baseline.loadMs);
  expect(result.selectionMedianMs).toBeLessThan(baseline.selectionMedianMs);
  expect(result.dragMedianMs).toBeLessThan(baseline.dragMedianMs);
});
