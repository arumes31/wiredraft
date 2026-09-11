/** Dispatch only source-traced modular Arista housings, leaving all completed variants unchanged. */
export function addAristaModularComponent(art, component, colors) {
  const variant = component.variant || "";
  if (!variant.startsWith("arista-")) return false;
  if (["arista-3kt-blue", "arista-3kt-red"].includes(variant)) supply3kt(art, component, colors);
  else if (variant === "arista-7304x3-fabric") fabric7304(art, component, colors);
  else if (variant === "arista-7504r3-fabric") fabric7504(art, component, colors);
  else if (variant === "arista-modular-mesh") mesh(art, component, .02, .04, .96, .92);
  else if (variant === "arista-modular-blank") blank(art, component, colors);
  else if (["arista-7300-status", "arista-7500-status", "arista-7504-status"].includes(variant)) status(art, component);
  else if (variant === "arista-mcx") {
    art.circle(.5, .5, .44, "#a89459", "#56636a"); art.circle(.5, .5, .28, "#111b20", "#c7b679");
    art.circle(.5, .5, .10, "#b4a36c");
  } else return false;
  return true;
}

/** Draw visible hexagonal openings with their aspect preserved through saved proportional chassis fits. */
function mesh(art, component, x, y, width, height) {
  art.rect(x, y, width, height, "#172024", undefined, 0);
  const columns = Math.max(4, Math.min(34, Math.floor(component.width * width / 4)));
  const dx = width / (columns + .5), dyTarget = dx * component.width / component.height;
  const rows = Math.max(2, Math.min(45, Math.floor(height / dyTarget))), dy = height / rows;
  const rx = Math.min(dx * .44, dy * component.height / component.width * .44), ry = rx * component.width / component.height;
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    const cx = x + (column + .5 + (row % 2) * .5) * dx, cy = y + (row + .5) * dy;
    art.polygon(Array.from({ length: 6 }, (_, i) => [cx + Math.cos(i * Math.PI / 3) * rx,
      cy + Math.sin(i * Math.PI / 3) * ry]), "#172024", "#929d9f");
  }
}

/** Represent an installed cover, its edge retainers and centered slot identification. */
function blank(art, component, colors) {
  art.rect(.025, .035, .95, .93, "#aab4b8", colors.ink, .015);
  art.line(.03, .12, .97, .12, "#d7dfe0"); art.line(.03, .88, .97, .88, "#707c82");
  art.rect(.025, .34, .018, .32, "#d4dadb", colors.ink, .01);
  art.rect(.957, .34, .018, .32, "#d4dadb", colors.ink, .01);
  art.label(component.label || "COVER", .5, .50, 5);
}

/** Draw the exact observed status lens banks without depicting live operating state. */
function status(art, component) {
  const vertical = component.variant === "arista-7504-status";
  const count = vertical ? 4 : 6;
  for (let i = 0; i < count; i++) {
    const x = vertical ? (i % 2 ? .70 : .25) : .055 + i * .175;
    const y = vertical ? (.20 + Math.floor(i / 2) * .52) : .60;
    art.circle(x, y, vertical ? .105 : .055, "#596c59", "#253b36");
  }
}

/** Trace a 7304X3 fabric's two separately replaceable, top-handle FAN-7002H housings and concealed electronics. */
function fabric7304(art, component, colors) {
  art.rect(.025, .015, .95, .97, "#9ca9ae", colors.ink, .008);
  art.label(component.label, .5, .075, 5);
  for (const y of [.19, .53]) {
    art.rect(.06, y, .86, .29, "#c5cdcf", colors.ink, .008);
    mesh(art, component, .085, y + .012, .80, .265);
    art.rect(.33, y + .012, .40, .055, "#a53635", "#6a272d", .018);
    art.rect(.45, y + .14, .070, .025, "#719759", "#d2d9ce", .003);
  }
  art.rect(.935, .12, .032, .76, "#d6dcdd", "#4e5f66", .008);
  art.rect(.115, .91, .70, .027, "#c4ccce", "#667980", .008);
  art.circle(.095, .095, .022, "#65765e", "#31453d");
}

/** Trace the installed 7504R3 fabric's full protective grille, left extraction rail and angled end handles. */
function fabric7504(art, component, colors) {
  art.rect(.025, .01, .95, .98, "#acb7ba", colors.ink, .012);
  mesh(art, component, .19, .07, .73, .86);
  art.rect(.055, .06, .12, .88, "#26343b", "#111e25", .012);
  art.polygon([[.07, .025], [.90, .025], [.47, .13], [.18, .13]], "#29373e", "#102227");
  art.polygon([[.07, .975], [.90, .975], [.47, .87], [.18, .87]], "#29373e", "#102227");
  art.rect(.40, .42, .18, .065, "#b3bdc0", "#61757e", .005);
  art.circle(.46, .44, .025, "#647d51", "#465c45"); art.circle(.52, .465, .025, "#526d73", "#41585b");
  art.circle(.11, .04, .040, "#344952", "#14272f"); art.circle(.11, .96, .040, "#344952", "#14272f");
  art.label(component.label, .5, .82, 4);
}

/** Rotate the documented portrait PSU face to the observed front-blue/rear-red installation orientation. */
function rotatedSupplyArt(art, clockwise) {
  return {
    /** Rotate a rectangle while preserving the primitive builder's bounded stroke and radius contract. */
    rect(x, y, w, h, ...style) { art.rect(clockwise ? 1 - y - h : y, clockwise ? x : 1 - x - w, h, w, ...style); },
    /** Rotate a lens center while retaining its circular radius. */
    circle(x, y, radius, ...style) { art.circle(clockwise ? 1 - y : y, clockwise ? x : 1 - x, radius, ...style); },
    /** Rotate socket and latch polygons in normalized face coordinates. */
    polygon(points, ...style) { art.polygon(points.map(([x, y]) => clockwise ? [1 - y, x] : [y, 1 - x]), ...style); },
  };
}

/** Trace PWR-3KT-AC's square grille, colored release tab, three status lenses and keyed C20 inlet. */
function supply3kt(art, component, colors) {
  const blue = component.variant === "arista-3kt-blue", face = rotatedSupplyArt(art, !blue);
  face.rect(.025, .025, .95, .95, "#aeb7ba", colors.ink, .02);
  face.rect(.065, .075, .87, .61, "#302d24", "#777c77", .004);
  for (let i = 0; i <= 11; i++) face.rect(.085 + i * .070, .10, .011, .55, "#b6b5a6", undefined, 0);
  for (let i = 0; i <= 10; i++) face.rect(.085, .10 + i * .054, .79, .009, "#b6b5a6", undefined, 0);
  face.rect(.075, .048, .85, .10, "#252e33", colors.ink, .01);
  face.rect(.095, .12, .24, .038, blue ? "#2d6693" : "#b43149", "#20303a", .005);
  face.rect(.075, .61, .85, .12, "#293239", colors.ink, .006);
  face.rect(.37, .725, .48, .225, "#151d23", "#64737b", .03);
  for (const [x, y] of [[.49, .785], [.68, .785], [.585, .865]]) face.rect(x, y, .055, .014, "#c0b188", undefined, .002);
  for (let i = 0; i < 3; i++) face.circle(.15, .765 + i * .074, .033, "#60754f", "#2f443c");
  art.label(component.label || "AC", .5, .92, 4);
}
