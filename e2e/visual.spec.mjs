import { expect, test } from "@playwright/test";
import { enterGuestWorkspace } from "./auth-helper.mjs";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const schedule = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) => schedule(() => callback(1000));
  });
});

test("rack faceplates remain visually stable", async ({ page }) => {
	await enterGuestWorkspace(page);
  await expect(page.locator("#connection-status")).toHaveAttribute("data-state", "online");
  await expect(page.locator("#diagram-canvas")).toBeVisible();
  await expect(page.locator("#diagram-canvas")).toHaveScreenshot("rack-faceplates.png", {
    animations: "disabled",
    maxDiffPixelRatio: 0.005,
  });
});

test("modal visual system remains stable", async ({ page }) => {
	await enterGuestWorkspace(page);
  await page.locator("#add-patch-panel-button").click();
  await expect(page.locator("#patch-panel-dialog")).toHaveScreenshot("patch-panel-dialog.png", {
    animations: "disabled",
    maxDiffPixelRatio: 0.002,
  });
});
