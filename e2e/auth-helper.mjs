import { expect } from "@playwright/test";

export async function unlockEditor(page) {
  await expect(page.locator("#loading-skeleton")).toBeHidden();
  await page.locator('[data-edit-mode="all"]').click();
  await expect(page.locator("#editor-lock")).toHaveAttribute("data-mode", "all");
}

export async function enterGuestWorkspace(page, request) {
  if (request) {
    const response = await request.post("/api/v1/auth/guest", { data: {} });
    expect(response.ok()).toBe(true);
  }
  await page.goto("/login");
  await expect(page.locator("#guest-button")).toBeVisible();
  await page.locator("#guest-button").click();
  await page.waitForURL(/\/$/);
}
