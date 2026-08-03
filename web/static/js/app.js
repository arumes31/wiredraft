import { api, APIError } from "./api.js";
import { AppState, findPort } from "./state.js";
import { CanvasEngine } from "./canvas.js";
import { nextCanvasTool } from "./canvas-interactions.js";
import {
  GRAPHICS_STORAGE_KEY, GraphicsMode, graphicsProfileSummary, normalizeGraphicsMode,
} from "./graphics-quality.js";
import {
  TopologyCollaboration, absoluteShareURL, isRevisionConflict, validateDocumentationURL,
} from "./collaboration.js";
import {
  ServerCardTypes, defaultServerCards, instantiateGenericServerBack, serverCardType, serverSlotCapacity,
} from "./server-cards.js";
import {
  instantiatePatchPanel, patchPanelDevices, planPatchPanelMapping,
} from "./patch-panels.js";
import { usedRackUnits } from "./rack.js";
import { defaultGroupInput, groupForLink, planLinkGroup } from "./link-groups.js";
import { describeLinkGroupMembers } from "./link-group-display.js";
import {
  defaultLinkConfiguration, isLinkConfigurationScopeSynchronized, linkConfigurationScope, normalizeLinkConfiguration,
} from "./link-configuration.js";
import {
  FirewallClusterModes, buildFirewallCluster, firewallClusterCandidates, firewallClusterForDevice,
  firewallClusterModeLabel, firewallClusterRole,
} from "./firewall-clusters.js";
import {
  SwitchSystemModes, buildSwitchSystem, logicalDeviceCount, switchSystemCandidates,
  switchSystemForDevice, switchSystemModeLabel,
} from "./switch-systems.js";
import { AutosaveController } from "./autosave.js";
import { ToastQueue } from "./toast-queue.js";
import { topologySize, topologySizeMessage } from "./topology-size.js";
import { TopologyMinimap } from "./minimap.js";
import { renderTopologyTree } from "./topology-tree.js";

const state = new AppState();
api.setRevisionProvider(() => state.topology?.revision);
const cableMediaTypes = ["CAT5E", "CAT6", "CAT6A", "FIBER", "SMF", "MMF", "DAC", "AOC", "TWINAX"];
const elements = Object.fromEntries([
  "topology-select", "connection-status", "topology-name", "rack-count", "device-count", "physical-device-count", "link-count", "vlan-count",
  "workspace", "selection-inspector", "vlan-palette", "analysis-count", "analysis-list", "inspector-empty", "inspector-content", "zoom-readout",
  "pointer-readout", "toast", "device-dialog", "device-form", "vlan-modal", "vlan-form", "vlan-manager-list",
  "trace-dialog", "trace-form", "rack-dialog", "rack-form", "static-server-dialog", "static-server-form",
  "server-card-list", "server-card-count", "server-back-preview", "install-server-button",
  "patch-panel-dialog", "patch-panel-form", "patch-panel-map-dialog", "patch-panel-map-form",
  "patch-map-target-end", "patch-map-count", "patch-map-pairs", "patch-map-error", "create-patch-map-button",
  "link-group-dialog", "link-group-form", "link-group-summary", "switch-system-dialog", "switch-system-form",
  "switch-system-members", "switch-system-member-count", "firewall-cluster-dialog", "firewall-cluster-form",
  "firewall-cluster-members", "firewall-cluster-member-count", "import-file", "catalog-file",
  "graphics-quality", "graphics-quality-detail", "export-menu",
  "autosave-menu", "autosave-enabled", "autosave-interval", "save-state-label", "loading-skeleton",
  "topology-tree", "topology-size-warning", "topology-minimap", "annotation-dialog", "annotation-form",
  "collaboration-dialog", "comments-list", "comment-form", "documentation-list", "documentation-form", "documentation-preview",
  "share-list", "share-form", "collaboration-target",
].map((id) => [id, document.getElementById(id)]));

const canvas = new CanvasEngine(document.getElementById("diagram-canvas"), state, {
  onPointer: (point, zoom) => {
    elements["zoom-readout"].textContent = `${Math.round(zoom * 100)}%`;
    elements["pointer-readout"].textContent = `X ${Math.round(point.x).toString().padStart(4, "0")} · Y ${Math.round(point.y).toString().padStart(4, "0")}`;
  },
  onDeviceUpdate: (device) => updateFrom(() => api.updateDevice(state.topology.id, device), false),
  onRackUpdate: (rack) => updateFrom(() => api.updateRack(state.topology.id, rack), false),
  onLinkCreate: createLink,
  onLinkDelete: deleteLink,
  onLinkGroupRequest: openLinkGroupDialog,
  onViewChange: () => minimap?.draw(),
  onAnnotationCreate: createAnnotation,
  onAnnotationTextRequest: openTextAnnotationDialog,
  onToolChange: renderCanvasToolState,
}, { graphicsMode: loadGraphicsMode() });

const notifications = new ToastQueue(elements.toast);
const minimap = new TopologyMinimap(elements["topology-minimap"], canvas, state);
const autosave = new AutosaveController(async () => {
  if (!state.topology) return;
  try {
    const topology = await api.replaceTopology(state.topology);
    state.setTopology(topology);
  } catch (error) {
    if (isRevisionConflict(error)) {
      state.setTopology(await api.getTopology(state.topology.id));
      notifications.push("SAVE CONFLICT · Loaded the newer shared revision", "error");
    }
    throw error;
  }
}, { storage: globalThis.localStorage });
let pendingAnnotationPoint = null;
let catalogModulePromise = null;
let catalogModule = null;
let exportModulePromise = null;
let analysisUIModulePromise = null;
let shareEntries = [];
let createdShareURL = "";

let pendingServerCards = [];
let serverCardSequence = 0;

const events = new TopologyCollaboration({
  onTopology: (topology) => {
    if (topology.id === state.topology?.id) {
      state.setTopology(topology);
      queueAnalysis();
    }
  },
  onStatus: (status) => setConnectionStatus(status),
  onRevisionGap: () => state.topology && loadTopology(state.topology.id).catch(showError),
});

let analysisTimer = 0;
let lastSizeSignature = "";

state.addEventListener("change", ({ detail }) => {
  if (detail.kind === "topology") renderTopology();
  if (detail.kind === "selection" || detail.kind === "topology") {
    renderInspector();
    renderNavigator();
  }
  if (detail.kind === "analysis" || detail.kind === "topology") renderAnalysis();
  if (detail.kind === "topology" && elements["collaboration-dialog"]?.open) renderCollaboration();
});
autosave.addEventListener("status", ({ detail }) => {
  renderSaveStatus(detail);
  if (detail.error && !isRevisionConflict(detail.error)) showError(detail.error);
});

bindControls();
initialize().catch(showError);

async function initialize() {
  elements["loading-skeleton"].hidden = false;
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
  elements["loading-skeleton"].hidden = false;
  events.close();
  setConnectionStatus("connecting");
  let topology = await api.getTopology(id);
  state.history = [];
  state.future = [];
  state.selection = null;
  state.setTrace([]);
  state.setTopology(topology);
  autosave.markSaved();
  elements["topology-select"].value = id;
  events.connect(topology);
  await refreshAnalysis();
  elements["loading-skeleton"].hidden = true;
  minimap.draw();
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
  elements["rack-count"].textContent = (topology.racks || []).length;
  const logicalCount = logicalDeviceCount(topology);
  elements["device-count"].textContent = logicalCount;
  elements["physical-device-count"].textContent = logicalCount === topology.devices.length ? "" : `${topology.devices.length} PHYS`;
  document.getElementById("device-count-stat").title = `${logicalCount} logical units · ${topology.devices.length} physical devices`;
  elements["link-count"].textContent = topology.links.length;
  elements["vlan-count"].textContent = topology.vlans.length;
  document.title = `${autosave.isDirty ? "● " : ""}${topology.name} · Netdiagram`;
  elements["vlan-palette"].replaceChildren(...topology.vlans.map((vlan) => {
    const row = document.createElement("div");
    row.className = "vlan-chip";
    row.style.setProperty("--vlan-color", vlan.colorHex);
    row.innerHTML = `<i></i><b>${vlan.id}</b><span>${escapeHTML(vlan.name)}</span>`;
    return row;
  }));
  renderVLANManager();
  fillTraceForm();
  refreshPatchPanelControls();
  renderTopologySize();
  minimap.draw();
  renderGraphicsQuality();
}

function renderNavigator() {
  if (!state.topology) return;
  renderTopologyTree(elements["topology-tree"], state.topology, state.selection, (type, id) => {
    if (type === "device") {
      state.select("device", id);
      canvas.focusDevice(id);
      return;
    }
    if (type === "vlan") {
      const related = state.topology.links.filter((link) => (link.vlanIds || []).includes(Number(id))).map((link) => link.id);
      state.setTrace(related);
      toast(`${related.length} VLAN ${id} cable${related.length === 1 ? "" : "s"} highlighted`);
    }
  });
}

function renderTopologySize() {
  const signature = `${state.topology.devices.length}:${state.topology.links.length}:${state.topology.devices.reduce((sum, device) => sum + device.ports.length, 0)}:${state.topology.annotations?.length || 0}`;
  if (signature === lastSizeSignature) return;
  lastSizeSignature = signature;
  const size = topologySize(state.topology);
  const message = topologySizeMessage(size);
  elements["topology-size-warning"].hidden = !message;
  elements["topology-size-warning"].dataset.level = size.level;
  elements["topology-size-warning"].textContent = message;
}

function renderSaveStatus(status = autosave) {
  const stateName = status.isSaving ? "saving" : status.isDirty ? "dirty" : "saved";
  elements["autosave-menu"].dataset.state = stateName;
  elements["save-state-label"].textContent = stateName.toUpperCase();
  elements["autosave-menu"].querySelector("small").textContent = status.enabled ? `AUTO · ${status.intervalSeconds}s` : "AUTOSAVE OFF";
  elements["autosave-enabled"].checked = status.enabled;
  elements["autosave-interval"].value = String(status.intervalSeconds);
  if (state.topology) document.title = `${status.isDirty ? "● " : ""}${state.topology.name} · Netdiagram`;
}

function loadGraphicsMode() {
  try {
    return normalizeGraphicsMode(localStorage.getItem(GRAPHICS_STORAGE_KEY));
  } catch {
    return GraphicsMode.AUTO;
  }
}

function renderGraphicsQuality() {
  const profile = canvas.graphicsProfile();
  elements["graphics-quality"].value = canvas.graphicsMode;
  elements["graphics-quality-detail"].textContent = graphicsProfileSummary(profile);
  elements["graphics-quality-detail"].dataset.mode = profile.resolvedMode;
}

async function renderAnalysis() {
  analysisUIModulePromise ||= import("./analysis-ui.js");
  const { analysisView } = await analysisUIModulePromise;
  const view = analysisView(state.analysis);
  elements["analysis-count"].textContent = view.countText;
  elements["analysis-list"].innerHTML = view.markup;
}

function renderInspector() {
  const topology = state.topology;
  const selection = state.selection;
  const inspectorVisible = Boolean(topology && selection);
  elements.workspace.classList.toggle("inspector-collapsed", !inspectorVisible);
  elements["selection-inspector"].hidden = !inspectorVisible;
  elements["inspector-empty"].hidden = Boolean(selection);
  elements["inspector-content"].hidden = !selection;
  if (!topology || !selection) {
    elements["inspector-content"].replaceChildren();
    return;
  }
  if (selection.type === "port") renderPortInspector(selection.id);
  if (selection.type === "rack") renderRackInspector(selection.id);
  if (selection.type === "device") renderDeviceInspector(selection.id);
  if (selection.type === "link") renderLinkInspector(selection.id);
  if (selection.type === "annotation") renderAnnotationInspector(selection.id);
  renderDocumentationInspector(selection);
}

function renderAnnotationInspector(annotationID) {
  const annotation = (state.topology.annotations || []).find((item) => item.id === annotationID);
  if (!annotation) return;
  const typeLabel = annotation.type === "text" ? "TEXT NOTE" : annotation.type === "arrow" ? "ARROW" : "RECTANGLE";
  elements["inspector-content"].innerHTML = `
    <div class="inspector-title"><p class="eyebrow">CANVAS ANNOTATION</p><h3>${typeLabel}</h3><p>${Math.round(annotation.x1)}, ${Math.round(annotation.y1)} → ${Math.round(annotation.x2)}, ${Math.round(annotation.y2)}</p></div>
    <form id="annotation-inspector-form" class="inspector-form">
      ${annotation.type === "text" ? `<label><span>NOTE TEXT</span><textarea name="text" maxlength="500" rows="4" required>${escapeHTML(annotation.text)}</textarea></label>` : ""}
      <label><span>ANNOTATION COLOR</span><input name="color" type="color" value="${escapeHTML(annotation.color || "#f0b35a")}"></label>
      <p class="annotation-help"><b>SELECTED ON CANVAS</b>Press <kbd>DELETE</kbd> to remove. Press <kbd>ESC</kbd> to leave any drawing tool.</p>
      <div class="inspector-actions"><button class="primary">UPDATE ANNOTATION</button><button id="delete-annotation" type="button" class="danger">DELETE</button></div>
    </form>`;
  document.getElementById("annotation-inspector-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    state.commit((topology) => {
      const next = (topology.annotations || []).find((item) => item.id === annotation.id);
      if (!next) return;
      next.color = String(form.get("color"));
      if (next.type === "text") next.text = String(form.get("text")).trim();
    });
    autosave.markDirty();
    toast("Annotation updated");
  });
  document.getElementById("delete-annotation").addEventListener("click", () => deleteAnnotation(annotation));
}

function renderDocumentationInspector(selection) {
  const links = (state.topology.documentationLinks || []).filter((item) =>
    (item.targetKind === selection.type && item.targetId === selection.id)
    || (item.targetKind === "topology" && item.targetId === state.topology.id));
  if (!links.length) return;
  const section = document.createElement("section");
  section.className = "inspector-documents";
  section.innerHTML = `<div class="section-heading"><h3>DOCUMENTATION</h3><span>${links.length} LINK${links.length === 1 ? "" : "S"}</span></div>
    ${links.map((item) => `<a href="${escapeHTML(item.url)}" target="_blank" rel="noopener noreferrer"><span>${escapeHTML(item.label)}</span><b>OPEN ↗</b></a>`).join("")}`;
  elements["inspector-content"].append(section);
}

function renderRackInspector(rackID) {
  const rack = (state.topology.racks || []).find((item) => item.id === rackID);
  if (!rack) return;
  const used = usedRackUnits(state.topology, rack.id);
  const devices = state.topology.devices.filter((device) => device.rackId === rack.id).length;
  elements["inspector-content"].innerHTML = `
    <div class="inspector-title"><p class="eyebrow">RACK ENCLOSURE</p><h3>${escapeHTML(rack.name)}</h3><p>WHOLE-U FRONT RAIL · ${rack.heightU}U</p></div>
    <div class="metric-grid"><span>CAPACITY<b>${rack.heightU}U</b></span><span>OCCUPIED<b>${used}U</b></span><span>FREE<b>${rack.heightU - used}U</b></span><span>DEVICES<b>${devices}</b></span></div>
    <form id="rack-inspector-form" class="inspector-form">
      <label><span>RACK NAME</span><input name="name" maxlength="120" value="${escapeHTML(rack.name)}" required></label>
      <label><span>RACK HEIGHT</span><input name="heightU" type="number" min="6" max="48" value="${rack.heightU}" required></label>
      <label><span>FRAME COLOR</span><input name="color" type="color" value="${rack.color}"></label>
      <div class="inspector-actions"><button class="primary">UPDATE RACK</button><button id="delete-rack" type="button" class="danger">DELETE</button></div>
    </form>`;
  document.getElementById("rack-inspector-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = structuredClone(rack);
    next.name = String(form.get("name"));
    next.heightU = Number(form.get("heightU"));
    next.color = String(form.get("color"));
    await updateFrom(() => api.updateRack(state.topology.id, next), true, "Rack updated");
  });
  document.getElementById("delete-rack").addEventListener("click", () => deleteRack(rack));
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
      <label><span>INSTALLED MEDIA / TRANSCEIVER</span><select name="mediaType">${mediaTypeOptions(port.mediaType)}</select></label>
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
    next.mediaType = String(form.get("mediaType"));
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
  const rack = (state.topology.racks || []).find((item) => item.id === device.rackId);
  const location = rack ? `${rack.name} · U${device.rackUnit}` : `${Math.round(device.positionX)}, ${Math.round(device.positionY)}`;
  const system = switchSystemForDevice(state.topology, device.id);
  const cluster = firewallClusterForDevice(state.topology, device.id);
  const switchSystemMarkup = device.category === "Switch" ? renderSwitchSystemInspector(device, system) : "";
  const firewallClusterMarkup = device.category === "Firewall" ? renderFirewallClusterInspector(device, cluster) : "";
  const inventoryLocation = device.location || {};
  const locationRack = inventoryLocation.rack || rack?.name || "";
  const locationRackUnit = inventoryLocation.rackUnit || device.rackUnit || "";
  const spanningTreeMarkup = device.category === "Switch" ? `
      <fieldset class="device-metadata-block"><legend>SPANNING TREE BRIDGE</legend>
        <label><span>BRIDGE PRIORITY</span><select name="stpPriority">${stpPriorityOptions(device.stpPriority)}</select></label>
        <p>Lower priority wins root election. Stack / VSF / MC-LAG peers are simulated as one logical bridge.</p>
      </fieldset>` : "";
  elements["inspector-content"].innerHTML = `
    <div class="inspector-title"><p class="eyebrow">RACK HARDWARE</p><h3>${escapeHTML(device.name)}</h3><p>${escapeHTML(device.category)} · ${escapeHTML(device.model)}</p></div>
    <div class="metric-grid"><span>HEIGHT<b>${device.faceplate.unitsU}U</b></span><span>PORTS<b>${device.ports.length}</b></span><span>PATCHED<b>${connected}</b></span><span>LOCATION<b>${escapeHTML(location)}</b></span></div>
    <form id="device-inspector-form" class="inspector-form">
      <fieldset class="device-metadata-block"><legend>IDENTITY</legend>
        <label><span>DISPLAY NAME</span><input name="name" maxlength="120" value="${escapeHTML(device.name)}" required></label>
        <label><span>MODEL</span><input name="model" maxlength="120" value="${escapeHTML(device.model)}"></label>
        <label><span>HOSTNAME</span><input name="hostname" maxlength="253" value="${escapeHTML(device.hostname || "")}" placeholder="core-sw-01.example.net"></label>
        <label><span>MANAGEMENT IP</span><input name="managementIp" value="${escapeHTML(device.managementIp || "")}" placeholder="192.0.2.10 or 2001:db8::10"></label>
      </fieldset>
      <fieldset class="device-metadata-block"><legend>ASSET RECORD</legend>
        <label><span>SERIAL NUMBER</span><input name="serialNumber" maxlength="120" value="${escapeHTML(device.serialNumber || "")}"></label>
        <label><span>ASSET / INVENTORY TAG</span><input name="assetTag" maxlength="120" value="${escapeHTML(device.assetTag || "")}"></label>
        <label><span>OWNER / RESPONSIBLE TEAM</span><input name="owner" maxlength="120" value="${escapeHTML(device.owner || "")}" placeholder="Network Operations"></label>
      </fieldset>
      <fieldset class="device-metadata-block"><legend>STRUCTURED LOCATION</legend>
        <div class="device-location-grid">
          <label><span>SITE</span><input name="locationSite" maxlength="120" value="${escapeHTML(inventoryLocation.site || "")}"></label>
          <label><span>BUILDING</span><input name="locationBuilding" maxlength="120" value="${escapeHTML(inventoryLocation.building || "")}"></label>
          <label><span>FLOOR</span><input name="locationFloor" maxlength="120" value="${escapeHTML(inventoryLocation.floor || "")}"></label>
          <label><span>ROOM</span><input name="locationRoom" maxlength="120" value="${escapeHTML(inventoryLocation.room || "")}"></label>
          <label><span>RACK</span><input name="locationRack" maxlength="120" value="${escapeHTML(locationRack)}"></label>
          <label><span>U POSITION</span><input name="locationRackUnit" type="number" min="0" max="48" value="${escapeHTML(locationRackUnit)}"></label>
        </div>
      </fieldset>
      ${spanningTreeMarkup}
      <div class="inspector-actions"><button class="primary">UPDATE DEVICE RECORD</button><button id="delete-device" type="button" class="danger">DELETE</button></div>
    </form>
    ${switchSystemMarkup}
    ${firewallClusterMarkup}`;
  document.getElementById("device-inspector-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = structuredClone(device);
    next.name = String(form.get("name"));
    next.model = String(form.get("model"));
    next.hostname = String(form.get("hostname") || "").trim();
    next.managementIp = String(form.get("managementIp") || "").trim();
    next.serialNumber = String(form.get("serialNumber") || "").trim();
    next.assetTag = String(form.get("assetTag") || "").trim();
    next.owner = String(form.get("owner") || "").trim();
    next.location = {
      site: String(form.get("locationSite") || "").trim(),
      building: String(form.get("locationBuilding") || "").trim(),
      floor: String(form.get("locationFloor") || "").trim(),
      room: String(form.get("locationRoom") || "").trim(),
      rack: String(form.get("locationRack") || "").trim(),
      rackUnit: Number(form.get("locationRackUnit") || 0),
    };
    if (device.category === "Switch") next.stpPriority = Number(form.get("stpPriority") || 0);
    await updateFrom(() => api.updateDevice(state.topology.id, next), true, "Device record updated");
  });
  document.getElementById("delete-device").addEventListener("click", () => deleteDevice(device));
  document.querySelectorAll("[data-switch-system-member]").forEach((button) => {
    button.addEventListener("click", () => state.select("device", button.dataset.switchSystemMember));
  });
  document.getElementById("create-switch-system")?.addEventListener("click", () => openSwitchSystemDialog(device));
  document.getElementById("edit-switch-system")?.addEventListener("click", () => openSwitchSystemDialog(device, system));
  document.getElementById("leave-switch-system")?.addEventListener("click", () => removeDeviceFromSwitchSystem(device, system));
  document.getElementById("dissolve-switch-system")?.addEventListener("click", () => dissolveSwitchSystem(system));
  document.querySelectorAll("[data-firewall-cluster-member]").forEach((button) => {
    button.addEventListener("click", () => state.select("device", button.dataset.firewallClusterMember));
  });
  document.getElementById("create-firewall-cluster")?.addEventListener("click", () => openFirewallClusterDialog(device));
  document.getElementById("edit-firewall-cluster")?.addEventListener("click", () => openFirewallClusterDialog(device, cluster));
  document.getElementById("leave-firewall-cluster")?.addEventListener("click", () => removeDeviceFromFirewallCluster(device, cluster));
  document.getElementById("dissolve-firewall-cluster")?.addEventListener("click", () => dissolveFirewallCluster(cluster));
}

function stpPriorityOptions(selectedPriority = 0) {
  const priorities = [0, 4096, 8192, 12288, 16384, 20480, 24576, 28672, 32768, 36864, 40960, 45056, 49152, 53248, 57344, 61440];
  return priorities.map((priority) => `<option value="${priority}"${Number(selectedPriority || 0) === priority ? " selected" : ""}>${priority === 0 ? "DEFAULT · 32768" : priority}</option>`).join("");
}

function renderSwitchSystemInspector(device, system) {
  if (!system) {
    return `<section class="switch-system-empty"><b>LOGICAL SWITCH SYSTEM</b>This physical switch is counted independently. Group it with two or more peers as a stack, VSF, MC-LAG, or another logical fabric.<button id="create-switch-system" type="button" class="secondary">MARK AS STACKED / PEERED</button></section>`;
  }
  const members = system.deviceIds.map((memberID, index) => {
    const member = state.topology.devices.find((candidate) => candidate.id === memberID);
    if (!member) return "";
    return `<button type="button" class="switch-system-member${member.id === device.id ? " is-selected" : ""}" data-switch-system-member="${escapeHTML(member.id)}"><i>M${index + 1}</i><span><b>${escapeHTML(member.name)}</b><small>${escapeHTML(member.faceplate?.vendor || "GENERIC")} · ${escapeHTML(member.model)}</small></span><em>${member.id === device.id ? "SELECTED" : "OPEN"}</em></button>`;
  }).join("");
  return `<section class="switch-system-card"><header><span>ONE LOGICAL UNIT<b>${escapeHTML(system.name)}</b></span><em>${escapeHTML(switchSystemModeLabel(system.mode))}</em></header><div class="switch-system-members">${members}</div></section>
    <div class="inspector-actions"><button id="edit-switch-system" type="button" class="secondary">EDIT MEMBERS</button><button id="leave-switch-system" type="button" class="danger">REMOVE THIS MEMBER</button></div>
    <div class="inspector-actions"><button id="dissolve-switch-system" type="button" class="danger">DISSOLVE LOGICAL SYSTEM</button></div>`;
}

function renderFirewallClusterInspector(device, cluster) {
  if (!cluster) {
    return `<section class="switch-system-empty"><b>FIREWALL HA CLUSTER</b>This physical firewall is counted independently. Group it with one or more peers in an active/active or active/passive cluster.<button id="create-firewall-cluster" type="button" class="secondary">CREATE FIREWALL CLUSTER</button></section>`;
  }
  const members = cluster.deviceIds.map((memberID, index) => {
    const member = state.topology.devices.find((candidate) => candidate.id === memberID);
    if (!member) return "";
    const role = firewallClusterRole(cluster, member.id);
    return `<button type="button" class="switch-system-member is-${role.toLowerCase()}${member.id === device.id ? " is-selected" : ""}" data-firewall-cluster-member="${escapeHTML(member.id)}"><i>F${index + 1}</i><span><b>${escapeHTML(member.name)}</b><small>${escapeHTML(member.faceplate?.vendor || "GENERIC")} · ${escapeHTML(member.model)}</small></span><em>${escapeHTML(role)}${member.id === device.id ? " · SELECTED" : ""}</em></button>`;
  }).join("");
  return `<section class="switch-system-card is-firewall-cluster"><header><span>ONE LOGICAL FIREWALL<b>${escapeHTML(cluster.name)}</b></span><em>${escapeHTML(firewallClusterModeLabel(cluster.mode))}</em></header><div class="switch-system-members">${members}</div></section>
    <div class="inspector-actions"><button id="edit-firewall-cluster" type="button" class="secondary">EDIT MEMBERS / ROLES</button><button id="leave-firewall-cluster" type="button" class="danger">REMOVE THIS MEMBER</button></div>
    <div class="inspector-actions"><button id="dissolve-firewall-cluster" type="button" class="danger">DISSOLVE FIREWALL CLUSTER</button></div>`;
}

function renderLinkInspector(linkID) {
  const link = state.topology.links.find((item) => item.id === linkID);
  if (!link) return;
  const source = findPort(state.topology, link.sourcePortId);
  const target = findPort(state.topology, link.targetPortId);
  const group = groupForLink(state.topology, link.id);
  const issueCount = state.analysis.issues.filter((issue) => issue.linkId === link.id || (group && issue.groupId === group.id)).length;
  const failoverRole = group?.mode === "Failover" ? (group.primaryLinkId === link.id ? "PRIMARY" : "BACKUP") : "";
  const roleClass = failoverRole ? ` is-${failoverRole.toLowerCase()}` : "";
  const members = group ? describeLinkGroupMembers(state.topology, group, link.id) : [];
  const memberMarkup = members.map((member) => `
    <button type="button" class="link-member-row${member.selected ? " is-selected" : ""}" data-inspector-link-id="${escapeHTML(member.id)}" aria-pressed="${member.selected}">
      <span class="link-member-role">${escapeHTML(member.role)}${member.selected ? " · SELECTED" : ""}</span>
      <span class="link-member-endpoint" title="${escapeHTML(`${member.source.device} / ${member.source.port}`)}"><i>SOURCE</i><b>${escapeHTML(member.source.device)}</b><em>${escapeHTML(member.source.port)}</em></span>
      <strong aria-hidden="true">↔</strong>
      <span class="link-member-endpoint" title="${escapeHTML(`${member.target.device} / ${member.target.port}`)}"><i>TARGET</i><b>${escapeHTML(member.target.device)}</b><em>${escapeHTML(member.target.port)}</em></span>
    </button>`).join("");
  const groupMarkup = group ? `
    <div class="link-group-chip${roleClass}"><b>${failoverRole ? `${failoverRole} · ` : ""}${escapeHTML(group.mode)} · ${escapeHTML(group.name)}</b>${group.linkIds.length} PHYSICAL MEMBERS${group.notes ? ` · ${escapeHTML(group.notes)}` : ""}</div>
    <section class="link-member-panel" aria-label="Physical link group members">
      <div class="link-member-heading"><span>PHYSICAL MEMBER PATHS</span><b>${members.length}</b></div>
      <div class="link-member-list">${memberMarkup}</div>
    </section>` : "";
  const configuration = defaultLinkConfiguration(state.topology, link, source?.port, target?.port);
  const configurationLinks = linkConfigurationScope(state.topology, link.id);
  const synchronized = isLinkConfigurationScopeSynchronized(state.topology, link.id, configuration);
  const configurationTargets = group ? `
    <section class="link-configuration-targets" aria-label="Link group VLAN configuration targets">
      <div class="link-configuration-target-heading"><span>CONFIGURATION TARGETS</span><b>${members.length} CABLES · ${members.length * 2} PORTS</b></div>
      ${members.map((member) => `<div class="link-configuration-target${member.selected ? " is-selected" : ""}">
        <span class="link-configuration-target-role">${escapeHTML(member.role)}${member.selected ? " · SELECTED" : ""}</span>
        <span title="${escapeHTML(`${member.source.device} / ${member.source.port}`)}"><i>SOURCE</i><b>${escapeHTML(member.source.device)}</b><em>${escapeHTML(member.source.port)}</em></span>
        <strong aria-hidden="true">↔</strong>
        <span title="${escapeHTML(`${member.target.device} / ${member.target.port}`)}"><i>TARGET</i><b>${escapeHTML(member.target.device)}</b><em>${escapeHTML(member.target.port)}</em></span>
      </div>`).join("")}
    </section>` : `<div class="link-endpoints"><span><i>SOURCE</i><b>${escapeHTML(source?.device.name || "Unknown")}</b><em>${escapeHTML(source?.port.label || "—")}</em></span><strong>↔</strong><span><i>TARGET</i><b>${escapeHTML(target?.device.name || "Unknown")}</b><em>${escapeHTML(target?.port.label || "—")}</em></span></div>`;
  const syncTitle = group ? "ATOMIC LINK-GROUP SYNC" : "ATOMIC PORT SYNC";
  const syncDescription = group
    ? `All ${configurationLinks.length} cables and every physical endpoint interface in this saved group are validated and saved together.`
    : "The cable and both physical endpoint interfaces are validated and saved together.";
  const applyLabel = group ? `APPLY TO ${configurationLinks.length} CABLES + ALL PORTS` : "APPLY TO CABLE + BOTH PORTS";
  const vlanOptions = state.topology.vlans.map((vlan) => `<option value="${vlan.id}" ${vlan.id === configuration.nativeVlan ? "selected" : ""}>${vlan.id} · ${escapeHTML(vlan.name)}</option>`).join("");
  const checks = state.topology.vlans.map((vlan) => `<label class="check-row"><input type="checkbox" name="allowed" value="${vlan.id}" ${configuration.allowedVlans.includes(vlan.id) ? "checked" : ""}><i style="--vlan-color:${vlan.colorHex}"></i><b>${vlan.id}</b><span>${escapeHTML(vlan.name)}</span></label>`).join("");
  elements["inspector-content"].innerHTML = `
    <div class="inspector-title"><p class="eyebrow">PHYSICAL PATCH</p><h3>${escapeHTML(link.cableType)}</h3><p>${escapeHTML(source?.device.name || "Unknown")} → ${escapeHTML(target?.device.name || "Unknown")}</p></div>
    <div class="metric-grid"><span>SOURCE<b>${escapeHTML(source?.port.label || "—")}</b></span><span>TARGET<b>${escapeHTML(target?.port.label || "—")}</b></span><span>PRIMARY VLAN<b>${link.primaryVlan || 1}</b></span><span>RULE ALERTS<b>${issueCount}</b></span></div>
    ${groupMarkup}
    <form id="link-configuration-form" class="inspector-form link-configuration-form">
      <div class="link-configuration-heading"><span>END-TO-END VLAN PROFILE</span><b class="link-sync-state ${synchronized ? "is-synced" : "is-warning"}">${synchronized ? "SYNCHRONIZED" : "MISMATCH DETECTED"}</b></div>
      ${configurationTargets}
      <label><span>PHYSICAL CABLE MEDIA</span><select name="cableType">${mediaTypeOptions(link.cableType)}</select></label>
      <div><span>SWITCHPORT MODE</span><div class="radio-row">${["Access", "Trunk", "Hybrid"].map((mode) => `<label><input type="radio" name="mode" value="${mode}" ${configuration.mode === mode ? "checked" : ""}><span>${mode.toUpperCase()}</span></label>`).join("")}</div></div>
      <label><span>NATIVE / UNTAGGED VLAN</span><select name="nativeVlan">${vlanOptions}</select></label>
      <div id="link-tagged-vlans"><span>TAGGED ALLOWED VLANS</span><div class="checklist">${checks}</div></div>
      <p class="link-sync-note"><b>${syncTitle}</b>${syncDescription}</p>
      <button class="primary">${applyLabel}</button>
    </form>
    ${group ? `<div class="inspector-actions"><button id="edit-link-group" class="secondary">EDIT GROUP</button><button id="leave-link-group" class="danger">REMOVE FROM GROUP</button></div>` : ""}
    <div class="inspector-actions"><button id="focus-link" class="secondary">FOCUS PATH</button><button id="delete-link" class="danger">UNPATCH</button></div>`;
  const form = document.getElementById("link-configuration-form");
  const toggleTaggedVLANs = () => {
    const accessMode = form.elements.mode.value === "Access";
    document.getElementById("link-tagged-vlans").hidden = accessMode;
    form.querySelectorAll('input[name="allowed"]').forEach((input) => { input.disabled = accessMode; });
  };
  form.querySelectorAll('input[name="mode"]').forEach((input) => input.addEventListener("change", toggleTaggedVLANs));
  toggleTaggedVLANs();
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const next = normalizeLinkConfiguration({
      mode: String(data.get("mode")),
      nativeVlan: Number(data.get("nativeVlan")),
      allowedVlans: data.getAll("allowed").map(Number),
    });
    next.cableType = String(data.get("cableType"));
    const successMessage = group
      ? `${configurationLinks.length} cables and all link-group ports synchronized`
      : "Cable and endpoint VLANs synchronized";
    await updateFrom(() => api.configureLink(state.topology.id, link.id, next), true, successMessage);
  });
  document.getElementById("focus-link").addEventListener("click", () => state.setTrace([link.id]));
  document.getElementById("delete-link").addEventListener("click", () => deleteLink(link));
  document.querySelectorAll("[data-inspector-link-id]").forEach((button) => {
    button.addEventListener("click", () => state.select("link", button.dataset.inspectorLinkId));
  });
  if (group) {
    document.getElementById("edit-link-group").addEventListener("click", () => {
      const peer = state.topology.links.find((candidate) => candidate.id !== link.id && group.linkIds.includes(candidate.id));
      if (peer) openLinkGroupDialog(link, peer);
    });
    document.getElementById("leave-link-group").addEventListener("click", () => removeLinkFromGroup(link, group));
  }
}

function bindControls() {
  elements["topology-select"].addEventListener("change", (event) => loadTopology(event.target.value).catch(showError));
  elements["graphics-quality"].addEventListener("change", (event) => {
    const mode = normalizeGraphicsMode(event.target.value);
    canvas.setGraphicsMode(mode);
    try {
      localStorage.setItem(GRAPHICS_STORAGE_KEY, mode);
    } catch {
      // Storage can be unavailable in private or embedded browsing contexts.
    }
    renderGraphicsQuality();
  });
  document.getElementById("fit-button").addEventListener("click", () => canvas.fit());
  document.getElementById("navigator-toggle").addEventListener("click", toggleNavigator);
  document.querySelectorAll("[data-canvas-tool]").forEach((button) => button.addEventListener("click", () => selectCanvasTool(button.dataset.canvasTool)));
  document.getElementById("add-rack-button").addEventListener("click", () => elements["rack-dialog"].showModal());
  document.getElementById("add-device-button").addEventListener("click", () => openDeviceDialog().catch(showError));
  document.getElementById("add-server-button").addEventListener("click", openStaticServerDialog);
  document.getElementById("add-patch-panel-button").addEventListener("click", openPatchPanelDialog);
  document.getElementById("patch-panel-map-button").addEventListener("click", openPatchPanelMapDialog);
  document.getElementById("vlan-button").addEventListener("click", () => elements["vlan-modal"].showModal());
  document.getElementById("trace-button").addEventListener("click", () => elements["trace-dialog"].showModal());
  document.getElementById("collaboration-button").addEventListener("click", () => openCollaboration().catch(showError));
  document.getElementById("undo-button").addEventListener("click", () => undo());
  document.getElementById("redo-button").addEventListener("click", () => redo());
  document.getElementById("save-now-button").addEventListener("click", () => saveNow().catch(showError));
  elements["autosave-enabled"].addEventListener("change", configureAutosave);
  elements["autosave-interval"].addEventListener("change", configureAutosave);
  document.getElementById("png-button").addEventListener("click", () => runLazyExport("exportPNG", state.topology, canvas).catch(showError));
  document.getElementById("svg-button").addEventListener("click", () => runLazyExport("exportSVG", state.topology, canvas).catch(showError));
  document.getElementById("pdf-button").addEventListener("click", () => runLazyExport("exportPDF", state.topology, canvas).catch(showError));
  document.getElementById("html-button").addEventListener("click", () => runLazyExport("exportHTML", state.topology, canvas).catch(showError));
  document.getElementById("json-button").addEventListener("click", () => runLazyExport("exportJSON", state.topology).catch(showError));
  document.getElementById("import-button").addEventListener("click", () => {
    closeExportMenu();
    elements["import-file"].click();
  });
	document.getElementById("catalog-import-button").addEventListener("click", () => elements["catalog-file"].click());
  elements["import-file"].addEventListener("change", importBackup);
	elements["catalog-file"].addEventListener("change", importCatalog);
  document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => document.getElementById(button.dataset.close).close()));
  elements["device-form"].addEventListener("submit", installDevice);
  elements["rack-form"].addEventListener("submit", installRack);
  elements["static-server-form"].addEventListener("submit", installStaticServer);
  elements["static-server-form"].elements.units.addEventListener("change", renderServerCardBuilder);
  elements["static-server-form"].elements.color.addEventListener("input", renderServerBackPreview);
  document.getElementById("add-server-card").addEventListener("click", addServerCard);
  elements["server-card-list"].addEventListener("click", handleServerCardClick);
  elements["server-card-list"].addEventListener("change", handleServerCardChange);
  elements["server-card-list"].addEventListener("input", handleServerCardInput);
  elements["patch-panel-form"].addEventListener("submit", installPatchPanel);
  elements["patch-panel-form"].elements.portCount.addEventListener("change", renderPatchPanelMiniature);
  elements["patch-panel-map-form"].addEventListener("submit", createPatchPanelMapping);
  elements["patch-panel-map-form"].addEventListener("input", renderPatchPanelMappingPreview);
  elements["patch-panel-map-form"].addEventListener("change", renderPatchPanelMappingPreview);
  elements["annotation-form"].addEventListener("submit", saveTextAnnotation);
  elements["comment-form"].addEventListener("submit", (event) => saveComment(event).catch(showError));
  elements["documentation-form"].addEventListener("submit", (event) => saveDocumentationLink(event).catch(showError));
  elements["share-form"].addEventListener("submit", (event) => saveShare(event).catch(showError));
  elements["comments-list"].addEventListener("click", (event) => handleCommentAction(event).catch(showError));
  elements["documentation-list"].addEventListener("click", (event) => handleDocumentationAction(event).catch(showError));
  elements["share-list"].addEventListener("click", (event) => handleShareAction(event).catch(showError));
  elements["vlan-form"].addEventListener("submit", saveVLAN);
  elements["trace-form"].addEventListener("submit", tracePath);
  elements["link-group-form"].addEventListener("submit", saveLinkGroup);
  elements["link-group-form"].querySelectorAll('input[name="mode"]').forEach((input) => input.addEventListener("change", toggleFailoverPrimary));
  elements["switch-system-form"].addEventListener("submit", saveSwitchSystem);
  elements["firewall-cluster-form"].addEventListener("submit", saveFirewallCluster);
  elements["firewall-cluster-form"].elements.mode.addEventListener("change", refreshFirewallClusterForm);
  window.addEventListener("keydown", keyboardShortcuts);
}

function toggleNavigator() {
  const collapsed = elements.workspace.classList.toggle("navigator-collapsed");
  const button = document.getElementById("navigator-toggle");
  button.setAttribute("aria-expanded", String(!collapsed));
  button.title = collapsed ? "Open navigator" : "Collapse navigator";
  requestAnimationFrame(() => canvas.resize());
}

function selectCanvasTool(tool) {
  canvas.setTool(nextCanvasTool(canvas.activeTool, tool));
}

function renderCanvasToolState(tool) {
  document.querySelectorAll("[data-canvas-tool]").forEach((button) => {
    const active = button.dataset.canvasTool === tool;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function configureAutosave() {
  autosave.configure({ enabled: elements["autosave-enabled"].checked, intervalSeconds: Number(elements["autosave-interval"].value) });
  toast(autosave.settings.enabled ? `Autosave enabled every ${autosave.settings.intervalSeconds} seconds` : "Autosave disabled");
}

async function saveNow() {
  if (!state.topology) return;
  try {
    const topology = await api.replaceTopology(state.topology);
    state.setTopology(topology);
    autosave.markSaved();
    elements["autosave-menu"].open = false;
    toast("Topology saved");
  } catch (error) {
    if (isRevisionConflict(error)) {
      state.setTopology(await api.getTopology(state.topology.id));
      notifications.push("SAVE CONFLICT · Loaded the newer shared revision", "error");
      return;
    }
    throw error;
  }
}

function createAnnotation(input) {
  state.commit((topology) => {
    topology.annotations ||= [];
    topology.annotations.push({
      id: crypto.randomUUID(), type: input.type,
      x1: Math.round(input.x1), y1: Math.round(input.y1), x2: Math.round(input.x2), y2: Math.round(input.y2),
      text: "", color: "#f0b35a",
    });
  });
  autosave.markDirty();
  toast(`${input.type === "arrow" ? "Arrow" : "Rectangle"} annotation added`);
}

function deleteAnnotation(annotation) {
  if (!annotation) return;
  state.commit((topology) => {
    topology.annotations = (topology.annotations || []).filter((item) => item.id !== annotation.id);
  });
  state.select(null, null);
  autosave.markDirty();
  toast("Annotation deleted · Undo is available");
}

function openTextAnnotationDialog(point) {
  pendingAnnotationPoint = { x: Math.round(point.x), y: Math.round(point.y) };
  elements["annotation-form"].reset();
  elements["annotation-form"].elements.color.value = "#f0b35a";
  elements["annotation-dialog"].showModal();
  requestAnimationFrame(() => elements["annotation-form"].elements.text.focus());
}

function saveTextAnnotation(event) {
  event.preventDefault();
  if (!pendingAnnotationPoint) return;
  const form = new FormData(event.currentTarget);
  state.commit((topology) => {
    topology.annotations ||= [];
    topology.annotations.push({
      id: crypto.randomUUID(), type: "text",
      x1: pendingAnnotationPoint.x, y1: pendingAnnotationPoint.y,
      x2: pendingAnnotationPoint.x, y2: pendingAnnotationPoint.y,
      text: String(form.get("text")).trim(), color: String(form.get("color")),
    });
  });
  pendingAnnotationPoint = null;
  autosave.markDirty();
  elements["annotation-dialog"].close();
  toast("Text annotation added");
  selectCanvasTool("select");
}

async function openCollaboration() {
  shareEntries = await api.listShares(state.topology.id);
  createdShareURL = "";
  renderCollaboration();
  elements["collaboration-dialog"].showModal();
}

function collaborationTarget() {
  const selection = state.selection;
  if (!selection || !["rack", "device", "port", "link"].includes(selection.type)) return { targetKind: "topology", targetId: state.topology.id, label: state.topology.name };
  return { targetKind: selection.type, targetId: selection.id, label: `${selection.type.toUpperCase()} · ${selection.id.slice(0, 8)}` };
}

function commentAnchor() {
  if (["device", "link"].includes(state.selection?.type)) {
    return { kind: state.selection.type, targetId: state.selection.id };
  }
  if (state.selection?.type === "annotation") {
    const annotation = (state.topology.annotations || []).find((item) => item.id === state.selection.id);
    if (annotation) return { kind: "canvas", x: annotation.x1, y: annotation.y1 };
  }
  const viewport = canvas.viewportWorldRect();
  return { kind: "canvas", x: Math.round(viewport.x + viewport.width / 2), y: Math.round(viewport.y + viewport.height / 2) };
}

function renderCollaboration() {
  if (!state.topology) return;
  const target = collaborationTarget();
  elements["collaboration-target"].textContent = target.label;
  const threads = state.topology.commentThreads || [];
  elements["comments-list"].innerHTML = threads.length ? threads.map((thread) => {
    const anchor = thread.anchor.kind === "canvas" ? `CANVAS · ${Math.round(thread.anchor.x)}, ${Math.round(thread.anchor.y)}` : `${thread.anchor.kind.toUpperCase()} · ${thread.anchor.targetId.slice(0, 8)}`;
    return `<article class="collaboration-card${thread.resolved ? " is-resolved" : ""}">
      <header><span>${escapeHTML(anchor)}</span><b>${thread.resolved ? "RESOLVED" : `${thread.messages.length} MESSAGE${thread.messages.length === 1 ? "" : "S"}`}</b></header>
      ${thread.messages.map((message) => `<p><strong>${escapeHTML(message.author)}</strong>${escapeHTML(message.body)}</p>`).join("")}
      <footer><button type="button" data-comment-resolve="${thread.id}">${thread.resolved ? "REOPEN" : "RESOLVE"}</button><button type="button" class="danger" data-comment-delete="${thread.id}">DELETE</button></footer>
    </article>`;
  }).join("") : `<p class="collaboration-empty">No comments yet.</p>`;

  const documents = state.topology.documentationLinks || [];
  elements["documentation-list"].innerHTML = documents.length ? documents.map((item) => `<article class="collaboration-card">
    <header><span>${escapeHTML(item.targetKind.toUpperCase())}</span><b>${escapeHTML(item.label)}</b></header>
    <p class="document-url">${escapeHTML(item.url)}</p>
    <footer><button type="button" data-document-embed="${item.id}">EMBED</button><a href="${escapeHTML(item.url)}" target="_blank" rel="noopener noreferrer">OPEN ↗</a><button type="button" class="danger" data-document-delete="${item.id}">DELETE</button></footer>
  </article>`).join("") : `<p class="collaboration-empty">No documentation attached.</p>`;

  const created = createdShareURL ? `<article class="collaboration-card share-created"><header><span>NEW LINK · COPY NOW</span><b>SECRET SHOWN ONCE</b></header><input readonly value="${escapeHTML(createdShareURL)}"><footer><button type="button" data-share-copy="${escapeHTML(createdShareURL)}">COPY LINK</button></footer></article>` : "";
  elements["share-list"].innerHTML = created + (shareEntries.length ? shareEntries.map((share) => `<article class="collaboration-card"><header><span>${escapeHTML(share.name)}</span><b>${share.expiresAt ? `EXPIRES ${escapeHTML(new Date(share.expiresAt).toLocaleString())}` : "NO EXPIRY"}</b></header><footer><button type="button" class="danger" data-share-delete="${share.id}">REVOKE</button></footer></article>`).join("") : `<p class="collaboration-empty">No active read-only shares.</p>`);
}

async function saveComment(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const topology = await api.createComment(state.topology.id, {
    anchor: commentAnchor(), author: String(form.get("author")).trim(), body: String(form.get("body")).trim(),
  });
  state.setTopology(topology);
  event.currentTarget.elements.body.value = "";
  renderCollaboration();
  toast("Comment added");
}

async function handleCommentAction(event) {
  const resolveID = event.target.closest("[data-comment-resolve]")?.dataset.commentResolve;
  const deleteID = event.target.closest("[data-comment-delete]")?.dataset.commentDelete;
  if (!resolveID && !deleteID) return;
  const thread = (state.topology.commentThreads || []).find((item) => item.id === (resolveID || deleteID));
  const topology = deleteID
    ? await api.deleteComment(state.topology.id, deleteID)
    : await api.updateComment(state.topology.id, resolveID, { resolved: !thread?.resolved });
  state.setTopology(topology);
  renderCollaboration();
}

async function saveDocumentationLink(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const url = String(form.get("url")).trim();
  if (!validateDocumentationURL(url)) throw new Error("Documentation URL must be credential-free HTTP(S)");
  const target = collaborationTarget();
  const topology = await api.createDocumentationLink(state.topology.id, {
    targetKind: target.targetKind, targetId: target.targetId, label: String(form.get("label")).trim(), url,
  });
  state.setTopology(topology);
  event.currentTarget.reset();
  renderCollaboration();
  toast("Documentation link attached");
}

async function handleDocumentationAction(event) {
  const embedID = event.target.closest("[data-document-embed]")?.dataset.documentEmbed;
  const deleteID = event.target.closest("[data-document-delete]")?.dataset.documentDelete;
  if (embedID) {
    const item = (state.topology.documentationLinks || []).find((candidate) => candidate.id === embedID);
    elements["documentation-preview"].src = item?.url || "about:blank";
    elements["documentation-preview"].hidden = !item;
  }
  if (deleteID) {
    state.setTopology(await api.deleteDocumentationLink(state.topology.id, deleteID));
    elements["documentation-preview"].hidden = true;
    renderCollaboration();
  }
}

async function saveShare(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const expiresValue = String(form.get("expiresAt") || "");
  const created = await api.createShare(state.topology.id, {
    name: String(form.get("name") || "").trim(),
    ...(expiresValue ? { expiresAt: new Date(expiresValue).toISOString() } : {}),
  });
  createdShareURL = absoluteShareURL(created.path);
  state.setTopology(await api.getTopology(state.topology.id));
  shareEntries = await api.listShares(state.topology.id);
  event.currentTarget.reset();
  renderCollaboration();
  toast("Read-only share created");
}

async function handleShareAction(event) {
  const copyURL = event.target.closest("[data-share-copy]")?.dataset.shareCopy;
  const deleteID = event.target.closest("[data-share-delete]")?.dataset.shareDelete;
  if (copyURL) {
    await navigator.clipboard.writeText(copyURL);
    toast("Share link copied");
  }
  if (deleteID) {
    await api.deleteShare(state.topology.id, deleteID);
    state.setTopology(await api.getTopology(state.topology.id));
    shareEntries = await api.listShares(state.topology.id);
    renderCollaboration();
    toast("Read-only share revoked");
  }
}

async function runExportAction(action) {
  await action();
  closeExportMenu();
}

async function runLazyExport(name, ...arguments_) {
  exportModulePromise ||= import("./export.js");
  const module = await exportModulePromise;
  const operation = module[name];
  if (typeof operation !== "function") throw new Error(`Export format ${name} is unavailable`);
  await runExportAction(() => operation(...arguments_));
}

function closeExportMenu() {
  elements["export-menu"].open = false;
  elements["export-menu"].querySelector("summary")?.focus();
}

async function installRack(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const index = (state.topology.racks || []).length;
  const rack = {
    id: "", name: String(form.get("name")), heightU: Number(form.get("heightU")),
    color: String(form.get("color")), positionX: 80 + index * 900,
    positionY: 80,
  };
  await updateFrom(() => api.createRack(state.topology.id, rack), true, "Rack placed");
  elements["rack-dialog"].close();
  requestAnimationFrame(() => canvas.fit());
}

async function installDevice(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const index = state.topology.devices.length;
	const catalog = await loadCatalogModule();
	const profile = catalog.hardwareCatalog.find((candidate) => candidate.vendor === form.get("vendor") && candidate.model === form.get("model"));
	if (!profile) throw new Error("Select a hardware catalog profile");
	const device = catalog.instantiateProfile(profile, String(form.get("name")), {
		x: 100 + (index % 2) * 730,
		y: 100 + Math.floor(index / 2) * (profile.units * 100 + 50),
	});
	device.faceplate.vendorColor = String(form.get("color"));
  await updateFrom(() => api.createDevice(state.topology.id, device), true, "Device installed");
  elements["device-dialog"].close();
}

async function openDeviceDialog() {
  const catalog = await loadCatalogModule();
  if (catalog.upgradeInstalledPhysicalPorts(state.topology)) {
    const topology = await api.replaceTopology(state.topology);
    state.setTopology(topology);
  }
  setupHardwareCatalog();
  elements["device-dialog"].showModal();
}

async function loadCatalogModule() {
  catalogModulePromise ||= import("./catalog.js");
  catalogModule ||= await catalogModulePromise;
  return catalogModule;
}

async function installStaticServer(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const units = Number(form.get("units"));
  const index = state.topology.devices.length;
  const server = instantiateGenericServerBack({
    name: form.get("name"), model: form.get("model"), units, color: form.get("color"),
    cards: pendingServerCards.map(({ typeKey, label, portCount }) => ({ typeKey, label, portCount })),
  }, {
    x: 100 + (index % 2) * 730,
    y: 100 + Math.floor(index / 2) * (units * 100 + 50),
  });
  await updateFrom(() => api.createDevice(state.topology.id, server), true, "Generic server back installed");
  elements["static-server-dialog"].close();
}

function openPatchPanelDialog() {
  elements["patch-panel-form"].reset();
  renderPatchPanelMiniature();
  elements["patch-panel-dialog"].showModal();
}

function renderPatchPanelMiniature() {
  const count = Number(elements["patch-panel-form"].elements.portCount.value);
  document.getElementById("patch-panel-jack-preview").innerHTML = Array.from(
    { length: Math.min(count, 48) },
    (_, index) => `<i>${index + 1}</i>`,
  ).join("");
}

async function installPatchPanel(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const index = state.topology.devices.length;
  const panel = instantiatePatchPanel({
    name: form.get("name"), portCount: Number(form.get("portCount")), color: form.get("color"),
  }, {
    x: 100 + (index % 2) * 730,
    y: 100 + Math.floor(index / 2) * (Number(form.get("portCount")) > 48 ? 250 : 150),
  });
  const topology = await updateFrom(() => api.createDevice(state.topology.id, panel), true, "Patch panel installed");
  if (topology) elements["patch-panel-dialog"].close();
}

function refreshPatchPanelControls() {
  const panels = patchPanelDevices(state.topology);
  document.getElementById("patch-panel-map-button").disabled = panels.length < 2;
  if (!elements["patch-panel-map-dialog"].open) return;
  fillPatchPanelSelects();
  renderPatchPanelMappingPreview();
}

function openPatchPanelMapDialog() {
  if (patchPanelDevices(state.topology).length < 2) {
    showError(new Error("Install at least two patch panels before creating a range map"));
    return;
  }
  elements["patch-panel-map-form"].reset();
  fillPatchPanelSelects(true);
  renderPatchPanelMappingPreview();
  elements["patch-panel-map-dialog"].showModal();
}

function fillPatchPanelSelects(selectDefaults = false) {
  const panels = patchPanelDevices(state.topology);
  const form = elements["patch-panel-map-form"];
  const sourceValue = selectDefaults ? panels[0]?.id : form.elements.sourceDeviceId.value;
  const targetValue = selectDefaults ? panels[1]?.id : form.elements.targetDeviceId.value;
  for (const [name, value] of [["sourceDeviceId", sourceValue], ["targetDeviceId", targetValue]]) {
    const select = form.elements[name];
    select.replaceChildren(...panels.map((panel) => new Option(`${panel.name} · ${panel.ports.length} PORTS`, panel.id)));
    if (panels.some((panel) => panel.id === value)) select.value = value;
  }
}

function renderPatchPanelMappingPreview() {
  const form = elements["patch-panel-map-form"];
  const sourceStart = Number(form.elements.sourceStart.value);
  const sourceEnd = Number(form.elements.sourceEnd.value);
  const targetStart = Number(form.elements.targetStart.value);
  const calculatedEnd = targetStart + Math.max(0, sourceEnd - sourceStart);
  elements["patch-map-target-end"].textContent = Number.isFinite(calculatedEnd) ? String(calculatedEnd) : "—";
  try {
    const plan = planPatchPanelMapping(state.topology, Object.fromEntries(new FormData(form)));
    elements["patch-map-count"].textContent = `${plan.links.length} CABLE${plan.links.length === 1 ? "" : "S"}`;
    elements["patch-map-pairs"].innerHTML = plan.sourcePorts.map((port, index) =>
      `<span><b>${escapeHTML(plan.source.name)}</b><em>${escapeHTML(port.label)}</em><i>↔</i><em>${escapeHTML(plan.targetPorts[index].label)}</em><b>${escapeHTML(plan.target.name)}</b></span>`).join("");
    elements["patch-map-error"].textContent = "";
    elements["create-patch-map-button"].disabled = false;
    return plan;
  } catch (error) {
    elements["patch-map-count"].textContent = "NOT READY";
    elements["patch-map-pairs"].replaceChildren();
    elements["patch-map-error"].textContent = error.message;
    elements["create-patch-map-button"].disabled = true;
    return null;
  }
}

async function createPatchPanelMapping(event) {
  event.preventDefault();
  const plan = renderPatchPanelMappingPreview();
  if (!plan) return;
  const topology = await updateFrom(
    () => api.createLinks(state.topology.id, plan.links),
    true,
    `${plan.links.length} patch cables connected`,
  );
  if (topology) elements["patch-panel-map-dialog"].close();
}

function openStaticServerDialog() {
  elements["static-server-form"].reset();
  pendingServerCards = defaultServerCards().map(newServerCardDraft);
  renderServerCardBuilder();
  elements["static-server-dialog"].showModal();
}

function addServerCard() {
  const units = Number(elements["static-server-form"].elements.units.value);
  if (pendingServerCards.length >= serverSlotCapacity(units)) {
    showError(new Error(`${units}U rear chassis has no free card slots`));
    return;
  }
  pendingServerCards.push(newServerCardDraft({ typeKey: "sfp28", label: "DATA", portCount: 2 }));
  renderServerCardBuilder();
  elements["server-card-list"].lastElementChild?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function newServerCardDraft(card) {
  serverCardSequence += 1;
  return { id: `server-card-${serverCardSequence}`, ...card };
}

function handleServerCardClick(event) {
  const button = event.target.closest("[data-remove-server-card]");
  if (!button) return;
  pendingServerCards = pendingServerCards.filter((card) => card.id !== button.dataset.removeServerCard);
  renderServerCardBuilder();
}

function handleServerCardChange(event) {
  const row = event.target.closest("[data-server-card-id]");
  const draft = pendingServerCards.find((card) => card.id === row?.dataset.serverCardId);
  if (!draft) return;
  if (event.target.matches("[data-server-card-type]")) {
    const previousType = serverCardType(draft.typeKey);
    const nextType = serverCardType(event.target.value);
    draft.typeKey = nextType.key;
    if (!nextType.portCounts.includes(Number(draft.portCount))) draft.portCount = nextType.portCounts[0];
    if (!draft.label || draft.label === previousType?.defaultLabel) draft.label = nextType.defaultLabel;
    renderServerCardBuilder();
    return;
  }
  if (event.target.matches("[data-server-card-count]")) draft.portCount = Number(event.target.value);
  renderServerBackPreview();
}

function handleServerCardInput(event) {
  if (!event.target.matches("[data-server-card-label]")) return;
  const row = event.target.closest("[data-server-card-id]");
  const draft = pendingServerCards.find((card) => card.id === row?.dataset.serverCardId);
  if (!draft) return;
  draft.label = event.target.value;
  renderServerBackPreview();
}

function renderServerCardBuilder() {
  const units = Number(elements["static-server-form"].elements.units.value);
  const capacity = serverSlotCapacity(units);
  elements["server-card-count"].textContent = `${pendingServerCards.length} / ${capacity} SLOTS`;
  elements["server-card-count"].classList.toggle("is-over", pendingServerCards.length > capacity);
  elements["install-server-button"].disabled = !pendingServerCards.length || pendingServerCards.length > capacity;
  document.getElementById("add-server-card").disabled = pendingServerCards.length >= capacity;
  const typeOptions = (selected) => ServerCardTypes.map((type) =>
    `<option value="${type.key}" ${type.key === selected ? "selected" : ""}>${escapeHTML(type.label)}</option>`).join("");
  elements["server-card-list"].innerHTML = pendingServerCards.length ? pendingServerCards.map((draft, index) => {
    const type = serverCardType(draft.typeKey);
    const counts = type.portCounts.map((count) => `<option value="${count}" ${count === Number(draft.portCount) ? "selected" : ""}>${count} PORT${count === 1 ? "" : "S"}</option>`).join("");
    return `<div class="server-card-row" data-server-card-id="${draft.id}">
      <b class="server-slot-number">S${index + 1}</b>
      <label><span>CARD FAMILY</span><select data-server-card-type>${typeOptions(type.key)}</select></label>
      <label><span>CARD LABEL</span><input data-server-card-label maxlength="30" value="${escapeHTML(draft.label)}" required></label>
      <label><span>PORTS</span><select data-server-card-count>${counts}</select></label>
      <button type="button" class="danger server-remove-card" data-remove-server-card="${draft.id}" aria-label="Remove slot ${index + 1}">×</button>
    </div>`;
  }).join("") : `<p class="server-card-empty">NO REAR CARDS INSTALLED<br><span>Add a card to create physical cable endpoints.</span></p>`;
  renderServerBackPreview();
}

function renderServerBackPreview() {
  const form = elements["static-server-form"];
  const units = Number(form.elements.units.value);
  const capacity = serverSlotCapacity(units);
  const color = form.elements.color.value;
  const slots = Array.from({ length: capacity }, (_, index) => {
    const draft = pendingServerCards[index];
    if (!draft) return `<div class="server-preview-slot is-empty"><b>S${index + 1}</b><span>EMPTY BAY</span></div>`;
    const type = serverCardType(draft.typeKey);
    const kind = type.portType.startsWith("QSFP") ? "qsfp" : type.portType.startsWith("SFP") ? "sfp" :
      type.portType === "Console" ? "console" : type.portType === "Power" ? "power" : type.portType === "DSL_RJ11" ? "dsl" : "rj45";
    const connectors = Array.from({ length: Number(draft.portCount) }, () => `<i class="is-${kind}"></i>`).join("");
    return `<div class="server-preview-slot" data-zone="${type.zone}"><b>S${index + 1} · ${escapeHTML(draft.label || type.defaultLabel)}</b><span>${connectors}</span><em>${escapeHTML(type.label)}</em></div>`;
  }).join("");
  elements["server-back-preview"].style.setProperty("--server-units", units);
  elements["server-back-preview"].style.setProperty("--server-preview-height", `${96 + units * 58}px`);
  elements["server-back-preview"].style.setProperty("--server-color", color);
  elements["server-back-preview"].innerHTML = `<div class="server-preview-service"><i></i><i></i><b>FANS / PSU BUS</b></div><div class="server-preview-slots">${slots}</div>`;
}

function setupHardwareCatalog(preferredVendor = "Cisco") {
	if (!catalogModule) return;
	const form = elements["device-form"];
	const vendorSelect = form.elements.vendor;
	const previous = catalogModule.catalogVendors().includes(preferredVendor) ? preferredVendor : catalogModule.catalogVendors()[0];
	vendorSelect.replaceChildren(...catalogModule.catalogVendors().map((vendor) => new Option(vendor, vendor)));
	vendorSelect.value = previous;
	vendorSelect.onchange = () => {
		form.elements.filter.value = "";
		fillHardwareModels(vendorSelect.value);
	};
	form.elements.filter.oninput = () => fillHardwareModels(vendorSelect.value, form.elements.filter.value);
	form.elements.model.onchange = updateHardwareSummary;
	fillHardwareModels(previous);
}

function fillHardwareModels(vendor, query = "") {
	const select = elements["device-form"].elements.model;
	const previous = select.value;
	const needle = query.trim().toLocaleLowerCase();
	const profiles = catalogModule.modelsForVendor(vendor).filter((profile) => !needle ||
		`${profile.model} ${profile.sku || ""}`.toLocaleLowerCase().includes(needle));
	select.replaceChildren(...profiles.map((profile) => new Option(
		`${profile.model}${profile.sku ? ` · ${profile.sku}` : ""}`,
		profile.model,
	)));
	if (profiles.some((profile) => profile.model === previous)) select.value = previous;
	select.disabled = profiles.length === 0;
	updateHardwareSummary();
}

function updateHardwareSummary() {
	const form = elements["device-form"];
	const profile = catalogModule.hardwareCatalog.find((candidate) => candidate.vendor === form.elements.vendor.value && candidate.model === form.elements.model.value);
	if (!profile) {
		document.getElementById("catalog-profile-summary").textContent = "NO HARDWARE PROFILES MATCH THIS FILTER";
		return;
	}
	const ports = profile.groups.reduce((sum, group) => sum + group.count, 0);
	const media = profile.groups.map((group) => `${group.count}× ${group.type.replaceAll("_", " ")}`).join(" · ");
	const lifecycle = profile.lifecycle ? ` · ${profile.lifecycle.toUpperCase()}` : "";
	const fidelity = profile.fidelity === "family" ? " · FAMILY-EQUIVALENT PANEL" :
		profile.fidelity === "modular" ? " · MODULAR CHASSIS" : profile.fidelity ? " · VERIFIED PANEL" : "";
	const portFidelity = profile.portLayout?.fidelity === "exact" ? " · SOURCE-VERIFIED PORT LEGENDS" : " · FAMILY PORT LEGENDS";
	const note = profile.note ? ` — ${profile.note}` : "";
	document.getElementById("catalog-profile-summary").textContent = `${profile.category.toUpperCase()} · ${profile.units}U · ${ports} INTERFACES${lifecycle}${fidelity}${portFidelity} — ${media}${note}`;
	form.elements.color.value = profile.color;
	form.elements.name.value = profile.model;
}

async function importCatalog(event) {
	const file = event.target.files?.[0];
	event.target.value = "";
	if (!file) return;
	try {
		const profiles = JSON.parse(await file.text());
		const catalog = await loadCatalogModule();
		const count = catalog.registerProfiles(profiles);
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

function openLinkGroupDialog(sourceLink, targetLink) {
  if (!sourceLink || !targetLink) return;
  const defaults = defaultGroupInput(state.topology, sourceLink.id, targetLink.id);
  const form = elements["link-group-form"];
  form.dataset.sourceLinkId = sourceLink.id;
  form.dataset.targetLinkId = targetLink.id;
  form.elements.name.value = defaults.name;
  form.elements.notes.value = defaults.notes;
  form.elements.primaryLinkId.replaceChildren(...defaults.memberLinkIds.map((linkID) => {
    const link = state.topology.links.find((candidate) => candidate.id === linkID);
    return new Option(describeLink(link), linkID);
  }));
  form.elements.primaryLinkId.value = defaults.primaryLinkId;
  const mode = form.querySelector(`input[name="mode"][value="${defaults.mode}"]`);
  if (mode) mode.checked = true;
  elements["link-group-summary"].textContent = `${defaults.memberLinkIds.length} physical cables will belong to this persistent group. Drag another cable onto any member to add it later.`;
  toggleFailoverPrimary();
  elements["link-group-dialog"].showModal();
}

function toggleFailoverPrimary() {
  const form = elements["link-group-form"];
  const isFailover = form.elements.mode.value === "Failover";
  document.getElementById("failover-primary-field").hidden = !isFailover;
  form.elements.primaryLinkId.required = isFailover;
}

function describeLink(link) {
  if (!link) return "Unavailable cable";
  const source = findPort(state.topology, link.sourcePortId);
  const target = findPort(state.topology, link.targetPortId);
  return `${source?.device.name || "Unknown"} / ${source?.port.label || "?"} → ${target?.device.name || "Unknown"} / ${target?.port.label || "?"}`;
}

async function saveLinkGroup(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  try {
    const plan = planLinkGroup(
      state.topology,
      form.dataset.sourceLinkId,
      form.dataset.targetLinkId,
      {
        mode: String(data.get("mode")),
        name: String(data.get("name")),
        primaryLinkId: String(data.get("primaryLinkId") || ""),
        notes: String(data.get("notes")),
      },
    );
    let topology = state.topology;
    for (const groupID of plan.deleteGroupIDs) {
      topology = await api.deleteLinkGroup(topology.id, groupID, topology.revision);
    }
    topology = plan.action === "create" ?
      await api.createLinkGroup(topology.id, plan.group, topology.revision) :
      await api.updateLinkGroup(topology.id, plan.group, topology.revision);
    state.setTopology(topology, { remember: true });
    queueAnalysis();
    elements["link-group-dialog"].close();
    toast(`${plan.group.mode === "MCLAG" ? "MC-LAG" : plan.group.mode} group saved`);
  } catch (error) {
    showError(error);
    if (state.topology) state.setTopology(await api.getTopology(state.topology.id));
  }
}

async function removeLinkFromGroup(link, group) {
  if (!window.confirm(`Remove this cable from ${group.name}?`)) return;
  if (group.linkIds.length <= 2) {
    await updateFrom(() => api.deleteLinkGroup(state.topology.id, group.id), true, "Link group removed");
  } else {
    const next = structuredClone(group);
    next.linkIds = next.linkIds.filter((linkID) => linkID !== link.id);
    if (next.mode === "Failover" && next.primaryLinkId === link.id) next.primaryLinkId = next.linkIds[0];
    await updateFrom(() => api.updateLinkGroup(state.topology.id, next), true, "Cable removed from group");
  }
  renderInspector();
}

function openSwitchSystemDialog(device, system = null) {
  if (!device || device.category !== "Switch") return;
  const form = elements["switch-system-form"];
  form.dataset.systemId = system?.id || "";
  form.elements.name.value = system?.name || `${device.name} SYSTEM`;
  form.elements.notes.value = system?.notes || "";
  form.elements.mode.replaceChildren(...SwitchSystemModes.map((mode) => new Option(mode.label, mode.value)));
  const vendor = String(device.faceplate?.vendor || "").toLowerCase();
  const inferredMode = vendor.includes("aruba") ? "VSF" : vendor.includes("fortinet") ? "MCLAG" : vendor.includes("cisco") ? "StackWise" : "Stack";
  form.elements.mode.value = system?.mode || inferredMode;

  const selected = new Set(system?.deviceIds || [device.id]);
  const candidates = switchSystemCandidates(state.topology, system?.id || "");
  elements["switch-system-members"].replaceChildren(...candidates.map(({ device: candidate, membership, available }) => {
    const label = document.createElement("label");
    label.className = `switch-member-option${available ? "" : " is-unavailable"}`;
    const membershipLabel = membership && membership.id !== system?.id ? ` · IN ${membership.name}` : "";
    label.innerHTML = `<input type="checkbox" name="deviceId" value="${escapeHTML(candidate.id)}" ${selected.has(candidate.id) ? "checked" : ""} ${available ? "" : "disabled"}><span><b>${escapeHTML(candidate.name)}</b><small>${escapeHTML(candidate.faceplate?.vendor || "GENERIC")} · ${escapeHTML(candidate.model)}${escapeHTML(membershipLabel)}</small></span>`;
    return label;
  }));
  const updateMemberCount = () => {
    const count = new FormData(form).getAll("deviceId").length;
    elements["switch-system-member-count"].textContent = `${count} SELECTED`;
  };
  elements["switch-system-members"].querySelectorAll('input[name="deviceId"]').forEach((input) => input.addEventListener("change", updateMemberCount));
  updateMemberCount();
  elements["switch-system-dialog"].showModal();
}

async function saveSwitchSystem(event) {
  event.preventDefault();
  const form = event.currentTarget;
  try {
    const data = new FormData(form);
    const existing = (state.topology.switchSystems || []).find((system) => system.id === form.dataset.systemId) || null;
    const system = buildSwitchSystem(existing, {
      name: data.get("name"),
      mode: String(data.get("mode")),
      deviceIds: data.getAll("deviceId").map(String),
      notes: data.get("notes"),
    });
    const topology = await updateFrom(
      () => existing ? api.updateSwitchSystem(state.topology.id, system) : api.createSwitchSystem(state.topology.id, system),
      true,
      `${switchSystemModeLabel(system.mode)} saved as one logical unit`,
    );
    if (topology) elements["switch-system-dialog"].close();
  } catch (error) {
    showError(error);
  }
}

async function removeDeviceFromSwitchSystem(device, system) {
  if (!device || !system || !window.confirm(`Remove ${device.name} from ${system.name}?`)) return;
  if (system.deviceIds.length <= 2) {
    await updateFrom(() => api.deleteSwitchSystem(state.topology.id, system.id), true, "Logical switch system dissolved");
    return;
  }
  const next = structuredClone(system);
  next.deviceIds = next.deviceIds.filter((deviceID) => deviceID !== device.id);
  await updateFrom(() => api.updateSwitchSystem(state.topology.id, next), true, "Physical member removed");
}

async function dissolveSwitchSystem(system) {
  if (!system || !window.confirm(`Dissolve ${system.name}? Physical switches and cables will remain unchanged.`)) return;
  await updateFrom(() => api.deleteSwitchSystem(state.topology.id, system.id), true, "Logical switch system dissolved");
}

function openFirewallClusterDialog(device, cluster = null) {
  if (!device || device.category !== "Firewall") return;
  const form = elements["firewall-cluster-form"];
  form.dataset.clusterId = cluster?.id || "";
  form.dataset.preferredActiveDeviceId = cluster?.activeDeviceId || device.id;
  form.elements.name.value = cluster?.name || `${device.name} HA`;
  form.elements.notes.value = cluster?.notes || "";
  form.elements.mode.replaceChildren(...FirewallClusterModes.map((mode) => new Option(mode.label, mode.value)));
  form.elements.mode.value = cluster?.mode || "ActivePassive";

  const selected = new Set(cluster?.deviceIds || [device.id]);
  const candidates = firewallClusterCandidates(state.topology, cluster?.id || "");
  elements["firewall-cluster-members"].replaceChildren(...candidates.map(({ device: candidate, membership, available }) => {
    const label = document.createElement("label");
    label.className = `switch-member-option${available ? "" : " is-unavailable"}`;
    const membershipLabel = membership && membership.id !== cluster?.id ? ` · IN ${membership.name}` : "";
    label.innerHTML = `<input type="checkbox" name="deviceId" value="${escapeHTML(candidate.id)}" ${selected.has(candidate.id) ? "checked" : ""} ${available ? "" : "disabled"}><span><b>${escapeHTML(candidate.name)}</b><small>${escapeHTML(candidate.faceplate?.vendor || "GENERIC")} · ${escapeHTML(candidate.model)}${escapeHTML(membershipLabel)}</small></span>`;
    return label;
  }));
  elements["firewall-cluster-members"].querySelectorAll('input[name="deviceId"]').forEach((input) => input.addEventListener("change", refreshFirewallClusterForm));
  refreshFirewallClusterForm();
  elements["firewall-cluster-dialog"].showModal();
}

function refreshFirewallClusterForm() {
  const form = elements["firewall-cluster-form"];
  const data = new FormData(form);
  const selectedIDs = data.getAll("deviceId").map(String);
  const activeSelect = form.elements.activeDeviceId;
  const previous = activeSelect.value || form.dataset.preferredActiveDeviceId;
  activeSelect.replaceChildren(...selectedIDs.map((deviceID) => {
    const device = state.topology?.devices.find((candidate) => candidate.id === deviceID);
    return new Option(device?.name || "Unknown firewall", deviceID);
  }));
  activeSelect.value = selectedIDs.includes(previous) ? previous : selectedIDs[0] || "";
  form.dataset.preferredActiveDeviceId = activeSelect.value;
  const isActivePassive = form.elements.mode.value === "ActivePassive";
  document.getElementById("firewall-active-device-field").hidden = !isActivePassive;
  activeSelect.required = isActivePassive;
  elements["firewall-cluster-member-count"].textContent = `${selectedIDs.length} SELECTED`;
}

async function saveFirewallCluster(event) {
  event.preventDefault();
  const form = event.currentTarget;
  try {
    const data = new FormData(form);
    const existing = (state.topology.firewallClusters || []).find((cluster) => cluster.id === form.dataset.clusterId) || null;
    const cluster = buildFirewallCluster(existing, {
      name: data.get("name"),
      mode: String(data.get("mode")),
      deviceIds: data.getAll("deviceId").map(String),
      activeDeviceId: data.get("activeDeviceId"),
      notes: data.get("notes"),
    });
    const topology = await updateFrom(
      () => existing ? api.updateFirewallCluster(state.topology.id, cluster) : api.createFirewallCluster(state.topology.id, cluster),
      true,
      `${firewallClusterModeLabel(cluster.mode)} firewall cluster saved`,
    );
    if (topology) elements["firewall-cluster-dialog"].close();
  } catch (error) {
    showError(error);
  }
}

async function removeDeviceFromFirewallCluster(device, cluster) {
  if (!device || !cluster || !window.confirm(`Remove ${device.name} from ${cluster.name}?`)) return;
  if (cluster.deviceIds.length <= 2) {
    await updateFrom(() => api.deleteFirewallCluster(state.topology.id, cluster.id), true, "Firewall cluster dissolved");
    return;
  }
  const next = structuredClone(cluster);
  next.deviceIds = next.deviceIds.filter((deviceID) => deviceID !== device.id);
  if (next.mode === "ActivePassive" && next.activeDeviceId === device.id) next.activeDeviceId = next.deviceIds[0];
  await updateFrom(() => api.updateFirewallCluster(state.topology.id, next), true, "Firewall member removed");
}

async function dissolveFirewallCluster(cluster) {
  if (!cluster || !window.confirm(`Dissolve ${cluster.name}? Physical firewalls and cables will remain unchanged.`)) return;
  await updateFrom(() => api.deleteFirewallCluster(state.topology.id, cluster.id), true, "Firewall cluster dissolved");
}

async function deleteDevice(device) {
  if (!window.confirm(`Remove ${device.name} and all connected cables?`)) return;
  await updateFrom(() => api.deleteDevice(state.topology.id, device.id), true, "Device removed");
  state.select(null, null);
}

async function deleteRack(rack) {
  if (!rack || !window.confirm(`Delete ${rack.name}? Mounted devices will be released onto the canvas.`)) return;
  await updateFrom(() => api.deleteRack(state.topology.id, rack.id), true, "Rack removed; devices released");
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
  autosave.markDirty();
  try {
    const topology = await operation();
    state.setTopology(topology, { remember });
    autosave.markSaved();
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
  autosave.markDirty();
  await updateFrom(() => api.replaceTopology(state.topology), false, "Undo applied");
}

async function redo() {
  if (!state.redo()) return;
  autosave.markDirty();
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
  if ((event.ctrlKey || event.metaKey) && key === "s") { event.preventDefault(); saveNow().catch(showError); }
  if (event.key === "Delete" || event.key === "Backspace") {
    if (state.selection?.type === "link") deleteLink(state.topology.links.find((link) => link.id === state.selection.id));
    if (state.selection?.type === "rack") deleteRack((state.topology.racks || []).find((rack) => rack.id === state.selection.id));
    if (state.selection?.type === "device") deleteDevice(state.topology.devices.find((device) => device.id === state.selection.id));
    if (state.selection?.type === "annotation") deleteAnnotation((state.topology.annotations || []).find((annotation) => annotation.id === state.selection.id));
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
  notifications.push(message, "info");
}

function showError(error) {
  console.error(error);
  const message = error instanceof APIError ? error.message : error?.message || "Unexpected error";
  notifications.push(`ERROR · ${message}`, "error");
}

function isFormField(target) {
  return target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement || target instanceof HTMLButtonElement;
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

function mediaTypeOptions(selected) {
  const values = cableMediaTypes.includes(selected) || !selected ? cableMediaTypes : [selected, ...cableMediaTypes];
  return `${selected ? "" : '<option value="" selected>AUTO / UNSPECIFIED</option>'}${values.map((value) => `<option value="${escapeHTML(value)}" ${value === selected ? "selected" : ""}>${escapeHTML(value)}</option>`).join("")}`;
}
