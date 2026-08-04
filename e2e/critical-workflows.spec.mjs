import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

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

test("creates, switches, and remembers another network map", async ({ page, request }, testInfo) => {
  const originalID = await page.locator("#topology-select").inputValue();
  const originalName = await page.locator("#topology-name").textContent();
  const before = await request.get("/api/v1/topologies").then((response) => response.json());
  const mapName = `E2E ${testInfo.project.name.toUpperCase()} BLANK MAP`;

  await page.locator("#add-topology-button").click();
  const dialog = page.locator("#topology-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('[name="template"][value="blank"]')).toBeChecked();
  await expect(dialog.locator('[name="template"][value="demo"]')).toHaveCount(1);
  await dialog.locator('[name="name"]').fill(mapName);
  await dialog.locator('button[value="create"]').click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator("#topology-name")).toHaveText(mapName);
  await expect(page.locator("#rack-count")).toHaveText("0");
  await expect(page.locator("#device-count")).toHaveText("0");

  let created;
  await expect.poll(async () => {
    const topologies = await request.get("/api/v1/topologies").then((response) => response.json());
    created = topologies.find((topology) => topology.name === mapName);
    return Boolean(created);
  }).toBe(true);
  expect(created).toBeTruthy();
  await expect(page.locator("#topology-count")).toHaveText(`${before.length + 1} MAPS`);

  await page.locator("#topology-select").selectOption(originalID);
  await expect(page.locator("#topology-name")).toHaveText(originalName);
  await page.locator("#topology-select").selectOption(created.id);
  await expect(page.locator("#topology-name")).toHaveText(mapName);
  await page.reload();
  await expect(page.locator("#connection-status")).toHaveAttribute("data-state", "online");
  await expect(page.locator("#topology-select")).toHaveValue(created.id);
  await expect(page.locator("#topology-name")).toHaveText(mapName);

  // Keep the shared browser-test server deterministic for workflows that expect
  // its original demo map to remain the most recently updated topology.
  const original = await request.get(`/api/v1/topologies/${encodeURIComponent(originalID)}`).then((response) => response.json());
  const restoreResponse = await request.put(`/api/v1/topologies/${encodeURIComponent(originalID)}`, {
    data: original,
    headers: { "If-Match": `"rev-${original.revision}"` },
  });
  expect(restoreResponse.ok()).toBe(true);
});

test("installs access points and browses the edge device families", async ({ page, request }, testInfo) => {
  const topologyID = await page.locator("#topology-select").inputValue();
  const deviceName = `E2E ${testInfo.project.name.toUpperCase()} AP 635`;
  const beforeTopology = await request.get(`/api/v1/topologies/${encodeURIComponent(topologyID)}`).then((response) => response.json());
  const beforeCount = beforeTopology.devices.filter((device) => device.name === deviceName).length;

  await page.locator("#add-device-button").click();
  const dialog = page.locator("#device-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('[name="family"] option[value="Access Points"]')).toContainText("ACCESS POINTS");
  await expect(dialog.locator('[name="family"] option[value="Carrier Handoffs"]')).toContainText("CARRIER HANDOFFS");
  await expect(dialog.locator('[name="family"] option[value="Modems & ONTs"]')).toContainText("MODEMS & ONTS");
  await expect(dialog.locator('[name="family"] option[value="Cellular Routers"]')).toContainText("LTE / 5G ROUTERS");

  await dialog.locator('[name="family"]').selectOption("Access Points");
  await dialog.locator('[name="vendor"]').selectOption("HPE Aruba");
  await dialog.locator('[name="model"]').selectOption("AP-635");
  await dialog.locator('[name="name"]').fill(deviceName);
  await expect(dialog.locator("#catalog-profile-summary")).toContainText("ACCESS POINTS · ACCESSPOINT");
  await expect(dialog.locator("#catalog-profile-summary")).toContainText("2× RJ45 MGIG");
  await dialog.locator('button[value="install"]').click();
  await expect(dialog).not.toBeVisible();

  await expect.poll(async () => {
    const topology = await request.get(`/api/v1/topologies/${encodeURIComponent(topologyID)}`).then((response) => response.json());
    return topology.devices.filter((device) => device.name === deviceName).length;
  }).toBe(beforeCount + 1);
  const topology = await request.get(`/api/v1/topologies/${encodeURIComponent(topologyID)}`).then((response) => response.json());
  const installed = topology.devices.filter((device) => device.name === deviceName).at(-1);
  expect(installed).toMatchObject({ category: "AccessPoint", model: "AP-635" });
  expect(installed.ports.map((port) => port.label)).toEqual(["E0", "E1"]);
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

test("installs Generic Patch hardware only through Panel and maps rear ranges", async ({ page, request }, testInfo) => {
  testInfo.setTimeout(120_000);
  await page.setViewportSize({ width: 1800, height: 1000 });
  const projectLabel = testInfo.project.name.toUpperCase();
  const firstPanelName = `E2E ${projectLabel} PATCH 01`;
  const secondPanelName = `E2E ${projectLabel} PATCH 02`;
  const before = Number(await page.locator("#physical-device-count").textContent().then((value) => value?.match(/\d+/)?.[0] || 0));
  const topologyID = await page.locator("#topology-select").inputValue();
  const beforeResponse = await request.get(`/api/v1/topologies/${encodeURIComponent(topologyID)}`);
  const beforeTopology = await beforeResponse.json();
  const beforeMatching = beforeTopology.devices.filter((device) => device.name === firstPanelName && device.category === "PatchPanel").length;

  await page.locator("#add-device-button").click();
  await expect(page.locator('#device-vendor option[value="Generic Patch"]')).toHaveCount(0);
  await page.locator('#device-dialog .dialog-close[data-close="device-dialog"]').click();

  await page.locator("#add-patch-panel-button").click();
  const dialog = page.locator("#patch-panel-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('[name="model"] option')).toHaveCount(18);
  await dialog.locator('[name="name"]').fill(firstPanelName);
  await dialog.locator('[name="model"]').selectOption("LC fiber panel 12");
  await dialog.locator('button[value="install"]').click();
  await expect(dialog).not.toBeVisible();

  await expect.poll(async () => {
    const response = await request.get(`/api/v1/topologies/${encodeURIComponent(topologyID)}`);
    const topology = await response.json();
    const panels = topology.devices.filter((device) => device.name === firstPanelName && device.category === "PatchPanel");
    if (panels.length === beforeMatching + 1 && panels.at(-1)?.model !== "LC fiber panel 12") return -1;
    return panels.length;
  }).toBe(beforeMatching + 1);

  await page.locator("#add-patch-panel-button").click();
  await dialog.locator('[name="name"]').fill(secondPanelName);
  await dialog.locator('[name="model"]').selectOption("LC fiber panel 12");
  await dialog.locator('button[value="install"]').click();
  await expect(dialog).not.toBeVisible();

  let panels = [];
  await expect.poll(async () => {
    const response = await request.get(`/api/v1/topologies/${encodeURIComponent(topologyID)}`);
    const topology = await response.json();
    panels = topology.devices.filter((device) => [firstPanelName, secondPanelName].includes(device.name));
    return panels.length;
  }).toBe(2);

  await expect(page.locator("#patch-panel-map-button")).toBeEnabled();
  await page.locator("#patch-panel-map-button").click();
  const rearDialog = page.locator("#patch-panel-map-dialog");
  await rearDialog.locator('[name="sourceDeviceId"]').selectOption(panels.find((panel) => panel.name === firstPanelName).id);
  await rearDialog.locator('[name="targetDeviceId"]').selectOption(panels.find((panel) => panel.name === secondPanelName).id);
  await rearDialog.locator('[name="sourceStart"]').fill("1");
  await rearDialog.locator('[name="sourceEnd"]').fill("2");
  await rearDialog.locator('[name="targetStart"]').fill("1");
  await expect(rearDialog.locator("#patch-map-count")).toHaveText("2 REAR RUNS");
  await rearDialog.locator('button[value="connect"]').click();
  await expect(rearDialog).not.toBeVisible();

  await expect.poll(async () => {
    const response = await request.get(`/api/v1/topologies/${encodeURIComponent(topologyID)}`);
    const topology = await response.json();
    const rearLinks = topology.links.filter((link) => link.sourceSide === "rear" && link.targetSide === "rear" &&
      [panels[0].id, panels[1].id].includes(link.sourceDeviceId) && [panels[0].id, panels[1].id].includes(link.targetDeviceId));
    return rearLinks.length;
  }).toBe(2);
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
  await page.locator("#configuration-button").click();
  await expect((await download).suggestedFilename()).toMatch(/-configuration\.html$/);
  await expect(menu).not.toHaveAttribute("open", "");

  await menu.locator("summary").click();
  const svgDownload = page.waitForEvent("download");
  await page.locator("#svg-button").click();
  const exportedSVG = await svgDownload;
  await expect(exportedSVG.suggestedFilename()).toMatch(/\.svg$/);
  const svgPath = await exportedSVG.path();
  const svg = await readFile(svgPath, "utf8");
  expect(svg).toContain('data-layer="cable-outline"');
  expect(svg).toContain('data-layer="link-end-label"');
  await expect(menu).not.toHaveAttribute("open", "");
});

test("anchors comments, embeds documentation, and creates a read-only share", async ({ page, request }) => {
  const topologyID = await page.locator("#topology-select").inputValue();
  const topology = await request.get(`/api/v1/topologies/${encodeURIComponent(topologyID)}`).then((response) => response.json());
  const device = topology.devices[0];
  await page.locator(`[data-tree-type="device"][data-tree-id="${device.id}"]`).click();
  await expect(page.locator(".inspector-comments")).toContainText("COMMENTS");
  await page.locator(".inspector-comment-add").click();
  const dialog = page.locator("#collaboration-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("#collaboration-target")).toContainText(device.name);
  await expect(dialog.locator('#comment-form [name="body"]')).toBeFocused();

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
