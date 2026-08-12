import { expect, test } from "@playwright/test";
import { enterGuestWorkspace } from "./auth-helper.mjs";

const onePixelPNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

test.beforeEach(async ({ page, request }) => {
  await enterGuestWorkspace(page, request);
  await expect(page.locator("#connection-status")).toHaveAttribute("data-state", "online", { timeout: 15_000 });
});

test("uploads, previews, edits, enlarges, and deletes a protected device photo", async ({ page }, testInfo) => {
  await page.locator("#add-topology-button").click();
  const mapDialog = page.locator("#topology-dialog");
  await mapDialog.locator('[name="name"]').fill(`E2E ${testInfo.project.name.toUpperCase()} PHOTO MAP`);
  await mapDialog.locator('[name="location"]').fill("PHOTO LAB");
  await mapDialog.getByText("STARTER TOPOLOGY").click();
  await mapDialog.locator('button[value="create"]').click();
  await expect(mapDialog).not.toBeVisible();

  await page.locator('[data-tree-type="device"]').first().click();
  const photoSection = page.locator(".inspector-photos");
  await expect(photoSection).toBeVisible();
  await photoSection.locator('input[name="photos"]').setInputFiles([
    { name: "cabinet-front.png", mimeType: "image/png", buffer: onePixelPNG },
    { name: "cabinet-rear.png", mimeType: "image/png", buffer: onePixelPNG },
  ]);
  await photoSection.getByRole("button", { name: "UPLOAD SELECTED PHOTOS" }).click();
  await expect(photoSection.locator("[data-photo-open]")).toHaveCount(2);

  await photoSection.locator("[data-photo-open]").first().click();
  const manager = page.locator("#photo-dialog");
  await expect(manager).toBeVisible();
  await expect(manager.locator("#photo-manager-count")).toHaveText("2 PHOTOS");
  await expect(manager.locator("#photo-preview")).toHaveJSProperty("complete", true);
  await expect.poll(() => manager.locator("#photo-preview").evaluate((image) => image.naturalWidth)).toBeGreaterThan(0);

  await manager.locator('[name="originalName"]').fill("cabinet-overview.png");
  await manager.locator('[name="caption"]').fill("Cabinet before scheduled maintenance");
  await manager.getByRole("button", { name: "SAVE DETAILS" }).click({ force: true });
  await expect(manager.locator("#photo-preview")).toHaveAttribute("alt", "Cabinet before scheduled maintenance");

  await manager.locator("#photo-preview").click({ force: true });
  await expect(manager.locator("#photo-preview")).toHaveClass(/is-enlarged/);
  page.once("dialog", (dialog) => dialog.accept());
  await manager.getByRole("button", { name: "DELETE PHOTO" }).click({ force: true });
  await expect(manager.locator("#photo-manager-count")).toHaveText("1 PHOTO");
});
