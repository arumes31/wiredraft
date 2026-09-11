import { expect, test } from "@playwright/test";
import { createLockWorkspace } from "./editor-lock-fixture.mjs";

async function fixture(page) {
  const workspace = createLockWorkspace();
  const conflicts = [];
  let delayNextWrite = false;
  let releaseWrite;
  let beforeNextWrite;
  await page.addInitScript(() => {
    window.EventSource = class { constructor() { queueMicrotask(() => this.onopen?.()); } addEventListener() {} close() {} };
  });
  await page.route("**/*", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    if (path.startsWith("/api/v1/topologies/lock-map") && method === "PUT") {
      if (beforeNextWrite) { const action = beforeNextWrite; beforeNextWrite = null; await action(); }
      const revision = request.headers()["if-match"];
      if (revision !== `"rev-${workspace.topology.revision}"`) {
        conflicts.push({ path, revision });
        await route.fulfill({ status: 409, json: { error: "topology changed since it was loaded", currentRevision: workspace.topology.revision } });
        return;
      }
    }
    const response = await workspace.respond(path, method, request.postData() ? request.postDataJSON() : undefined);
    if (path === "/js/app.js") response.body += "\nwindow.revisionFixture = { autosave, events };";
    if (method === "PUT" && delayNextWrite) {
      delayNextWrite = false;
      await new Promise((resolve) => { releaseWrite = resolve; });
    }
    await route.fulfill(response);
  });
  await page.setViewportSize({ width: 1700, height: 1000 });
  await page.goto("/");
  await expect(page.locator("#topology-name")).toHaveText("Editor lock fixture");
  await page.locator('[data-edit-mode="all"]').click();
  await page.evaluate(() => { const { canvas } = window.lockFixture; canvas.camera = { x: 10, y: 10, zoom: .7 }; canvas.invalidate(); });
  return { workspace, conflicts, race(action) { beforeNextWrite = action; }, delay() { delayNextWrite = true; }, release() { releaseWrite?.(); }, get held() { return Boolean(releaseWrite); } };
}

async function drag(page, id, dx, dy, { multi = false, release = true } = {}) {
  const from = await page.evaluate((id) => {
    const { canvas } = window.lockFixture;
    const box = canvas.deviceRectangles().find((box) => box.device.id === id);
    const rect = canvas.canvas.getBoundingClientRect();
    return { x: rect.x + canvas.camera.x + (box.x + 10) * canvas.camera.zoom,
      y: rect.y + canvas.camera.y + (box.y + 30) * canvas.camera.zoom };
  }, id);
  if (multi) await page.keyboard.down("Shift");
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  await page.mouse.move(from.x + dx * .7, from.y + dy * .7, { steps: 6 });
  if (release) await page.mouse.up();
  if (multi) await page.keyboard.up("Shift");
}

test("a multi-device drag saves every position without competing revisions", async ({ page }) => {
  const f = await fixture(page);
  await page.evaluate(() => { window.lockFixture.canvas.selectedDevices = new Set(["device-0", "device-1"]); });
  await drag(page, "device-0", 100, 0, { multi: true });
  await expect.poll(() => f.workspace.topology.devices.map((device) => device.positionX)).toEqual([200, 200]);
  expect(f.conflicts).toEqual([]);
  expect(f.workspace.writes).toHaveLength(1);
});

test("an earlier save response cannot cancel the next drag or race autosave", async ({ page }) => {
  const f = await fixture(page);
  f.delay();
  await drag(page, "device-0", 100, 0);
  await expect.poll(() => f.held).toBe(true);
  expect(await page.evaluate(() => window.revisionFixture.autosave.isDirty)).toBe(true);
  await drag(page, "device-0", 0, 100, { release: false });
  await page.evaluate(() => { window.revisionFixture.autosave.markDirty(); window.revisionFixture.autosave.flush().catch(() => {}); });
  f.release();
  await expect.poll(() => page.evaluate(() => window.lockFixture.state.topology.revision)).toBe(f.workspace.topology.revision);
  expect(await page.evaluate(() => window.lockFixture.canvas.drag?.active)).toBe(true);
  await page.mouse.up();
  await expect.poll(() => ({ x: f.workspace.topology.devices[0].positionX, y: f.workspace.topology.devices[0].positionY })).toEqual({ x: 200, y: 300 });
  expect(f.conflicts).toEqual([]);
});

test("a stale revision retries the placement while preserving remote device edits", async ({ page }) => {
  const f = await fixture(page);
  const remote = f.workspace.topology;
  remote.devices[0].name = "Renamed remotely";
  await f.workspace.respond("/api/v1/topologies/lock-map", "PUT", remote);
  await drag(page, "device-0", 100, 0);
  await expect.poll(() => f.workspace.topology.devices[0].positionX).toBe(200);
  expect(f.workspace.topology.devices[0].name).toBe("Renamed remotely");
});

test("a live update during a drag keeps its preview and the remote changes", async ({ page }) => {
  const f = await fixture(page);
  await drag(page, "device-0", 100, 0, { release: false });
  const remote = f.workspace.topology;
  remote.devices[1].name = "Remote peer";
  remote.devices[1].positionX = 500;
  await f.workspace.respond("/api/v1/topologies/lock-map", "PUT", remote);
  await page.evaluate((topology) => window.revisionFixture.events.onTopology(topology), f.workspace.topology);
  const secondRemote = f.workspace.topology; secondRemote.devices[1].positionX = 600;
  await f.workspace.respond("/api/v1/topologies/lock-map", "PUT", secondRemote);
  await page.evaluate((topology) => window.revisionFixture.events.onTopology(topology), f.workspace.topology);
  expect(await page.evaluate(() => window.lockFixture.canvas.drag?.active)).toBe(true);
  expect(await page.evaluate(() => window.lockFixture.state.topology.devices[1].positionX)).toBe(600);
  await page.mouse.up();
  await expect.poll(() => f.workspace.topology.devices[0].positionX).toBe(200);
  expect(f.workspace.topology.devices[1].name).toBe("Remote peer");
  expect(await page.evaluate(() => window.lockFixture.state.history.at(-1).devices[1].positionX)).toBe(600);
});

test("a revision conflict between reading and saving retries only the placement", async ({ page }) => {
  const f = await fixture(page);
  f.race(async () => {
    const remote = f.workspace.topology;
    remote.devices[0].owner = "Remote team";
    await f.workspace.respond("/api/v1/topologies/lock-map", "PUT", remote);
  });
  await drag(page, "device-0", 100, 0);
  await expect.poll(() => f.workspace.topology.devices[0].positionX).toBe(200);
  expect(f.workspace.topology.devices[0].owner).toBe("Remote team");
  expect(f.conflicts).toHaveLength(1);
  await expect(page.locator("#toast")).not.toContainText("topology changed since it was loaded");
});

test("a competing remote move is retained and reported instead of overwritten", async ({ page }) => {
  const f = await fixture(page);
  await drag(page, "device-0", 100, 0, { release: false });
  const remote = f.workspace.topology; remote.devices[0].positionX = 500;
  await f.workspace.respond("/api/v1/topologies/lock-map", "PUT", remote);
  await page.mouse.up();
  await expect(page.locator("#toast")).toContainText("moved in another session");
  expect(f.workspace.topology.devices[0].positionX).toBe(500);
  expect(await page.evaluate(() => window.lockFixture.state.topology.devices[0].positionX)).toBe(500);
});

test("two completed drops stay ordered while the first response is delayed", async ({ page }) => {
  const f = await fixture(page);
  f.delay();
  await drag(page, "device-0", 100, 0);
  await expect.poll(() => f.held).toBe(true);
  await drag(page, "device-0", 0, 100);
  f.release();
  await expect.poll(() => ({ x: f.workspace.topology.devices[0].positionX, y: f.workspace.topology.devices[0].positionY })).toEqual({ x: 200, y: 300 });
  expect(f.conflicts).toEqual([]);
  await expect.poll(() => page.evaluate(() => window.revisionFixture.autosave.isDirty)).toBe(false);
});

test("an autosave already in flight does not overwrite a completed drop", async ({ page }) => {
  const f = await fixture(page);
  f.delay();
  await page.evaluate(() => { window.revisionFixture.autosave.markDirty(); window.revisionFixture.autosave.flush().catch(() => {}); });
  await expect.poll(() => f.held).toBe(true);
  await drag(page, "device-0", 100, 0);
  f.release();
  await expect.poll(() => f.workspace.topology.devices[0].positionX).toBe(200);
  expect(f.conflicts).toEqual([]);
});

test("manual save during a drag explains the deferral and persists on drop", async ({ page }) => {
  const f = await fixture(page);
  await drag(page, "device-0", 100, 0, { release: false });
  await page.keyboard.press("Control+s");
  await expect(page.locator("#toast")).toContainText("Save deferred until the drag completes");
  expect(f.workspace.writes).toHaveLength(0);
  await page.mouse.up();
  await expect.poll(() => f.workspace.topology.devices[0].positionX).toBe(200);
  await expect.poll(() => page.evaluate(() => window.revisionFixture.autosave.isDirty)).toBe(false);
  await page.keyboard.press("Control+s");
  await expect(page.locator("#toast")).toContainText("Topology saved");
});

test("a failed inspector update and recovery read report the original error without an unhandled rejection", async ({ page }) => {
  const f = await fixture(page);
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.route("**/api/v1/topologies/lock-map/devices/device-0", (route) =>
    route.fulfill({ status: 500, json: { error: "Device update unavailable" } }));
  await page.route("**/api/v1/topologies/lock-map", (route) =>
    route.fulfill({ status: 500, json: { error: "Recovery unavailable" } }));
  await page.evaluate(() => window.lockFixture.state.select("device", "device-0"));
  await page.locator('#device-inspector-form [name="name"]').fill("Changed");
  const recovery = page.waitForResponse((response) => response.url().endsWith("/api/v1/topologies/lock-map") && response.request().method() === "GET");
  await page.locator("#device-inspector-form button.primary").click();
  await (await recovery).finished();
  await expect(page.locator("#toast")).toContainText("Device update unavailable");
  await page.unroute("**/api/v1/topologies/lock-map/devices/device-0");
  await page.unroute("**/api/v1/topologies/lock-map");
  await page.locator("#device-inspector-form button.primary").click();
  await expect.poll(() => f.workspace.topology.devices[0].name).toBe("Changed");
  expect(pageErrors).toEqual([]);
});
