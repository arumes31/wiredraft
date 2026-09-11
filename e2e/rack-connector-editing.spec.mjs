import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { hardwareCatalog, instantiateProfile } from "../web/static/js/catalog.js";
import { defaultCableProperties } from "../web/static/js/cable-defaults.js";
import { enterGuestWorkspace, unlockEditor } from "./auth-helper.mjs";

const cases = [["SAS_MINI_HD_12G", 12000, "SAS"], ["SAS_MINI_6G", 6000, "SAS"],
  ["FC_SFP_16G", 16000, "FIBER"], ["Power", 0, "POWER"]];

/** Expose selection in the production app only; load every dependency from the built server. */
async function currentInspectorAssets(page) {
  await page.route(url => url.pathname === "/js/app.js", async route => {
    const body = await readFile(new URL("../web/static/js/app.js", import.meta.url), "utf8")
      + "\nwindow.connectorFixture = { state, loadTopology };";
    await route.fulfill({ body, contentType: "text/javascript" });
  });
}

/** Create real catalog devices and cables, retaining authoritative API-generated IDs. */
async function createFixture(request, name) {
  expect((await request.post("/api/v1/auth/guest", { data: {} })).ok()).toBe(true);
  const created = await request.post("/api/v1/topologies", { data: { name, template: "blank" } });
  expect(created.status()).toBe(201);
  let topology = await created.json();
  const path = `/api/v1/topologies/${topology.id}`;
  const fixtures = [];
  for (const [type, speed, media] of [...cases, ["RJ45_1G", 1000, "CAT6"]]) {
    const profile = hardwareCatalog.find(profile => instantiateProfile(profile, "probe", { x: 0, y: 0 }).ports.some(port => port.type === type));
    const endpoints = [];
    for (const side of ["left", "right"]) {
      const device = instantiateProfile(profile, `${type} ${side}`, { x: side === "left" ? 0 : 800, y: fixtures.length * 250 });
      const response = await request.post(`${path}/devices`, {
        headers: { "If-Match": `"rev-${topology.revision}"` }, data: device,
      });
      expect(response.status(), await response.text()).toBe(201);
      topology = await response.json();
      const saved = topology.devices.find(item => item.name === device.name);
      endpoints.push(saved.ports.find(port => port.type === type));
    }
    const [source, target] = endpoints;
    const response = await request.post(`${path}/links`, {
      headers: { "If-Match": `"rev-${topology.revision}"` }, data: {
        id: "", sourceDeviceId: source.deviceId, sourcePortId: source.id,
        targetDeviceId: target.deviceId, targetPortId: target.id, ...defaultCableProperties(source, target), notes: "Inspector preservation fixture",
      },
    });
    expect(response.status(), await response.text()).toBe(201);
    topology = await response.json();
    fixtures.push({ type, speed, media, portID: source.id, linkID: topology.links.find(link => link.sourcePortId === source.id).id });
  }
  return { topology, path, fixtures };
}

/** Read the persisted port without accepting unrelated endpoint changes. */
function portByID(topology, id) {
  return topology.devices.flatMap(device => device.ports).find(port => port.id === id);
}

test("storage and power inspector edits preserve saved rates, zero VLANs and endpoints", async ({ page, request }, testInfo) => {
  test.setTimeout(120000);
  await currentInspectorAssets(page);
  const fixture = await createFixture(request, `E2E ${testInfo.project.name} connector editing`);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  try {
    await enterGuestWorkspace(page);
    await expect.poll(() => page.evaluate(() => Boolean(window.connectorFixture))).toBe(true);
    await page.evaluate(id => window.connectorFixture.loadTopology(id), fixture.topology.id);
    await unlockEditor(page);
    let topology = await (await request.get(fixture.path)).json();
    expect(topology.devices).toEqual(fixture.topology.devices);
    expect(topology.links).toEqual(fixture.topology.links);
    for (const entry of fixture.fixtures.filter(entry => entry.type !== "RJ45_1G")) {
      const before = structuredClone(topology);
      const original = portByID(before, entry.portID);
      expect(original.speedMbps).toBe(entry.speed);
      await page.evaluate(id => window.connectorFixture.state.select("port", id), entry.portID);
      const form = page.locator("#port-inspector-form");
      await form.locator('[name="label"]').fill(`${entry.type} custom label`);
      await form.locator('[name="mediaType"]').selectOption(entry.media);
      const saved = page.waitForResponse(response => response.url().endsWith(`/ports/${entry.portID}`) && response.request().method() === "PUT");
      await form.locator("button.primary").click();
      expect((await saved).ok()).toBe(true);
      topology = await (await request.get(fixture.path)).json();
      expect(portByID(topology, entry.portID)).toEqual({ ...original, label: `${entry.type} custom label`, mediaType: entry.media });
      const expectedDevices = structuredClone(before.devices);
      Object.assign(expectedDevices.flatMap(device => device.ports).find(port => port.id === entry.portID), { label: `${entry.type} custom label`, mediaType: entry.media });
      expect(topology.devices).toEqual(expectedDevices);
      expect(topology.links).toEqual(before.links);

      await expect.poll(() => page.evaluate(() => window.connectorFixture.state.topology.revision)).toBe(topology.revision);
      await page.evaluate(id => window.connectorFixture.state.select("link", id), entry.linkID);
      const cableForm = page.locator("#link-media-form");
      await expect(cableForm).toBeVisible();
      await expect(page.locator('#link-configuration-form [name="mode"]')).toHaveCount(0);
      await page.locator('[data-edit-mode="read-only"]').click();
      await expect(cableForm.locator("button.primary")).toBeDisabled();
      await page.locator('[data-edit-mode="cabling"]').click();
      await expect(cableForm.locator("button.primary")).toBeEnabled();
      const media = entry.type === "FC_SFP_16G" ? "SMF" : entry.media;
      await cableForm.locator('[name="cableType"]').selectOption(media);
      const cableSaved = page.waitForResponse(response => response.url().endsWith(`/links/${entry.linkID}/media`) && response.request().method() === "PUT");
      await cableForm.locator("button.primary").click();
      expect((await cableSaved).ok()).toBe(true);
      const reloaded = await (await request.get(fixture.path)).json();
      expect(reloaded.devices).toEqual(topology.devices);
      expect(reloaded.links).toEqual(topology.links.map(link => link.id === entry.linkID ? { ...link, cableType: media } : link));
      topology = reloaded;
      await expect.poll(() => page.evaluate(() => window.connectorFixture.state.topology.revision)).toBe(topology.revision);
      await unlockEditor(page);
    }
    // Imported records may contain deliberate custom settings: metadata editing
    // must retain those values as well as the new catalog's zero-VLAN defaults.
    const custom = fixture.fixtures.find(entry => entry.type === "FC_SFP_16G");
    const customPort = { ...portByID(topology, custom.portID), speedMbps: 8000, mode: "Trunk", nativeVlan: 1, allowedVlans: [] };
    const imported = await request.put(`${fixture.path}/ports/${custom.portID}`, {
      headers: { "If-Match": `"rev-${topology.revision}"` }, data: customPort,
    });
    expect(imported.ok()).toBe(true);
    topology = await imported.json();
    await page.evaluate(id => window.connectorFixture.loadTopology(id), topology.id);
    await unlockEditor(page);
    await page.evaluate(id => window.connectorFixture.state.select("port", id), custom.portID);
    const customForm = page.locator("#port-inspector-form");
    await customForm.locator('[name="label"]').fill("Saved custom FC settings");
    const customSaved = page.waitForResponse(response => response.url().endsWith(`/ports/${custom.portID}`) && response.request().method() === "PUT");
    await customForm.locator("button.primary").click();
    expect((await customSaved).ok()).toBe(true);
    topology = await (await request.get(fixture.path)).json();
    expect(portByID(topology, custom.portID)).toEqual({ ...customPort, label: "Saved custom FC settings" });
    await expect.poll(() => page.evaluate(() => window.connectorFixture.state.topology.revision)).toBe(topology.revision);

    const ethernet = fixture.fixtures.find(entry => entry.type === "RJ45_1G");
    await page.evaluate(id => window.connectorFixture.state.select("link", id), ethernet.linkID);
    const form = page.locator("#link-configuration-form");
    await expect(form).toBeVisible();
    await form.locator('[name="mode"][value="Trunk"]').check();
    const synchronized = page.waitForResponse(response => response.url().endsWith(`/links/${ethernet.linkID}/configuration`) && response.request().method() === "PUT");
    await form.locator("button.primary").click();
    expect((await synchronized).ok()).toBe(true);
    const savedEthernet = await (await request.get(fixture.path)).json();
    const link = savedEthernet.links.find(link => link.id === ethernet.linkID);
    expect(portByID(savedEthernet, link.sourcePortId).mode).toBe("Trunk");
    expect(portByID(savedEthernet, link.targetPortId).mode).toBe("Trunk");
    await page.reload();
    await expect.poll(() => page.evaluate(() => window.connectorFixture?.state.topology?.id)).toBe(fixture.topology.id);
    const afterLoad = await (await request.get(fixture.path)).json();
    expect(afterLoad.devices).toEqual(savedEthernet.devices);
    expect(afterLoad.links).toEqual(savedEthernet.links);
    expect(errors).toEqual([]);
  } finally {
    const latest = await (await request.get(fixture.path)).json();
    expect((await request.delete(fixture.path, { headers: { "If-Match": `"rev-${latest.revision}"` } })).ok()).toBe(true);
  }
});
