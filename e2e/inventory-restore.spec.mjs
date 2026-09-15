import { expect, test } from "@playwright/test";
import { mockLockWorkspace } from "./editor-lock-fixture.mjs";

test("inventory copy works while locked, disables empty values and handles denied clipboard", async ({ page }) => {
  const workspace = await mockLockWorkspace(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { value: { writeText: async (value) => {
      if (window.denyCopy) throw new Error("Denied");
      window.copiedValue = value;
    } } });
  });
  await page.goto("/");
  await page.waitForFunction(() => window.lockFixture?.state.topology);
  await page.evaluate(() => {
    const { state } = window.lockFixture;
    Object.assign(state.topology.devices[0], { hostname: "switch.example", managementIp: "192.0.2.1", serialNumber: "SN123", assetTag: "" });
  });
  await page.locator('[data-tree-id="device-0"]').click();
  for (const [name, value] of [["hostname", "switch.example"], ["managementIp", "192.0.2.1"], ["serialNumber", "SN123"]]) {
    await page.locator(`[data-inventory-copy="${name}"]`).click();
    await expect.poll(() => page.evaluate(() => window.copiedValue)).toBe(value);
  }
  await expect(page.locator('[data-inventory-copy="assetTag"]')).toBeDisabled();
  await page.evaluate(() => { window.denyCopy = true; });
  await page.locator('[data-inventory-copy="hostname"]').click();
  await expect(page.locator('#device-inspector-form [name="hostname"]')).toBeFocused();
  expect(await page.locator('#device-inspector-form [name="hostname"]').evaluate((input) => input.value.slice(input.selectionStart, input.selectionEnd))).toBe("switch.example");
  await page.locator('[data-edit-mode="all"]').click();
  await page.locator('#device-inspector-form [name="assetTag"]').fill("DRAFT-TAG");
  await page.evaluate(() => { window.denyCopy = false; });
  await page.locator('[data-inventory-copy="assetTag"]').click();
  await expect.poll(() => page.evaluate(() => window.copiedValue)).toBe("DRAFT-TAG");
  expect(workspace.writes).toEqual([]);
});

test("restore as new map creates and opens a separate map from read only", async ({ page }) => {
  const workspace = await mockLockWorkspace(page);
  const original = workspace.topology;
  let restored;
  const mutations = [];
  await page.route("**/api/v1/topologies**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith("/analysis")) return route.fallback();
    if (request.method() === "POST" && path === "/api/v1/topologies") {
      mutations.push(path);
      restored = { ...original, ...request.postDataJSON(), id: "restored-map", revision: 1 };
      return route.fulfill({ json: restored });
    }
    if (path === "/api/v1/topologies/restored-map") {
      if (request.method() === "PUT") {
        mutations.push(path);
        expect(request.headers()["if-match"]).toBe('"rev-1"');
        restored = { ...request.postDataJSON(), revision: 2 };
      }
      return route.fulfill({ json: restored });
    }
    if (path === "/api/v1/topologies" && restored) return route.fulfill({ json: [original, restored] });
    return route.fallback();
  });
  await page.goto("/");
  await expect(page.locator("#topology-select")).toHaveValue(original.id);
  await page.locator("#import-new-file").setInputFiles({ name: "backup.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ ...original, revision: 91, location: "Vienna" })) });
  await expect(page.locator("#topology-dialog")).toBeVisible();
  await page.locator("#topology-dialog").getByRole("button", { name: "CANCEL", exact: true }).click();
  expect(mutations).toEqual([]);
  await expect(page.locator("#topology-select")).toHaveValue(original.id);
  await page.locator("#import-new-file").setInputFiles({ name: "backup.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ ...original, revision: 91, location: "Vienna" })) });
  await page.locator('#topology-form [name="name"]').fill("Restored map");
  await page.locator("#topology-submit-button").click();
  await expect(page.locator("#topology-select")).toHaveValue("restored-map");
  expect(mutations).toEqual(["/api/v1/topologies", "/api/v1/topologies/restored-map"]);
  expect(workspace.topology).toEqual(original);
  expect(restored.devices).toEqual(original.devices);
  await expect(page.locator("#editor-lock")).toHaveAttribute("data-mode", "read-only");
});
