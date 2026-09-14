/** Render selectable inventory rows, applying colors through the CSP-safe DOM API. */
export function renderTopologyTree(container, topology, selection, onSelect, query = "") {
  const mapID = topology?.id || "";
  const changedMap = container.dataset.mapId !== mapID;
  if (changedMap) {
    container.treeExpansion = new Map();
    container.dataset.mapId = mapID;
  }
  const expansion = container.treeExpansion ||= new Map();
  if (!changedMap && !container.dataset.searching) {
    container.querySelectorAll("details[data-tree-key]").forEach((node) => expansion.set(node.dataset.treeKey, node.open));
  }
  const searching = Boolean(query.trim());
  container.dataset.searching = searching ? "true" : "";
  const devices = searchInstalledDevices(topology, query);
  const racks = topology?.racks || [];
  const rackDevices = new Map(racks.map((rack) => [rack.id, []]));
  const freeDevices = [];
  for (const device of devices) {
    if (device.rackId && rackDevices.has(device.rackId)) rackDevices.get(device.rackId).push(device);
    else freeDevices.push(device);
  }
  const deviceRow = (device) => `<button type="button" class="tree-node tree-device ${selection?.type === "device" && selection.id === device.id ? "is-selected" : ""}" data-tree-type="device" data-tree-id="${escapeAttribute(device.id)}"><i></i><span><b>${escapeHTML(device.name)}</b><small>${device.hostname ? `${escapeHTML(device.hostname)} · ` : ""}${escapeHTML(device.model)} · ${device.ports.length} PORTS</small></span></button>`;
  const rackRows = racks.map((rack) => `<details open><summary><span>${escapeHTML(rack.name)}</span><small>${rackDevices.get(rack.id).length} DEVICES</small></summary>${rackDevices.get(rack.id).map(deviceRow).join("")}</details>`).join("");
  const vlanRows = (topology?.vlans || []).map((vlan) => `<button type="button" class="tree-node tree-vlan" data-tree-type="vlan" data-tree-id="${vlan.id}"><i></i><span><b>VLAN ${vlan.id}</b><small>${escapeHTML(vlan.name)}</small></span></button>`).join("");
  container.innerHTML = `<div class="tree-group">${rackRows}${freeDevices.length ? `<details open><summary><span>FREE CANVAS</span><small>${freeDevices.length} DEVICES</small></summary>${freeDevices.map(deviceRow).join("")}</details>` : ""}</div><details class="tree-vlans" open><summary><span>VLAN NETWORKS</span><small>${topology?.vlans?.length || 0}</small></summary>${vlanRows}</details>`;
  const vlanColors = new Map((topology?.vlans || []).map((vlan) => [String(vlan.id), vlan.colorHex]));
  container.querySelectorAll("details").forEach((node, index) => {
    const key = index < racks.length ? `rack:${racks[index].id}` : node.classList.contains("tree-vlans") ? "vlans" : "free";
    node.dataset.treeKey = key;
    node.open = searching || expansion.get(key) !== false;
    if (searching) node.hidden = key === "vlans" || !node.querySelector("[data-tree-type='device']");
  });
  if (searching && !devices.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No equipment matches your search.";
    container.append(empty);
  }
  container.querySelectorAll("[data-tree-type]").forEach((button) => {
    if (button.dataset.treeType === "vlan") button.style.setProperty("--tree-color", vlanColors.get(button.dataset.treeId));
    button.addEventListener("click", () => onSelect(button.dataset.treeType, button.dataset.treeId));
  });
}

/** Match every search term against installed inventory, independent of the hardware catalog. */
export function searchInstalledDevices(topology, query = "") {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return (topology?.devices || []).filter((device) => {
    const text = [device.name, device.hostname, device.managementIp, device.serialNumber, device.assetTag, device.model]
      .filter(Boolean).join(" ").toLocaleLowerCase();
    return terms.every((term) => text.includes(term));
  });
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

function escapeAttribute(value) { return escapeHTML(value); }
