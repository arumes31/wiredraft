import assert from "node:assert/strict";
import test from "node:test";
import { hardwarePrimitives, hardwareComponentSVG, drawHardwareComponent } from "./static/js/hardware-components.js";

/** Calculate geometry including stroke radius so colored latches cannot escape their physical housing. */
function bounds(part) {
  const half = part.stroke ? (part.strokeWidth || 0) / 2 : 0;
  if (part.kind === "polygon") {
    const xs = part.points.map(([x]) => x), ys = part.points.map(([, y]) => y);
    return [Math.min(...xs) - half, Math.min(...ys) - half, Math.max(...xs) + half, Math.max(...ys) + half];
  }
  if (part.kind === "circle") return [part.cx - part.r - half, part.cy - part.r - half, part.cx + part.r + half, part.cy + part.r + half];
  if (part.kind === "line") return [Math.min(part.x1, part.x2) - half, Math.min(part.y1, part.y2) - half, Math.max(part.x1, part.x2) + half, Math.max(part.y1, part.y2) + half];
  return [part.x - half, part.y - half, part.x + part.width + half, part.y + part.height + half];
}

/** Record the real Canvas drawing path without replacing the shared renderer's primitive dispatch. */
function canvasRecorder() {
  const calls = [];
  return new Proxy({ calls }, { get(object, key) {
    if (key in object) return object[key];
    return (...args) => calls.push([key, ...args]);
  }, set(object, key, value) { object[key] = value; return true; } });
}

for (const [kind, variant, relativeWidth] of [["fan", "netgear-fixed-swept", .09], ["fan", "netgear-m4500-tray", .094],
  ["psu", "netgear-aps550w", .175], ["psu", "netgear-m4500-ac", .195]]) {
  test(`${variant} preserves manufacturer geometry in shared Canvas/SVG at both widths and doubled raster scale`, () => {
    for (const width of [460, 690]) for (const scale of [1, 2]) {
      const box = { kind, variant, x: 11, y: 17, width: width * .95 * relativeWidth * scale, height: 76 * .94 * scale };
      const parts = hardwarePrimitives(box), svg = hardwareComponentSVG(box);
      assert.ok(parts.length >= (variant === "netgear-fixed-swept" ? 3 : 15));
      assert.ok(!parts.some((part) => part.fill === "#42d98b"));
      for (const part of parts) {
        const [left, top, right, bottom] = bounds(part);
        assert.ok([left, top, right, bottom].every(Number.isFinite));
        assert.ok(left >= box.x - 1e-8 && top >= box.y - 1e-8 && right <= box.x + box.width + 1e-8 && bottom <= box.y + box.height + 1e-8,
          `${variant} ${width} ${scale}: ${JSON.stringify(part)}`);
      }
      const svgPolygons = [...svg.matchAll(/<polygon[^>]*points="([^"]+)"/g)].map((match) => match[1].split(" ").map((point) => point.split(",").map(Number)));
      assert.deepEqual(svgPolygons, parts.filter((part) => part.kind === "polygon").map((part) => part.points));
      const context = canvasRecorder(); drawHardwareComponent(context, box);
      assert.equal(context.calls.filter(([name]) => name === "closePath").length, parts.filter((part) => part.kind === "polygon").length);
    }
  });
}

test("NETGEAR fan cutouts, tray release tabs and opposite inlet/fan PSU orientation remain distinct", () => {
  const art = (kind, variant) => hardwarePrimitives({ kind, variant, x: 0, y: 0, width: 100, height: 70 });
  const fixed = art("fan", "netgear-fixed-swept");
  assert.equal(fixed.length, 3); assert.ok(fixed.every((part) => part.kind === "polygon"));
  const tray = art("fan", "netgear-m4500-tray");
  assert.equal(tray.filter((part) => part.kind === "polygon" && part.points.length === 6).length, 35);
  assert.ok(tray.find((part) => part.fill === "#d84330").x < 10);
  const aps = art("psu", "netgear-aps550w"), m4500 = art("psu", "netgear-m4500-ac");
  assert.ok(aps.find((part) => part.kind === "circle").cx < 50);
  assert.ok(m4500.find((part) => part.kind === "circle").cx > 50);
  assert.ok(aps.find((part) => part.kind === "polygon").points.every(([x]) => x > 50));
  assert.ok(m4500.find((part) => part.kind === "polygon").points.every(([x]) => x < 50));
});
