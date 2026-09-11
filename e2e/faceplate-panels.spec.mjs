import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { enterGuestWorkspace, unlockEditor } from "./auth-helper.mjs";

/** Read the SVG produced by the public export control. */
async function downloadSVG(page) {
  await page.locator("#export-menu summary").click();
  const downloaded = page.waitForEvent("download");
  await page.locator("#svg-button").click();
  const file = await downloaded;
  return readFile(await file.path(), "utf8");
}

test("front and rear hardware views preserve unsaved records and export the selected panel", async ({ page, request }, testInfo) => {
  await enterGuestWorkspace(page, request);
  await expect(page.locator("#connection-status")).toHaveAttribute("data-state", "online");
  const originalID = await page.locator("#topology-select").inputValue();
  const createdResponse = await request.post("/api/v1/topologies", {
    data: { name: `E2E ${testInfo.project.name} PHYSICAL PANELS`, template: "blank" },
  });
  expect(createdResponse.ok()).toBe(true);
  const created = await createdResponse.json();
  await page.reload();
  await expect(page.locator("#connection-status")).toHaveAttribute("data-state", "online");
  await page.locator("#topology-select").selectOption(created.id);
  await expect(page.locator("#topology-name")).toHaveText(created.name);
  await unlockEditor(page);

  await page.locator("#add-device-button").click();
  const dialog = page.locator("#device-dialog");
  await dialog.locator('[name="family"]').selectOption("Firewalls");
  await dialog.locator('[name="vendor"]').selectOption("Fortinet");
  await dialog.locator('[name="model"]').selectOption("FortiGate 100F");
  await dialog.locator('[name="name"]').fill("PANEL VIEW FIREWALL");
  await dialog.locator('button[value="install"]').click();
  await expect(dialog).not.toBeVisible();
  const before = await request.get(`/api/v1/topologies/${created.id}`).then((response) => response.json());
  const device = before.devices.find((candidate) => candidate.name === "PANEL VIEW FIREWALL");
  expect(device).toBeTruthy();
  await page.locator(`[data-tree-type="device"][data-tree-id="${device.id}"]`).click();
  const panel = page.locator(".hardware-panel-controls");
  await expect(panel).toBeVisible();
  await expect(panel.locator('[value="front"]')).toBeChecked();
  const form = page.locator("#device-inspector-form");
  await form.locator('[name="serialNumber"]').fill("UNSAVED PANEL TEST");
  const frontSVG = await downloadSVG(page);
  expect(frontSVG).toContain('data-hardware-face="front"');
  expect(frontSVG).toContain(`data-port-id="${device.ports[0].id}"`);

  const diagram = page.locator("#diagram-canvas");
  const frontPixels = await diagram.evaluate((canvas) => canvas.toDataURL());
  await panel.locator('[value="rear"]').check();
  await expect(panel.locator('[value="rear"]')).toBeChecked();
  await expect.poll(() => diagram.evaluate((canvas) => canvas.toDataURL())).not.toBe(frontPixels);
  await expect(form.locator('[name="serialNumber"]')).toHaveValue("UNSAVED PANEL TEST");
  const rearSVG = await downloadSVG(page);
  expect(rearSVG).toContain('data-hardware-face="rear"');
  expect(rearSVG.match(/data-component="power"/g)).toHaveLength(2);
  expect(rearSVG).toContain('data-layer="opposite-panel-portal"');
  expect(rearSVG).not.toContain(`data-entity="port" data-port-id="${device.ports[0].id}"`);
  const after = await request.get(`/api/v1/topologies/${created.id}`).then((response) => response.json());
  expect(after.revision).toBe(before.revision);
  expect(after.devices).toEqual(before.devices);

  await panel.locator('[value="front"]').check();
  await expect(form.locator('[name="serialNumber"]')).toHaveValue("UNSAVED PANEL TEST");
  const restoredSVG = await downloadSVG(page);
  expect(restoredSVG).toContain(`data-port-id="${device.ports[0].id}"`);
  await page.locator("#topology-select").selectOption(originalID);
  const original = await request.get(`/api/v1/topologies/${originalID}`).then((response) => response.json());
  const restored = await request.put(`/api/v1/topologies/${originalID}`, {
    data: original, headers: { "If-Match": `"rev-${original.revision}"` },
  });
  expect(restored.ok()).toBe(true);
});
