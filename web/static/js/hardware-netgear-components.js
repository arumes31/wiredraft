/** Draw only the observed NETGEAR assemblies, leaving all existing hardware variants untouched. */
export function addNetgearComponent(art, component, colors) {
  if (component.kind === "fan" && component.variant === "netgear-fixed-swept") {
    fixedFan(art, component, colors); return true;
  }
  if (component.kind === "fan" && component.variant === "netgear-m4500-tray") {
    fanTray(art, colors); return true;
  }
  if (component.kind === "psu" && ["netgear-aps550w", "netgear-m4500-ac"].includes(component.variant)) {
    supply(art, component, colors); return true;
  }
  return false;
}

/** Trace the three swept openings in the fixed M4300/M4350 rear fan cutouts without a removable frame. */
function fixedFan(art, component, colors) {
  const radius = Math.min(component.width, component.height) * .46;
  const rx = radius / component.width, ry = radius / component.height;
  for (let blade = 0; blade < 3; blade++) {
    const points = [];
    for (let step = 0; step <= 12; step++) {
      const angle = blade * Math.PI * 2 / 3 + step * Math.PI * .61 / 12;
      points.push([.5 + Math.cos(angle) * rx, .5 + Math.sin(angle) * ry]);
    }
    for (let step = 12; step >= 0; step--) {
      const angle = blade * Math.PI * 2 / 3 + step * Math.PI * .47 / 12 - .18;
      const scale = .43 + step / 12 * .33;
      points.push([.5 + Math.cos(angle) * rx * scale, .5 + Math.sin(angle) * ry * scale]);
    }
    art.polygon(points, "#101517");
  }
}

/** Trace an M4500 tray's honeycomb, left release tab, bottom status lens and separate metal frame. */
function fanTray(art, colors) {
  art.rect(.025, .035, .95, .93, "#41474b", "#879297", .01);
  art.rect(.21, .09, .70, .80, "#0b1113", "#647277", .005);
  for (let row = 0; row < 7; row++) for (let column = 0; column < 5; column++) {
    const cx = .275 + column * .123 + (row % 2) * .055;
    const cy = .155 + row * .102;
    art.polygon([[cx - .052, cy], [cx - .026, cy - .046], [cx + .026, cy - .046],
      [cx + .052, cy], [cx + .026, cy + .046], [cx - .026, cy + .046]], "#0b1113", "#566166");
  }
  art.rect(.045, .25, .045, .44, "#d84330", "#932e21", .015);
  art.rect(.115, .84, .025, .05, colors.surfaceDark, "#a6afb3", .005);
}

/** Trace the selected AC supply's inlet, diagonal fan supports, retainer, latch and status lenses. */
function supply(art, component, colors) {
  const rightFan = component.variant === "netgear-m4500-ac";
  art.rect(.025, .045, .95, .91, "#6e787d", "#17262d", .02);
  const fanX = rightFan ? .70 : .30;
  const inletX = rightFan ? .15 : .66;
  const radius = Math.min(component.width * .22, component.height * .38);
  art.circle(fanX, .47, radius / Math.min(component.width, component.height), "#141b1e", "#adb6b9");
  art.circle(fanX, .47, radius * .56 / Math.min(component.width, component.height), "#879094", "#4e5e65");
  for (const [dx, dy] of [[-.16, -.29], [.16, -.29], [-.16, .29], [.16, .29]]) {
    art.line(fanX + dx, .47 + dy, fanX + dx * .36, .47 + dy * .36, "#b1babc", 2);
  }
  art.polygon([[inletX, .24], [inletX + .25, .24], [inletX + .28, .32], [inletX + .28, .69],
    [inletX + .23, .75], [inletX + .01, .75], [inletX - .015, .69], [inletX - .015, .33]], "#0b1113", "#3c464a");
  for (const [dx, y] of [[.065, .43], [.185, .43], [.125, .60]]) art.rect(inletX + dx, y, .033, .04, "#d5d7d4", undefined, 0);
  art.rect(rightFan ? .085 : .905, .20, .045, .57, "#ec7427", "#a6501f", .015);
  for (const x of rightFan ? [.50, .89] : [.08, .51]) {
    art.circle(x, .82, .046, "#b1b9ba", "#3d494e");
    art.line(x - .017, .82, x + .017, .82, "#3d494e");
  }
  art.line(rightFan ? .54 : .07, .14, rightFan ? .88 : .51, .14, "#252e32", 2);
  if (rightFan) {
    art.line(.225, .25, .16, .36, "#e06522", 1.2);
    art.line(.16, .36, .17, .67, "#e06522", 1.2);
    art.line(.17, .67, .33, .70, "#e06522", 1.2);
    for (const y of [.64, .74, .84]) art.circle(.055, y, .02, colors.surfaceDark, "#b1b9ba");
  } else for (const x of [.76, .84]) art.circle(x, .84, .025, colors.surfaceDark, "#b1b9ba");
}
