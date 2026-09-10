import { readFile } from "node:fs/promises";

export function administrationDirectory() {
  return {
    users: [
      { id: "admin", username: "admin", role: "admin", protected: true, authSource: "local", totpConfigured: true },
      { id: "anna", username: "Anna Berger", externalLogin: "anna.berger@example.com", authSource: "entra", externalLinked: true, role: "admin" },
      { id: "max", username: "Max Steiner", authSource: "local", totpConfigured: true, role: "user", organizationIds: ["vienna", "linz"] },
      { id: "lea", username: "Lea Wagner", externalLogin: "lea.wagner@example.com", authSource: "entra", externalLinked: false, role: "user", organizationIds: ["vienna"] },
      { id: "sam", username: "Sam Huber", authSource: "local", role: "user", allOrganizations: true, disabled: true },
    ],
    organizations: [
      { id: "default", name: "Default", isDefault: true, mapCount: 2 },
      { id: "vienna", name: "Vienna Operations", mapCount: 8 },
      { id: "linz", name: "Linz Datacenter", mapCount: 3 },
      { id: "guest", name: "Guest", protected: true, mapCount: 0 },
      { id: "lab", name: "Lab", mapCount: 0 },
    ],
  };
}

export async function mockAdministration(page, options = {}) {
  const directory = administrationDirectory();
  const writes = [];
  const requests = [];
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    requests.push(url.pathname);
    if (url.pathname === "/api/v1/auth/status") return route.fulfill({ json: { authenticated: true, role: options.role || "admin", username: "admin", csrfToken: "fixture-csrf" } });
    if (url.pathname.startsWith("/api/v1/admin/")) {
      const kind = url.pathname.split("/")[4];
      const id = decodeURIComponent(url.pathname.split("/")[5] || "");
      if (request.method() === "GET") {
        if (options.failReads || (options.failRefresh && writes.length)) return route.fulfill({ status: 503, json: { error: "Directory temporarily unavailable" } });
        return route.fulfill({ json: { [kind]: directory[kind] } });
      }
      const data = request.postDataJSON();
      writes.push({ kind, id, method: request.method(), data, csrf: request.headers()["x-csrf-token"] });
      if (options.failWrites) return route.fulfill({ status: 409, json: { error: "Organization contains maps. Move or delete the maps first." } });
      if (request.method() === "POST") {
        const record = { ...data, id: `${kind}-${writes.length}` };
        directory[kind].push(record);
        return route.fulfill({ status: 201, json: record });
      }
      if (request.method() === "DELETE") {
        directory[kind] = directory[kind].filter((record) => record.id !== id);
        return route.fulfill({ status: 204 });
      }
      const record = directory[kind].find((record) => record.id === id);
      Object.assign(record, data);
      if (data.resetExternalIdentity) record.externalLinked = false;
      return route.fulfill({ json: record });
    }
    const path = url.pathname === "/" ? "/index.html" : url.pathname;
    if (path === "/admin.html" || path === "/index.html" || path.startsWith("/js/") || path.startsWith("/css/") || path === "/favicon.svg") {
      const body = await readFile(new URL(`../web/static${path}`, import.meta.url));
      const extension = path.split(".").pop();
      return route.fulfill({ body, contentType: { html: "text/html", js: "text/javascript", css: "text/css", svg: "image/svg+xml" }[extension] });
    }
    return route.abort();
  });
  return { directory, writes, requests };
}
