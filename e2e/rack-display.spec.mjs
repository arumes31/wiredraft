import { expect, test } from "@playwright/test";
import { hardwareCatalog, instantiateProfile } from "../web/static/js/catalog.js";
import { mockLockWorkspace } from "./editor-lock-fixture.mjs";

async function serverRack(page) {
  const workspace = await mockLockWorkspace(page);
  const topology = workspace.topology;
  const server = instantiateProfile(hardwareCatalog.find((profile) => profile.model === "ProLiant DL360"), "SERVER BOTH FACES", { x: 0, y: 0 });
  Object.assign(server, { id: "server", rackId: "rack", rackUnit: 2, rackFace: "rear" });
  server.ports.forEach((port, index) => { port.id = `server-port-${index}`; port.deviceId = server.id; });
  topology.devices = [server];
  Object.assign(topology.racks[0], { positionX: 100, positionY: 100 });
  await workspace.respond("/api/v1/topologies/lock-map", "PUT", topology);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1700, height: 1000 });
  await page.goto("/");
  await expect(page.locator("#topology-name")).toHaveText(topology.name);
  return { workspace, errors };
}

test("server panels automatically open both rack faces and follow the saved device override", async ({ page }, testInfo) => {
  const { workspace, errors } = await serverRack(page);
  const topology = workspace.topology;
  await page.locator('[data-edit-mode="all"]').click();
  await page.evaluate(() => {
    const { state, canvas } = window.lockFixture;
    canvas.camera = { x: 10, y: 10, zoom: .55 };
    canvas.invalidate();
    state.select("device", "server");
  });
  const panels = () => page.evaluate(() => window.lockFixture.canvas.deviceRectangles().map((box) => ({ face: box.scene.face, y: box.y })));
  expect(await panels()).toEqual([{ face: "rear", y: 564 }, { face: "front", y: 564 }]);
  const setting = page.locator('[name="rackDisplay"]');
  await expect(setting).toHaveValue("");
  await expect(page.locator(".hardware-panel-controls")).toContainText("Hardware follows the rack face");
  const screenshotPath = testInfo.outputPath("server-front-and-rear.png");
  await page.locator("#diagram-canvas").screenshot({ path: screenshotPath });
  await testInfo.attach("server-front-and-rear.png", { path: screenshotPath, contentType: "image/png" });

  // Drag the secondary front representation; both panels must move one slot without an X jump.
  const from = await page.evaluate(() => {
    const { canvas } = window.lockFixture;
    const box = canvas.deviceRectangles().find((box) => box.face === "front");
    const rect = canvas.canvas.getBoundingClientRect();
    return { x: rect.x + canvas.camera.x + (box.x + 10) * canvas.camera.zoom,
      y: rect.y + canvas.camera.y + (box.y + 30) * canvas.camera.zoom };
  });
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x, from.y - 55, { steps: 8 });
  expect(await page.evaluate(() => ({ unit: window.lockFixture.canvas.rackDropPreview?.rackUnit,
    valid: window.lockFixture.canvas.rackDropPreview?.isValid }))).toEqual({ unit: 3, valid: true });
  await page.mouse.up();
  expect((await panels()).map((box) => box.y)).toEqual([464, 464]);
  expect(await page.evaluate(() => window.lockFixture.canvas.rackDropPreview)).toBeNull();

  await setting.selectOption("mounted");
  await page.getByRole("button", { name: "UPDATE DEVICE RECORD" }).click();
  await expect.poll(() => workspace.topology.devices[0].rackDisplay).toBe("mounted");
  await expect.poll(panels).toHaveLength(1);
  // Let the save's scheduled analysis request finish before replacing this mocked document.
  await page.waitForLoadState("networkidle");
  await page.reload();
  await expect(page.locator("#topology-name")).toHaveText(topology.name);
  await page.evaluate(() => window.lockFixture.state.select("device", "server"));
  await expect(setting).toHaveValue("mounted");
  await page.locator('[data-edit-mode="all"]').click();
  await setting.selectOption("both");
  await page.getByRole("button", { name: "UPDATE DEVICE RECORD" }).click();
  await expect.poll(() => workspace.topology.devices[0].rackDisplay).toBe("both");
  await expect.poll(panels).toHaveLength(2);
  expect(workspace.topology.devices).toHaveLength(1);
  expect(errors).toEqual([]);
});

test("reversed installation saves, reloads and undoes without changing rack allocation or port identities", async ({ page }) => {
  const { workspace, errors } = await serverRack(page);
  const before = workspace.topology.devices[0];
  await page.evaluate(() => window.lockFixture.state.select("device", "server"));
  const orientation = page.locator('[name="rackReversed"]');
  await expect(orientation).toHaveAttribute("aria-disabled", "true");
  await page.locator('[data-edit-mode="all"]').click();
  await orientation.selectOption("reversed");
  await page.getByRole("button", { name: "UPDATE DEVICE RECORD" }).click();
  await expect.poll(() => workspace.topology.devices[0].rackReversed).toBe(true);
  const panels = () => page.evaluate(() => window.lockFixture.canvas.deviceRectangles().map((box) =>
    ({ rackFace: box.face, hardwareFace: box.scene.face })).sort((a, b) => a.rackFace.localeCompare(b.rackFace)));
  const reversed = [{ rackFace: "front", hardwareFace: "rear" }, { rackFace: "rear", hardwareFace: "front" }];
  await expect.poll(panels).toEqual(reversed);
  expect(workspace.topology.devices[0]).toMatchObject({ rackId: before.rackId, rackUnit: before.rackUnit, rackFace: before.rackFace, ports: before.ports });
  await page.locator("#diagram-canvas").focus();
  await page.keyboard.press("Control+z");
  await expect.poll(() => workspace.topology.devices[0].rackReversed || false).toBe(false);
  await page.keyboard.press("Control+Shift+z");
  await expect.poll(() => workspace.topology.devices[0].rackReversed).toBe(true);
  await page.waitForLoadState("networkidle");
  await page.reload();
  await expect.poll(panels).toEqual(reversed);
  await page.evaluate(() => window.lockFixture.state.select("device", "server"));
  await expect(orientation).toHaveValue("reversed");
  await expect(page.locator(".hardware-panel-controls")).toContainText("rear on FRONT, front on REAR");
  expect(workspace.topology.devices[0].ports).toEqual(before.ports);
  expect(errors).toEqual([]);
});
