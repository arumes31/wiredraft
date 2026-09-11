/** Render only the inspected access-addition assemblies through the shared Canvas/SVG primitives. */
export function addAccessAdditionComponent(art, component) {
  const variant = component.variant;
  if (typeof variant !== "string" || !variant.startsWith("access-addition-")) return false;
  if (variant === "access-addition-body") art.rect(0, 0, 1, 1, component.color || "#c6c9c8");
  else if (variant === "access-addition-rack-ear") {
    art.rect(0, .015, 1, .97, "#aeb8ba");
    if (component.face === "front") for (const y of [.18, .70]) art.rect(.25, y, .50, .14, "#273438", undefined, .30);
  } else if (variant === "access-addition-honeycomb" || variant === "access-addition-fan-grille") {
    honeycomb(art, component);
  } else if (variant === "access-addition-screw") screw(art, .5, .5, .28);
  else if (variant === "access-addition-nim-cover") {
    art.rect(.01, .025, .98, .95, "#c3c8c8", "#879294", .06);
    for (const y of [.11, .74]) for (let i = 0; i < 18; i++) art.circle(.08 + i * .049, y, .027, "#425157");
    for (const x of [.06, .94]) screw(art, x, .49, .065);
  } else if (variant === "access-addition-pim-cover") {
    art.rect(.015, .025, .97, .84, "#c4c9c8", "#7a878a", .035);
    art.rect(.38, .84, .22, .13, "#a4afb0"); screw(art, .49, .89, .05);
  } else if (variant === "access-addition-m2-cover") {
    art.rect(.01, .03, .98, .94, "#a4afb0");
    for (const x of [.10, .90]) screw(art, x, .5, .23);
    for (let i = 0; i < 7; i++) art.circle(.3 + i * .065, .5, .08, "#4d5c61");
  } else if (variant === "access-addition-poe-input") {
    art.rect(.045, .04, .91, .92, "#969f9f", "#4c5a5e", .04);
    for (const y of [.30, .70]) for (const x of [.30, .70]) art.rect(x - .13, y - .13, .26, .26, "#1a282e");
  } else if (variant === "access-addition-ground") {
    for (const y of [.23, .77]) screw(art, .65, y, .20);
    art.circle(.18, .5, .07, "#56676c");
  } else if (variant === "access-addition-rocker") {
    art.rect(.08, .025, .84, .95, "#7f898c", "#4a585d", .055);
    art.rect(.23, .10, .54, .80, "#223338");
    art.line(.5, .22, .5, .37, "#c1ced0"); art.circle(.5, .68, .12, undefined, "#c1ced0");
  } else if (variant === "access-addition-lock") art.rect(.07, .15, .86, .70, "#1e3037", undefined, .3);
  else if (variant === "access-addition-rfid") art.rect(.1, .02, .80, .96, "#79858a");
  else if (variant === "access-addition-cisco-leds") {
    for (let i = 0; i < 3; i++) art.circle(.15 + i * .34, .5, .12, "#5a6869");
  } else if (variant === "access-addition-hp-strip") {
    art.rect(0, 0, 1, 1, "#304a5e");
    for (let i = 0; i < 3; i++) art.rect(.13, .29 + i * .11, .72, .04, "#738c93");
    art.label("hp", .5, .13, 5.5, "#dce5e7");
  } else if (variant === "access-addition-hp-badge") {
    art.rect(0, 0, 1, 1, "#32a8c9"); art.label("2530", .5, .5, 4, "#eff8fb");
  } else if (variant === "access-addition-hp-controls") {
    art.circle(.43, .48, .13, "#344c56");
    for (const x of [.13, .83]) for (const y of [.18, .43, .68]) art.rect(x - .055, y - .04, .11, .08, "#344c56");
    for (const x of [.18, .71]) art.circle(x, .90, .07, "#344c56");
  } else if (variant === "access-addition-office-led-matrix") {
    for (let row = 0; row < 2; row++) for (let col = 0; col < 12; col++) {
      const x = .025 + col * .082, y = .08 + row * .47;
      art.rect(x, y, .052, .37, "#565d5d");
      art.rect(x + .012, y + .08, .028, .055, "#bdc6c2");
      art.rect(x + .012, y + .27, .028, .055, "#bdc6c2");
    }
  } else if (variant === "access-addition-office-controls") {
    for (const y of [.14, .40, .9]) art.circle(.5, y, .07, "#e1e7e2");
  } else if (variant === "access-addition-tiny-mark") {
    art.rect(.1, .1, .14, .65, "#7f969e"); art.rect(.7, .1, .14, .65, "#263e4e");
  } else if (variant === "access-addition-rating-label") art.rect(.01, .02, .98, .96, "#dae0de");
  else return false;
  return true;
}

/** Draw a captive fastener with a bounded ring and central recess. */
function screw(art, x, y, radius) {
  art.circle(x, y, radius, "#a2adaf", "#63757b");
  art.circle(x, y, radius * .34, "#53656b");
}

/** Draw the source's perforated guard, keeping each hexagon inside the component envelope. */
function honeycomb(art, component) {
  const columns = Math.max(2, Math.floor(component.width / 4)), rows = Math.max(1, Math.floor(component.height / 4));
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
    const x = (col + .5) / columns, y = (row + .5) / rows, dx = .40 / columns, dy = .42 / rows;
    art.polygon([[x - dx, y], [x - dx / 2, y - dy], [x + dx / 2, y - dy], [x + dx, y],
      [x + dx / 2, y + dy], [x - dx / 2, y + dy]], "#394a50");
  }
}
