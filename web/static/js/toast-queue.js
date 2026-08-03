export class ToastQueue {
  constructor(container, options = {}) {
    this.container = container;
    this.duration = options.duration || 3200;
    this.maximum = options.maximum || 4;
    this.sequence = 0;
  }

  push(message, kind = "info") {
    const id = ++this.sequence;
    const toast = document.createElement("div");
    toast.className = "toast-item";
    toast.dataset.kind = kind;
    toast.dataset.toastId = String(id);
    toast.setAttribute("role", kind === "error" ? "alert" : "status");
    toast.innerHTML = `<i aria-hidden="true"></i><span></span><button type="button" aria-label="Dismiss notification">×</button>`;
    toast.querySelector("span").textContent = String(message);
    toast.querySelector("button").addEventListener("click", () => this.remove(toast));
    this.container.prepend(toast);
    while (this.container.children.length > this.maximum) this.container.lastElementChild?.remove();
    requestAnimationFrame(() => toast.dataset.visible = "true");
    setTimeout(() => this.remove(toast), this.duration);
    return id;
  }

  remove(toast) {
    if (!toast?.isConnected) return;
    toast.dataset.visible = "false";
    setTimeout(() => toast.remove(), 220);
  }
}
