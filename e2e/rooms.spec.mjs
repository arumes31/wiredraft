import { test, expect } from "@playwright/test";
import { mockLockWorkspace } from "./editor-lock-fixture.mjs";

test("room edits survive immediate equipment updates with autosave disabled", async ({ page }) => {
  const workspace = await mockLockWorkspace(page);
  await page.goto("/");
  await expect(page.locator("#topology-name")).toHaveText(workspace.topology.name);
  await page.locator('[data-edit-mode="all"]').click();
  await page.locator("#autosave-menu > summary").click();
  await page.locator("#autosave-enabled").uncheck();
  await page.locator("#autosave-menu > summary").click();
  await page.locator("#add-room-button").click();
  await page.locator('#room-form [name="name"]').fill("Office");
  await page.locator('#room-form button.primary').click();
  await expect(page.locator("#room-dialog")).toBeHidden();
  await page.evaluate(() => window.lockFixture.state.select("device", "device-1"));
  await page.locator('#device-inspector-form [name="name"]').fill("Updated printer");
  await page.getByRole("button", { name: "UPDATE DEVICE RECORD" }).click();
  await expect.poll(() => workspace.topology.devices[1].name).toBe("Updated printer");
  expect(workspace.topology.rooms?.map(room => room.name)).toEqual(["Office"]);
  expect(await page.evaluate(() => window.lockFixture.state.topology.rooms?.map(room => room.name))).toEqual(["Office"]);
});

test("room creation waits for an equipment write already in flight", async ({ page }) => {
  const workspace = await mockLockWorkspace(page);
  let release, started = false;
  const pending = new Promise(resolve => { release = resolve; });
  await page.route("**/api/v1/topologies/lock-map/devices/device-1", async route => {
    started = true;
    await pending;
    const request = route.request();
    await route.fulfill(await workspace.respond(new URL(request.url()).pathname, request.method(), request.postDataJSON()));
  });
  await page.goto("/");
  await expect(page.locator("#topology-name")).toHaveText(workspace.topology.name);
  await page.locator('[data-edit-mode="all"]').click();
  await page.evaluate(() => window.lockFixture.state.select("device", "device-1"));
  await page.locator('#device-inspector-form [name="name"]').fill("Updated device");
  await page.getByRole("button", { name: "UPDATE DEVICE RECORD" }).click();
  await expect.poll(() => started).toBe(true);
  await page.locator("#add-room-button").click();
  await page.locator('#room-form [name="name"]').fill("Queued room");
  await page.locator('#room-form button.primary').click();
  release();
  await expect.poll(() => workspace.topology.rooms?.[0]?.name).toBe("Queued room");
  expect(workspace.topology.devices[1].name).toBe("Updated device");
  await expect(page.locator("#room-dialog")).toBeHidden();
});

test("right-click creates a room at the pointer and hardware inherits the room", async ({ page }) => {
  const workspace = await mockLockWorkspace(page);
  await page.setViewportSize({ width: 1700, height: 1000 });
  await page.goto("/");
  await expect(page.locator("#topology-name")).toHaveText(workspace.topology.name);
  await page.locator('[data-edit-mode="all"]').click();
  await page.evaluate(() => { const { canvas } = window.lockFixture; canvas.camera = { x: 10, y: 10, zoom: .55 }; canvas.invalidate(); });
  async function rightClick(point) {
    const screen = await page.evaluate(point => {
      const { canvas } = window.lockFixture, rect = canvas.canvas.getBoundingClientRect();
      return { x: rect.x + canvas.camera.x + point.x * canvas.camera.zoom, y: rect.y + canvas.camera.y + point.y * canvas.camera.zoom };
    }, point);
    await page.mouse.click(screen.x, screen.y, { button: "right" });
  }
  await rightClick({ x: 200, y: 840 });
  await page.locator("#add-room-here-button").click();
  await page.locator('#room-form [name="name"]').fill("Office");
  await page.locator('#room-form button.primary').click();
  await expect(page.locator("#room-dialog")).toBeHidden();
  expect(workspace.topology.rooms[0]).toMatchObject({ positionX: 200, positionY: 840 });
  await rightClick({ x: 500, y: 1100 });
  await page.locator("#add-device-here-button").click();
  await page.locator("#device-vendor").selectOption("Juniper");
  await page.locator("#device-model").selectOption("EX2300-24T");
  await page.getByRole("button", { name: "PLACE DEVICE", exact: true }).click();
  await expect.poll(() => workspace.topology.devices.length).toBe(3);
  expect(workspace.topology.devices.at(-1).roomId).toBe(workspace.topology.rooms[0].id);
});

test("room headers expand on double click and cancelled movement restores all members", async ({ page }) => {
  const workspace = await mockLockWorkspace(page);
  const topology = workspace.topology;
  topology.rooms = [{ id: "room", name: "Office", positionX: 0, positionY: 0, width: 1800, height: 1200, color: "#42d9c8" }];
  topology.devices[0].roomId = "room";
  await workspace.respond("/api/v1/topologies/lock-map", "PUT", topology);
  await page.setViewportSize({ width: 1700, height: 1000 });
  await page.goto("/");
  await expect(page.locator("#topology-name")).toHaveText(topology.name);
  await page.getByRole("button", { name: "Room Office", exact: true }).click();
  await page.locator("#toggle-room").click();
  const headerPoint = () => page.evaluate(() => {
    const { canvas } = window.lockFixture, box = canvas.roomRectangles()[0], rect = canvas.canvas.getBoundingClientRect();
    return { x: rect.x + canvas.camera.x + (box.x + 600) * canvas.camera.zoom,
      y: rect.y + canvas.camera.y + (box.y + 40) * canvas.camera.zoom };
  });
  let point = await headerPoint();
  await page.mouse.dblclick(point.x, point.y);
  await expect(page.locator("#toggle-room")).toHaveText("COLLAPSE ROOM");
  await page.locator('[data-edit-mode="all"]').click();
  point = await headerPoint();
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 80, point.y + 80, { steps: 5 });
  expect(await page.evaluate(() => window.lockFixture.state.topology.rooms[0].positionX)).not.toBe(0);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  expect(await page.evaluate(() => window.lockFixture.state.topology.rooms[0].positionX)).toBe(0);
  expect(await page.evaluate(() => window.lockFixture.state.topology.devices[0].positionX)).toBe(topology.devices[0].positionX);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 80, point.y + 80, { steps: 5 });
  await page.evaluate(() => window.lockFixture.editLock.setMode("read-only", "test"));
  await page.mouse.up();
  expect(await page.evaluate(() => window.lockFixture.state.topology.rooms[0].positionX)).toBe(0);
  expect(workspace.writes.filter(write => write.method === "PUT")).toHaveLength(1);
});

test("rooms group equipment, move together, collapse locally, and persist with undo", async ({ page }, testInfo) => {
  // This complete lifecycle includes two saves, history replay, reload and screenshots.
  test.setTimeout(60_000);
  const workspace = await mockLockWorkspace(page);
  const topology = workspace.topology;
  topology.links = [{ id: "cable", sourcePortId: "port-0-0", targetPortId: "port-1-0", cableType: "Cat6", vlanIds: [] }];
  await workspace.respond("/api/v1/topologies/lock-map", "PUT", topology);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width: 1700, height: 1000 });
  await page.goto("/");
  await expect(page.locator("#topology-name")).toHaveText(topology.name);
  await expect(page.locator("#add-room-button")).toHaveAttribute("aria-disabled", "true");
  await page.locator('[data-edit-mode="all"]').click();
  await page.locator("#add-room-button").click();
  await page.locator('#room-form [name="name"]').fill("Serverraum");
  await page.locator('#room-form [name="building"]').fill("Zentrale");
  await page.locator('#room-form [name="floor"]').fill("EG");
  await page.locator('#room-form button.primary').click();
  const inspector = page.locator("#room-inspector-form");
  await expect(inspector).toBeVisible();
  await inspector.locator('[name="racks"][value="rack"]').check();
  await inspector.locator('[name="devices"][value="device-0"]').check();
  await inspector.getByRole("button", { name: "UPDATE ROOM" }).click();
  const before = await page.evaluate(() => structuredClone(window.lockFixture.state.topology));
  const roomID = before.rooms[0].id;
  expect(before.racks[0].roomId).toBe(roomID);
  expect(before.devices[0].roomId).toBe(roomID);
  await page.locator("#focus-room").click();
  const header = await page.evaluate(() => {
    const { canvas } = window.lockFixture;
    const box = canvas.roomRectangles()[0], rect = canvas.canvas.getBoundingClientRect();
    return { x: rect.x + canvas.camera.x + (box.x + 300) * canvas.camera.zoom,
      y: rect.y + canvas.camera.y + (box.y + 40) * canvas.camera.zoom, zoom: canvas.camera.zoom };
  });
  await page.mouse.move(header.x, header.y);
  await page.mouse.down();
  await page.mouse.move(header.x + 80, header.y + 50, { steps: 10 });
  await page.mouse.up();
  const moved = await page.evaluate(() => window.lockFixture.state.topology);
  const dx = moved.rooms[0].positionX - before.rooms[0].positionX;
  expect(dx).toBeGreaterThan(0);
  expect(moved.racks[0].positionX - before.racks[0].positionX).toBe(dx);
  expect(moved.devices[0].positionX - before.devices[0].positionX).toBe(dx);
  expect(moved.devices[1]).toEqual(before.devices[1]);
  await page.keyboard.press("Control+z");
  await expect.poll(() => page.evaluate(() => window.lockFixture.state.topology.rooms[0].positionX)).toBe(before.rooms[0].positionX);
  await page.keyboard.press("Control+Shift+z");
  await expect.poll(() => workspace.topology.rooms[0].positionX).toBe(moved.rooms[0].positionX);
  await page.locator('[data-edit-mode="read-only"]').click();
  await expect(inspector.locator('[name="name"]')).toHaveAttribute("aria-disabled", "true");
  await page.locator("#toggle-room").click();
  const collapsed = await page.evaluate(() => {
    const { canvas } = window.lockFixture;
    return { racks: canvas.rackRectangles().length, devices: canvas.deviceRectangles().map(box => box.device.id), bundles: canvas.roomBundles.length };
  });
  expect(collapsed).toEqual({ racks: 0, devices: ["device-1"], bundles: 1 });
  await page.keyboard.press("Control+s");
  await expect.poll(() => workspace.topology.rooms?.[0]?.name).toBe("Serverraum");
  await expect(page.locator("#save-state-label")).toHaveText("SAVED");
  expect(workspace.topology.links).toEqual(topology.links);
  await page.reload();
  await expect(page.locator("#topology-name")).toHaveText(topology.name);
  await page.getByRole("button", { name: "Room Serverraum", exact: true }).click();
  await expect(page.locator("#toggle-room")).toHaveText("COLLAPSE ROOM");
  await page.locator("#focus-room").click();
  await page.screenshot({ path: testInfo.outputPath("rooms-expanded.png") });
  await page.locator("#toggle-room").click();
  await page.screenshot({ path: testInfo.outputPath("rooms-collapsed.png") });
  await page.locator('[data-edit-mode="all"]').click();
  await page.locator("#delete-room").click();
  expect(await page.evaluate(() => window.lockFixture.state.topology.rooms)).toEqual([]);
  expect(await page.evaluate(() => window.lockFixture.state.topology.devices.length)).toBe(2);
  await page.keyboard.press("Control+z");
  expect(await page.evaluate(() => window.lockFixture.state.topology.rooms.length)).toBe(1);
  expect(errors).toEqual([]);
});
