import { endpointSide } from "./patch-panels.js";
import { findPort } from "./state.js";

/** Plan a move without changing the topology. Occupied targets require an explicit swap. */
export function planCableRepatch(topology, linkID, endpoint, portID) {
  if (!["source", "target"].includes(endpoint)) return null;
  const link = topology?.links?.find(candidate => candidate.id === linkID);
  if (!link || [link.sourcePortId, link.targetPortId].includes(portID)) return null;
  const from = findPort(topology, link[`${endpoint}PortId`]);
  const to = findPort(topology, portID);
  const side = endpointSide(link, endpoint);
  if (!from || !to || (side === "rear" && to.device.category !== "PatchPanel")) return null;
  let swapLink = null, swapEndpoint = null;
  for (const candidate of topology.links) {
    for (const end of ["source", "target"]) {
      if (candidate[`${end}PortId`] === portID && endpointSide(candidate, end) === side) {
        swapLink = candidate;
        swapEndpoint = end;
      }
    }
  }
  const input = { endpoint, portId: portID };
  if (swapLink) input.swapLinkId = swapLink.id;
  return { link, from, to, side, input, swapLink, swapEndpoint };
}

export function repatchEndpointLabel(endpoint, side) {
  return `${endpoint.device.name} / ${endpoint.port.label}${side === "rear" ? " (rear)" : ""}`;
}
