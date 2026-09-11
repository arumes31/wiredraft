import { expect, test } from "@playwright/test";
import { enterGuestWorkspace, unlockEditor } from "./auth-helper.mjs";

test.beforeEach(async ({ page, request }) => {
  await page.addInitScript(() => {
    const schedule = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) => schedule(() => callback(1000));
  });
  await enterGuestWorkspace(page, request);
  const response = await request.post("/api/v1/topologies", {
    data: { name: "Visual reference", template: "demo" },
  });
  expect(response.ok()).toBe(true);
  const topology = await response.json();
  expect(topology.devices.length).toBeGreaterThan(0);
  await page.reload();
  await page.locator("#topology-select").selectOption(topology.id);
  await expect(page.locator("#loading-skeleton")).toBeHidden();
  // Reload the selected demo so initialization fits the same map on every run.
  await page.reload();
  await expect(page.locator("#topology-select")).toHaveValue(topology.id);
  await expect(page.locator("#topology-name")).toHaveText(topology.name);
  await expect(page.locator("#loading-skeleton")).toBeHidden();
  await expect(page.locator("#connection-status")).toHaveAttribute("data-state", "online");
});

test("rack faceplates remain visually stable", async ({ page }) => {
  await expect(page.locator("#connection-status")).toHaveAttribute("data-state", "online");
  await expect(page.locator("#diagram-canvas")).toBeVisible();
  await expect(page.locator("#diagram-canvas")).toHaveScreenshot("rack-faceplates.png", {
    animations: "disabled",
    maxDiffPixelRatio: 0.005,
  });
});

test("modal visual system remains stable", async ({ page }) => {
  await unlockEditor(page);
  await page.locator("#add-patch-panel-button").click();
  await expect(page.locator("#patch-panel-dialog")).toHaveScreenshot("patch-panel-dialog.png", {
    animations: "disabled",
    maxDiffPixelRatio: 0.002,
  });
});
