const JSON_HEADERS = { "Content-Type": "application/json" };

export class APIError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "APIError";
    this.status = status;
  }
}

async function request(path, options = {}) {
  const response = await fetch(path, options);
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    throw new APIError(body?.error || `Request failed (${response.status})`, response.status);
  }
  return body;
}

export const api = {
  listTopologies: () => request("/api/v1/topologies"),
  getTopology: (id) => request(`/api/v1/topologies/${encodeURIComponent(id)}`),
  createTopology: (input) => request("/api/v1/topologies", {
    method: "POST", headers: JSON_HEADERS, body: JSON.stringify(input),
  }),
  replaceTopology: (topology) => request(`/api/v1/topologies/${encodeURIComponent(topology.id)}`, {
    method: "PUT", headers: JSON_HEADERS, body: JSON.stringify(topology),
  }),
  createDevice: (id, device) => request(`/api/v1/topologies/${encodeURIComponent(id)}/devices`, {
    method: "POST", headers: JSON_HEADERS, body: JSON.stringify(device),
  }),
  updateDevice: (id, device) => request(`/api/v1/topologies/${encodeURIComponent(id)}/devices/${encodeURIComponent(device.id)}`, {
    method: "PUT", headers: JSON_HEADERS, body: JSON.stringify(device),
  }),
  deleteDevice: (id, deviceID) => request(`/api/v1/topologies/${encodeURIComponent(id)}/devices/${encodeURIComponent(deviceID)}`, { method: "DELETE" }),
  updatePort: (id, port) => request(`/api/v1/topologies/${encodeURIComponent(id)}/ports/${encodeURIComponent(port.id)}`, {
    method: "PUT", headers: JSON_HEADERS, body: JSON.stringify(port),
  }),
  createLink: (id, link) => request(`/api/v1/topologies/${encodeURIComponent(id)}/links`, {
    method: "POST", headers: JSON_HEADERS, body: JSON.stringify(link),
  }),
  deleteLink: (id, linkID) => request(`/api/v1/topologies/${encodeURIComponent(id)}/links/${encodeURIComponent(linkID)}`, { method: "DELETE" }),
  createVLAN: (id, vlan) => request(`/api/v1/topologies/${encodeURIComponent(id)}/vlans`, {
    method: "POST", headers: JSON_HEADERS, body: JSON.stringify(vlan),
  }),
  updateVLAN: (id, vlan) => request(`/api/v1/topologies/${encodeURIComponent(id)}/vlans/${vlan.id}`, {
    method: "PUT", headers: JSON_HEADERS, body: JSON.stringify(vlan),
  }),
  deleteVLAN: (id, vlanID) => request(`/api/v1/topologies/${encodeURIComponent(id)}/vlans/${vlanID}`, { method: "DELETE" }),
  analysis: (id) => request(`/api/v1/topologies/${encodeURIComponent(id)}/analysis`),
  trace: (id, source, target, vlan) => {
    const query = new URLSearchParams({ source, target, vlan: String(vlan) });
    return request(`/api/v1/topologies/${encodeURIComponent(id)}/trace?${query}`);
  },
};
