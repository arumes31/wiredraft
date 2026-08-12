import {
  assignCableTracks, cableBezier, cableDashPattern, CABLE_OUTLINE_WIDTH, cableRole, orderedCableLinks,
  routeSegments, routesWithCrossingBridges,
} from "./cabling.js";
import { resolveFaceplateTemplate } from "./faceplate.js";
import { linkVLANPalette, vlanBandPattern } from "./link-vlan-colors.js";
import { linkGroupPortBadges } from "./link-group-display.js";
import { layoutEndpointBadges, linkEndpointBadges } from "./link-end-labels.js";
import { isRearPanelLink, RearPanelLinkVisual } from "./patch-panels.js";
import { connectorKind, connectorSize, portDescriptionPlacement } from "./termination.js";
import { buildConfigurationDocument } from "./configuration-report.js";

export { buildConfigurationDocument };

function download(name, blob) {
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(blob);
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(anchor.href), 1000);
}

function fileBase(topology) {
  return topology.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "network-topology";
}

export function exportJSON(topology) {
  download(`${fileBase(topology)}.json`, new Blob([JSON.stringify(topology, null, 2)], { type: "application/json" }));
}

export function exportPNG(topology, engine) {
  const canvas = engine.renderExport();
  canvas.toBlob((blob) => blob && download(`${fileBase(topology)}.png`, blob), "image/png");
}

export function exportSVG(topology, engine) {
  const document = buildSVGDocument(topology, engine);
  download(`${fileBase(topology)}.svg`, new Blob([document], { type: "image/svg+xml" }));
}

export async function exportPDF(topology, engine) {
  const canvas = engine.renderExport();
  const image = await canvasBlob(canvas, "image/jpeg", .94);
  const document = buildPDFDocument(new Uint8Array(await image.arrayBuffer()), canvas.width, canvas.height, topology.name);
  download(`${fileBase(topology)}.pdf`, new Blob([document], { type: "application/pdf" }));
}

export function exportHTML(topology, engine) {
  const document = buildHTMLDocument(topology, engine);
  download(`${fileBase(topology)}.html`, new Blob([document], { type: "text/html;charset=utf-8" }));
}

export function exportConfiguration(topology) {
  const document = buildConfigurationDocument(topology);
  download(`${fileBase(topology)}-configuration.html`, new Blob([document], { type: "text/html;charset=utf-8" }));
}

export function buildPDFDocument(jpegBytes, imageWidth, imageHeight, title = "Network topology") {
  if (!(jpegBytes instanceof Uint8Array) || jpegBytes.length === 0) throw new TypeError("PDF export requires JPEG bytes");
  if (!Number.isFinite(imageWidth) || !Number.isFinite(imageHeight) || imageWidth <= 0 || imageHeight <= 0) {
    throw new RangeError("PDF export requires positive image dimensions");
  }

  const landscape = imageWidth >= imageHeight;
  const pageWidth = landscape ? 1190.55 : 841.89;
  const pageHeight = landscape ? 841.89 : 1190.55;
  const margin = 24;
  const scale = Math.min((pageWidth - margin * 2) / imageWidth, (pageHeight - margin * 2) / imageHeight);
  const drawWidth = imageWidth * scale;
  const drawHeight = imageHeight * scale;
  const drawX = (pageWidth - drawWidth) / 2;
  const drawY = (pageHeight - drawHeight) / 2;
  const content = encodePDF(`q\n${pdfNumber(drawWidth)} 0 0 ${pdfNumber(drawHeight)} ${pdfNumber(drawX)} ${pdfNumber(drawY)} cm\n/Im0 Do\nQ\n`);
  const chunks = [];
  const offsets = [0];
  let length = 0;
  const append = (chunk) => {
    chunks.push(chunk);
    length += chunk.length;
  };
  const appendText = (value) => append(encodePDF(value));
  const appendObject = (number, body) => {
    offsets[number] = length;
    appendText(`${number} 0 obj\n${body}\nendobj\n`);
  };

  appendText("%PDF-1.4\n%WIREDRAFT\n");
  appendObject(1, "<< /Type /Catalog /Pages 2 0 R >>");
  appendObject(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  appendObject(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pdfNumber(pageWidth)} ${pdfNumber(pageHeight)}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  offsets[4] = length;
  appendText(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${Math.round(imageWidth)} /Height ${Math.round(imageHeight)} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`);
  append(jpegBytes);
  appendText("\nendstream\nendobj\n");
  offsets[5] = length;
  appendText(`5 0 obj\n<< /Length ${content.length} >>\nstream\n`);
  append(content);
  appendText("endstream\nendobj\n");
  appendObject(6, `<< /Title ${pdfUnicodeString(title)} /Creator ${pdfUnicodeString("WireDraft")} >>`);

  const xrefOffset = length;
  appendText("xref\n0 7\n0000000000 65535 f \n");
  for (let object = 1; object <= 6; object += 1) appendText(`${String(offsets[object]).padStart(10, "0")} 00000 n \n`);
  appendText(`trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);
  return concatenateBytes(chunks, length);
}

function standaloneExportCSS() {
  return `
    :root{color-scheme:dark;--ink:#e9f2f2;--muted:#8ea4a8;--cyan:#4ce2d1;--cyan-dim:#287a73;--line:#294247;--panel:#101a1d;--panel-strong:#162529;--warning:#f0b35a}
    *{box-sizing:border-box}[hidden]{display:none!important}html{min-height:100%;background:#071012}body{margin:0;min-height:100vh;color:var(--ink);background:#071012;background-image:linear-gradient(rgb(76 226 209/.045) 1px,transparent 1px),linear-gradient(90deg,rgb(76 226 209/.045) 1px,transparent 1px);background-size:32px 32px;font-family:Bahnschrift,"DIN Alternate","Arial Narrow",Arial,sans-serif}
    button,input{font:inherit}button{border:1px solid var(--line);color:var(--ink);background:#111d20;cursor:pointer}button:hover,button:focus-visible{border-color:var(--cyan);background:#1a2d30;outline:none}button[aria-pressed="true"]{border-color:var(--cyan);color:var(--cyan);box-shadow:inset 0 0 0 1px rgb(76 226 209/.18)}button:disabled{cursor:not-allowed;opacity:.38}
    body>header{position:relative;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:22px;align-items:end;padding:24px 30px 20px;border-bottom:1px solid var(--line);background:linear-gradient(135deg,rgb(22 39 43/.98),rgb(8 15 17/.96));box-shadow:0 16px 45px rgb(0 0 0/.32)}
    body>header::before{content:"";position:absolute;inset:0 auto 0 0;width:4px;background:var(--cyan);box-shadow:0 0 24px var(--cyan)}
    .eyebrow{margin:0 0 7px;color:var(--cyan);font-size:10px;font-weight:700;letter-spacing:.22em}.title{margin:0;font-size:clamp(24px,4vw,48px);font-stretch:condensed;letter-spacing:.015em}.subtitle{margin:8px 0 0;color:var(--muted);font-size:12px;letter-spacing:.08em}
    .stats{display:grid;grid-template-columns:repeat(4,minmax(66px,1fr));gap:1px;border:1px solid var(--line);background:var(--line)}.stats span{min-width:74px;padding:11px 13px;background:var(--panel);color:var(--muted);font-size:8px;letter-spacing:.14em}.stats b{display:block;margin-bottom:4px;color:var(--ink);font-size:20px;letter-spacing:0}
    .map-workspace{margin:22px 28px 28px;border:1px solid var(--line);border-radius:12px;overflow:hidden;background:#0a0f11;box-shadow:0 25px 80px rgb(0 0 0/.42)}
    .map-toolbar{position:relative;z-index:5;display:flex;min-height:58px;gap:10px;align-items:center;padding:9px 12px;border-bottom:1px solid var(--line);background:linear-gradient(180deg,#172428,#10191c)}
    .toolbar-group{display:flex;align-items:center;gap:5px}.toolbar-group button{height:34px;min-width:36px;padding:0 11px;border-radius:5px;font-size:10px;font-weight:700;letter-spacing:.08em}.toolbar-group button[data-action^="zoom"]{font-size:18px}.face-controls{margin-left:auto}.face-controls>span{color:var(--muted);font-size:8px;letter-spacing:.14em}
    .search-control{position:relative;width:min(360px,35vw)}.search-control label{display:block;margin-bottom:3px;color:var(--cyan);font-size:8px;font-weight:700;letter-spacing:.14em}.search-control input{width:100%;height:30px;padding:0 10px;border:1px solid var(--line);border-radius:4px;outline:0;color:var(--ink);background:#081012}.search-control input:focus{border-color:var(--cyan)}
    .search-results{position:absolute;top:52px;left:0;width:min(460px,80vw);max-height:330px;overflow:auto;padding:6px;border:1px solid var(--line);border-radius:6px;background:#0d1719;box-shadow:0 18px 50px rgb(0 0 0/.58)}.search-results button{display:grid;width:100%;gap:2px;padding:9px;border:0;border-bottom:1px solid #1e3034;text-align:left}.search-results button b{font-size:11px}.search-results button small{color:var(--muted);font-size:8px;letter-spacing:.08em}
    #map-status{min-width:76px;color:var(--muted);font-size:8px;letter-spacing:.1em;text-align:right}.map-layout{display:grid;grid-template-columns:minmax(0,1fr) 300px;height:clamp(560px,72vh,1100px)}
    #map-viewport{position:relative;min-width:0;overflow:hidden;touch-action:none;cursor:grab;background:#081012;background-image:linear-gradient(rgb(76 226 209/.035) 1px,transparent 1px),linear-gradient(90deg,rgb(76 226 209/.035) 1px,transparent 1px);background-size:32px 32px;outline:none}#map-viewport:focus-visible{box-shadow:inset 0 0 0 2px var(--cyan)}#map-viewport.is-dragging{cursor:grabbing}
    #map-scene{position:absolute;left:0;top:0;transform-origin:0 0;will-change:transform}#map-scene svg{display:block;max-width:none;height:auto;user-select:none;-webkit-user-select:none}
    .map-help{position:absolute;left:12px;bottom:10px;margin:0;padding:6px 9px;border:1px solid rgb(41 66 71/.7);border-radius:4px;color:#71868a;background:rgb(7 16 18/.88);font-size:8px;letter-spacing:.11em;pointer-events:none}
    #map-inspector{overflow:auto;padding:18px;border-left:1px solid var(--line);background:linear-gradient(180deg,#111d20,#0a1113)}#map-inspector h2{margin:0 0 4px;font-size:18px;letter-spacing:.05em}#map-inspector>p:not(.eyebrow){color:var(--muted);font-size:11px;line-height:1.55}#map-inspector dl{display:grid;grid-template-columns:92px minmax(0,1fr);gap:0;margin:18px 0 0;border-top:1px solid var(--line)}#map-inspector dt,#map-inspector dd{min-width:0;margin:0;padding:9px 0;border-bottom:1px solid #1f3034;font-size:10px}#map-inspector dt{color:var(--muted);letter-spacing:.09em}#map-inspector dd{overflow-wrap:anywhere;color:var(--ink)}#map-inspector .inspector-tag{display:inline-block;margin-bottom:8px;padding:4px 6px;border:1px solid var(--cyan-dim);border-radius:3px;color:var(--cyan);font-size:8px;letter-spacing:.13em}
    #topology-map [data-entity]{transition:opacity .14s ease,filter .14s ease}#topology-map [data-entity="device"],#topology-map [data-entity="port"],#topology-map [data-entity="link"],#topology-map [data-entity="channel"],#topology-map [data-entity="rack"]{cursor:pointer}
    #topology-map.has-focus>[data-entity],#topology-map.has-focus>g[data-entity]{opacity:.16}#topology-map.has-focus [data-entity="port"]{opacity:.28}#topology-map .is-highlighted{opacity:1!important;filter:drop-shadow(0 0 5px rgb(76 226 209/.9))}#topology-map .is-peer{opacity:.78!important;filter:drop-shadow(0 0 3px rgb(240 179 90/.72))}#topology-map .is-selected{opacity:1!important;filter:drop-shadow(0 0 8px var(--cyan))}#topology-map .is-search-match{opacity:1!important;filter:drop-shadow(0 0 6px var(--warning))}#topology-map [data-filtered="true"]{display:none}
    .documents{margin:0 28px 28px;padding:20px;border:1px solid var(--line);background:var(--panel)}.documents h2{margin:0 0 14px;font-size:14px;letter-spacing:.12em}.documents div{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:8px}.documents a{display:grid;gap:3px;padding:11px;border:1px solid var(--line);color:var(--ink);text-decoration:none}.documents a:hover,.documents a:focus-visible{border-color:var(--cyan);outline:none}.documents a span{color:var(--cyan);font-size:8px;letter-spacing:.12em}.documents a small{overflow:hidden;color:var(--muted);text-overflow:ellipsis;white-space:nowrap}
    footer{display:flex;justify-content:space-between;gap:20px;padding:0 34px 28px;color:var(--muted);font-size:9px;letter-spacing:.12em}footer strong{color:var(--cyan)}
    @media(max-width:980px){.map-layout{grid-template-columns:1fr;height:auto}#map-viewport{height:66vh;min-height:480px}#map-inspector{max-height:360px;border-top:1px solid var(--line);border-left:0}.map-toolbar{flex-wrap:wrap}.face-controls{margin-left:0}#map-status{margin-left:auto}}
    @media(max-width:760px){body>header{grid-template-columns:1fr;padding:20px}.stats{grid-template-columns:repeat(2,1fr)}.map-workspace{margin:12px}.map-toolbar{align-items:end}.search-control{width:100%;flex-basis:100%}.map-help{display:none}.documents{margin:0 12px 18px}footer{padding:8px 18px 24px;flex-direction:column}}
    @media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}#topology-map [data-entity]{transition:none}}
    @media print{body{background:#0a0f11}.map-toolbar,#map-inspector,.map-help{display:none}.map-workspace{margin:12px;border:0;box-shadow:none}.map-layout{display:block;height:auto}#map-viewport{height:auto;overflow:visible}#map-scene{position:static!important;transform:none!important}#map-scene svg{width:100%;height:auto}.documents{margin:12px}footer{padding:8px 12px}@page{size:landscape;margin:8mm}}
  `;
}

function standaloneExportBootstrap() {
  "use strict";
  const topologyNode = document.getElementById("wiredraft-topology");
  const viewport = document.getElementById("map-viewport");
  const scene = document.getElementById("map-scene");
  const svg = document.getElementById("topology-map");
  const inspector = document.getElementById("map-inspector");
  const search = document.getElementById("map-search");
  const searchResults = document.getElementById("map-search-results");
  const status = document.getElementById("map-status");
  if (!topologyNode || !viewport || !scene || !svg || !inspector) return;

  let topology;
  try { topology = JSON.parse(topologyNode.textContent || "{}"); } catch { topology = {}; }
  const racks = new Map((topology.racks || []).map((rack) => [rack.id, rack]));
  const devices = new Map((topology.devices || []).map((device) => [device.id, device]));
  const links = new Map((topology.links || []).map((link) => [link.id, link]));
  const groups = topology.linkGroups || [];
  const ports = new Map();
  for (const device of devices.values()) for (const port of device.ports || []) ports.set(port.id, { device, port });
  const viewBox = (svg.getAttribute("viewBox") || "0 0 1 1").split(/\s+/).map(Number);
  const mapSize = { width: viewBox[2] || Number(svg.getAttribute("width")) || 1, height: viewBox[3] || Number(svg.getAttribute("height")) || 1 };
  const view = { x: 0, y: 0, scale: 1, dragging: false, moved: false, startX: 0, startY: 0, originX: 0, originY: 0, downEntity: null };
  let selected = null;
  let hovered = null;

  const entityElements = () => [...svg.querySelectorAll("[data-entity]")];
  const elementsWith = (attribute, value) => entityElements().filter((element) => element.getAttribute(attribute) === String(value));
  const valueFor = (element, kind) => element?.getAttribute(`data-${kind}-id`) || "";
  const entityFrom = (target) => {
    const element = target instanceof Element ? target.closest("[data-entity]") : null;
    if (!element || !svg.contains(element)) return null;
    const kind = element.getAttribute("data-entity");
    return { kind, id: valueFor(element, kind), element };
  };
  const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
  const setStatus = (message) => { status.textContent = message; };
  const applyView = () => {
    scene.style.transform = `translate(${view.x}px,${view.y}px) scale(${view.scale})`;
    setStatus(`${Math.round(view.scale * 100)}%`);
  };
  const fit = () => {
    const padding = 28;
    view.scale = clamp(Math.min((viewport.clientWidth - padding * 2) / mapSize.width, (viewport.clientHeight - padding * 2) / mapSize.height), .04, 4);
    view.x = (viewport.clientWidth - mapSize.width * view.scale) / 2;
    view.y = (viewport.clientHeight - mapSize.height * view.scale) / 2;
    applyView();
  };
  const zoomAt = (factor, clientX, clientY) => {
    const rect = viewport.getBoundingClientRect();
    const pointX = clientX - rect.left;
    const pointY = clientY - rect.top;
    const worldX = (pointX - view.x) / view.scale;
    const worldY = (pointY - view.y) / view.scale;
    view.scale = clamp(view.scale * factor, .04, 8);
    view.x = pointX - worldX * view.scale;
    view.y = pointY - worldY * view.scale;
    applyView();
  };
  const resetClasses = () => {
    svg.classList.remove("has-focus");
    for (const element of entityElements()) element.classList.remove("is-highlighted", "is-peer", "is-selected");
  };
  const addClass = (attribute, value, className) => {
    for (const element of elementsWith(attribute, value)) element.classList.add(className);
  };
  const connectedLinkIDs = (deviceID, portID = "") => [...links.values()].filter((link) =>
    portID ? link.sourcePortId === portID || link.targetPortId === portID : link.sourceDeviceId === deviceID || link.targetDeviceId === deviceID).map((link) => link.id);
  const groupLinkIDs = (linkID) => groups.find((group) => (group.linkIds || []).includes(linkID))?.linkIds || [linkID];
  const highlightLink = (linkID, className = "is-highlighted") => {
    const link = links.get(linkID);
    if (!link) return;
    addClass("data-link-id", linkID, className);
    addClass("data-device-id", link.sourceDeviceId, "is-highlighted");
    addClass("data-device-id", link.targetDeviceId, "is-highlighted");
    addClass("data-port-id", link.sourcePortId, "is-highlighted");
    addClass("data-port-id", link.targetPortId, "is-highlighted");
    for (const element of elementsWith("data-link-id", linkID)) {
      const channelID = element.getAttribute("data-channel");
      if (channelID) addClass("data-channel-id", channelID, "is-highlighted");
    }
    if (link.rearChannelId) addClass("data-channel-id", link.rearChannelId, "is-highlighted");
  };
  const focusEntity = (entity, persist = false) => {
    resetClasses();
    if (!entity) return;
    svg.classList.add("has-focus");
    const { kind, id } = entity;
    if (kind === "link") {
      for (const peerID of groupLinkIDs(id)) highlightLink(peerID, peerID === id ? "is-highlighted" : "is-peer");
    } else if (kind === "device") {
      addClass("data-device-id", id, "is-highlighted");
      for (const linkID of connectedLinkIDs(id)) highlightLink(linkID);
    } else if (kind === "port") {
      const owner = ports.get(id)?.device;
      if (owner) addClass("data-device-id", owner.id, "is-highlighted");
      addClass("data-port-id", id, "is-highlighted");
      for (const linkID of connectedLinkIDs(owner?.id, id)) highlightLink(linkID);
    } else if (kind === "rack") {
      addClass("data-rack-id", id, "is-highlighted");
      for (const device of devices.values()) if (device.rackId === id) {
        addClass("data-device-id", device.id, "is-highlighted");
        for (const linkID of connectedLinkIDs(device.id)) highlightLink(linkID);
      }
    } else if (kind === "channel") {
      addClass("data-channel-id", id, "is-highlighted");
      const channelLinks = [...new Set(elementsWith("data-channel", id).map((element) => element.getAttribute("data-link-id")).filter(Boolean))];
      for (const linkID of channelLinks) highlightLink(linkID);
    }
    addClass(`data-${kind}-id`, id, persist ? "is-selected" : "is-highlighted");
  };
  const text = (value, fallback = "—") => value === undefined || value === null || value === "" ? fallback : String(value);
  const endpoint = (link, side) => {
    const device = devices.get(link?.[`${side}DeviceId`]);
    const port = ports.get(link?.[`${side}PortId`])?.port;
    return `${device?.name || "Unknown device"}:${port?.label || "Unknown port"} [${text(link?.[`${side}Side`], "front").toUpperCase()}]`;
  };
  const renderInspector = (entity) => {
    if (!entity) return;
    let heading = "OBJECT";
    let subheading = entity.id;
    let rows = [];
    if (entity.kind === "rack") {
      const rack = racks.get(entity.id) || {};
      const rackDevices = [...devices.values()].filter((device) => device.rackId === rack.id);
      heading = "RACK"; subheading = text(rack.name, entity.id);
      rows = [["HEIGHT", `${text(rack.heightU, 0)}U`], ["DEVICES", rackDevices.length], ["POSITION", `${text(rack.positionX, 0)}, ${text(rack.positionY, 0)}`]];
    } else if (entity.kind === "device") {
      const device = devices.get(entity.id) || {};
      const rack = racks.get(device.rackId);
      heading = text(device.category, "DEVICE").toUpperCase(); subheading = text(device.name, entity.id);
      rows = [["MODEL", device.model], ["VENDOR", device.faceplate?.vendor], ["LOCATION", rack ? `${rack.name} · ${text(device.rackFace, "front").toUpperCase()} · U${text(device.rackUnit, "—")}` : "FREE CANVAS"], ["HOSTNAME", device.hostname], ["MGMT IP", device.managementIp], ["PORTS", (device.ports || []).length], ["CABLES", connectedLinkIDs(device.id).length], ["NOTES", device.notes]];
    } else if (entity.kind === "port") {
      const record = ports.get(entity.id) || {};
      const linkIDs = connectedLinkIDs(record.device?.id, entity.id);
      heading = "PORT"; subheading = `${text(record.device?.name, "DEVICE")}:${text(record.port?.label, entity.id)}`;
      rows = [["TYPE", record.port?.type], ["GROUP", record.port?.group], ["SPEED", record.port?.speedMbps ? `${record.port.speedMbps} Mbps` : "—"], ["STATUS", record.port?.status], ["MODE", record.port?.mode], ["LINKS", linkIDs.length ? linkIDs.join(", ") : "UNCONNECTED"]];
    } else if (entity.kind === "link") {
      const link = links.get(entity.id) || {};
      const group = groups.find((candidate) => (candidate.linkIds || []).includes(entity.id));
      heading = "CABLE"; subheading = text(link.name, entity.id);
      rows = [["SOURCE", endpoint(link, "source")], ["TARGET", endpoint(link, "target")], ["TYPE", link.cableType], ["GROUP", group ? `${group.name} · ${group.mode}` : "INDEPENDENT"], ["VLAN", link.primaryVlan], ["CHANNEL", link.rearChannelName || link.rearChannelId], ["NOTES", link.notes]];
    } else if (entity.kind === "channel") {
      const channelElements = elementsWith("data-channel-id", entity.id);
      const channelLinks = [...new Set(elementsWith("data-channel", entity.id).map((element) => element.getAttribute("data-link-id")).filter(Boolean))];
      heading = "REAR TUBE"; subheading = channelElements[0]?.getAttribute("data-channel-name") || entity.id;
      rows = [["CHANNEL ID", entity.id], ["STRANDS", channelElements[0]?.getAttribute("data-strands")], ["CABLES", channelLinks.length ? channelLinks.join(", ") : "—"]];
    }
    inspector.replaceChildren();
    const tag = document.createElement("span"); tag.className = "inspector-tag"; tag.textContent = heading;
    const title = document.createElement("h2"); title.textContent = subheading;
    const description = document.createElement("p"); description.textContent = "Embedded export data · read-only";
    const list = document.createElement("dl");
    for (const [label, value] of rows) {
      const term = document.createElement("dt"); term.textContent = label;
      const detail = document.createElement("dd"); detail.textContent = text(value);
      list.append(term, detail);
    }
    inspector.append(tag, title, description, list);
  };
  const selectEntity = (entity) => {
    selected = entity ? { kind: entity.kind, id: entity.id } : null;
    focusEntity(selected, true);
    if (selected) renderInspector(selected);
  };
  const centerEntity = (entity) => {
    const matches = elementsWith(`data-${entity.kind}-id`, entity.id).filter((element) => !element.closest("[data-filtered='true']"));
    if (!matches.length) return;
    let bounds = null;
    for (const element of matches) {
      let box; try { box = element.getBBox(); } catch { continue; }
      if (!bounds) bounds = { x: box.x, y: box.y, right: box.x + box.width, bottom: box.y + box.height };
      else { bounds.x = Math.min(bounds.x, box.x); bounds.y = Math.min(bounds.y, box.y); bounds.right = Math.max(bounds.right, box.x + box.width); bounds.bottom = Math.max(bounds.bottom, box.y + box.height); }
    }
    if (!bounds) return;
    view.x = viewport.clientWidth / 2 - ((bounds.x + bounds.right) / 2) * view.scale;
    view.y = viewport.clientHeight / 2 - ((bounds.y + bounds.bottom) / 2) * view.scale;
    applyView();
  };
  const searchable = [];
  for (const rack of racks.values()) searchable.push({ kind: "rack", id: rack.id, name: rack.name, detail: `${rack.heightU || 0}U rack` });
  for (const device of devices.values()) {
    searchable.push({ kind: "device", id: device.id, name: device.name, detail: `${device.model || device.category || "Device"}` });
    for (const port of device.ports || []) searchable.push({ kind: "port", id: port.id, name: `${device.name}:${port.label}`, detail: `${port.type || "Port"} · ${port.group || "Ungrouped"}` });
  }
  for (const link of links.values()) searchable.push({ kind: "link", id: link.id, name: link.name || `${endpoint(link, "source")} → ${endpoint(link, "target")}`, detail: link.cableType || "Cable" });
  const showSearch = () => {
    const query = (search.value || "").trim().toLowerCase();
    searchResults.replaceChildren();
    for (const element of entityElements()) element.classList.remove("is-search-match");
    if (!query) { searchResults.hidden = true; if (selected) focusEntity(selected, true); return; }
    const matches = searchable.filter((item) => `${item.name} ${item.detail} ${item.id}`.toLowerCase().includes(query)).slice(0, 16);
    for (const item of matches) {
      addClass(`data-${item.kind}-id`, item.id, "is-search-match");
      const button = document.createElement("button"); button.type = "button";
      const title = document.createElement("b"); title.textContent = item.name;
      const detail = document.createElement("small"); detail.textContent = `${item.kind.toUpperCase()} · ${item.detail}`;
      button.append(title, detail);
      button.addEventListener("click", () => { selectEntity(item); centerEntity(item); searchResults.hidden = true; search.value = item.name; });
      searchResults.append(button);
    }
    searchResults.hidden = matches.length === 0;
    setStatus(`${matches.length} MATCH${matches.length === 1 ? "" : "ES"}`);
  };
  const applyFaceFilter = (face) => {
    for (const element of svg.querySelectorAll('[data-entity="device"]')) {
      const deviceFace = element.getAttribute("data-rack-face") || "front";
      element.setAttribute("data-filtered", face !== "all" && deviceFace !== "free" && deviceFace !== face ? "true" : "false");
    }
    for (const element of svg.querySelectorAll('[data-entity="link"]')) {
      const sourceFace = element.getAttribute("data-source-face") || "front";
      const targetFace = element.getAttribute("data-target-face") || "front";
      element.setAttribute("data-filtered", face !== "all" && sourceFace !== face && targetFace !== face ? "true" : "false");
    }
    for (const button of document.querySelectorAll("[data-face]")) button.setAttribute("aria-pressed", String(button.getAttribute("data-face") === face));
    setStatus(`${face.toUpperCase()} FACE`);
  };

  viewport.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 && event.button !== 1) return;
    view.dragging = true; view.moved = false; view.startX = event.clientX; view.startY = event.clientY; view.originX = view.x; view.originY = view.y; view.downEntity = entityFrom(event.target);
    viewport.classList.add("is-dragging"); viewport.setPointerCapture(event.pointerId); event.preventDefault();
  });
  viewport.addEventListener("pointermove", (event) => {
    if (view.dragging) {
      const dx = event.clientX - view.startX; const dy = event.clientY - view.startY;
      if (Math.hypot(dx, dy) > 4) view.moved = true;
      view.x = view.originX + dx; view.y = view.originY + dy; applyView(); return;
    }
    const entity = entityFrom(event.target);
    if (entity?.kind === hovered?.kind && entity?.id === hovered?.id) return;
    hovered = entity;
    if (hovered) focusEntity(hovered, false); else if (selected) focusEntity(selected, true); else resetClasses();
  });
  const finishPointer = (event) => {
    if (!view.dragging) return;
    viewport.classList.remove("is-dragging");
    if (!view.moved) selectEntity(view.downEntity || entityFrom(event.target));
    view.dragging = false; view.downEntity = null;
  };
  viewport.addEventListener("pointerup", finishPointer); viewport.addEventListener("pointercancel", finishPointer);
  viewport.addEventListener("pointerleave", () => { hovered = null; if (!view.dragging) selected ? focusEntity(selected, true) : resetClasses(); });
  viewport.addEventListener("wheel", (event) => {
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) zoomAt(Math.exp(-event.deltaY * .002), event.clientX, event.clientY);
    else { view.x -= event.deltaX || (event.shiftKey ? event.deltaY : 0); view.y -= event.shiftKey ? 0 : event.deltaY; applyView(); }
  }, { passive: false });
  viewport.addEventListener("dblclick", (event) => { zoomAt(1.5, event.clientX, event.clientY); event.preventDefault(); });
  viewport.addEventListener("keydown", (event) => {
    const amount = event.shiftKey ? 90 : 32;
    if (["+", "="].includes(event.key)) zoomAt(1.25, viewport.getBoundingClientRect().left + viewport.clientWidth / 2, viewport.getBoundingClientRect().top + viewport.clientHeight / 2);
    else if (event.key === "-") zoomAt(.8, viewport.getBoundingClientRect().left + viewport.clientWidth / 2, viewport.getBoundingClientRect().top + viewport.clientHeight / 2);
    else if (event.key === "0" || event.key.toLowerCase() === "f") fit();
    else if (event.key === "ArrowLeft") { view.x += amount; applyView(); }
    else if (event.key === "ArrowRight") { view.x -= amount; applyView(); }
    else if (event.key === "ArrowUp") { view.y += amount; applyView(); }
    else if (event.key === "ArrowDown") { view.y -= amount; applyView(); }
    else if (event.key === "Escape") { selected = null; resetClasses(); search.value = ""; searchResults.hidden = true; }
    else return;
    event.preventDefault();
  });
  document.querySelector('[data-action="zoom-in"]').addEventListener("click", () => zoomAt(1.25, viewport.getBoundingClientRect().left + viewport.clientWidth / 2, viewport.getBoundingClientRect().top + viewport.clientHeight / 2));
  document.querySelector('[data-action="zoom-out"]').addEventListener("click", () => zoomAt(.8, viewport.getBoundingClientRect().left + viewport.clientWidth / 2, viewport.getBoundingClientRect().top + viewport.clientHeight / 2));
  document.querySelector('[data-action="fit"]').addEventListener("click", fit);
  document.querySelector('[data-action="reset"]').addEventListener("click", () => { view.scale = 1; view.x = 24; view.y = 24; applyView(); });
  const availableFaces = new Set([...svg.querySelectorAll('[data-entity="device"]')].map((element) => element.getAttribute("data-rack-face")));
  for (const button of document.querySelectorAll("[data-face]")) {
    const face = button.getAttribute("data-face");
    if (face !== "all" && !availableFaces.has(face)) {
      button.disabled = true;
      button.title = `No ${face} faceplates are present in this exported view`;
    }
    button.addEventListener("click", () => applyFaceFilter(face));
  }
  search.addEventListener("input", showSearch); search.addEventListener("keydown", (event) => { if (event.key === "Escape") { search.value = ""; showSearch(); viewport.focus(); } });
  window.addEventListener("resize", () => { if (Math.abs(view.scale - 1) < .001 && view.x === 0 && view.y === 0) fit(); });
  requestAnimationFrame(fit);
}

export function buildHTMLDocument(topology, engine, generatedAt = new Date()) {
  const svg = buildSVGDocument(topology, engine).replace(
    "<svg ",
    `<svg role="img" aria-label="${escapeXML(topology.name)} network topology" `,
  );
  const exportedAt = generatedAt instanceof Date ? generatedAt : new Date(generatedAt);
  const timestamp = Number.isNaN(exportedAt.getTime()) ? "" : exportedAt.toISOString();
  const counts = {
    racks: (topology.racks || []).length,
    devices: (topology.devices || []).length,
    links: (topology.links || []).length,
    vlans: (topology.vlans || []).length,
  };
  const embeddedTopology = JSON.stringify(topology).replace(/[<>&]/g, (char) => ({ "<": "\\u003c", ">": "\\u003e", "&": "\\u0026" })[char]);
  const documentation = (topology.documentationLinks || []).map((item) => `<a href="${escapeHTML(item.url)}" target="_blank" rel="noopener noreferrer"><span>${escapeHTML(item.targetKind.toUpperCase())}</span><b>${escapeHTML(item.label)}</b><small>${escapeHTML(item.url)}</small></a>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="generator" content="WireDraft">
  <title>${escapeHTML(topology.name)} · WireDraft export</title>
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='12' fill='%23071012'/%3E%3Cpath d='M16 12v40M48 12v40M22 19h20M22 32h20M22 45h20' fill='none' stroke='%2336d7d0' stroke-width='6'/%3E%3Cpath d='M16 48 48 16' fill='none' stroke='%23ffb84a' stroke-width='5'/%3E%3Cg fill='%23ffb84a' stroke='%23071012' stroke-width='3'%3E%3Ccircle cx='16' cy='48' r='6'/%3E%3Ccircle cx='48' cy='16' r='6'/%3E%3C/g%3E%3C/svg%3E" type="image/svg+xml">
  <style id="wiredraft-export-css">${standaloneExportCSS()}</style>
</head>
<body>
  <header>
    <section><p class="eyebrow">WIREDRAFT · STANDALONE EXPORT</p><h1 class="title">${escapeHTML(topology.name)}</h1><p class="subtitle">${escapeHTML([topology.organization, topology.location].filter(Boolean).join(" / ") || "UNASSIGNED")} · Portable physical topology report · source data embedded</p></section>
    <section class="stats" aria-label="Topology totals"><span><b>${counts.racks}</b>RACKS</span><span><b>${counts.devices}</b>DEVICES</span><span><b>${counts.links}</b>CABLES</span><span><b>${counts.vlans}</b>VLANS</span></section>
  </header>
  <section class="map-workspace" aria-label="Interactive topology explorer">
    <nav class="map-toolbar" aria-label="Map controls">
      <div class="search-control"><label for="map-search">FIND IN MAP</label><input id="map-search" type="search" autocomplete="off" placeholder="Rack, device, port or cable"><div id="map-search-results" class="search-results" hidden></div></div>
      <div class="toolbar-group" aria-label="Zoom controls"><button type="button" data-action="zoom-out" aria-label="Zoom out">−</button><button type="button" data-action="zoom-in" aria-label="Zoom in">+</button><button type="button" data-action="fit">FIT MAP</button><button type="button" data-action="reset">100%</button></div>
      <div class="toolbar-group face-controls" aria-label="Rack face filter"><span>FACE</span><button type="button" data-face="all" aria-pressed="true">ALL</button><button type="button" data-face="front" aria-pressed="false">FRONT</button><button type="button" data-face="rear" aria-pressed="false">REAR</button></div>
      <output id="map-status" aria-live="polite">READY</output>
    </nav>
    <div class="map-layout">
      <main id="map-viewport" tabindex="0" aria-label="Interactive exported topology map">
        <div id="map-scene">${svg}</div>
        <p class="map-help">DRAG TO PAN · WHEEL TO PAN · CTRL/CMD + WHEEL TO ZOOM · CLICK AN OBJECT TO INSPECT</p>
      </main>
      <aside id="map-inspector" aria-live="polite"><p class="eyebrow">MAP INSPECTOR</p><h2>SELECT AN OBJECT</h2><p>Click a rack, device, port, cable, or tube to inspect its embedded data.</p></aside>
    </div>
  </section>
  ${documentation ? `<section class="documents"><h2>ATTACHED DOCUMENTATION</h2><div>${documentation}</div></section>` : ""}
  <footer><span><strong>WIREDRAFT</strong> · SELF-CONTAINED HTML</span><time datetime="${timestamp}">${timestamp ? `GENERATED ${escapeHTML(timestamp)}` : ""}</time></footer>
  <script id="wiredraft-topology" type="application/json">${embeddedTopology}</script>
  <script>(${standaloneExportBootstrap.toString()})();</script>
</body>
</html>`;
}

export function buildSVGDocument(topology, engine) {
  const bounds = engine.worldBounds();
  const offsetX = 50 - bounds.x;
  const offsetY = 50 - bounds.y;
  const width = Math.ceil(bounds.width + 100);
  const height = Math.ceil(bounds.height + 100);
  const portPoints = engine.portCenters();
  const rackBoxes = engine.rackRectangles();
  const deviceBoxList = engine.deviceRectangles();
  const deviceBoxes = new Map(deviceBoxList.map((box) => [box.device.id, box]));
  const portGeometry = new Map(topology.devices.flatMap((device) => device.ports.map((port) => {
    const point = portPoints.get(port.id); const size = connectorSize(port.type);
    return [port.id, point ? { x: point.x - size.width / 2, y: point.y - size.height / 2, width: size.width, height: size.height } : null];
  })).filter(([, box]) => box));
  const portBoxes = topology.devices.flatMap((device) => device.ports.map((port) => {
    const point = portPoints.get(port.id);
    const geometry = portGeometry.get(port.id);
    return point && geometry ? {
      port,
      device,
      ...geometry,
      centerX: point.x,
      centerY: point.y,
    } : null;
  })).filter(Boolean);
  const renderedLinks = [];
  const groupByLink = new Map();
  for (const group of topology.linkGroups || []) {
    for (const linkID of group.linkIds || []) groupByLink.set(linkID, group);
  }
  const orderedLinks = orderedCableLinks(topology);
  const baseTracks = assignCableTracks({
    links: orderedLinks,
    portBoxes,
    deviceBoxes: deviceBoxList,
    rackBoxes,
    linkGroups: topology.linkGroups || [],
  });
  const portBoxMap = new Map(portBoxes.map((box) => [box.port.id, box]));
  const renderedPortLabels = [];
  const parts = [`<svg id="topology-map" data-export-version="2" xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">`,
    `<style>text{font-family:'DIN Condensed',sans-serif}.name{font-size:14px;font-weight:bold;letter-spacing:1px}.model{font-size:9px}.port{fill:#091012;stroke:#60757a;stroke-width:1}.port-label{font-weight:700;text-anchor:middle;dominant-baseline:middle}</style>`,
    `<rect width="100%" height="100%" fill="#0a0f11"/>`];
  for (const box of rackBoxes) {
    const x = box.x + offsetX; const y = box.y + offsetY;
    parts.push(`<g data-entity="rack" data-rack-id="${escapeXML(box.rack.id)}" data-name="${escapeXML(box.rack.name)}"><title>${escapeXML(box.rack.name)} · ${box.rack.heightU}U rack</title>`);
    parts.push(`<rect x="${x}" y="${y}" width="${box.width}" height="${box.height}" rx="7" fill="#070d0f" stroke="${box.rack.color}" stroke-width="2"/>`);
    parts.push(`<rect x="${x + 2}" y="${y + 2}" width="${box.width - 4}" height="62" fill="${box.rack.color}"/>`);
    parts.push(`<text class="name" x="${x + 26}" y="${y + 29}" fill="#e5eeee">${escapeXML(box.rack.name)}</text>`);
    parts.push(`<text class="model" x="${x + 26}" y="${y + 47}" fill="#71868a">${box.rack.heightU}U RACK</text>`);
    for (let unit = 0; unit <= box.rack.heightU; unit += 1) {
      const lineY = y + 64 + unit * 100;
      parts.push(`<path d="M${x + 30} ${lineY}H${x + box.width - 30}" stroke="#304347" stroke-width="1"/>`);
    }
    parts.push(`</g>`);
  }
  const plannedLinks = [];
  for (const link of orderedLinks) {
    const source = portPoints.get(link.sourcePortId);
    const target = portPoints.get(link.targetPortId);
    if (!source || !target) continue;
    const group = groupByLink.get(link.id);
    const baseRoute = baseTracks.get(link.id) || cableBezier(source, target);
    const role = cableRole(link, portBoxMap.get(link.sourcePortId), portBoxMap.get(link.targetPortId), {
      crossRack: baseRoute.crossRack,
      group,
    });
    const dash = cableDashPattern(link, portBoxMap.get(link.sourcePortId), portBoxMap.get(link.targetPortId), { group, role });
    plannedLinks.push({ link, group, baseRoute, role, dash });
  }
  const bridgedRoutes = routesWithCrossingBridges(plannedLinks.map(({ baseRoute }) => baseRoute));
  for (let index = 0; index < plannedLinks.length; index += 1) {
    const { link, group, baseRoute, role, dash } = plannedLinks[index];
    const route = bridgedRoutes[index];
    const translated = translateRoute(route, offsetX, offsetY);
    const palette = linkVLANPalette(topology, link);
    const path = svgRoutePath(translated);
    const basePath = svgRoutePath(translateRoute(baseRoute, offsetX, offsetY));
    renderedLinks.push({
      link, group, route, path, basePath, palette, role, dash,
      badges: linkEndpointBadges(topology, link, translated),
      rearMapping: isRearPanelLink(link),
      rearChannelSheath: baseRoute.rearChannelSheath ? {
        ...baseRoute.rearChannelSheath,
        route: translateRoute(baseRoute.rearChannelSheath.route, offsetX, offsetY),
      } : null,
    });
  }
  for (const device of topology.devices) {
    const box = deviceBoxes.get(device.id);
    if (!box) continue;
    const x = box.x + offsetX; const y = box.y + offsetY;
    const heightU = box.height;
    const template = resolveFaceplateTemplate(device);
    const statusArea = template.statusArea || { x: .219, y: .5, width: 38, height: 40 };
    const statusX = x + statusArea.x * 690;
    const statusY = y + statusArea.y * heightU - statusArea.height / 2;
    const rackFace = device.rackId ? (device.rackFace === "rear" ? "rear" : "front") : "free";
    parts.push(`<g data-layer="faceplate" data-entity="device" data-device-id="${escapeXML(device.id)}" data-rack-id="${escapeXML(device.rackId || "")}" data-rack-face="${rackFace}" data-name="${escapeXML(device.name)}" data-template="${template.id}"><title>${escapeXML(device.name)} · ${escapeXML(device.model || device.category || "Device")}</title>`);
    parts.push(`<rect x="${x}" y="${y}" width="690" height="${heightU}" rx="8" fill="${template.surface}" stroke="#687b7f"/>`);
    parts.push(`<path d="M${x + 20} ${y + 5}H${x + 670}" stroke="rgba(255,255,255,.28)"/>`);
    if (template.control !== "passive") parts.push(`<rect data-layer="status-area" x="${statusX}" y="${statusY}" width="${statusArea.width}" height="${statusArea.height}" rx="3" fill="${template.surfaceDark}" opacity=".72"/>`);
    if (!["lcm", "server", "passive"].includes(statusArea.kind)) {
      const statusColors = [template.accent, "#55c98e", "#536265", "#536265"];
      for (let index = 0; index < 4; index += 1) {
        parts.push(`<circle data-layer="status-indicator" cx="${statusX + 10 + (index % 2) * 13}" cy="${statusY + 10 + Math.floor(index / 2) * 14}" r="2" fill="${statusColors[index]}"/>`);
      }
    }
    if (template.modules) parts.push(`<rect x="${x + 202}" y="${y + 10}" width="425" height="${Math.max(20, heightU - 20)}" rx="3" fill="none" stroke="${template.ink}" opacity=".2"/>`);
    if (template.vent !== "minimal") {
      for (let ventX = x + 198; ventX < x + 258; ventX += 9) for (let ventY = y + 22; ventY < y + heightU - 15; ventY += 9) {
        parts.push(`<circle cx="${ventX}" cy="${ventY}" r="1.4" fill="${template.surfaceDark}" opacity=".65"/>`);
      }
    }
    parts.push(`<text class="name" x="${x + 28}" y="${y + 28}" fill="${template.ink}">${escapeXML(device.name)}</text>`);
    parts.push(`<text class="model" x="${x + 28}" y="${y + 43}" fill="${template.ink}" opacity=".68">${escapeXML(device.model)}</text>`);
    if (template.control === "server") {
      const cardGroups = new Map();
      for (const port of device.ports) {
        const point = portPoints.get(port.id);
        if (!point) continue;
        const group = cardGroups.get(port.group || "REAR CARD") || [];
        group.push({ port, point, size: connectorSize(port.type) });
        cardGroups.set(port.group || "REAR CARD", group);
      }
      for (const [name, group] of cardGroups) {
        let left = Math.min(...group.map(({ point, size }) => point.x - size.width / 2)) + offsetX - 7;
        let right = Math.max(...group.map(({ point, size }) => point.x + size.width / 2)) + offsetX + 7;
        let top = Math.min(...group.map(({ point, size }) => point.y - size.height / 2)) + offsetY - 10;
        let bottom = Math.max(...group.map(({ point, size }) => point.y + size.height / 2)) + offsetY + 7;
        const serverSlot = Number(name.match(/^S(\d+)/)?.[1] || 0);
        if (serverSlot) {
          const units = Math.max(1, Number(device.faceplate.unitsU) || 1);
          const slotIndex = serverSlot - 1;
          const row = Math.floor(slotIndex / 4);
          const column = slotIndex % 4;
          left = x + 690 * (.43 + column * .135) - 4;
          right = left + 690 * .12 + 8;
          top = y + heightU * (.13 + row * (.74 / units)) - 4;
          bottom = top + heightU * (.74 / units) + 8;
        }
        parts.push(`<rect data-layer="server-card" x="${left}" y="${top}" width="${right - left}" height="${bottom - top}" rx="2" fill="#080d0f" fill-opacity=".34" stroke="${template.ink}" stroke-opacity=".3"/>`);
        parts.push(`<text data-layer="server-card" x="${left + 3}" y="${top + 7}" fill="${template.ink}" opacity=".55" font-size="5">${escapeXML(name)}</text>`);
      }
    }
    for (const port of device.ports) {
      const point = portPoints.get(port.id);
      if (point) {
        const size = connectorSize(port.type);
        const kind = connectorKind(port.type);
        const portLabel = String(port.label || `PORT ${port.portIndex || ""}`).trim();
        parts.push(`<g data-entity="port" data-port-id="${escapeXML(port.id)}" data-device-id="${escapeXML(device.id)}" data-name="${escapeXML(portLabel)}"><title>${escapeXML(device.name)}:${escapeXML(portLabel)} · ${escapeXML(port.type || "PORT")}</title>`);
        if (kind === "coax") {
          parts.push(`<circle class="port" cx="${point.x + offsetX}" cy="${point.y + offsetY}" r="${size.width / 2}"/>`);
          parts.push(`<circle cx="${point.x + offsetX}" cy="${point.y + offsetY}" r="1.5" fill="#536265"/>`);
        } else {
          parts.push(`<rect class="port" x="${point.x + offsetX - size.width / 2}" y="${point.y + offsetY - size.height / 2}" width="${size.width}" height="${size.height}" rx="2"/>`);
        }
        parts.push(`</g>`);
        const portBox = {
          port: { ...port, label: portLabel }, centerX: point.x, centerY: point.y,
          x: point.x - size.width / 2, y: point.y - size.height / 2, width: size.width, height: size.height,
        };
        renderedPortLabels.push({ ...portDescriptionPlacement(portBox, box), label: portLabel, template, offsetX, offsetY });
      }
    }
    parts.push(`</g>`);
  }
  for (const entry of renderedLinks.filter((candidate) => candidate.rearMapping)) {
    parts.push(svgCableGroup(entry));
  }
  const renderedRearSheaths = new Set();
  for (const entry of renderedLinks.filter((candidate) => candidate.rearMapping)) {
    const sheath = entry.rearChannelSheath;
    if (!sheath || renderedRearSheaths.has(sheath.key)) continue;
    renderedRearSheaths.add(sheath.key);
    parts.push(svgRearChannelSheathGroup(sheath));
  }
  for (const entry of renderedLinks.filter((candidate) => !candidate.rearMapping)) {
    parts.push(svgCableGroup(entry));
  }
  for (let upperIndex = 0; upperIndex < renderedLinks.length; upperIndex += 1) {
    const upperEntry = renderedLinks[upperIndex];
    for (let bridgeIndex = 0; bridgeIndex < (upperEntry.route.bridges || []).length; bridgeIndex += 1) {
      const bridge = upperEntry.route.bridges[bridgeIndex];
      const underEntry = renderedLinks[bridge.underRouteIndex];
      if (!underEntry || underEntry === upperEntry) continue;
      const clipID = `bridge-underpass-${upperIndex}-${bridgeIndex}`;
      parts.push(`<defs><clipPath id="${clipID}"><circle cx="${bridge.crossing.x + offsetX}" cy="${bridge.crossing.y + offsetY}" r="${bridge.openingRadius || 8}"/></clipPath></defs>`);
      parts.push(`<g data-layer="bridge-jumper" data-under-link="${escapeXML(underEntry.link.id)}" clip-path="url(#${clipID})">`);
      parts.push(svgCableGroup(upperEntry));
      parts.push(`</g>`);
    }
  }
  const renderedLinkByID = new Map(renderedLinks.map((entry) => [entry.link.id, entry.link]));
  const groupPortBadges = linkGroupPortBadges(topology);
  for (const [portID, badge] of groupPortBadges) {
    const box = portGeometry.get(portID);
    if (!box) continue;
    const size = Math.max(6, Math.min(9, Math.min(box.width, box.height) - 4));
    const x = box.x + box.width / 2 + offsetX;
    const y = box.y + box.height / 2 + offsetY;
    const badgeLink = renderedLinkByID.get(badge.linkId);
    parts.push(`<g data-layer="link-group-port-badge" data-role="${badge.role}" data-link="${escapeXML(badge.linkId)}" data-entity="link" data-link-id="${escapeXML(badge.linkId)}"${svgLinkFaceAttributes(badgeLink)}>`);
    parts.push(`<rect x="${x - size / 2}" y="${y - size / 2}" width="${size}" height="${size}" rx="1.5" fill="#050d0f" fill-opacity=".96" stroke="${badge.color}" stroke-width="1.2"/>`);
    parts.push(`<text x="${x}" y="${y + .4}" fill="${badge.color}" font-size="${Math.max(5, size - 3)}" font-weight="700" text-anchor="middle" dominant-baseline="middle">${badge.role}</text></g>`);
  }
  const endpointBadges = layoutEndpointBadges(renderedLinks.flatMap((entry) => entry.badges), {
    charWidth: 4.1, height: 11, padding: 5,
  });
  for (const badge of endpointBadges) {
    const badgeLink = renderedLinkByID.get(badge.linkId);
    parts.push(`<g data-layer="link-end-label" data-endpoint="${badge.endpoint}" data-entity="link" data-link-id="${escapeXML(badge.linkId)}"${svgLinkFaceAttributes(badgeLink)}><title>${escapeXML(badge.fullText)}</title>`);
    parts.push(`<rect x="${badge.x - badge.width / 2}" y="${badge.y - badge.height / 2}" width="${badge.width}" height="${badge.height}" rx="2.5" fill="#050a0c" fill-opacity=".94" stroke="#e1efef" stroke-opacity=".72" stroke-width="1"/>`);
    parts.push(`<text x="${badge.x}" y="${badge.y + .25}" fill="#edf7f6" font-size="6" font-weight="700" text-anchor="middle" dominant-baseline="middle">${escapeXML(badge.text)}</text></g>`);
  }
  for (const label of renderedPortLabels) {
    const x = label.x + label.offsetX; const y = label.y + label.offsetY;
    const width = Math.max(12, Math.min(label.maxWidth, label.label.length * label.fontSize * .55) + 6);
    parts.push(`<rect data-layer="port-description" x="${x - width / 2}" y="${y - 5.5}" width="${width}" height="11" rx="2" fill="${label.template.surface}" opacity=".94" stroke="${label.template.ink}" stroke-opacity=".35"/>`);
    parts.push(`<text class="port-label" data-layer="port-description" x="${x}" y="${y}" font-size="${label.fontSize}" fill="${label.template.ink}">${escapeXML(label.label)}</text>`);
  }
  for (const annotation of topology.annotations || []) {
    const x1 = annotation.x1 + offsetX; const y1 = annotation.y1 + offsetY;
    const x2 = annotation.x2 + offsetX; const y2 = annotation.y2 + offsetY;
    const color = /^#[0-9a-f]{6}$/i.test(annotation.color || "") ? annotation.color : "#f0b35a";
    if (annotation.type === "rectangle") {
      parts.push(`<rect data-layer="annotation" x="${Math.min(x1, x2)}" y="${Math.min(y1, y2)}" width="${Math.abs(x2 - x1)}" height="${Math.abs(y2 - y1)}" fill="none" stroke="${color}" stroke-width="2" stroke-dasharray="8 4"/>`);
    } else if (annotation.type === "arrow") {
      const markerID = `annotation-arrow-${escapeXML(annotation.id)}`;
      parts.push(`<defs><marker id="${markerID}" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8Z" fill="${color}"/></marker></defs>`);
      parts.push(`<path data-layer="annotation" d="M${x1} ${y1}L${x2} ${y2}" fill="none" stroke="${color}" stroke-width="2" marker-end="url(#${markerID})"/>`);
    } else if (annotation.type === "text") {
      parts.push(`<g data-layer="annotation"><rect x="${x1}" y="${y1 - 25}" width="${Math.max(70, String(annotation.text || "").length * 7 + 18)}" height="25" rx="4" fill="#081012" stroke="${color}"/><text x="${x1 + 9}" y="${y1 - 8}" fill="${color}" font-size="12" font-weight="700">${escapeXML(annotation.text || "NOTE")}</text></g>`);
    }
  }
  parts.push(`</svg>`);
  return parts.join("");
}

function translateRoute(route, offsetX, offsetY) {
  const segments = routeSegments(route).map((curve) => ({
    source: { x: curve.source.x + offsetX, y: curve.source.y + offsetY },
    cp1: { x: curve.cp1.x + offsetX, y: curve.cp1.y + offsetY },
    cp2: { x: curve.cp2.x + offsetX, y: curve.cp2.y + offsetY },
    target: { x: curve.target.x + offsetX, y: curve.target.y + offsetY },
  }));
  return {
    ...route,
    source: segments[0].source,
    target: segments.at(-1).target,
    points: [segments[0].source, ...segments.map((segment) => segment.target)],
    segments,
    bridges: (route.bridges || []).map((bridge) => ({
      ...bridge,
      crossing: { x: bridge.crossing.x + offsetX, y: bridge.crossing.y + offsetY },
      apex: { x: bridge.apex.x + offsetX, y: bridge.apex.y + offsetY },
    })),
  };
}

export function svgRoutePath(route) {
  const segments = routeSegments(route);
  if (!segments.length) return "";
  const commands = [`M${segments[0].source.x} ${segments[0].source.y}`];
  for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex += 1) {
    const segment = segments[segmentIndex];
    const horizontal = Math.abs(segment.source.y - segment.target.y) < .001;
    const direction = segment.target.x >= segment.source.x ? 1 : -1;
    const bridges = (route.bridges || []).filter((bridge) => bridge.segmentIndex === segmentIndex)
      .sort((left, right) => direction > 0 ? left.crossing.x - right.crossing.x : right.crossing.x - left.crossing.x);
    if (!horizontal || !bridges.length) {
      commands.push(horizontal ? `H${segment.target.x}` : `V${segment.target.y}`);
      continue;
    }
    for (const bridge of bridges) {
      const radius = bridge.radius || 4;
      commands.push(`H${bridge.crossing.x - direction * radius}`);
      commands.push(`A${radius} ${radius} 0 0 ${direction > 0 ? 1 : 0} ${bridge.crossing.x + direction * radius} ${bridge.crossing.y}`);
    }
    commands.push(`H${segment.target.x}`);
  }
  return commands.join(" ");
}

function svgCableElements(entry) {
  if (entry.rearMapping) {
    const channel = entry.route?.rearChannelKey ? ` data-channel="${escapeXML(entry.route.rearChannelKey)}" data-channel-type="${escapeXML(entry.route.rearChannelType || "derived")}" data-strand-index="${entry.route.rearStrandIndex ?? 0}"` : "";
    return [
      `<path data-layer="panel-rear-map-casing" data-route-kind="${entry.route?.routeKind || "orthogonal"}" data-bundle-index="${entry.route?.bundleIndex ?? 0}"${channel} d="${entry.path}" fill="none" stroke="#020505" stroke-width="${RearPanelLinkVisual.casingWidth}" stroke-linecap="round" stroke-linejoin="round" opacity="${RearPanelLinkVisual.casingOpacity}"/>`,
      `<path data-layer="panel-rear-map"${channel} d="${entry.path}" fill="none" stroke="${RearPanelLinkVisual.color}" stroke-width="${RearPanelLinkVisual.strokeWidth}" stroke-linecap="butt" stroke-linejoin="round" stroke-dasharray="${RearPanelLinkVisual.dash.join(" ")}" opacity="${RearPanelLinkVisual.opacity}"/>`,
    ];
  }
  const dash = entry.dash?.length ? ` stroke-dasharray="${entry.dash.join(" ")}"` : "";
  const roleWidth = entry.route?.tightBundle ? 2.5 : 4.25;
  const elements = [
    `<path data-layer="cable-outline" data-route-kind="${entry.route?.routeKind || "orthogonal"}" data-bundle-index="${entry.route?.bundleIndex ?? 0}" d="${entry.path}" fill="none" stroke="#020505" stroke-width="${roleWidth + CABLE_OUTLINE_WIDTH * 2}" stroke-linecap="round" stroke-linejoin="round"/>`,
  ];
  elements.push(`<path data-layer="cable-role" data-role="${entry.role.key}" d="${entry.path}" fill="none" stroke="${entry.role.color}" stroke-width="${roleWidth}" stroke-linecap="round" stroke-linejoin="round" opacity=".78"${dash}/>`);
  if (!entry.palette.isRainbow) {
    elements.push(`<path data-layer="cable" data-vlan="${entry.palette.nativeVlanID}" d="${entry.path}" fill="none" stroke="${entry.palette.nativeColor}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"${dash}/>`);
    return elements;
  }
  elements.push(`<path data-layer="cable-native" data-vlan="${entry.palette.nativeVlanID}" d="${entry.path}" fill="none" stroke="${entry.palette.nativeColor}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>`);
  entry.palette.channels.forEach((channel, index) => {
    const pattern = vlanBandPattern(entry.palette.channels.length, index);
    elements.push(`<path data-layer="cable-vlan" data-vlan="${channel.id}" d="${entry.path}" fill="none" stroke="${channel.color}" stroke-width="2.65" stroke-linecap="butt" stroke-linejoin="round" stroke-dasharray="${pattern.dash.join(" ")}" stroke-dashoffset="${pattern.offset}"/>`);
  });
  return elements;
}

function svgCableGroup(entry) {
  const link = entry.link;
  const channelID = entry.route?.rearChannelKey || link.rearChannelId || "";
  const channel = channelID ? ` data-channel="${escapeXML(channelID)}"` : "";
  const group = entry.group?.id ? ` data-link-group-id="${escapeXML(entry.group.id)}"` : "";
  const label = link.name || `${link.cableType || "Cable"} · ${link.id}`;
  return `<g data-entity="link" data-link-id="${escapeXML(link.id)}" data-source-device-id="${escapeXML(link.sourceDeviceId || "")}" data-target-device-id="${escapeXML(link.targetDeviceId || "")}"${svgLinkFaceAttributes(link)}${channel}${group}><title>${escapeXML(label)}</title><path data-layer="interactive-hit" d="${entry.path}" fill="none" stroke="transparent" stroke-width="18" pointer-events="stroke"/>${svgCableElements(entry).join("")}</g>`;
}

function svgLinkFaceAttributes(link) {
  if (!link) return "";
  const sourceFace = link.sourceSide === "rear" ? "rear" : "front";
  const targetFace = link.targetSide === "rear" ? "rear" : "front";
  return ` data-source-face="${sourceFace}" data-target-face="${targetFace}"`;
}

function svgRearChannelSheathElements(sheath) {
  const path = svgRoutePath(sheath.route);
  const key = escapeXML(sheath.key);
  const name = escapeXML(sheath.name || "AUTO TUBE");
  return [
    `<path data-layer="rear-channel-sheath-outline" data-channel="${key}" data-channel-type="tube" d="${path}" fill="none" stroke="#020607" stroke-width="${sheath.width + 4}" stroke-linecap="round" stroke-linejoin="round" opacity=".82"/>`,
    `<path data-layer="rear-channel-sheath" data-channel="${key}" data-channel-name="${name}" data-channel-type="tube" data-strands="${sheath.strandCount}" d="${path}" fill="none" stroke="${RearPanelLinkVisual.color}" stroke-width="${sheath.width + 1}" stroke-linecap="round" stroke-linejoin="round" opacity=".78"/>`,
    `<path data-layer="rear-channel-sheath-core" data-channel="${key}" d="${path}" fill="none" stroke="#152326" stroke-width="${Math.max(2, sheath.width - 2)}" stroke-linecap="round" stroke-linejoin="round" opacity=".94"/>`,
    `<path data-layer="rear-channel-sheath-trace" data-channel="${key}" d="${path}" fill="none" stroke="#e6bd72" stroke-width="1.25" stroke-linecap="butt" stroke-linejoin="round" stroke-dasharray="9 5" opacity=".72"/>`,
  ];
}

function svgRearChannelSheathGroup(sheath) {
  const key = escapeXML(sheath.key);
  const name = escapeXML(sheath.name || "AUTO TUBE");
  return `<g data-entity="channel" data-channel-id="${key}" data-channel-name="${name}" data-strands="${sheath.strandCount}"><title>${name} · ${sheath.strandCount} strand${sheath.strandCount === 1 ? "" : "s"}</title>${svgRearChannelSheathElements(sheath).join("")}</g>`;
}

function escapeXML(value) {
  return String(value).replace(/[<>&"']/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[char]);
}

function escapeHTML(value) {
  return String(value).replace(/[<>&"']/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[char]);
}

function canvasBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error(`Could not encode ${type} export`)),
    type,
    quality,
  ));
}

function encodePDF(value) {
  return new TextEncoder().encode(value);
}

function concatenateBytes(chunks, length) {
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function pdfNumber(value) {
  return Number(value.toFixed(3)).toString();
}

function pdfUnicodeString(value) {
  let hex = "FEFF";
  for (let index = 0; index < String(value).length; index += 1) hex += String(value).charCodeAt(index).toString(16).padStart(4, "0").toUpperCase();
  return `<${hex}>`;
}
