import assert from "node:assert/strict";
import test from "node:test";

import { drawHardwareComponent, hardwareComponentSVG, hardwarePrimitives } from "./static/js/hardware-components.js";

const kinds = [
  "rj45", "sfp", "qsfp", "osfp", "cfp", "lc", "sc", "mpo", "usb-mini", "usb-micro", "usb-c",
  "console", "stack", "dsl", "coax", "power", "usb", "led", "vent", "fan", "handle", "psu",
  "module-bay", "text", "chassis", "unknown",
];

test("hardware artwork has finite geometry within each component's bounds", () => {
  for (const kind of kinds) {
    for (const size of [12, 36, 160]) {
      const box = { kind, x: -25, y: 19, width: size, height: size / 2, label: "TEST" };
      const primitives = hardwarePrimitives(box);
      assert.ok(primitives.length, `${kind} produces artwork`);
      for (const primitive of primitives) {
        for (const value of Object.values(primitive)) {
          if (typeof value === "number") assert.ok(Number.isFinite(value), `${kind} has finite coordinates`);
        }
        const bounds = primitiveBounds(primitive);
        assert.ok(bounds.x >= box.x - 1e-8 && bounds.y >= box.y - 1e-8, `${kind} starts inside bounds`);
        assert.ok(bounds.x + bounds.width <= box.x + box.width + 1e-8, `${kind} fits width`);
        assert.ok(bounds.y + bounds.height <= box.y + box.height + 1e-8, `${kind} fits height`);
      }
    }
  }
});

test("connector families retain distinct physical details", () => {
  const component = { x: 0, y: 0, width: 60, height: 30 };
  const rj45 = hardwarePrimitives({ ...component, kind: "rj45" });
  const dsl = hardwarePrimitives({ ...component, kind: "dsl" });
  assert.equal(rj45.filter((part) => part.fill === "#d7b76c").length, 8, "RJ45 has eight copper pins");
  assert.equal(dsl.filter((part) => part.fill === "#d7b76c").length, 6, "RJ11 has six copper pins");
  assert.notDeepEqual(hardwarePrimitives({ ...component, kind: "sfp" }), rj45);
  assert.notDeepEqual(hardwarePrimitives({ ...component, kind: "usb" }), rj45);
  assert.ok(hardwarePrimitives({ ...component, kind: "coax" }).every((part) => part.kind === "circle"));
  assert.notDeepEqual(hardwarePrimitives({ ...component, kind: "psu", variant: "ac" }),
    hardwarePrimitives({ ...component, kind: "psu", variant: "dc" }));
  assert.notDeepEqual(hardwarePrimitives({ ...component, kind: "power", variant: "ac" }),
    hardwarePrimitives({ ...component, kind: "power", variant: "dc-barrel" }));
  assert.ok(hardwarePrimitives({ ...component, kind: "power", variant: "dc-barrel" })
    .every((part) => part.kind === "circle"), "an external DC barrel jack is circular");
  const keyedDC = hardwarePrimitives({ kind: "power", variant: "dc-keyed2", x: 0, y: 0, width: 14, height: 32 });
  const pins = keyedDC.filter((part) => part.fill === "#b9c3c4");
  assert.equal(pins.length, 2, "Fortinet desktop DC inlets have two contacts");
  assert.equal(pins[0].x, pins[1].x, "keyed DC contacts are vertically stacked");
  assert.ok(pins[0].y < pins[1].y);
});

test("vent variants retain distinct slot, round-perforation, and square-mesh openings", () => {
  const box = { kind: "vent", x: 20, y: 30, width: 110, height: 36 };
  const slots = hardwarePrimitives({ ...box, variant: "slots" });
  const perforated = hardwarePrimitives({ ...box, variant: "perforated" });
  const mesh = hardwarePrimitives({ ...box, variant: "mesh" });
  assert.ok(slots.every((part) => part.kind === "rect" && part.width > part.height && part.rx > 0));
  assert.ok(perforated.every((part) => part.kind === "circle"));
  assert.ok(mesh.every((part) => part.kind === "rect" && Math.abs(part.width - part.height) < 1e-8 && part.rx === 0));
  for (const art of [slots, perforated, mesh]) {
    assert.ok(art.length > 1, "a vent grille repeats its openings");
    for (const part of art) {
      const bounds = primitiveBounds(part);
      assert.ok(bounds.x >= box.x && bounds.y >= box.y);
      assert.ok(bounds.x + bounds.width <= box.x + box.width && bounds.y + bounds.height <= box.y + box.height);
    }
  }
});

test("USB-A tongues and contacts follow vertical or horizontal mounting", () => {
  const horizontal = hardwarePrimitives({ kind: "usb", x: 0, y: 0, width: 30, height: 12 });
  const vertical = hardwarePrimitives({ kind: "usb", x: 0, y: 0, width: 12, height: 30 });
  const horizontalPins = horizontal.filter((part) => part.fill === "#d7b76c");
  const verticalPins = vertical.filter((part) => part.fill === "#d7b76c");
  assert.equal(horizontalPins.length, 4);
  assert.equal(verticalPins.length, 4);
  assert.equal(new Set(horizontalPins.map((part) => part.y)).size, 1);
  assert.equal(new Set(horizontalPins.map((part) => part.x)).size, 4);
  assert.equal(new Set(verticalPins.map((part) => part.x)).size, 1);
  assert.equal(new Set(verticalPins.map((part) => part.y)).size, 4);
  assert.ok(vertical[1].height > vertical[1].width, "the vertical port's tongue rotates with its contacts");
});

test("single slits, vertical heatsink fins and chevrons retain bounded distinct primitives", () => {
  const box = { kind: "vent", x: 10, y: 20, width: 140, height: 24 };
  const slit = hardwarePrimitives({ ...box, variant: "slit" });
  assert.equal(slit.length, 1);
  assert.ok(slit[0].width > box.width * .95);
  const fins = hardwarePrimitives({ ...box, variant: "fins" });
  assert.ok(fins.some((part) => part.kind === "rect" && part.height > part.width));
  assert.ok(fins.some((part) => part.kind === "line" && part.x1 === part.x2));
  const chevrons = hardwarePrimitives({ ...box, variant: "chevron" });
  assert.ok(chevrons.every((part) => part.kind === "line" && part.x1 !== part.x2 && part.y1 !== part.y2));
  assert.equal(chevrons[0].x2, chevrons[1].x1);
    assert.equal(chevrons[0].y2, chevrons[1].y1);
    const louvers = hardwarePrimitives({ ...box, variant: "louver" });
    assert.equal(louvers.length * 2, chevrons.length);
    assert.ok(louvers.every((part) => part.kind === "line" && part.x2 > part.x1 && part.y2 > part.y1));
    for (const part of [...slit, ...fins, ...chevrons, ...louvers]) {
    const bounds = primitiveBounds(part);
    assert.ok(bounds.x >= box.x && bounds.y >= box.y);
    assert.ok(bounds.x + bounds.width <= box.x + box.width && bounds.y + bounds.height <= box.y + box.height);
  }
});

test("selection stroke widths stay consistent between Canvas and SVG", () => {
  const component = { kind: "rj45", x: 10, y: 20, width: 18, height: 14 };
  const palette = { stroke: "#7affee", strokeWidth: 1.8 };
  const primitives = hardwarePrimitives(component, palette);
  assert.ok(primitives.filter((part) => part.stroke).every((part) => part.strokeWidth === 1.8));
  const canvas = recordingContext();
  drawHardwareComponent(canvas, component, palette);
  assert.ok(canvas.strokeWidths.every((width) => width === 1.8));
  assert.ok(hardwareComponentSVG(component, palette).includes('stroke-width="1.8"'));
  for (const strokeWidth of [NaN, Infinity, -1]) {
    const fallback = hardwarePrimitives(component, { strokeWidth });
    assert.ok(fallback.every((part) => Number.isFinite(part.strokeWidth) && part.strokeWidth >= 0));
  }
});

test("both adapters render the same shapes and preserve the caller's canvas state", () => {
  for (const kind of kinds) {
    const component = { kind, x: 10, y: 20, width: 90, height: 40, label: "A&B" };
    const palette = { surface: "#eee", surfaceDark: "#666", ink: "#222", accent: "#abc", fill: "#123", stroke: "#456" };
    const primitives = hardwarePrimitives(component, palette);
    const canvas = recordingContext();
    drawHardwareComponent(canvas, component, palette);
    const svg = hardwareComponentSVG(component, palette);
    assert.equal(canvas.saved, 1);
    assert.equal(canvas.restored, 1);
    assert.equal(canvas.shapes.length, primitives.length);
    assert.equal((svg.match(/<(?:rect|circle|line|text)\b/g) || []).length, primitives.length);
    assert.deepEqual(canvas.shapes.map((shape) => shape.kind), primitives.map((shape) => shape.kind));
    for (const [index, primitive] of primitives.entries()) {
      const drawn = canvas.shapes[index];
      for (const key of Object.keys(drawn).filter((key) => key !== "kind")) assert.equal(drawn[key], primitive[key] ?? 0);
    }
  }
});

test("SVG escapes text and styling values without allowing markup injection", () => {
  const component = { kind: "text", x: 0, y: 0, width: 500, height: 40, text: '<script>alert("test")</script>&\'' };
  const svg = hardwareComponentSVG(component, { ink: 'red" onload="bad()' });
  assert.ok(svg.includes("&lt;script&gt;"));
  assert.ok(svg.includes("&amp;"));
  assert.ok(svg.includes("&quot;"));
  assert.ok(svg.includes("&#39;"));
  assert.ok(!svg.includes("<script>"));
  assert.ok(!svg.includes('fill="red" onload='));
});

test("invalid component geometry never reaches either renderer", () => {
  for (const component of [null, {}, { kind: "rj45", x: 0, y: 0, width: -1, height: 20 },
    { kind: "rj45", x: NaN, y: 0, width: 10, height: 20 },
    { kind: "rj45", x: 0, y: Infinity, width: 10, height: 20 }]) {
    assert.deepEqual(hardwarePrimitives(component), []);
    assert.equal(hardwareComponentSVG(component), "");
    const canvas = recordingContext();
    drawHardwareComponent(canvas, component);
    assert.equal(canvas.shapes.length, 0);
  }
});

/** Return the geometric bounds of a neutral drawing primitive. */
function primitiveBounds(part) {
  if (part.kind === "circle") return { x: part.cx - part.r, y: part.cy - part.r, width: part.r * 2, height: part.r * 2 };
  if (part.kind === "line") return { x: Math.min(part.x1, part.x2), y: Math.min(part.y1, part.y2), width: Math.abs(part.x2 - part.x1), height: Math.abs(part.y2 - part.y1) };
  if (part.kind === "text") return { x: part.x, y: part.y, width: 0, height: 0 };
  return part;
}

/** Record emitted geometry at the Canvas API boundary for adapter parity checks. */
function recordingContext() {
  return {
    shapes: [], strokeWidths: [], saved: 0, restored: 0,
    save() { this.saved += 1; },
    restore() { this.restored += 1; },
    beginPath() {},
    roundRect(x, y, width, height, rx) { this.shapes.push({ kind: "rect", x, y, width, height, rx }); },
    arc(cx, cy, r) { this.shapes.push({ kind: "circle", cx, cy, r }); },
    moveTo(x1, y1) { this.pending = { kind: "line", x1, y1 }; },
    lineTo(x2, y2) { this.shapes.push({ ...this.pending, x2, y2 }); },
    fillText(text, x, y) { this.shapes.push({ kind: "text", text, x, y }); },
    fill() {}, stroke() { this.strokeWidths.push(this.lineWidth); },
  };
}

test("displays, buttons and populated module bays retain their distinct hardware details", () => {
  const bounds = { x: 10, y: 20, width: 40, height: 30 };
  const display = hardwarePrimitives({ ...bounds, kind: "lcd" });
  const button = hardwarePrimitives({ ...bounds, kind: "button" });
  assert.equal(display.filter((part) => part.kind === "rect").length, 2);
  assert.equal(button.filter((part) => part.kind === "circle").length, 3);
  const cover = hardwarePrimitives({ ...bounds, kind: "module-bay", variant: "blank" });
  const installed = hardwarePrimitives({ ...bounds, kind: "module-bay", variant: "populated" });
  assert.equal(cover.filter((part) => part.kind === "line").length, 2);
  assert.equal(installed.filter((part) => part.kind === "line").length, 0);
  assert.equal(hardwarePrimitives({ ...bounds, kind: "text", label: "DEVICE", ink: "#abcdef" })[0].fill, "#abcdef");
});

test("keyed four-pin power and recessed controls do not resemble network sockets", () => {
  const bounds = { x: 0, y: 0, width: 24, height: 24 };
  const power = hardwarePrimitives({ ...bounds, kind: "power", variant: "dc-keyed4" });
  const pins = power.filter((part) => part.fill === "#b9c3c4");
  assert.equal(pins.length, 4);
  assert.equal(new Set(pins.map((pin) => pin.x)).size, 2);
  assert.equal(new Set(pins.map((pin) => pin.y)).size, 2);
  const reset = hardwarePrimitives({ ...bounds, kind: "button", variant: "reset" });
  assert.equal(reset.length, 2);
  assert.ok(reset.every((part) => part.kind === "circle"));
  const slider = hardwarePrimitives({ ...bounds, kind: "switch", variant: "firmware-slider" });
  assert.deepEqual(slider.map((part) => part.kind), ["rect", "rect", "line"]);
  const rps = hardwarePrimitives({ ...bounds, width: 70, kind: "power", variant: "dc-multipin", columns: 9 });
  assert.equal(rps.filter((part) => part.fill === "#b9c3c4").length, 18);
  const unknown = hardwarePrimitives({ ...bounds, kind: "power", variant: "dc-multipin" });
  assert.equal(unknown.filter((part) => part.fill === "#b9c3c4").length, 0);
  const terminal = hardwarePrimitives({ ...bounds, width: 80, kind: "terminal", pins: 5 });
  assert.equal(terminal.filter((part) => part.kind === "circle").length, 5);
  const verticalTerminal = hardwarePrimitives({ ...bounds, height: 80, kind: "terminal", pins: 4 });
  assert.equal(new Set(verticalTerminal.filter((part) => part.kind === "circle").map((part) => part.cy)).size, 4);
});

test("right-inlet power supplies and grounding studs retain their actual physical roles", () => {
  const bounds = { x: 0, y: 0, width: 100, height: 50 };
  const power = hardwarePrimitives({ ...bounds, kind: "psu", variant: "ac-inlet-right" });
  const contacts = power.filter((part) => part.fill === "#b9c3c4");
  assert.equal(contacts.length, 3);
  assert.ok(contacts.every((part) => part.x > 50), "the AC inlet belongs to the right of the release handle");
  const stud = hardwarePrimitives({ ...bounds, width: 20, height: 20, kind: "screw" });
  assert.deepEqual(stud.map((part) => part.kind), ["circle", "circle", "line", "line"]);
});

test("DC supplies distinguish a keyed pair from screw terminals and their separate grounding stud", () => {
  const bounds = { x: 0, y: 0, width: 100, height: 100, kind: "psu" };
  const keyed = hardwarePrimitives({ ...bounds, variant: "dc-keyed2" });
  const keyedContacts = keyed.filter((part) => part.kind === "circle" && part.fill === "#b9c3c4");
  assert.equal(keyedContacts.length, 2);
  assert.equal(keyedContacts[0].cy, keyedContacts[1].cy);
  const terminal = hardwarePrimitives({ ...bounds, variant: "dc-terminal2" });
  const screws = terminal.filter((part) => part.kind === "circle" && part.fill === "#b9c3c4");
  assert.equal(screws.length, 3);
  assert.equal(screws.filter((part) => part.cy > 50).length, 2);
  assert.equal(screws.filter((part) => part.cy < 50).length, 1);
  assert.equal(terminal.filter((part) => part.fill === "#d7b76c").length, 0);
});

test("fan-right AC supplies place their inlet opposite the circular fan", () => {
  const bounds = { x: 0, y: 0, width: 100, height: 50, kind: "psu" };
  const left = hardwarePrimitives({ ...bounds, variant: "ac-fan-left" });
  const right = hardwarePrimitives({ ...bounds, variant: "ac-fan-right" });
  assert.deepEqual(right.slice(0, 2), left.slice(0, 2), "both variants retain the same module housing");
  const fan = right.find((part) => part.kind === "circle" && part.fill === "#122327");
  assert.ok(fan && fan.cx > 60, "the circular fan belongs to the right side");
  const inlet = right.find((part) => part.kind === "rect" && part.fill === "#0d1c21");
  const contacts = right.filter((part) => part.fill === "#b9c3c4");
  assert.equal(contacts.length, 3);
  assert.ok(contacts.every((part) => part.x >= inlet.x && part.x + part.width <= inlet.x + inlet.width));
  assert.ok(inlet.x + inlet.width < fan.cx - fan.r, "the left inlet and right fan do not overlap");
  assert.equal(fan.cy, left.find((part) => part.fill === "#122327").cy);
});

test("vertical AC and DC supplies retain an upper inlet and a horizontal pull bar below it", () => {
  const bounds = { x: 0, y: 0, width: 60, height: 100, kind: "psu" };
  for (const variant of ["ac", "dc-terminal2"]) {
    const vertical = hardwarePrimitives({ ...bounds, variant, orientation: "vertical" });
    const contacts = vertical.filter((part) => part.fill === "#b9c3c4");
    assert.equal(contacts.length, 3);
    assert.ok(contacts.every((part) => primitiveBounds(part).y + primitiveBounds(part).height < 60));
    const handle = vertical.find((part) => part.kind === "rect" && part.y >= 60 && part.width > bounds.width * .6);
    assert.ok(handle && handle.width > handle.height * 3, "the pull bar is horizontal below the inlet");
    assert.ok(vertical.some((part) => part.fill === "#42d98b" && part.cy > handle.y));
    assert.ok(vertical.some((part) => part.fill === "#22a0ab" && part.y > handle.y));
    assert.deepEqual(hardwarePrimitives({ ...bounds, variant, orientation: "horizontal" }),
      hardwarePrimitives({ ...bounds, variant }), "existing horizontal artwork only changes when explicitly requested");
  }
  const dc = hardwarePrimitives({ ...bounds, variant: "dc-terminal2", orientation: "vertical" });
  const screws = dc.filter((part) => part.kind === "circle" && part.fill === "#b9c3c4");
  const [upper, lower, earth] = screws;
  assert.equal(upper.cx, lower.cx, "the two DC terminals are stacked vertically");
  assert.ok(upper.cy < lower.cy && earth.cx > lower.cx && earth.cy > lower.cy, "protective earth is separate, below and to the right");
  assert.ok(!hardwarePrimitives({ ...bounds, variant: "ac", orientation: "vertical", active: false })
    .some((part) => part.fill === "#42d98b"));
});

test("new PSU orientations stay bounded and render identical geometry through both adapters", () => {
  const configurations = [
    { variant: "ac-fan-right", width: 100, height: 50 },
    ...["ac", "dc-terminal2"].flatMap((variant) => [[30, 70], [80, 120], [10, 20]].map(([width, height]) =>
      ({ variant, orientation: "vertical", width, height }))),
  ];
  for (const configuration of configurations) {
    const component = { kind: "psu", x: 10, y: 20, label: "PSU1", ...configuration };
    const parts = hardwarePrimitives(component);
    const canvas = recordingContext();
    drawHardwareComponent(canvas, component);
    const svg = hardwareComponentSVG(component);
    assert.equal((svg.match(/<(?:rect|circle|line|text)\b/g) || []).length, parts.length);
    assert.equal(canvas.shapes.length, parts.length);
    for (const [index, part] of parts.entries()) {
      const bounds = primitiveBounds(part);
      assert.ok(Object.values(bounds).filter((value) => typeof value === "number").every(Number.isFinite));
      assert.ok(bounds.x >= component.x && bounds.y >= component.y);
      assert.ok(bounds.x + bounds.width <= component.x + component.width + 1e-10);
      assert.ok(bounds.y + bounds.height <= component.y + component.height + 1e-10);
      for (const [key, value] of Object.entries(canvas.shapes[index])) assert.equal(value, part[key] ?? 0);
      for (const key of ["x", "y", "width", "height", "cx", "cy", "r", "x1", "y1", "x2", "y2"]) {
        if (part[key] !== undefined) assert.ok(svg.includes(`${key}="${part[key]}"`));
      }
    }
  }
});

test("fixed chassis fans retain a circular grille without a removable square housing", () => {
  const bounds = { x: 0, y: 0, width: 40, height: 40, kind: "fan" };
  const fixed = hardwarePrimitives({ ...bounds, variant: "fixed" });
  assert.equal(fixed.filter((part) => part.kind === "rect").length, 0);
  assert.ok(fixed.some((part) => part.kind === "circle"));
  assert.ok(hardwarePrimitives(bounds).some((part) => part.kind === "rect"));
});

test("covered antenna fittings have no exposed center contact", () => {
  const component = { x: 0, y: 0, width: 20, height: 20, kind: "coax" };
  const covered = hardwarePrimitives({ ...component, variant: "capped" });
  assert.equal(covered.filter((part) => part.fill === "#d7b76c").length, 0);
  assert.equal(covered.length, 2);
  assert.equal(hardwarePrimitives(component).filter((part) => part.fill === "#d7b76c").length, 1);
});
