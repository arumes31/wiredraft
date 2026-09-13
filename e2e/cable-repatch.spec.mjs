import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { hardwareCatalog, instantiateProfile } from "../web/static/js/catalog.js";
import { unlockEditor } from "./auth-helper.mjs";

let fixture;
test.beforeEach(async ({ page }) => {
  fixture = null;
  await page.route(/\/js\/app\.js(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: await response.text() + "\nwindow.repatchFixture = { state, canvas };" });
  });
  await page.setViewportSize({ width: 1700, height: 1000 });
  // Establish the guest session before loading the app so setup needs only one navigation.
  const guest = await page.request.post("/api/v1/auth/guest", { data: {} });
  expect(guest.ok()).toBe(true);
  const { csrfToken } = await page.request.get("/api/v1/auth/status").then(response => response.json());
  const headers = { "X-CSRF-Token": csrfToken };
  async function post(path, data) {
    const response = await page.request.post(path, { data, headers });
    expect(response.ok(), await response.text()).toBe(true);
    return response.json();
  }
  let topology = await post("/api/v1/topologies", { name: "Cable repatching browser test", template: "blank" });
  const path = `/api/v1/topologies/${topology.id}`;
  const profile = hardwareCatalog.find(item => item.model === "EX2300-24T");
  for (const [index, name] of ["Switch A", "Switch B"].entries()) {
    const device = instantiateProfile(profile, name, { x: 100, y: 140 + 290 * index });
    device.ports[2].mode = "Trunk";
    topology = await post(`${path}/devices`, device);
  }
  for (const index of [0, 1]) {
    const [a, b] = topology.devices;
    topology = await post(`${path}/links`, { id: "", sourceDeviceId: a.id, sourcePortId: a.ports[index].id,
      targetDeviceId: b.id, targetPortId: b.ports[index].id, cableType: "CAT6", primaryVlan: 1, vlanIds: [1], notes: `Cable ${index + 1}` });
  }
  fixture = { topology, path, headers };
  await page.goto("/");
  await page.locator("#topology-select").selectOption(topology.id);
  await expect.poll(() => page.evaluate(() => window.repatchFixture?.state.topology?.id)).toBe(topology.id);
  await expect.poll(() => page.evaluate(() => window.repatchFixture.state.topology.links.map(link => link.id))).toEqual(topology.links.map(link => link.id));
  await unlockEditor(page);
  await page.evaluate(() => { const { canvas } = window.repatchFixture; canvas.camera = { x: 20, y: 10, zoom: .9 }; canvas.invalidate(); });
});

test.afterEach(async ({ page }) => {
  if (fixture) await page.request.delete(fixture.path, { headers: fixture.headers });
  fixture = null;
});

async function stored(page) { return page.request.get(fixture.path).then(response => response.json()); }

async function portPoint(page, portID) {
  return page.evaluate(id => {
    const { canvas } = window.repatchFixture;
    canvas.layoutScene();
    const box = canvas.portBoxByID.get(id), rect = canvas.canvas.getBoundingClientRect();
    return { x: rect.x + canvas.camera.x + box.centerX * canvas.camera.zoom,
      y: rect.y + canvas.camera.y + box.centerY * canvas.camera.zoom };
  }, portID);
}

async function selectCable(page) {
  const point = await page.evaluate(async id => {
    const { canvas } = window.repatchFixture;
    const { pointOnRoute } = await import("/js/cabling.js");
    canvas.renderFrame(canvas.ctx, canvas.width, canvas.height, canvas.camera, 0, true);
    const curve = canvas.linkCurves.find(entry => entry.link.id === id).curve;
    const rect = canvas.canvas.getBoundingClientRect();
    for (let ratio = .15; ratio < .9; ratio += .025) {
      const world = pointOnRoute(curve, ratio);
      if (canvas.hitPort(world) || canvas.hitLink(world)?.link.id !== id) continue;
      const x = rect.x + canvas.camera.x + world.x * canvas.camera.zoom;
      const y = rect.y + canvas.camera.y + world.y * canvas.camera.zoom;
      if (x > rect.x && x < rect.right && y > rect.y && y < rect.bottom) return { x, y };
    }
    throw new Error("No visible cable selection point");
  }, fixture.topology.links[0].id);
  await page.mouse.click(point.x, point.y);
  await expect.poll(() => page.evaluate(() => window.repatchFixture.state.selection?.type)).toBe("link");
}

async function dragEnd(page, fromID, toID, release = true) {
  const from = await portPoint(page, fromID), to = await portPoint(page, toID);
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 10 });
  if (release) await page.mouse.up();
}

test("moves a selected cable end to a free port and preserves port settings", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await selectCable(page);
  const before = await stored(page), link = before.links[0], destination = before.devices[1].ports[2];
  await dragEnd(page, link.targetPortId, destination.id);
  await expect.poll(async () => (await stored(page)).links[0].targetPortId).toBe(destination.id);
  await expect(page.locator("#repatch-dialog")).toBeHidden();
  const after = await stored(page);
  expect(after.links[0]).toEqual({ ...link, targetPortId: destination.id, targetDeviceId: destination.deviceId });
  expect(after.devices[1].ports[2]).toEqual({ ...destination, status: "up" });
  expect(after.devices[1].ports[0]).toEqual({ ...before.devices[1].ports[0], status: "down" });
  expect(errors).toEqual([]);
});

test("occupied ports require a cancellable confirmation before swapping", async ({ page }) => {
  await selectCable(page);
  const before = await stored(page), [a, b] = before.links;
  await dragEnd(page, a.sourcePortId, b.sourcePortId);
  const dialog = page.locator("#repatch-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("#repatch-summary")).toContainText("Switch A");
  expect(await stored(page)).toEqual(before);
  await expect(dialog.getByRole("button", { name: "CANCEL", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  expect(await stored(page)).toEqual(before);
  await dragEnd(page, a.sourcePortId, b.sourcePortId);
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "SWAP CABLE ENDS", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(async () => (await stored(page)).links[0].sourcePortId).toBe(b.sourcePortId);
  const after = await stored(page);
  expect(after.links[1].sourcePortId).toBe(a.sourcePortId);
  expect(after.revision).toBe(before.revision + 1);
  expect(after.devices).toEqual(before.devices);
});

test("swap confirmation is accessible and shows both connection changes", async ({ page }, testInfo) => {
  await selectCable(page);
  const [a, b] = fixture.topology.links;
  await dragEnd(page, a.sourcePortId, b.sourcePortId);
  await expect(page.locator("#repatch-dialog")).toBeVisible();
  const accessibility = await new AxeBuilder({ page }).include("#repatch-dialog").analyze();
  expect(accessibility.violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("cable-swap-modal.png") });
});

test("Escape and an empty drop leave both cables unchanged", async ({ page }) => {
  await selectCable(page);
  const before = await stored(page), link = before.links[0];
  await dragEnd(page, link.targetPortId, before.devices[1].ports[2].id, false);
  await page.keyboard.press("Escape"); await page.mouse.up();
  expect(await stored(page)).toEqual(before);
  const from = await portPoint(page, link.sourcePortId);
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  await page.mouse.move(from.x + 140, from.y + 120, { steps: 8 }); await page.mouse.up();
  expect(await stored(page)).toEqual(before);
});

test("a confirmation cannot overwrite a newer topology revision", async ({ page }) => {
  await selectCable(page);
  const before = await stored(page), [a, b] = before.links;
  await dragEnd(page, a.sourcePortId, b.sourcePortId);
  await expect(page.locator("#repatch-dialog")).toBeVisible();
  const changed = await page.request.put(fixture.path, { headers: { ...fixture.headers, "If-Match": `"rev-${before.revision}"` }, data: { ...before, name: "Changed during confirmation" } });
  expect(changed.ok()).toBe(true);
  await page.locator("#repatch-dialog").getByRole("button", { name: "SWAP CABLE ENDS", exact: true }).click();
  await expect(page.locator("#toast")).toContainText(/changed|conflict/i);
  expect((await stored(page)).links).toEqual(before.links);
});
