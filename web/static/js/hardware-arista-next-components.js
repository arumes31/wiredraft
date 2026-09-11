/** Render only the inspected FAN-7002/FAN-7011M trays and non-enhanced 7260 PWR-745AC supply. */
export function addAristaNextComponent(art, component, colors) {
  if (component.kind === "fan-tray" && ["arista-fan-7002", "arista-fan-7011m"].includes(component.variant)) {
    fanTray(art, component, colors); return true;
  }
  if (component.kind === "psu" && component.variant === "arista-pwr-745ac") {
    supply745(art, component, colors); return true;
  }
  return false;
}

/** Draw bounded honeycomb perforations, keeping all polygon vertices within the measured grille region. */
function honeycomb(art, component, x, y, width, height) {
  const dx = width / 13, rows = Math.max(3, Math.floor(height * component.height / (dx * component.width)));
  const dy = height / rows, radiusX = Math.min(dx * .45, dy * component.height / component.width * .45);
  const radiusY = radiusX * component.width / component.height;
  for (let row = 0; row < rows; row++) for (let column = 0; column < 12; column++) {
    const cx = x + (column + .5 + (row % 2) * .5) * dx, cy = y + (row + .5) * dy;
    art.polygon(Array.from({ length: 6 }, (_, i) => [cx + Math.cos(i * Math.PI / 3) * radiusX,
      cy + Math.sin(i * Math.PI / 3) * radiusY]), "#172024", "#96a0a3");
  }
}

/** Distinguish the square right-handle 7002 tray from the wide red-bezel, center-handle 7011M module. */
function fanTray(art, component, colors) {
  const square = component.variant === "arista-fan-7002";
  art.rect(.015, .02, .97, .96, "#b7bec0", colors.ink, .02);
  art.rect(.04, .04, .92, .92, square ? "#7e898c" : "#ac2943", colors.ink, .025);
  art.rect(.075, .085, .85, .83, "#152024", "#c4c8c9", .014);
  honeycomb(art, component, .09, .105, .82, .78);
  if (square) {
    art.rect(.755, .29, .21, .43, "#8e302d", "#632326", .065);
    art.rect(.455, .46, .065, .05, "#7aa758", "#e3e8dc", .002);
  } else {
    art.rect(.455, .29, .09, .45, "#b4bdbf", "#68747a", .012);
    art.rect(.40, .825, .20, .11, "#ad2942", undefined, .01);
    art.rect(.505, .855, .032, .04, "#7aa758", undefined, .002);
  }
}

/** Trace 745AC's left C14 inlet, right circular grille and rising red diagonal release handle. */
function supply745(art, component, colors) {
  art.rect(.018, .035, .964, .93, "#aeb6b9", colors.ink, .025);
  const cx = .73, cy = .49, radius = Math.min(component.width * .21, component.height * .36);
  const normalized = radius / Math.min(component.width, component.height), rx = radius / component.width, ry = radius / component.height;
  art.circle(cx, cy, normalized, "#172024", "#dae0e0");
  for (let i = 0; i < 6; i++) {
    const angle = i * Math.PI / 3;
    art.polygon([[.15, 0], [.5, .32], [.95, .28], [.92, -.09], [.55, -.12]].map(([x, y]) =>
      [cx + (x * Math.cos(angle) - y * Math.sin(angle)) * rx, cy + (x * Math.sin(angle) + y * Math.cos(angle)) * ry]), "#879093");
  }
  art.circle(cx, cy, normalized * .88, undefined, "#cbd0d1");
  art.polygon([[-.83, .80], [-.65, .94], [.83, -.80], [.65, -.94]].map(([x, y]) => [cx + x * rx, cy + y * ry]), "#ad2942", "#692635");
  for (const end of [-1, 1]) art.circle(cx + end * .74 * rx, cy - end * .85 * ry, normalized * .105, "#b2b9ba", "#425159");
  art.polygon([[.085, .18], [.29, .18], [.35, .27], [.35, .73], [.29, .80], [.085, .80]], "#121b20", "#56636b");
  for (const [x, y] of [[.125, .30], [.225, .47], [.125, .64]]) art.rect(x, y, .048, .028, "#bdab75", undefined, .002);
  art.circle(.435, .20, .045, "#729350", "#42573c");
  art.label(component.label || "AC", .46, .91, 4);
}
