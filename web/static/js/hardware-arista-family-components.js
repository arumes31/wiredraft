/** Render only inspected Arista AC supplies; retain all pre-existing generic and exact-profile variants. */
export function addAristaFamilyComponent(art, component, colors) {
  if (component.kind !== "psu" || !["arista-pwr-511-ac", "arista-pwr-500ac"].includes(component.variant)) return false;
  const fanLeft = component.variant === "arista-pwr-511-ac";
  const cx = fanLeft ? .27 : .72, cy = .49;
  const radius = Math.min(component.width * .205, component.height * .355);
  const scale = Math.min(component.width, component.height), normalizedRadius = radius / scale;
  const rx = radius / component.width, ry = radius / component.height;
  art.rect(.018, .035, .964, .93, colors.surface, colors.ink, .025);
  art.rect(.038, .065, .924, .87, "#9aa4a8", "#65747b", .018);
  art.circle(cx, cy, normalizedRadius, "#152024", "#6c7a81");
  for (let index = 0; index < 7; index++) {
    const angle = index * Math.PI * 2 / 7;
    const points = [[.13, 0], [.42, .19], [.91, .30], [.95, .10], [.66, -.12]].map(([u, v]) => {
      const x = Math.cos(angle) * u - Math.sin(angle) * v, y = Math.sin(angle) * u + Math.cos(angle) * v;
      return [cx + x * rx, cy + y * ry];
    });
    art.polygon(points, "#7d8588");
  }
  art.circle(cx, cy, normalizedRadius * .26, "#465258", "#8c969a");
  art.circle(cx, cy, normalizedRadius * .87, undefined, "#c2c7c9");
  const direction = fanLeft ? -1 : 1;
  const diagonal = [[-.83, -.80], [-.65, -.94], [.83, .80], [.65, .94]];
  art.polygon(diagonal.map(([x, y]) => [cx + x * rx, cy + direction * y * ry]), "#ad2942", "#672738");
  art.polygon([[-.28, -.05], [-.06, -.32], [.28, .05], [.06, .32]].map(([x, y]) =>
    [cx + x * rx, cy + direction * y * ry]), "#bfc4c6", "#77848a");
  for (const end of [-1, 1]) {
    art.circle(cx + end * .74 * rx, cy + direction * end * .85 * ry, normalizedRadius * .115, "#b2b9ba", "#425159");
  }
  const inletX = fanLeft ? .64 : .115;
  const inlet = [[0, .22], [.21, .22], [.26, .30], [.26, .74], [.21, .80], [0, .80]];
  art.polygon(inlet.map(([x, y]) => [inletX + (fanLeft ? .26 - x : x), y]), "#111b20", "#46545c");
  for (const [x, y] of [[.06, .34], [.16, .50], [.06, .66]]) {
    art.rect(inletX + (fanLeft ? .215 - x : x), y, .045, .035, "#b6a474", undefined, .003);
  }
  const statusX = fanLeft ? .925 : .420;
  art.circle(statusX, .29, .028, "#586757", "#273e3b");
  art.label(component.label || "AC", .50, .91, 4.5);
  return true;
}
