/** Render only the observed X465/X590/X690 assemblies and opposite-facing lower optical cages. */
export function addExtremeNextComponent(art, component, colors) {
  if (component.kind === "extreme-next-sfp-inverted" || component.kind === "extreme-next-qsfp-inverted") opticalInverted(art, component.kind);
  else if (component.variant === "extreme-next-fan17115") fan17115(art);
  else if (component.variant === "extreme-next-fan002") fan002(art);
  else if (component.variant === "extreme-next-psu10960") supply10960(art);
  else if (component.variant === "extreme-next-psu10941") supply10941(art);
  else if (component.variant === "extreme-next-grille") grille(art, .025, .08, .95, .84, component.width > component.height * 4 ? 36 : 5, component.width > component.height * 4 ? 1 : 3);
  else if (component.variant === "extreme-next-status") {
    for (let i = 0; i < 6; i++) art.rect(.025 + i * .16, .18, .09, .52, "#8ea475", colors.ink, .025);
  } else if (component.variant === "extreme-next-vim-rail") {
    art.rect(.08, .025, .84, .95, "#655078", "#acabb3", .02);
    grille(art, .23, .30, .55, .60, 1, 4);
    art.circle(.5, .18, .13, "#adb4b8", "#485a64");
  } else if (component.variant === "extreme-next-cover" || component.variant === "extreme-next-permanent-cover") {
    art.rect(.025, .035, .95, .93, "#a6abb2", "#4e5965", .025);
    for (const x of [.075, .925]) art.circle(x, .20, .034, "#c2c9cd", "#4d5e67");
    if (component.variant === "extreme-next-permanent-cover") {
      art.rect(.08, .18, .84, .67, "#e9e9e6", "#8e959b", .015);
      art.polygon([[.14, .31], [.19, .49], [.09, .49]], "#d9c641", "#6b673e");
      art.label("COVERED", .53, .52, 5.5);
    }
  } else return false;
  return true;
}

/** Keep lower SFP/QSFP release keys and contacts opposite the upper cage, as shown by the VIM and source uplink drawings. */
function opticalInverted(art, kind) {
  art.rect(.035, .05, .93, .90, "#1b2d34", "#b1bdc0", .05);
  art.rect(.10, .26, .80, .56, "#192b32", "#a7b2b5", .02);
  art.line(.15, .72, .85, .72, "#74878d", .7);
  art.rect(.27, .13, .46, .13, "#515e62", "#a7b2b5", .02);
  for (let i = 0; i < (kind.includes("qsfp") ? 4 : 2); i++) art.line(.18 + i * .16, .29, .18 + i * .16, .39, "#d7b76c");
}

/** Simplify source honeycomb/perforated regions into bounded dark apertures without invented rotor blades. */
function grille(art, x, y, width, height, columns, rows) {
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) art.rect(
    x + column * width / columns, y + row * height / rows, width / columns * .60, height / rows * .60, "#36434b");
}

/** Trace17115 honeycomb tray, horizontal midline pull and opposite corner fasteners. */
function fan17115(art) {
  art.rect(.025, .025, .95, .95, "#adb6bb", "#4c606a", .025);
  grille(art, .20, .10, .65, .79, 6, 8);
  art.rect(.085, .43, .81, .13, "#c0c9cc", "#465c66", .04);
  for (const [x, y, radius] of [[.12, .13, .045], [.88, .87, .045], [.86, .14, .080]]) art.circle(x, y, radius, "#ced3d6", "#56646b");
}

/** Trace the distinct XN-FAN-002-F rectangular grate, left pull handle and right fastener/latch strip. */
function fan002(art) {
  art.rect(.025, .025, .95, .95, "#685776", "#a7a5ae", .025);
  grille(art, .15, .12, .54, .73, 5, 7);
  art.rect(.105, .30, .085, .46, undefined, "#b0b4bb", .02);
  art.rect(.79, .07, .09, .055, "#bcbe51");
  for (const y of [.22, .76]) art.circle(.83, y, .055, "#adb3b7", "#495861");
}

/** Trace10960 with vertical C14 at right, visible fan grid at left and lower-right green release latch. */
function supply10960(art) {
  art.rect(.025, .025, .95, .95, "#afb5b9", "#53606a", .025);
  art.rect(.14, .12, .27, .76, "#303f48", "#87949a", .025);
  for (let i = 0; i < 3; i++) art.line(.14, .30 + i * .19, .41, .30 + i * .19, "#aeb7bc");
  art.line(.28, .13, .28, .87, "#aeb7bc");
  art.rect(.48, .09, .43, .76, "#b1b7bc", "#596873", .025);
  art.polygon([[.59, .19], [.79, .19], [.85, .28], [.85, .72], [.59, .72], [.53, .63], [.53, .28]], "#1d2b31", "#d2d9dc");
  for (const [x, y] of [[.71, .31], [.61, .46], [.71, .60]]) art.rect(x, y, .07, .025, "#cad4d7");
  art.rect(.88, .51, .075, .41, "#9abd50", "#5c772f", .015);
  art.circle(.09, .16, .035, "#8b9d69", "#4f6159");
}

/** Trace the selected10941 fan-left/C16-right face with its required lower-center key and two status lenses. */
function supply10941(art) {
  art.rect(.025, .035, .95, .93, "#aab2b8", "#4c5f6a", .025);
  grille(art, .065, .16, .32, .69, 6, 6);
  art.rect(.43, .12, .04, .73, "#829d5f", "#536e43", .015);
  art.rect(.53, .16, .40, .66, "#b2bdc1", "#4e626b", .05);
  art.polygon([[.57, .32], [.63, .23], [.82, .23], [.88, .32], [.88, .72], [.57, .72]], "#23343c", "#d1dade");
  for (const [x, y] of [[.64, .43], [.79, .43], [.71, .30]]) art.rect(x, y, .035, .13, "#ced7da");
  art.rect(.69, .64, .07, .09, "#b6c0c5", "#d2dade", .01);
  for (const x of [.13, .26]) art.circle(x, .10, .026, "#83a46d", "#3e5f48");
}
