import { expect, test } from "@playwright/test";
import { mockLockWorkspace } from "./editor-lock-fixture.mjs";

async function occupiedRack(page) {
  const workspace = await mockLockWorkspace(page);
  const topology = workspace.topology;
  Object.assign(topology.racks[0], { positionX: 900, positionY: 100 });
  Object.assign(topology.devices[1], { rackId: "rack", rackUnit: 4, rackFace: "front", positionX: 930, positionY: 364 });
  await workspace.respond("/api/v1/topologies/lock-map", "PUT", topology);
  await page.setViewportSize({ width: 1700, height: 1000 });
  await page.goto("/");
  await expect(page.locator("#topology-name")).toHaveText(topology.name);
  await page.locator('[data-edit-mode="all"]').click();
  await page.evaluate(() => {
    const { canvas } = window.lockFixture;
    canvas.camera = { x: 10, y: 10, zoom: .55 };
    canvas.invalidate();
  });
  return workspace;
}

async function dropOnOccupiedRange(page) {
  const points = await page.evaluate(() => {
    const { canvas } = window.lockFixture;
    canvas.layoutScene();
    const box = canvas.deviceRectangles().find((box) => box.device.id === "device-0");
    const rect = canvas.canvas.getBoundingClientRect();
    const point = (x, y) => ({ x: rect.x + canvas.camera.x + x * canvas.camera.zoom,
      y: rect.y + canvas.camera.y + y * canvas.camera.zoom });
    return { from: point(box.x + 10, box.y + 30), to: point(940, 394) };
  });
  await page.mouse.move(points.from.x, points.from.y);
  await page.mouse.down();
  await page.mouse.move(points.to.x, points.to.y, { steps: 10 });
  expect(await page.evaluate(() => window.lockFixture.canvas.rackDropPreview?.reason)).toBe("occupied");
  await page.mouse.up();
}

test("an occupied rack drop requires confirmation and cancellation changes nothing", async ({ page }) => {
  const workspace = await occupiedRack(page);
  const before = workspace.topology;
  const history = await page.evaluate(() => window.lockFixture.state.history.length);
  await dropOnOccupiedRange(page);
  const dialog = page.locator("#rack-placement-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Target");
  await expect(dialog.getByRole("button", { name: "CANCEL", exact: true })).toBeFocused();
  expect(workspace.topology).toEqual(before);
  expect(await page.evaluate(() => window.lockFixture.state.topology.devices)).toEqual(before.devices);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  expect(workspace.topology).toEqual(before);
  expect(await page.evaluate(() => window.lockFixture.state.history.length)).toBe(history);
});

test("confirmation mounts the drop and releases occupied hardware in one undoable save", async ({ page }) => {
  const workspace = await occupiedRack(page);
  const before = workspace.topology;
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await dropOnOccupiedRange(page);
  const dialog = page.locator("#rack-placement-dialog");
  await expect(dialog).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("rack-placement-confirmation.png") });
  await dialog.getByRole("button", { name: "CONFIRM PLACEMENT" }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => workspace.topology.devices[0].rackUnit).toBe(4);
  expect(workspace.topology.devices[0].rackId).toBe("rack");
  expect(workspace.topology.devices[1].rackId).toBe("");
  expect(workspace.topology.devices[1].positionX).toBeGreaterThan(1650);
  expect(workspace.topology.devices[1].ports).toEqual(before.devices[1].ports);
  expect(workspace.topology.revision).toBe(before.revision + 1);
  await page.keyboard.press("Control+z");
  await expect.poll(() => workspace.topology.devices).toEqual(before.devices);
  expect(errors).toEqual([]);
});

test("confirmation refuses a map that changed while the dialog was open", async ({ page }) => {
  const workspace = await occupiedRack(page);
  await dropOnOccupiedRange(page);
  const newer = workspace.topology;
  newer.devices[1].name = "Changed remotely";
  await workspace.respond("/api/v1/topologies/lock-map", "PUT", newer);
  await page.evaluate((topology) => window.lockFixture.state.setTopology(topology), workspace.topology);
  const writes = workspace.writes.length;
  await page.locator("#rack-placement-dialog").getByRole("button", { name: "CONFIRM PLACEMENT" }).click();
  await expect(page.locator("#toast")).toContainText("The map changed");
  expect(workspace.writes).toHaveLength(writes);
  expect(workspace.topology.devices[1].name).toBe("Changed remotely");
  expect(workspace.topology.devices[1].rackUnit).toBe(4);
});
