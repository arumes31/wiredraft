/** Draw only source-traced Aruba modular chassis hardware through the common Canvas/SVG primitive builder. */
export function addArubaChassisHardware(art, component) {
  const variant = component.variant;
  if (["sfp-vertical", "qsfp-vertical", "usb-micro-vertical"].includes(component.kind)) {
    addVerticalSocket(art, component.kind); return true;
  }
  if (!variant?.startsWith("aruba-chassis-") && !["aruba-6405-inlet", "aruba-6405-fan-tray", "aruba-8400-inlet", "aruba-8400-fan"].includes(variant)) return false;
  if (variant === "aruba-chassis-bezel") addBezel(art);
  else if (variant === "aruba-chassis-grille") addPerforations(art, component, .02, .02, .96, .96);
  else if (variant === "aruba-chassis-status") addStatus(art, component);
  else if (variant === "aruba-chassis-blank") addBlank(art, component);
  else if (variant === "aruba-6405-fan-tray") add6405Tray(art, component);
  else if (variant === "aruba-8400-fan") add8400Fan(art, component);
  else addInlet(art, component);
  return true;
}

/** Rotate cage internals with the vertical8400 cards instead of stretching a horizontal socket. */
function addVerticalSocket(art, kind) {
  art.rect(.035, .025, .93, .95, "#091418", "#a6b0b2", .025);
  if (kind === "usb-micro-vertical") {
    art.rect(.40, .14, .18, .72, "#52616a", "#87949a", .02); return;
  }
  art.rect(.18, .10, .56, .80, "#192a30", "#bac5c7", .018);
  art.line(.28, .15, .28, .85, "#74878d", .7);
  art.rect(.74, .27, .13, .46, "#34464b", "#a7b2b5", .018);
  for (let i = 0; i < (kind === "sfp-vertical" ? 2 : 4); i++) art.line(.61, .20 + i * .15, .71, .20 + i * .15, "#bbaa76");
}

/** Trace the shared narrow silver PSU bezel around its black staggered grille and green HPE badge. */
function addBezel(art) {
  art.rect(.01, .025, .98, .95, "#b1b8b8", "#526164", .025);
  art.polygon([[.085,.04],[.915,.04],[.970,.22],[.970,.78],[.915,.96],[.085,.96],[.030,.78],[.030,.22]], "#192327", "#697478");
  for (let row = 0; row < 6; row++) for (let col = 0; col < 34; col++) {
    const x = .074 + col * .025 + (row % 2) * .009;
    art.rect(x, .10 + row * .132, .021, .072, "#080f12", "#465155", .008);
  }
  art.rect(.44, .33, .14, .32, "#00a889", undefined, .008);
  art.rect(.454, .39, .112, .20, "#142126", undefined, .002);
  for (const x of [.014, .968]) art.rect(x, .21, .019, .56, "#192327", undefined, .015);
}

/** Draw a covered service slot with captive screws and its small physical slot number. */
function addBlank(art, component) {
  art.rect(.012, .012, .976, .976, "#303c40", "#8c999b", .012);
  const vertical = component.height > component.width;
  for (const [x, y] of vertical ? [[.5,.025],[.5,.975]] : [[.025,.24],[.975,.24]]) {
    art.circle(x, y, .018, "#a4b1b3", "#54676c");
  }
  if (component.label) art.label(component.label, vertical ? .5 : .055, vertical ? .055 : .58, 6);
}

/** Preserve the bounded hexagonal guards visible in the manufacturer's rear and card-edge diagrams. */
function addPerforations(art, component, x, y, width, height) {
  const step = Math.max(4, Math.min(component.width, component.height) / 10);
  const dx = step / component.width; const dy = step * .86 / component.height;
  for (let row = 0; row < Math.floor(height / dy); row++) for (let col = 0; col < Math.floor(width / dx) - row % 2; col++) {
    const cx = x + (col + .5 + row % 2 * .5) * dx; const cy = y + (row + .5) * dy;
    art.polygon(Array.from({ length: 6 }, (_, i) => [cx + dx * .42 * Math.cos(i * Math.PI / 3), cy + dy * .48 * Math.sin(i * Math.PI / 3)]), "#0c181c", "#718084");
  }
}

/** Draw the observed unlit management and rear diagnostic indicator matrices without inventing a live status. */
function addStatus(art, component) {
  art.rect(.01, .015, .98, .97, "#263439", "#607276", .004);
  const vertical = component.height > component.width;
  const rows = vertical ? 16 : 3; const columns = vertical ? 3 : 10;
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
    art.rect(.07 + col * .87 / columns, .08 + row * .85 / rows, .45 / columns, .38 / rows, "#334947", "#899796", .002);
  }
}

/** Trace the6405 four-fixed-fan tray, full perforated guard, right vertical handle and release tab. */
function add6405Tray(art, component) {
  art.rect(.005, .012, .99, .976, "#899496", "#35474e", .018);
  for (let i = 0; i < 4; i++) {
    const x = .12 + i * .209;
    art.circle(x, .51, .36, "#27363b", "#5a6f77");
    art.circle(x, .51, .095, "#4c5f64", "#23363d");
  }
  addPerforations(art, component, .027, .12, .858, .76);
  art.rect(.902, .22, .040, .53, "#6e7d80", "#c1c8c8", .07);
  art.rect(.890, .14, .064, .085, "#b5bdbd", "#56686d", .005);
  for (const y of [.09, .91]) art.circle(.935, y, .025, "#afbbbd", "#425860");
  art.label(component.label, .032, .065, 6);
}

/** Trace each replaceable8400 fan's wire guard, narrow central bail and upper release block. */
function add8400Fan(art, component) {
  art.rect(.015, .012, .97, .976, "#849093", "#2e424a", .01);
  art.circle(.5, .57, .35, "#27383e", "#5a6f77");
  addPerforations(art, component, .06, .17, .87, .78);
  for (const radius of [.35, .28, .20]) art.circle(.5, .57, radius, "rgba(0,0,0,0)", "#b4bdbe");
  art.line(.18, .28, .83, .86, "#a4b1b3"); art.line(.18, .86, .83, .28, "#a4b1b3");
  art.rect(.445, .36, .11, .42, "#7b8d92", "#c3cdce", .05);
  art.rect(.29, .015, .40, .10, "#bdc6c6", "#61777d", .006);
  for (const [x,y] of [[.07,.06],[.93,.06],[.07,.94],[.93,.94]]) art.circle(x, y, .019, "#adbbbd", "#4b6269");
  art.label(component.label, .79, .10, 6);
}

/** Trace the rear C20 receptacle and its chassis-mounted restraint, separate from the concealed front PSU. */
function addInlet(art, component) {
  const adapter = component.variant === "aruba-6405-inlet";
  if (adapter) {
    art.rect(.01, .02, .98, .96, "#8f9a9c", "#435961", .01);
    addPerforations(art, component, .055, .095, .44, .79);
  }
  const x = adapter ? .55 : .13; const width = adapter ? .33 : .74;
  art.rect(x, .13, width, .69, "#071216", "#b6c1c2", .025);
  for (const [cx,cy] of [[.5,.33],[.23,.62],[.77,.62]]) art.rect(x + cx * width - .032, cy, .064, .06, "#aebcbe", undefined, .003);
  art.rect(x - .045, .08, width + .09, .08, "#919fa2", "#546c74", .018);
  art.rect(x + width - .015, .13, .06, .75, "#4f6268", "#b6c1c2", .018);
  art.label(component.label, adapter ? .46 : .50, .045, 6);
}
