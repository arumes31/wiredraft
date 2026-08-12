const JSON_HEADERS = { "Content-Type": "application/json" };
let revisionProvider = () => null;
let csrfToken = "";

export class APIError extends Error {
  constructor(message, status, details = null) {
    super(message);
    this.name = "APIError";
    this.status = status;
    this.details = details;
  }
}

export function revisionHeaders(revision, headers = JSON_HEADERS) {
  const expectedRevision = revision ?? revisionProvider();
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) return headers;
  return { ...headers, "If-Match": `"rev-${expectedRevision}"` };
}

async function request(path, options = {}) {
  const method = String(options.method || "GET").toUpperCase();
  const headers = { ...(options.headers || {}) };
  if (!["GET", "HEAD", "OPTIONS"].includes(method) && csrfToken) headers["X-CSRF-Token"] = csrfToken;
  const response = await fetch(path, { ...options, headers, credentials: "same-origin" });
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && globalThis.location?.pathname !== "/login") {
      globalThis.location?.assign?.("/login");
    }
    throw new APIError(body?.error || `Request failed (${response.status})`, response.status, body);
  }
  return body;
}

export const api = {
  setRevisionProvider: (provider) => { revisionProvider = typeof provider === "function" ? provider : () => null; },
  setCSRFToken: (token) => { csrfToken = typeof token === "string" ? token : ""; },
  authStatus: () => request("/api/v1/auth/status"),
  logout: () => request("/api/v1/auth/logout", { method: "POST", headers: {} }),
  listUsers: () => request("/api/v1/admin/users"),
  createUser: (input) => request("/api/v1/admin/users", {
    method: "POST", headers: JSON_HEADERS, body: JSON.stringify(input),
  }),
  updateUser: (id, input) => request(`/api/v1/admin/users/${encodeURIComponent(id)}`, {
    method: "PUT", headers: JSON_HEADERS, body: JSON.stringify(input),
  }),
  listOrganizations: () => request("/api/v1/admin/organizations"),
  createOrganization: (input) => request("/api/v1/admin/organizations", {
    method: "POST", headers: JSON_HEADERS, body: JSON.stringify(input),
  }),
  updateOrganization: (id, input) => request(`/api/v1/admin/organizations/${encodeURIComponent(id)}`, {
    method: "PUT", headers: JSON_HEADERS, body: JSON.stringify(input),
  }),
  deleteOrganization: (id) => request(`/api/v1/admin/organizations/${encodeURIComponent(id)}`, {
    method: "DELETE", headers: {},
  }),
  listTopologies: () => request("/api/v1/topologies"),
  getTopology: (id) => request(`/api/v1/topologies/${encodeURIComponent(id)}`),
  createTopology: (input) => request("/api/v1/topologies", {
    method: "POST", headers: JSON_HEADERS, body: JSON.stringify(input),
  }),
  replaceTopology: (topology) => request(`/api/v1/topologies/${encodeURIComponent(topology.id)}`, {
    method: "PUT", headers: revisionHeaders(topology.revision), body: JSON.stringify(topology),
  }),
  deleteTopology: (id, revision) => request(`/api/v1/topologies/${encodeURIComponent(id)}`, {
    method: "DELETE", headers: revisionHeaders(revision, {}),
  }),
  uploadPhotos: (id, target, files, revision) => {
    const form = new FormData();
    form.set("targetKind", target.type);
    form.set("targetId", target.id);
    for (const file of files) form.append("photos", file);
    return request(`/api/v1/topologies/${encodeURIComponent(id)}/photos`, {
      method: "POST", headers: revisionHeaders(revision, {}), body: form,
    });
  },
  updatePhoto: (id, photoID, input, revision) => request(`/api/v1/topologies/${encodeURIComponent(id)}/photos/${encodeURIComponent(photoID)}`, {
    method: "PUT", headers: revisionHeaders(revision), body: JSON.stringify(input),
  }),
  deletePhoto: (id, photoID, revision) => request(`/api/v1/topologies/${encodeURIComponent(id)}/photos/${encodeURIComponent(photoID)}`, {
    method: "DELETE", headers: revisionHeaders(revision, {}),
  }),
  createRack: (id, rack, revision) => request(`/api/v1/topologies/${encodeURIComponent(id)}/racks`, {
    method: "POST", headers: revisionHeaders(revision), body: JSON.stringify(rack),
  }),
  updateRack: (id, rack, revision) => request(`/api/v1/topologies/${encodeURIComponent(id)}/racks/${encodeURIComponent(rack.id)}`, {
    method: "PUT", headers: revisionHeaders(revision), body: JSON.stringify(rack),
  }),
  deleteRack: (id, rackID, revision) => request(`/api/v1/topologies/${encodeURIComponent(id)}/racks/${encodeURIComponent(rackID)}`, { method: "DELETE", headers: revisionHeaders(revision, {}) }),
  createDevice: (id, device, revision) => request(`/api/v1/topologies/${encodeURIComponent(id)}/devices`, {
    method: "POST", headers: revisionHeaders(revision), body: JSON.stringify(device),
  }),
  updateDevice: (id, device, revision) => request(`/api/v1/topologies/${encodeURIComponent(id)}/devices/${encodeURIComponent(device.id)}`, {
    method: "PUT", headers: revisionHeaders(revision), body: JSON.stringify(device),
  }),
  deleteDevice: (id, deviceID, revision) => request(`/api/v1/topologies/${encodeURIComponent(id)}/devices/${encodeURIComponent(deviceID)}`, { method: "DELETE", headers: revisionHeaders(revision, {}) }),
  updatePort: (id, port, revision) => request(`/api/v1/topologies/${encodeURIComponent(id)}/ports/${encodeURIComponent(port.id)}`, {
    method: "PUT", headers: revisionHeaders(revision), body: JSON.stringify(port),
  }),
  createLink: (id, link, revision) => request(`/api/v1/topologies/${encodeURIComponent(id)}/links`, {
    method: "POST", headers: revisionHeaders(revision), body: JSON.stringify(link),
  }),
  createLinks: (id, links, revision) => request(`/api/v1/topologies/${encodeURIComponent(id)}/links/bulk`, {
    method: "POST", headers: revisionHeaders(revision), body: JSON.stringify({ links }),
  }),
  configureLink: (id, linkID, configuration, revision) => request(`/api/v1/topologies/${encodeURIComponent(id)}/links/${encodeURIComponent(linkID)}/configuration`, {
    method: "PUT", headers: revisionHeaders(revision), body: JSON.stringify(configuration),
  }),
  setLinkDirection: (id, linkID, sourcePortID, revision) => request(`/api/v1/topologies/${encodeURIComponent(id)}/links/${encodeURIComponent(linkID)}/direction`, {
    method: "PUT", headers: revisionHeaders(revision), body: JSON.stringify({ sourcePortId: sourcePortID }),
  }),
  deleteLink: (id, linkID, revision) => request(`/api/v1/topologies/${encodeURIComponent(id)}/links/${encodeURIComponent(linkID)}`, { method: "DELETE", headers: revisionHeaders(revision, {}) }),
  createLinkGroup: (id, group, revision) => request(`/api/v1/topologies/${encodeURIComponent(id)}/link-groups`, {
    method: "POST", headers: revisionHeaders(revision), body: JSON.stringify(group),
  }),
  updateLinkGroup: (id, group, revision) => request(`/api/v1/topologies/${encodeURIComponent(id)}/link-groups/${encodeURIComponent(group.id)}`, {
    method: "PUT", headers: revisionHeaders(revision), body: JSON.stringify(group),
  }),
  deleteLinkGroup: (id, groupID, revision) => request(`/api/v1/topologies/${encodeURIComponent(id)}/link-groups/${encodeURIComponent(groupID)}`, { method: "DELETE", headers: revisionHeaders(revision, {}) }),
  createSwitchSystem: (id, system, revision) => request(`/api/v1/topologies/${encodeURIComponent(id)}/switch-systems`, {
    method: "POST", headers: revisionHeaders(revision), body: JSON.stringify(system),
  }),
  updateSwitchSystem: (id, system, revision) => request(`/api/v1/topologies/${encodeURIComponent(id)}/switch-systems/${encodeURIComponent(system.id)}`, {
    method: "PUT", headers: revisionHeaders(revision), body: JSON.stringify(system),
  }),
  deleteSwitchSystem: (id, systemID, revision) => request(`/api/v1/topologies/${encodeURIComponent(id)}/switch-systems/${encodeURIComponent(systemID)}`, { method: "DELETE", headers: revisionHeaders(revision, {}) }),
  createFirewallCluster: (id, cluster, revision) => request(`/api/v1/topologies/${encodeURIComponent(id)}/firewall-clusters`, {
    method: "POST", headers: revisionHeaders(revision), body: JSON.stringify(cluster),
  }),
  updateFirewallCluster: (id, cluster, revision) => request(`/api/v1/topologies/${encodeURIComponent(id)}/firewall-clusters/${encodeURIComponent(cluster.id)}`, {
    method: "PUT", headers: revisionHeaders(revision), body: JSON.stringify(cluster),
  }),
  deleteFirewallCluster: (id, clusterID, revision) => request(`/api/v1/topologies/${encodeURIComponent(id)}/firewall-clusters/${encodeURIComponent(clusterID)}`, { method: "DELETE", headers: revisionHeaders(revision, {}) }),
  createVLAN: (id, vlan, revision) => request(`/api/v1/topologies/${encodeURIComponent(id)}/vlans`, {
    method: "POST", headers: revisionHeaders(revision), body: JSON.stringify(vlan),
  }),
  updateVLAN: (id, vlan, revision) => request(`/api/v1/topologies/${encodeURIComponent(id)}/vlans/${vlan.id}`, {
    method: "PUT", headers: revisionHeaders(revision), body: JSON.stringify(vlan),
  }),
  deleteVLAN: (id, vlanID, revision) => request(`/api/v1/topologies/${encodeURIComponent(id)}/vlans/${vlanID}`, { method: "DELETE", headers: revisionHeaders(revision, {}) }),
  analysis: (id) => request(`/api/v1/topologies/${encodeURIComponent(id)}/analysis`),
  trace: (id, source, target, vlan) => {
    const query = new URLSearchParams({ source, target, vlan: String(vlan) });
    return request(`/api/v1/topologies/${encodeURIComponent(id)}/trace?${query}`);
  },
  listComments: (id) => request(`/api/v1/topologies/${encodeURIComponent(id)}/comments`),
  createComment: (id, input, revision) => request(`/api/v1/topologies/${encodeURIComponent(id)}/comments`, {
    method: "POST", headers: revisionHeaders(revision), body: JSON.stringify(input),
  }),
  replyToComment: (id, threadID, input, revision) => request(`/api/v1/topologies/${encodeURIComponent(id)}/comments/${encodeURIComponent(threadID)}/replies`, {
    method: "POST", headers: revisionHeaders(revision), body: JSON.stringify(input),
  }),
  updateComment: (id, threadID, input, revision) => request(`/api/v1/topologies/${encodeURIComponent(id)}/comments/${encodeURIComponent(threadID)}`, {
    method: "PUT", headers: revisionHeaders(revision), body: JSON.stringify(input),
  }),
  deleteComment: (id, threadID, revision) => request(`/api/v1/topologies/${encodeURIComponent(id)}/comments/${encodeURIComponent(threadID)}`, {
    method: "DELETE", headers: revisionHeaders(revision, {}),
  }),
  listDocumentationLinks: (id) => request(`/api/v1/topologies/${encodeURIComponent(id)}/documentation-links`),
  createDocumentationLink: (id, input, revision) => request(`/api/v1/topologies/${encodeURIComponent(id)}/documentation-links`, {
    method: "POST", headers: revisionHeaders(revision), body: JSON.stringify(input),
  }),
  deleteDocumentationLink: (id, linkID, revision) => request(`/api/v1/topologies/${encodeURIComponent(id)}/documentation-links/${encodeURIComponent(linkID)}`, {
    method: "DELETE", headers: revisionHeaders(revision, {}),
  }),
  listShares: (id) => request(`/api/v1/topologies/${encodeURIComponent(id)}/shares`),
  createShare: (id, input, revision) => request(`/api/v1/topologies/${encodeURIComponent(id)}/shares`, {
    method: "POST", headers: revisionHeaders(revision), body: JSON.stringify(input),
  }),
  deleteShare: (id, shareID, revision) => request(`/api/v1/topologies/${encodeURIComponent(id)}/shares/${encodeURIComponent(shareID)}`, {
    method: "DELETE", headers: revisionHeaders(revision, {}),
  }),
  getSharedTopology: (id, token) => request(`/api/v1/shared/${encodeURIComponent(id)}/${encodeURIComponent(token)}`),
};
