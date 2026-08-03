export function renderTopologyTree(container, topology, selection, onSelect) {
  const racks = topology?.racks || [];
  const rackDevices = new Map(racks.map((rack) => [rack.id, []]));
  const freeDevices = [];
  for (const device of topology?.devices || []) {
    if (device.rackId && rackDevices.has(device.rackId)) rackDevices.get(device.rackId).push(device);
    else freeDevices.push(device);
  }
  const deviceRow = (device) => `<button type="button" class="tree-node tree-device ${selection?.type === "device" && selection.id === device.id ? "is-selected" : ""}" data-tree-type="device" data-tree-id="${escapeAttribute(device.id)}"><i></i><span><b>${escapeHTML(device.name)}</b><small>${device.hostname ? `${escapeHTML(device.hostname)} · ` : ""}${escapeHTML(device.model)} · ${device.ports.length} PORTS</small></span></button>`;
  const rackRows = racks.map((rack) => `<details open><summary><span>${escapeHTML(rack.name)}</span><small>${rackDevices.get(rack.id).length} DEVICES</small></summary>${rackDevices.get(rack.id).map(deviceRow).join("")}</details>`).join("");
  const vlanRows = (topology?.vlans || []).map((vlan) => `<button type="button" class="tree-node tree-vlan" data-tree-type="vlan" data-tree-id="${vlan.id}"><i style="--tree-color:${escapeAttribute(vlan.colorHex)}"></i><span><b>VLAN ${vlan.id}</b><small>${escapeHTML(vlan.name)}</small></span></button>`).join("");
  container.innerHTML = `<div class="tree-group">${rackRows}${freeDevices.length ? `<details open><summary><span>FREE CANVAS</span><small>${freeDevices.length} DEVICES</small></summary>${freeDevices.map(deviceRow).join("")}</details>` : ""}</div><details class="tree-vlans" open><summary><span>VLAN NETWORKS</span><small>${topology?.vlans?.length || 0}</small></summary>${vlanRows}</details>`;
  container.querySelectorAll("[data-tree-type]").forEach((button) => button.addEventListener("click", () => onSelect(button.dataset.treeType, button.dataset.treeId)));
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

function escapeAttribute(value) { return escapeHTML(value); }
