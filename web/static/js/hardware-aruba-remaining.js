/** Draw the photographed CX 10000 replaceable hardware through the shared Canvas/SVG builder. */
export function addArubaRemainingHardware(art, component) {
  if (component.variant === "aruba-7205-cpu") { add7205CPU(art); return true; }
  if (component.variant === "aruba-7205-vent") {
    for (let index=0;index<24;index++) art.rect(.01+index*.041,.025,.020,.94,"#344a51","#73858b",.008);
    return true;
  }
  if (component.variant === "aruba-7205-label") {
    art.rect(.01,.02,.98,.96,"#bdc7c9",undefined,.002);
    art.rect(.03,.04,.45,.20,"#e7ebea",undefined,.002);
    for (let row=0;row<4;row++) art.rect(.55,.04+row*.225,.41,.20,"#e7ebea",undefined,.002);
    return true;
  }
  if (component.variant === "aruba-7205-lcd") {
    art.rect(.01,.02,.98,.96,"#abb6a4","#536769",.012);
    art.rect(.06,.16,.88,.68,"#687967","#bac5a7",.002);
    return true;
  }
  if (!["aruba-10000-fan", "aruba-10000-ac"].includes(component.variant)) return false;
  const fan = component.variant === "aruba-10000-fan";
  art.rect(.02, .025, .96, .95, fan ? "#afbb99" : "#87918e", "#172125", .025);
  addHoneycomb(art, component, fan ? .10 : .07, .09, fan ? .79 : .51, .78);
  if (fan) {
    for (const [x, y] of [[.08,.10],[.90,.10],[.10,.90],[.90,.90]]) {
      art.circle(x, y, .045, "#708076", "#27352d");
      art.line(x - .021, y, x + .021, y, "#c0cbbd");
    }
    art.polygon([[.04,.36],[.11,.17],[.17,.17],[.19,.30],[.30,.48],[.56,.71],[.91,.83],
      [.96,.90],[.91,.97],[.72,.94],[.46,.77],[.22,.56],[.12,.40]], "#cedfa8", "#aabc88");
    art.circle(.10,.83,.033,"#315441","#9caf94");
  } else {
    // The upright C14 has beveled top corners and a top-center earth blade.
    art.polygon([[.67,.13],[.87,.13],[.92,.22],[.92,.75],[.62,.75],[.62,.22]], "#061116", "#35443f");
    for (const [x,y] of [[.77,.30],[.69,.57],[.85,.57]]) art.rect(x-.018,y-.045,.036,.09,"#aab3b2",undefined,.005);
    const bail = [[.48,.08],[.55,.11],[.66,.29],[.67,.74],[.57,.88],[.47,.94],[.36,.89],
      [.47,.79],[.55,.69],[.55,.31],[.45,.19]];
    art.polygon(component.handleLeft ? bail.map(([x,y]) => [1-x,y]) : bail, "#1d2526", "#59625d");
    art.rect(.79,.87,.14,.055,"#1d2526","#59625d",.015);
    art.circle(.59,.86,.027,"#409257","#2d4539");
  }
  return true;
}

/** Trace the fixed 7205-MCC-1 rear CPU drawer, horizontal molded handle, two indicators and USB-A aperture. */
function add7205CPU(art) {
  art.rect(.005,.025,.99,.95,"#879494","#445758",.005);
  for (const x of [.025,.975]) {
    art.circle(x,.16,.034,"#a7b2b5","#607576");
    art.line(x-.012,.16,x+.012,.16,"#e2e8e8");
  }
  art.rect(.28,.47,.42,.32,"#5b6d70","#a3b2b4",.10);
  art.rect(.29,.42,.40,.15,"#a3b2b4",undefined,.07);
  art.rect(.17,.71,.049,.08,"#102227","#a3b2b4",.003);
  art.rect(.18,.73,.03,.025,"#708389",undefined,.002);
  for (const y of [.69,.80]) art.circle(.10,y,.018,"#70896f","#445758");
  art.rect(.88,.48,.08,.12,"#d9e0df",undefined,.002);
  art.rect(.88,.65,.08,.12,"#d9e0df",undefined,.002);
  art.label("7205-MCC-1",.87,.23,6);
}

/** Preserve hexagonal perforations in the source fan and power-supply guards at either rack width. */
function addHoneycomb(art, component, x, y, width, height) {
  const columns = 7; const dx = width / columns; const radiusX = dx * .53;
  const radiusY = radiusX * component.width / component.height;
  const dy = radiusY * 1.73;
  for (let row = 0; row < Math.floor(height / dy); row++) {
    for (let col = 0; col < columns - row % 2; col++) {
      const cx = x + (col + .5 + (row % 2) * .5) * dx;
      const cy = y + (row + .5) * dy;
      art.polygon(Array.from({length:6}, (_, index) => {
        const angle = Math.PI / 3 * index;
        return [cx + radiusX * .83 * Math.cos(angle), cy + radiusY * .83 * Math.sin(angle)];
      }), "#101a1c", "#718079");
    }
  }
}
