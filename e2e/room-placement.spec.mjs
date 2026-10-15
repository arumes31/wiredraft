import { test, expect } from "@playwright/test";
import { mockLockWorkspace } from "./editor-lock-fixture.mjs";

async function openWorkspace(page) {
  const workspace = await mockLockWorkspace(page);
  const topology = workspace.topology;
  topology.rooms = [{ id: "room", name: "Server room", positionX: -3000, positionY: -1500, width: 1800, height: 1200, color: "#42d9c8" }];
  topology.racks.push({ id: "tall-rack", name: "Tall rack", positionX: 2400, positionY: 200, heightU: 42, color: "#304348" });
  Object.assign(topology.devices[0], { rackId: "rack", rackUnit: 2, rackFace: "front" });
  topology.links = [{ id: "cable", sourcePortId: "port-0-0", targetPortId: "port-1-0", cableType: "Cat6", vlanIds: [] }];
  await workspace.respond("/api/v1/topologies/lock-map", "PUT", topology);
  await page.setViewportSize({ width: 1700, height: 1000 });
  await page.goto("/");
  await expect(page.locator("#topology-name")).toHaveText(topology.name);
  await page.locator('[data-edit-mode="all"]').click();
  return workspace;
}

async function dragEquipment(page, type, id, target, cancel = false) {
  const points = await page.evaluate(({ type, id, target }) => {
    const { canvas } = window.lockFixture;
    const box = type === "rack" ? canvas.rackRectangles().find(box => box.rack.id === id)
      : canvas.deviceRectangles().find(box => box.device.id === id);
    const start = { x: box.x + (type === "rack" ? 250 : 80), y: box.y + (type === "rack" ? 30 : box.height * .85) };
    const rect = canvas.canvas.getBoundingClientRect();
    const zoom = Math.min(.5, (rect.width - 360) / (Math.abs(target.x - start.x) + 100),
      (rect.height - 360) / (Math.abs(target.y - start.y) + 100));
    canvas.camera = { x: 180 - Math.min(start.x, target.x) * zoom, y: 180 - Math.min(start.y, target.y) * zoom, zoom };
    canvas.invalidate();
    const screen = point => ({ x: rect.x + canvas.camera.x + point.x * zoom, y: rect.y + canvas.camera.y + point.y * zoom });
    return { start: screen(start), end: screen(target) };
  }, { type, id, target });
  await page.mouse.move(points.start.x, points.start.y);
  await page.mouse.down();
  await page.mouse.move(points.end.x, points.end.y, { steps: 8 });
  if (cancel) await page.keyboard.press("Escape");
  await page.mouse.up();
}

test("racks and devices move to negative coordinates, persist, and cancel cleanly", async ({ page }) => {
  const workspace = await openWorkspace(page);
  const before = workspace.topology;
  await dragEquipment(page, "rack", "rack", { x: -5000, y: -3000 }, true);
  expect(await page.evaluate(() => window.lockFixture.state.topology.racks)).toEqual(before.racks);
  expect(await page.evaluate(() => window.lockFixture.state.topology.devices)).toEqual(before.devices);
  await dragEquipment(page, "device", "device-1", { x: -5000, y: -3000 });
  await expect.poll(() => workspace.topology.devices[1].positionX).toBeLessThan(0);
  expect(workspace.topology.devices[1].positionY).toBeLessThan(0);
  await dragEquipment(page, "rack", "rack", { x: -5000, y: -4000 });
  await expect.poll(() => workspace.topology.racks[0].positionY).toBeLessThan(0);
  const moved = workspace.topology;
  expect(moved.racks[0].positionX).toBeLessThan(0);
  expect(moved.devices[0].positionX - before.devices[0].positionX).toBe(moved.racks[0].positionX - before.racks[0].positionX);
  expect(moved.devices[0].positionY - before.devices[0].positionY).toBe(moved.racks[0].positionY - before.racks[0].positionY);
  expect(moved.links).toEqual(before.links);
  await page.reload();
  await expect(page.locator("#topology-name")).toHaveText(before.name);
  expect(await page.evaluate(() => window.lockFixture.state.topology.racks)).toEqual(moved.racks);
  expect(await page.evaluate(() => window.lockFixture.state.topology.devices)).toEqual(moved.devices);
});

test("room snapping and resizing are visible before the save response arrives", async ({ page }) => {
  const workspace = await openWorkspace(page);
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  await page.route("**/api/v1/topologies/lock-map", async route => {
    const request = route.request();
    if (request.method() === "PUT") await pending;
    await route.fulfill(await workspace.respond(new URL(request.url()).pathname, request.method(), request.postData() ? request.postDataJSON() : undefined));
  });
  try {
    await dragEquipment(page, "rack", "tall-rack", { x: -2800, y: -1300 });
    const preview = await page.evaluate(() => {
      const { canvas, state } = window.lockFixture;
      const rack = state.topology.racks[1], box = canvas.rackRectangles().find(box => box.rack.id === rack.id);
      return { roomId: rack.roomId, x: box.x, y: box.y, height: canvas.roomRectangles()[0].height };
    });
    expect(preview).toMatchObject({ roomId: "room", x: -2940, y: -1340 });
    expect(preview.height).toBeGreaterThan(4400);
    expect(workspace.topology.racks[1].roomId).toBeUndefined();
  } finally { release(); }
  await expect.poll(() => workspace.topology.racks[1].roomId).toBe("room");
});

test("room drops arrange several racks and devices, resize, undo, reload and detach", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  const workspace = await openWorkspace(page);
  const before = workspace.topology;
  await dragEquipment(page, "rack", "rack", { x: -2800, y: -1300 });
  await expect.poll(() => workspace.topology.racks[0].roomId).toBe("room");
  expect(workspace.topology.racks[0]).toMatchObject({ positionX: -2940, positionY: -1340 });
  await dragEquipment(page, "rack", "tall-rack", { x: -2800, y: -1300 });
  await expect.poll(() => workspace.topology.racks[1].roomId).toBe("room");
  const racks = workspace.topology.racks;
  expect(racks[1].positionX).toBeGreaterThanOrEqual(racks[0].positionX + 1590 + 60);
  expect(racks[1].positionY).toBe(racks[0].positionY);
  await dragEquipment(page, "device", "device-1", { x: -2980, y: -1380 });
  await expect.poll(() => workspace.topology.devices[1].roomId).toBe("room");
  expect(workspace.topology.devices[1].rackId).toBe("");
  expect(workspace.topology.devices[1].positionY).toBeGreaterThan(racks[1].positionY + 4284);
  const outline = await page.evaluate(() => {
    const { canvas, state } = window.lockFixture;
    state.setAllRacksDualFace(true);
    const room = canvas.roomRectangles()[0];
    const boxes = [...canvas.rackRectangles(), ...canvas.deviceRectangles()];
    return { width: room.width, height: room.height, contained: boxes.every(box => box.x >= room.x + 60 &&
      box.y >= room.y + 160 && box.x + box.width <= room.x + room.width - 60 && box.y + box.height <= room.y + room.height - 60) };
  });
  expect(outline.contained).toBe(true);
  expect(outline.width).toBeGreaterThan(1800);
  expect(outline.height).toBeGreaterThan(1200);
  expect(workspace.topology.links).toEqual(before.links);
  await page.evaluate(() => window.lockFixture.canvas.focusRoom("room"));
  await page.screenshot({ path: testInfo.outputPath("room-multiple-racks.png") });
  await page.keyboard.press("Control+z");
  await expect.poll(() => workspace.topology.devices[1].roomId || "").toBe("");
  await expect(page.locator("#save-state-label")).toHaveText("SAVED");
  await page.keyboard.press("Control+Shift+z");
  await expect.poll(() => workspace.topology.devices[1].roomId).toBe("room");
  await expect(page.locator("#save-state-label")).toHaveText("SAVED");
  await page.reload();
  await expect(page.locator("#topology-name")).toHaveText(before.name);
  expect(await page.evaluate(() => window.lockFixture.state.topology.racks.map(rack => rack.roomId))).toEqual(["room", "room"]);
  await page.locator('[data-edit-mode="all"]').click();
  await dragEquipment(page, "device", "device-1", { x: 4000, y: -2500 });
  await expect.poll(() => workspace.topology.devices[1].roomId).toBe("");
  await dragEquipment(page, "rack", "tall-rack", { x: 4000, y: -2000 });
  await expect.poll(() => workspace.topology.racks[1].roomId).toBe("");
  expect(await page.evaluate(() => {
    const box = window.lockFixture.canvas.roomRectangles()[0];
    return { width: box.width, height: box.height };
  })).toEqual({ width: 1800, height: 1200 });
});
