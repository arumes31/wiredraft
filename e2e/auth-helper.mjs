import { expect } from "@playwright/test";

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
