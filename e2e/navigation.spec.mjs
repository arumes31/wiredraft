import { expect, test } from "@playwright/test";

import { enterGuestWorkspace } from "./auth-helper.mjs";

test.beforeEach(async ({ page, request }) => {
  await enterGuestWorkspace(page, request);
  await expect(page.locator("#connection-status")).toHaveAttribute("data-state", "online", { timeout: 15_000 });
  await expect(page.locator("#diagram-canvas")).toBeVisible();
});

test("trackpad profile pans, pinches to zoom, and persists", async ({ page }) => {
  const mode = page.locator("#navigation-mode");
  const readout = page.locator("#navigation-readout");
  const zoom = page.locator("#zoom-readout");
  const pointer = page.locator("#pointer-readout");
  await mode.selectOption("trackpad");
  await expect(readout).toHaveText("TRACKPAD NAV");
  await expect(page.locator("#navigation-pan-gesture")).toHaveText("2-FINGER");
  await expect(page.locator("#navigation-zoom-gesture")).toHaveText("PINCH");

  const bounds = await page.locator("#diagram-canvas").boundingBox();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  const zoomBeforePan = await zoom.textContent();
  const pointerBeforePan = await pointer.textContent();
  await page.mouse.wheel(36, 72);
  await expect(zoom).toHaveText(zoomBeforePan);
  await expect(pointer).not.toHaveText(pointerBeforePan);

  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -90);
  await page.keyboard.up("Control");
  await expect(zoom).not.toHaveText(zoomBeforePan);

  await page.reload();
  await expect(mode).toHaveValue("trackpad");
  await expect(readout).toHaveText("TRACKPAD NAV");
});

test("mouse profile retains wheel zoom", async ({ page }) => {
  await page.locator("#navigation-mode").selectOption("mouse");
  const zoom = page.locator("#zoom-readout");
  const before = await zoom.textContent();
  const bounds = await page.locator("#diagram-canvas").boundingBox();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.wheel(0, -100);
  await expect(zoom).not.toHaveText(before);
  await expect(page.locator("#navigation-readout")).toHaveText("MOUSE NAV");

  await page.locator("#navigation-mode").selectOption("auto");
  await page.mouse.wheel(0, -100);
  await expect(page.locator("#navigation-readout")).toHaveText("AUTO · MOUSE");
});
