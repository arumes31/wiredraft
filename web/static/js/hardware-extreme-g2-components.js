/** Draw only the observed G2 assemblies and the inverted lower optical apertures. */
export function addExtremeG2Component(art, component, colors) {
  if (["extreme-sfp-inverted", "extreme-qsfp-inverted"].includes(component.kind)) opticalInverted(art, component.kind);
  else if (component.variant === "extreme-g2-fan10945") fanModule(art, component);
  else if (component.variant === "extreme-g2-psu10951") powerSupply(art);
  else if (component.variant === "extreme-g2-c14") inlet(art, false);
  else if (component.variant === "extreme-g2-rps") redundantInput(art);
  else if (component.variant === "extreme-g2-combo-mark") art.rect(.015, .08, .97, .84, "#d9d339");
  else if (component.variant === "extreme-g2-cover") {
    art.rect(.025, .035, .95, .93, "#aab3b7", "#56666c", .025);
    for (const x of [.08, .92]) art.circle(x, .23, .032, "#c2cdcf", "#53676e");
  } else if (component.variant === "extreme-g2-grille") grille(art, .05, .06, .90, .88, component.width < component.height ? 2 : 32, component.width < component.height ? 6 : 1);
  else if (component.variant === "extreme-g2-stack-number") {
    art.rect(.08, .08, .84, .84, "#1a292e", "#96a4a7", .035);
    for (const y of [.25, .50, .75]) art.line(.35, y, .66, y, "#73856e");
    for (const [x, y] of [[.31, .28], [.31, .54], [.70, .28], [.70, .54]]) art.line(x, y, x, y + .18, "#73856e");
  } else if (component.variant === "extreme-g2-status") {
    for (let index = 0; index < 6; index++) art.rect(.045 + index * .15, .20, .08, .55, "#819364", colors.ink, .025);
  } else return false;
  return true;
}

/** Mirror the lower optical cage key and contact area to match the face-to-face source orientation. */
function opticalInverted(art, kind) {
  art.rect(.035, .05, .93, .90, "#1b2d34", "#b1bdc0", .05);
  art.rect(.10, .26, .80, .56, "#192b32", "#a7b2b5", .02);
  art.line(.15, .72, .85, .72, "#74878d", .7);
  art.rect(.27, .13, .46, .13, "#515e62", "#a7b2b5", .02);
  for (let index = 0; index < (kind.includes("qsfp") ? 4 : 2); index++) art.line(.18 + index * .16, .29, .18 + index * .16, .39, "#d7b76c");
}

/** Represent an observed perforated section with a bounded regular grid. */
function grille(art, x, y, width, height, columns, rows) {
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) art.rect(
    x + column * width / columns, y + row * height / rows, width / columns * .55, height / rows * .55, "#34444b");
}

/** Trace the three circular protective grilles in one10945 tray and its lower pull handle. */
function fanModule(art, component) {
  art.rect(.015, .035, .97, .93, "#aeb9bc", "#4b5e65", .025);
  const radius = Math.min(component.width * .145, component.height * .38);
  for (const cx of [.18, .50, .82]) {
    for (const factor of [1, .78, .56]) art.circle(cx, .48, radius * factor / Math.min(component.width, component.height), undefined, "#586c74");
    for (let index = 0; index < 6; index++) {
      const angle = index * Math.PI / 3;
      art.line(cx + Math.cos(angle) * radius * .48 / component.width, .48 + Math.sin(angle) * radius * .48 / component.height,
        cx + Math.cos(angle) * radius / component.width, .48 + Math.sin(angle) * radius / component.height, "#687e86");
    }
  }
  art.rect(.34, .77, .34, .085, "#c3ced0", "#556971", .025);
  for (const x of [.05, .95]) for (const y of [.12, .88]) art.circle(x, y, .035, "#c3cdcf", "#455d65");
}

/** Draw the selected AC inlet; C16 adds its required lower-center key instead of pretending to be C14. */
function inlet(art, keyed) {
  art.rect(.04, .07, .92, .86, "#a7b3b7", "#4b6068", .08);
  art.polygon([[.15, .29], [.27, .15], [.73, .15], [.85, .29], [.85, .82], [.15, .82]], "#1d3038", "#d0dadb");
  for (const [x, y] of [[.32, .49], [.62, .49], [.47, .29]]) art.rect(x, y, .055, .18, "#c3cfd0");
  if (keyed) art.rect(.445, .70, .11, .13, "#aab8bc", "#ced7d9", .01);
}

/** Trace10951's perforated fan at left, C16 inlet at right, green latch and status lights. */
function powerSupply(art) {
  art.rect(.02, .035, .96, .93, "#aeb8bc", "#4d626a", .025);
  grille(art, .06, .17, .35, .68, 7, 6);
  art.rect(.50, .15, .43, .67, "#a7b3b7", "#4b6068", .05);
  art.polygon([[.55, .30], [.62, .22], [.82, .22], [.89, .30], [.89, .73], [.55, .73]], "#1d3038", "#d0dadb");
  for (const [x, y] of [[.63, .45], [.79, .45], [.71, .31]]) art.rect(x, y, .035, .13, "#c3cfd0");
  art.rect(.69, .64, .07, .10, "#aab8bc", "#ced7d9", .01);
  art.rect(.44, .09, .035, .76, "#7e9b66", "#496842", .015);
  for (const x of [.13, .25]) art.circle(x, .105, .023, "#72965c", "#38523d");
}

/** Trace the source's two-row18-contact redundant-power receptacle without inventing an installed external supply. */
function redundantInput(art) {
  art.rect(.02, .04, .96, .92, "#b3bec1", "#536970", .04);
  art.rect(.29, .07, .34, .17, "#566b74", "#425a64", .02);
  art.rect(.13, .33, .74, .56, "#30444d", "#d0dadc", .02);
  for (let row = 0; row < 2; row++) for (let column = 0; column < 9; column++) art.rect(.17 + column * .074, .40 + row * .22, .045, .13, "#cbd4d7", "#526970", .005);
  for (const x of [.075, .925]) art.circle(x, .68, .035, "#d2dcde", "#56717a");
}
