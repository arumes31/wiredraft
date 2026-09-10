// Socket centers and panel regions are traced from the model illustrations on
// page 3 of the official operating instructions. Socket symbols retain a usable
// minimum size; optional modules are drawn with their unpopulated covers.
const MANUAL = "https://docs.sophos.com/nsg/hardware/operatinginstructions/xgs/sophos-operating-instructions-xgs-";
const PRODUCT = "https://www.sophos.com/en-gb/products/next-gen-firewall/xgs-1u-distributed-edge-firewalls";
const definitions = new Map([
  ["XGS 87", { series: 87, document: "87-87w-107-107w", desktop: true, widthMM: 230 }],
  ["XGS 107", { series: 107, document: "87-87w-107-107w", desktop: true, widthMM: 230 }],
  ["XGS 116", { series: 116, document: "116-116w-126-126w-136-136w", desktop: true, widthMM: 320 }],
  ["XGS 126", { series: 126, document: "116-116w-126-126w-136-136w", desktop: true, widthMM: 320 }],
  ["XGS 136", { series: 136, document: "116-116w-126-126w-136-136w", desktop: true, widthMM: 320 }],
  ["XGS 2100", { series: 2100, document: "2100-2300-3100-3300", supplemental: true }],
  ["XGS 2300", { series: 2300, document: "2100-2300-3100-3300" }],
  ["XGS 3100", { series: 3100, document: "2100-2300-3100-3300", supplemental: true }],
  ["XGS 3300", { series: 3300, document: "2100-2300-3100-3300" }],
  ["XGS 4300", { series: 4300, document: "4300-4500", supplemental: true }],
  ["XGS 4500", { series: 4500, document: "4300-4500" }],
]);

/** Build a model-scoped Sophos drawing from immutable catalog inventory. */
export function buildSophosModelFaceplate(device) {
  const definition = definitions.get(device.model);
  if (!definition || device.faceplate.vendor !== "Sophos") return null;
  const { series, desktop, widthMM, document, supplemental } = definition;
  const source = `${MANUAL}${document}.pdf`;
  const width = desktop ? widthMM / 438 : 1;
  const faces = desktop ? desktopFaces(device, series) : rackFaces(device, series);
  return {
    id: `enterprise-sophos-xgs-${series}`, family: `Sophos XGS ${series}`, fidelity: "model",
    source, sourcePage: "Operating Elements and Connections, p. 3; Interfaces and physical specifications, pp. 4–5",
    evidence: { models: [device.model], scope: "model", reviewed: "2026-09-10",
      front: `${source}#page=3`, rear: `${source}#page=3`, ...(supplemental ? { supplemental: PRODUCT } : {}) },
    inventoryNotes: ["Fixed interfaces are model-specific; optional modules remain unpopulated and USB storage sockets are decorative."],
    catalogDiscrepancies: [], defaultFace: desktop ? "rear" : "front",
    chassis: { x: (1 - width) / 2, y: .05, width, height: .9 }, faces,
  };
}

/** Describe a decorative part using coordinates relative to the physical chassis. */
function part(kind, x, y, width, height, label, variant) {
  return { kind, x, y, width, height, ...(label ? { label } : {}), ...(variant ? { variant } : {}) };
}

/** Anchor an existing canonical port on the socket center traced from the guide. */
function socket(device, label, x, y, width = .036, height = .22) {
  const port = device.ports.find((candidate) => candidate.label === label);
  if (!port) throw new Error(`${device.model}: documented socket ${label} is missing from the catalog`);
  return { label, type: port.type, portIndex: port.portIndex, x, y, width, height };
}

/** Place an explicitly documented two-row bank without redistributing its spacing. */
function copperBank(device, first, columns, xs, ys, width, evenTop = false) {
  return Array.from({ length: columns * 2 }, (_, index) => socket(device, String(first + index),
    xs[Math.floor(index / 2)], ys[(index + (evenTop ? 1 : 0)) % 2], width));
}

/** Trace the different desktop banks, front consoles and rear DC inputs. */
function desktopFaces(device, series) {
  const small = series <= 107;
  const front = { ports: [socket(device, "MICRO-USB", .101, .76, .031, .075)], components: [
    part("text", .017, .11, .22, .12, device.model),
    part("text", .405, .36, .22, .18, "SOPHOS"),
    part("usb", small ? .169 : .151, .44, small ? .024 : .018, .29),
  ], connectionMarker: { x: .24, y: .82, width: .35, height: .13 } };
  const rear = { ports: [], components: [], connectionMarker: { x: .025, y: .015, width: .245, height: .13 } };
  addDesktopIndicators(front.components, series);
  const consoleX = small ? .314 : .201;
  rear.ports.push(socket(device, "COM", consoleX, .44, small ? .058 : .043));
  rear.components.push(part("usb", consoleX - (small ? .026 : .022), .67, small ? .052 : .044, .12));
  const dcXs = small ? (series === 87 ? [.115] : [.115, .182]) : [.075, .13];
  for (const [index, x] of dcXs.entries()) rear.components.push(part("power", x - .017, .56, .034, .23, `DC${index + 1}`, "dc-barrel"));
  if (small) {
    rear.ports.push(socket(device, "F1", .468, .68, .061, .18),
      ...copperBank(device, 1, series === 87 ? 2 : 4, [.582, .653, .724, .795], [.34, .66], .059));
    rear.components.push(part("button", .92, .66, .012, .055, undefined, "reset"));
  } else {
    rear.ports.push(socket(device, "F1", .313, series === 116 ? .69 : .33, .046, .18));
    if (series !== 116) rear.ports.push(socket(device, "F2", .313, .66, .046, .18));
    const xs = series === 116 ? [.374, .440, .506] : [.374, .418, .462, .506];
    rear.ports.push(...copperBank(device, 1, xs.length, xs, [.33, .66], series === 116 ? .048 : .039));
    rear.ports.push(...copperBank(device, series === 116 ? 7 : 9, series === 116 ? 1 : 2,
      series === 116 ? [.69] : [.62, .69], [.33, .66], .048));
    rear.components.push(part("module-bay", .733, .08, .24, .82, "EXPANSION", "blank"),
      part("button", .555, .71, .011, .055, undefined, "reset"));
  }
  return { front, rear };
}

/** Reproduce the desktop link/speed banks and non-wireless status indicators. */
function addDesktopIndicators(components, series) {
  const columns = series === 87 ? 2 : series <= 116 ? 4 : 6;
  const start = series <= 107 ? .737 : .641;
  const step = series <= 107 ? .022 : .032;
  for (let column = 0; column < columns; column++) {
    for (const y of [.34, .45, .56, .67]) components.push(part("led", start + column * step, y, .008, .041));
  }
  for (const y of (series === 87 ? [.33, .47, .74] : [.33, .47, .61, .75])) {
    components.push(part("led", series <= 107 ? .87 : .918, y, .009, .043));
  }
}

/** Trace the rack models' left service cluster, optical banks and expansion slots. */
function rackFaces(device, series) {
  const large = series >= 4300;
  const consoleX = large ? .198 : .267;
  const microX = large ? .16 : .229;
  const front = { ports: [socket(device, "COM", consoleX, .29, .036),
    socket(device, "MICRO-USB", microX, .83, .02, .075),
    socket(device, "MGMT", large ? .248 : .322, .68, .036)], components: [
    part("text", .025, .035, .097, .14, "SOPHOS"), part("lcd", .026, .33, .097, .29, "SOPHOS"),
    part("usb", consoleX - .017, .52, .034, .115), part("usb", consoleX - .017, .72, .034, .115),
  ] };
  for (const x of [.04, .064, .088, .112]) front.components.push(part("button", x - .008, .79, .016, .09, undefined, "navigation"));
  const ledX = large ? .158 : .152;
  for (const y of [.28, .4, .52, .64]) front.components.push(part("led", ledX - .004, y, .008, .047));
  if (!large) front.components.push(part("vent", .175, .29, .025, .35, undefined, "perforated"));
  front.components.push(part("button", ledX - .003, .12, .007, .043, undefined, "reset"));
  if (large) {
    // The guide numbers optical ports F2/F4 above F1/F3, and copper even above odd.
    for (const [label, x, y] of [["F1", .311, .68], ["F2", .311, .36], ["F3", .35, .68], ["F4", .35, .36]]) {
      front.ports.push(socket(device, label, x, y, .035, .20));
    }
    front.ports.push(...copperBank(device, 1, 4, [.389, .426, .472, .509], [.35, .68], .033, true));
    front.components.push(part("module-bay", .543, .12, .214, .81, "FLEXI A", "blank"),
      part("module-bay", .768, .12, .215, .81, "FLEXI B", "blank"));
  } else {
    const fiberXs = series < 3100 ? [.493, .539] : [.388, .434, .493, .539];
    for (const [index, x] of fiberXs.entries()) front.ports.push(socket(device, `F${index + 1}`, x, .75, .034, .18));
    front.ports.push(...copperBank(device, 1, 4, [.587, .622, .67, .705], [.35, .68], .032, true));
    front.components.push(part("module-bay", .755, .12, .221, .81, "FLEXI A", "blank"));
  }
  return { front, rear: { ports: [], components: rackRear(series),
    connectionMarker: { x: .025, y: .82, width: .245, height: .13 } } };
}

/** Trace fixed AC, redundant DC and the populated/empty PSU slots without invented FRUs. */
function rackRear(series) {
  const large = series >= 4300;
  const parts = [];
  for (const x of (large ? [.062, .158, .365, .461, .564] : [.383, .479])) {
    parts.push(part("fan", x, .16, .08, .73));
  }
  parts.push(part("button", large ? .66 : .683, .15, .026, .28, undefined, "power"));
  if (series === 4500) {
    parts.push(part("module-bay", .714, .06, .147, .88, "PSU 2", "blank"),
      part("psu", .867, .06, .121, .88, "PSU 1", "ac"));
  } else {
    parts.push(part("power", .811, .26, .048, .60, "AC", "ac"), part("vent", .871, .14, .108, .76, undefined, "perforated"));
    if (large) parts.push({ ...part("power", .698, .36, .10, .26, "RPS", "dc-multipin"), columns: 9 });
    else parts.push(part("module-bay", .596, .31, .082, .51, "RPS", "blank"), part("usb", .744, .66, .03, .13));
    const pinXs = large ? [.048, .277] : [.048, .232];
    for (const x of pinXs) for (const y of [.24, .65]) parts.push(part("button", x - .006, y, .012, .08, undefined, "mount"));
  }
  return parts;
}
