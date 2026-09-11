/** Draw only the source-specific7450 parts, preserving every existing hardware variant. */
export function addRuckusNextComponent(art, component, colors) {
  if (component.variant === "ruckus-7450-fan") fanTray(art);
  else if (component.variant === "ruckus-7450-psu") powerSupply(art);
  else if (component.variant === "ruckus-7450-module-upper") {
    art.rect(.02, .08, .96, .80, "#9aa5aa", colors.ink, .03);
    art.rect(.04, .15, .60, .15, "#45535a"); art.circle(.89, .32, .065, "#2e363a", "#c5cecf");
  } else if (component.variant === "ruckus-7450-handle") art.rect(.08, .08, .84, .84, "#bdc5c6", "#566269", .03);
  else if (component.variant === "ruckus-7450-poe") art.rect(.01, .05, .98, .90, "#dcc326");
  else if (component.variant === "ruckus-7450-grille") grille(art, .01, .05, .98, .90, 55, 2);
  else if (component.variant === "ruckus-7450-status") {
    for (let index = 0; index < 7; index++) art.circle(.06 + index * .105, .30, .025, "#637b53", "#24372b");
    art.rect(.84, .08, .12, .74, "#162229", "#818f93"); art.line(.915, .21, .915, .63, "#91b37a");
  } else return false;
  return true;
}

/** Draw the observed rectangular perforations without representing additional internal fans. */
function grille(art, x, y, width, height, columns, rows) {
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) art.rect(
    x + column * width / columns, y + row * height / rows, width / columns * .55, height / rows * .55, "#293840");
}

/** Trace the FAN10-E perforated tray, vertical pull bar and upper latch from the rear figure. */
function fanTray(art) {
  art.rect(.035, .025, .93, .95, "#8f9ba1", "#313f47", .025);
  grille(art, .10, .10, .76, .78, 7, 6);
  art.rect(.35, .14, .10, .74, "#c0c9cb", "#5a676c", .02);
  art.rect(.66, .075, .20, .23, "#c9d0d0", "#58676d", .025);
}

/** Trace the RPS16-E AC inlet left, perforated fan right, lower pull bar and retaining screws. */
function powerSupply(art) {
  art.rect(.015, .025, .97, .95, "#a7b0b3", "#47545c", .025);
  art.rect(.075, .195, .215, .56, "#d0d5d5", "#34424a", .04);
  art.polygon([[.11, .29], [.15, .22], [.23, .22], [.265, .29], [.265, .67], [.11, .67]], "#1e2c35", "#dce1df");
  for (const [x, y] of [[.145, .39], [.215, .39], [.18, .56]]) art.rect(x, y, .025, .08, "#d1bd79");
  grille(art, .43, .10, .29, .67, 7, 6);
  art.rect(.36, .83, .48, .065, "#c7cece", "#56646b", .02);
  for (const [x, y] of [[.38, .14], [.77, .14], [.92, .27], [.92, .68]]) art.circle(x, y, .025, "#cad1d2", "#4d5a60");
}
