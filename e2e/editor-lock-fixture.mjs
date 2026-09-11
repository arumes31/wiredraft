import { readFile } from "node:fs/promises";
import { hardwareCatalog, instantiateProfile } from "../web/static/js/catalog.js";

export function createLockWorkspace() {
  const devices = ["Source", "Target"].map((name, index) => {
    const device = instantiateProfile(hardwareCatalog.find((profile) => profile.model === "EX2300-24T"), name, { x: 100, y: 200 + index * 250 });
    device.id = `device-${index}`;
    device.ports.forEach((port, portIndex) => { port.id = `port-${index}-${portIndex}`; port.deviceId = device.id; });
    return device;
  });
  let topology = { id: "lock-map", name: "Editor lock fixture", organizationId: "guest", organization: "Guest", revision: 1,
    devices, links: [], racks: [{ id: "rack", name: "Rack", positionX: 1100, positionY: 200, heightU: 6, color: "#304348" }],
    vlans: [{ id: 1, name: "Default", colorHex: "#42d9c8" }], annotations: [], linkGroups: [], switchSystems: [], firewallClusters: [],
    comments: [], documentationLinks: [], photos: [] };
  const writes = [];
  return {
    writes,
    get topology() { return structuredClone(topology); },
    async respond(path, method = "GET", input) {
      if (path === "/api/v1/auth/status") return { json: { authenticated: true, role: "guest", username: "Fixture",
        organizationIds: ["guest"], availableOrganizations: [{ id: "guest", name: "Guest" }] } };
      if (path === "/api/v1/topologies") return { json: [topology, { ...topology, id: "second-map", name: "Second map" }] };
      if (path.endsWith("/analysis")) return { json: { issues: [], loops: [], stp: [] } };
      if (path.startsWith("/api/v1/topologies/")) {
        if (method !== "GET") {
          writes.push({ path, method, input });
          if (path.endsWith("/links") && method === "POST") topology.links.push({ ...input, id: `link-${writes.length}` });
          else if (path.includes("/links/") && method === "DELETE") topology.links = topology.links.filter((link) => link.id !== path.split("/").at(-1));
          else if (path.includes("/devices/") && method === "PUT") topology.devices = topology.devices.map((device) => device.id === input.id ? input : device);
          else if (method === "PUT" && !path.slice("/api/v1/topologies/".length).includes("/")) topology = input;
          topology.revision++;
        }
        return { json: path.includes("second-map") ? { ...topology, id: "second-map", name: "Second map" } : topology };
      }
      const asset = path === "/" ? "/index.html" : path;
      if (!/^\/(index\.html|js\/[\w.-]+\.js|css\/[\w.-]+\.css|favicon\.svg)$/.test(asset)) return { status: 404, body: "Not found" };
      let body = await readFile(new URL(`../web/static${asset}`, import.meta.url), "utf8");
      // Test-only access for precise canvas coordinates and assertions; never shipped in the app.
      if (asset === "/js/app.js") body += "\nwindow.lockFixture = { state, canvas, editLock };";
      return { body, contentType: { html: "text/html", js: "text/javascript", css: "text/css", svg: "image/svg+xml" }[asset.split(".").at(-1)] };
    },
  };
}

export async function mockLockWorkspace(page) {
  const workspace = createLockWorkspace();
  await page.addInitScript(() => {
    window.EventSource = class { constructor() { queueMicrotask(() => this.onopen?.()); } addEventListener() {} close() {} };
  });
  await page.route("**/*", async (route) => {
    const request = route.request();
    await route.fulfill(await workspace.respond(new URL(request.url()).pathname, request.method(), request.postData() ? request.postDataJSON() : undefined));
  });
  return workspace;
}
