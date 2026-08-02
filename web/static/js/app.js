import { api, APIError } from "./api.js";
import { AppState, findPort } from "./state.js";
import { CanvasEngine } from "./canvas.js";
import { TopologyEvents } from "./sse.js";
import { exportJSON, exportPNG, exportSVG } from "./export.js";
import { hardwareCatalog, catalogVendors, modelsForVendor, instantiateProfile, registerProfiles } from "./catalog.js";

const state = new AppState();
const elements = Object.fromEntries([
  "topology-select", "connection-status", "topology-name", "device-count", "link-count", "vlan-count",
  "vlan-palette", "analysis-count", "analysis-list", "inspector-empty", "inspector-content", "zoom-readout",
  "pointer-readout", "toast", "device-dialog", "device-form", "vlan-modal", "vlan-form", "vlan-manager-list",
  "trace-dialog", "trace-form", "import-file", "catalog-file",
].map((id) => [id, document.getElementById(id)]));

const canvas = new CanvasEngine(document.getElementById("diagram-canvas"), state, {
  onPointer: (point, zoom) => {
    elements["zoom-readout"].textContent = `${Math.round(zoom * 100)}%`;
    elements["pointer-readout"].textContent = `X ${Math.round(point.x).toString().padStart(4, "0")} · Y ${Math.round(point.y).toString().padStart(4, "0")}`;
  },
  onDeviceUpdate: (device) => updateFrom(() => api.updateDevice(state.topology.id, device), false),
  onLinkCreate: createLink,
  onLinkDelete: deleteLink,
});

const events = new TopologyEvents(
  (topology) => {
    if (topology.id === state.topology?.id) {
      state.setTopology(topology);
      queueAnalysis();
    }
  },
  (status) => setConnectionStatus(status),
);

let analysisTimer = 0;
let toastTimer = 0;

state.addEventListener("change", ({ detail }) => {
  if (detail.kind === "topology") renderTopology();
  if (detail.kind === "selection" || detail.kind === "topology") renderInspector();
  if (detail.kind === "analysis" || detail.kind === "topology") renderAnalysis();
});

bindControls();
setupHardwareCatalog();
initialize().catch(showError);

async function initialize() {
  const topologies = await api.listTopologies();
  fillTopologySelect(topologies);
  if (!topologies.length) {
    const created = await api.createTopology({ name: "Untitled topology", template: "demo" });
    await loadTopology(created.id);
    return;
  }
  await loadTopology(topologies[0].id);
  requestAnimationFrame(() => canvas.fit());
}

async function loadTopology(id) {
  events.close();
  setConnectionStatus("connecting");
  const topology = await api.getTopology(id);
  state.history = [];
  state.future = [];
  state.selection = null;
  state.setTrace([]);
  state.setTopology(topology);
  elements["topology-select"].value = id;
  events.connect(id);
  await refreshAnalysis();
}

function fillTopologySelect(topologies) {
  elements["topology-select"].replaceChildren(...topologies.map((topology) => {
    const option = document.createElement("option");
    option.value = topology.id;
    option.textContent = topology.name;
    return option;
  }));
}

function renderTopology() {
  const topology = state.topology;
  if (!topology) return;
  elements["topology-name"].textContent = topology.name;
  elements["device-count"].textContent = topology.devices.length;
  elements["link-count"].textContent = topology.links.length;
  elements["vlan-count"].textContent = topology.vlans.length;
  elements["vlan-palette"].replaceChildren(...topology.vlans.map((vlan) => {
    const row = document.createElement("div");
    row.className = "vlan-chip";
    row.style.setProperty("--vlan-color", vlan.colorHex);
    row.innerHTML = `<i></i><b>${vlan.id}</b><span>${escapeHTML(vlan.name)}</span>`;
    return row;
  }));
  renderVLANManager();
  fillTraceForm();
}

function renderAnalysis() {
  const analysis = state.analysis || { issues: [], loops: [] };
  const total = analysis.issues.length + analysis.loops.length;
  elements["analysis-count"].textContent = total ? `${total} ALERT${total === 1 ? "" : "S"}` : "NOMINAL";
  if (!total) {
    elements["analysis-list"].innerHTML = `<p class="analysis-ok">No native VLAN mismatches, tagged drops, or switching cycles detected.</p>`;
    return;
  }
  const items = [
    ...analysis.issues.map((issue) => `<div class="analysis-item"><b>${escapeHTML(issue.kind.replaceAll("_", " ").toUpperCase())}</b>${escapeHTML(issue.message)}</div>`),
    ...analysis.loops.map((loop) => `<div class="analysis-item"><b>VLAN ${loop.vlanId} LOOP</b>${loop.deviceIds.length} devices participate in a forwarding cycle.</div>`),
  ];
  elements["analysis-list"].innerHTML = items.join("");
}

function renderInspector() {
  const topology = state.topology;
  const selection = state.selection;
  elements["inspector-empty"].hidden = Boolean(selection);
  elements["inspector-content"].hidden = !selection;
  if (!topology || !selection) {
    elements["inspector-content"].replaceChildren();
    return;
  }
  if (selection.type === "port") renderPortInspector(selection.id);
  if (selection.type === "device") renderDeviceInspector(selection.id);
  if (selection.type === "link") renderLinkInspector(selection.id);
}

function renderPortInspector(portID) {
  const found = findPort(state.topology, portID);
  if (!found) return;
  const { device, port } = found;
  const vlanOptions = state.topology.vlans.map((vlan) => `<option value="${vlan.id}" ${vlan.id === port.nativeVlan ? "selected" : ""}>${vlan.id} · ${escapeHTML(vlan.name)}</option>`).join("");
  const checks = state.topology.vlans.map((vlan) => `<label class="check-row"><input type="checkbox" name="allowed" value="${vlan.id}" ${port.allowedVlans.includes(vlan.id) ? "checked" : ""}><i style="--vlan-color:${vlan.colorHex}"></i><b>${vlan.id}</b><span>${escapeHTML(vlan.name)}</span></label>`).join("");
  elements["inspector-content"].innerHTML = `
    <div class="inspector-title"><p class="eyebrow">PHYSICAL INTERFACE ${port.portIndex}</p><h3>${escapeHTML(device.name)} / ${escapeHTML(port.label)}</h3><p>${escapeHTML(port.type)} · ${port.speedMbps} Mbps ${port.isPoe ? "· PoE" : ""}</p></div>
    <form id="port-inspector-form" class="inspector-form">
      <label><span>PORT LABEL</span><input name="label" maxlength="80" value="${escapeHTML(port.label)}" required></label>
      <div><span>SWITCHPORT MODE</span><div class="radio-row">${["Access", "Trunk", "Unconfigured"].map((mode) => `<label><input type="radio" name="mode" value="${mode}" ${port.mode === mode ? "checked" : ""}><span>${mode.toUpperCase()}</span></label>`).join("")}</div></div>
      <label><span>NATIVE / UNTAGGED VLAN</span><select name="nativeVlan">${vlanOptions}</select></label>
      <div><span>TAGGED ALLOWED VLANS</span><div class="checklist">${checks}</div></div>
      <label><span>NEGOTIATED SPEED</span><select name="speedMbps">${[100, 1000, 10000, 25000, 100000].map((speed) => `<option value="${speed}" ${speed === port.speedMbps ? "selected" : ""}>${speed >= 1000 ? `${speed / 1000} Gbps` : `${speed} Mbps`}</option>`).join("")}</select></label>
      <label><span>LINK STATUS</span><select name="status"><option value="up" ${port.status === "up" ? "selected" : ""}>UP / ACTIVE</option><option value="down" ${port.status !== "up" ? "selected" : ""}>DOWN</option></select></label>
      <button class="primary">APPLY PORT CONFIG</button>
    </form>`;
  document.getElementById("port-inspector-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = structuredClone(port);
    next.label = String(form.get("label"));
    next.mode = String(form.get("mode"));
    next.nativeVlan = Number(form.get("nativeVlan"));
    next.allowedVlans = form.getAll("allowed").map(Number).filter((id) => id !== next.nativeVlan);
    next.speedMbps = Number(form.get("speedMbps"));
    next.status = String(form.get("status"));
    await updateFrom(() => api.updatePort(state.topology.id, next), true, "Port configuration applied");
  });
}

function renderDeviceInspector(deviceID) {
  const device = state.topology.devices.find((item) => item.id === deviceID);
  if (!device) return;
  const connected = state.topology.links.filter((link) => link.sourceDeviceId === device.id || link.targetDeviceId === device.id).length;
  elements["inspector-content"].innerHTML = `
    <div class="inspector-title"><p class="eyebrow">RACK HARDWARE</p><h3>${escapeHTML(device.name)}</h3><p>${escapeHTML(device.category)} · ${escapeHTML(device.model)}</p></div>
    <div class="metric-grid"><span>HEIGHT<b>${device.faceplate.unitsU}U</b></span><span>PORTS<b>${device.ports.length}</b></span><span>PATCHED<b>${connected}</b></span><span>POSITION<b>${Math.round(device.positionX)}, ${Math.round(device.positionY)}</b></span></div>
    <form id="device-inspector-form" class="inspector-form">
      <label><span>DEVICE NAME</span><input name="name" maxlength="120" value="${escapeHTML(device.name)}" required></label>
      <label><span>MODEL</span><input name="model" maxlength="120" value="${escapeHTML(device.model)}"></label>
      <div class="inspector-actions"><button class="primary">UPDATE IDENTITY</button><button id="delete-device" type="button" class="danger">DELETE</button></div>
    </form>`;
  document.getElementById("device-inspector-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = structuredClone(device);
    next.name = String(form.get("name")); next.model = String(form.get("model"));
    await updateFrom(() => api.updateDevice(state.topology.id, next), true, "Device identity updated");
  });
  document.getElementById("delete-device").addEventListener("click", () => deleteDevice(device));
}

function renderLinkInspector(linkID) {
  const link = state.topology.links.find((item) => item.id === linkID);
  if (!link) return;
  const source = findPort(state.topology, link.sourcePortId);
  const target = findPort(state.topology, link.targetPortId);
  const issueCount = state.analysis.issues.filter((issue) => issue.linkId === link.id).length;
  elements["inspector-content"].innerHTML = `
    <div class="inspector-title"><p class="eyebrow">PHYSICAL PATCH</p><h3>${escapeHTML(link.cableType)}</h3><p>${escapeHTML(source?.device.name || "Unknown")} → ${escapeHTML(target?.device.name || "Unknown")}</p></div>
    <div class="metric-grid"><span>SOURCE<b>${escapeHTML(source?.port.label || "—")}</b></span><span>TARGET<b>${escapeHTML(target?.port.label || "—")}</b></span><span>PRIMARY VLAN<b>${link.primaryVlan || 1}</b></span><span>RULE ALERTS<b>${issueCount}</b></span></div>
    <label><span>VLAN CHANNELS</span><div class="checklist">${(link.vlanIds || []).map((id) => { const vlan = state.topology.vlans.find((item) => item.id === id); return `<div class="check-row"><span></span><i style="--vlan-color:${vlan?.colorHex || "#75888b"}"></i><b>${id}</b><span>${escapeHTML(vlan?.name || "Unknown")}</span></div>`; }).join("")}</div></label>
    <div class="inspector-actions"><button id="focus-link" class="secondary">FOCUS PATH</button><button id="delete-link" class="danger">UNPATCH</button></div>`;
  document.getElementById("focus-link").addEventListener("click", () => state.setTrace([link.id]));
  document.getElementById("delete-link").addEventListener("click", () => deleteLink(link));
}

function bindControls() {
  elements["topology-select"].addEventListener("change", (event) => loadTopology(event.target.value).catch(showError));
  document.getElementById("fit-button").addEventListener("click", () => canvas.fit());
  document.getElementById("add-device-button").addEventListener("click", () => elements["device-dialog"].showModal());
  document.getElementById("vlan-button").addEventListener("click", () => elements["vlan-modal"].showModal());
  document.getElementById("trace-button").addEventListener("click", () => elements["trace-dialog"].showModal());
  document.getElementById("undo-button").addEventListener("click", () => undo());
  document.getElementById("redo-button").addEventListener("click", () => redo());
  document.getElementById("png-button").addEventListener("click", () => exportPNG(state.topology, canvas));
  document.getElementById("svg-button").addEventListener("click", () => exportSVG(state.topology, canvas));
  document.getElementById("json-button").addEventListener("click", () => exportJSON(state.topology));
  document.getElementById("import-button").addEventListener("click", () => elements["import-file"].click());
	document.getElementById("catalog-import-button").addEventListener("click", () => elements["catalog-file"].click());
  elements["import-file"].addEventListener("change", importBackup);
	elements["catalog-file"].addEventListener("change", importCatalog);
  document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => document.getElementById(button.dataset.close).close()));
  elements["device-form"].addEventListener("submit", installDevice);
  elements["vlan-form"].addEventListener("submit", saveVLAN);
  elements["trace-form"].addEventListener("submit", tracePath);
  window.addEventListener("keydown", keyboardShortcuts);
}

async function installDevice(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const index = state.topology.devices.length;
	const profile = hardwareCatalog.find((candidate) => candidate.vendor === form.get("vendor") && candidate.model === form.get("model"));
	if (!profile) throw new Error("Select a hardware catalog profile");
	const device = instantiateProfile(profile, String(form.get("name")), {
		x: 100 + (index % 2) * 730,
		y: 100 + Math.floor(index / 2) * (profile.units * 100 + 50),
	});
	device.faceplate.vendorColor = String(form.get("color"));
  await updateFrom(() => api.createDevice(state.topology.id, device), true, "Device installed");
  elements["device-dialog"].close();
}

function setupHardwareCatalog(preferredVendor = "Cisco") {
	const form = elements["device-form"];
	const vendorSelect = form.elements.vendor;
	const previous = catalogVendors().includes(preferredVendor) ? preferredVendor : catalogVendors()[0];
	vendorSelect.replaceChildren(...catalogVendors().map((vendor) => new Option(vendor, vendor)));
	vendorSelect.value = previous;
	vendorSelect.onchange = () => fillHardwareModels(vendorSelect.value);
	form.elements.model.onchange = updateHardwareSummary;
	fillHardwareModels(previous);
}

function fillHardwareModels(vendor) {
	const select = elements["device-form"].elements.model;
	const profiles = modelsForVendor(vendor);
	select.replaceChildren(...profiles.map((profile) => new Option(profile.model, profile.model)));
	updateHardwareSummary();
}

function updateHardwareSummary() {
	const form = elements["device-form"];
	const profile = hardwareCatalog.find((candidate) => candidate.vendor === form.elements.vendor.value && candidate.model === form.elements.model.value);
	if (!profile) return;
	const ports = profile.groups.reduce((sum, group) => sum + group.count, 0);
	const media = profile.groups.map((group) => `${group.count}× ${group.type.replaceAll("_", " ")}`).join(" · ");
	document.getElementById("catalog-profile-summary").textContent = `${profile.category.toUpperCase()} · ${profile.units}U · ${ports} INTERFACES — ${media}`;
	form.elements.color.value = profile.color;
	form.elements.name.value = profile.model;
}

async function importCatalog(event) {
	const file = event.target.files?.[0];
	event.target.value = "";
	if (!file) return;
	try {
		const profiles = JSON.parse(await file.text());
		const count = registerProfiles(profiles);
		setupHardwareCatalog(profiles[0]?.vendor);
		toast(`${count} hardware profile${count === 1 ? "" : "s"} imported`);
	} catch (error) { showError(error); }
}

async function createLink(sourceBox, targetBox) {
  const sourceVLANs = carriedVLANs(sourceBox.port);
  const targetVLANs = carriedVLANs(targetBox.port);
  const shared = [...sourceVLANs].filter((id) => targetVLANs.has(id));
  const primary = shared[0] || sourceBox.port.nativeVlan || targetBox.port.nativeVlan || 1;
  const link = {
    id: "", sourceDeviceId: sourceBox.device.id, sourcePortId: sourceBox.port.id,
    targetDeviceId: targetBox.device.id, targetPortId: targetBox.port.id,
    cableType: sourceBox.port.type.includes("SFP") || targetBox.port.type.includes("SFP") ? "FIBER" : "CAT6A",
    vlanIds: shared.length ? shared : [primary], primaryVlan: primary, notes: "",
  };
  await updateFrom(() => api.createLink(state.topology.id, link), true, "Cable patched");
}

async function deleteLink(link) {
  if (!window.confirm("Disconnect this cable?")) return;
  await updateFrom(() => api.deleteLink(state.topology.id, link.id), true, "Cable disconnected");
  state.select(null, null);
}

async function deleteDevice(device) {
  if (!window.confirm(`Remove ${device.name} and all connected cables?`)) return;
  await updateFrom(() => api.deleteDevice(state.topology.id, device.id), true, "Device removed");
  state.select(null, null);
}

function renderVLANManager() {
  if (!state.topology) return;
  elements["vlan-manager-list"].replaceChildren(...state.topology.vlans.map((vlan) => {
    const row = document.createElement("div");
    row.className = "vlan-manager-row";
    row.style.setProperty("--vlan-color", vlan.colorHex);
    row.innerHTML = `<i></i><b>${vlan.id}</b><span>${escapeHTML(vlan.name)}</span><button type="button" class="${vlan.id === 1 ? "secondary" : "danger"}">${vlan.id === 1 ? "EDIT" : "DELETE"}</button>`;
    row.addEventListener("click", (event) => {
      if (event.target instanceof HTMLButtonElement && vlan.id !== 1) {
        event.stopPropagation();
        if (window.confirm(`Delete VLAN ${vlan.id}? Affected native ports will move to VLAN 1.`)) updateFrom(() => api.deleteVLAN(state.topology.id, vlan.id), true, "VLAN removed");
        return;
      }
      editVLAN(vlan);
    });
    return row;
  }));
}

function editVLAN(vlan) {
  const form = elements["vlan-form"];
  form.dataset.editId = String(vlan.id);
  form.elements.id.value = vlan.id;
  form.elements.id.readOnly = true;
  form.elements.name.value = vlan.name;
  form.elements.colorHex.value = vlan.colorHex;
  form.elements.description.value = vlan.description;
  form.querySelector("button").textContent = "UPDATE NETWORK";
}

async function saveVLAN(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const vlan = { id: Number(data.get("id")), name: String(data.get("name")), colorHex: String(data.get("colorHex")), description: String(data.get("description")) };
  const isEditing = Boolean(form.dataset.editId);
  await updateFrom(() => isEditing ? api.updateVLAN(state.topology.id, vlan) : api.createVLAN(state.topology.id, vlan), true, isEditing ? "VLAN updated" : "VLAN added");
  form.reset(); form.elements.id.readOnly = false; form.elements.colorHex.value = "#42d9c8"; delete form.dataset.editId;
  form.querySelector("button").textContent = "ADD NETWORK";
}

function fillTraceForm() {
  if (!state.topology) return;
  const ports = state.topology.devices.flatMap((device) => device.ports.map((port) => ({ value: port.id, text: `${device.name} / ${port.label}` })));
  for (const name of ["source", "target"]) {
    const select = elements["trace-form"].elements[name];
    const previous = select.value;
    select.replaceChildren(...ports.map((port) => new Option(port.text, port.value)));
    if (ports.some((port) => port.value === previous)) select.value = previous;
  }
  const vlanSelect = elements["trace-form"].elements.vlan;
  vlanSelect.replaceChildren(...state.topology.vlans.map((vlan) => new Option(`${vlan.id} · ${vlan.name}`, vlan.id)));
}

async function tracePath(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    const result = await api.trace(state.topology.id, String(form.get("source")), String(form.get("target")), Number(form.get("vlan")));
    state.setTrace(result.linkIds);
    elements["trace-dialog"].close();
    toast(`${result.linkIds.length} cable segment${result.linkIds.length === 1 ? "" : "s"} highlighted`);
  } catch (error) { showError(error); }
}

async function refreshAnalysis() {
  if (!state.topology) return;
  state.setAnalysis(await api.analysis(state.topology.id));
}

function queueAnalysis() {
  clearTimeout(analysisTimer);
  analysisTimer = setTimeout(() => refreshAnalysis().catch(showError), 180);
}

async function updateFrom(operation, remember = true, message = "") {
  try {
    const topology = await operation();
    state.setTopology(topology, { remember });
    queueAnalysis();
    if (message) toast(message);
    return topology;
  } catch (error) {
    showError(error);
    if (state.topology) state.setTopology(await api.getTopology(state.topology.id));
    return null;
  }
}

async function undo() {
  if (!state.undo()) return;
  await updateFrom(() => api.replaceTopology(state.topology), false, "Undo applied");
}

async function redo() {
  if (!state.redo()) return;
  await updateFrom(() => api.replaceTopology(state.topology), false, "Redo applied");
}

async function importBackup(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file || !state.topology) return;
  try {
    const topology = JSON.parse(await file.text());
    if (!Array.isArray(topology.devices) || !Array.isArray(topology.links) || !Array.isArray(topology.vlans)) throw new Error("The selected file is not a topology backup");
    topology.id = state.topology.id;
    topology.createdAt = state.topology.createdAt;
    await updateFrom(() => api.replaceTopology(topology), true, "Backup restored");
    canvas.fit();
  } catch (error) { showError(error); }
}

function keyboardShortcuts(event) {
  if (event.defaultPrevented || isFormField(event.target)) return;
  const key = event.key.toLowerCase();
  if ((event.ctrlKey || event.metaKey) && key === "z") { event.preventDefault(); event.shiftKey ? redo() : undo(); }
  if ((event.ctrlKey || event.metaKey) && key === "y") { event.preventDefault(); redo(); }
  if ((event.ctrlKey || event.metaKey) && key === "s") { event.preventDefault(); updateFrom(() => api.replaceTopology(state.topology), false, "Topology saved"); }
  if (event.key === "Delete" || event.key === "Backspace") {
    if (state.selection?.type === "link") deleteLink(state.topology.links.find((link) => link.id === state.selection.id));
    if (state.selection?.type === "device") deleteDevice(state.topology.devices.find((device) => device.id === state.selection.id));
  }
}

function setConnectionStatus(status) {
  elements["connection-status"].dataset.state = status;
  elements["connection-status"].querySelector("b").textContent = status === "online" ? "LIVE SYNC" : status === "offline" ? "RETRYING" : "SYNCING";
}

function carriedVLANs(port) {
  if (port.mode === "Unconfigured") return new Set();
  return new Set([port.nativeVlan, ...(port.allowedVlans || [])].filter(Boolean));
}

function toast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.dataset.visible = "true";
  toastTimer = setTimeout(() => { elements.toast.dataset.visible = "false"; }, 2600);
}

function showError(error) {
  console.error(error);
  const message = error instanceof APIError ? error.message : error?.message || "Unexpected error";
  toast(`ERROR · ${message}`);
}

function isFormField(target) {
  return target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement || target instanceof HTMLButtonElement;
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}
