import { expect, test } from "@playwright/test";
import { mockLockWorkspace } from "./editor-lock-fixture.mjs";

test.use({ viewport: { width: 1920, height: 1080 } });

test("rack moves past the origin, saves, reloads and remains visible in fit, minimap and export", async ({ page }) => {
  const workspace = await mockLockWorkspace(page);
  let saved = workspace.topology;
  Object.assign(saved.racks[0], { positionX: 0, positionY: 0 });
  saved.devices.forEach((device) => { device.positionX = 1800; });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/v1/topologies/lock-map**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/v1/topologies/lock-map" && request.method() === "PUT") {
      saved = request.postDataJSON();
      saved.revision++;
      return route.fulfill({ json: saved });
    }
    if (path === "/api/v1/topologies/lock-map" && request.method() === "GET") return route.fulfill({ json: saved });
    return route.fallback();
  });
  await page.goto("/");
  await expect(page.locator("#topology-name")).toHaveText(saved.name);
  await page.locator('[data-edit-mode="all"]').click();
  await page.evaluate(() => {
    const { canvas } = window.lockFixture;
    Object.assign(canvas.camera, { x: 400, y: 320, zoom: .5 });
    canvas.invalidate();
  });
  const area = await page.locator("#diagram-canvas").boundingBox();
  await page.mouse.move(area.x + 450, area.y + 335);
  await page.mouse.down();
  await page.mouse.move(area.x + 250, area.y + 185, { steps: 10 });
  await page.mouse.up();
  await expect.poll(() => saved.racks[0].positionX).toBe(-400);
  expect(saved.racks[0].positionY).toBe(-300);
  await page.reload();
  await expect(page.locator("#topology-name")).toHaveText(saved.name);
  await page.locator("#fit-button").click();
  const geometry = await page.evaluate(async () => {
    const { canvas, state } = window.lockFixture;
    const { TopologyMinimap } = await import("/js/minimap.js");
    const transform = TopologyMinimap.prototype.transform.call({ engine: canvas }, 220, 132);
    const rack = canvas.rackRectangles()[0];
    const output = canvas.renderExport();
    return { position: state.topology.racks[0], bounds: canvas.worldBounds(),
      screenX: rack.x * canvas.camera.zoom + canvas.camera.x,
      screenY: rack.y * canvas.camera.zoom + canvas.camera.y,
      miniX: transform.x(rack.x), miniY: transform.y(rack.y),
      exportWidth: output.width, exportHeight: output.height };
  });
  expect(geometry.position).toMatchObject({ positionX: -400, positionY: -300 });
  expect(geometry.bounds.x).toBeLessThanOrEqual(-400);
  expect(geometry.bounds.y).toBeLessThanOrEqual(-300);
  expect(geometry.screenX).toBeGreaterThanOrEqual(0);
  expect(geometry.screenY).toBeGreaterThanOrEqual(0);
  expect(geometry.miniX).toBeGreaterThanOrEqual(0);
  expect(geometry.miniY).toBeGreaterThanOrEqual(0);
  expect(geometry.exportWidth).toBeGreaterThan(0);
  expect(geometry.exportHeight).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
