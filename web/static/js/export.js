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

  appendText("%PDF-1.4\n%NETDIAGRAM\n");
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
  appendObject(6, `<< /Title ${pdfUnicodeString(title)} /Creator ${pdfUnicodeString("Netdiagram")} >>`);

  const xrefOffset = length;
  appendText("xref\n0 7\n0000000000 65535 f \n");
  for (let object = 1; object <= 6; object += 1) appendText(`${String(offsets[object]).padStart(10, "0")} 00000 n \n`);
  appendText(`trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);
  return concatenateBytes(chunks, length);
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
  <meta name="generator" content="Netdiagram">
  <title>${escapeHTML(topology.name)} · Netdiagram export</title>
  <style>
    :root{color-scheme:dark;--ink:#e9f2f2;--muted:#8ea4a8;--cyan:#4ce2d1;--line:#294247;--panel:#101a1d}
    *{box-sizing:border-box}body{margin:0;min-height:100vh;color:var(--ink);background:#071012;background-image:linear-gradient(rgb(76 226 209/.045) 1px,transparent 1px),linear-gradient(90deg,rgb(76 226 209/.045) 1px,transparent 1px);background-size:32px 32px;font-family:Bahnschrift,"DIN Alternate","Arial Narrow",sans-serif}
    header{position:relative;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:22px;align-items:end;padding:28px 34px 24px;border-bottom:1px solid var(--line);background:linear-gradient(135deg,rgb(22 39 43/.98),rgb(8 15 17/.96));box-shadow:0 16px 45px rgb(0 0 0/.32)}
    header::before{content:"";position:absolute;inset:0 auto 0 0;width:4px;background:var(--cyan);box-shadow:0 0 24px var(--cyan)}
    .eyebrow{margin:0 0 7px;color:var(--cyan);font-size:10px;font-weight:700;letter-spacing:.22em}.title{margin:0;font-size:clamp(24px,4vw,50px);font-stretch:condensed;letter-spacing:.015em}.subtitle{margin:8px 0 0;color:var(--muted);font-size:12px;letter-spacing:.08em}
    .stats{display:grid;grid-template-columns:repeat(4,minmax(66px,1fr));gap:1px;border:1px solid var(--line);background:var(--line)}.stats span{min-width:74px;padding:12px 14px;background:var(--panel);color:var(--muted);font-size:8px;letter-spacing:.14em}.stats b{display:block;margin-bottom:4px;color:var(--ink);font-size:20px;letter-spacing:0}
    main{margin:28px;overflow:auto;border:1px solid var(--line);border-radius:12px;background:#0a0f11;box-shadow:0 25px 80px rgb(0 0 0/.42)}main svg{display:block;width:100%;height:auto;min-width:720px}
    .documents{margin:0 28px 28px;padding:20px;border:1px solid var(--line);background:var(--panel)}.documents h2{margin:0 0 14px;font-size:14px;letter-spacing:.12em}.documents div{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:8px}.documents a{display:grid;gap:3px;padding:11px;border:1px solid var(--line);color:var(--ink);text-decoration:none}.documents a span{color:var(--cyan);font-size:8px;letter-spacing:.12em}.documents a small{overflow:hidden;color:var(--muted);text-overflow:ellipsis;white-space:nowrap}
    footer{display:flex;justify-content:space-between;gap:20px;padding:0 34px 28px;color:var(--muted);font-size:9px;letter-spacing:.12em}footer strong{color:var(--cyan)}
    @media(max-width:760px){header{grid-template-columns:1fr;padding:22px}.stats{grid-template-columns:repeat(2,1fr)}main{margin:14px}footer{padding:8px 18px 24px;flex-direction:column}}
    @media print{body{background:#0a0f11}header{box-shadow:none}main{margin:12px;border:0;box-shadow:none}main svg{min-width:0}footer{padding:8px 12px} @page{size:landscape;margin:8mm}}
  </style>
</head>
<body>
  <header>
    <section><p class="eyebrow">NETDIAGRAM · STANDALONE EXPORT</p><h1 class="title">${escapeHTML(topology.name)}</h1><p class="subtitle">Portable physical topology report · source data embedded</p></section>
    <section class="stats" aria-label="Topology totals"><span><b>${counts.racks}</b>RACKS</span><span><b>${counts.devices}</b>DEVICES</span><span><b>${counts.links}</b>CABLES</span><span><b>${counts.vlans}</b>VLANS</span></section>
  </header>
  <main>${svg}</main>
  ${documentation ? `<section class="documents"><h2>ATTACHED DOCUMENTATION</h2><div>${documentation}</div></section>` : ""}
  <footer><span><strong>NETDIAGRAM</strong> · SELF-CONTAINED HTML</span><time datetime="${timestamp}">${timestamp ? `GENERATED ${escapeHTML(timestamp)}` : ""}</time></footer>
  <script id="netdiagram-topology" type="application/json">${embeddedTopology}</script>
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
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<style>text{font-family:'DIN Condensed',sans-serif}.name{font-size:14px;font-weight:bold;letter-spacing:1px}.model{font-size:9px}.port{fill:#091012;stroke:#60757a;stroke-width:1}.port-label{font-weight:700;text-anchor:middle;dominant-baseline:middle}</style>`,
    `<rect width="100%" height="100%" fill="#0a0f11"/>`];
  for (const box of rackBoxes) {
    const x = box.x + offsetX; const y = box.y + offsetY;
    parts.push(`<rect x="${x}" y="${y}" width="${box.width}" height="${box.height}" rx="7" fill="#070d0f" stroke="${box.rack.color}" stroke-width="2"/>`);
    parts.push(`<rect x="${x + 2}" y="${y + 2}" width="${box.width - 4}" height="62" fill="${box.rack.color}"/>`);
    parts.push(`<text class="name" x="${x + 26}" y="${y + 29}" fill="#e5eeee">${escapeXML(box.rack.name)}</text>`);
    parts.push(`<text class="model" x="${x + 26}" y="${y + 47}" fill="#71868a">${box.rack.heightU}U RACK</text>`);
    for (let unit = 0; unit <= box.rack.heightU; unit += 1) {
      const lineY = y + 64 + unit * 100;
      parts.push(`<path d="M${x + 30} ${lineY}H${x + box.width - 30}" stroke="#304347" stroke-width="1"/>`);
    }
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
    parts.push(`<g data-layer="faceplate" data-template="${template.id}">`);
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
        if (kind === "coax") {
          parts.push(`<circle class="port" cx="${point.x + offsetX}" cy="${point.y + offsetY}" r="${size.width / 2}"/>`);
          parts.push(`<circle cx="${point.x + offsetX}" cy="${point.y + offsetY}" r="1.5" fill="#536265"/>`);
        } else {
          parts.push(`<rect class="port" x="${point.x + offsetX - size.width / 2}" y="${point.y + offsetY - size.height / 2}" width="${size.width}" height="${size.height}" rx="2"/>`);
        }
        const portBox = {
          port: { ...port, label: portLabel }, centerX: point.x, centerY: point.y,
          x: point.x - size.width / 2, y: point.y - size.height / 2, width: size.width, height: size.height,
        };
        renderedPortLabels.push({ ...portDescriptionPlacement(portBox, box), label: portLabel, template, offsetX, offsetY });
      }
    }
    parts.push(`</g>`);
  }
  for (const entry of renderedLinks) parts.push(...svgCableElements(entry));
  for (let upperIndex = 0; upperIndex < renderedLinks.length; upperIndex += 1) {
    const upperEntry = renderedLinks[upperIndex];
    for (let bridgeIndex = 0; bridgeIndex < (upperEntry.route.bridges || []).length; bridgeIndex += 1) {
      const bridge = upperEntry.route.bridges[bridgeIndex];
      const underEntry = renderedLinks[bridge.underRouteIndex];
      if (!underEntry || underEntry === upperEntry) continue;
      const clipID = `bridge-underpass-${upperIndex}-${bridgeIndex}`;
      parts.push(`<defs><clipPath id="${clipID}"><circle cx="${bridge.crossing.x + offsetX}" cy="${bridge.crossing.y + offsetY}" r="${bridge.openingRadius || 5}"/></clipPath></defs>`);
      parts.push(`<g data-layer="bridge-jumper" data-under-link="${escapeXML(underEntry.link.id)}" clip-path="url(#${clipID})">`);
      parts.push(...svgCableElements(upperEntry));
      parts.push(`</g>`);
    }
  }
  const groupPortBadges = linkGroupPortBadges(topology);
  for (const [portID, badge] of groupPortBadges) {
    const box = portGeometry.get(portID);
    if (!box) continue;
    const size = Math.max(6, Math.min(9, Math.min(box.width, box.height) - 4));
    const x = box.x + box.width / 2 + offsetX;
    const y = box.y + box.height / 2 + offsetY;
    parts.push(`<g data-layer="link-group-port-badge" data-role="${badge.role}" data-link="${escapeXML(badge.linkId)}">`);
    parts.push(`<rect x="${x - size / 2}" y="${y - size / 2}" width="${size}" height="${size}" rx="1.5" fill="#050d0f" fill-opacity=".96" stroke="${badge.color}" stroke-width="1.2"/>`);
    parts.push(`<text x="${x}" y="${y + .4}" fill="${badge.color}" font-size="${Math.max(5, size - 3)}" font-weight="700" text-anchor="middle" dominant-baseline="middle">${badge.role}</text></g>`);
  }
  const endpointBadges = layoutEndpointBadges(renderedLinks.flatMap((entry) => entry.badges), {
    charWidth: 4.1, height: 11, padding: 5,
  });
  for (const badge of endpointBadges) {
    parts.push(`<g data-layer="link-end-label" data-endpoint="${badge.endpoint}"><title>${escapeXML(badge.fullText)}</title>`);
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
      const radius = bridge.radius || 5;
      commands.push(`H${bridge.crossing.x - direction * radius}`);
      commands.push(`A${radius} ${radius} 0 0 ${direction > 0 ? 1 : 0} ${bridge.crossing.x + direction * radius} ${bridge.crossing.y}`);
    }
    commands.push(`H${segment.target.x}`);
  }
  return commands.join(" ");
}

function svgCableElements(entry) {
  if (entry.rearMapping) {
    return [
      `<path data-layer="panel-rear-map-casing" data-route-kind="${entry.route?.routeKind || "orthogonal"}" data-bundle-index="${entry.route?.bundleIndex ?? 0}" d="${entry.path}" fill="none" stroke="#020505" stroke-width="${RearPanelLinkVisual.casingWidth}" stroke-linecap="round" stroke-linejoin="round" opacity="${RearPanelLinkVisual.casingOpacity}"/>`,
      `<path data-layer="panel-rear-map" d="${entry.path}" fill="none" stroke="${RearPanelLinkVisual.color}" stroke-width="${RearPanelLinkVisual.strokeWidth}" stroke-linecap="butt" stroke-linejoin="round" stroke-dasharray="${RearPanelLinkVisual.dash.join(" ")}" opacity="${RearPanelLinkVisual.opacity}"/>`,
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
