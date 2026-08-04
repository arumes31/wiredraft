import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { enterGuestWorkspace } from "./auth-helper.mjs";

test("main workspace has no serious accessibility violations", async ({ page }) => {
	await enterGuestWorkspace(page);
  await expect(page.locator("#diagram-canvas")).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter(({ impact }) => impact === "serious" || impact === "critical");
  expect(blocking, blocking.map(({ id, help }) => `${id}: ${help}`).join("\n")).toEqual([]);
});

test("keyboard focus remains visible while a modal is open", async ({ page }) => {
	await enterGuestWorkspace(page);
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus-visible")).toBeVisible();
  await page.locator("#add-patch-panel-button").click();
  const dialog = page.locator("#patch-panel-dialog");
  await expect(dialog).toBeVisible();
  await dialog.evaluate((element) => Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => {}))));
  const results = await new AxeBuilder({ page }).include("#patch-panel-dialog").analyze();
  expect(results.violations.filter(({ impact }) => ["serious", "critical"].includes(impact))).toEqual([]);
});
