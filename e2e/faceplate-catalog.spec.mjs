import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { hardwareCatalog, instantiateProfile } from "../web/static/js/catalog.js";
import { enterGuestWorkspace } from "./auth-helper.mjs";

/** Read the SVG generated through the actual application's export menu. */
async function downloadSVG(page) {
  await page.locator("#export-menu summary").click();
  const downloading = page.waitForEvent("download");
  await page.locator("#svg-button").click();
  return readFile(await (await downloading).path(), "utf8");
}

/** Give a catalog fixture distinct device and port identities without persisting it. */
function catalogDevice(model, index) {
  const catalog = hardwareCatalog.find((item) => item.model === model);
  expect(catalog, model).toBeTruthy();
  const device = instantiateProfile(catalog, `CATALOG PANEL ${index + 1}`, { x: 40, y: index * 300 + 40 });
  device.id = `catalog-inspector-${index}`;
  for (const port of device.ports) {
    port.id = `${device.id}-port-${port.portIndex}`;
    port.deviceId = device.id;
  }
  return device;
}

test("all 541 catalog models render both panels with identical Canvas and SVG port identities", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/login");
  const result = await page.evaluate(async () => {
    const [{ hardwareCatalog, instantiateProfile }, { AppState }, { CanvasEngine }, { buildSVGDocument }] = await Promise.all([
      import("/js/catalog.js"), import("/js/state.js"),
      import("/js/canvas.js"), import("/js/export.js"),
    ]);
    await document.fonts.ready;
    const stage = document.createElement("div");
    stage.dataset.test = "isolated-faceplate-catalog";
    Object.assign(stage.style, { position: "fixed", inset: "0", width: "1000px", height: "760px", zIndex: "1000" });
    const canvas = document.createElement("canvas");
    canvas.width = 1000;
    canvas.height = 760;
    const svgHost = document.createElement("div");
    Object.assign(svgHost.style, { position: "absolute", left: "0", top: "0", visibility: "hidden" });
    stage.append(canvas, svgHost);
    document.body.append(stage);
    const state = new AppState();
    const engine = new CanvasEngine(canvas, state, {}, { graphicsMode: "quality" });
    let current = "catalog initialization";
    let renderedPanels = 0;
    let inventoryPorts = 0;

    /** Fail with the specific model and panel so browser failures remain actionable. */
    function verify(condition, message) {
      if (!condition) throw new Error(`${current}: ${message}`);
    }

    /** Compare unique visible identities independently of iteration order. */
    function sameIDs(actual, expected, message) {
      verify(new Set(actual).size === actual.length, `${message}: duplicate identities`);
      verify(JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort()), message);
    }

    /** Reject non-finite or empty geometry before Canvas and SVG can silently omit it. */
    function finiteRectangle(rectangle) {
      verify([rectangle.x, rectangle.y, rectangle.width, rectangle.height].every(Number.isFinite), "non-finite rectangle");
      verify(rectangle.width > 0 && rectangle.height > 0, "empty rectangle");
    }

    try {
      for (const [index, catalog] of hardwareCatalog.entries()) {
        const device = instantiateProfile(catalog, catalog.model, { x: 0, y: 0 });
        device.id = `catalog-${index}`;
        for (const port of device.ports) {
          port.id = `${device.id}-port-${port.portIndex}`;
          port.deviceId = device.id;
        }
        if (catalog.model === "USW-Pro-Max-48-PoE") device.ports[0].label = "WWW";
        const expectedIDs = device.ports.map((port) => port.id);
        const inventorySnapshot = JSON.stringify(device);
        const seen = [];
        state.setTopology({ id: "isolated-catalog", name: catalog.model, devices: [device], links: [], racks: [], vlans: [],
          annotations: [], linkGroups: [], switchSystems: [], firewallClusters: [] });
        for (const face of ["front", "rear"]) {
          current = `${catalog.vendor} ${catalog.model} (${face})`;
          state.setDeviceFaceplateFace(device.id, face);
          engine.fit();
          engine.renderFrame(engine.ctx, engine.width, engine.height, engine.camera, performance.now(), false);
          const scene = engine.faceplateScenes().get(device.id);
          verify(scene?.profile, "catalog model has no physical panel profile");
          verify(scene.face === face, "selected panel was not rendered");
          for (const rectangle of [scene.chassis, ...scene.components, ...scene.ports, ...scene.hiddenPorts,
            ...(scene.portal ? [scene.portal] : [])]) finiteRectangle(rectangle);
          const visibleIDs = scene.ports.map((box) => box.port.id);
          sameIDs(engine.portGeometry().map((box) => box.port.id), visibleIDs, "Canvas socket identities differ from scene");
          sameIDs([...visibleIDs, ...scene.hiddenPorts.map((box) => box.port.id)], expectedIDs, "visible and hidden sockets do not partition inventory");
          seen.push(...visibleIDs);
          const svg = buildSVGDocument(state.topology, engine);
          verify(!/\b(?:NaN|Infinity)\b/.test(svg), "SVG contains non-finite coordinates");
          const parsed = new DOMParser().parseFromString(svg, "image/svg+xml");
          verify(!parsed.querySelector("parsererror"), "SVG failed XML parsing");
          sameIDs([...parsed.querySelectorAll('[data-entity="port"]')].map((port) => port.getAttribute("data-port-id")),
            visibleIDs, "SVG socket identities differ from Canvas");
          verify(parsed.querySelector('[data-layer="faceplate"]')?.getAttribute("data-hardware-face") === face,
            "SVG panel selection differs from Canvas");
          svgHost.replaceChildren(document.importNode(parsed.documentElement, true));
          finiteRectangle(svgHost.firstElementChild.getBBox());
          if (catalog.model === "USW-Pro-Max-48-PoE" && face === "front") {
            const label = [...svgHost.querySelectorAll(".port-label")].find((node) => node.textContent === "WWW");
            const placement = scene.ports.find((box) => box.port.id === device.ports[0].id).labelPlacement;
            verify(label?.hasAttribute("textLength"), "wide short names require a persistent SVG width constraint");
            verify(Number(label.getAttribute("textLength")) <= placement.maxWidth + .1, "wide short name exceeds its reserved advance width");
            // Linux WebKit reports the natural advance from getComputedTextLength even after glyph scaling.
            // Rendered bounds also account for browser-specific glyph overhang inside the plate's padding.
            const labelBounds = label.getBoundingClientRect();
            const plate = label.previousElementSibling;
            verify(plate?.getAttribute("data-layer") === "port-description", "socket label has no background plate");
            const plateBounds = plate.getBoundingClientRect();
            verify(labelBounds.left >= plateBounds.left - .1 && labelBounds.right <= plateBounds.right + .1,
              `wide short name renders outside its reserved socket label plate: text ${labelBounds.left}–${labelBounds.right}, plate ${plateBounds.left}–${plateBounds.right}`);
          }
          renderedPanels++;
        }
        sameIDs(seen, expectedIDs, "each inventory socket must appear on exactly one physical face");
        verify(JSON.stringify(state.topology.devices[0]) === inventorySnapshot, "rendering mutated the device inventory");
        inventoryPorts += expectedIDs.length;
        if (index % 25 === 24) await new Promise(requestAnimationFrame);
      }
      return { catalogModels: hardwareCatalog.length, renderedPanels, inventoryPorts };
    } finally {
      engine.destroy();
      stage.remove();
    }
  });
  expect(result.catalogModels).toBe(541);
  expect(result.renderedPanels).toBe(1082);
  expect(result.inventoryPorts).toBeGreaterThan(10_000);
  expect(pageErrors).toEqual([]);
  await testInfo.attach("catalog-browser-rendering.json", { body: JSON.stringify(result, null, 2), contentType: "application/json" });
});

test("public inspector switches representative family panels and exports the selected connectors", async ({ page, request }) => {
  test.setTimeout(60_000);
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await enterGuestWorkspace(page, request);
  await expect(page.locator("#connection-status")).toHaveAttribute("data-state", "online");
  const topologyID = await page.locator("#topology-select").inputValue();
  const response = await request.get(`/api/v1/topologies/${topologyID}`);
  expect(response.ok()).toBe(true);
  const original = await response.json();
  const cases = [
    { model: "ASA 5506-X", defaultFace: "rear", portFaces: "rear" },
    { model: "M4250 family", defaultFace: "rear", portFaces: "rear" },
    { model: "PowerEdge R650", defaultFace: "rear", portFaces: "rear" },
    { model: "Cat6 copper panel 24", defaultFace: "front", portFaces: "front" },
    { model: "UniFi Cable Internet", defaultFace: "front", portFaces: "split" },
    { model: "AP-635", defaultFace: "rear", portFaces: "rear" },
  ];
  const devices = cases.map(({ model }, index) => catalogDevice(model, index));
  const fixture = { ...original, devices, links: [], racks: [], linkGroups: [], annotations: [], switchSystems: [], firewallClusters: [] };
  await page.route(`**/api/v1/topologies/${topologyID}`, async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    await route.fulfill({ json: fixture });
  });
  await page.route(`**/api/v1/topologies/${topologyID}/analysis`, (route) => route.fulfill({ json: { issues: [], loops: [], stp: [] } }));
  await page.reload();
  await expect(page.locator("#connection-status")).toHaveAttribute("data-state", "online");
  const mutations = [];
  page.on("request", (sent) => {
    if (sent.url().includes(`/api/v1/topologies/${topologyID}`) && !["GET", "HEAD"].includes(sent.method())) mutations.push(sent.method());
  });
  for (const [index, entry] of cases.entries()) {
    const device = devices[index];
    await page.locator(`[data-tree-type="device"][data-tree-id="${device.id}"]`).click();
    const controls = page.locator(".hardware-panel-controls");
    await expect(controls).toBeVisible();
    await expect(controls.locator(`[value="${entry.defaultFace}"]`)).toBeChecked();
    for (const face of ["front", "rear"]) {
      await controls.locator(`[value="${face}"]`).check();
      await expect(controls.locator(`[value="${face}"]`)).toBeChecked();
      const svg = await downloadSVG(page);
      const displayed = await page.evaluate(({ svg, id }) => {
        const parsed = new DOMParser().parseFromString(svg, "image/svg+xml");
        return { face: parsed.querySelector(`[data-layer="faceplate"][data-device-id="${id}"]`)?.getAttribute("data-hardware-face"),
          ports: [...parsed.querySelectorAll(`[data-entity="port"][data-device-id="${id}"]`)].map((port) => port.getAttribute("data-port-id")) };
      }, { svg, id: device.id });
      const expected = device.ports.filter((port) => entry.portFaces === "split"
        ? (port.type === "COAX_F" ? "rear" : "front") === face : entry.portFaces === face).map((port) => port.id);
      expect(displayed.face, entry.model).toBe(face);
      expect(displayed.ports.sort(), `${entry.model} ${face}`).toEqual(expected.sort());
    }
  }
  expect(mutations).toEqual([]);
  expect(pageErrors).toEqual([]);
});
