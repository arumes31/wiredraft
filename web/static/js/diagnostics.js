/** Only allow explicitly non-sensitive fields into support output. */
export function diagnosticsText(build, { topology, connection, graphics, editMode, dirty, storageAvailable }) {
  return [
    "WireDraft diagnostics",
    `Build revision: ${build?.revision || "unavailable"}`,
    `Build modified: ${build?.modified || "unknown"}`,
    `Go version: ${build?.goVersion || "unavailable"}`,
    `Map revision: ${topology?.revision ?? "none"}`,
    `Racks: ${topology?.racks?.length || 0}`,
    `Devices: ${topology?.devices?.length || 0}`,
    `Cables: ${topology?.links?.length || 0}`,
    `Connection: ${["online", "offline", "connecting", "reconnecting"].includes(connection) ? connection : "unknown"}`,
    `Graphics: ${["auto", "performance", "balanced", "quality"].includes(graphics) ? graphics : "unknown"}`,
    `Edit mode: ${["read-only", "cabling", "all"].includes(editMode) ? editMode : "unknown"}`,
    `Unsaved changes: ${Boolean(dirty)}`,
    `Recovery storage available: ${Boolean(storageAvailable)}`,
  ].join("\n");
}

export async function showDiagnostics(api, context) {
  const dialog = document.getElementById("about-dialog");
  const content = document.getElementById("diagnostics-content");
  const copy = document.getElementById("copy-diagnostics-button");
  content.textContent = "Loading build information…";
  copy.disabled = true;
  dialog.showModal();
  let build;
  try { build = await api.diagnostics(); } catch { build = null; }
  content.textContent = diagnosticsText(build, context);
  copy.disabled = false;
  copy.onclick = async () => {
    try {
      await navigator.clipboard.writeText(content.textContent);
      copy.textContent = "COPIED";
    } catch {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(content);
      selection.removeAllRanges();
      selection.addRange(range);
      copy.textContent = "SELECTED · PRESS CTRL/CMD+C";
    }
  };
  copy.textContent = "COPY DIAGNOSTICS";
}
