const HARDWARE = "https://www.juniper.net/documentation/us/en/hardware/";
const models = new Map([
  ["SRX300", { series: 300, widthMM: 320.8, height: .78, figures: "Front Figure 1; rear Figure 3; chassis dimensions" }],
  ["SRX320", { series: 320, widthMM: 300, figures: "Front Figure 1; rear Figure 3; chassis dimensions" }],
  ["SRX340", { series: 340, figures: "Front Figure 1; rear Figure 3" }],
  ["SRX345", { series: 345, figures: "Single-AC front Figure 1; single-AC rear Figure 4" }],
  ["SRX380", { series: 380, figures: "Front Figure 1; rear Figure 4; power system specifications" }],
  ["SRX1500", { series: 1500, figures: "Front Figure 1; rear Figure 3; base AC configuration" }],
  ["SRX4100", { series: 4100, figures: "Front Figure 1; rear Figure 5; AC power system" }],
  ["SRX4200", { series: 4200, figures: "Front Figure 1; rear Figure 5; AC power system" }],
  ["SRX4600", { series: 4600, figures: "Front Figures 1/4/6; AC rear Figure 7" }],
]);

/** Resolve only individually traced Juniper SRX panels and their documented configurations. */
export function buildJuniperSRXModelFaceplate(device) {
  const definition = models.get(device.model);
  if (!definition || device.faceplate.vendor !== "Juniper") return null;
  const { series, widthMM = 438, height = .9, figures } = definition;
  const slug = device.model.toLowerCase();
  const source = series === 4600 ? `${HARDWARE}${slug}/topics/concept/services-gateway-${slug}-chassis-specs.html`
    : `${HARDWARE}${slug}/topics/topic-map/${slug}-chassis.html`;
  const relabeled = series === 340 || series === 345;
  const width = widthMM / 438;
  return {
    id: `enterprise-juniper-srx${series}`, family: device.model, fidelity: "model", source, sourcePage: figures,
    evidence: { models: [device.model], scope: "model", reviewed: "2026-09-10", front: source, rear: source,
      ...(series === 345 ? { configuration: "Single-AC base chassis; dual-AC and DC chassis have different panels." }
        : series === 380 ? { configuration: "One-AC-PSU configuration, with the optional second bay covered.", supplemental: `${HARDWARE}srx380/topics/topic-map/srx380-power-system.html` }
          : series === 1500 ? { configuration: "Base AC configuration with PSU 0 installed and the optional PSU 1 bay covered." }
            : series >= 4100 ? { configuration: "AC chassis with two installed power supplies; DC supplies have different rear fittings." } : {}) },
    inventoryRevision: relabeled ? 1 : 0, inventoryComplete: true,
    ...(relabeled ? { legacyLayouts: [{ inventoryRevision: 0,
      portIndexMap: Object.fromEntries(Array.from({ length: 19 }, (_, index) => [index + 1, index + 1])),
      portLabels: Object.fromEntries(Array.from({ length: 8 }, (_, index) => [index + 9, `0/${index}`])) }] } : {}),
    inventoryNotes: ["USB storage connectors are decorative; optional network modules remain unpopulated."],
    catalogDiscrepancies: [
      ...(relabeled ? ["The old catalog repeated copper labels on the SFP bank. Physical SFP ports are 0/8–0/15; the revision map retains saved identities and user renames."] : []),
      ...(series === 345 ? ["This drawing traces the single-AC SRX345 chassis. The dual-AC and DC variants require their corresponding panel configuration."] : []),
      ...(series === 380 ? ["The guide supports two AC PSU bays and ships one supply. This drawing shows one installed supply and the optional second bay covered."] : []),
      ...(series === 1500 ? ["The base AC configuration has one installed PSU 0. The optional PSU 1 and unavailable WAN PIM positions remain covered."] : []),
      ...(series === 4100 || series === 4200 ? ["Four rear fan trays each contain two tandem fans; the drawing shows the four external grilles. AC supplies are selected."] : []),
      ...(series === 4600 ? ["The four 10MHz/PPS input/output clock connectors are decorative because the catalog has no corresponding endpoints. The drawing selects the two-AC-PSU configuration."] : []),
    ], defaultFace: "front", chassis: { x: (1 - width) / 2, y: (1 - height) / 2, width, height },
    faces: series <= 320 ? desktopFaces(device, series) : series < 1500 ? rackFaces(device, series)
      : series === 1500 ? srx1500Faces(device) : series === 4600 ? srx4600Faces(device) : srx4100Faces(device),
  };
}

/** Describe a visible part relative to the model's physical chassis. */
function part(kind, x, y, width, height, label, variant) {
  return { kind, x, y, width, height, ...(label ? { label } : {}), ...(variant ? { variant } : {}) };
}

/** Associate a verified physical label with an immutable catalog socket. */
function socket(device, label, x, y, width, height = .22, type, physicalLabel = label) {
  const port = device.ports.find((item) => item.label === label && (!type || item.type === type));
  if (!port) throw new Error(`${device.model}: documented socket ${label} is missing from the catalog`);
  return { label, physicalLabel, type: port.type, portIndex: port.portIndex, x, y, width, height };
}

/** Trace the different SRX300/SRX320 single-row banks and rear DC/fan arrangements. */
function desktopFaces(device, series) {
  const pim = series === 320;
  const front = { ports: [], components: [
    part("text", pim ? .02 : .05, pim ? .10 : .20, .083, .11, "JUNIPER"),
    part("text", pim ? .10 : .132, pim ? .17 : .22, .070, .10, device.model),
    part("button", pim ? .024 : .053, pim ? .66 : .46, pim ? .023 : .030, .20, undefined, "power"),
    part("button", pim ? .172 : .195, pim ? .73 : .56, .009, .06, undefined, "reset"),
    part("usb", pim ? .204 : .222, pim ? .71 : .47, .045, .12),
  ] };
  const xs = pim ? [.409, .463, .516, .570, .623, .676] : [.421, .471, .521, .571, .621, .671];
  for (const [index, x] of xs.entries()) front.ports.push(socket(device, `0/${index}`, x, pim ? .705 : .53, pim ? .047 : .043));
  front.ports.push(socket(device, "CONSOLE", pim ? .294 : .311, pim ? .71 : .51, pim ? .047 : .045),
    socket(device, "MINI-USB", pim ? .351 : .366, pim ? .80 : .65, pim ? .032 : .026, .075));
  for (const [index, x] of (pim ? [.866, .947] : [.842, .920]).entries()) {
    front.ports.push(socket(device, `0/${index + 6}`, x, pim ? .72 : .58, .048, .20));
  }
  const rear = { ports: [], components: [part("power", pim ? .914 : .887, pim ? .625 : .375, .028, .23, "12V", "dc-barrel"),
    part("button", pim ? .037 : .074, pim ? .70 : .575, .020, .15, undefined, "ground"),
    part("vent", pim ? .08 : .36, pim ? .28 : .44, .025, .075, undefined, "slit"),
  ] };
  for (const y of (pim ? [.56, .78] : [.35, .61])) rear.components.push(part("handle", pim ? .854 : .826, y, .034, .066));
  if (pim) {
    for (const x of [.338, .658]) {
      front.components.push(part("module-bay", x, .05, .313, .46, `mPIM ${x === .338 ? 1 : 2}`, "blank"),
        part("vent", x + .085, .16, .16, .25, undefined, "mesh"));
    }
    front.components.push(part("vent", .18, .075, .15, .50, undefined, "mesh"),
      part("vent", .715, .55, .105, .40, undefined, "mesh"), part("vent", .17, .95, .54, .035, undefined, "mesh"));
    for (const x of [.3375, .5375]) rear.components.push(part("fan", x, .105, .125, .83));
    for (const x of [.073, .105, .14]) for (const y of [.66, .80]) front.components.push(part("led", x - .004, y, .008, .05));
  } else {
    for (const x of [.005, .97]) {
      front.components.push(part("vent", x, .12, .025, .73, undefined, "chevron"));
      rear.components.push(part("vent", x, .12, .025, .73, undefined, "chevron"));
    }
    front.components.push(part("button", .757, .23, .018, .14, undefined, "ground"));
    for (const x of [.108, .138]) for (const y of [.55, .68]) front.components.push(part("led", x - .004, y, .008, .05));
  }
  return { front, rear };
}

/** Trace the four Mini-PIM slots and distinct 340/345/380 physical port banks. */
function rackFaces(device, series) {
  const dense = series === 380;
  const front = { ports: [], components: [part("text", .008, .035, .057, .09, "JUNIPER"), part("text", .065, .045, .034, .075, device.model),
    part("button", .024, .63, .021, .18, undefined, "power"), part("button", dense ? .051 : .134, .75, .008, .05, undefined, "reset"),
    part("usb", dense ? .149 : .155, dense ? .71 : .75, dense ? .027 : .032, .10),
  ] };
  const xs = dense ? [.252, .288, .325, .361, .396, .433, .470, .506, .544, .580, .617, .655, .692, .728, .764, .801]
    : series === 345 ? [.337, .372, .408, .443, .479, .514, .550, .585] : [.334, .370, .406, .442, .478, .514, .550, .586];
  for (const [index, x] of xs.entries()) front.ports.push(socket(device, `0/${index}`, x, dense ? .71 : .72, .031));
  const optical = dense ? [.840, .873, .907, .940] : [.628, .662, .696, .730, .822, .856, .890, .924];
  for (const [index, x] of optical.entries()) front.ports.push(socket(device, `0/${index + (dense ? 16 : 8)}`, x, .75, .030, .20));
  front.ports.push(socket(device, "CONSOLE", dense ? .091 : .213, .70, .034),
    socket(device, "MGMT", dense ? .205 : .287, .70, .034), socket(device, "MINI-USB", dense ? .128 : .249, .82, .021, .075));
  for (const [index, x] of [.105, .322, .541, .762].entries()) {
    front.components.push(part("module-bay", x, .065, .213, .47, `mPIM ${index + (series === 340 ? 0 : 1)}`, "blank"),
      part("vent", x + .055, .19, .11, .24, undefined, "mesh"));
  }
  if (dense) {
    for (const x of [.027, .044]) for (const y of [.30, .38, .46, .54]) front.components.push(part("led", x - .003, y, .006, .04));
    front.components.push(part("vent", .971, .59, .02, .35, undefined, "mesh"));
  } else {
    for (const x of [.057, .077, .097, .117]) for (const y of [.69, .80]) front.components.push(part("led", x - .003, y, .006, .04));
    front.components.push(part("vent", .005, .34, .018, .56, undefined, "mesh"),
      part("vent", .752, .59, .047, .35, undefined, "mesh"), part("vent", .947, .59, .044, .35, undefined, "mesh"));
  }
  const rear = { ports: [], components: [part("module-bay", .033, dense ? .40 : .48, .198, dense ? .56 : .49, "SSD", "blank")] };
  for (const x of (dense ? [.2505, .3715, .4895] : [.2505, .3595, .4685, .5775])) rear.components.push(part("fan", x, .065, .085, .88));
  if (dense) {
    rear.components.push(part("psu", .616, .04, .18, .91, "AC PSU", "ac"), part("module-bay", .803, .04, .176, .91, "OPTIONAL PSU", "blank"));
    for (const x of [.117, .154]) rear.components.push(part("button", x - .006, .16, .012, .08, undefined, "ground"));
  } else rear.components.push(part("power", .9125, .265, .063, .47, "AC", "ac"));
  return { front, rear };
}

/** Trace SRX1500 paired banks, the two WAN PIM covers, and its base single-AC rear. */
function srx1500Faces(device) {
  const front = { ports: [], components: [
    part("vent", .005, .05, .17, .90, undefined, "mesh"), part("text", .015, .06, .090, .12, "JUNIPER"),
    part("text", .900, .14, .068, .12, device.model), part("vent", .185, .035, .347, .15, undefined, "mesh"),
    part("module-bay", .543, .06, .212, .44, "WAN PIM 1", "blank"),
    part("module-bay", .762, .06, .213, .44, "WAN PIM 2", "blank"),
    part("usb", .627, .685, .029, .10), part("button", .554, .71, .010, .10, undefined, "ground"),
    part("button", .869, .59, .020, .20, undefined, "power"), part("button", .849, .755, .008, .05, undefined, "reset"),
    part("vent", .898, .57, .09, .39, undefined, "mesh"),
  ] };
  for (const [column, x] of [.199, .231, .264, .296, .328, .360].entries()) {
    for (const [row, y] of [.38, .71].entries()) front.ports.push(socket(device, `0/${column * 2 + row}`, x, y, .029));
  }
  for (const [column, x] of [.403, .437, .480, .514].entries()) {
    for (const [row, y] of [.36, .72].entries()) front.ports.push(socket(device, `0/${12 + column * 2 + row}`, x, y, .031, .20));
  }
  front.ports.push(socket(device, "HA", .598, .74, .041, .20), socket(device, "CONSOLE", .684, .72, .034),
    socket(device, "MINI-USB", .722, .81, .019, .065), socket(device, "MGMT", .760, .71, .034));
  for (const x of [.794, .813, .832]) for (const y of [.68, .82]) front.components.push(part("led", x - .003, y, .006, .04));
  const rear = { ports: [], components: [
    part("module-bay", .475, .40, .23, .55, "SSD", "populated"),
    part("module-bay", .707, .035, .145, .925, "OPTIONAL PSU 1", "blank"),
    part("psu", .855, .035, .132, .925, "PSU 0", "ac"),
  ] };
  for (const x of [.067, .189, .306, .415]) rear.components.push(part("fan", x - .0475, .06, .095, .90));
  for (const y of [.39, .73]) rear.components.push(part("button", .118, y, .012, .09, undefined, "ground"));
  return { front, rear };
}

/** Trace the individually scoped SRX4100/SRX4200 diagrams and their shared four-tray AC rear. */
function srx4100Faces(device) {
  const front = { ports: [], components: [
    part("text", .010, .10, .075, .17, "JUNIPER"), part("text", .090, .16, .075, .11, device.model),
    part("usb", .250, .15, .012, .29), part("usb", .250, .50, .012, .29),
    part("button", .254, .8375, .006, .045, undefined, "reset"),
    part("vent", .284, .09, .171, .32, undefined, "mesh"), part("vent", .461, .09, .173, .32, undefined, "mesh"),
    part("vent", .638, .09, .173, .32, undefined, "mesh"), part("vent", .814, .09, .168, .82, undefined, "mesh"),
    part("vent", .284, .41, .030, .50, undefined, "mesh"), part("vent", .420, .41, .035, .50, undefined, "mesh"),
  ] };
  front.ports.push(socket(device, "MGMT", .216, .30, .035), socket(device, "CONSOLE", .216, .69, .035),
    socket(device, "CTL", .347, .71, .039, .20), socket(device, "FAB", .394, .71, .039, .20));
  for (const [index, x] of [.495, .531, .564, .597, .670, .703, .737, .770].entries()) {
    front.ports.push(socket(device, String(index), x, .70, .032, .20, undefined, `0/${index}`));
  }
  for (const y of [.38, .49, .60]) front.components.push(part("led", .016, y, .006, .04));
  const rear = { ports: [], components: [
    part("button", .0135, .71, .019, .20, undefined, "ground"), part("button", .088, .70, .020, .20, undefined, "ground"),
    part("button", .6575, .275, .017, .45, undefined, "power"), part("button", .700, .35, .012, .14, "ALARM OFF"),
    part("psu", .733, .05, .123, .90, "PSU 0", "ac"), part("psu", .863, .05, .128, .90, "PSU 1", "ac"),
  ] };
  for (const x of [.215, .316, .418, .521]) rear.components.push(part("fan", x - .0465, .05, .093, .90));
  return { front, rear };
}

/** Trace SRX4600's separate HA/PIC banks, SSD and timing section, and five-fan AC rear. */
function srx4600Faces(device) {
  const front = { ports: [], components: [
    part("vent", .008, .15, .062, .80, undefined, "mesh"), part("text", .010, .035, .057, .085, "JUNIPER"),
    part("text", .926, .02, .060, .08, device.model), part("vent", .190, .06, .180, .38, undefined, "mesh"),
    part("vent", .167, .06, .02, .84, undefined, "mesh"), part("vent", .526, .06, .041, .84, undefined, "mesh"),
    part("vent", .594, .52, .328, .26, undefined, "mesh"), part("usb", .574, .213, .012, .30),
    part("module-bay", .695, .20, .063, .27, "SSD 0", "populated"),
    part("module-bay", .768, .20, .061, .27, "SSD 1", "populated"),
    part("button", .734, .7195, .006, .045, undefined, "reset"), part("button", .843, .7195, .006, .045, "OFFLINE"),
    part("button", .932, .805, .012, .12, undefined, "ground"),
    part("text", .938, .12, .025, .065, "10MHz"), part("text", .965, .12, .023, .065, "PPS"),
    part("text", .946, .37, .023, .055, "OUT"), part("text", .946, .57, .023, .055, "IN"),
    part("text", .085, .85, .035, .07, "CTL"), part("text", .125, .85, .035, .07, "FAB"),
  ] };
  for (const [column, prefix] of ["CTL", "FAB"].entries()) {
    for (const [row, y] of [.247, .607].entries()) {
      front.ports.push(socket(device, `${prefix}${row}`, [.103, .142][column], y, .032, .20, undefined, String(column * 2 + row)));
    }
  }
  for (const [index, x] of [.215, .258, .301, .345].entries()) {
    front.ports.push(socket(device, String(index), x, .618, .040, .20, "QSFP28_100G"));
  }
  for (const [column, x] of [.400, .434, .467, .501].entries()) {
    for (const [row, y] of [.258, .629].entries()) {
      front.ports.push(socket(device, String(column * 2 + row), x, y, .030, .20, "SFP_PLUS_10G"));
    }
  }
  for (const [label, x] of [["MGMT", .613], ["CON", .657], ["ToD", .868], ["BITS", .912]]) {
    front.ports.push(socket(device, label, x, .213, .032));
  }
  for (const x of [.944, .977]) for (const y of [.281, .472]) front.components.push(part("coax", x - .008, y - .07, .016, .14));
  for (const x of [.703, .720, .785, .804, .822]) front.components.push(part("led", x, .10, .006, .035));
  for (const x of [.771, .803]) front.components.push(part("led", x, .724, .006, .035));
  const rear = { ports: [], components: [part("psu", .588, .04, .192, .91, "PSU 0", "ac"), part("psu", .792, .04, .192, .91, "PSU 1", "ac")] };
  for (const [index, x] of [.030, .140, .251, .363, .474].entries()) rear.components.push(part("fan", x, .04, .104, .91, `FAN ${index}`));
  return { front, rear };
}
