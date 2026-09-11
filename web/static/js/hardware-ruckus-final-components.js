/** Draw only these source-specific Ruckus assemblies and the observed portrait USB-C connector. */
export function addRuckusFinalComponent(art, component, colors) {
  if (component.kind === "ruckus-usbc-vertical") {
    art.rect(.10, .035, .80, .93, "#17272e", "#b4bfc1", .40);
    art.rect(.42, .16, .16, .68, "#78888d", "#c1c8c9", .06);
    for (let index = 0; index < 4; index++) art.rect(.44, .22 + index * .15, .12, .045, "#c5b581");
  } else if (component.variant === "ruckus-final-fan12") fanTray(art, false);
  else if (component.variant === "ruckus-final-fan13") fanTray(art, true);
  else if (component.variant === "ruckus-final-rps19") supply19(art);
  else if (component.variant === "ruckus-final-rps23") supply23(art, component);
  else if (component.variant === "ruckus-final-grille") grille(art, .015, .12, .97, .76, 44, 2);
  else if (component.variant === "ruckus-final-handle") art.rect(.10, .04, .80, .92, "#bbc5c7", colors.ink, .035);
  else if (component.variant === "ruckus-final-poe") art.rect(.01, .08, .98, .84, "#dac030");
  else if (component.variant === "ruckus-final-status") {
    for (let index = 0; index < 8; index++) art.circle(.04 + index * .098, .38, .027, "#657f53", "#2e3c35");
    art.rect(.86, .10, .10, .72, "#1f3036", "#8c9b9f", .025);
  } else return false;
  return true;
}

/** Approximate the observed perforated metal with bounded openings, without inventing fan rotors. */
function grille(art, x, y, width, height, columns, rows) {
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) art.rect(
    x + column * width / columns, y + row * height / rows, width / columns * .60, height / rows * .60, "#2d3d44");
}

/** Trace FAN12/FAN13 perforated faces with a horizontal lower pull bar and right retaining tab. */
function fanTray(art, fan13) {
  art.rect(.035, .025, .93, .95, "#a2adaf", "#405058", .025);
  grille(art, .10, .09, .71, .75, 7, 7);
  art.rect(.085, fan13 ? .73 : .62, .71, .075, "#c0c9cb", "#52636a", .025);
  art.rect(.84, .32, .11, .24, "#b6c1c3", "#596970", .02);
  art.circle(.89, .43, .038, "#d4dbdc", "#45555d");
}

/** Draw the observed horizontal AC inlet, top vent strip and left handle of RPS19-E; its fan is not exposed on this face. */
function supply19(art) {
  art.rect(.025, .025, .95, .95, "#a9b3b6", "#40515a", .025);
  grille(art, .31, .09, .57, .15, 8, 2);
  art.rect(.08, .12, .13, .74, "#c2cccd", "#53656d", .025);
  art.rect(.33, .30, .57, .53, "#d1d8d9", "#586870", .08);
  art.polygon([[.39, .39], [.82, .39], [.86, .46], [.86, .68], [.81, .75], [.39, .75]], "#203139", "#d5dcdd");
  for (const [x, y] of [[.46, .52], [.72, .52], [.59, .65]]) art.rect(x, y, .035, .07, "#ccbc85");
  art.circle(.25, .14, .026, "#738e60", "#3b503f");
}

/** Trace RPS23-E's left circular fan, right portrait AC inlet and retaining handle using source proportions. */
function supply23(art, component) {
  art.rect(.025, .025, .95, .95, "#abb5b7", "#41545b", .025);
  const radius = Math.min(component.width * .19, component.height * .34);
  const rx = radius / component.width, ry = radius / component.height;
  art.circle(.26, .49, radius / Math.min(component.width, component.height), "#64767c", "#cbd3d4");
  for (let index = 0; index < 6; index++) {
    const angle = index * Math.PI / 3;
    art.line(.26 + Math.cos(angle) * rx * .25, .49 + Math.sin(angle) * ry * .25,
      .26 + Math.cos(angle + .50) * rx * .88, .49 + Math.sin(angle + .50) * ry * .88, "#ced6d7");
  }
  art.circle(.26, .49, .035, "#b9c5c7", "#33474f");
  art.rect(.56, .16, .27, .69, "#d0d7d8", "#52676e", .04);
  art.polygon([[.59, .29], [.64, .22], [.75, .22], [.80, .29], [.80, .76], [.59, .76]], "#1e3038", "#cdd7d9");
  for (const [x, y] of [[.625, .42], [.74, .42], [.682, .62]]) art.rect(x, y, .025, .08, "#c6b785");
  art.rect(.51, .11, .035, .64, "#bfcacd", "#60757c", .02);
  art.rect(.52, .11, .32, .05, "#bfcacd", "#60757c", .02);
  art.circle(.91, .79, .038, "#cbd4d6", "#47616a");
}
