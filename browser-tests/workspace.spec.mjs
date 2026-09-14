import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { fixtureTopology, serveFixture, nextPaint } from "./fixture.mjs";

test.beforeEach(async ({ page }) => {
  await serveFixture(page, fixtureTopology());
  await page.goto("/");
  await expect(page.locator("#loading-skeleton")).toBeHidden();
});

test("installed search selects inventory and preserves collapsed groups after clearing", async ({ page }) => {
  const group = page.locator('#topology-tree details[data-tree-key="free"]');
  await group.locator("summary").click();
  await expect(group).not.toHaveAttribute("open");
  const search = page.locator("#inventory-search");
  for (const query of ["switch-7.example.test", "192.0.2.8", "SERIAL-7", "ASSET-7", "Switch 007 Catalyst"]) {
    await search.fill(query);
    await expect(page.locator("#inventory-search-status")).toHaveText("1 matching devices");
    await page.locator('[data-tree-id="device-7"]').click();
    await expect(page.locator("#selection-inspector")).toContainText("Switch 007");
  }
  await search.fill("not-present");
  await expect(page.locator("#topology-tree")).toContainText("No equipment matches");
  await search.fill("");
  await expect(group).not.toHaveAttribute("open");
  await page.evaluate(() => window.fixtureState.select("device", "device-0"));
  await expect(group).not.toHaveAttribute("open");
});

test("validation navigates to cable endpoints without unlocking editing", async ({ page }) => {
  await page.locator("[data-analysis-index='0']").click();
  await expect(page.locator("#selection-inspector")).toContainText("Switch 000 → Switch 001");
  expect(await page.evaluate(() => [...window.fixtureState.traceLinkIDs])).toEqual(["link-0"]);
  await expect(page.locator("#editor-lock")).toHaveAttribute("data-mode", "read-only");
  await nextPaint(page);
  expect(await page.evaluate(() => {
    const engine = window.fixtureEngine;
    const view = engine.viewportWorldRect();
    return engine.deviceRectangles().filter((box) => ["device-0", "device-1"].includes(box.device.id))
      .every((box) => box.x >= view.x && box.y >= view.y && box.x + box.width <= view.x + view.width && box.y + box.height <= view.y + view.height);
  })).toBe(true);
});

test("duplicate dialog creates a separate map from read-only mode", async ({ page }) => {
  await page.locator("#duplicate-topology-button").click();
  await page.locator('#topology-form [name="name"]').fill("Independent copy");
  await page.locator("#topology-submit-button").click();
  await expect(page.locator("#topology-name")).toHaveText("Independent copy");
  await expect(page.locator("#topology-select")).toHaveValue("fixture-copy");
  await expect(page.locator("#device-count")).toHaveText("12");
  await page.locator("#add-topology-button").click();
  await expect(page.locator('#topology-form [name="location"]')).not.toHaveAttribute("readonly");
});

test("diagnostics show build details and PDF exports multiple pages", async ({ page }) => {
  await page.locator("#account-menu summary").click();
  await page.locator("#about-button").click();
  await expect(page.locator("#diagnostics-content")).toContainText("fixture-build");
  await expect(page.locator("#diagnostics-content")).not.toContainText("example.test");
  await page.locator('[data-close="about-dialog"]').last().click();
  await page.locator("#export-menu summary").click();
  await page.locator("#pdf-tiled-button").click();
  const download = page.waitForEvent("download");
  await page.locator('#pdf-options-form [type="submit"]').click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/-pages.pdf$/);
  const pdf = (await readFile(await file.path())).toString("latin1");
  expect(Number(pdf.match(/\/Count (\d+)/)[1])).toBeGreaterThan(1);
  expect(pdf).toContain("/DCTDecode");
  await expect(page.locator("#pdf-options-status")).toContainText("Exported");
});
