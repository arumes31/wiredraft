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
  const bounds = engine.worldBounds();
  const offsetX = 50 - bounds.x;
  const offsetY = 50 - bounds.y;
  const width = Math.ceil(bounds.width + 100);
  const height = Math.ceil(bounds.height + 100);
  const portPoints = engine.portCenters();
  const colors = new Map(topology.vlans.map((vlan) => [vlan.id, vlan.colorHex]));
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<style>text{font-family:'DIN Condensed',sans-serif}.name{fill:#e5eeee;font-size:14px;font-weight:bold;letter-spacing:1px}.model{fill:#71868a;font-size:9px}.port{fill:#091012;stroke:#60757a;stroke-width:1}</style>`,
    `<rect width="100%" height="100%" fill="#0a0f11"/>`];
  for (const link of topology.links) {
    const source = portPoints.get(link.sourcePortId);
    const target = portPoints.get(link.targetPortId);
    if (!source || !target) continue;
    const x1 = source.x + offsetX; const y1 = source.y + offsetY;
    const x2 = target.x + offsetX; const y2 = target.y + offsetY;
    const slack = Math.max(55, Math.min(220, Math.hypot(x2 - x1, y2 - y1) * .34));
    const color = colors.get(link.primaryVlan) || "#7b8e91";
    parts.push(`<path d="M${x1} ${y1} C${x1} ${y1 + slack},${x2} ${y2 - slack},${x2} ${y2}" fill="none" stroke="#020505" stroke-width="6"/>`);
    parts.push(`<path d="M${x1} ${y1} C${x1} ${y1 + slack},${x2} ${y2 - slack},${x2} ${y2}" fill="none" stroke="${color}" stroke-width="3"/>`);
  }
  for (const device of topology.devices) {
    const x = device.positionX + offsetX; const y = device.positionY + offsetY;
    const heightU = Math.max(100, device.faceplate.unitsU * 100);
    parts.push(`<rect x="${x}" y="${y}" width="690" height="${heightU}" rx="8" fill="${device.faceplate.vendorColor}" stroke="#687b7f"/>`);
    parts.push(`<text class="name" x="${x + 28}" y="${y + 28}">${escapeXML(device.name)}</text>`);
    parts.push(`<text class="model" x="${x + 28}" y="${y + 43}">${escapeXML(device.model)}</text>`);
    for (const port of device.ports) {
      const point = portPoints.get(port.id);
      if (point) parts.push(`<rect class="port" x="${point.x + offsetX - 8}" y="${point.y + offsetY - 6}" width="16" height="12" rx="2"/>`);
    }
  }
  parts.push(`</svg>`);
  download(`${fileBase(topology)}.svg`, new Blob([parts.join("")], { type: "image/svg+xml" }));
}

function escapeXML(value) {
  return String(value).replace(/[<>&"']/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[char]);
}
