import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#connection-status")).toHaveAttribute("data-state", "online");
  await expect(page.locator("#diagram-canvas")).toBeVisible();
});

test("loads a topology and opens primary editing tools", async ({ page }) => {
  await expect(page.locator("#topology-name")).not.toContainText("Loading");
  await page.locator("#add-rack-button").click();
  await expect(page.locator("#rack-dialog")).toBeVisible();
  await page.locator('[data-close="rack-dialog"]').first().click();
  await expect(page.locator("#rack-dialog")).not.toBeVisible();

  await page.locator("#vlan-button").click();
  await expect(page.locator("#vlan-modal")).toBeVisible();
});

test("edits device inventory, management identity, location, and STP priority", async ({ page, request }) => {
  const topologyID = await page.locator("#topology-select").inputValue();
  const topology = await request.get(`/api/v1/topologies/${encodeURIComponent(topologyID)}`).then((response) => response.json());
  const device = topology.devices.find((candidate) => candidate.category === "Switch");
  expect(device).toBeTruthy();

  await page.locator(`[data-tree-type="device"][data-tree-id="${device.id}"]`).click();
  const form = page.locator("#device-inspector-form");
  await expect(form).toBeVisible();
  await form.locator('[name="hostname"]').fill("e2e-core-01.example.net");
  await form.locator('[name="managementIp"]').fill("192.0.2.31");
  await form.locator('[name="serialNumber"]').fill("E2E-SERIAL-531");
  await form.locator('[name="assetTag"]').fill("E2E-ASSET-596");
  await form.locator('[name="owner"]').fill("E2E Network Team");
  await form.locator('[name="locationSite"]').fill("Vienna");
  await form.locator('[name="locationBuilding"]').fill("DC1");
  await form.locator('[name="locationFloor"]').fill("2");
  await form.locator('[name="locationRoom"]').fill("MDF");
  await form.locator('[name="locationRack"]').fill("A01");
  await form.locator('[name="locationRackUnit"]').fill("24");
  await form.locator('[name="stpPriority"]').selectOption("4096");
  await form.locator('button[type="submit"], button:not([type])').first().click();

  await expect.poll(async () => {
    const updated = await request.get(`/api/v1/topologies/${encodeURIComponent(topologyID)}`).then((response) => response.json());
    return updated.devices.find((candidate) => candidate.id === device.id);
  }).toMatchObject({
    hostname: "e2e-core-01.example.net",
    managementIp: "192.0.2.31",
    serialNumber: "E2E-SERIAL-531",
    assetTag: "E2E-ASSET-596",
    owner: "E2E Network Team",
    stpPriority: 4096,
    location: { site: "Vienna", building: "DC1", floor: "2", room: "MDF", rack: "A01", rackUnit: 24 },
  });
  await expect(page.locator("#stp-count")).not.toHaveText(/CALCULATING|NO DOMAINS/);
  await expect(page.locator("#stp-list .stp-instance").first()).toContainText(/ROOT/);
});

test("places a configurable patch panel and persists it through v1 API", async ({ page, request }) => {
  const before = Number(await page.locator("#physical-device-count").textContent().then((value) => value?.match(/\d+/)?.[0] || 0));
  const topologyID = await page.locator("#topology-select").inputValue();
  const beforeResponse = await request.get(`/api/v1/topologies/${encodeURIComponent(topologyID)}`);
  const beforeTopology = await beforeResponse.json();
  const beforeMatching = beforeTopology.devices.filter((device) => device.name === "E2E PATCH 01" && device.category === "PatchPanel").length;
  await page.locator("#add-patch-panel-button").click();
  const dialog = page.locator("#patch-panel-dialog");
  await expect(dialog).toBeVisible();
  await dialog.locator('[name="name"]').fill("E2E PATCH 01");
  await dialog.locator('[name="portCount"]').selectOption("12");
  await dialog.locator('button[value="install"]').click();
  await expect(dialog).not.toBeVisible();

  await expect.poll(async () => {
    const response = await request.get(`/api/v1/topologies/${encodeURIComponent(topologyID)}`);
    const topology = await response.json();
    return topology.devices.filter((device) => device.name === "E2E PATCH 01" && device.category === "PatchPanel").length;
  }).toBe(beforeMatching + 1);
  await expect(page.locator("#physical-device-count")).not.toHaveText(new RegExp(`^${before}$`));
});

test("export menu opens below the toolbar and closes after export", async ({ page }) => {
  const menu = page.locator("#export-menu");
  await menu.locator("summary").click();
  await expect(menu).toHaveAttribute("open", "");
  const summaryBox = await menu.locator("summary").boundingBox();
  const popoverBox = await menu.locator(".export-popover").boundingBox();
  expect(popoverBox.y).toBeGreaterThan(summaryBox.y);
  const download = page.waitForEvent("download");
  await page.locator("#json-button").click();
  await download;
  await expect(menu).not.toHaveAttribute("open", "");
});

test("anchors comments, embeds documentation, and creates a read-only share", async ({ page }) => {
  await page.locator("#collaboration-button").click();
  const dialog = page.locator("#collaboration-dialog");
  await expect(dialog).toBeVisible();

  await dialog.locator('#comment-form [name="author"]').fill("E2E Operator");
  await dialog.locator('#comment-form [name="body"]').fill("Validate the maintenance path before change window.");
  await dialog.locator("#comment-form button").click();
  await expect(dialog.locator("#comments-list")).toContainText("E2E Operator");

  await dialog.locator('#documentation-form [name="label"]').fill("E2E Runbook");
  await dialog.locator('#documentation-form [name="url"]').fill("https://example.com/runbook");
  await dialog.locator("#documentation-form button").click();
  await expect(dialog.locator("#documentation-list")).toContainText("E2E Runbook");
  await dialog.locator("[data-document-embed]").last().click();
  await expect(dialog.locator("#documentation-preview")).toBeVisible();

  await dialog.locator('#share-form [name="name"]').fill("E2E NOC review");
  await dialog.locator("#share-form button").click();
  await expect(dialog.locator("#share-list")).toContainText("SECRET SHOWN ONCE");
  await expect(dialog.locator("#share-list input")).toHaveValue(/\/api\/v1\/shared\//);
});

test("toggles drawing tools and deletes a selected canvas annotation", async ({ page, request }) => {
  const topologyID = await page.locator("#topology-select").inputValue();
  const loadAnnotationCount = async () => {
    const response = await request.get(`/api/v1/topologies/${encodeURIComponent(topologyID)}`);
    return (await response.json()).annotations.length;
  };
  const before = await loadAnnotationCount();
  const canvas = page.locator("#diagram-canvas");
  const bounds = await canvas.boundingBox();
  const start = { x: bounds.x + bounds.width * .35, y: bounds.y + bounds.height * .78 };
  const end = { x: bounds.x + bounds.width * .58, y: bounds.y + bounds.height * .72 };

  const arrowTool = page.locator('[data-canvas-tool="annotation-arrow"]');
  await arrowTool.click();
  await expect(arrowTool).toHaveAttribute("aria-pressed", "true");
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 6 });
  await page.mouse.up();
  await page.keyboard.press("Control+s");
  await expect.poll(loadAnnotationCount).toBe(before + 1);

  await arrowTool.click();
  await expect(arrowTool).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator('[data-canvas-tool="select"]')).toHaveAttribute("aria-pressed", "true");
  await page.mouse.click((start.x + end.x) / 2, (start.y + end.y) / 2);
  await expect(page.locator("#selection-inspector")).toContainText("CANVAS ANNOTATION");
  await page.locator("#delete-annotation").click();
  await page.keyboard.press("Control+s");
  await expect.poll(loadAnnotationCount).toBe(before);

  await arrowTool.click();
  await page.keyboard.press("Escape");
  await expect(arrowTool).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator('[data-canvas-tool="select"]')).toHaveAttribute("aria-pressed", "true");
});
