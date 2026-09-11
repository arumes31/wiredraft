import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { enterGuestWorkspace, unlockEditor } from "./auth-helper.mjs";

test("AP sockets stay readable and export consistently while free and mounted", async ({ page }, testInfo) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.setViewportSize({ width: 1700, height: 900 });
  await page.goto("/login");
  const metrics = await page.evaluate(async () => {
    const [{ hardwareCatalog, instantiateProfile }, { AppState }, { CanvasEngine }, { buildSVGDocument },
      { hardwarePrimitives }, { connectorKind }] = await Promise.all([
      import("/js/catalog.js"), import("/js/state.js"), import("/js/canvas.js"), import("/js/export.js"),
      import("/js/hardware-components.js"), import("/js/termination.js"),
    ]);
    await document.fonts.ready;
    const stage = document.createElement("div");
    stage.dataset.test = "access-point-layout";
    Object.assign(stage.style, { position: "fixed", inset: "0", zIndex: "1000", background: "#0a0f11" });
    const canvas = document.createElement("canvas");
    Object.assign(canvas.style, { width: "100%", height: "100%", display: "block" });
    stage.append(canvas);
    document.body.append(stage);
    const state = new AppState();
    const engine = new CanvasEngine(canvas, state, {}, { graphicsMode: "quality" });
    const measurements = [];
    window.accessPointLayoutFixture = { stage, state, engine };
    for (const model of ["UniFi U7 Pro", "AP-635"]) {
      const device = instantiateProfile(hardwareCatalog.find((item) => item.model === model), model, { x: 30, y: 30 });
      device.id = "isolated-ap";
      device.ports.forEach((port) => { port.id = `ap-port-${port.portIndex}`; port.deviceId = device.id; });
      state.setTopology({ id: "isolated-ap-layout", name: model, devices: [device], links: [], racks: [], vlans: [],
        annotations: [], linkGroups: [], switchSystems: [], firewallClusters: [] });
      const before = JSON.stringify(state.topology);
      engine.camera = { x: 0, y: 0, zoom: 1 };
      for (const face of ["front", "rear"]) {
        state.setDeviceFaceplateFace(device.id, face);
        engine.renderFrame(engine.ctx, engine.width, engine.height, engine.camera, performance.now(), false);
        const scene = engine.faceplateScenes().get(device.id);
        const svg = new DOMParser().parseFromString(buildSVGDocument(state.topology, engine), "image/svg+xml");
        const chassis = svg.querySelector('[data-layer="physical-chassis"]');
        const offset = { x: 50 - engine.worldBounds().x, y: 50 - engine.worldBounds().y };
        const labels = [...svg.querySelectorAll(".port-label")];
        measurements.push({ model, face, height: engine.deviceRectangles()[0].height,
          chassis: { canvas: [scene.chassis.x, scene.chassis.y, scene.chassis.width, scene.chassis.height],
            svg: [Number(chassis.getAttribute("x")) - offset.x, Number(chassis.getAttribute("y")) - offset.y,
              Number(chassis.getAttribute("width")), Number(chassis.getAttribute("height"))] },
          ports: scene.ports.map((box) => {
            const socket = svg.querySelector(`[data-port-id="${box.port.id}"] rect`);
            const primitive = hardwarePrimitives({ kind: box.connectorKind || connectorKind(box.port.type),
              x: box.x, y: box.y, width: box.width, height: box.height }, scene.template).find((shape) => shape.kind === "rect");
            return { id: box.port.id, type: box.port.type, width: box.width, labelWidth: box.labelPlacement.maxWidth,
              picked: engine.hitPort({ x: box.centerX, y: box.centerY })?.port.id,
              canvas: [primitive.x, primitive.y, primitive.width, primitive.height],
              svg: [Number(socket.getAttribute("x")) - offset.x, Number(socket.getAttribute("y")) - offset.y,
                Number(socket.getAttribute("width")), Number(socket.getAttribute("height"))],
              renderedLabelWidth: Number(labels.find((label) => label.textContent === box.port.label)?.getAttribute("textLength")) };
          }), inventoryUnchanged: JSON.stringify(state.topology) === before });
      }
    }
    state.topology.racks.push({ id: "ap-rack", name: "AP RACK", positionX: 900, positionY: 100, heightU: 4, color: "#2c4b4e" });
    state.emit("topology");
    engine.layoutScene();
    return measurements;
  });
  try {
    for (const panel of metrics) {
      expect(panel.height).toBe(345);
      expect(panel.inventoryUnchanged).toBe(true);
      for (const [index, value] of panel.chassis.canvas.entries()) expect(panel.chassis.svg[index]).toBeCloseTo(value, 5);
      expect(panel.chassis.canvas[2]).toBe(panel.chassis.canvas[3]);
      for (const port of panel.ports) {
        expect(port.picked).toBe(port.id);
        for (const [index, value] of port.canvas.entries()) expect(port.svg[index]).toBeCloseTo(value, 2);
        if (port.type.startsWith("USB")) continue;
        expect(port.width).toBeGreaterThanOrEqual(18);
        expect(port.labelWidth).toBeGreaterThanOrEqual(12);
        expect(port.renderedLabelWidth).toBeGreaterThan(6);
      }
    }
    await testInfo.attach("access-point-readable-layout.png", { body: await page.screenshot(), contentType: "image/png" });
    await page.mouse.move(50, 300);
    await page.mouse.down();
    await page.mouse.move(950, 300, { steps: 5 });
    const mounted = await page.evaluate(() => {
      const { engine, state } = window.accessPointLayoutFixture;
      const box = engine.deviceRectangles()[0];
      const original = engine.drag.originals.get("isolated-ap");
      return { height: box.height, rackID: state.topology.devices[0].rackId, units: state.topology.devices[0].faceplate.unitsU,
        ghost: { width: original.width, height: original.height }, preview: engine.rackDropPreview?.isValid };
    });
    expect(mounted).toEqual({ height: 100, rackID: "ap-rack", units: 1, ghost: { width: 690, height: 345 }, preview: true });
    await page.mouse.move(50, 300, { steps: 5 });
    await page.mouse.up();
    const free = await page.evaluate(() => {
      const { engine, state } = window.accessPointLayoutFixture;
      return { height: engine.deviceRectangles()[0].height, rackID: state.topology.devices[0].rackId,
        ports: state.topology.devices[0].ports.map((port) => port.id), units: state.topology.devices[0].faceplate.unitsU };
    });
    expect(free).toEqual({ height: 345, rackID: "", ports: ["ap-port-1", "ap-port-2", "ap-port-3"], units: 1 });
    expect(pageErrors).toEqual([]);
    await testInfo.attach("access-point-layout.json", { body: JSON.stringify(metrics, null, 2), contentType: "application/json" });
  } finally {
    await page.evaluate(() => {
      const fixture = window.accessPointLayoutFixture;
      fixture.engine.destroy();
      fixture.stage.remove();
      delete window.accessPointLayoutFixture;
    });
  }
});

test("installing APs, a server and a patch panel persists nonoverlapping positions", async ({ page, request }, testInfo) => {
  test.setTimeout(60_000);
  await enterGuestWorkspace(page, request);
  await expect(page.locator("#connection-status")).toHaveAttribute("data-state", "online");
  const originalID = await page.locator("#topology-select").inputValue();
  await page.locator("#add-topology-button").click();
  const mapDialog = page.locator("#topology-dialog");
  await mapDialog.locator('[name="name"]').fill(`AP SPACING ${testInfo.project.name}`);
  await mapDialog.locator('[name="location"]').fill("Browser test workspace");
  await mapDialog.locator('button[value="create"]').click();
  await expect(mapDialog).not.toBeVisible();
  await expect(page.locator("#device-count")).toHaveText("0");
  await unlockEditor(page);
  const topologyID = await page.locator("#topology-select").inputValue();
  const path = `/api/v1/topologies/${encodeURIComponent(topologyID)}`;
  try {
    for (const [vendor, model] of [["HPE Aruba", "AP-635"], ["Ubiquiti", "UniFi U7 Pro"]]) {
      await page.locator("#add-device-button").click();
      const dialog = page.locator("#device-dialog");
      await dialog.locator('[name="family"]').selectOption("Access Points");
      await dialog.locator('[name="vendor"]').selectOption(vendor);
      await dialog.locator('[name="model"]').selectOption(model);
      await dialog.locator('[name="name"]').fill(model);
      await dialog.locator('button[value="install"]').click();
      await expect(dialog).not.toBeVisible();
    }
    const accessPoints = (await (await request.get(path)).json()).devices;
    await page.locator("#add-server-button").click();
    const serverDialog = page.locator("#static-server-dialog");
    await serverDialog.locator('[name="name"]').fill("AP SPACING SERVER");
    await serverDialog.locator('[name="units"]').selectOption("2");
    await serverDialog.locator('button[value="install"]').click();
    await expect(serverDialog).not.toBeVisible();
    await page.locator("#add-patch-panel-button").click();
    const panelDialog = page.locator("#patch-panel-dialog");
    await panelDialog.locator('[name="name"]').fill("AP SPACING PANEL");
    await panelDialog.locator('button[value="install"]').click();
    await expect(panelDialog).not.toBeVisible();
    await expect(page.locator("#device-count")).toHaveText("4");
    const saved = await (await request.get(path)).json();
    for (const ap of accessPoints) expect(saved.devices.find((device) => device.id === ap.id)).toEqual(ap);
    expect(saved.devices.filter((device) => device.category === "AccessPoint").every((device) => device.faceplate.unitsU === 1)).toBe(true);
    const geometry = await page.evaluate(async (devices) => {
      const { faceplateDisplaySize } = await import("/js/faceplate-scene.js");
      return devices.map((device) => ({ id: device.id, x: device.positionX, y: device.positionY, ...faceplateDisplaySize(device) }));
    }, saved.devices);
    for (const [index, box] of geometry.entries()) for (const other of geometry.slice(index + 1)) {
      expect(box.x + box.width <= other.x || other.x + other.width <= box.x ||
        box.y + box.height + 50 <= other.y || other.y + other.height + 50 <= box.y).toBe(true);
    }
    await page.reload();
    await expect(page.locator("#connection-status")).toHaveAttribute("data-state", "online");
    await expect(page.locator("#topology-select")).toHaveValue(topologyID);
    const reloaded = await (await request.get(path)).json();
    expect(reloaded.devices).toEqual(saved.devices);
    await page.locator("#export-menu summary").click();
    const downloading = page.waitForEvent("download");
    await page.locator("#svg-button").click();
    const svg = await readFile(await (await downloading).path(), "utf8");
    const exported = await page.evaluate(({ text, ids }) => {
      const document = new DOMParser().parseFromString(text, "image/svg+xml");
      return ids.map((id) => {
        const chassis = document.querySelector(`[data-device-id="${id}"] [data-layer="physical-chassis"]`);
        return { width: Number(chassis.getAttribute("width")), height: Number(chassis.getAttribute("height")) };
      });
    }, { text: svg, ids: accessPoints.map((device) => device.id) });
    for (const chassis of exported) {
      expect(chassis.width).toBe(chassis.height);
      expect(chassis.height).toBeGreaterThan(280);
    }
  } finally {
    await page.locator("#topology-select").selectOption(originalID);
    const current = await (await request.get(path)).json();
    const deleted = await request.delete(path, { headers: { "If-Match": `"rev-${current.revision}"` } });
    expect(deleted.ok()).toBe(true);
  }
});
