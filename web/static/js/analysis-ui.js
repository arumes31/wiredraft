export function analysisView(analysis) {
  const normalized = analysis || { issues: [], loops: [] };
  const total = normalized.issues.length + normalized.loops.length;
  if (!total) {
    return {
      countText: "NOMINAL",
      markup: `<p class="analysis-ok">No native VLAN mismatches, tagged drops, or switching cycles detected.</p>`,
    };
  }
  const items = [
    ...normalized.issues.map((issue) => `<div class="analysis-item"><b>${escapeHTML(issue.kind.replaceAll("_", " ").toUpperCase())}</b>${escapeHTML(issue.message)}</div>`),
    ...normalized.loops.map((loop) => `<div class="analysis-item"><b>VLAN ${loop.vlanId} LOOP</b>${loop.deviceIds.length} devices participate in a forwarding cycle.</div>`),
  ];
  return { countText: `${total} ALERT${total === 1 ? "" : "S"}`, markup: items.join("") };
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}
