const HARDWARE = "https://www.juniper.net/documentation/us/en/hardware/";
const models = new Map([
  ["EX2300-24T", { series: 2300, copper: 24, legacyCount: 29, console: 29, usbConsole: 30, management: 31,
    guide: "ex2300/topics/topic-map/ex2300-system-overview.html", figures: "24-port front Figure 3 with non-PoE status-LED differences; EX2300-24T rear Figure 11",
    configuration: "EX2300-24T AC chassis, one fixed AC inlet and one circular exhaust opening; non-PoE indicators." }],
  ["EX2300-48P", { series: 2300, copper: 48, legacyCount: 53, console: 53, usbConsole: 54, management: 55,
    guide: "ex2300/topics/topic-map/ex2300-system-overview.html", figures: "EX2300-48P front Figure 4; rear Figure 10",
    configuration: "EX2300-48P AC chassis, one fixed AC inlet and two circular exhaust openings; PoE+ indicators." }],
  ["EX3400-24P", { series: 3400, copper: 24, legacyCount: 31, console: 31, usbConsole: 32, management: 33,
    guide: "ex3400/topics/topic-map/ex3400-chassis.html", figures: "EX3400-24P front Figure 1; AC rear Figure 3; QSFP+ Figure 9",
    supplemental: "ex3400/topics/topic-map/ex3400-system-overview.html",
    configuration: "EX3400-24P with one JPSU-600-AC-AFO supply, a covered second power bay and two fan modules. Rear QSFP+ ports are 40G and default to Virtual Chassis mode." }],
  ["EX4400-48P", { series: 4400, copper: 48, legacyCount: 53, console: 55, usbConsole: 56, management: 57,
    guide: "ex4400/topics/concept/ex4400-models.html", figures: "EX4400-48P front Figure 24 and rear Figure 25; system overview EX4400-EM-4Y Figure 3",
    supplemental: "ex4400/topics/topic-map/ex4400-system-overview.html",
    configuration: "EX4400-48P with the EX4400-EM-4Y four-port 25G extension module already represented by catalog inventory, one 1600W AC supply, a covered second power bay and two fan modules. Two fixed rear 100G ports default to Virtual Chassis mode." }],
  ["EX4650-48Y", { series: 4650, legacyCount: 57, console: 57, management: 58,
    guide: "ex4650/topics/topic-map/ex4650-hardware-overview.html", figures: "Front Figure 2; AC rear Figure 5; shipped-component Table 6",
    configuration: "EX4650-48Y-AFI AC configuration: two installed AC supplies and five fan modules, with AIR IN airflow matching the illustrated rear panel." }],
]);

/** Resolve verified individual EX chassis and explicitly name their power and optional-module configuration. */
export function buildJuniperEXModelFaceplate(device) {
  const definition = models.get(device.model);
  if (!definition || device.faceplate?.vendor !== "Juniper") return null;
  const source = `${HARDWARE}${definition.guide}`;
  return {
    id: `enterprise-juniper-${device.model.toLowerCase()}`, family: device.model, fidelity: "model",
    source, sourcePage: definition.figures,
    evidence: { models: [device.model], scope: "model", reviewed: "2026-09-10", front: source, rear: source,
      configuration: definition.configuration,
      ...(definition.supplemental ? { supplemental: `${HARDWARE}${definition.supplemental}` } : {}),
    },
    inventoryRevision: 1, inventoryComplete: true,
    legacyLayouts: [{ inventoryRevision: 0, portIndexMap: Object.fromEntries(
      Array.from({ length: definition.legacyCount }, (_, index) => [index + 1,
        definition.series === 4400 && index + 1 === 53 ? 55 : index + 1])) }],
    catalogDiscrepancies: [definition.configuration,
      definition.series === 4650
        ? "New inventory includes the formerly omitted rear management socket. Existing console and optical endpoint identities remain unchanged. USB storage is decorative."
        : "New inventory includes the formerly omitted front USB console and rear management sockets. Existing data and RJ45 console identities remain unchanged. USB storage is decorative.",
      ...(definition.series === 3400 ? ["The two saved 40G uplinks were incorrectly typed QSFP28; new inventory uses QSFP+ and explicit revision-zero compatibility retains those original endpoints."] : []),
      ...(definition.series === 4400 ? ["The four catalog SFP28 ports belong to the explicitly selected optional EX4400-EM-4Y module. New inventory also includes the previously omitted two fixed rear QSFP28 sockets."] : []),
      "Printed data labels start at zero; editable inventory labels and custom names are retained separately from physical numbering.",
    ],
    defaultFace: "front", chassis: { x: 0, y: .05, width: 1, height: .9 },
    faces: { front: definition.series === 4650 ? front4650(device) : accessFront(device, definition),
      rear: definition.series === 2300 ? rear2300(device, definition)
        : definition.series === 3400 ? rear3400(device, definition)
          : definition.series === 4400 ? rear4400(device, definition) : rear4650(device, definition) },
  };
}

/** Describe a traced physical component in normalized chassis coordinates. */
function part(kind, x, y, width, height, label, variant) {
  return { kind, x, y, width, height, ...(label ? { label } : {}), ...(variant ? { variant } : {}) };
}

/** Keep canonical endpoint identity separate from the printed port number and historical connector type. */
function socket(device, index, x, y, width, height, physicalLabel, compatibleTypes) {
  const port = device.ports.find((candidate) => candidate.portIndex === index);
  if (!port) throw new Error(`${device.model}: documented socket index ${index} is missing from the catalog`);
  return { label: port.label, type: port.type, portIndex: index, x, y, width, height, physicalLabel,
    ...(compatibleTypes ? { compatibleTypes } : {}) };
}

/** Trace the EX2300/3400 access panels and the separately illustrated EX4400 extension module. */
function accessFront(device, definition) {
  const { series, copper, usbConsole } = definition;
  const ex4400 = series === 4400;
  const starts = ex4400 ? [.031, .238, .439, .642]
    : copper === 24 ? [.439, .640] : [.0325, .2346, .4343, .6364];
  const ports = Array.from({ length: copper }, (_, index) => socket(device, index + 1,
    starts[Math.floor(index / 12)] + Math.floor(index % 12 / 2) * (ex4400 ? .0320 : .0318),
    index % 2 ? (ex4400 ? .659 : .706) : (ex4400 ? .375 : .388), .027, .22, String(index)));
  const opticX = ex4400 ? [.860, .893, .926, .959] : [.844, .878, .911, .943];
  for (const [index, x] of opticX.entries()) ports.push(socket(device, copper + index + 1, x,
    ex4400 ? .70 : .738, .030, .19, String(index)));
  ports.push(socket(device, usbConsole, ex4400 ? .892 : .972, ex4400 ? .193 : .918,
    ex4400 ? .020 : .023, .075, "USB CON"));
  const components = [part("text", .016, .06, .052, .11, "JUNIPER"),
    part("vent", ex4400 ? .059 : .077, .027, ex4400 ? .755 : .742, .145, undefined, "mesh"),
    part("vent", .022, ex4400 ? .895 : .96, .791, ex4400 ? .08 : .027, undefined, "mesh")];
  if (ex4400) {
    components.push(part("text", .824, .053, .069, .075, "EX4400 PoE++"),
      part("button", .952, .105, .013, .115, undefined, "reset"),
      part("module-bay", .823, .398, .169, .523, "EX4400-EM-4Y", "populated"),
      part("vent", .854, .43, .107, .075, undefined, "mesh"));
    for (const x of [.917, .932]) for (const y of [.08, .15, .22, .29]) components.push(part("led", x, y, .004, .024));
  } else {
    components.push(part("text", .826, .08, .108, .11, `EX${series}${device.model.endsWith("P") ? " PoE+" : ""}`),
      part("text", .826, .245, .048, .10, "JUNOS"),
      part("vent", .826, .40, .13, .16, undefined, "mesh"),
      part("button", .967, .730, .010, .085, undefined, "reset"));
    for (const y of [.153, .260, .376]) components.push(part("led", .961, y, .004, .026), part("led", .977, y, .004, .026));
    if (device.model.endsWith("P")) components.push(part("led", .977, .49, .004, .026));
  }
  return { ports, components };
}

/** Trace the fixed-AC EX2300 rear, preserving the model-specific count of round exhaust openings. */
function rear2300(device, { copper, console, management }) {
  return { ports: [socket(device, console, .104, .553, .032, .22, "CON"),
    socket(device, management, .057, .365, .032, .22, "MGMT")], components: [
    part("usb", .039, .55, .035, .115),
    part("screw", .134, .135, .013, .10), part("screw", .170, .135, .013, .10),
    part("screw", .225, .13, .018, .14),
    part("fan", .261, .05, .091, .91, undefined, "fixed"),
    ...(copper === 48 ? [part("fan", .400, .05, .091, .91, undefined, "fixed")] : []),
    part("power", .875, .25, .070, .52, "AC", "ac"),
  ] };
}

/** Trace rear 40G uplinks, separate service sockets and the 600W supply of the EX3400-24P. */
function rear3400(device, { console, management }) {
  return { ports: [socket(device, console, .098, .72, .032, .22, "CON"),
    socket(device, management, .056, .51, .032, .22, "MGMT"),
    socket(device, 29, .146, .77, .040, .20, "0", ["QSFP28_100G"]),
    socket(device, 30, .191, .77, .040, .20, "1", ["QSFP28_100G"])], components: [
    part("usb", .039, .705, .035, .11),
    part("screw", .145, .145, .013, .10), part("screw", .180, .145, .013, .10),
    part("screw", .250, .13, .018, .15),
    part("fan", .301, .045, .097, .91), part("fan", .411, .045, .097, .91),
    part("psu", .614, .045, .172, .91, "600W AC", "ac-fan-left"),
    part("module-bay", .804, .045, .171, .91, "OPTIONAL PSU 1", "blank"),
  ] };
}

/** Trace the EX4400-48P's fixed rear 100G ports and two widely separated fan positions. */
function rear4400(device, { console, management }) {
  return { ports: [socket(device, console, .039, .307, .032, .22, "CON"),
    socket(device, management, .090, .307, .032, .22, "MGMT"),
    socket(device, 53, .172, .341, .044, .20, "0"), socket(device, 54, .172, .648, .044, .20, "1")], components: [
    part("usb", .119, .137, .010, .33), part("button", .120, .75, .010, .085, undefined, "reset"),
    part("screw", .082, .725, .013, .12), part("screw", .205, .725, .013, .12),
    part("fan", .245, .034, .093, .92), part("fan", .468, .034, .093, .92),
    part("psu", .578, .034, .190, .92, "1600W AC", "ac-fan-left"),
    part("module-bay", .784, .034, .192, .92, "OPTIONAL PSU 1", "blank"),
  ] };
}

/** Trace the EX4650's three 16-port SFP28 banks and two-row eight-port QSFP28 bank. */
function front4650(device) {
  const starts = [.0336, .297, .562];
  const ports = Array.from({ length: 48 }, (_, index) => socket(device, index + 1,
    starts[Math.floor(index / 16)] + Math.floor(index % 16 / 2) * .0329,
    index % 2 ? .652 : .348, .028, .19, String(index)));
  for (let index = 0; index < 8; index++) ports.push(socket(device, index + 49,
    [.834, .879, .922, .964][Math.floor(index / 2)], index % 2 ? .652 : .348, .038, .19, String(index + 48)));
  return { ports, components: [part("vent", .017, .028, .965, .115, undefined, "mesh"),
    part("vent", .025, .88, .955, .095, undefined, "mesh")] };
}

/** Trace the EX4650-48Y-AFI rear with five fan trays, dual AC supplies and two RJ45 service sockets. */
function rear4650(device, { console, management }) {
  const components = [part("text", .014, .05, .048, .10, "JUNIPER"), part("text", .075, .05, .068, .085, "EX4650-48Y"),
    part("usb", .037, .663, .034, .101), part("button", .097, .80, .007, .065, undefined, "reset"),
    part("screw", .126, .30, .013, .11),
    part("psu", .713, .023, .129, .94, "AC AIR IN", "ac-inlet-right"),
    part("psu", .856, .023, .129, .94, "AC AIR IN", "ac-inlet-right")];
  for (const x of [.160, .270, .384, .497, .609]) components.push(part("fan", x, .034, .099, .92));
  for (const y of [.40, .52, .64, .76]) components.push(part("led", .018, y, .004, .030));
  return { ports: [socket(device, console, .051, .461, .032, .22, "CON"),
    socket(device, management, .102, .438, .032, .22, "MGMT")], components };
}
