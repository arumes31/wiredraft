import { canonicalFaceplateDevice } from "./faceplate-profile.js";

const root = "https://www.downloads.netgear.com/files/GDC";
const definitions = new Map([
  ["M4250 family", { series: "M4250", model: "M4250-40G8XF-PoE+", sku: "GSM4248PX", front: 28, rear: 29,
    configuration: "40 PoE+ copper ports, eight 10G SFP+ uplinks, single integrated AC supply and 960W PoE budget.",
    limitations: ["This selects the 1U PoE+ chassis; the PoE++ variant has a different 2U rear and three AC inputs.",
      "Front USB storage and unused LED EXT connector are artwork; the rear USB-C is the connectable serial console."],
    map: [...Array.from({ length: 40 }, (_, i) => [i + 1, i + 1]), ...Array.from({ length: 4 }, (_, i) => [49 + i, 41 + i]), [53, 49]] }],
  ["M4300 family", { series: "M4300", model: "M4300-52G-PoE+", sku: "GSM4352PA", front: 26, rear: 29,
    configuration: "48 PoE+ copper ports, two 10G copper and two SFP+ uplinks, one APS550W in PSU1, PSU2 empty, 480W PoE budget.",
    limitations: ["The exposed fixed fans, RPS connector and single installed APS550W follow rear Figure 14; no external RPS is selected.",
      "Stacking uses the existing 10G interfaces. It does not add separate rear network sockets."],
    map: [...Array.from({ length: 48 }, (_, i) => [i + 1, i + 1]), [49, 51], [50, 52], [53, 53]] }],
  ["M4350 family", { series: "M4350", model: "M4350-48G4XF", sku: "GSM4352", front: 24, rear: 25,
    configuration: "48 PoE+ copper ports, four SFP+ uplinks, integrated AC PSU with 236W PoE budget and two covered optional APS bays.",
    limitations: ["Figure 8 illustrates installed optional APS modules, but its adjacent note explicitly says the switch ships with both bays covered. This selects that standard covered configuration.",
      "The two rear USB-A storage sockets are artwork; the front USB-C is the connectable console. This model has no separate RJ45 serial console.",
      "PDF pages 24/25 are printed pages 18/19. The model heading identifies GSM4352; an introductory sentence mistakenly repeats GSM4328."],
    map: Array.from({ length: 53 }, (_, i) => [i + 1, i + 1]) }],
  ["M4500 family", { series: "M4500", model: "M4500-48XF8C", sku: "XSM4556", front: 6, rear: 7,
    configuration: "48 SFP28 sockets configured at 25G, eight QSFP28 sockets at 100G, two APS750W AC supplies and six ATF402 rear fan trays, front-to-back airflow.",
    limitations: ["The manufacturer default SFP28 speed is 10G; this inventory explicitly selects 25G configuration. QSFP28 defaults to 100G. Breakout modes do not add physical apertures.",
      "Rear page 7 identifies and illustrates six trays FAN6 through FAN1. The airflow paragraph on page 14 says four; this trace follows the exact rear figure and numbered tray list.",
      "The rear PSU order is PSU2 on the left and PSU1 on the right. USB storage is nonconnectable artwork."],
    map: [[49, 1], [50, 2], [51, 3], [52, 4], [53, 57]] }],
]);
const profiles = new Map();

/** Resolve explicitly selected NETGEAR SKUs without using editable saved inventory to generate hardware geometry. */
export function resolveNetgearFamilyFaceplate(device) {
  if (device?.faceplate?.vendor !== "NETGEAR" || !definitions.has(device.model)) return null;
  if (!profiles.has(device.model)) {
    const canonical = canonicalFaceplateDevice(device);
    if (!canonical) return null;
    const definition = definitions.get(device.model);
    const source = `${root}/${definition.series}/${definition.series}_HIG_EN.pdf`;
    const factories = { M4250: m4250Panels, M4300: m4300Panels, M4350: m4350Panels, M4500: m4500Panels };
    profiles.set(device.model, {
      id: `netgear-${definition.sku.toLowerCase()}-selected`, sku: definition.sku,
      defaultFace: definition.series === "M4250" ? "rear" : "front",
      fidelity: "model", panelFidelity: { front: "model", rear: "model" },
      inventoryRevision: 1, inventoryComplete: true, rearHardwareVerified: true,
      source, sourcePage: `PDF front page ${definition.front}; rear page ${definition.rear}`,
      evidence: { scope: "model", models: [definition.model, definition.sku], selectedModel: definition.model,
        catalogAlias: device.model, configuration: definition.configuration,
        front: `${source}#page=${definition.front}`, rear: `${source}#page=${definition.rear}`,
        provenance: "Personally inspected manufacturer front/rear figures; optional power population is stated separately." },
      note: `${device.model} explicitly selects ${definition.model} (${definition.sku}). ${definition.configuration}`,
      limitations: [...definition.limitations, "Status lenses are static hardware artwork. Side, top and internal details are outside this front/rear projection."],
      catalogDiscrepancies: ["Original family inventories all used 48 PoE copper, four SFP+ and one management endpoint. Only new instances receive the selected SKU inventory; historical IDs, labels, types, speeds and settings remain untouched.",
        "Revision 0 maps only the supported original connector sequence. Unsupported copper/optical endpoints and all unknown revisions remain explicitly unmapped."],
      legacyLayouts: [{ inventoryRevision: 0, portIndexMap: Object.fromEntries(definition.map),
        portLabels: Object.fromEntries([...Array.from({ length: 52 }, (_, i) => [i + 1, String(i + 1)]), [53, "MGMT"]]) }],
      chassis: { x: .025, y: .04, width: .95, height: .92 },
      faces: factories[definition.series](canonical.device.ports),
    });
  }
  return profiles.get(device.model);
}

/** Place ancillary hardware using normalized, top-left component bounds. */
function part(kind, x, y, width, height, role, variant) {
  return { kind, x, y, width, height, ...(role ? { role } : {}), ...(variant ? { variant } : {}) };
}

/** Reserve a bounded region for manufacturer markings without adding cable endpoints. */
function marking(label, x, y, width, height, fontSize = 3) {
  return { ...part("text", x, y, width, height), label, fontSize };
}

/** Bind a canonical index to its connector center, preserving independent physical and user captions. */
function socket(ports, index, x, y, kind, width = .029, height = .25, captionY = y < .55 ? .20 : .93, captionX = x) {
  const port = ports.find((entry) => entry.portIndex === index);
  const physicalLabel = port.type === "USB_C_CONSOLE" ? "USB-C" : port.type === "USB_MINI_CONSOLE" ? "USB" : port.label;
  return { portIndex: index, type: port.type, label: port.label, physicalLabel,
    connectorKind: kind, x, y, width, height,
    descriptionAnchor: { x: captionX, y: captionY, fontSize: 5.5, boxHeight: 7 } };
}

/** Trace a dense double-row copper bank with its observed wider inter-bank gaps. */
function copper(ports, count, left, step, bank, gap) {
  return Array.from({ length: count }, (_, i) => {
    const column = Math.floor(i / 2);
    return socket(ports, i + 1, left + column * step + Math.floor(column / bank) * gap,
      i % 2 === 0 ? .40 : .72, i % 2 === 0 ? "rj45-inverted" : "rj45");
  });
}

/** Place a static system LED stack with labels in a narrow dedicated control strip. */
function status(left, top, names, step = .11) {
  return names.flatMap((name, i) => [
    { ...part("led", left, top + i * step, .005, .035, `status-${name}`, "square"), active: false },
    marking(name, left + .008, top + i * step, .024, .038, 2.3),
  ]);
}

/** Trace the AV model's replicated front indicators and five rear eight-copper banks. */
function m4250Panels(ports) {
  const front = [marking("NETGEAR AV Line", .012, .10, .12, .10, 5),
    marking("M4250-40G8XF-PoE+", .012, .23, .15, .07, 3.5),
    part("usb", .066, .62, .035, .17, "storage-usb"),
    part("usb-c", .133, .74, .021, .075, "unused-led-extension"),
    marking("USB", .065, .52, .037, .07), marking("LED EXT", .126, .62, .035, .065),
    part("button", .491, .40, .018, .18, "m10-mount", "reset"),
    ...status(.957, .38, ["POWER", "FAN", "PoE"], .10)];
  for (let i = 0; i < 48; i++) {
    const col = Math.floor(i / 2), x = col < 20 ? .21 + col * .027 + (col >= 10 ? .045 : 0) : .828 + (col - 20) * .018;
    front.push({ ...part("led", x, i % 2 === 0 ? .35 : .56, .008, .055, `replicated-port-${i + 1}`), active: false });
  }
  const rear = copper(ports, 40, .105, .0325, 4, .008);
  for (let i = 0; i < 8; i++) rear.push(socket(ports, 41 + i, .795 + Math.floor(i / 2) * .033,
    i % 2 === 0 ? .40 : .72, "sfp", .030));
  rear.push(socket(ports, 49, .058, .72, "rj45", .030), socket(ports, 50, .058, .40, "console-inverted", .030),
    socket(ports, 51, .018, .80, "usb-c", .022, .075, .95));
  return { front: { ports: [], components: front }, rear: { ports: rear, components: [
    ...status(.008, .27, ["PWR", "FAN", "PoE"], .10), part("button", .025, .66, .006, .05, "reset", "reset"),
    part("power", .925, .19, .065, .40, "integrated-ac", "ac-c14-inverted"),
    part("button", .937, .61, .042, .26, "power-switch", "rocker-horizontal"),
  ] } };
}

/** Trace the 52G PoE chassis's mixed uplinks, four exposed fans, RPS and one selected APS550W. */
function m4300Panels(ports) {
  const front = copper(ports, 48, .070, .0325, 6, .006);
  for (let i = 0; i < 4; i++) front.push(socket(ports, 49 + i, i < 2 ? .881 : .925,
    i % 2 === 0 ? .40 : .72, i < 2 ? (i % 2 === 0 ? "rj45-inverted" : "rj45") : "sfp", i < 2 ? .029 : .032));
  front.push(socket(ports, 53, .974, .45, "rj45", .033, .25, .22),
    socket(ports, 55, .035, .79, "usb-mini", .022, .10, .95));
  const rearComponents = [part("psu", .585, .02, .175, .94, "PSU1", "netgear-aps550w"),
    part("module-bay", .775, .02, .185, .94, "empty-psu2", "blank"),
    { ...part("power", .038, .59, .105, .31, "external-rps", "dc-multipin"), columns: 8 }];
  for (let i = 0; i < 4; i++) rearComponents.push(part("fan", .164 + i * .101, .03, .09, .89, `fixed-fan-${i + 1}`, "netgear-fixed-swept"));
  return { front: { ports: front, components: [
    marking("NETGEAR", .002, .025, .045, .065, 3), part("lcd", .008, .14, .014, .19, "stack-id", "seven-segment"),
    ...status(.008, .41, ["PWR1", "PWR2", "FAN", "MASTER"], .075), part("button", .008, .78, .007, .065, "reset", "reset"),
    part("usb", .958, .68, .033, .13, "storage-usb"), part("vent", .052, .01, .883, .11, "top-grille", "honeycomb"),
  ] }, rear: { ports: [socket(ports, 54, .087, .30, "console", .035, .25, .09)], components: rearComponents } };
}

/** Trace GSM4352's four full-width copper banks and standard rear with internal power and covered APS bays. */
function m4350Panels(ports) {
  const front = copper(ports, 48, .112, .0319, 6, .009);
  for (let i = 0; i < 4; i++) front.push(socket(ports, 49 + i, .923 + Math.floor(i / 2) * .041,
    i % 2 === 0 ? .40 : .72, "sfp", .032));
  front.push(socket(ports, 54, .052, .78, "usb-c", .025, .075, .94));
  const rear = [part("button", .025, .25, .024, .36, "power-switch", "rocker"),
    part("usb", .064, .48, .035, .12, "storage-usb-1"), part("usb", .064, .66, .035, .12, "storage-usb-2"),
    part("power", .515, .19, .060, .58, "internal-ac", "ac-c14"),
    part("module-bay", .619, .03, .167, .92, "empty-aps-1", "blank"),
    part("module-bay", .809, .03, .167, .92, "empty-aps-2", "blank")];
  for (let i = 0; i < 4; i++) rear.push(part("fan", .112 + i * .098, .035, .089, .88, `fixed-fan-${i + 1}`, "netgear-fixed-swept"));
  return { front: { ports: front, components: [marking("NETGEAR", .008, .035, .052, .07, 3.5),
    part("lcd", .045, .22, .015, .18, "stack-id", "seven-segment"), ...status(.016, .34, ["POWER", "FAN", "PoE MAX", "MASTER"], .09),
    part("button", .015, .80, .008, .06, "reset", "reset"), part("vent", .075, .005, .9, .10, "top-grille", "honeycomb") ] },
    rear: { ports: [socket(ports, 53, .082, .25, "rj45", .035, .24, .065)], components: rear } };
}

/** Trace the optical M4500's 48 SFP28 and eight wider QSFP28 apertures with six individually framed rear trays. */
function m4500Panels(ports) {
  const front = [];
  for (let i = 0; i < 48; i++) {
    const column = Math.floor(i / 2);
    const slot = socket(ports, i + 1, .040 + column * .0312 + Math.floor(column / 8) * .010,
      i % 2 === 0 ? .50 : .78, "sfp", .029, .20, i % 2 === 0 ? .34 : .95);
    slot.compatibleTypes = ["SFP_PLUS_10G"];
    front.push(slot);
  }
  for (let i = 0; i < 8; i++) front.push(socket(ports, 49 + i, .828 + Math.floor(i / 2) * .044,
    i % 2 === 0 ? .50 : .78, "qsfp", .040, .20, i % 2 === 0 ? .34 : .95));
  front.push(socket(ports, 57, .14, .175, "rj45", .030, .13, .055),
    socket(ports, 58, .097, .175, "console", .030, .13, .055));
  const rear = [part("psu", .015, .02, .195, .95, "PSU2", "netgear-m4500-ac"),
    part("psu", .80, .02, .195, .95, "PSU1", "netgear-m4500-ac")];
  for (let i = 0; i < 6; i++) rear.push(part("fan", .215 + i * .0965, .02, .094, .95, `FAN${6 - i}`, "netgear-m4500-tray"));
  const components = [part("usb", .040, .075, .028, .10, "storage-usb"),
    part("vent", .30, .015, .50, .13, "top-grille", "honeycomb"), marking("NETGEAR M4500-48XF8C", .81, .015, .17, .07, 4)];
  for (let i = 0; i < 6; i++) components.push({ ...part("led", .169 + i * .008, .12, .005, .055, `system-${i}`), active: false });
  for (const [y, color] of [[.265, "#288f9c"], [.615, "#72558a"]]) {
    components.push({ ...part("panel-accent", .025, y, .959, .02, "odd-even-color-band"), color, taper: 0 });
  }
  return { front: { ports: front, components }, rear: { ports: [], components: rear } };
}
