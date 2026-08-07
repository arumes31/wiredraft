import { expect, test } from "@playwright/test";

import { enterGuestWorkspace } from "./auth-helper.mjs";

async function apiJSON(page, method, path, data, revision) {
  return page.evaluate(async ({ method, path, data, revision }) => {
    const authResponse = await fetch("/api/v1/auth/status");
    const auth = await authResponse.json();
    const headers = { "X-CSRF-Token": auth.csrfToken };
    if (data !== undefined) headers["Content-Type"] = "application/json";
    if (Number.isSafeInteger(revision)) headers["If-Match"] = `"rev-${revision}"`;
    const response = await fetch(path, {
      method,
      headers,
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    const body = await response.json().catch(() => null);
    return { status: response.status, body };
  }, { method, path, data, revision });
}

function rack(name, positionX) {
  return {
    name,
    positionX,
    positionY: 120,
    heightU: 42,
    color: "#2c4b4e",
  };
}

async function openTopology(page, topology) {
  await page.reload();
  await expect(page.locator("#connection-status")).toHaveAttribute("data-state", "online", { timeout: 15_000 });
  await page.locator("#topology-select").selectOption(topology.id);
  await expect(page.locator("#topology-name")).toHaveText(topology.name);
}

test("concurrent editors reject stale writes and resync after reconnect", async ({ browser, page }) => {
  await enterGuestWorkspace(page);
  await expect(page.locator("#connection-status")).toHaveAttribute("data-state", "online", { timeout: 15_000 });

  const createdResult = await apiJSON(page, "POST", "/api/v1/topologies", {
    name: `CHAOS MULTI-EDITOR ${Date.now()}`,
    template: "blank",
  });
  expect(createdResult.status).toBe(201);
  const topology = createdResult.body;

  const editorBContext = await browser.newContext({ colorScheme: "dark", reducedMotion: "reduce" });
  const editorB = await editorBContext.newPage();
  try {
    await openTopology(page, topology);
    await enterGuestWorkspace(editorB);
    await expect(editorB.locator("#connection-status")).toHaveAttribute("data-state", "online", { timeout: 15_000 });
    await editorB.locator("#topology-select").selectOption(topology.id);
    await expect(editorB.locator("#topology-name")).toHaveText(topology.name);

    const [snapshotA, snapshotB] = await Promise.all([
      apiJSON(page, "GET", `/api/v1/topologies/${topology.id}`),
      apiJSON(editorB, "GET", `/api/v1/topologies/${topology.id}`),
    ]);
    expect(snapshotA.status).toBe(200);
    expect(snapshotB.status).toBe(200);
    expect(snapshotA.body.revision).toBe(snapshotB.body.revision);

    const revision = snapshotA.body.revision;
    const writes = await Promise.all([
      apiJSON(page, "POST", `/api/v1/topologies/${topology.id}/racks`, rack("EDITOR A", 100), revision),
      apiJSON(editorB, "POST", `/api/v1/topologies/${topology.id}/racks`, rack("EDITOR B", 950), revision),
    ]);
    expect(writes.map((result) => result.status).sort()).toEqual([201, 409]);
    const conflict = writes.find((result) => result.status === 409);
    expect(conflict.body.currentRevision).toBe(revision + 1);
    await expect(page.locator("#rack-count")).toHaveText("1");
    await expect(editorB.locator("#rack-count")).toHaveText("1");

    const staleEditor = writes[0].status === 409 ? page : editorB;
    const afterRace = await apiJSON(staleEditor, "GET", `/api/v1/topologies/${topology.id}`);
    const retry = await apiJSON(
      staleEditor,
      "POST",
      `/api/v1/topologies/${topology.id}/racks`,
      rack("RETRIED EDIT", 1800),
      afterRace.body.revision,
    );
    expect(retry.status).toBe(201);
    await expect(page.locator("#rack-count")).toHaveText("2");
    await expect(editorB.locator("#rack-count")).toHaveText("2");

    let blockEvents = true;
    await editorB.route(/\/api\/v1\/topologies\/[^/]+\/events$/, (route) => {
      if (blockEvents) route.abort("failed");
      else route.continue();
    });
    await editorB.reload();
    await expect(editorB.locator("#connection-status")).toHaveAttribute("data-state", "offline", { timeout: 15_000 });
    const beforeOfflineWrite = await apiJSON(page, "GET", `/api/v1/topologies/${topology.id}`);
    const offlineWrite = await apiJSON(
      page,
      "POST",
      `/api/v1/topologies/${topology.id}/racks`,
      rack("MISSED WHILE OFFLINE", 2650),
      beforeOfflineWrite.body.revision,
    );
    expect(offlineWrite.status).toBe(201);
    await expect(page.locator("#rack-count")).toHaveText("3");

    blockEvents = false;
    await expect(editorB.locator("#connection-status")).toHaveAttribute("data-state", "online", { timeout: 30_000 });
    await expect(editorB.locator("#rack-count")).toHaveText("3", { timeout: 15_000 });
  } finally {
    const latest = await apiJSON(page, "GET", `/api/v1/topologies/${topology.id}`).catch(() => null);
    if (latest?.status === 200) {
      await apiJSON(page, "DELETE", `/api/v1/topologies/${topology.id}`, undefined, latest.body.revision).catch(() => {});
    }
    await editorBContext.close();
  }
});
