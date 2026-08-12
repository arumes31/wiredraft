import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("login gateway exposes accessible operator and guest entry paths", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/login");

  await expect(page).toHaveTitle(/Secure Access/);
  await expect(page.locator("#login-form")).toBeVisible();
  await expect(page.locator("#guest-button")).toBeVisible();
  await expect(page.locator("#topology-backdrop")).toHaveAttribute("data-animation", "static");
  await expect(page.locator("#topology-backdrop")).toHaveCSS("pointer-events", "none");

  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter(({ impact }) => impact === "serious" || impact === "critical");
  expect(blocking, blocking.map(({ id, help }) => `${id}: ${help}`).join("\n")).toEqual([]);

  await page.locator("#guest-button").click();
  await page.waitForURL(/\/$/);
  await expect(page.locator("#diagram-canvas")).toBeVisible();
  await expect(page.locator("#account-name")).toHaveText("Guest");
  await expect(page.locator("#account-role")).toHaveText("guest");
});

test("local administrator password advances to second-factor authentication", async ({ page }) => {
  await page.goto("/login");
  await page.locator('#login-form input[name="username"]').fill("playwright-admin");
  await page.locator('#login-form input[name="password"]').fill("playwright-only-long-password");
  await page.locator('#login-form button[type="submit"]').click();

  await expect(page.locator("#setup-step:not([hidden]), #totp-step:not([hidden])")).toBeVisible();
  await expect(page.locator("#access-error")).toBeHidden();
});

test("login backdrop runs when motion is allowed", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/login");

  const backdrop = page.locator("#topology-backdrop");
  await expect(backdrop).toHaveAttribute("data-animation", "running");
  const dimensions = await backdrop.evaluate((canvas) => ({
    width: canvas.width,
    height: canvas.height,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  }));
  expect(dimensions.width).toBeGreaterThanOrEqual(dimensions.viewportWidth);
  expect(dimensions.height).toBeGreaterThanOrEqual(dimensions.viewportHeight);
});

test("login backdrop produces a fresh procedural scene after reload", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/login");
  await page.waitForTimeout(900);
  const firstScene = await page.locator("#topology-backdrop").evaluate((canvas) => canvas.toDataURL());

  await page.reload();
  await page.waitForTimeout(900);
  const secondScene = await page.locator("#topology-backdrop").evaluate((canvas) => canvas.toDataURL());

  expect(secondScene).not.toBe(firstScene);
});
