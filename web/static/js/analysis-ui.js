export function analysisView(analysis) {
  const normalized = {
    issues: analysis?.issues || [],
    loops: analysis?.loops || [],
    stp: analysis?.stp || [],
  };
  const total = normalized.issues.length + normalized.loops.length;
  const items = [
    ...normalized.issues.map((issue) => `<div class="analysis-item"><b>${escapeHTML(issue.kind.replaceAll("_", " ").toUpperCase())}</b>${escapeHTML(issue.message)}</div>`),
    ...normalized.loops.map((loop) => `<div class="analysis-item"><b>VLAN ${loop.vlanId} LOOP</b>${loop.deviceIds.length} devices participate in a forwarding cycle.</div>`),
  ];
  const stpMarkup = normalized.stp.length ? normalized.stp.map(stpInstanceMarkup).join("") :
    `<p class="analysis-ok">No connected switching domains carry a configured VLAN.</p>`;
  return {
    countText: total ? `${total} ALERT${total === 1 ? "" : "S"}` : "NOMINAL",
    markup: total ? items.join("") : `<p class="analysis-ok">No native VLAN mismatches, tagged drops, or switching cycles detected.</p>`,
    stpCountText: normalized.stp.length ? `${normalized.stp.length} DOMAIN${normalized.stp.length === 1 ? "" : "S"}` : "NO DOMAINS",
    stpMarkup,
  };
}

function stpInstanceMarkup(instance) {
  const blockedPorts = (instance.ports || []).filter((port) => port.role === "Blocked");
  const bridgeByID = new Map((instance.bridges || []).map((bridge) => [bridge.bridgeId, bridge]));
  const bridgeRows = (instance.bridges || []).map((bridge) => {
    const path = (instance.paths || []).find((candidate) => candidate.bridgeId === bridge.bridgeId) || { linkIds: [] };
    const root = bridge.bridgeId === instance.rootBridgeId;
    const blocked = blockedPorts.filter((port) => port.logicalBridgeId === bridge.bridgeId).length;
    return `<button type="button" class="stp-bridge-row${root ? " is-root" : blocked ? " is-blocked" : ""}" data-stp-links="${escapeHTML((path.linkIds || []).join(","))}">
      <span><b>${escapeHTML(bridge.name)}</b><small>${bridge.deviceIds?.length || 1} CHASSIS · PRIORITY ${bridge.priority}</small></span>
      <em>${root ? "ROOT" : blocked ? `${blocked} BLOCKED` : `COST ${bridge.rootPathCost}`}</em>
    </button>`;
  }).join("");
  const pathSummary = (instance.paths || []).filter((path) => path.bridgeId !== instance.rootBridgeId).map((path) => {
    const source = bridgeByID.get(path.bridgeId)?.name || path.bridgeId;
    return `${source} · ${path.linkIds?.length || 0} LINK${path.linkIds?.length === 1 ? "" : "S"}`;
  });
  return `<details class="stp-instance"${blockedPorts.length ? " open" : ""}>
    <summary><span><b>VLAN ${instance.vlanId} · DOMAIN ${instance.domain}</b><small>ROOT ${escapeHTML(instance.rootName)}</small></span><em>${blockedPorts.length ? `${blockedPorts.length} BLOCKED` : "FORWARDING"}</em></summary>
    <div class="stp-instance-body">${bridgeRows}${pathSummary.length ? `<p>${escapeHTML(pathSummary.join(" · "))}</p>` : ""}</div>
  </details>`;
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}
