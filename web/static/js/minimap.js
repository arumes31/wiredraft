export class TopologyMinimap {
  constructor(canvas, engine, state) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.engine = engine;
    this.state = state;
    this.dragging = false;
    this.state.addEventListener("change", () => this.draw());
    canvas.addEventListener("pointerdown", (event) => this.navigate(event));
    canvas.addEventListener("pointermove", (event) => { if (this.dragging) this.navigate(event); });
    canvas.addEventListener("pointerup", () => this.dragging = false);
    canvas.addEventListener("pointercancel", () => this.dragging = false);
  }

  draw() {
    const width = this.canvas.clientWidth || 220;
    const height = this.canvas.clientHeight || 132;
    const ratio = Math.min(2, globalThis.devicePixelRatio || 1);
    this.canvas.width = Math.round(width * ratio);
    this.canvas.height = Math.round(height * ratio);
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.ctx.clearRect(0, 0, width, height);
    const transform = this.transform(width, height);
    this.ctx.fillStyle = "#071012";
    this.ctx.fillRect(0, 0, width, height);
    for (const rack of this.engine.rackRectangles()) this.rect(rack, transform, rack.rack.color, .35);
    for (const device of this.engine.deviceRectangles()) this.rect(device, transform, "#80a1a4", .72);
    const viewport = this.engine.viewportWorldRect();
    this.ctx.strokeStyle = "#42d9c8";
    this.ctx.lineWidth = 1.5;
    this.ctx.strokeRect(
      transform.x(viewport.x), transform.y(viewport.y),
      Math.max(8, viewport.width * transform.scale), Math.max(6, viewport.height * transform.scale),
    );
  }

  navigate(event) {
    this.dragging = true;
    const bounds = this.canvas.getBoundingClientRect();
    const transform = this.transform(bounds.width, bounds.height);
    const x = (event.clientX - bounds.left - transform.offsetX) / transform.scale + transform.world.x;
    const y = (event.clientY - bounds.top - transform.offsetY) / transform.scale + transform.world.y;
    this.engine.centerOn(x, y);
    this.draw();
  }

  transform(width, height) {
    const world = this.engine.worldBounds();
    const padding = 8;
    const scale = Math.min((width - padding * 2) / world.width, (height - padding * 2) / world.height);
    return {
      world, scale,
      offsetX: (width - world.width * scale) / 2,
      offsetY: (height - world.height * scale) / 2,
      x: (x) => (x - world.x) * scale + (width - world.width * scale) / 2,
      y: (y) => (y - world.y) * scale + (height - world.height * scale) / 2,
    };
  }

  rect(box, transform, color, alpha) {
    this.ctx.globalAlpha = alpha;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(transform.x(box.x), transform.y(box.y), Math.max(2, box.width * transform.scale), Math.max(2, box.height * transform.scale));
    this.ctx.globalAlpha = 1;
  }
}
