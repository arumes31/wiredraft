/** Render only the selected plastic RAD chassis and its explicitly schematic rack support. */
export function addRadAdditionComponent(art, component) {
  const variant = component.variant;
  if (typeof variant !== "string" || !variant.startsWith("rad-addition-")) return false;
  if (variant === "rad-addition-body") {
    art.rect(0, 0, 1, 1, "#e3e8e6", undefined, .04);
    if (component.face === "rear") art.rect(.028, .045, .944, .91, "#3c718b", undefined, .035);
  } else if (variant === "rad-addition-front") {
    art.polygon([[0,.14],[.13,.30],[.28,.42],[.43,.49],[.59,.49],[.76,.35],[.90,.17],[1,.14],[1,1],[0,1]], "#236079");
    art.polygon([[.17,.38],[.35,.54],[.57,.55],[.77,.35],[.65,.47],[.40,.49]], "#9aa7a5");
    art.label("ETX-203AX", .10, .08, 5.5);
    art.label("EtherAccess", .82, .18, 6);
    for (let index = 0; index < 7; index++) {
      const x = .33 + index * .047;
      art.rect(x - .011, .485, .022, .095, "#4d976f");
      art.label(index === 0 ? "PWR" : String(index), x, .30, 4);
    }
  } else if (variant === "rad-addition-shelf") art.rect(0, 0, 1, 1, "#49585b");
  else if (variant === "rad-addition-ear") {
    art.rect(0, 0, 1, 1, "#566669");
    for (const y of [.15, .68]) art.rect(.23, y, .54, .13, "#121d21", undefined, .4);
  } else if (variant === "rad-addition-warning") art.rect(0, 0, 1, 1, "#b1a331");
  else return false;
  return true;
}
