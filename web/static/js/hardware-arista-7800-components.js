/** Dispatch only the individually inspected7804R3 housings and installed dual-input supply. */
export function addArista7800Component(art, component, colors) {
  const variant = component.variant;
  if (variant === "arista-7804r3-fabric") fabric(art, component, colors);
  else if (variant === "arista-7800-d1-ac") supply(art, component, colors);
  else if (variant === "arista-7800-mesh") mesh(art, component, .03, .03, .94, .94);
  else if (variant === "arista-7800-triangles") triangles(art);
  else if (variant === "arista-7800-cover") cover(art, component, colors);
  else if (variant === "arista-7800-lock") lock(art, colors);
  else if (variant === "arista-7800-tool") { art.rect(.02, .18, .96, .64, "#b4433a", "#742929", .25); art.circle(.50, .50, .13, "#b7b8ad", "#704840"); }
  else if (variant === "arista-7800-status") { for (let i = 0; i < 6; i++) { art.rect(.04 + i * .17, .12, .065, .14, "#365b79"); art.circle(.075 + i * .17, .73, .035, "#57684e", "#263e35"); } }
  else return false;
  return true;
}

/** Draw protective hexagonal perforations without inventing visible internal fan rotors. */
function mesh(art, component, x, y, width, height) {
  art.rect(x, y, width, height, "#222b30");
  const columns = Math.max(2, Math.min(25, Math.floor(component.width * width / 4)));
  const dx = width / (columns + .5), target = dx * component.width / component.height;
  const rows = Math.max(2, Math.min(55, Math.floor(height / target))), dy = height / rows;
  const rx = Math.min(dx * .40, dy * component.height / component.width * .40), ry = rx * component.width / component.height;
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
    const cx = x + (col + .5 + (row % 2) * .5) * dx, cy = y + (row + .5) * dy;
    art.polygon(Array.from({ length: 6 }, (_, i) => [cx + Math.cos(i * Math.PI / 3) * rx, cy + Math.sin(i * Math.PI / 3) * ry]), "#222b30", "#909c9f");
  }
}

/** Trace the7804 lower rear grille's alternating triangular perforated regions. */
function triangles(art) {
  art.rect(.01, .04, .98, .92, "#a3afb2", "#23383f", .005);
  for (let i = 0; i < 9; i++) {
    const left = .022 + i * .106;
    art.polygon(i % 2 ? [[left, .13], [left + .096, .13], [left + .048, .87]]
      : [[left, .87], [left + .096, .87], [left + .048, .13]], "#263239");
  }
}

/** Show a fitted blanking plate without assigning it unverified network hardware. */
function cover(art, component, colors) {
  art.rect(.025, .04, .95, .92, "#9da9ac", colors.ink, .012);
  art.line(.05, .11, .95, .11, "#c7d0d2"); art.line(.05, .88, .95, .88, "#65777d");
  art.label(component.label, .50, .50, 5);
}

/** Trace the blue quarter-turn chassis lock surrounding its circular extraction-tool opening. */
function lock(art, colors) {
  art.rect(.08, .035, .84, .93, "#a7b1b5", colors.ink, .025);
  art.rect(.55, .12, .18, .76, "#2f5877");
  art.circle(.5, .5, .35, "#bbc4c6", "#263840"); art.circle(.5, .5, .23, "#14232a", "#71838b");
}

/** Trace the exact R3 fabric's grille, side rails, paired retention screws and top/bottom ejector handles. */
function fabric(art, component, colors) {
  art.rect(.035, .015, .93, .97, "#a7b3b7", colors.ink, .008);
  mesh(art, component, .11, .072, .78, .85);
  for (const x of [.055, .91]) art.rect(x, .055, .025, .89, "#ced5d7", "#4a5d65", .004);
  for (const y of [.235, .84]) {
    art.rect(.085, y, .83, .043, "#b8c2c5", "#405660", .008);
    art.rect(.23, y + .013, .54, .012, "#5e747e");
  }
  for (const y of [.405, .635]) {
    art.rect(.13, y + .055, .74, .030, "#171e23");
    art.rect(.20, y + .058, .10, .022, "#cebd44");
    art.circle(.48, y, .105, "#b6c0c2", "#344a54");
    art.line(.425, y, .535, y, "#293c45"); art.line(.48, y - .02, .48, y + .02, "#293c45");
  }
  for (const y of [.16, .32, .43, .64, .80]) art.circle(.81, y, .035, "#5d7957", "#374b3b");
  art.rect(.83, .037, .045, .028, "#5d925c");
  art.label(component.label, .50, .044, 5); art.label("BOTTOM", .50, .951, 4);
}

/** Rotate source supply coordinates counterclockwise into the vertically installed7804 front bay. */
function verticalSupply(art) {
  return {
    /** Rotate rectangular housings while retaining the primitive builder's bounded stroke. */
    rect(x, y, w, h, ...style) { art.rect(y, 1 - x - w, h, w, ...style); },
    /** Rotate one polygon through the same installation transform. */
    polygon(points, ...style) { art.polygon(points.map(([x, y]) => [y, 1 - x]), ...style); },
    /** Rotate a status lens without changing its circular radius. */
    circle(x, y, r, ...style) { art.circle(y, 1 - x, r, ...style); },
  };
}

/** Trace two SAF-D-GRID400 inputs, the central blue handle and three input/output status lenses. */
function supply(art, component, colors) {
  const face = verticalSupply(art);
  face.rect(.025, .025, .95, .95, "#9da9ac", colors.ink, .015);
  for (let row = 0; row < 4; row++) for (let col = 0; col < 8; col++) face.rect(.075 + col * .105, .07 + row * .057, .07, .025, "#26343b");
  for (const left of [.055, .535]) {
    face.rect(left, .39, .41, .55, "#171e23", "#617077", .025);
    face.polygon([[left + .07, .45], [left + .34, .45], [left + .38, .84], [left + .03, .84]], "#080f14", "#9ca7aa");
    face.polygon([[left + .15, .55], [left + .26, .55], [left + .26, .64], [left + .31, .69], [left + .31, .75],
      [left + .23, .75], [left + .23, .86], [left + .18, .86], [left + .18, .75], [left + .10, .75], [left + .10, .69], [left + .15, .64]], "#253137", "#8f9ca2");
  }
  face.rect(.465, .045, .066, .88, "#28567e", "#162e47", .09);
  face.rect(.69, .026, .23, .055, "#b9c4c7", "#3d525d", .015);
  for (let i = 0; i < 3; i++) face.circle(.13, .095 + i * .075, .025, "#657854", "#395244");
  art.label(component.label, .50, .90, 4);
}
