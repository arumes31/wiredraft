import assert from "node:assert/strict";
import test from "node:test";

import { APIError, api, revisionHeaders } from "./static/js/api.js";

test("revision headers use explicit revisions before the live provider", () => {
  api.setRevisionProvider(() => 9);
  assert.deepEqual(revisionHeaders(), { "Content-Type": "application/json", "If-Match": '"rev-9"' });
  assert.deepEqual(revisionHeaders(4, {}), { "If-Match": '"rev-4"' });
  const headers = { Accept: "application/json" };
  assert.equal(revisionHeaders(0, headers), headers);
  api.setRevisionProvider("not a function");
  assert.equal(revisionHeaders(undefined, headers), headers);
});

test("API client maps every public operation to its HTTP contract", async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (path, options) => {
    calls.push({ path, options });
    return { status: 200, ok: true, json: async () => ({ accepted: true }) };
  };
  api.setRevisionProvider(() => 17);
  api.setCSRFToken("csrf-token");

  const topologyID = "topology / one";
  const childID = "child / one";
  const encodedTopology = "topology%20%2F%20one";
  const encodedChild = "child%20%2F%20one";
  const topology = { id: topologyID, revision: 23, name: "Core" };
  const child = { id: childID, name: "Child" };
  const cases = [
    ["auth status", () => api.authStatus(), "/api/v1/auth/status", "GET"],
    ["logout", () => api.logout(), "/api/v1/auth/logout", "POST"],
    ["list users", () => api.listUsers(), "/api/v1/admin/users", "GET"],
    ["create user", () => api.createUser(child), "/api/v1/admin/users", "POST"],
    ["update user", () => api.updateUser(childID, child), `/api/v1/admin/users/${encodedChild}`, "PUT"],
    ["list organizations", () => api.listOrganizations(), "/api/v1/admin/organizations", "GET"],
    ["create organization", () => api.createOrganization(child), "/api/v1/admin/organizations", "POST"],
    ["update organization", () => api.updateOrganization(childID, child), `/api/v1/admin/organizations/${encodedChild}`, "PUT"],
    ["delete organization", () => api.deleteOrganization(childID), `/api/v1/admin/organizations/${encodedChild}`, "DELETE"],
    ["list topologies", () => api.listTopologies(), "/api/v1/topologies", "GET"],
    ["get topology", () => api.getTopology(topologyID), `/api/v1/topologies/${encodedTopology}`, "GET"],
    ["create topology", () => api.createTopology(topology), "/api/v1/topologies", "POST"],
    ["replace topology", () => api.replaceTopology(topology), `/api/v1/topologies/${encodedTopology}`, "PUT", 23],
    ["create rack", () => api.createRack(topologyID, child), `/api/v1/topologies/${encodedTopology}/racks`, "POST", 17],
    ["update rack", () => api.updateRack(topologyID, child, 3), `/api/v1/topologies/${encodedTopology}/racks/${encodedChild}`, "PUT", 3],
    ["delete rack", () => api.deleteRack(topologyID, childID, 3), `/api/v1/topologies/${encodedTopology}/racks/${encodedChild}`, "DELETE", 3],
    ["create device", () => api.createDevice(topologyID, child, 3), `/api/v1/topologies/${encodedTopology}/devices`, "POST", 3],
    ["update device", () => api.updateDevice(topologyID, child, 3), `/api/v1/topologies/${encodedTopology}/devices/${encodedChild}`, "PUT", 3],
    ["delete device", () => api.deleteDevice(topologyID, childID, 3), `/api/v1/topologies/${encodedTopology}/devices/${encodedChild}`, "DELETE", 3],
    ["update port", () => api.updatePort(topologyID, child, 3), `/api/v1/topologies/${encodedTopology}/ports/${encodedChild}`, "PUT", 3],
    ["create link", () => api.createLink(topologyID, child, 3), `/api/v1/topologies/${encodedTopology}/links`, "POST", 3],
    ["create links", () => api.createLinks(topologyID, [child], 3), `/api/v1/topologies/${encodedTopology}/links/bulk`, "POST", 3],
    ["configure link", () => api.configureLink(topologyID, childID, child, 3), `/api/v1/topologies/${encodedTopology}/links/${encodedChild}/configuration`, "PUT", 3],
    ["set link direction", () => api.setLinkDirection(topologyID, childID, "source / port", 3), `/api/v1/topologies/${encodedTopology}/links/${encodedChild}/direction`, "PUT", 3],
    ["delete link", () => api.deleteLink(topologyID, childID, 3), `/api/v1/topologies/${encodedTopology}/links/${encodedChild}`, "DELETE", 3],
    ["create link group", () => api.createLinkGroup(topologyID, child, 3), `/api/v1/topologies/${encodedTopology}/link-groups`, "POST", 3],
    ["update link group", () => api.updateLinkGroup(topologyID, child, 3), `/api/v1/topologies/${encodedTopology}/link-groups/${encodedChild}`, "PUT", 3],
    ["delete link group", () => api.deleteLinkGroup(topologyID, childID, 3), `/api/v1/topologies/${encodedTopology}/link-groups/${encodedChild}`, "DELETE", 3],
    ["create switch system", () => api.createSwitchSystem(topologyID, child, 3), `/api/v1/topologies/${encodedTopology}/switch-systems`, "POST", 3],
    ["update switch system", () => api.updateSwitchSystem(topologyID, child, 3), `/api/v1/topologies/${encodedTopology}/switch-systems/${encodedChild}`, "PUT", 3],
    ["delete switch system", () => api.deleteSwitchSystem(topologyID, childID, 3), `/api/v1/topologies/${encodedTopology}/switch-systems/${encodedChild}`, "DELETE", 3],
    ["create firewall cluster", () => api.createFirewallCluster(topologyID, child, 3), `/api/v1/topologies/${encodedTopology}/firewall-clusters`, "POST", 3],
    ["update firewall cluster", () => api.updateFirewallCluster(topologyID, child, 3), `/api/v1/topologies/${encodedTopology}/firewall-clusters/${encodedChild}`, "PUT", 3],
    ["delete firewall cluster", () => api.deleteFirewallCluster(topologyID, childID, 3), `/api/v1/topologies/${encodedTopology}/firewall-clusters/${encodedChild}`, "DELETE", 3],
    ["create VLAN", () => api.createVLAN(topologyID, child, 3), `/api/v1/topologies/${encodedTopology}/vlans`, "POST", 3],
    ["update VLAN", () => api.updateVLAN(topologyID, { ...child, id: 22 }, 3), `/api/v1/topologies/${encodedTopology}/vlans/22`, "PUT", 3],
    ["delete VLAN", () => api.deleteVLAN(topologyID, 22, 3), `/api/v1/topologies/${encodedTopology}/vlans/22`, "DELETE", 3],
    ["analysis", () => api.analysis(topologyID), `/api/v1/topologies/${encodedTopology}/analysis`, "GET"],
    ["trace", () => api.trace(topologyID, "source one", "target/two", 22), `/api/v1/topologies/${encodedTopology}/trace?source=source+one&target=target%2Ftwo&vlan=22`, "GET"],
    ["list comments", () => api.listComments(topologyID), `/api/v1/topologies/${encodedTopology}/comments`, "GET"],
    ["create comment", () => api.createComment(topologyID, child, 3), `/api/v1/topologies/${encodedTopology}/comments`, "POST", 3],
    ["reply to comment", () => api.replyToComment(topologyID, childID, child, 3), `/api/v1/topologies/${encodedTopology}/comments/${encodedChild}/replies`, "POST", 3],
    ["update comment", () => api.updateComment(topologyID, childID, child, 3), `/api/v1/topologies/${encodedTopology}/comments/${encodedChild}`, "PUT", 3],
    ["delete comment", () => api.deleteComment(topologyID, childID, 3), `/api/v1/topologies/${encodedTopology}/comments/${encodedChild}`, "DELETE", 3],
    ["list documentation", () => api.listDocumentationLinks(topologyID), `/api/v1/topologies/${encodedTopology}/documentation-links`, "GET"],
    ["create documentation", () => api.createDocumentationLink(topologyID, child, 3), `/api/v1/topologies/${encodedTopology}/documentation-links`, "POST", 3],
    ["delete documentation", () => api.deleteDocumentationLink(topologyID, childID, 3), `/api/v1/topologies/${encodedTopology}/documentation-links/${encodedChild}`, "DELETE", 3],
    ["list shares", () => api.listShares(topologyID), `/api/v1/topologies/${encodedTopology}/shares`, "GET"],
    ["create share", () => api.createShare(topologyID, child, 3), `/api/v1/topologies/${encodedTopology}/shares`, "POST", 3],
    ["delete share", () => api.deleteShare(topologyID, childID, 3), `/api/v1/topologies/${encodedTopology}/shares/${encodedChild}`, "DELETE", 3],
    ["get shared topology", () => api.getSharedTopology(topologyID, childID), `/api/v1/shared/${encodedTopology}/${encodedChild}`, "GET"],
  ];

  try {
    for (const [name, invoke, path, method, revision] of cases) {
      await invoke();
      const call = calls.at(-1);
      assert.equal(call.path, path, `${name} path`);
      assert.equal(call.options.method || "GET", method, `${name} method`);
      assert.equal(call.options.credentials, "same-origin", `${name} credentials`);
      if (["POST", "PUT", "DELETE"].includes(method)) {
        assert.equal(call.options.headers["X-CSRF-Token"], "csrf-token", `${name} csrf token`);
      }
      if (revision) assert.equal(call.options.headers["If-Match"], `"rev-${revision}"`, `${name} revision`);
    }
  } finally {
    api.setRevisionProvider(null);
    api.setCSRFToken("");
    globalThis.fetch = originalFetch;
  }
});

test("API failures preserve details and redirect expired sessions", async () => {
  const originalFetch = globalThis.fetch;
  const locationDescriptor = Object.getOwnPropertyDescriptor(globalThis, "location");
  const redirects = [];
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: { pathname: "/", assign: (path) => redirects.push(path) },
  });
  globalThis.fetch = async () => ({
    status: 401, ok: false, json: async () => ({ error: "session expired", reason: "timeout" }),
  });
  try {
    await assert.rejects(api.listTopologies(), (error) => {
      assert.ok(error instanceof APIError);
      assert.equal(error.name, "APIError");
      assert.equal(error.message, "session expired");
      assert.equal(error.status, 401);
      assert.equal(error.details.reason, "timeout");
      return true;
    });
    assert.deepEqual(redirects, ["/login"]);
  } finally {
    globalThis.fetch = originalFetch;
    if (locationDescriptor) Object.defineProperty(globalThis, "location", locationDescriptor);
    else delete globalThis.location;
  }
});

test("empty and malformed successful responses resolve to null", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => ({ status: 204, ok: true, json: async () => { throw new Error("unused"); } });
    assert.equal(await api.logout(), null);
    globalThis.fetch = async () => ({ status: 200, ok: true, json: async () => { throw new Error("invalid json"); } });
    assert.equal(await api.authStatus(), null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
