/** Copy the displayed field, including an unapplied draft, without editing the map. */
export function bindInventoryCopy(form, notify, clipboard = globalThis.navigator?.clipboard) {
  for (const name of ["hostname", "managementIp", "serialNumber", "assetTag"]) {
    const input = form.elements.namedItem(name);
    const label = input.closest("label");
    const caption = label.querySelector("span").textContent;
    const row = document.createElement("div");
    row.className = "inventory-copy-row";
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.inventoryCopy = name;
    button.textContent = "COPY";
    button.setAttribute("aria-label", `Copy ${caption.toLowerCase()}`);
    label.after(row);
    row.append(label, button);
    const refresh = () => { button.disabled = !input.value.trim(); };
    input.addEventListener("input", refresh);
    refresh();
    button.addEventListener("click", async () => {
      try {
        if (!clipboard?.writeText) throw new Error("Clipboard unavailable");
        await clipboard.writeText(input.value);
        notify(`${caption} copied`);
      } catch {
        input.focus();
        input.select();
        notify("Could not access clipboard. Text selected — use Ctrl/Cmd+C to copy.");
      }
    });
  }
}
