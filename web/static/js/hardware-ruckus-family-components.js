/** Draw only the personally inspected fixed 7250 housings; leave every other component variant unchanged. */
export function addRuckusFamilyComponent(art, component, colors) {
  if (component.variant === "ruckus-7250-eps-cover") {
    art.rect(.04, .09, .92, .86, "#929ca0", colors.ink, .06);
    for (const x of [.15, .85]) { art.circle(x, .30, .10, "#c2c9ca", colors.ink); art.line(x - .055, .30, x + .055, .30, colors.ink); }
    art.line(.44, .08, .44, .02, colors.ink); art.line(.56, .08, .56, .02, colors.ink);
  } else if (component.variant === "ruckus-7250-fixed-fan") {
    fixedFan(art, component);
  } else if (component.variant === "ruckus-7250-grille") {
    for (let row = 0; row < 2; row++) for (let column = 0; column < 13; column++) art.circle(.045 + column * .075, .28 + row * .44, .027, "#1b2428", "#929ea2");
  } else if (component.variant === "ruckus-7250-status") {
    for (let index = 0; index < 9; index++) {
      art.rect(.025 + index * .106, .10, .055, .24, "#6e7778");
      art.circle(.052 + index * .106, .75, .025, "#557257", "#253b2b");
    }
  } else return false;
  return true;
}

/** Trace the fixed fan's round interrupted guard and central hub without adding a removable tray or latch. */
function fixedFan(art, component) {
  art.circle(.50, .50, .46, "#253036", "#9ca8ab");
  art.circle(.50, .50, .38, "#46535a", "#b5bec0");
  art.circle(.50, .50, .29, "#17262c", "#a2afb3");
  const diameter = Math.min(component.width, component.height), dx = diameter / component.width, dy = diameter / component.height;
  for (let index = 0; index < 4; index++) {
    const angle = index * Math.PI / 2;
    art.line(.5 + Math.cos(angle) * .31 * dx, .5 + Math.sin(angle) * .31 * dy,
      .5 + Math.cos(angle) * .46 * dx, .5 + Math.sin(angle) * .46 * dy, "#bac4c6");
  }
}
