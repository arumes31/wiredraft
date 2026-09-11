import { EditMode } from "./editor-lock.js";

const cablingControls = [
  "#patch-panel-map-button", "#patch-panel-map-form", "#link-group-form", "#link-configuration-form", "#link-media-form",
  ".panel-rear-link-edit", "[data-edit-rear-link]", "#delete-link", "#reverse-link-direction", "#edit-link-group", "#leave-link-group",
].join(",");
const equipmentControls = [
  "#add-rack-button", "#add-device-button", "#add-server-button", "#add-patch-panel-button", "#edit-topology-button",
  "#delete-topology-button", "#import-button", "#import-file", "#rack-form", "#device-form", "#static-server-form",
  "#patch-panel-form", "#annotation-form", "#vlan-form", "#vlan-manager-list button", "#switch-system-form", "#firewall-cluster-form",
  "#device-inspector-form", "#rack-inspector-form", "#port-inspector-form", "#annotation-inspector-form",
  ".photo-upload-form", "#photo-details-form", "#delete-photo-button", ".inspector-comment-form",
  "[data-plan-comment-resolve]", "[data-plan-comment-delete]", "#documentation-form", "[data-document-delete]",
  "#share-form", "[data-share-delete]", "#create-switch-system", "#edit-switch-system", "#leave-switch-system",
  "#dissolve-switch-system", "#create-firewall-cluster", "#edit-firewall-cluster", "#leave-firewall-cluster",
  "#dissolve-firewall-cluster", '[data-canvas-tool]:not([data-canvas-tool="select"])', '#topology-form[data-mode="edit"]',
].join(",");

export function editRequirement(element) {
  if (element.closest("[data-close], [data-cancel-rear-link], [data-dialog-unlock]")) return null;
  if (element.closest(cablingControls)) return "cabling";
  return element.closest(equipmentControls) ? "all" : null;
}

export function lockedEditMessage(capability) {
  return capability === "cabling" ? "Connections locked — choose Cabling unlocked or All unlocked." : "Editing locked — choose All unlocked.";
}

/** Keep locked forms inspectable and preserve their unapplied values when the timer expires. */
export function bindEditorLockUI({ lock, state, canvas, notify }) {
  const control = document.getElementById("editor-lock");
  const hint = document.getElementById("editor-lock-hint");
  const originals = new WeakMap();

  function refresh(root = document) {
    for (const element of root.querySelectorAll("button, input, select, textarea")) {
      const requirement = editRequirement(element);
      if (!requirement) continue;
      const blocked = !lock.allows(requirement);
      if (blocked && !originals.has(element)) originals.set(element, { title: element.getAttribute("title"), readOnly: element.readOnly });
      element.classList.toggle("edit-locked", blocked);
      if (blocked) {
        element.setAttribute("aria-disabled", "true");
        element.title = lockedEditMessage(requirement);
        if ("readOnly" in element) element.readOnly = true;
      } else if (originals.has(element)) {
        const original = originals.get(element);
        element.removeAttribute("aria-disabled");
        if (original.title === null) element.removeAttribute("title");
        else element.title = original.title;
        if ("readOnly" in element) element.readOnly = original.readOnly;
        originals.delete(element);
      }
    }
    for (const dialog of document.querySelectorAll("dialog")) {
      const form = [...dialog.querySelectorAll("form")].find((candidate) => editRequirement(candidate));
      if (!form) continue;
      const capability = editRequirement(form);
      let notice = dialog.querySelector(".editor-lock-notice");
      const blocked = !lock.allows(capability);
      if (!notice && blocked) {
        notice = document.createElement("div");
        notice.className = "editor-lock-notice";
        const label = document.createElement("span");
        label.textContent = "Editing locked. Your draft is kept.";
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.dialogUnlock = capability;
        button.textContent = capability === "cabling" ? "Unlock cabling" : "Unlock all editing";
        button.addEventListener("click", () => lock.setMode(capability === "cabling" ? EditMode.CABLING : EditMode.ALL));
        notice.append(label, button);
        form.prepend(notice);
      }
      if (notice) notice.hidden = !blocked;
    }
  }

  function renderMode() {
    control.dataset.mode = lock.mode;
    for (const button of control.querySelectorAll("[data-edit-mode]")) button.setAttribute("aria-pressed", String(button.dataset.editMode === lock.mode));
    hint.textContent = lock.mode === EditMode.READ_ONLY ? "Select and inspect freely. Unlock to edit."
      : lock.mode === EditMode.CABLING ? "Connections editable · equipment locked · relocks after 15 min without edits"
        : "All editing enabled · relocks after 15 min without edits";
    refresh();
    refreshHistory();
  }

  function refreshHistory() {
    for (const [id, entries] of [["undo-button", state.history], ["redo-button", state.future]]) {
      const button = document.getElementById(id);
      const allowed = entries.length > 0 && lock.allowsChange(state.topology, entries.at(-1));
      button.disabled = !allowed;
      button.title = allowed ? (id === "undo-button" ? "Undo (Ctrl+Z)" : "Redo (Ctrl+Y)")
        : entries.length ? "History changes locked — unlock the required editing mode." : "No history available";
    }
  }

  control.addEventListener("click", (event) => {
    const button = event.target.closest("[data-edit-mode]");
    if (button) lock.setMode(button.dataset.editMode);
  });
  lock.addEventListener("change", ({ detail }) => {
    canvas.cancelInteraction();
    if (detail.mode !== EditMode.ALL) canvas.setTool("select");
    renderMode();
    if (detail.reason === "idle") notify("Read only — locked after 15 minutes without changes.");
  });
  state.addEventListener("change", ({ detail }) => {
    if (detail.kind === "topology") refreshHistory();
  });

  const guard = (event) => {
    const element = event.target.closest?.("button, input, select, textarea, form");
    if (!element) return;
    const capability = editRequirement(element);
    if (!capability || lock.allows(capability)) return;
    const textField = element.matches('textarea, input:not([type]), input[type="text"], input[type="number"], input[type="url"], input[type="email"]');
    if (event.type === "keydown" && (event.key === "Tab" || event.key === "Escape" ||
      (textField && (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key) ||
        ((event.ctrlKey || event.metaKey) && ["a", "c"].includes(event.key.toLowerCase())))))) return;
    if ((event.type === "pointerdown" || event.type === "click") && textField) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.type === "click" || event.type === "submit" || event.type === "keydown") notify(lockedEditMessage(capability));
  };
  for (const type of ["pointerdown", "click", "keydown", "beforeinput", "submit", "drop"]) document.addEventListener(type, guard, true);
  // Inspector sections and modal builders replace controls as selection changes.
  const observer = new MutationObserver((records) => {
    if (records.some((record) => [...record.addedNodes].some((node) => node.nodeType === 1))) refresh();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener("focus", () => lock.checkExpiry());
  document.addEventListener("visibilitychange", () => lock.checkExpiry());
  renderMode();
  return { refresh, refreshHistory };
}
