import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, sep } from "node:path";
import { hardwareCatalog, instantiateProfile } from "../web/static/js/catalog.js";

export function fixtureTopology(count = 12) {
  const profile = hardwareCatalog.find((item) => item.model === "Catalyst C9200L-24T-4G");
  const devices = Array.from({ length: count }, (_, index) => {
    const device = instantiateProfile(profile, `Switch ${String(index).padStart(3, "0")}`, { x: index % 10 * 1000, y: Math.floor(index / 10) * 260 });
    device.id = `device-${index}`;
    device.hostname = `switch-${index}.example.test`;
    device.managementIp = `192.0.2.${index % 250 + 1}`;
    device.serialNumber = `SERIAL-${index}`;
    device.assetTag = `ASSET-${index}`;
    device.ports.forEach((port, p) => { port.id = `port-${index}-${p}`; port.deviceId = device.id; });
    return device;
  });
  const links = devices.slice(1).map((device, i) => ({ id: `link-${i}`, name: `Cable ${i}`, sourceDeviceId: devices[i].id,
    sourcePortId: devices[i].ports[0].id, targetDeviceId: device.id, targetPortId: device.ports[1].id,
    cableType: "CAT6", vlanIds: [1], speedMbps: 1000, sourceSide: "front", targetSide: "front" }));
  return { id: "fixture-map", name: "Browser fixture", organizationId: "fixture-org", organization: "Fixture", location: "Lab", revision: 1,
    devices, links, racks: [], vlans: [{ id: 1, name: "Default", colorHex: "#4ce2d1" }], annotations: [], photos: [],
    linkGroups: [], switchSystems: [], firewallClusters: [], commentThreads: [], documentationLinks: [], shareGrants: [] };
}

/** Serve real frontend assets with deterministic API responses; no database/network timing. */
export async function serveFixture(page, topology) {
  // A fulfilled SSE response immediately closes. Keep a quiet connection instead
  // of measuring repeated reconnect/resync work from an artificial closed stream.
  await page.addInitScript(() => {
    window.EventSource = class extends EventTarget {
      constructor() { super(); this.timer = setTimeout(() => this.onopen?.(new Event("open")), 0); }
      close() { clearTimeout(this.timer); }
    };
  });
  const root = fileURLToPath(new URL("../web/static/", import.meta.url));
  let current = structuredClone(topology);
  const maps = new Map([[current.id, current]]);
  await page.route("http://127.0.0.1:41819/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (path === "/api/v1/auth/status") return json({ authenticated: true, role: "admin", username: "fixture", userId: "fixture-user", csrfToken: "fixture",
      allOrganizations: true, availableOrganizations: [{ id: "fixture-org", name: "Fixture", isDefault: true }] });
    if (path === "/api/v1/diagnostics") return json({ application: "WireDraft", revision: "fixture-build", modified: "false", goVersion: "fixture-go" });
    if (path === "/api/v1/topologies") return json([...maps.values()]);
    if (path.endsWith("/analysis")) return json({ issues: [{ kind: "native_vlan_mismatch", message: "Test mismatch", linkId: "link-0", severity: "warning" }], loops: [], stp: [] });
    if (path.endsWith("/events")) return route.fulfill({ contentType: "text/event-stream", body: ": fixture\n\n" });
    if (path.endsWith("/duplicate")) {
      current = { ...structuredClone(current), id: "fixture-copy", name: route.request().postDataJSON().name, revision: 1 };
      maps.set(current.id, current);
      return json(current, 201);
    }
    if (/^\/api\/v1\/topologies\/[^/]+$/.test(path)) {
      if (route.request().method() === "PUT") { current = route.request().postDataJSON(); current.revision++; maps.set(current.id, current); }
      return json(maps.get(path.split("/").at(-1)));
    }
    if (path.startsWith("/api/")) return json({ error: "Unexpected fixture API request" }, 404);
    const filename = resolve(root, `.${path === "/" ? "/index.html" : path}`);
    if (!filename.startsWith(root.endsWith(sep) ? root : root + sep)) return route.fulfill({ status: 404 });
    try {
      let body = await readFile(filename);
      if (path === "/js/app.js") body = Buffer.concat([body, Buffer.from("\nglobalThis.fixtureEngine = canvas; globalThis.fixtureState = state;\n")]);
      const type = path.endsWith(".js") ? "text/javascript" : path.endsWith(".css") ? "text/css" : path.endsWith(".svg") ? "image/svg+xml" : path.endsWith(".png") ? "image/png" : "text/html";
      return route.fulfill({ contentType: type, body });
    } catch { return route.fulfill({ status: 404 }); }
  });
}

export async function nextPaint(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
