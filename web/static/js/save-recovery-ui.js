/** Use the existing dialog styles and native focus handling for save decisions. */
export function askToLeave(dialog) {
  if (dialog.open) return Promise.resolve("stay");
  return new Promise((resolve) => {
    dialog.returnValue = "stay";
    dialog.addEventListener("close", () => resolve(dialog.returnValue || "stay"), { once: true });
    dialog.showModal();
  });
}

export function downloadDraft(topology) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(topology, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${String(topology.name || "map").replace(/[^a-z0-9_-]/gi, "_")}-recovery.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function renderRecovery(drafts, root, onChange = () => {}) {
  const entries = drafts?.recoveries || [];
  root.hidden = !entries.length && !drafts?.storageError;
  root.replaceChildren();
  if (root.hidden) return;
  const message = document.createElement("p");
  message.textContent = drafts.storageError
    ? "Browser recovery storage is unavailable. Download your unsaved work before leaving this page."
    : "Unsaved work was preserved. Download the recovery JSON, create a blank map, then import it there. Import replaces the selected map. Copies remain in this tab until discarded or the tab is closed.";
  root.append(message);
  for (const entry of entries) {
    const row = document.createElement("div");
    const label = document.createElement("span");
    label.textContent = `${entry.topology.name} · ${new Date(entry.savedAt).toLocaleString()}`;
    const download = document.createElement("button");
    download.type = "button";
    download.textContent = "Download recovery";
    download.addEventListener("click", () => downloadDraft(entry.topology));
    const discard = document.createElement("button");
    discard.type = "button";
    discard.textContent = "Discard copy";
    discard.addEventListener("click", () => {
      if (!window.confirm(`Discard the recovery copy of ${entry.topology.name}?`)) return;
      drafts.discard(entry.id);
      renderRecovery(drafts, root, onChange);
      onChange();
    });
    row.append(label, download, discard);
    root.append(row);
  }
}
