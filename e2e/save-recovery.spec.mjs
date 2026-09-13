import { expect, test } from "@playwright/test";
import { createLockWorkspace } from "./editor-lock-fixture.mjs";

const errors = new WeakMap();
test.beforeEach(({ page }) => {
  errors.set(page, []);
  page.on("pageerror", (error) => errors.get(page).push(error.message));
});
test.afterEach(({ page }) => expect(errors.get(page)).toEqual([]));

async function fixture(page) {
  const workspace = createLockWorkspace();
  await page.addInitScript(() => {
    window.EventSource = class { constructor() {} addEventListener() {} close() {} };
  });
  await page.route("**/*", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const response = await workspace.respond(path, request.method(), request.postData() ? request.postDataJSON() : undefined);
    if (path === "/js/app.js") response.body += "\nwindow.saveFixture = { autosave, events, createAnnotation };";
    await route.fulfill(response);
  });
  await page.goto("/");
  await expect(page.locator("#topology-name")).toHaveText("Editor lock fixture");
  await page.locator('[data-edit-mode="all"]').click();
  return workspace;
}

async function edit(page) {
  await page.evaluate(() => {
    window.saveFixture.autosave.configure({ enabled: false, intervalSeconds: 30 });
    window.saveFixture.createAnnotation({ type: "rectangle", x1: 50, y1: 50, x2: 100, y2: 100 });
  });
}

test("map navigation offers stay, save, and explicit discard", async ({ page }) => {
  const workspace = await fixture(page);
  await edit(page);
  await page.locator("#topology-select").selectOption("second-map");
  const dialog = page.locator("#leave-map-dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "STAY HERE" }).click();
  await expect(page.locator("#topology-select")).toHaveValue("lock-map");
  expect(workspace.writes).toHaveLength(0);
  await page.locator("#topology-select").selectOption("second-map");
  await dialog.getByRole("button", { name: "SAVE AND LEAVE" }).click();
  await expect(page.locator("#topology-name")).toHaveText("Second map");
  expect(workspace.topology.annotations).toHaveLength(1);
});

test("a failed save blocks navigation and exposes retry", async ({ page }) => {
  await fixture(page);
  await edit(page);
  await page.route("**/api/v1/topologies/lock-map", (route) => route.request().method() === "PUT"
    ? route.fulfill({ status: 500, json: { error: "Database unavailable" } }) : route.fallback());
  await page.locator("#topology-select").selectOption("second-map");
  await page.locator("#leave-map-dialog").getByRole("button", { name: "SAVE AND LEAVE" }).click();
  await expect(page.locator("#save-state-label")).toHaveText("SAVE FAILED");
  await expect(page.locator("#topology-select")).toHaveValue("lock-map");
  await page.locator("#autosave-menu summary").click();
  await expect(page.locator("#save-detail")).toContainText("Database unavailable");
  await page.unroute("**/api/v1/topologies/lock-map");
  await page.locator("#save-now-button").click();
  await expect(page.locator("#save-state-label")).toHaveText("SAVED");
});

test("a live update preserves the displaced draft for download and reload", async ({ page }) => {
  const workspace = await fixture(page);
  await edit(page);
  await page.evaluate((topology) => window.saveFixture.events.onTopology({ ...topology, revision: 2, name: "Remote work" }), workspace.topology);
  await expect(page.locator("#save-state-label")).toHaveText("RECOVERY");
  await page.locator("#autosave-menu summary").click();
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download recovery", exact: true }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toContain("recovery.json");
  const stream = await download.createReadStream();
  const parts = [];
  for await (const part of stream) parts.push(part);
  expect(JSON.parse(Buffer.concat(parts).toString()).annotations).toHaveLength(1);
  await page.reload();
  await page.locator("#autosave-menu summary").click();
  await expect(page.getByRole("button", { name: "Download recovery", exact: true })).toBeVisible();
});

test("discarding unsaved changes allows navigation without writing them", async ({ page }) => {
  const workspace = await fixture(page);
  await edit(page);
  await page.locator("#topology-select").selectOption("second-map");
  await page.locator("#leave-map-dialog").getByRole("button", { name: "DISCARD CHANGES" }).click();
  await expect(page.locator("#topology-name")).toHaveText("Second map");
  expect(workspace.writes).toHaveLength(0);
});

test("reload warns about unsaved work and restores a downloadable safety copy", async ({ page }) => {
  await fixture(page);
  await edit(page);
  const warning = page.waitForEvent("dialog");
  const reloading = page.reload();
  const dialog = await warning;
  expect(dialog.type()).toBe("beforeunload");
  await dialog.accept();
  await reloading;
  await expect(page.locator("#save-state-label")).toHaveText("RECOVERY");
});

test("a revision conflict retains the annotation and leaves the shared revision intact", async ({ page }) => {
  const workspace = await fixture(page);
  await edit(page);
  await page.route("**/api/v1/topologies/lock-map", (route) => route.request().method() === "PUT"
    ? route.fulfill({ status: 409, json: { error: "Changed in another session", currentRevision: 2 } })
    : route.fulfill({ json: { ...workspace.topology, revision: 2, name: "Shared revision" } }));
  await page.locator("#autosave-menu summary").click();
  await page.locator("#save-now-button").click();
  await expect(page.locator("#save-state-label")).toHaveText("SAVE FAILED");
  await expect(page.getByRole("button", { name: "Download recovery", exact: true })).toBeVisible();
  await expect(page.locator("#topology-name")).toHaveText("Shared revision");
  expect(workspace.writes).toHaveLength(0);
});

test("a stalled save times out without clearing local work or replaying the request", async ({ page }) => {
  await fixture(page);
  await edit(page);
  await page.clock.install();
  let writes = 0;
  await page.route("**/api/v1/topologies/lock-map", (route) => {
    if (route.request().method() !== "PUT") return route.fallback();
    writes++;
    // Hold the response until the browser aborts its request.
  });
  await page.locator("#autosave-menu summary").click();
  await page.locator("#save-now-button").click();
  await expect.poll(() => writes).toBe(1);
  await page.clock.fastForward(30_001);
  await expect(page.locator("#save-state-label")).toHaveText("SAVE FAILED");
  await expect(page.locator("#save-detail")).toContainText("timed out");
  expect(await page.evaluate(() => window.saveFixture.autosave.isDirty)).toBe(true);
  expect(writes).toBe(1);
});

test("signing out can be cancelled while local changes remain", async ({ page }) => {
  await fixture(page);
  await edit(page);
  await page.locator("#account-menu summary").click();
  await page.locator("#logout-button").click();
  await expect(page.locator("#leave-map-dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#leave-map-dialog")).not.toBeVisible();
  expect(await page.evaluate(() => window.saveFixture.autosave.isDirty)).toBe(true);
  await expect(page.locator("#topology-name")).toHaveText("Editor lock fixture");
});

test("a normalized save and its earlier live echo do not create a false recovery", async ({ page }) => {
  const workspace = await fixture(page);
  await edit(page);
  await page.route("**/api/v1/topologies/lock-map", async (route) => {
    if (route.request().method() !== "PUT") return route.fallback();
    const submitted = route.request().postDataJSON();
    // Go omits the empty optional annotation text when serializing the result.
    for (const annotation of submitted.annotations) delete annotation.text;
    const response = await workspace.respond("/api/v1/topologies/lock-map", "PUT", submitted);
    await page.evaluate((topology) => { window.saveFixture.events.onTopology(topology); }, response.json);
    await route.fulfill(response);
  });
  await page.locator("#autosave-menu summary").click();
  await page.locator("#save-now-button").click();
  await expect(page.locator("#save-state-label")).toHaveText("SAVED");
  await expect(page.locator("#draft-recovery")).toBeHidden();
  await page.reload();
  await expect(page.locator("#draft-recovery")).toBeHidden();
});

test("reconnecting to the same revision keeps the unsaved annotation on canvas", async ({ page }) => {
  const workspace = await fixture(page);
  await edit(page);
  await page.evaluate((topology) => window.saveFixture.events.onTopology(topology), workspace.topology);
  expect(await page.evaluate(() => window.lockFixture.state.topology.annotations.length)).toBe(1);
  await expect(page.locator("#save-state-label")).toHaveText("DIRTY");
});
