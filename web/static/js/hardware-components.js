const DEFAULT_PALETTE = Object.freeze({
  surface: "#d9dfe1", surfaceDark: "#515e62", ink: "#102227", accent: "#22a0ab",
});

/** Build reusable hardware artwork in absolute coordinates for both Canvas and SVG. */
export function hardwarePrimitives(component, palette = {}) {
  if (!component || ![component.x, component.y, component.width, component.height].every(Number.isFinite) ||
    component.width <= 0 || component.height <= 0) return [];

  const colors = { ...DEFAULT_PALETTE, ...palette };
  if (component.ink) colors.ink = component.ink;
  const art = primitiveBuilder(component, colors);
  const { kind } = component;
  if (kind === "text") {
    art.label(component.text ?? component.label ?? "", .5, .5, component.fontSize ?? 9);
    return art.parts;
  }
  if (kind === "chassis") {
    art.rect(.01, .025, .98, .95, colors.surface, colors.ink, .04);
    art.line(.025, .06, .975, .06, "#ffffff", .45);
  } else if (kind === "ring") {
    art.circle(.5, .5, .48, undefined, colors.ink);
  } else if (kind === "screw") {
    art.circle(.5, .5, .46, colors.surface, colors.ink);
    art.circle(.5, .5, .32, colors.surfaceDark, colors.ink);
    art.line(.28, .5, .72, .5, "#b9c3c4");
    art.line(.5, .28, .5, .72, "#b9c3c4");
  } else if (kind === "terminal") {
    const pins = Number.isInteger(component.pins) && component.pins > 0 && component.pins <= 24 ? component.pins : 0;
    const vertical = component.height > component.width;
    art.rect(.02, .02, .96, .96, "#39745d", colors.ink, .025);
    for (let index = 0; index < pins; index++) {
      const center = .1 + (index + .5) * .8 / pins;
      const cx = vertical ? .5 : center;
      const cy = vertical ? center : .5;
      art.circle(cx, cy, Math.min(.2, .25 / pins * (vertical ? component.height / component.width : component.width / component.height)),
        "#172b23", "#a7b2b5");
      if (vertical) art.line(.42, cy, .58, cy, "#a7b2b5");
      else art.line(cx, .42, cx, .58, "#a7b2b5");
    }
  } else if (kind === "lcd") {
    art.rect(.01, .015, .98, .97, "#17262d", colors.ink, .08);
    art.rect(.12, .1, .76, .76, "#123a53", "#607d8b", .025);
    art.line(.23, .3, .77, .3, "#86c9e6", .65);
    art.line(.23, .46, .61, .46, "#86c9e6", .65);
    art.line(.23, .62, .69, .62, "#86c9e6", .4);
  } else if (kind === "switch") {
    art.rect(.02, .2, .96, .6, "#07151a", colors.ink, .08);
    art.rect(.14, .27, .3, .46, colors.surfaceDark, "#a5b2b6", .05);
    art.line(.24, .35, .24, .65, "#a5b2b6");
  } else if (kind === "button" && component.variant === "reset") {
    art.circle(.5, .5, .45, colors.surfaceDark, colors.ink);
    art.circle(.5, .5, .22, "#07151a");
  } else if (kind === "button") {
    art.circle(.5, .5, .45, colors.surfaceDark, colors.ink);
    art.circle(.5, .5, .31, "#23383f", "#a5b2b6");
    art.circle(.5, .5, .1, colors.accent);
  } else if (kind === "led") {
    art.circle(.5, .5, .43, colors.surfaceDark, colors.ink);
    art.circle(.5, .5, .27, component.active === false ? colors.surfaceDark : colors.accent);
    art.circle(.43, .38, .07, "#ffffff", undefined, .5);
  } else if (kind === "vent") {
    addVent(art, component, colors);
  } else if (kind === "fan") {
    addFan(art, colors, component.variant);
  } else if (kind === "handle") {
    addHandle(art, colors);
  } else if (kind === "psu") {
    addPowerSupply(art, component, colors);
  } else if (kind === "module-bay") {
    art.rect(.015, .035, .97, .93, colors.surfaceDark, colors.ink, .02);
    art.rect(.04, .1, .92, .8, colors.surface, colors.ink, .025);
    art.circle(.075, .5, .05, colors.surfaceDark, colors.ink);
    art.circle(.925, .5, .05, colors.surfaceDark, colors.ink);
    if (component.variant !== "populated") {
      art.line(.17, .3, .83, .3, colors.surfaceDark, .4);
      art.line(.17, .7, .83, .7, colors.surfaceDark, .4);
    }
  } else {
    addSocket(art, kind, colors, component.variant, component.width < component.height, component.columns);
  }
  if (component.label) art.label(component.label, .5, .87, 8);
  return art.parts;
}

/** Provide normalized drawing helpers while keeping the public primitives absolute. */
function primitiveBuilder(component, colors) {
  const { x, y, width, height } = component;
  const scale = Math.min(width, height);
  const strokeWidth = Number.isFinite(colors.strokeWidth) && colors.strokeWidth >= 0
    ? colors.strokeWidth : Math.min(1, scale * .045);
  const parts = [];
  return {
    parts,
    /** Add a rectangle whose radius scales with the smaller component dimension. */
    rect(left, top, w, h, fill, stroke, radius = .035, opacity = 1) {
      parts.push({ kind: "rect", x: x + left * width, y: y + top * height, width: w * width,
        height: h * height, rx: Math.min(radius * scale, w * width / 2, h * height / 2),
        fill, stroke, strokeWidth, opacity });
    },
    /** Add a circle with a radius relative to the smaller component dimension. */
    circle(cx, cy, radius, fill, stroke, opacity = 1) {
      parts.push({ kind: "circle", cx: x + cx * width, cy: y + cy * height, r: radius * scale,
        fill, stroke, strokeWidth, opacity });
    },
    /** Add a line in component coordinates. */
    line(x1, y1, x2, y2, stroke, opacity = 1) {
      parts.push({ kind: "line", x1: x + x1 * width, y1: y + y1 * height,
        x2: x + x2 * width, y2: y + y2 * height, stroke, strokeWidth, opacity });
    },
    /** Fit a centered label inside the component rather than spilling onto adjacent hardware. */
    label(value, left, top, requestedSize) {
      const text = String(value);
      const fontSize = Math.min(Number.isFinite(requestedSize) && requestedSize > 0 ? requestedSize : height * .24,
        height * .7, width * .88 / Math.max(1, text.length * .62));
      parts.push({ kind: "text", x: x + left * width, y: y + top * height, text, fontSize,
        anchor: "middle", fill: colors.ink, opacity: 1 });
    },
  };
}

/** Draw connector cages, keyed openings, contacts, and optical release latches. */
function addSocket(art, kind, colors, variant, portrait, columns) {
  const fill = colors.fill ?? "#07151a";
  const stroke = colors.stroke ?? "#708389";
  if (kind === "power" && (variant === "dc-multipin" || variant === "stack-power")) {
    art.rect(.02, .12, .96, .84, colors.surfaceDark, stroke, .05);
    art.rect(.11, .27, .78, .53, fill, "#a7b2b5", .05);
    art.rect(.42, .015, .16, .14, colors.surfaceDark, stroke, .015);
    if (variant === "stack-power") {
      // The guide resolves the paired shelves and key, but not individual contact pins.
      for (const top of [.31, .62]) {
        art.rect(.17, top, .66, .11, "#a7b2b5", undefined, .012);
        art.rect(.24, top + .025, .48, .06, fill, undefined, .005);
      }
      art.rect(.68, .42, .16, .20, colors.surfaceDark, stroke, .01);
      return;
    }
    if (Number.isInteger(columns) && columns > 0 && columns <= 24) {
      for (let column = 0; column < columns; column++) for (const top of [.39, .6]) {
        art.rect(.145 + column * .7 / columns, top, .35 / columns, .055, "#b9c3c4", undefined, .005);
      }
    }
    return;
  }
  if (kind === "power" && variant === "dc-keyed4") {
    art.rect(.08, .15, .84, .78, colors.surfaceDark, stroke, .05);
    art.rect(.32, .03, .36, .18, colors.surfaceDark, stroke, .025);
    for (const left of [.2, .56]) for (const top of [.3, .62]) {
      art.rect(left, top, .24, .22, fill, undefined, .035);
      art.rect(left + .075, top + .065, .09, .09, "#b9c3c4", undefined, .01);
    }
    return;
  }
  if (kind === "power" && variant === "dc-keyed2") {
    art.rect(.17, .26, .66, .68, colors.surfaceDark, stroke, .035);
    art.rect(.17, .06, .18, .25, colors.surfaceDark, stroke, .05);
    art.rect(.65, .06, .18, .25, colors.surfaceDark, stroke, .05);
    art.rect(.35, .19, .3, .13, fill, undefined, .05);
    art.rect(.23, .37, .54, .06, "#a7b2b5", undefined, .01);
    for (const top of [.45, .71]) {
      art.rect(.28, top, .44, .18, fill, undefined, .025);
      art.rect(.42, top + .055, .16, .065, "#b9c3c4", undefined, .01);
    }
    return;
  }
  if (kind === "power" && variant === "dc-barrel") {
    art.circle(.5, .5, .46, colors.surfaceDark, stroke);
    art.circle(.5, .5, .34, fill, "#a7b2b5");
    art.circle(.5, .5, .07, "#b9c3c4");
    return;
  }
  if (kind === "coax") {
    art.circle(.5, .5, .46, colors.surfaceDark, stroke);
    art.circle(.5, .5, .34, colors.surface, stroke);
    if (variant === "capped") return;
    art.circle(.5, .5, .2, fill, stroke);
    art.circle(.5, .5, .045, "#d7b76c");
    return;
  }
  art.rect(.025, .035, .95, .93, fill, stroke, kind === "usb-c" ? .4 : .08);
  if (["sfp", "qsfp", "osfp", "cfp"].includes(kind)) {
    art.rect(.1, .18, .8, .56, "#192b32", "#a7b2b5", .02);
    art.line(.15, .28, .85, .28, "#74878d", .7);
    art.rect(.27, .74, .46, .13, colors.surfaceDark, "#a7b2b5", .02);
    const contacts = kind === "sfp" ? 2 : 4;
    for (let index = 0; index < contacts; index += 1) {
      art.line(.18 + index * .64 / contacts, .61, .18 + index * .64 / contacts, .71, "#d7b76c");
    }
  } else if (kind === "lc" || kind === "sc") {
    const count = kind === "lc" ? 2 : 1;
    for (let index = 0; index < count; index += 1) {
      const left = .12 + index * .4;
      art.rect(left, .2, count === 1 ? .76 : .35, .62, colors.accent, "#a7b2b5", .02);
      art.rect(left + .08, .32, count === 1 ? .6 : .19, .36, fill, undefined, .02);
    }
  } else if (kind === "mpo") {
    art.rect(.12, .25, .76, .5, "#425459", "#a7b2b5", .04);
    for (let index = 0; index < 8; index += 1) art.circle(.22 + index * .08, .5, .026, "#d7b76c");
    art.rect(.44, .13, .12, .14, colors.surfaceDark);
  } else if (["usb", "usb-mini", "usb-micro", "usb-c"].includes(kind)) {
    const slim = kind === "usb-micro" || kind === "usb-c";
    if (kind === "usb" && portrait) {
      art.rect(.5, .14, .26, .72, colors.surfaceDark, "#a7b2b5", .025);
      for (let index = 0; index < 4; index += 1) art.rect(.51, .22 + index * .16, .13, .07, "#d7b76c", undefined, 0);
    } else {
      art.rect(.14, slim ? .4 : .5, .72, slim ? .18 : .26, colors.surfaceDark, "#a7b2b5", .025);
      for (let index = 0; index < 4; index += 1) art.rect(.22 + index * .16, .51, .07, .13, "#d7b76c", undefined, 0);
    }
    if (kind === "usb-mini") art.line(.13, .72, .24, .87, stroke);
  } else if (kind === "power") {
    art.rect(.15, .19, .7, .64, "#18292c", colors.surfaceDark, .1);
    for (const [cx, cy] of [[.5, .38], [.33, .66], [.67, .66]]) art.rect(cx - .025, cy - .085, .05, .17, "#b9c3c4");
  } else if (kind === "stack") {
    art.rect(.15, .2, .7, .6, colors.surfaceDark, "#a7b2b5", .08);
    for (let index = 0; index < 8; index += 1) {
      art.circle(.23 + index * .077, .4, .025, "#d7b76c");
      art.circle(.23 + index * .077, .62, .025, "#d7b76c");
    }
  } else {
    const pinCount = kind === "dsl" ? 6 : 8;
    art.rect(.14, .16, .72, .5, "#172b31", colors.surfaceDark, .025);
    art.rect(.31, .63, .38, .18, fill, undefined, .025);
    art.rect(.4, .79, .2, .1, fill, undefined, .01);
    for (let index = 0; index < pinCount; index += 1) art.rect(.19 + index * .66 / pinCount, .2, .033, .24, "#d7b76c", undefined, 0);
    if (kind === "console") art.line(.18, .86, .82, .86, colors.accent);
  }
}

/** Fill a bounded grille with its repeated openings, heatsink fins, or single slit. */
function addVent(art, component, colors) {
  if (component.variant === "slit") {
    art.rect(.01, .12, .98, .76, colors.surfaceDark, undefined, .04, .9);
    return;
  }
  if (["fins", "chevron", "louver"].includes(component.variant)) {
    const count = Math.max(2, Math.min(64, Math.floor(component.width / 7)));
    for (let index = 0; index < count; index++) {
      const x = .025 + index * .95 / count;
      if (component.variant === "fins") {
        art.rect(x, .04, .35 / count, .92, colors.surfaceDark, colors.ink, 0);
        art.line(x + .35 / count, .06, x + .35 / count, .94, "#b2bdc1", .5);
      } else if (component.variant === "louver") {
        art.line(x, .18, x + .60 / count, .82, colors.surfaceDark, 1.5);
      } else {
        art.line(x, .82, x + .46 / count, .18, colors.surfaceDark, 1.5);
        art.line(x + .46 / count, .18, x + .92 / count, .82, colors.surfaceDark, 1.5);
      }
    }
    return;
  }
  const slots = !["perforated", "mesh"].includes(component.variant);
  const columns = Math.max(2, Math.min(32, Math.floor(component.width / (slots ? 11 : 6))));
  const rows = Math.max(1, Math.min(10, Math.floor(component.height / (slots ? 7 : 6))));
  const cellSize = Math.min(component.width * .92 / columns, component.height * .76 / rows);
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const cx = .04 + (column + .5) * .92 / columns;
      const cy = .12 + (row + .5) * .76 / rows;
      if (component.variant === "perforated") {
        art.circle(cx, cy, cellSize * .27 / Math.min(component.width, component.height), colors.surfaceDark, undefined, .85);
      } else if (component.variant === "mesh") {
        const width = cellSize * .53 / component.width;
        const height = cellSize * .53 / component.height;
        art.rect(cx - width / 2, cy - height / 2, width, height, colors.surfaceDark, undefined, 0, .85);
      } else {
        art.rect(cx - .32 / columns, cy - .12 / rows,
          .64 / columns, .24 / rows, colors.surfaceDark, undefined, .04, .85);
      }
    }
  }
}

/** Draw a fan grille with concentric guards, support ribs, and a center hub. */
function addFan(art, colors, variant) {
  if (variant !== "fixed") art.rect(.025, .035, .95, .93, colors.surfaceDark, colors.ink, .055);
  art.circle(.5, .5, .43, "#122327", "#a7b2b5");
  for (const radius of [.34, .25, .16]) art.circle(.5, .5, radius, undefined, "#708389");
  art.line(.5, .09, .5, .91, "#a7b2b5");
  art.line(.09, .5, .91, .5, "#a7b2b5");
  art.circle(.5, .5, .09, colors.surfaceDark, "#a7b2b5");
}

/** Draw a replaceable chassis handle with attachment screws and an inset grip. */
function addHandle(art, colors) {
  art.rect(.08, .09, .84, .82, colors.surfaceDark, colors.ink, .2);
  art.rect(.27, .23, .46, .54, colors.surface, colors.ink, .12);
  art.line(.16, .19, .16, .81, "#a7b2b5");
  art.circle(.5, .15, .045, colors.ink);
  art.circle(.5, .85, .045, colors.ink);
}

/** Compose an AC or DC power supply from an inlet, grille, latch, handle, and status light. */
function addPowerSupply(art, component, colors) {
  art.rect(.015, .035, .97, .93, colors.surfaceDark, colors.ink, .04);
  art.rect(.04, .1, .92, .8, colors.surface, colors.ink, .02);
  if (component.variant === "dc-keyed3-inlet-right" || component.variant === "dc-recessed3-inlet-right") {
    addThreeContactDCSupply(art, component, colors);
    return;
  }
  if (component.orientation === "vertical" && (component.variant === "ac" || component.variant === "dc-terminal2")) {
    addVerticalPowerSupply(art, component, colors);
    return;
  }
  if (component.variant === "dc-keyed2" || component.variant === "dc-terminal2") {
    addTwoContactDCSupply(art, component, colors);
    return;
  }
  if (component.variant === "ac-fan-left" || component.variant === "ac-fan-right") {
    addFanPowerSupply(art, component.variant === "ac-fan-right", colors);
    return;
  }
  const inletOffset = component.variant === "ac-inlet-right" ? .49 : 0;
  const handleOffset = inletOffset ? -.71 : 0;
  art.rect(.11 + inletOffset, .23, .25, .54, "#0d1c21", colors.ink, .05);
  if (component.variant === "dc") {
    for (let index = 0; index < 3; index += 1) art.circle(.16 + index * .075, .5, .045, "#d7b76c", colors.ink);
  } else {
    for (const [cx, cy] of [[.235, .4], [.17, .62], [.3, .62]]) art.rect(cx + inletOffset - .012, cy - .055, .024, .11, "#b9c3c4");
  }
  for (let index = 0; index < 5; index += 1) art.rect((inletOffset ? .26 : .43) + index * (inletOffset ? .052 : .065), .25, .023, .5, colors.surfaceDark);
  art.rect(.81 + handleOffset, .19, .08, .62, colors.surfaceDark, colors.ink, .06);
  art.rect(.83 + handleOffset, .28, .035, .44, colors.surface, colors.ink, .02);
  art.circle(.94, .22, .035, component.active === false ? colors.surfaceDark : "#42d98b", colors.ink);
  if (component.variant !== "fixed") art.rect(.78 + handleOffset, .73, .08, .1, colors.accent, colors.ink, .02);
}

/** Draw three-contact DC modules with a retained metal inlet or a recessed keyed opening. */
function addThreeContactDCSupply(art, component, colors) {
  const recessed = component.variant === "dc-recessed3-inlet-right";
  for (let row = 0; row < 6; row++) {
    for (let column = 0; column < (recessed ? 6 : 4); column++) {
      art.rect(.075 + column * .082, .16 + row * .115, .055, .078, colors.surfaceDark, undefined, .012);
    }
  }
  art.rect(recessed ? .25 : .40, .12, .07, .76, "#a7b2b5", colors.ink, .035);
  art.line(recessed ? .27 : .42, .18, recessed ? .27 : .42, .82, "#d9dfe1");
  if (recessed) {
    art.rect(.65, .25, .20, .57, "#0d1c21", colors.ink, .005);
    art.rect(.675, .32, .145, .42, "#708389", undefined, .01);
    art.rect(.675, .56, .028, .10, "#0d1c21", undefined, 0);
  } else {
    art.rect(.625, .11, .22, .78, colors.surfaceDark, colors.ink, .02);
    for (const y of [.16, .84]) {
      art.circle(.735, y, .04, "#708389", colors.ink);
      art.line(.72, y, .75, y, "#d9dfe1");
    }
    art.rect(.65, .245, .17, .51, "#a7b2b5", colors.ink, .055);
    art.rect(.68, .29, .10, .42, "#0d1c21", undefined, .03);
    art.line(.68, .32, .70, .29, "#708389");
    art.line(.68, .68, .70, .71, "#708389");
    art.rect(.88, .53, .06, .35, "#a4662d", colors.ink, .012);
  }
  for (const [index, y] of (recessed ? [.41, .52, .63] : [.35, .50, .65]).entries()) {
    const radius = recessed ? .027 : index === 1 ? .048 : .033;
    art.circle(recessed ? .745 : .73, y, radius, "#b9c3c4", colors.ink);
    art.circle(recessed ? .745 : .73, y, radius * .42, "#0d1c21");
  }
  art.circle(recessed ? .58 : .12, recessed ? .18 : .13, .027,
    component.active === false ? colors.surfaceDark : "#42d98b", colors.ink);
}

/** Mirror the inlet, fan grille, and status light for horizontal AC supply variants. */
function addFanPowerSupply(art, fanRight, colors) {
  const offset = fanRight ? 1 : 0;
  const direction = fanRight ? -1 : 1;
  art.circle(offset + direction * .31, .48, .34, "#122327", "#a7b2b5");
  art.circle(offset + direction * .31, .48, .24, colors.surfaceDark, "#708389");
  art.line(offset + direction * .16, .19, offset + direction * .46, .76, "#a7b2b5");
  art.line(offset + direction * .16, .76, offset + direction * .46, .19, "#a7b2b5");
  art.rect(fanRight ? .12 : .61, .22, .27, .60, "#0d1c21", colors.ink, .05);
  for (const [cx, cy] of [[.745, .4], [.68, .62], [.81, .62]]) {
    art.rect(offset + direction * cx - .012, cy - .055, .024, .11, "#b9c3c4");
  }
  art.circle(fanRight ? .08 : .92, .86, .035, "#42d98b", colors.ink);
}

/** Draw upright AC or DC modules with the connector above the horizontal pull bar. */
function addVerticalPowerSupply(art, component, colors) {
  const dc = component.variant === "dc-terminal2";
  for (let row = 0; row < 5; row++) {
    for (const x of dc ? [.73, .81, .89] : [.10, .18, .82, .90]) {
      art.circle(x, .16 + row * .065, .017, colors.surfaceDark);
    }
  }
  if (dc) {
    for (const y of [.23, .45]) {
      art.rect(.21, y - .09, .30, .18, "#15252a", colors.ink, .015);
      art.circle(.36, y, .068, "#b9c3c4", colors.ink);
      art.line(.32, y, .40, y, colors.ink);
      art.line(.36, y - .024, .36, y + .024, colors.ink);
    }
    art.circle(.75, .50, .067, "#b9c3c4", colors.ink);
    art.line(.71, .50, .79, .50, colors.ink);
    art.line(.75, .476, .75, .524, colors.ink);
  } else {
    art.rect(.28, .18, .44, .35, "#0d1c21", colors.ink, .05);
    for (const [cx, cy] of [[.50, .28], [.39, .41], [.61, .41]]) {
      art.rect(cx - .022, cy - .035, .044, .07, "#b9c3c4");
    }
  }
  for (const y of [.56, .76]) {
    for (let column = 0; column < 8; column++) art.circle(.12 + column * .108, y, .017, colors.surfaceDark);
  }
  art.rect(.15, .62, .70, .10, colors.surfaceDark, colors.ink, .04);
  art.rect(.24, .643, .52, .054, colors.surface, colors.ink, .02);
  art.rect(.13, .81, .16, .09, colors.accent, colors.ink, .02);
  art.circle(.79, .83, .033, component.active === false ? colors.surfaceDark : "#42d98b", colors.ink);
}

/** Distinguish removable two-contact DC inlets from exposed terminal blocks and protective earth. */
function addTwoContactDCSupply(art, component, colors) {
  for (let row = 0; row < 2; row++) {
    for (let column = 0; column < 5; column++) {
      art.rect(.08 + column * .115, .12 + row * .12, .095, .085, colors.surfaceDark);
    }
  }
  if (component.variant === "dc-keyed2") {
    art.rect(.08, .43, .51, .39, "#0d1c21", colors.ink, .08);
    art.rect(.08, .49, .51, .27, "#132125", colors.ink, .06);
    art.rect(.30, .43, .07, .055, colors.surfaceDark);
    art.rect(.30, .765, .07, .055, colors.surfaceDark);
    for (const x of [.23, .44]) art.circle(x, .635, .032, "#b9c3c4", colors.ink);
  } else {
    for (const x of [.21, .46]) {
      art.rect(x - .10, .51, .20, .27, "#15252a", colors.ink, .015);
      art.circle(x, .65, .063, "#b9c3c4", colors.ink);
      art.line(x - .038, .65, x + .038, .65, colors.ink);
      art.line(x, .612, x, .688, colors.ink);
    }
    art.circle(.58, .23, .067, "#b9c3c4", colors.ink);
    art.line(.54, .23, .62, .23, colors.ink);
    art.line(.58, .19, .58, .27, colors.ink);
  }
  art.rect(.70, .12, .12, .75, colors.surfaceDark, colors.ink, .05);
  art.rect(.81, .77, .12, .09, colors.accent, colors.ink, .02);
  art.circle(.89, .22, .035, component.active === false ? colors.surfaceDark : "#42d98b", colors.ink);
}

/** Paint shared primitives without retaining changes to the caller's Canvas state. */
export function drawHardwareComponent(ctx, component, palette = {}) {
  const primitives = hardwarePrimitives(component, palette);
  ctx.save();
  for (const part of primitives) {
    ctx.globalAlpha = part.opacity ?? 1;
    if (part.fill) ctx.fillStyle = part.fill;
    if (part.stroke) ctx.strokeStyle = part.stroke;
    ctx.lineWidth = part.strokeWidth ?? 1;
    if (part.kind === "text") {
      ctx.font = `${part.fontSize}px ui-monospace, SFMono-Regular, Consolas, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(part.text, part.x, part.y);
      continue;
    }
    ctx.beginPath();
    if (part.kind === "rect") ctx.roundRect(part.x, part.y, part.width, part.height, part.rx);
    else if (part.kind === "circle") ctx.arc(part.cx, part.cy, part.r, 0, Math.PI * 2);
    else {
      ctx.moveTo(part.x1, part.y1);
      ctx.lineTo(part.x2, part.y2);
    }
    if (part.fill) ctx.fill();
    if (part.stroke) ctx.stroke();
  }
  ctx.restore();
}

/** Serialize the same hardware primitives as safe standalone SVG elements. */
export function hardwareComponentSVG(component, palette = {}) {
  return hardwarePrimitives(component, palette).map(primitiveSVG).join("");
}

/** Serialize one known primitive with geometry and styling escaped as attribute values. */
function primitiveSVG(part) {
  const attributes = { fill: part.fill ?? "none", stroke: part.stroke ?? "none",
    "stroke-width": part.strokeWidth ?? 0, opacity: part.opacity ?? 1 };
  if (part.kind === "rect") Object.assign(attributes, { x: part.x, y: part.y, width: part.width, height: part.height, rx: part.rx });
  else if (part.kind === "circle") Object.assign(attributes, { cx: part.cx, cy: part.cy, r: part.r });
  else if (part.kind === "line") Object.assign(attributes, { x1: part.x1, y1: part.y1, x2: part.x2, y2: part.y2 });
  else Object.assign(attributes, { x: part.x, y: part.y, "font-size": part.fontSize,
    "font-family": "ui-monospace, SFMono-Regular, Consolas, monospace", "text-anchor": part.anchor, "dominant-baseline": "central" });
  const serialized = Object.entries(attributes).map(([name, value]) => `${name}="${escapeXML(value)}"`).join(" ");
  return part.kind === "text" ? `<text ${serialized}>${escapeXML(part.text)}</text>` : `<${part.kind} ${serialized}/>`;
}

/** Escape markup delimiters for both SVG text and quoted attribute content. */
function escapeXML(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("'", "&#39;")
    .replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
