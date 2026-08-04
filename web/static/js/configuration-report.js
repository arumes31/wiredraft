import { firewallClusterModeLabel, firewallClusterRole } from "./firewall-clusters.js";
import { switchSystemModeLabel } from "./switch-systems.js";

export function buildConfigurationDocument(topology, generatedAt = new Date()) {
  const topologyScope = [topology?.organization, topology?.location].filter(Boolean).join(" / ") || "UNASSIGNED";
  const racks = [...(topology?.racks || [])];
  const devices = [...(topology?.devices || [])];
  const links = [...(topology?.links || [])];
  const groups = [...(topology?.linkGroups || [])];
  const vlans = [...(topology?.vlans || [])].sort((left, right) => left.id - right.id);
  const switchSystems = [...(topology?.switchSystems || [])];
  const firewallClusters = [...(topology?.firewallClusters || [])];
  const racksByID = new Map(racks.map((rack) => [rack.id, rack]));
  const devicesByID = new Map(devices.map((device) => [device.id, device]));
  const portsByID = new Map(devices.flatMap((device) => (device.ports || []).map((port) => [port.id, { device, port }])));
  const linksByID = new Map(links.map((link) => [link.id, link]));
  const vlansByID = new Map(vlans.map((vlan) => [vlan.id, vlan]));
  const groupByLinkID = new Map();
  for (const group of groups) for (const linkID of group.linkIds || []) groupByLinkID.set(linkID, group);

  const orderedDevices = [...devices].sort((left, right) =>
    rackLabel(left, racksByID).localeCompare(rackLabel(right, racksByID), undefined, { numeric: true }) ||
    Number(right.rackUnit || 0) - Number(left.rackUnit || 0) ||
    String(left.name).localeCompare(String(right.name), undefined, { numeric: true }));
  const allPorts = orderedDevices.flatMap((device) => [...(device.ports || [])]
    .sort((left, right) => Number(left.portIndex) - Number(right.portIndex))
    .map((port) => ({ device, port })));

  const inventoryRows = orderedDevices.map((device) => [
    device.name,
    device.category,
    device.faceplate?.vendor || "—",
    device.model,
    device.serialNumber || "—",
    device.assetTag || "—",
    device.hostname || "—",
    device.managementIp || "—",
    rackPosition(device, racksByID),
    structuredLocation(device.location),
    device.owner || "—",
    `${device.faceplate?.unitsU || 0}U`,
    String((device.ports || []).length),
    logicalMembership(device.id, switchSystems, firewallClusters),
  ]);

  const portRows = allPorts.map(({ device, port }) => {
    const frontLink = linkForPortSide(links, port.id, "front");
    const rearLink = linkForPortSide(links, port.id, "rear");
    const groupedLink = frontLink && groupByLinkID.get(frontLink.id);
    return [
      device.name,
      port.label,
      port.group || "—",
      port.type,
      port.mediaType || "—",
      speedLabel(port.speedMbps),
      port.isPoe ? "YES" : "NO",
      String(port.status || "down").toUpperCase(),
      String(port.mode || "Unconfigured").toUpperCase(),
      vlanLabel(port.nativeVlan, vlansByID),
      vlanList(port.allowedVlans, vlansByID),
      frontLink ? peerEndpoint(frontLink, port.id, portsByID) : "UNPATCHED",
      rearLink ? peerEndpoint(rearLink, port.id, portsByID) : "UNMAPPED",
      groupedLink ? `${groupMode(groupedLink.mode)} · ${groupedLink.name}` : "—",
    ];
  });

  const vlanRows = vlans.map((vlan) => {
    const nativePorts = allPorts.filter(({ port }) => Number(port.nativeVlan) === vlan.id)
      .map(({ device, port }) => `${device.name}:${port.label}`);
    const taggedPorts = allPorts.filter(({ port }) => (port.allowedVlans || []).includes(vlan.id))
      .map(({ device, port }) => `${device.name}:${port.label}`);
    const carryingLinks = links.filter((link) => Number(link.primaryVlan) === vlan.id || (link.vlanIds || []).includes(vlan.id))
      .map((link) => linkPath(link, portsByID));
    return [
      String(vlan.id), vlan.name, vlan.colorHex, vlan.description || "—",
      countedList(nativePorts), countedList(taggedPorts), countedList(carryingLinks),
    ];
  });

  const linkRows = links.map((link, index) => {
    const source = portsByID.get(link.sourcePortId);
    const target = portsByID.get(link.targetPortId);
    const group = groupByLinkID.get(link.id);
    return [
      String(index + 1),
      linkSide(link, "source") === "rear" ? "REAR PANEL MAP" : "FRONT PATCH",
      endpointWithSide(source, linkSide(link, "source")),
      endpointWithSide(target, linkSide(link, "target")),
      link.cableType || "—",
      speedLabel(Math.min(Number(source?.port.speedMbps || Infinity), Number(target?.port.speedMbps || Infinity))),
      vlanLabel(link.primaryVlan, vlansByID),
      vlanList((link.vlanIds || []).filter((id) => Number(id) !== Number(link.primaryVlan)), vlansByID),
      group ? `${groupMode(group.mode)} · ${group.name}` : "—",
      group ? groupMemberRole(group, link.id) : "—",
      linkSide(link, "source") === "rear" ? rearChannelLabel(link) : "—",
      link.notes || "—",
    ];
  });

  const groupRows = groups.map((group) => {
    const memberLinks = (group.linkIds || []).map((linkID) => linksByID.get(linkID)).filter(Boolean);
    const nativeVLANs = uniqueSorted(memberLinks.map((link) => Number(link.primaryVlan)).filter(Boolean));
    const taggedVLANs = uniqueSorted(memberLinks.flatMap((link) => link.vlanIds || [])
      .map(Number).filter((id) => id && !nativeVLANs.includes(id)));
    const members = memberLinks.map((link, index) =>
      `${groupMemberRole(group, link.id, index)}: ${linkPath(link, portsByID)}`);
    const primary = linksByID.get(group.primaryLinkId);
    return [
      group.name,
      groupMode(group.mode),
      String(memberLinks.length),
      countedList(members),
      primary ? linkPath(primary, portsByID) : "—",
      vlanList(nativeVLANs, vlansByID),
      vlanList(taggedVLANs, vlansByID),
      group.notes || "—",
    ];
  });

  const switchSystemRows = switchSystems.map((system) => {
    const members = (system.deviceIds || []).map((id) => devicesByID.get(id)).filter(Boolean);
    return [
      system.name,
      switchSystemModeLabel(system.mode),
      countedList(members.map((device) => device.name)),
      String(members.reduce((total, device) => total + (device.ports || []).length, 0)),
      system.notes || "—",
    ];
  });

  const firewallClusterRows = firewallClusters.map((cluster) => {
    const members = (cluster.deviceIds || []).map((id) => devicesByID.get(id)).filter(Boolean);
    const roles = members.map((device) => `${device.name} · ${firewallClusterRole(cluster, device.id) || "MEMBER"}`);
    return [
      cluster.name,
      firewallClusterModeLabel(cluster.mode),
      countedList(roles),
      devicesByID.get(cluster.activeDeviceId)?.name || (cluster.mode === "ActiveActive" ? "ALL MEMBERS" : "—"),
      cluster.notes || "—",
    ];
  });

  const generated = generatedAt instanceof Date ? generatedAt : new Date(generatedAt);
  const timestamp = Number.isNaN(generated.getTime()) ? "" : generated.toISOString();
  const sourceData = JSON.stringify(topology || {}).replace(/[<>&]/g, (char) => ({
    "<": "\\u003c", ">": "\\u003e", "&": "\\u0026",
  })[char]);
  const sections = [
    reportSection("inventory", "ASSET LEDGER", "Inventory", "Installed physical equipment, ownership, identity, and structured placement.",
      ["Device", "Category", "Provider", "Model", "Serial", "Asset tag", "Hostname", "Management IP", "Rack / U", "Site path", "Owner", "Height", "Ports", "Logical membership"], inventoryRows),
    reportSection("ports", "INTERFACE REGISTER", "Port configuration", "Every physical connector with operational state, switchport configuration, and independent front/rear termination.",
      ["Device", "Port", "Faceplate group", "Type", "Media", "Speed", "PoE", "Status", "Mode", "Native / untagged VLAN", "Tagged / allowed VLANs", "Front connection", "Rear mapping", "Link group"], portRows),
    reportSection("vlans", "LAYER 2 REGISTER", "VLAN configuration", "Broadcast domains and every port or physical path carrying each VLAN.",
      ["VLAN", "Name", "Color", "Description", "Native ports", "Tagged ports", "Physical paths"], vlanRows),
    reportSection("links", "PHYSICAL PATCH SCHEDULE", "Connected links", "Exact device:port → device:port paths, termination planes, cable media, VLAN profile, and group role.",
      ["#", "Kind", "Source device:port", "Target device:port", "Cable", "Negotiated speed", "Native VLAN", "Tagged VLANs", "Group", "Role", "Rear channel", "Notes"], linkRows),
    reportSection("groups", "AGGREGATION REGISTER", "Trunks and link groups", "Trunk, LACP, MC-LAG, and failover membership with primary/backup and VLAN configuration.",
      ["Group", "Mode", "Members", "Physical member paths", "Preferred / primary", "Native VLANs", "Tagged VLANs", "Notes"], groupRows),
    reportSection("switch-systems", "LOGICAL SWITCHING", "Switch systems", "Physical switch chassis counted as stacks, VSF, StackWise, VSS, IRF, Virtual Chassis, or MC-LAG systems.",
      ["System", "Technology", "Physical members", "Total ports", "Notes"], switchSystemRows),
    reportSection("firewall-clusters", "HIGH AVAILABILITY", "Firewall clusters", "Active/active and active/passive firewall membership and roles.",
      ["Cluster", "Mode", "Members / roles", "Active member", "Notes"], firewallClusterRows),
  ];
  const totalPorts = allPorts.length;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="generator" content="Netdiagram">
  <title>${escapeHTML(topology?.name || "Network topology")} · Configuration workbook</title>
  <style>
    :root{color-scheme:dark;--paper:#081012;--panel:#101a1d;--ink:#e8f3f2;--muted:#84999c;--line:#2b4146;--cyan:#48dfcf;--amber:#efb25d;--red:#fa746b}
    *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;color:var(--ink);background:var(--paper);background-image:linear-gradient(rgb(72 223 207/.035) 1px,transparent 1px),linear-gradient(90deg,rgb(72 223 207/.035) 1px,transparent 1px);background-size:28px 28px;font-family:Bahnschrift,"DIN Alternate","Arial Narrow",sans-serif}
    button,input{font:inherit}.masthead{position:relative;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:28px;align-items:end;padding:32px 38px 27px;border-bottom:1px solid var(--line);background:linear-gradient(135deg,#17282c,#0a1214 68%)}.masthead::before{content:"";position:absolute;inset:0 auto 0 0;width:4px;background:var(--cyan);box-shadow:0 0 28px var(--cyan)}
    .eyebrow{margin:0 0 7px;color:var(--cyan);font-size:9px;font-weight:700;letter-spacing:.22em}.masthead h1{margin:0;font-size:clamp(26px,4vw,52px);font-stretch:condensed;letter-spacing:.015em}.masthead .sub{margin:8px 0 0;color:var(--muted);font-size:11px;letter-spacing:.08em}.revision{display:grid;gap:7px;min-width:210px;padding:15px;border:1px solid var(--line);background:#0b1416}.revision span{display:flex;justify-content:space-between;gap:18px;color:var(--muted);font-size:9px;letter-spacing:.1em}.revision b{color:var(--ink)}
    .summary{display:grid;grid-template-columns:repeat(6,minmax(95px,1fr));gap:1px;margin:0;background:var(--line);border-bottom:1px solid var(--line)}.summary span{padding:15px 18px;background:#0c1618;color:var(--muted);font-size:8px;letter-spacing:.14em}.summary b{display:block;margin-bottom:3px;color:var(--ink);font-size:22px;letter-spacing:0}
    .controls{position:sticky;top:0;z-index:9;display:flex;gap:10px;padding:11px 22px;border-bottom:1px solid var(--line);background:rgb(8 16 18/.94);backdrop-filter:blur(14px)}.controls input{flex:1;min-width:160px;padding:10px 13px;border:1px solid #385158;background:#0b1416;color:var(--ink);outline:0}.controls input:focus{border-color:var(--cyan);box-shadow:0 0 0 2px rgb(72 223 207/.12)}.controls button{padding:9px 15px;border:1px solid #416067;background:#142327;color:var(--ink);cursor:pointer;font-size:9px;font-weight:700;letter-spacing:.12em}.controls button:hover{border-color:var(--cyan);color:white}
    .layout{display:grid;grid-template-columns:220px minmax(0,1fr);align-items:start}.contents{position:sticky;top:59px;max-height:calc(100vh - 59px);display:grid;gap:5px;padding:22px;border-right:1px solid var(--line)}.contents h2{margin:0 0 8px;color:var(--muted);font-size:9px;letter-spacing:.17em}.contents a{display:flex;justify-content:space-between;gap:12px;padding:9px 10px;border-left:2px solid transparent;color:#a9babb;text-decoration:none;font-size:9px;letter-spacing:.08em}.contents a:hover{border-left-color:var(--cyan);background:#111f22;color:white}.contents b{color:var(--cyan)}
    main{min-width:0;padding:24px}.sheet{margin:0 0 28px;scroll-margin-top:80px;border:1px solid var(--line);background:rgb(12 21 23/.94);box-shadow:0 18px 50px rgb(0 0 0/.22)}.sheet>header{display:flex;justify-content:space-between;gap:20px;align-items:end;padding:17px 18px;border-bottom:1px solid var(--line)}.sheet h2{margin:2px 0 0;font-size:18px;letter-spacing:.05em}.sheet header p:last-child{max-width:680px;margin:0;color:var(--muted);font-size:9px;line-height:1.45;letter-spacing:.04em}.table-wrap{overflow:auto;max-height:620px}table{width:100%;border-collapse:collapse;font-size:9px;white-space:nowrap}th{position:sticky;top:0;z-index:2;padding:0;border-right:1px solid #30464b;border-bottom:1px solid #3b555b;background:#162528;text-align:left}th button{width:100%;display:flex;justify-content:space-between;gap:8px;padding:10px 11px;border:0;background:transparent;color:#b9ccce;cursor:pointer;font-size:8px;font-weight:700;letter-spacing:.1em;text-align:left;text-transform:uppercase}th button:hover{color:white;background:#1b3034}th button span{color:var(--cyan)}td{max-width:440px;padding:8px 11px;overflow:hidden;border-right:1px solid #22363a;border-bottom:1px solid #203237;color:#c7d4d4;text-overflow:ellipsis}tbody tr:nth-child(even){background:rgb(255 255 255/.018)}tbody tr:hover{background:rgb(72 223 207/.055)}td:first-child{color:white;font-weight:700}.empty{padding:22px;color:var(--muted);text-align:center;letter-spacing:.15em}
    footer{display:flex;justify-content:space-between;gap:20px;padding:0 26px 28px;color:var(--muted);font-size:8px;letter-spacing:.13em}footer strong{color:var(--cyan)}
    @media(max-width:900px){.masthead{grid-template-columns:1fr}.summary{grid-template-columns:repeat(3,1fr)}.layout{grid-template-columns:1fr}.contents{position:static;max-height:none;grid-template-columns:repeat(2,1fr);border-right:0;border-bottom:1px solid var(--line)}main{padding:14px}}
    @media print{body{color:#111;background:white}.masthead,.summary,.sheet,.revision{color:#111;background:white;box-shadow:none}.controls,.contents{display:none}.layout{display:block}main{padding:0}.sheet{break-before:page;margin:0;border:0}.sheet:first-child{break-before:auto}.sheet>header{padding:8px 0}.sheet header p:last-child,.eyebrow,.revision span,footer{color:#444}.table-wrap{max-height:none;overflow:visible}table{font-size:7px;white-space:normal}th{position:static;background:#e8eeee}th button{padding:5px;color:#111}td{max-width:none;padding:4px;color:#111;border-color:#bbb}tbody tr:nth-child(even){background:#f4f7f7}@page{size:A3 landscape;margin:8mm}}
  </style>
</head>
<body>
  <header class="masthead">
    <div><p class="eyebrow">NETDIAGRAM · CONFIGURATION WORKBOOK</p><h1>${escapeHTML(topology?.name || "Network topology")}</h1><p class="sub">${escapeHTML(topologyScope)} · Inventory · interfaces · VLANs · physical paths · trunks · logical systems</p></div>
    <div class="revision"><span>TOPOLOGY REVISION <b>${escapeHTML(topology?.revision ?? "—")}</b></span><span>GENERATED <b>${escapeHTML(timestamp || "—")}</b></span></div>
  </header>
  <section class="summary" aria-label="Configuration totals">
    ${summaryCard(racks.length, "RACKS")}${summaryCard(devices.length, "DEVICES")}${summaryCard(totalPorts, "PORTS")}${summaryCard(links.length, "LINKS")}${summaryCard(vlans.length, "VLANS")}${summaryCard(groups.length, "LINK GROUPS")}
  </section>
  <div class="controls"><input id="filter" type="search" placeholder="Filter every configuration row…" aria-label="Filter configuration rows"><button type="button" data-print>PRINT / SAVE PDF</button></div>
  <div class="layout">
    <nav class="contents" aria-label="Workbook contents"><h2>REGISTER INDEX</h2>${sections.map((section) => `<a href="#${section.id}"><span>${escapeHTML(section.title)}</span><b>${section.count}</b></a>`).join("")}</nav>
    <main>${sections.map((section) => section.html).join("")}</main>
  </div>
  <footer><span><strong>NETDIAGRAM</strong> · OFFLINE CONFIGURATION WORKBOOK</span><span>SOURCE TOPOLOGY EMBEDDED FOR AUDIT</span></footer>
  <script id="netdiagram-topology" type="application/json">${sourceData}</script>
  <script>
    const filter=document.querySelector('#filter');
    filter.addEventListener('input',()=>{const term=filter.value.trim().toLocaleLowerCase();document.querySelectorAll('tbody tr').forEach(row=>{row.hidden=Boolean(term)&&!row.textContent.toLocaleLowerCase().includes(term)})});
    document.querySelector('[data-print]').addEventListener('click',()=>window.print());
    document.querySelectorAll('th button').forEach(button=>button.addEventListener('click',()=>{const table=button.closest('table');const body=table.tBodies[0];const column=button.parentElement.cellIndex;const direction=button.dataset.direction==='asc'?'desc':'asc';table.querySelectorAll('th button').forEach(item=>{delete item.dataset.direction;item.parentElement.removeAttribute('aria-sort')});button.dataset.direction=direction;button.parentElement.setAttribute('aria-sort',direction==='asc'?'ascending':'descending');[...body.rows].sort((left,right)=>left.cells[column].textContent.localeCompare(right.cells[column].textContent,undefined,{numeric:true,sensitivity:'base'})*(direction==='asc'?1:-1)).forEach(row=>body.append(row))}));
  </script>
</body>
</html>`;
}

function reportSection(id, eyebrow, title, description, headers, rows) {
  return {
    id, title, count: rows.length,
    html: `<section id="${id}" class="sheet"><header><div><p class="eyebrow">${eyebrow}</p><h2>${title}</h2></div><p>${description}</p></header><div class="table-wrap">${reportTable(headers, rows)}</div></section>`,
  };
}

function reportTable(headers, rows) {
  const heading = headers.map((header) => `<th scope="col"><button type="button">${escapeHTML(header)}<span>↕</span></button></th>`).join("");
  const body = rows.length ? rows.map((row) => `<tr>${row.map((value) => `<td title="${escapeHTML(value)}">${escapeHTML(value)}</td>`).join("")}</tr>`).join("")
    : `<tr><td class="empty" colspan="${headers.length}">NO RECORDS</td></tr>`;
  return `<table><thead><tr>${heading}</tr></thead><tbody>${body}</tbody></table>`;
}

function summaryCard(value, label) {
  return `<span><b>${Number(value) || 0}</b>${label}</span>`;
}

function rackLabel(device, racksByID) {
  return racksByID.get(device.rackId)?.name || device.location?.rack || "UNMOUNTED";
}

function rackPosition(device, racksByID) {
  const rack = rackLabel(device, racksByID);
  return device.rackUnit ? `${rack} · U${device.rackUnit}` : rack;
}

function structuredLocation(location = {}) {
  const path = [location.site, location.building, location.floor, location.room].filter(Boolean);
  return path.join(" / ") || "—";
}

function logicalMembership(deviceID, systems, clusters) {
  const system = systems.find((candidate) => (candidate.deviceIds || []).includes(deviceID));
  const cluster = clusters.find((candidate) => (candidate.deviceIds || []).includes(deviceID));
  return [system && `${switchSystemModeLabel(system.mode)} · ${system.name}`, cluster && `${firewallClusterModeLabel(cluster.mode)} · ${cluster.name}`]
    .filter(Boolean).join(" | ") || "—";
}

function linkSide(link, endpoint) {
  return String(link?.[`${endpoint}Side`] || "front").toLowerCase();
}

function rearChannelLabel(link) {
  if (!link.rearChannelId) return "AUTO-DERIVED LEGACY CHANNEL";
  const construction = link.rearChannelType === "tube" ? "TUBE / BÜNDELADER" : "DISCRETE BUNDLE";
  return `${construction} · ${link.rearChannelName || "UNNAMED"}`;
}

function linkForPortSide(links, portID, side) {
  return links.find((link) =>
    (link.sourcePortId === portID && linkSide(link, "source") === side) ||
    (link.targetPortId === portID && linkSide(link, "target") === side));
}

function peerEndpoint(link, portID, portsByID) {
  if (link.sourcePortId === portID) return endpointWithSide(portsByID.get(link.targetPortId), linkSide(link, "target"));
  return endpointWithSide(portsByID.get(link.sourcePortId), linkSide(link, "source"));
}

function endpointWithSide(endpoint, side) {
  return `${endpoint?.device.name || "Unknown device"}:${endpoint?.port.label || "Unknown port"} [${String(side).toUpperCase()}]`;
}

function linkPath(link, portsByID) {
  return `${endpointWithSide(portsByID.get(link.sourcePortId), linkSide(link, "source"))} → ${endpointWithSide(portsByID.get(link.targetPortId), linkSide(link, "target"))}`;
}

function speedLabel(speedMbps) {
  const speed = Number(speedMbps);
  if (!Number.isFinite(speed) || speed <= 0) return "—";
  if (speed >= 1000) return `${Number((speed / 1000).toFixed(3))} Gbps`;
  return `${speed} Mbps`;
}

function vlanLabel(id, vlansByID) {
  const vlanID = Number(id);
  if (!vlanID) return "—";
  const vlan = vlansByID.get(vlanID);
  return vlan ? `${vlanID} · ${vlan.name}` : String(vlanID);
}

function vlanList(ids, vlansByID) {
  const values = uniqueSorted((ids || []).map(Number).filter(Boolean)).map((id) => vlanLabel(id, vlansByID));
  return values.join(", ") || "—";
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((left, right) => left - right);
}

function countedList(values) {
  return values.length ? `${values.length} · ${values.join(" | ")}` : "0 · NONE";
}

function groupMode(mode) {
  return mode === "MCLAG" ? "MC-LAG" : String(mode || "GROUP").toUpperCase();
}

function groupMemberRole(group, linkID, index = (group.linkIds || []).indexOf(linkID)) {
  if (group.mode === "Failover") return group.primaryLinkId === linkID ? "PRIMARY" : `BACKUP ${Math.max(1, index)}`;
  return `MEMBER ${index + 1}`;
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
}
