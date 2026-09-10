import assert from "node:assert/strict";
import test from "node:test";

import { drawHardwareComponent, hardwareComponentSVG, hardwarePrimitives } from "./static/js/hardware-components.js";

test("inverted modular sockets rotate existing details and reserve a tiny housing antialias margin", () => {
  const box = { x: 10, y: 20, width: 18, height: 16 };
  for (const kind of ["rj45", "console"]) {
    const normal = hardwarePrimitives({ ...box, kind });
    const inverted = hardwarePrimitives({ ...box, kind: `${kind}-inverted` });
    assert.equal(inverted.length, normal.length);
    for (const [index, part] of normal.entries()) {
      const actual = inverted[index];
      assert.equal(actual.kind, part.kind);
      assert.equal(actual.fill, part.fill);
      assert.equal(actual.stroke, part.stroke);
      if (index === 0) {
        const margin = actual.strokeWidth / 2 + .4;
        assert.ok(actual.x - box.x >= margin && actual.y - box.y >= margin);
        assert.ok(box.x + box.width - actual.x - actual.width >= margin && box.y + box.height - actual.y - actual.height >= margin);
        continue;
      }
      if (part.kind === "rect") {
        assert.ok(Math.abs(actual.x - (box.x * 2 + box.width - part.x - part.width)) < 1e-8);
        assert.ok(Math.abs(actual.y - (box.y * 2 + box.height - part.y - part.height)) < 1e-8);
        assert.equal(actual.width, part.width); assert.equal(actual.height, part.height);
      } else if (part.kind === "line") {
        assert.ok(Math.abs(actual.x1 - (box.x * 2 + box.width - part.x1)) < 1e-8);
        assert.ok(Math.abs(actual.y1 - (box.y * 2 + box.height - part.y1)) < 1e-8);
        assert.ok(Math.abs(actual.x2 - (box.x * 2 + box.width - part.x2)) < 1e-8);
        assert.ok(Math.abs(actual.y2 - (box.y * 2 + box.height - part.y2)) < 1e-8);
      }
    }
    assert.equal(inverted.filter((part) => part.fill === "#d7b76c").length, 8);
  }
});

test("mounting slots are single empty capsules with an optional aperture fill", () => {
  const box = { kind: "mounting-slot", x: 10, y: 20, width: 12, height: 5 };
  const parts = hardwarePrimitives(box);
  assert.equal(parts.length, 1);
  assert.equal(parts[0].kind, "rect");
  assert.ok(parts[0].width > parts[0].height * 2 && parts[0].rx >= parts[0].height / 2);
  assert.equal(parts[0].fill, "#07151a");
  assert.equal(hardwarePrimitives(box, { fill: "#ffffff" })[0].fill, "#ffffff");
});

test("caption leaders are bounded annotation lines with explicit diagonal direction and color", () => {
  const box = { kind: "leader-line", x: 10, y: 20, width: 26, height: 14, color: "#543210" };
  const down = hardwarePrimitives(box);
  const up = hardwarePrimitives({ ...box, variant: "up-right" });
  assert.equal(down.length, 1); assert.equal(up.length, 1);
  assert.equal(down[0].kind, "line"); assert.equal(up[0].kind, "line");
  assert.equal(down[0].stroke, box.color);
  assert.ok(down[0].x1 < down[0].x2 && down[0].y1 < down[0].y2);
  assert.ok(up[0].x1 < up[0].x2 && up[0].y1 > up[0].y2);
  assert.equal(up[0].x1, down[0].x1); assert.equal(up[0].x2, down[0].x2);
  assert.equal(up[0].y1, down[0].y2); assert.equal(up[0].y2, down[0].y1);
  assert.ok(down[0].x1 > box.x && down[0].y1 > box.y && down[0].x2 < box.x + box.width && down[0].y2 < box.y + box.height);
});

test("subpixel orthogonal caption leaders retain visible thickness without stroke overflow", () => {
  for (const [variant, width, height] of [["horizontal", 31.3, .28], ["vertical", .414, 25.664]]) {
    const box = { kind: "leader-line", variant, x: 10, y: 20, width, height, color: "#c1d1d5" };
    const parts = hardwarePrimitives(box);
    assert.equal(parts.length, 1);
    assert.equal(parts[0].kind, "rect");
    assert.equal(parts[0].fill, box.color);
    assert.equal(parts[0].stroke, undefined);
    const thickness = variant === "horizontal" ? parts[0].height : parts[0].width;
    assert.equal(thickness, Math.min(.4, width, height));
    assert.ok(Math.abs(parts[0].x + parts[0].width / 2 - box.x - width / 2) < 1e-8);
    assert.ok(Math.abs(parts[0].y + parts[0].height / 2 - box.y - height / 2) < 1e-8);
  }
});

test("honeycomb ventilation has regular bounded hexagonal apertures without fan parts", () => {
  const box = { kind: "vent", variant: "honeycomb", x: 10, y: 20, width: 52, height: 48 };
  const parts = hardwarePrimitives(box);
  assert.ok(parts.length > 20);
  assert.ok(parts.every((part) => part.kind === "polygon" && part.points.length === 6));
  for (const part of parts) {
    assert.equal(part.fill, "#172125");
    const lengths = part.points.map(([x, y], index) => {
      const next = part.points[(index + 1) % 6];
      assert.ok(x > box.x && x < box.x + box.width && y > box.y && y < box.y + box.height);
      return Math.hypot(x - next[0], y - next[1]);
    });
    assert.ok(Math.max(...lengths) - Math.min(...lengths) < 1e-8);
  }
  assert.ok(hardwarePrimitives({ ...box, variant: "mesh" }).every((part) => part.kind === "rect"));
});

test("core Aruba fan trays distinguish low, central and vertical grips over honeycomb guards", () => {
  for (const [variant, width] of [["aruba-8320", 85.2], ["aruba-8325", 70.8], ["aruba-8360", 68.8]]) {
    const box = { kind: "fan", variant, x: 0, y: 0, width, height: 68.4, active: false };
    const parts = hardwarePrimitives(box);
    assert.ok(parts.filter((part) => part.kind === "polygon" && part.points.length === 6).length > 20);
    assert.ok(!parts.some((part) => part.fill === "#42d98b"));
    const grips = parts.filter((part) => part.kind === "rect" && part.fill === "#26343a");
    const grip = grips.find((part) => variant === "aruba-8360" ? part.height > part.width * 4 : part.width > part.height * 4);
    assert.ok(grip, `${variant} has its photographed pull direction`);
    if (variant === "aruba-8320") {
      assert.ok(grip.y > box.height * .70);
      assert.ok(parts.some((part) => part.kind === "circle" && part.cx > width * .80 && part.cy < box.height * .25));
    } else if (variant === "aruba-8325") {
      assert.ok(grip.y > box.height * .40 && grip.y + grip.height < box.height * .66);
    } else {
      const latch = parts.find((part) => part.kind === "rect" && part.fill === "#bb2634");
      assert.ok(latch && latch.x > grip.x + grip.width);
    }
  }
});

test("core Aruba AC supplies retain left-beveled right inlets and distinct handle and latch positions", () => {
  for (const [variant, width] of [["aruba-8320-ac", 86.5], ["aruba-8325-ac", 85.2], ["aruba-8360-ac", 109.5]]) {
    const box = { kind: "psu", variant, x: 0, y: 0, width, height: 68.4, active: false };
    const parts = hardwarePrimitives(box);
    const inlet = parts.find((part) => part.kind === "polygon" && part.fill === "#07151a");
    assert.ok(inlet && Math.min(...inlet.points.map(([x]) => x)) > width * .45);
    const blades = parts.filter((part) => part.kind === "rect" && part.fill === "#b9c3c4");
    assert.equal(blades.length, 3);
    assert.ok(blades.every((blade) => blade.width > blade.height));
    assert.ok(blades[0].x < blades[1].x && blades[1].x === blades[2].x);
    assert.ok(blades[1].y > blades[0].y && blades[0].y > blades[2].y);
    const grip = parts.find((part) => part.kind === "rect" && part.fill === "#26343a");
    const latch = parts.find((part) => part.kind === "rect" && part.fill === "#bb2634");
    assert.ok(grip && latch);
    if (variant === "aruba-8360-ac") assert.ok(grip.width > grip.height * 5 && grip.y < box.height * .15);
    else assert.ok(grip.height > grip.width * 4);
    if (variant === "aruba-8325-ac") assert.ok(latch.x + latch.width < grip.x);
    else assert.ok(latch.y > box.height * .6 && latch.x > width * .7);
    assert.ok(!parts.some((part) => part.fill === "#42d98b"));
  }
});

test("core Aruba and pure honeycomb artwork share finite bounded Canvas and SVG geometry", () => {
  for (const configuration of [
    { kind: "vent", variant: "honeycomb", width: 52, height: 48 },
    { kind: "rj45-inverted", width: 18, height: 16 },
    { kind: "console-inverted", width: 18, height: 16 },
    { kind: "mounting-slot", width: 13.8, height: 9 },
    { kind: "leader-line", width: 26, height: 14 },
    { kind: "leader-line", variant: "up-right", width: 26, height: 3 },
    { kind: "leader-line", variant: "horizontal", width: 31.3, height: .28 },
    { kind: "leader-line", variant: "vertical", width: .414, height: 25.664 },
    { kind: "fan", variant: "aruba-8320", width: 85.2, height: 68.4 },
    { kind: "fan", variant: "aruba-8325", width: 70.8, height: 68.4 },
    { kind: "fan", variant: "aruba-8360", width: 68.8, height: 68.4 },
    { kind: "psu", variant: "aruba-8320-ac", width: 86.5, height: 68.4 },
    { kind: "psu", variant: "aruba-8325-ac", width: 85.2, height: 68.4 },
    { kind: "psu", variant: "aruba-8360-ac", width: 109.5, height: 68.4 },
  ]) for (const scale of [1, 2]) {
    const box = { ...configuration, x: 10, y: 20, width: configuration.width * scale, height: configuration.height * scale };
    const parts = hardwarePrimitives(box);
    for (const part of parts) {
      const bounds = primitiveBounds(part);
      assert.ok([bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite));
      assert.ok(bounds.x >= box.x && bounds.y >= box.y && bounds.x + bounds.width <= box.x + box.width && bounds.y + bounds.height <= box.y + box.height);
    }
    const canvas = recordingContext(); drawHardwareComponent(canvas, box);
    assert.deepEqual(canvas.shapes.map((part) => part.kind), parts.map((part) => part.kind));
    for (const [index, part] of canvas.shapes.entries()) for (const key of Object.keys(part)) assert.deepEqual(part[key], parts[index][key]);
    const vertices = [...hardwareComponentSVG(box).matchAll(/<polygon[^>]*points="([^"]+)"/g)].map((match) => match[1].split(" ").map((point) => point.split(",").map(Number)));
    assert.deepEqual(vertices, parts.filter((part) => part.kind === "polygon").map((part) => part.points));
  }
});

test("decorative panel accents retain explicit color and a bounded normalized taper", () => {
  const box = { kind: "panel-accent", variant: "trapezoid", color: "#cf1739", x: 10, y: 20, width: 120, height: 35 };
  for (const [taper, expected] of [[.2, .2], [0, 0], [-2, 0], [2, 1], [NaN, .08], [Infinity, .08]]) {
    const parts = hardwarePrimitives({ ...box, taper });
    assert.equal(parts.length, 1);
    assert.equal(parts[0].kind, "polygon");
    assert.equal(parts[0].fill, box.color);
    assert.equal(parts[0].stroke, undefined);
    assert.deepEqual(parts[0].points, [[10, 20], [10 + (1 - expected) * 120, 20], [130, 55], [10, 55]]);
  }
  assert.equal(hardwarePrimitives({ ...box, color: undefined })[0].fill, "#22a0ab");
});

test("telephone RJ11 preserves a stepped modular opening without guessing populated contacts", () => {
  const box = { kind: "rj11", x: 10, y: 20, width: 18, height: 18 };
  const parts = hardwarePrimitives(box, { fill: "#123456", stroke: "#654321", strokeWidth: 2 });
  assert.equal(parts.length, 2);
  assert.equal(parts[0].kind, "rect");
  assert.equal(parts[1].kind, "polygon");
  assert.equal(parts[1].fill, "#123456");
  assert.equal(parts[0].stroke, "#654321");
  assert.equal(parts[0].strokeWidth, 2);
  assert.ok(parts[1].points.length >= 8);
  assert.ok(!parts.some((part) => part.fill === "#d7b76c" || part.kind === "circle"));
});

test("small RJ11 housings reserve an antialias margin within their physical bounds", () => {
  for (const [width, height] of [[18, 18], [14, 11]]) {
    const box = { kind: "rj11", x: 10, y: 20, width, height };
    const housing = hardwarePrimitives(box)[0];
    const inset = housing.strokeWidth / 2 + .5;
    assert.ok(housing.x - box.x >= inset && housing.y - box.y >= inset);
    assert.ok(box.x + width - housing.x - housing.width >= inset && box.y + height - housing.y - housing.height >= inset);
  }
});

test("square status lenses retain their specified color and inactive state without circular artwork", () => {
  const box = { kind: "led", variant: "square", color: "#7c73cf", x: 10, y: 20, width: 5, height: 4 };
  const parts = hardwarePrimitives(box);
  assert.equal(parts.length, 2);
  assert.ok(parts.every((part) => part.kind === "rect" && part.rx === 0));
  assert.equal(parts[1].fill, box.color);
  assert.equal(hardwarePrimitives({ ...box, active: false })[1].fill, "#515e62");
  assert.equal(hardwarePrimitives({ ...box, variant: undefined })[0].kind, "circle");
});

test("Raritan DVI-D preserves its 24+1 digital sockets and two separate screw flanges", () => {
  const box = { kind: "dvi-d", x: 10, y: 20, width: 40, height: 11 };
  const parts = hardwarePrimitives(box);
  const sockets = parts.filter((part) => part.kind === "rect" && part.fill === "#07151a");
  assert.equal(sockets.length, 25);
  const blade = sockets.find((part) => part.width > part.height * 4);
  const contacts = sockets.filter((part) => part !== blade);
  assert.ok(blade && contacts.every((part) => part.x + part.width < blade.x));
  assert.equal(new Set(contacts.map((part) => part.y)).size, 3);
  assert.equal(new Set(contacts.map((part) => part.x)).size, 8);
  const screws = parts.filter((part) => part.kind === "polygon" && part.fill === "#708389");
  assert.equal(screws.length, 2);
  assert.ok(screws.every((part) => part.points.length === 6));
  assert.ok(Math.max(...screws[0].points.map(([x]) => x)) < contacts[0].x);
  assert.ok(Math.min(...screws[1].points.map(([x]) => x)) > blade.x + blade.width);
});

test("inverted and left-facing C14 variants rotate their bevels and blade groups together", () => {
  const box = { kind: "power", x: 0, y: 0, width: 34, height: 26 };
  const normal = hardwarePrimitives({ ...box, variant: "ac-c14" });
  const inverted = hardwarePrimitives({ ...box, variant: "ac-c14-inverted" });
  const sourceCavity = normal.find((part) => part.kind === "polygon");
  const cavity = inverted.find((part) => part.kind === "polygon");
  assert.ok(cavity);
  for (let index = 0; index < cavity.points.length; index++) {
    assert.ok(Math.abs(cavity.points[index][0] - (box.width - sourceCavity.points[index][0])) < 1e-8);
    assert.ok(Math.abs(cavity.points[index][1] - (box.height - sourceCavity.points[index][1])) < 1e-8);
  }
  const blades = inverted.filter((part) => part.fill === "#b9c3c4");
  assert.equal(blades.length, 3);
  assert.ok(blades[0].y > blades[1].y && blades[1].y === blades[2].y);
  const left = hardwarePrimitives({ ...box, variant: "ac-sideways-left", width: 36, height: 49 });
  const leftBlades = left.filter((part) => part.fill === "#b9c3c4");
  assert.equal(leftBlades.length, 3);
  assert.ok(leftBlades.every((part) => part.width > part.height));
  assert.ok(leftBlades[0].x < leftBlades[1].x && leftBlades[1].x === leftBlades[2].x);
  assert.ok(leftBlades[1].y > leftBlades[0].y && leftBlades[0].y > leftBlades[2].y);
});

test("Raritan horizontal rocker keeps I at left and O at right without changing the vertical rocker", () => {
  const parts = hardwarePrimitives({ kind: "button", variant: "rocker-horizontal", x: 10, y: 20, width: 29, height: 10 });
  const off = parts.find((part) => part.kind === "circle");
  const on = parts.find((part) => part.kind === "line");
  assert.ok(off && on);
  assert.equal(on.y1, on.y2);
  assert.ok(Math.max(on.x1, on.x2) < off.cx - off.r);
  assert.equal(on.y1, off.cy);
  const ordinary = hardwarePrimitives({ kind: "button", variant: "rocker", x: 10, y: 20, width: 10, height: 29 });
  assert.equal(ordinary.find((part) => part.kind === "line").x1, ordinary.find((part) => part.kind === "line").x2);
});

test("Raritan service connectors and directional power hardware share bounded Canvas/SVG coordinates", () => {
  for (const configuration of [
    { kind: "rj11", width: 18, height: 18 }, { kind: "dvi-d", width: 40, height: 11 },
    { kind: "power", variant: "ac-c14-inverted", width: 34, height: 26 },
    { kind: "power", variant: "ac-sideways-left", width: 36, height: 49 },
    { kind: "button", variant: "rocker-horizontal", width: 29, height: 10 },
    { kind: "panel-accent", variant: "trapezoid", color: "#cf1739", taper: .08, width: 120, height: 3 },
    { kind: "led", variant: "square", color: "#7c73cf", width: 5, height: 4 },
  ]) for (const scale of [1, 2]) {
    const box = { ...configuration, x: 10, y: 20, width: configuration.width * scale, height: configuration.height * scale };
    const parts = hardwarePrimitives(box);
    for (const part of parts) {
      const bounds = primitiveBounds(part);
      assert.ok([bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite));
      assert.ok(bounds.x >= box.x && bounds.y >= box.y && bounds.x + bounds.width <= box.x + box.width && bounds.y + bounds.height <= box.y + box.height);
    }
    const canvas = recordingContext(); drawHardwareComponent(canvas, box);
    assert.deepEqual(canvas.shapes.map((part) => part.kind), parts.map((part) => part.kind));
    for (const [index, part] of canvas.shapes.entries()) for (const key of Object.keys(part)) assert.deepEqual(part[key], parts[index][key]);
    const vertices = [...hardwareComponentSVG(box).matchAll(/<polygon[^>]*points="([^"]+)"/g)].map((match) => match[1].split(" ").map((point) => point.split(",").map(Number)));
    assert.deepEqual(vertices, parts.filter((part) => part.kind === "polygon").map((part) => part.points));
  }
});

test("HPE SmartCarrier retains tapered vents, central activity ring and right release in both orientations", () => {
  const box = { kind: "drive-carrier", variant: "hpe-smart", x: 0, y: 0, width: 109, height: 21, active: false };
  const parts = hardwarePrimitives(box);
  const vents = parts.filter((part) => part.kind === "polygon" && part.fill === "#07151a");
  assert.equal(vents.length, 14);
  assert.ok(vents.every((part) => Math.max(...part.points.map(([x]) => x)) < box.width * .60));
  const activity = parts.find((part) => part.kind === "circle" && part.r > box.height * .2);
  const release = parts.find((part) => part.kind === "rect" && part.fill === "#78868b");
  assert.ok(activity && release && activity.cx + activity.r < release.x);
  assert.ok(release.x > box.width * .78);
  assert.ok(!parts.some((part) => part.fill === "#42d98b"));
  const vertical = hardwarePrimitives({ ...box, orientation: "vertical", width: box.height, height: box.width });
  const rotatedVents = vertical.filter((part) => part.kind === "polygon" && part.fill === "#07151a");
  for (let index = 0; index < vents.length; index++) for (let point = 0; point < vents[index].points.length; point++) {
    const [x, y] = vents[index].points[point]; const [actualX, actualY] = rotatedVents[index].points[point];
    assert.ok(Math.abs(actualX - (box.height - y)) < 1e-8 && Math.abs(actualY - x) < 1e-8);
  }
  const lowerRelease = vertical.find((part) => part.kind === "rect" && part.fill === "#78868b");
  assert.ok(lowerRelease.y > box.width * .78);
});

test("DisplayPort retains its single lower-left chamfer and inset tongue without RJ45 contacts", () => {
  const box = { kind: "displayport", x: 10, y: 20, width: 24, height: 10 };
  const parts = hardwarePrimitives(box);
  const shell = parts.find((part) => part.kind === "polygon");
  const cavity = parts.find((part) => part.kind === "polygon" && part.fill === "#07151a");
  assert.ok(shell && cavity && shell.points.length === 5 && cavity.points.length === 5);
  assert.equal(shell.points[0][1], shell.points[1][1]);
  assert.ok(shell.points[3][0] > shell.points[4][0] && shell.points[3][1] > shell.points[4][1]);
  assert.equal(parts.filter((part) => part.kind === "rect").length, 1);
  assert.ok(!parts.some((part) => part.fill === "#d7b76c" || part.kind === "circle"));
});

test("865438 Titanium supplies retain the folded black grip and occluded inlet with pink release", () => {
  const box = { kind: "psu", variant: "hpe-flexslot-800-titanium", x: 10, y: 20, width: 100, height: 51, active: false };
  const parts = hardwarePrimitives(box);
  const rotor = parts.find((part) => part.kind === "circle" && part.fill === "#122327");
  const inlet = parts.find((part) => part.kind === "polygon" && part.fill === "#07151a");
  const latch = parts.find((part) => part.kind === "rect" && part.fill === "#c16b86");
  const handle = parts.find((part) => part.kind === "polygon" && part.fill === "#26343a");
  assert.ok(rotor && inlet && latch && handle);
  const bounds = primitiveBounds(inlet);
  assert.ok(rotor.cx + rotor.r < bounds.x);
  assert.ok(latch.x < bounds.x + bounds.width && latch.x + latch.width > bounds.x);
  assert.ok(parts.indexOf(latch) > parts.indexOf(inlet), "the source latch visibly occludes the inlet");
  assert.ok(!parts.some((part) => part.fill === "#d0d6d8" || part.fill === "#42d98b"), "no invented visible blades or lit lamp");
  assert.ok(!hardwarePrimitives({ ...box, variant: "hpe-flexslot-800" }).some((part) => part.fill === "#c16b86"));
});

test("HPE Gen10 carrier, DisplayPort and Titanium supply use bounded identical Canvas/SVG geometry", () => {
  for (const configuration of [
    { kind: "drive-carrier", variant: "hpe-smart", width: 109, height: 21 },
    { kind: "drive-carrier", variant: "hpe-smart", orientation: "vertical", width: 21, height: 99 },
    { kind: "displayport", width: 24, height: 10 },
    { kind: "psu", variant: "hpe-flexslot-800-titanium", width: 100, height: 51 },
  ]) for (const scale of [1, 2]) {
    const box = { ...configuration, x: 10, y: 20, width: configuration.width * scale, height: configuration.height * scale };
    const parts = hardwarePrimitives(box);
    for (const part of parts) {
      const bounds = primitiveBounds(part);
      assert.ok([bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite));
      assert.ok(bounds.x >= box.x && bounds.y >= box.y && bounds.x + bounds.width <= box.x + box.width && bounds.y + bounds.height <= box.y + box.height);
    }
    const canvas = recordingContext(); drawHardwareComponent(canvas, box);
    assert.deepEqual(canvas.shapes.map((part) => part.kind), parts.map((part) => part.kind));
    for (const [index, part] of canvas.shapes.entries()) for (const key of Object.keys(part)) assert.deepEqual(part[key], parts[index][key]);
    const vertices = [...hardwareComponentSVG(box).matchAll(/<polygon[^>]*points="([^"]+)"/g)].map((match) => match[1].split(" ").map((point) => point.split(",").map(Number)));
    assert.deepEqual(vertices, parts.filter((part) => part.kind === "polygon").map((part) => part.points));
  }
});

test("Aruba fixed fan grilles contain twelve radial apertures without a tray, rotor or hub", () => {
  const box = { kind: "fan", variant: "aruba-fixed-radial", x: 10, y: 20, width: 58.995, height: 60.8 };
  const parts = hardwarePrimitives(box);
  assert.equal(parts.length, 12);
  assert.ok(parts.every((part) => part.kind === "polygon" && part.points.length === 8));
  const center = [box.x + box.width / 2, box.y + box.height / 2];
  const radialLimits = parts.map((part) => part.points.map(([x, y]) => Math.hypot(x - center[0], y - center[1])));
  for (const radii of radialLimits) {
    assert.ok(Math.min(...radii) > Math.min(box.width, box.height) * .27);
    assert.ok(Math.max(...radii) < Math.min(box.width, box.height) * .48);
  }
  assert.ok(Math.max(...radialLimits.flat()) - Math.min(...radialLimits.map((radii) => Math.max(...radii))) < 1e-8);
});

test("explicit C14 sockets rotate both keyed cavity and blades while preserving existing power artwork", () => {
  for (const variant of ["ac-c14", "ac-sideways"]) {
    const box = { kind: "power", variant, x: 10, y: 20, width: variant === "ac-c14" ? 39.33 : 36.0525, height: variant === "ac-c14" ? 34.96 : 48.64 };
    const parts = hardwarePrimitives(box);
    const cavity = parts.find((part) => part.kind === "polygon");
    const blades = parts.filter((part) => part.fill === "#b9c3c4");
    assert.ok(cavity && cavity.points.length === 6);
    assert.equal(blades.length, 3);
    if (variant === "ac-sideways") {
      assert.ok(blades.every((part) => part.width > part.height));
      assert.ok(blades[0].x > blades[1].x && blades[1].x === blades[2].x);
      assert.ok(blades[1].y < blades[0].y && blades[0].y < blades[2].y);
      assert.ok(cavity.points[0][0] > cavity.points[2][0], "the bevel rotates to the right side");
    } else {
      assert.ok(blades.every((part) => part.height > part.width));
      assert.ok(blades[0].y < blades[1].y && blades[1].y === blades[2].y);
      assert.ok(cavity.points[0][1] < cavity.points[2][1], "the bevel remains at the top");
    }
    assert.ok(!hardwarePrimitives({ ...box, variant: "ac" }).some((part) => part.kind === "polygon"));
  }
});

test("Aruba fixed grilles and keyed AC sockets keep identical bounded Canvas/SVG coordinates", () => {
  for (const configuration of [
    { kind: "fan", variant: "aruba-fixed-radial", width: 58.995, height: 60.8 },
    { kind: "power", variant: "ac-c14", width: 39.33, height: 34.96 },
    { kind: "power", variant: "ac-sideways", width: 36.0525, height: 48.64 },
  ]) for (const scale of [1, 2]) {
    const box = { ...configuration, x: 10, y: 20, width: configuration.width * scale, height: configuration.height * scale };
    const parts = hardwarePrimitives(box);
    for (const part of parts) {
      const bounds = primitiveBounds(part);
      assert.ok([bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite));
      assert.ok(bounds.x >= box.x && bounds.y >= box.y && bounds.x + bounds.width <= box.x + box.width && bounds.y + bounds.height <= box.y + box.height);
    }
    const canvas = recordingContext(); drawHardwareComponent(canvas, box);
    assert.deepEqual(canvas.shapes.map((part) => part.kind), parts.map((part) => part.kind));
    for (const [index, part] of canvas.shapes.entries()) for (const key of Object.keys(part)) assert.deepEqual(part[key], parts[index][key]);
    const vertices = [...hardwareComponentSVG(box).matchAll(/<polygon[^>]*points="([^"]+)"/g)].map((match) => match[1].split(" ").map((point) => point.split(",").map(Number)));
    assert.deepEqual(vertices, parts.filter((part) => part.kind === "polygon").map((part) => part.points));
  }
});

test("Lantronix SD, modem blank and fuse carrier render source-sized dark parts without invented fasteners", () => {
  for (const configuration of [
    { kind: "card-slot", variant: "plain", width: 40.71, height: 3.64 },
    { kind: "module-bay", variant: "plain", width: 17.94, height: 19.6 },
    { kind: "module-bay", variant: "fuse-carrier", width: 9.66, height: 21.7 },
  ]) {
    const box = { ...configuration, x: 10, y: 20 };
    const parts = hardwarePrimitives(box);
    assert.equal(parts.length, 1, `${configuration.variant} must be visible without extra screws or contacts`);
    assert.equal(parts[0].kind, "rect"); assert.equal(parts[0].fill, "#07151a");
    assert.equal(Boolean(parts[0].stroke), configuration.variant === "fuse-carrier");
    const bounds = primitiveBounds(parts[0]);
    assert.ok(bounds.x >= box.x && bounds.y >= box.y && bounds.x + bounds.width <= box.x + box.width && bounds.y + bounds.height <= box.y + box.height);
    if (parts[0].stroke) assert.ok(bounds.x - box.x >= parts[0].strokeWidth / 2 + .5, "the narrow outline reserves its antialiasing fringe");
    const canvas = recordingContext(); drawHardwareComponent(canvas, box);
    assert.equal(canvas.shapes.length, 1);
    for (const key of Object.keys(canvas.shapes[0])) assert.deepEqual(canvas.shapes[0][key], parts[0][key]);
    assert.equal((hardwareComponentSVG(box).match(/<rect\b/g) || []).length, 1);
  }
  const ordinary = hardwarePrimitives({ kind: "module-bay", x: 0, y: 0, width: 60, height: 40 });
  assert.equal(ordinary.filter((part) => part.kind === "circle").length, 2, "existing generic module hardware is unchanged");
});

test("Aruba dual trays retain two guarded fans, a shared central grip and diagonal end retainers", () => {
  const box = { kind: "fan", variant: "aruba-dual-hex", x: 10, y: 20, width: 190.095, height: 66.976 };
  const parts = hardwarePrimitives(box);
  const fans = parts.filter((part) => part.kind === "circle" && part.fill === "#122327");
  const mesh = parts.filter((part) => part.kind === "polygon");
  assert.equal(fans.length, 2);
  assert.equal(fans[0].cy, fans[1].cy);
  assert.ok(fans[0].cx + fans[0].r < fans[1].cx - fans[1].r);
  assert.ok(mesh.length >= 40 && mesh.every((part) => part.points.length === 6));
  const grip = parts.find((part) => part.kind === "rect" && part.fill === "#c7cfd3");
  assert.ok(grip && grip.height > grip.width * 4);
  assert.ok(grip.x > fans[0].cx + fans[0].r && grip.x + grip.width < fans[1].cx - fans[1].r);
  const retainers = parts.filter((part) => part.kind === "circle" && part.fill === "#65767d");
  assert.equal(retainers.length, 2);
  assert.ok(retainers[0].cx < fans[0].cx - fans[0].r && retainers[1].cx > fans[1].cx + fans[1].r);
  assert.ok(retainers[0].cy < retainers[1].cy);
  for (const cell of mesh) {
    const lengths = cell.points.map((point, index) => Math.hypot(point[0] - cell.points[(index + 1) % 6][0], point[1] - cell.points[(index + 1) % 6][1]));
    assert.ok(Math.max(...lengths) - Math.min(...lengths) < 1e-8, "honeycomb cells retain their physical hexagon aspect");
  }
  assert.ok(!parts.some((part) => part.fill === "#42d98b" || part.fill === "#d68c40"), "no unsourced live indicator or orange release latch");
});

test("Aruba dual-hex trays stay bounded with exact Canvas/SVG geometry at rack and compact widths", () => {
  for (const [width, height] of [[190.095, 66.976], [126.73, 66.976], [380.19, 133.952]]) {
    const box = { kind: "fan", variant: "aruba-dual-hex", x: 10, y: 20, width, height };
    const parts = hardwarePrimitives(box);
    for (const part of parts) {
      const bounds = primitiveBounds(part);
      assert.ok([bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite));
      assert.ok(bounds.x >= box.x && bounds.y >= box.y && bounds.x + bounds.width <= box.x + width && bounds.y + bounds.height <= box.y + height);
    }
    const canvas = recordingContext(); drawHardwareComponent(canvas, box);
    assert.deepEqual(canvas.shapes.map((part) => part.kind), parts.map((part) => part.kind));
    for (const [index, part] of canvas.shapes.entries()) for (const key of Object.keys(part)) assert.deepEqual(part[key], parts[index][key]);
    const svg = hardwareComponentSVG(box);
    const vertices = [...svg.matchAll(/<polygon[^>]*points="([^"]+)"/g)].map((match) => match[1].split(" ").map((point) => point.split(",").map(Number)));
    assert.deepEqual(vertices, parts.filter((part) => part.kind === "polygon").map((part) => part.points));
  }
});

test("blank LCD glass has no invented display text or illuminated telemetry", () => {
  const box = { kind: "lcd", variant: "blank", x: 10, y: 20, width: 120, height: 28 };
  const parts = hardwarePrimitives(box);
  assert.equal(parts.length, 2);
  assert.ok(parts.every((part) => part.kind === "rect"));
  assert.equal(parts[1].fill, "#07151a");
  assert.ok(!hardwareComponentSVG(box).includes("<text"));
  assert.equal(hardwarePrimitives({ ...box, variant: undefined }).filter((part) => part.kind === "line").length, 3);
});

test("Lantronix five-way control retains four separate direction triangles and one center confirm button", () => {
  const box = { kind: "button", variant: "five-way", x: 10, y: 20, width: 38, height: 40 };
  const parts = hardwarePrimitives(box);
  const triangles = parts.filter((part) => part.kind === "polygon");
  const center = parts.filter((part) => part.kind === "circle");
  assert.equal(triangles.length, 4);
  assert.ok(triangles.every((part) => part.points.length === 3));
  assert.equal(center.length, 1);
  assert.equal(center[0].cx, box.x + box.width / 2);
  assert.equal(center[0].cy, box.y + box.height / 2);
  assert.ok(parts.every((part) => part.fill === "#f56b4f"));
  for (const triangle of triangles) {
    const bounds = primitiveBounds(triangle);
    assert.ok(bounds.x + bounds.width < center[0].cx - center[0].r || bounds.x > center[0].cx + center[0].r ||
      bounds.y + bounds.height < center[0].cy - center[0].r || bounds.y > center[0].cy + center[0].r);
  }
  assert.ok(!hardwarePrimitives({ ...box, variant: undefined }).some((part) => part.kind === "polygon"));
});

test("single-AC rocker keeps the photographed O above I inside its vertical black housing", () => {
  const box = { kind: "button", variant: "rocker", x: 10, y: 20, width: 14, height: 25 };
  const parts = hardwarePrimitives(box);
  const off = parts.find((part) => part.kind === "circle");
  const on = parts.find((part) => part.kind === "line" && part.x1 === part.x2);
  assert.ok(off && on && off.cy + off.r < on.y1);
  assert.equal(off.cx, on.x1);
  assert.ok(parts.filter((part) => part.kind === "rect").every((part) => part.height > part.width));
  assert.ok(!parts.some((part) => part.kind === "text" || part.fill === "#22a0ab"));
});

test("Lantronix controls retain bounded source-size geometry and identical Canvas/SVG shape coordinates", () => {
  for (const configuration of [
    { kind: "lcd", variant: "blank", width: 120, height: 28 },
    { kind: "button", variant: "five-way", width: 38, height: 40 },
    { kind: "button", variant: "rocker", width: 14, height: 25 },
  ]) for (const scale of [1, 2]) {
    const box = { ...configuration, x: 10, y: 20, width: configuration.width * scale, height: configuration.height * scale };
    const parts = hardwarePrimitives(box);
    for (const part of parts) {
      const bounds = primitiveBounds(part);
      assert.ok([bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite));
      assert.ok(bounds.x >= box.x && bounds.y >= box.y);
      assert.ok(bounds.x + bounds.width <= box.x + box.width && bounds.y + bounds.height <= box.y + box.height);
    }
    const canvas = recordingContext();
    drawHardwareComponent(canvas, box);
    assert.deepEqual(canvas.shapes.map((part) => part.kind), parts.map((part) => part.kind));
    for (const [index, part] of canvas.shapes.entries()) for (const key of Object.keys(part)) assert.deepEqual(part[key], parts[index][key]);
    const svg = hardwareComponentSVG(box);
    assert.equal((svg.match(/<(?:rect|circle|line|text|polygon)\b/g) || []).length, parts.length);
    const vertices = [...svg.matchAll(/<polygon[^>]*points="([^"]+)"/g)].map((match) => match[1].split(" ").map((point) => point.split(",").map(Number)));
    assert.deepEqual(vertices, parts.filter((part) => part.kind === "polygon").map((part) => part.points));
  }
});

test("Z9332 fan covers retain two chamfered apertures and a horizontal pull grip without exposed rotors", () => {
  const box = { kind: "fan", variant: "dell-z9332-covered", x: 0, y: 0, width: 73, height: 70 };
  const parts = hardwarePrimitives(box);
  const openings = parts.filter((part) => part.kind === "polygon" && part.fill === "#172125");
  assert.equal(openings.length, 2);
  assert.ok(openings.every((part) => part.points.length === 6));
  const grip = parts.find((part) => part.kind === "rect" && part.fill === "#708389");
  assert.ok(grip.width > grip.height * 4);
  assert.ok(Math.max(...openings[0].points.map((point) => point[1])) <= grip.y);
  assert.ok(Math.min(...openings[1].points.map((point) => point[1])) >= grip.y + grip.height);
  assert.ok(!parts.some((part) => part.kind === "circle" || part.fill === "#122327"));
});

test("Dell radial trays expose circular rotors with a source-selected center grip and left release latch", () => {
  const box = { kind: "fan", variant: "dell-radial-handle", x: 0, y: 0, width: 72, height: 74 };
  const parts = hardwarePrimitives(box);
  const rotor = parts.find((part) => part.kind === "circle" && part.fill === "#122327");
  const grip = parts.find((part) => part.fill === "#bb2634");
  const latch = parts.find((part) => part.fill === "#d68c40");
  assert.ok(rotor && grip && latch);
  assert.equal(grip.x + grip.width / 2, rotor.cx);
  assert.ok(latch.x + latch.width < rotor.cx - rotor.r);
  assert.equal(parts.filter((part) => part.kind === "line" && part.stroke === "#708389").length, 8);
  assert.ok(!parts.some((part) => part.kind === "rect" && part.fill === "#a7b2b5" && part.width < 2));
  const neutral = hardwarePrimitives({ ...box, gripColor: "#9daeb8" });
  assert.deepEqual(neutral.map((part) => part.fill === "#9daeb8" ? { ...part, fill: "#bb2634" } : part), parts);
});

test("Dell sideways AC variants preserve three horizontal contacts and their distinct grille or rotor sides", () => {
  for (const variant of ["ac-fan-right-sideways", "dell-z9332-ac"]) {
    const box = { kind: "psu", variant, x: 0, y: 0, width: variant === "dell-z9332-ac" ? 96 : 145, height: 70 };
    const parts = hardwarePrimitives(box);
    const blades = parts.filter((part) => part.fill === "#d0d6d8");
    assert.equal(blades.length, 3);
    assert.ok(blades.every((part) => part.kind === "rect" && part.width > part.height));
    assert.equal(blades[0].x, blades[1].x);
    assert.ok(blades[0].y < blades[2].y && blades[2].y < blades[1].y && blades[2].x > blades[0].x);
    const inlet = parts.find((part) => part.kind === "polygon" && part.fill === "#07151a");
    assert.ok(inlet && inlet.points.length === 6);
    const handle = parts.find((part) => part.fill === "#bb2634");
    const rotor = parts.find((part) => part.kind === "circle" && part.fill === "#122327");
    const bounds = primitiveBounds(inlet);
    if (variant === "dell-z9332-ac") {
      assert.ok(handle.x + handle.width < bounds.x);
      assert.ok(!rotor);
      assert.ok(parts.filter((part) => part.fill === "#172125").length >= 20);
    } else {
      assert.ok(bounds.x + bounds.width < handle.x && handle.x + handle.width < rotor.cx - rotor.r);
    }
  }
});

test("new Dell variants preserve bounded source-sized geometry and exact Canvas/SVG polygon vertices", () => {
  for (const component of [
    { kind: "fan", variant: "dell-z9332-covered", width: 67.62, height: 69.75 },
    { kind: "fan", variant: "dell-radial-handle", width: 67.62, height: 69.75 },
    { kind: "fan", variant: "dell-radial-handle", gripColor: "#9daeb8", width: 131.1, height: 129.72 },
    { kind: "fan", variant: "dell-radial-handle", gripColor: "#9daeb8", width: 131.1, height: 59.22 },
    { kind: "psu", variant: "dell-z9332-ac", width: 97.98, height: 71.25 },
    { kind: "psu", variant: "ac-fan-right-sideways", width: 136.62, height: 69.75 },
    { kind: "psu", variant: "ac-fan-right-sideways", width: 135.24, height: 64.17 },
    { kind: "psu", variant: "ac-fan-right-sideways", width: 135.24, height: 29.295 },
  ]) for (const scale of [1, 2]) {
    const box = { ...component, x: 10, y: 20, width: component.width * scale, height: component.height * scale };
    const parts = hardwarePrimitives(box);
    for (const part of parts) {
      const bounds = primitiveBounds(part);
      assert.ok([bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite));
      assert.ok(bounds.x >= box.x && bounds.y >= box.y);
      assert.ok(bounds.x + bounds.width <= box.x + box.width + 1e-8);
      assert.ok(bounds.y + bounds.height <= box.y + box.height + 1e-8);
    }
    const canvas = recordingContext();
    drawHardwareComponent(canvas, box);
    assert.deepEqual(canvas.shapes.map((part) => part.kind), parts.map((part) => part.kind));
    for (const [index, part] of canvas.shapes.entries()) for (const key of Object.keys(part)) {
      assert.deepEqual(part[key], parts[index][key]);
    }
    const svg = hardwareComponentSVG(box);
    assert.equal((svg.match(/<(?:rect|circle|line|text|polygon)\b/g) || []).length, parts.length);
    const vertices = [...svg.matchAll(/<polygon[^>]*points="([^"]+)"/g)].map((match) => match[1].split(" ").map((point) => point.split(",").map(Number)));
    assert.deepEqual(vertices, parts.filter((part) => part.kind === "polygon").map((part) => part.points));
  }
});

test("GE104 C14 inlet rotates its flange, cavity and three blades together without stretching rectangular consumers", () => {
  for (const [width, height] of [[52.992, 52.992], [35.328, 52.992], [106, 106]]) {
    const box = { kind: "power", variant: "c14-diagonal", x: 10, y: 20, width, height };
    const parts = hardwarePrimitives(box);
    const polygons = parts.filter((part) => part.kind === "polygon");
    assert.equal(polygons.length, 5, "flange, keyed cavity and three distinct blades");
    assert.equal(polygons.filter((part) => part.fill === "#b9c3c4").length, 3);
    const screws = parts.filter((part) => part.kind === "circle" && part.fill === "#a7b2b5");
    assert.equal(screws.length, 2);
    assert.ok(screws[0].cx < screws[1].cx && screws[0].cy > screws[1].cy);
    assert.ok(Math.abs((screws[1].cx - screws[0].cx) + (screws[1].cy - screws[0].cy)) < 1e-8);
    for (const part of parts) {
      const bounds = primitiveBounds(part);
      assert.ok([bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite));
      assert.ok(bounds.x >= box.x && bounds.y >= box.y);
      assert.ok(bounds.x + bounds.width <= box.x + width && bounds.y + bounds.height <= box.y + height);
      if (part.kind === "polygon") assert.ok(part.points.flat().every(Number.isFinite));
    }
    const canvas = recordingContext();
    drawHardwareComponent(canvas, box);
    assert.deepEqual(canvas.shapes.map((part) => part.kind), parts.map((part) => part.kind));
    for (const [index, part] of canvas.shapes.entries()) for (const key of Object.keys(part)) {
      assert.deepEqual(part[key], parts[index][key]);
    }
    const svg = hardwareComponentSVG(box);
    const vertices = [...svg.matchAll(/<polygon[^>]*points="([^"]+)"/g)].map((match) => match[1].split(" ").map((point) => point.split(",").map(Number)));
    assert.deepEqual(vertices, polygons.map((part) => part.points));
    const escaped = hardwareComponentSVG(box, { ink: 'red" onload="bad()' });
    assert.ok(escaped.includes("&quot;") && !escaped.includes('stroke="red" onload='));
  }
});

test("S5048 fan trays retain one square-guarded rotor, center red grip and left orange release latch", () => {
  const component = { kind: "fan", variant: "dell-single-handle", x: 0, y: 0, width: 60.72, height: 69.75 };
  const parts = hardwarePrimitives(component);
  const rotors = parts.filter((part) => part.kind === "circle" && part.fill === "#122327");
  assert.equal(rotors.length, 1);
  const rotor = rotors[0];
  const grip = parts.find((part) => part.fill === "#bb2634");
  const handle = parts.find((part) => part.fill === "#e0e5e6");
  const latch = parts.find((part) => part.fill === "#d68c40");
  assert.ok(handle.height > handle.width * 5 && handle.y < rotor.cy && handle.y + handle.height > rotor.cy);
  assert.equal(handle.x + handle.width / 2, rotor.cx);
  assert.equal(grip.x + grip.width / 2, rotor.cx);
  assert.ok(grip.y < rotor.cy && grip.y + grip.height > rotor.cy);
  assert.ok(latch.x + latch.width < rotor.cx - rotor.r);
  const guards = parts.filter((part) => part.kind === "rect" && part.fill === "#a7b2b5");
  assert.equal(guards.length, 16);
  const vertical = guards.filter((part) => part.height > part.width);
  const horizontal = guards.filter((part) => part.width > part.height);
  assert.ok(Math.abs((vertical[1].x - vertical[0].x) - (horizontal[1].y - horizontal[0].y)) < 1e-8);
  assert.ok(!hardwarePrimitives({ ...component, variant: undefined }).some((part) => part.fill === "#bb2634"));
});

test("round status lenses accept an explicit color while retaining their default and inactive artwork", () => {
  const component = { kind: "led", x: 0, y: 0, width: 8, height: 8 };
  const defaults = hardwarePrimitives(component);
  const colored = hardwarePrimitives({ ...component, color: "#123456" });
  assert.equal(colored[1].fill, "#123456");
  assert.deepEqual(colored.map((part, index) => index === 1 ? { ...part, fill: defaults[index].fill } : part), defaults);
  assert.deepEqual(hardwarePrimitives({ ...component, color: undefined }), defaults);
  assert.deepEqual(hardwarePrimitives({ ...component, active: false, color: "#123456" }), hardwarePrimitives({ ...component, active: false }));
});

test("PA-1400 supplies retain the broad left C14 inlet, right handle and two separate status lenses", () => {
  const component = { kind: "psu", variant: "pa-1400-ac", x: 0, y: 0, width: 89, height: 66 };
  const parts = hardwarePrimitives(component);
  const inlet = parts.find((part) => part.kind === "rect" && part.fill === "#07151a");
  const handle = parts.find((part) => part.kind === "rect" && part.fill === "#a7b2b5");
  const contacts = parts.filter((part) => part.kind === "rect" && part.fill === "#d0d6d8");
  const lamps = parts.filter((part) => part.fill === "#42d98b");
  assert.equal(contacts.length, 3);
  assert.ok(contacts.every((part) => part.height > part.width));
  assert.ok(contacts[0].y < contacts[1].y && contacts[1].y === contacts[2].y);
  assert.ok(inlet.width > inlet.height && handle.x > inlet.x + inlet.width && handle.height > handle.width * 5);
  assert.equal(lamps.length, 2);
  assert.equal(lamps[0].cx, lamps[1].cx);
  assert.ok(lamps[0].cx > handle.x + handle.width && lamps[0].cy < lamps[1].cy);
  assert.ok(!parts.some((part) => part.fill === "#122327"), "the manufacturer rear drawing exposes grille rather than a PSU fan disk");
  assert.ok(!hardwarePrimitives({ ...component, active: false }).some((part) => part.fill === "#42d98b"));
});

test("Dell dual fan trays keep two horizontal rotors, a diagonal pull bar and right release hardware", () => {
  const component = { kind: "fan", variant: "dell-dual-horizontal", x: 0, y: 0, width: 123.51, height: 69.75 };
  const parts = hardwarePrimitives(component);
  const rotors = parts.filter((part) => part.kind === "circle" && part.fill === "#122327");
  assert.equal(rotors.length, 2);
  assert.equal(rotors[0].cy, rotors[1].cy);
  assert.ok(rotors[0].cx + rotors[0].r < rotors[1].cx - rotors[1].r);
  const grip = parts.filter((part) => part.kind === "line" && part.stroke === "#b9c3c4");
  assert.ok(grip.length >= 2 && grip.every((part) => part.x2 > part.x1 && part.y2 < part.y1));
  const latch = parts.find((part) => part.fill === "#d68c40");
  const lamp = parts.find((part) => part.fill === "#42d98b");
  assert.ok(latch.x > rotors[1].cx + rotors[1].r);
  assert.ok(lamp.cx > rotors[1].cx + rotors[1].r && lamp.cy < latch.y);
  assert.ok(!hardwarePrimitives({ ...component, active: false }).some((part) => part.fill === "#42d98b"));
  assert.ok(!hardwarePrimitives({ ...component, variant: undefined }).some((part) => part.fill === "#d68c40"));
});

test("stack displays distinguish one or two unlit seven-segment digits without inventing a live stack ID", () => {
  const component = { kind: "lcd", variant: "seven-segment", x: 0, y: 0, width: 26.22, height: 21 };
  for (const digits of [1, 2]) {
    const parts = hardwarePrimitives({ ...component, digits });
    const segments = parts.filter((part) => part.fill === "#708389");
    assert.equal(segments.length, digits * 7);
    assert.equal(segments.filter((part) => part.width > part.height).length, digits * 3);
    assert.equal(segments.filter((part) => part.height > part.width).length, digits * 4);
    assert.ok(parts.every((part) => part.kind === "rect"));
    assert.ok(!parts.some((part) => part.fill === "#22a0ab"));
  }
  for (const digits of [undefined, 0, 3, NaN, "2"]) {
    assert.equal(hardwarePrimitives({ ...component, digits }).filter((part) => part.fill === "#708389").length, 7);
  }
});

test("Dell fan and display adapters retain finite bounded geometry at source consumer sizes", () => {
  for (const component of [
    { kind: "fan", variant: "dell-dual-horizontal", width: 123.51, height: 69.75 },
    { kind: "lcd", variant: "seven-segment", digits: 2, width: 26.22, height: 21 },
    { kind: "lcd", variant: "seven-segment", digits: 1, width: 12.42, height: 22.5 },
    { kind: "psu", variant: "pa-1400-ac", width: 89, height: 66 },
    { kind: "fan", variant: "dell-single-handle", width: 60.72, height: 69.75 },
  ]) for (const scale of [1, 2]) {
    const box = { ...component, x: 10, y: 20, width: component.width * scale, height: component.height * scale };
    const parts = hardwarePrimitives(box);
    for (const part of parts) {
      assert.ok(Object.values(part).filter((value) => typeof value === "number").every(Number.isFinite));
      const bounds = primitiveBounds(part);
      assert.ok(bounds.x >= box.x && bounds.y >= box.y);
      assert.ok(bounds.x + bounds.width <= box.x + box.width + 1e-8);
      assert.ok(bounds.y + bounds.height <= box.y + box.height + 1e-8);
    }
    assert.equal((hardwareComponentSVG(box).match(/<(?:rect|circle|line|text)\b/g) || []).length, parts.length);
    const canvas = recordingContext();
    drawHardwareComponent(canvas, box);
    assert.deepEqual(canvas.shapes.map((part) => part.kind), parts.map((part) => part.kind));
    for (const [index, part] of canvas.shapes.entries()) {
      for (const key of Object.keys(part).filter((key) => key !== "kind")) assert.equal(part[key], parts[index][key] ?? 0);
    }
  }
});

test("oval push controls retain a horizontal rounded aperture without round socket or indicator art", () => {
  const component = { kind: "button", variant: "oval", x: 5, y: 8, width: 34, height: 15 };
  const parts = hardwarePrimitives(component);
  assert.equal(parts.length, 2);
  assert.ok(parts.every((part) => part.kind === "rect" && part.width > part.height * 2 && part.rx > 3));
  assert.ok(parts[1].x > parts[0].x && parts[1].y > parts[0].y);
  assert.ok(parts[1].x + parts[1].width < parts[0].x + parts[0].width);
  assert.ok(!parts.some((part) => ["#42d98b", "#d7b76c", "#22a0ab"].includes(part.fill)));
  assert.ok(hardwarePrimitives({ ...component, variant: undefined }).every((part) => part.kind === "circle"));
});

test("HPE Basic carriers retain their hourglass openings and rotate the release and two lamps together", () => {
  const component = { kind: "drive-carrier", variant: "hpe-basic", x: 0, y: 0, width: 150, height: 30 };
  const parts = hardwarePrimitives(component);
  const release = parts.find((part) => part.kind === "rect" && part.fill === "#78868b");
  assert.ok(release && release.x > 110 && release.height > 15);
  const lamps = parts.filter((part) => part.kind === "rect" && part.stroke === "#a7b2b5" && part.width < 4);
  assert.equal(lamps.length, 2);
  assert.ok(lamps.every((part) => part.x > release.x + release.width));
  const slopes = parts.filter((part) => part.kind === "line" && part.x1 !== part.x2 && part.y1 !== part.y2);
  assert.equal(slopes.length, 4, "the two vent openings taper toward the middle handle");
  const rotated = hardwarePrimitives({ ...component, width: 30, height: 150, orientation: "vertical" });
  assert.equal(rotated.length, parts.length);
  for (let index = 0; index < parts.length; index++) {
    const original = primitiveBounds(parts[index]);
    const actual = primitiveBounds(rotated[index]);
    for (const [got, expected] of [[actual.x, 30 - original.y - original.height], [actual.y, original.x],
      [actual.width, original.height], [actual.height, original.width]]) assert.ok(Math.abs(got - expected) < 1e-8);
  }
  assert.ok(!hardwarePrimitives({ ...component, active: false }).some((part) => part.fill === "#42d98b"));
  assert.ok(!hardwarePrimitives({ ...component, variant: undefined }).some((part) => part.fill === "#78868b"));
});

test("HPE 800W FlexSlot supplies retain a fan-crossing horizontal handle and right-facing C14 contacts", () => {
  const component = { kind: "psu", variant: "hpe-flexslot-800", x: 0, y: 0, width: 100, height: 67 };
  const parts = hardwarePrimitives(component);
  const fan = parts.find((part) => part.kind === "circle" && part.fill === "#122327");
  const handle = parts.find((part) => part.kind === "rect" && part.fill === "#a7b2b5");
  const inlet = parts.find((part) => part.kind === "rect" && part.fill === "#07151a");
  assert.ok(fan && handle && inlet);
  assert.ok(handle.width > handle.height * 5 && handle.x < fan.cx && handle.x + handle.width > fan.cx);
  assert.ok(handle.y < fan.cy && handle.y + handle.height > fan.cy);
  assert.ok(fan.cx + fan.r < inlet.x && handle.x + handle.width < inlet.x);
  const blades = parts.filter((part) => part.kind === "rect" && part.fill === "#d0d6d8");
  assert.equal(blades.length, 3);
  assert.ok(blades.every((part) => part.width > part.height));
  assert.equal(blades[0].x, blades[1].x);
  assert.ok(blades[2].x > blades[0].x && blades[0].y < blades[2].y && blades[2].y < blades[1].y);
  assert.ok(blades.every((part) => part.x > inlet.x && part.x + part.width < inlet.x + inlet.width));
  assert.ok(!hardwarePrimitives({ ...component, active: false }).some((part) => part.fill === "#42d98b"));
  for (const height of [54.4, 58.24, 67]) {
    const resized = hardwarePrimitives({ ...component, width: 98.7, height });
    const rotor = resized.find((part) => part.kind === "circle" && part.fill === "#122327");
    const spokes = resized.filter((part) => part.kind === "line" && part.stroke === "#708389" && part.x1 < 60 && part.x2 < 60);
    assert.equal(spokes.length, 8);
    for (const spoke of spokes) for (const [x, y] of [[spoke.x1, spoke.y1], [spoke.x2, spoke.y2]]) {
      assert.ok(Math.hypot(x - rotor.cx, y - rotor.cy) <= rotor.r, "fan spokes remain inside the circular grille at both server heights");
    }
  }
});

test("explicit HPE components stay finite and bounded in both deployed orientations", () => {
  for (const component of [
    { kind: "drive-carrier", variant: "hpe-basic", width: 150, height: 30 },
    { kind: "drive-carrier", variant: "hpe-basic", orientation: "vertical", width: 30, height: 150 },
    { kind: "psu", variant: "hpe-flexslot-800", width: 98.7, height: 67.3 },
  ]) {
    const box = { ...component, x: 10, y: 20 };
    const parts = hardwarePrimitives(box);
    for (const part of parts) {
      assert.ok(Object.values(part).filter((value) => typeof value === "number").every(Number.isFinite));
      const bounds = primitiveBounds(part);
      assert.ok(bounds.x >= box.x && bounds.y >= box.y);
      assert.ok(bounds.x + bounds.width <= box.x + box.width + 1e-8);
      assert.ok(bounds.y + bounds.height <= box.y + box.height + 1e-8);
    }
    assert.equal((hardwareComponentSVG(box).match(/<(?:rect|circle|line|text)\b/g) || []).length, parts.length);
    const canvas = recordingContext();
    drawHardwareComponent(canvas, box);
    assert.equal(canvas.saved, 1);
    assert.equal(canvas.restored, 1);
    assert.deepEqual(canvas.shapes.map((part) => part.kind), parts.map((part) => part.kind));
    for (const [index, part] of canvas.shapes.entries()) {
      for (const key of Object.keys(part).filter((key) => key !== "kind")) assert.equal(part[key], parts[index][key] ?? 0);
    }
  }
});

test("microSD service recesses show a thin card slot without invented fasteners or connector contacts", () => {
  const component = { kind: "card-slot", variant: "micro-sd-recess", x: 10, y: 20, width: 64, height: 52 };
  const parts = hardwarePrimitives(component);
  const slot = parts.find((part) => part.kind === "rect" && part.fill === "#102227");
  assert.ok(slot.width > slot.height * 8);
  assert.ok(parts.some((part) => part.kind === "text" && part.text === "MICRO SD"));
  assert.ok(parts.every((part) => part.kind !== "circle"), "a card recess has no screw, grounding stud or socket pins");
  assert.deepEqual(hardwarePrimitives({ ...component, variant: "unknown" }), []);
  assert.match(hardwareComponentSVG(component), /MICRO SD/);
});

test("Rugged108F DIN brackets retain four slotted fixings and the separate spring release", () => {
  const component = { kind: "din-bracket", variant: "fsr108f", x: 13, y: 21, width: 183, height: 208 };
  const parts = hardwarePrimitives(component);
  const slots = parts.filter((part) => part.kind === "rect" && part.fill === "#dbe2e1");
  const screws = parts.filter((part) => part.kind === "circle" && part.fill === "#65716c");
  assert.equal(slots.length, 4);
  assert.equal(screws.length, 4);
  assert.deepEqual(screws.map((part) => [Number(((part.cx - 13) / 183).toFixed(3)), Number(((part.cy - 21) / 208).toFixed(3))]),
    [[.377, .269], [.803, .269], [.377, .827], [.803, .827]]);
  for (const slot of slots) {
    assert.ok(slot.height > slot.width * 4 && slot.rx > 0, "fixings occupy elongated rounded slots, not sockets");
    assert.ok(screws.some((screw) => Math.abs(screw.cx - slot.x - slot.width / 2) < 1e-8 &&
      screw.cy > slot.y && screw.cy < slot.y + slot.height));
  }
  const release = parts.filter((part) => part.kind === "line" && part.stroke === "#545c52");
  assert.equal(release.length, 3, "the lower spring release is a transparent triangular wire loop");
  assert.ok(release.every((part) => part.x1 < screws[1].cx && part.x2 < screws[1].cx &&
    part.y1 > screws[0].cy && part.y2 > screws[0].cy));
  assert.ok(!parts.some((part) => ["#d7b76c", "#07151a", "#42d98b"].includes(part.fill)), "mounting hardware has no invented contacts, vents or lamps");
  assert.deepEqual(hardwarePrimitives({ ...component, variant: "unknown" }), [], "an untraced DIN bracket never falls back to a connector");
});

test("passive radial vents and wire retainers do not render connector contacts or obscure the inlet", () => {
  const component = { x: 0, y: 0, width: 70, height: 70 };
  const vent = hardwarePrimitives({ ...component, kind: "vent", variant: "radial" });
  assert.equal(vent.length, 16);
  assert.ok(vent.every((part) => part.kind === "circle" && part.r < 5));
  assert.ok(vent.every((part) => Math.hypot(part.cx - 35, part.cy - 35) > part.r), "no fictitious central rotor");
  const wire = hardwarePrimitives({ ...component, kind: "handle", variant: "wire" });
  assert.equal(wire.length, 5);
  assert.ok(wire.every((part) => part.kind === "line"), "the retainer must stay transparent over the power inlet");
});

const kinds = [
  "rj45", "sfp", "qsfp", "osfp", "cfp", "lc", "sc", "mpo", "usb-mini", "usb-micro", "usb-c",
  "console", "stack", "dsl", "coax", "power", "usb", "led", "vent", "fan", "handle", "psu",
  "module-bay", "text", "chassis", "vga", "db9", "drive-carrier", "unknown",
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
  if (part.kind === "polygon") {
    const xs = part.points.map((point) => point[0]); const ys = part.points.map((point) => point[1]);
    return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
  }
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
    beginPath() { this.path = []; this.shapeStart = this.shapes.length; },
    roundRect(x, y, width, height, rx) { this.shapes.push({ kind: "rect", x, y, width, height, rx }); },
    arc(cx, cy, r) { this.shapes.push({ kind: "circle", cx, cy, r }); },
    moveTo(x1, y1) { this.pending = { kind: "line", x1, y1 }; this.path.push([x1, y1]); },
    lineTo(x2, y2) { this.shapes.push({ ...this.pending, x2, y2 }); this.path.push([x2, y2]); },
    closePath() { this.shapes.splice(this.shapeStart); this.shapes.push({ kind: "polygon", points: this.path }); },
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

test("StackPower housings expose paired shelves and a keyed latch without inventing a pin count", () => {
  const component = { x: 0, y: 0, width: 36, height: 27, kind: "power", variant: "stack-power" };
  const parts = hardwarePrimitives(component);
  const shelves = parts.filter((part) => part.kind === "rect" && part.fill === "#a7b2b5");
  assert.equal(shelves.length, 2);
  assert.equal(shelves[0].x, shelves[1].x);
  assert.ok(shelves[0].y < shelves[1].y);
  assert.ok(shelves.every((part) => part.width > part.height * 3));
  assert.ok(parts.some((part) => part.kind === "rect" && part.y < component.height * .05), "the upper latch remains visible");
  assert.equal(parts.filter((part) => part.fill === "#b9c3c4").length, 0, "unresolved individual contacts are not invented");
  assert.notDeepEqual(parts, hardwarePrimitives({ ...component, variant: "dc-multipin" }), "the opened stack-power socket cannot look like an empty cover");
  const canvas = recordingContext();
  drawHardwareComponent(canvas, component);
  assert.equal(canvas.shapes.length, parts.length);
  assert.equal((hardwareComponentSVG(component).match(/<(?:rect|circle|line|text)\b/g) || []).length, parts.length);
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

test("three-contact DC supplies distinguish retained metal and recessed keyed right inlets", () => {
  const bounds = { x: 0, y: 0, width: 120, height: 80, kind: "psu" };
  const metal = hardwarePrimitives({ ...bounds, variant: "dc-keyed3-inlet-right" });
  const recessed = hardwarePrimitives({ ...bounds, variant: "dc-recessed3-inlet-right" });
  for (const parts of [metal, recessed]) {
    const contacts = parts.filter((part) => part.kind === "circle" && part.fill === "#b9c3c4");
    assert.equal(contacts.length, 3, "the supply connector has exactly three round contacts");
    assert.equal(new Set(contacts.map((part) => part.cx)).size, 1, "contacts form one vertical column");
    assert.ok(contacts.every((part) => part.cx > bounds.width * .6));
    assert.ok(contacts[0].cy < contacts[1].cy && contacts[1].cy < contacts[2].cy);
    const handle = parts.find((part) => part.kind === "rect" && part.fill === "#a7b2b5");
    assert.ok(handle && handle.height > handle.width * 2 && handle.x + handle.width < contacts[0].cx,
      "the vertical pull handle sits left of the inlet");
  }
  const metalContacts = metal.filter((part) => part.kind === "circle" && part.fill === "#b9c3c4");
  assert.ok(metalContacts[1].r > metalContacts[0].r && metalContacts[1].r > metalContacts[2].r);
  const recessedContacts = recessed.filter((part) => part.kind === "circle" && part.fill === "#b9c3c4");
  assert.equal(new Set(recessedContacts.map((part) => part.r)).size, 1);
  const retainers = metal.filter((part) => part.kind === "circle" && part.fill === "#708389");
  assert.equal(retainers.length, 2, "the metal inlet retains its two mounting fasteners");
  assert.ok(retainers[0].cy < metalContacts[0].cy && retainers[1].cy > metalContacts[2].cy);
  assert.equal(recessed.filter((part) => part.kind === "circle" && part.fill === "#708389").length, 0);
  for (const variant of ["dc-keyed3-inlet-right", "dc-recessed3-inlet-right"]) {
    assert.ok(!hardwarePrimitives({ ...bounds, variant, active: false }).some((part) => part.fill === "#42d98b"));
  }
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
    ...["dc-keyed3-inlet-right", "dc-recessed3-inlet-right"].flatMap((variant) =>
      [[100, 50], [60, 80], [20, 10]].map(([width, height]) => ({ variant, width, height }))),
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

test("VGA and DB9 keep their documented contact rows and side screws in both orientations", () => {
  for (const [kind, rows] of [["vga", [5, 5, 5]], ["db9", [5, 4]]]) {
    for (const portrait of [false, true]) {
      const box = { kind, x: 0, y: 0, width: portrait ? 24 : 60, height: portrait ? 60 : 24 };
      const parts = hardwarePrimitives(box);
      const contacts = parts.filter((part) => part.kind === "circle" && part.fill === (kind === "vga" ? "#07151a" : "#d7b76c"));
      assert.equal(contacts.length, rows.reduce((sum, count) => sum + count, 0));
      const groups = new Map();
      for (const contact of contacts) {
        const axis = portrait ? contact.cx : contact.cy;
        groups.set(axis, (groups.get(axis) || 0) + 1);
      }
      assert.deepEqual([...groups.values()], rows, "rotation preserves each original contact row");
      const screws = parts.filter((part) => part.kind === "circle" && part.fill === "#a7b2b5");
      assert.equal(screws.length, 2);
      assert.ok(portrait ? screws[0].cy < Math.min(...contacts.map((part) => part.cy)) && screws[1].cy > Math.max(...contacts.map((part) => part.cy))
        : screws[0].cx < Math.min(...contacts.map((part) => part.cx)) && screws[1].cx > Math.max(...contacts.map((part) => part.cx)));
      if (kind === "vga") assert.ok(parts.some((part) => part.fill === "#2865aa"), "VGA retains its blue socket insert");
    }
  }
});

test("mesh fan trays show a rotor through square guards with a center pull bar and lower status light", () => {
  const component = { kind: "fan", variant: "mesh-handle", x: 0, y: 0, width: 110, height: 130 };
  const parts = hardwarePrimitives(component);
  const handle = parts.find((part) => part.kind === "rect" && part.fill === "#708389");
  assert.ok(handle && handle.height > handle.width * 3);
  assert.equal(handle.x + handle.width / 2, component.width / 2);
  const rotor = parts.find((part) => part.kind === "circle" && part.fill === "#122327");
  assert.ok(rotor && rotor.r > component.width / 4);
  const guards = parts.filter((part) => part.kind === "rect" && part.fill === "#a7b2b5");
  assert.ok(guards.some((part) => part.width > part.height * 5) && guards.some((part) => part.height > part.width * 5));
  const vertical = guards.filter((part) => part.height > part.width);
  const horizontal = guards.filter((part) => part.width > part.height);
  assert.ok(Math.abs((vertical[1].x - vertical[0].x) - (horizontal[1].y - horizontal[0].y)) < 1e-8,
    "grid cells stay square in world coordinates");
  assert.ok(parts.some((part) => part.fill === "#42d98b" && part.cy > handle.y + handle.height));
  assert.ok(!hardwarePrimitives({ ...component, active: false }).some((part) => part.fill === "#42d98b"));
});

test("drive carriers distinguish the front release/status strip from compact rear BOSS trays", () => {
  const drive = hardwarePrimitives({ kind: "drive-carrier", x: 0, y: 0, width: 140, height: 35 });
  const release = drive.find((part) => part.kind === "circle" && part.stroke === "#c6a476");
  assert.ok(release && release.cx < 140 * .3, "front drive release belongs to the left latch block");
  const vent = drive.filter((part) => part.kind === "rect" && part.fill === "#07151a");
  assert.ok(vent.length > 12 && vent.every((part) => part.x > release.cx), "the grille occupies the carrier center");
  const boss = hardwarePrimitives({ kind: "drive-carrier", variant: "boss", x: 0, y: 0, width: 22, height: 65 });
  assert.ok(!boss.some((part) => part.stroke === "#c6a476"), "BOSS uses a compact pull latch rather than the front drive release");
  assert.ok(boss.some((part) => part.kind === "rect" && part.y > 65 * .75));
});

test("new connector, carrier and mesh-fan adapters retain finite bounded geometry", () => {
  const configurations = [{ kind: "vga" }, { kind: "db9" }, { kind: "drive-carrier" },
    { kind: "drive-carrier", variant: "boss" }, { kind: "fan", variant: "mesh-handle" },
    { kind: "terminal", variant: "pluggable", pins: 9 }, { kind: "led", variant: "bar" }, { kind: "service-jack" },
    { kind: "fan", variant: "mesh-dual" }, { kind: "psu", variant: "ac-compact-c14" },
    { kind: "vent", variant: "radial" }, { kind: "handle", variant: "wire" },
    { kind: "din-bracket", variant: "fsr108f" },
    ...["mesh-dual-end-top", "mesh-dual-end-bottom", "mesh-triple-end", "mesh-dual-7060e"].map((variant) => ({ kind: "fan", variant })),
    ...["ac-c16-portrait", "dc-keyed2-portrait", "ac-saf-d-grid", "ac-fan-left-c20", "ac-inlet-right-sideways", "ac-c16-horizontal", "dc-terminal2-7060e"].map((variant) => ({ kind: "psu", variant }))];
  for (const configuration of configurations) for (const [width, height] of [[80, 30], [30, 80], [12, 12]]) {
    const component = { ...configuration, x: -10, y: 20, width, height };
    const parts = hardwarePrimitives(component);
    const canvas = recordingContext();
    drawHardwareComponent(canvas, component);
    assert.equal(canvas.shapes.length, parts.length);
    assert.equal((hardwareComponentSVG(component).match(/<(?:rect|circle|line|text)\b/g) || []).length, parts.length);
    for (const [index, part] of parts.entries()) {
      const bounds = primitiveBounds(part);
      assert.ok([bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite));
      assert.ok(bounds.x >= component.x - 1e-8 && bounds.y >= component.y - 1e-8, `${configuration.kind}/${configuration.variant}: ${part.kind} starts within ${width}x${height}`);
      assert.ok(bounds.x + bounds.width <= component.x + width + 1e-8 && bounds.y + bounds.height <= component.y + height + 1e-8,
        `${configuration.kind}/${configuration.variant}: ${part.kind} fits ${width}x${height}`);
      for (const [key, value] of Object.entries(canvas.shapes[index])) assert.equal(value, part[key] ?? 0);
    }
  }
});

test("pluggable terminal headers keep one explicit contact row and two separate retaining holes", () => {
  for (const pins of [1, 2, 4, 6, 9, 24]) for (const portrait of [false, true]) {
    const component = { kind: "terminal", variant: "pluggable", pins, x: 0, y: 0,
      width: portrait ? 24 : 120, height: portrait ? 120 : 24 };
    const parts = hardwarePrimitives(component);
    const contacts = parts.filter((part) => part.kind === "rect" && part.fill === "#b9c3c4");
    assert.equal(contacts.length, pins);
    assert.equal(new Set(contacts.map((part) => portrait ? part.x : part.y)).size, 1);
    assert.ok(contacts.every((part) => Math.abs(part.width - part.height) < 1e-8), "male contact tips stay square after rotation");
    const retainers = parts.filter((part) => part.kind === "circle" && part.fill === "#708389");
    assert.equal(retainers.length, 2);
    assert.ok(!parts.some((part) => part.fill === "#39745d"), "a pluggable header is not the existing green screw block");
    for (const contact of contacts) {
      if (portrait) assert.ok(contact.y > retainers[0].cy && contact.y + contact.height < retainers[1].cy);
      else assert.ok(contact.x > retainers[0].cx && contact.x + contact.width < retainers[1].cx);
    }
  }
  for (const pins of [undefined, 0, -1, 1.5, 25, Infinity]) {
    const parts = hardwarePrimitives({ kind: "terminal", variant: "pluggable", pins, x: 0, y: 0, width: 80, height: 24 });
    assert.equal(parts.filter((part) => part.fill === "#b9c3c4").length, 0, "invalid or unknown contact counts do not invent pins");
  }
  const screw = hardwarePrimitives({ kind: "terminal", pins: 4, x: 0, y: 0, width: 80, height: 24 });
  assert.ok(screw.some((part) => part.fill === "#39745d"));
  assert.equal(screw.filter((part) => part.kind === "circle").length, 4);
});

test("status light bars retain their specified color and darken when inactive", () => {
  const component = { kind: "led", variant: "bar", x: 10, y: 20, width: 6, height: 40, color: "#168fd3" };
  const parts = hardwarePrimitives(component);
  assert.ok(parts.every((part) => part.kind === "rect"), "a light bar has no handle or circular status lens");
  const light = parts.find((part) => part.fill === component.color);
  assert.ok(light && light.height > light.width * 5);
  assert.equal(light.x + light.width / 2, component.x + component.width / 2);
  assert.ok(!hardwarePrimitives({ ...component, active: false }).some((part) => part.fill === component.color));
  assert.ok(hardwarePrimitives({ ...component, color: undefined }, { accent: "#123456" })
    .some((part) => part.fill === "#123456"));
});

test("service jacks have a recessed aperture without power contacts or an illuminated button", () => {
  const parts = hardwarePrimitives({ kind: "service-jack", x: 10, y: 20, width: 12, height: 10 });
  assert.equal(parts.length, 2);
  assert.ok(parts.every((part) => part.kind === "circle"));
  assert.equal(parts[0].cx, parts[1].cx);
  assert.equal(parts[0].cy, parts[1].cy);
  assert.ok(parts[0].r > parts[1].r);
  assert.equal(parts[1].fill, "#07151a");
  assert.ok(!parts.some((part) => ["#b9c3c4", "#d7b76c", "#22a0ab"].includes(part.fill)));
});

test("dual mesh trays retain two rotors, square guards and side pull handles from the chassis guide", () => {
  const component = { kind: "fan", variant: "mesh-dual", x: 0, y: 0, width: 200, height: 330 };
  const parts = hardwarePrimitives(component);
  const rotors = parts.filter((part) => part.kind === "circle" && part.fill === "#122327");
  assert.equal(rotors.length, 2);
  assert.equal(rotors[0].cx, rotors[1].cx);
  assert.ok(rotors[0].cy + rotors[0].r < rotors[1].cy - rotors[1].r, "the two rotors remain separate");
  const handles = parts.filter((part) => part.kind === "rect" && part.fill === "#708389");
  assert.equal(handles.length, 2);
  assert.ok(handles[0].x + handles[0].width < rotors[0].cx - rotors[0].r);
  assert.ok(handles[1].x > rotors[0].cx + rotors[0].r);
  const leds = parts.filter((part) => part.fill === "#42d98b");
  assert.equal(leds.length, 2);
  assert.deepEqual(leds.map((part) => part.cy), rotors.map((part) => part.cy));
  assert.ok(leds.every((part) => part.cx > rotors[0].cx + rotors[0].r));
  const guards = parts.filter((part) => part.kind === "rect" && part.fill === "#a7b2b5");
  const vertical = guards.filter((part) => part.height > part.width);
  const horizontal = guards.filter((part) => part.width > part.height);
  assert.ok(Math.abs((vertical[1].x - vertical[0].x) - (horizontal[1].y - horizontal[0].y)) < 1e-8);
  assert.ok(!hardwarePrimitives({ ...component, active: false }).some((part) => part.fill === "#42d98b"));
});

test("compact C14 supplies keep a broad three-contact inlet left of the pull bar", () => {
  const component = { kind: "psu", variant: "ac-compact-c14", x: 0, y: 0, width: 90, height: 92 };
  const parts = hardwarePrimitives(component);
  const contacts = parts.filter((part) => part.kind === "rect" && part.fill === "#b9c3c4");
  assert.equal(contacts.length, 3);
  assert.ok(contacts[0].y < contacts[1].y && contacts[1].y === contacts[2].y);
  const inlet = parts.find((part) => part.kind === "rect" && part.fill === "#07151a");
  const handle = parts.find((part) => part.kind === "rect" && part.fill === "#708389" && part.height > part.width * 4);
  assert.ok(inlet.width > inlet.height, "the C14 aperture is broad even in a nearly square PSU allocation");
  assert.ok(handle.x > inlet.x + inlet.width);
  assert.ok(contacts.every((part) => part.x > inlet.x && part.x + part.width < inlet.x + inlet.width));
  assert.ok(parts.some((part) => part.kind === "rect" && part.fill === "#53b454" && part.x > handle.x + handle.width));
  const led = parts.find((part) => part.fill === "#42d98b");
  assert.ok(led.cx > handle.x + handle.width && led.cy > component.height * .75);
  assert.ok(!hardwarePrimitives({ ...component, active: false }).some((part) => part.fill === "#42d98b"));
  const ordinary = hardwarePrimitives({ ...component, variant: "ac" });
  assert.ok(!ordinary.some((part) => part.fill === "#53b454"), "existing generic PSU variants retain their prior artwork");
});

test("7000F trays retain their rotor count, end handles and single correctly placed status lamp", () => {
  for (const variant of ["mesh-dual-end-top", "mesh-dual-end-bottom", "mesh-triple-end"]) {
    const triple = variant === "mesh-triple-end";
    const component = { kind: "fan", variant, x: 0, y: 0, width: 180, height: triple ? 530 : 360 };
    const parts = hardwarePrimitives(component);
    const rotors = parts.filter((part) => part.kind === "circle" && part.fill === "#122327");
    assert.equal(rotors.length, triple ? 3 : 2);
    for (let index = 1; index < rotors.length; index++) assert.ok(rotors[index - 1].cy + rotors[index - 1].r < rotors[index].cy - rotors[index].r);
    assert.ok(rotors.every((rotor) => rotor.cx === 90));
    for (const [index, center] of (triple ? [.180, .485, .790] : [.290, .735]).entries()) {
      assert.ok(Math.abs(rotors[index].cy / component.height - center) < 1e-12);
    }
    const led = parts.filter((part) => part.fill === "#42d98b");
    assert.equal(led.length, 1);
    assert.equal(led[0].cx, 90);
    assert.ok(variant.endsWith("top") ? led[0].cy < rotors[0].cy - rotors[0].r : led[0].cy > rotors.at(-1).cy + rotors.at(-1).r);
    const bars = parts.filter((part) => part.kind === "rect" && part.fill === "#a7b2b5" && part.width === 54);
    assert.equal(bars.length, 2, "two centered horizontal grip sections join the four end posts");
    assert.ok(bars[0].y < rotors[0].cy && bars[1].y > rotors.at(-1).cy);
    assert.ok(!hardwarePrimitives({ ...component, active: false }).some((part) => part.fill === "#42d98b"));
  }
});

test("7000F PSU variants distinguish C16 key, DC contacts and the Saf-D-Grid outline", () => {
  const component = { kind: "psu", x: 0, y: 0, width: 70, height: 100 };
  const c16 = hardwarePrimitives({ ...component, variant: "ac-c16-portrait" });
  const contacts = c16.filter((part) => part.kind === "rect" && part.fill === "#b9c3c4");
  assert.equal(contacts.length, 3);
  assert.ok(contacts.every((part) => part.width > part.height), "C16 contact blades rotate with the installed vertical supply");
  assert.ok(c16.some((part) => part.kind === "circle" && part.fill === "#708389"), "the C16 high-temperature key remains visible");
  const dc = hardwarePrimitives({ ...component, variant: "dc-keyed2-portrait" });
  const dcContacts = dc.filter((part) => part.kind === "circle" && part.fill === "#b9c3c4");
  assert.equal(dcContacts.length, 2);
  assert.equal(dcContacts[0].cx, dcContacts[1].cx);
  assert.ok(dcContacts[0].cy < dcContacts[1].cy);
  const saf = hardwarePrimitives({ ...component, variant: "ac-saf-d-grid" });
  assert.ok(!saf.some((part) => part.fill === "#b9c3c4"), "Saf-D-Grid is not substituted with invented IEC blades");
  assert.ok(saf.filter((part) => part.kind === "line" && part.stroke === "#a7b2b5").length >= 10);
  for (const variant of ["ac-c16-portrait", "dc-keyed2-portrait", "ac-saf-d-grid"]) {
    const parts = hardwarePrimitives({ ...component, variant });
    assert.equal(parts.filter((part) => part.fill === "#42d98b").length, 1);
    assert.ok(!hardwarePrimitives({ ...component, variant, active: false }).some((part) => part.fill === "#42d98b"));
    assert.equal(parts.some((part) => part.fill === "#4c73b2"), variant !== "dc-keyed2-portrait",
      "AC supplies have blue release latches; the DC supply has the illustrated gray toothed latch");
  }
});

test("Dell 2400W supplies retain their C20 blade arrangement, left fan and orange release latch", () => {
  const component = { kind: "psu", variant: "ac-fan-left-c20", x: 0, y: 0, width: 250, height: 110 };
  const parts = hardwarePrimitives(component);
  const contacts = parts.filter((part) => part.kind === "rect" && part.fill === "#d0d6d8");
  assert.equal(contacts.length, 3);
  assert.ok(contacts.every((contact) => contact.height > contact.width));
  assert.ok(contacts[0].x < contacts[1].x && contacts[1].x === contacts[2].x);
  assert.ok(contacts[1].y < contacts[0].y && contacts[0].y < contacts[2].y);
  const fan = parts.find((part) => part.kind === "circle" && part.fill === "#122327");
  const inlet = parts.find((part) => part.kind === "rect" && part.fill === "#07151a");
  const handle = parts.find((part) => part.kind === "rect" && part.fill === "#a7b2b5");
  const latch = parts.find((part) => part.fill === "#d68c40");
  assert.ok(fan.cx + fan.r < handle.x && handle.x + handle.width < inlet.x);
  assert.ok(latch.x > inlet.x + inlet.width);
  assert.ok(!hardwarePrimitives({ ...component, variant: "ac-fan-left" }).some((part) => part.fill === "#d68c40"));
});

test("Dell narrow supplies rotate C14 blades toward the left handle and retain the orange inlet-side latch", () => {
  const component = { kind: "psu", variant: "ac-inlet-right-sideways", x: 0, y: 0, width: 110, height: 90 };
  const parts = hardwarePrimitives(component);
  const contacts = parts.filter((part) => part.kind === "rect" && part.fill === "#d0d6d8");
  assert.equal(contacts.length, 3);
  assert.ok(contacts.every((contact) => contact.width > contact.height), "the three C14 blades are horizontal in the installed Dell supply");
  assert.ok(contacts[0].x < contacts[1].x && contacts[1].x === contacts[2].x);
  assert.ok(contacts[1].y < contacts[0].y && contacts[0].y < contacts[2].y);
  const inlet = parts.find((part) => part.kind === "rect" && part.fill === "#07151a");
  const handle = parts.find((part) => part.kind === "rect" && part.fill === "#a7b2b5");
  const latch = parts.find((part) => part.fill === "#d68c40");
  assert.ok(handle.x + handle.width < inlet.x);
  assert.ok(latch.x > inlet.x + inlet.width);
  assert.ok(latch.y > inlet.y && latch.y + latch.height < inlet.y + inlet.height);
  assert.ok(!parts.some((part) => part.fill === "#42d98b"), "the source does not establish a separate upper-right PSU lamp");
  assert.ok(!hardwarePrimitives({ ...component, variant: "ac-inlet-right" }).some((part) => part.fill === "#d68c40"),
    "the existing inlet-right PSU variant is unchanged");
});

test("7060E fans and horizontal supplies retain their individually illustrated centers and contact arrangements", () => {
  const fan = hardwarePrimitives({ kind: "fan", variant: "mesh-dual-7060e", x: 0, y: 0, width: 220, height: 550 });
  const rotors = fan.filter((part) => part.kind === "circle" && part.fill === "#122327");
  assert.equal(rotors.length, 2);
  assert.deepEqual(rotors.map((part) => Math.round(part.cy)), [143, 385]);
  const lamp = fan.filter((part) => part.fill === "#42d98b");
  assert.equal(lamp.length, 1);
  assert.ok(lamp[0].cy > rotors[1].cy + rotors[1].r);
  const component = { kind: "psu", x: 0, y: 0, width: 130, height: 90 };
  const ac = hardwarePrimitives({ ...component, variant: "ac-c16-horizontal" });
  const blades = ac.filter((part) => part.kind === "rect" && part.fill === "#b9c3c4");
  assert.equal(blades.length, 3);
  assert.ok(blades.every((part) => part.height > part.width));
  assert.ok(blades[0].y < blades[1].y && blades[1].y === blades[2].y);
  assert.ok(ac.some((part) => part.kind === "circle" && part.fill === "#708389"), "C16 temperature key remains visible");
  assert.ok(ac.some((part) => part.fill === "#4c73b2" && part.x > 110), "AC blue latch stays at the right edge");
  const dc = hardwarePrimitives({ ...component, variant: "dc-terminal2-7060e" });
  const terminals = dc.filter((part) => part.kind === "circle" && part.fill === "#b9c3c4");
  assert.equal(terminals.length, 3, "two power terminals and one separate earth stud");
  assert.equal(terminals[0].cy, terminals[1].cy);
  assert.ok(terminals[2].cy < terminals[0].cy && terminals[2].cx > terminals[1].cx);
  const latch = dc.find((part) => part.kind === "rect" && part.fill === "#56ada4");
  assert.ok(latch.x > 115 && latch.height > 20);
  assert.equal(dc.filter((part) => part.kind === "line" && part.x1 > 120 && part.x2 > 120).length, 6, "DC latch has six source-visible teeth");
  assert.ok(dc.find((part) => part.fill === "#42d98b").cy < 30, "DC status lamp is above the handle midpoint");
  assert.ok(!hardwarePrimitives({ ...component, variant: "dc-terminal2-7060e", active: false }).some((part) => part.fill === "#42d98b"));
});
