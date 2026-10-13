import { expect, test } from "@playwright/test";
import { mockLockWorkspace } from "./editor-lock-fixture.mjs";

async function setup(page, unlock = true) {
  const workspace = await mockLockWorkspace(page);
  await page.setViewportSize({ width: 1700, height: 1000 });
  await page.goto("/");
  await expect(page.locator("#topology-name")).toHaveText(workspace.topology.name);
  if (unlock) await page.locator('[data-edit-mode="all"]').click();
  await page.evaluate(() => {
    const { canvas } = window.lockFixture;
    canvas.camera = { x: 10, y: 10, zoom: .55 };
    canvas.invalidate();
  });
  return workspace;
}

async function rightClick(page, point) {
  const screen = await page.evaluate(({ x, y }) => {
    const { canvas } = window.lockFixture;
    const rect = canvas.canvas.getBoundingClientRect();
    return { x: rect.x + canvas.camera.x + x * canvas.camera.zoom,
      y: rect.y + canvas.camera.y + y * canvas.camera.zoom };
  }, point);
  await page.mouse.click(screen.x, screen.y, { button: "right" });
}

async function chooseDevice(page) {
  await page.locator("#add-device-here-button").click();
  await expect(page.locator("#device-dialog")).toBeVisible();
  await page.locator("#device-vendor").selectOption("Juniper");
  await page.locator("#device-model").selectOption("EX2300-24T");
}

test("right-click adds hardware at the clicked world position and supports undo", async ({ page }) => {
  const workspace = await setup(page);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await rightClick(page, { x: 200, y: 840 });
  await expect(page.locator("#device-context-menu")).toBeVisible();
  await expect(page.locator("#add-device-here-button")).toBeFocused();
  await page.screenshot({ path: test.info().outputPath("add-device-here.png") });
  await chooseDevice(page);
  await expect(page.locator("#device-placement-note")).toContainText("X 200 · Y 840");
  await page.getByRole("button", { name: "PLACE DEVICE", exact: true }).click();
  await expect(page.locator("#device-dialog")).toBeHidden();
  await expect.poll(() => workspace.topology.devices.length).toBe(3);
  const created = workspace.topology.devices.at(-1);
  expect(created.positionX).toBeCloseTo(200);
  expect(created.positionY).toBeCloseTo(840);
  expect(await page.evaluate(() => window.lockFixture.state.selection.id)).toBe(created.id);
  await page.locator("#diagram-canvas").focus();
  await page.keyboard.press("Control+z");
  await expect.poll(() => workspace.topology.devices.length).toBe(2);
  expect(errors).toEqual([]);
});

for (const face of ["front", "rear"]) {
  test(`right-click installs at the exact free rack unit on the ${face} elevation`, async ({ page }) => {
    const workspace = await setup(page);
    await page.evaluate((rackFace) => window.lockFixture.state.setRackFace("rack", rackFace), face);
    await rightClick(page, { x: 1200, y: 614 }); // U3 in the six-unit rack.
    await chooseDevice(page);
    await expect(page.locator("#device-placement-note")).toContainText(`${face.toUpperCase()} · U3`);
    await page.getByRole("button", { name: "PLACE DEVICE", exact: true }).click();
    await expect.poll(() => workspace.topology.devices.length).toBe(3);
    expect(workspace.topology.devices.at(-1)).toMatchObject({ rackId: "rack", rackUnit: 3, rackFace: face });
  });
}

test("cancelling clears the requested position and the menu dismisses with Escape", async ({ page }) => {
  const workspace = await setup(page);
  await rightClick(page, { x: 1200, y: 614 });
  await page.locator("#topology-name").click();
  await expect(page.locator("#device-context-menu")).toBeHidden();
  await rightClick(page, { x: 1200, y: 614 });
  await page.keyboard.press("Escape");
  await expect(page.locator("#device-context-menu")).toBeHidden();
  await rightClick(page, { x: 1200, y: 614 });
  await chooseDevice(page);
  await page.keyboard.press("Escape");
  await expect(page.locator("#device-dialog")).toBeHidden();
  expect(workspace.topology.devices).toHaveLength(2);
  await page.locator("#add-device-button").click();
  await expect(page.locator("#device-placement-note")).toBeHidden();
});

test("a rack unit occupied while choosing a device is rejected without losing the form", async ({ page }) => {
  const workspace = await setup(page);
  await rightClick(page, { x: 1200, y: 614 });
  await chooseDevice(page);
  const changed = workspace.topology;
  Object.assign(changed.devices[0], { rackId: "rack", rackUnit: 3, rackFace: "front" });
  await workspace.respond("/api/v1/topologies/lock-map", "PUT", changed);
  await page.evaluate((topology) => window.lockFixture.state.setTopology(topology), workspace.topology);
  await page.getByRole("button", { name: "PLACE DEVICE", exact: true }).click();
  await expect(page.locator("#toast")).toContainText("does not fit at U3");
  await expect(page.locator("#device-dialog")).toBeVisible();
  expect(workspace.topology.devices).toHaveLength(2);
  expect(workspace.writes.filter((write) => write.method === "POST")).toHaveLength(0);
});

test("read-only and cabling-only modes do not offer device creation", async ({ page }) => {
  await setup(page, false);
  await rightClick(page, { x: 1200, y: 614 });
  await expect(page.locator("#device-context-menu")).toBeHidden();
  await page.locator('[data-edit-mode="cabling"]').click();
  await rightClick(page, { x: 1200, y: 614 });
  await expect(page.locator("#device-context-menu")).toBeHidden();
});
