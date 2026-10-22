import { test as base } from "@playwright/test";

export { expect } from "@playwright/test";

// Cookie-authenticated mutations always require the session CSRF token, so the
// API request fixture attaches the current token to every unsafe request.
export function withCSRF(request) {
  const unsafe = (method) => async (url, options = {}) => {
    const status = await request.get("/api/v1/auth/status");
    const { csrfToken } = status.ok() ? await status.json() : {};
    const headers = { ...(options.headers || {}) };
    if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
    return request[method](url, { ...options, headers });
  };
  return {
    get: (...args) => request.get(...args),
    head: (...args) => request.head(...args),
    post: unsafe("post"),
    put: unsafe("put"),
    patch: unsafe("patch"),
    delete: unsafe("delete"),
    storageState: (...args) => request.storageState(...args),
  };
}

export const test = base.extend({
  request: async ({ request }, use) => {
    await use(withCSRF(request));
  },
});
