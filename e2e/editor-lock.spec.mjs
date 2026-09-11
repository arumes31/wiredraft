import { expect, test } from "@playwright/test";
import { mockLockWorkspace } from "./editor-lock-fixture.mjs";
import AxeBuilder from "@axe-core/playwright";

let workspace;
test.beforeEach(async ({ page }) => {
  workspace = await mockLockWorkspace(page);
  await page.setViewportSize({ width: 1700, height: 1000 });
  await page.clock.install();
  await page.goto("/");
  await expect(page.locator("#topology-name")).toHaveText("Editor lock fixture");
  await page.evaluate(() => { window.lockFixture.canvas.camera = { x: 10, y: 10, zoom: 0.7 }; window.lockFixture.canvas.invalidate(); });
});

async function point(page, kind, index = 0) {
  return page.evaluate(({ kind, index }) => {
    const { canvas } = window.lockFixture;
    canvas.layoutScene();
    const box = kind === "device" ? canvas.deviceRectangles()[index] : kind === "rack" ? canvas.rackRectangles()[index] : canvas.portGeometry().filter((port) => port.port.id === `port-${index}-0`)[0];
    const world = kind === "port" ? { x: box.centerX, y: box.centerY } : { x: box.x + 10, y: box.y + (kind === "rack" ? 15 : 30) };
    const rect = canvas.canvas.getBoundingClientRect();
    return { x: rect.x + canvas.camera.x + world.x * canvas.camera.zoom, y: rect.y + canvas.camera.y + world.y * canvas.camera.zoom };
  }, { kind, index });
}
async function drag(page, from, to) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
}
async function mode(page, name) { await page.locator(`[data-edit-mode="${name}"]`).click(); }

test("read only permits inspection but blocks devices, racks, ports and deletion", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const before = workspace.topology;
  await expect(page.locator('[data-edit-mode="read-only"]')).toHaveAttribute("aria-pressed", "true");
  const device = await point(page, "device");
  await drag(page, device, { x: device.x + 60, y: device.y + 40 });
  await expect(page.locator("#device-inspector-form")).toBeVisible();
  await expect(page.locator('#device-inspector-form [name="name"]')).toHaveAttribute("readonly", "");
  await page.locator("#diagram-canvas").focus();
  await page.keyboard.press("Delete");
  const rack = await point(page, "rack");
  await drag(page, rack, { x: rack.x + 30, y: rack.y + 30 });
  await drag(page, await point(page, "port"), await point(page, "port", 1));
  expect(workspace.writes).toEqual([]);
  expect(await page.evaluate(() => window.lockFixture.state.topology)).toEqual(before);
  expect(errors).toEqual([]);
});

test("cabling allows patching and unpatching while equipment cannot move", async ({ page }) => {
  await mode(page, "cabling");
  const device = await point(page, "device");
  await drag(page, device, { x: device.x + 60, y: device.y + 40 });
  expect(workspace.writes).toEqual([]);
  await drag(page, await point(page, "port"), await point(page, "port", 1));
  await expect(page.locator("#link-count")).toHaveText("1");
  expect(workspace.writes[0].method).toBe("POST");
  await page.evaluate(() => { const { state } = window.lockFixture; state.select("link", state.topology.links[0].id); });
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#delete-link").click();
  await expect(page.locator("#link-count")).toHaveText("0");
  expect(workspace.writes.at(-1).method).toBe("DELETE");
  expect(workspace.topology.devices[0].positionX).toBe(100);
});

test("all unlocked permits device movement and read only blocks its history", async ({ page }) => {
  await mode(page, "all");
  const device = await point(page, "device");
  await drag(page, device, { x: device.x + 60, y: device.y + 40 });
  await expect.poll(() => workspace.writes.length).toBe(1);
  expect(workspace.topology.devices[0].positionX).not.toBe(100);
  await mode(page, "cabling");
  await expect(page.locator("#undo-button")).toBeDisabled();
  await mode(page, "all");
  await page.locator("#undo-button").click();
  await expect.poll(() => workspace.topology.devices[0].positionX).toBe(100);
  await mode(page, "read-only");
  await expect(page.locator("#redo-button")).toBeDisabled();
});

test("15 minutes without edits relocks and preserves an inspector draft", async ({ page }) => {
  await mode(page, "all");
  const device = await point(page, "device");
  await page.mouse.click(device.x, device.y);
  const name = page.locator('#device-inspector-form [name="name"]');
  await name.fill("Unapplied draft");
  await page.clock.fastForward(14 * 60 * 1000);
  await page.mouse.wheel(0, 20);
  await page.clock.fastForward(60 * 1000);
  await expect(page.locator("#editor-lock")).toHaveAttribute("data-mode", "read-only");
  await expect(name).toHaveValue("Unapplied draft");
  await expect(name).toHaveAttribute("readonly", "");
  expect(workspace.writes).toEqual([]);
  await mode(page, "all");
  await page.locator("#device-inspector-form button.primary").click();
  await expect.poll(() => workspace.topology.devices[0].name).toBe("Unapplied draft");
});

test("successful edits reset idle time; mode changes and reloads do not keep it unlocked", async ({ page }) => {
  await mode(page, "all");
  await page.clock.fastForward(14 * 60 * 1000);
  const device = await point(page, "device");
  await page.mouse.click(device.x, device.y);
  await page.locator('#device-inspector-form [name="name"]').fill("Changed");
  await page.locator("#device-inspector-form button.primary").click();
  await expect.poll(() => workspace.writes.length).toBe(1);
  await expect.poll(() => page.evaluate(() => window.lockFixture.state.topology.devices[0].name)).toBe("Changed");
  await page.clock.fastForward(14 * 60 * 1000);
  await expect(page.locator("#editor-lock")).toHaveAttribute("data-mode", "all");
  await mode(page, "cabling");
  await page.clock.fastForward(60 * 1000);
  await expect(page.locator("#editor-lock")).toHaveAttribute("data-mode", "read-only");
  await mode(page, "all");
  await page.reload();
  await expect(page.locator("#editor-lock")).toHaveAttribute("data-mode", "read-only");
  await mode(page, "all");
  await page.locator("#topology-select").selectOption("second-map");
  await expect(page.locator("#editor-lock")).toHaveAttribute("data-mode", "read-only");
});

test("expiry cancels an in-progress device drag without a write", async ({ page }) => {
  await mode(page, "all");
  const device = await point(page, "device");
  await page.mouse.move(device.x, device.y);
  await page.mouse.down();
  await page.mouse.move(device.x + 70, device.y + 40, { steps: 5 });
  await page.clock.fastForward(15 * 60 * 1000);
  await page.mouse.up();
  await expect(page.locator("#editor-lock")).toHaveAttribute("data-mode", "read-only");
  expect(workspace.writes).toEqual([]);
  expect(await page.evaluate(() => window.lockFixture.state.topology.devices[0].positionX)).toBe(100);
});

test("an expired modal can explicitly unlock while keeping its draft", async ({ page }) => {
  await mode(page, "all");
  await page.locator("#add-rack-button").click();
  const dialog = page.locator("#rack-dialog");
  await dialog.locator('[name="name"]').fill("Rack draft");
  await page.clock.fastForward(15 * 60 * 1000);
  await expect(dialog.locator(".editor-lock-notice")).toBeVisible();
  await expect(dialog.locator('[name="name"]')).toHaveValue("Rack draft");
  await dialog.getByRole("button", { name: "Unlock all editing" }).click();
  await expect(dialog.locator('[name="name"]')).toBeEditable();
  await expect(dialog.locator('[name="name"]')).toHaveValue("Rack draft");
  await expect(page.locator("#editor-lock")).toHaveAttribute("data-mode", "all");
  expect(workspace.writes).toEqual([]);
});

test("lock controls are accessible and fit beside an open inspector", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.locator('[data-tree-type="device"]').first().click();
  const bounds = await page.locator("#editor-lock").boundingBox();
  const stage = await page.locator(".diagram-stage").boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(stage.x);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(stage.x + stage.width);
  const results = await new AxeBuilder({ page }).include("#editor-lock").analyze();
  expect(results.violations).toEqual([]);
});
