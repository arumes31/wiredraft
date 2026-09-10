const HARDWARE = "https://www.cisco.com/c/en/us/td/docs/security/firepower/";
const definitions = new Map([
  ["Secure Firewall 1010", { series: 1010, guide: "1010/hw/guide/hw-install-1010/overview.html", figures: "Front/rear Figures 6–7; hardware specifications", widthMM: 199.4 }],
  ...[1120, 1140].map((series) => [`Secure Firewall ${series}`, { series, guide: "1100/hw/guide/hw-install-1100/overview.html", figures: "Front/rear Figures 6–7; features table" }]),
  ...[2110, 2120, 2130, 2140].map((series) => [`Secure Firewall ${series}`, { series, guide: "2100/hw/guide/b_install_guide_2100/overview.html", figures: series < 2130 ? "Front Figure 9; rear Figure 13; features table" : "Front Figure 10; rear Figure 14; features table" }]),
  ...[4110, 4120, 4140, 4150].map((series) => [`Secure Firewall ${series}`, { series, guide: "4100/hw/guide/b_install_guide_4100/overview.html", figures: "Front Figure 5; rear Figure 7; features table" }]),
]);

/** Resolve model-scoped Cisco Firepower drawings using corrected canonical inventories. */
export function buildCiscoFirepowerModelFaceplate(device) {
  const definition = definitions.get(device.model);
  if (!definition || device.faceplate.vendor !== "Cisco") return null;
  const { series, guide, figures, widthMM = 438 } = definition;
  const source = `${HARDWARE}${guide}`;
  const width = widthMM / 438;
  return {
    id: `enterprise-cisco-firepower-${series}`, family: device.model, fidelity: "model", source, sourcePage: figures,
    evidence: { models: [device.model], scope: "model", reviewed: "2026-09-10", front: source, rear: source,
      sharedChassis: `The hardware guide explicitly covers Firepower ${series}; the illustrated panel group and the model's power configuration were checked separately.` },
    inventoryRevision: 1, legacyLayouts: [{ inventoryRevision: 0, portIndexMap: legacyPortIndexMap(series), portLabels: legacyPortLabels(series) }],
    inventoryComplete: true, inventoryNotes: ["The base configuration leaves optional network modules and the second SSD bay unpopulated. USB storage connectors are decorative."],
    catalogDiscrepancies: legacyNotes(series), defaultFace: series < 2000 ? "rear" : "front",
    chassis: { x: (1 - width) / 2, y: .05, width, height: .9 },
    faces: series === 1010 ? desktopFaces(device) : series < 2000 ? smallRackFaces(device)
      : series < 4000 ? mediumRackFaces(device, series) : largeRackFaces(device, series),
  };
}

/** Enumerate retained legacy endpoints so obsolete data cannot occupy a shifted management socket. */
function legacyPortIndexMap(series) {
  const unchanged = series >= 2000 && series < 4000 ? 18 : 8;
  const mapping = Object.fromEntries(Array.from({ length: unchanged }, (_, index) => [index + 1, index + 1]));
  if (series === 1010) Object.assign(mapping, { 17: 9, 18: 10 });
  else if (series < 2000) Object.assign(mapping, { 13: 9, 14: 10, 15: 11, 16: 12, 17: 13, 18: 14 });
  else if (series >= 4000) Object.assign(mapping, { 33: 9, 35: 10 });
  return mapping;
}

/** Identify generated labels from revision zero without overriding a user's renamed port. */
function legacyPortLabels(series) {
  return Object.fromEntries(Object.keys(legacyPortIndexMap(series)).map((key) => {
    const index = Number(key);
    const label = series >= 4000 ? (index <= 8 ? `SFP28${index}` : index === 33 ? "MGMT1" : "CONSOLE1")
      : index <= 12 ? String(index) : index <= 16 ? `SFP+${index - 12}` : index === 17 ? "MGMT1" : "CONSOLE1";
    return [index, label];
  }));
}

/** Disclose exactly which older inventory assumptions were corrected for new devices. */
function legacyNotes(series) {
  if (series === 1010) return ["Earlier catalog versions added four nonexistent copper and four nonexistent optical ports. Those saved endpoints remain routable as unmapped inventory. Ports 7 and 8 support PoE+.",
    "The console is Mini-B USB plus RJ45, not USB-C. New inventory includes both; existing USB-C console identity maps to Mini-B artwork."];
  if (series < 2000) return ["Earlier inventory added four nonexistent copper ports and classified the four 1G SFP slots as SFP+. Saved extras remain unmapped; supported endpoints keep their cable identities.",
    "The console is Mini-B USB plus RJ45, not USB-C. New inventory includes both; existing USB-C console identity maps to Mini-B artwork."];
  if (series < 4000) return ["The physical console is RJ45, not USB-C. Existing console cable identities are retained with the correct artwork.",
    ...(series < 2130 ? ["The four fixed optical ports are 1G SFP, not 10G SFP+. New inventory uses the documented speed; saved endpoints retain their identities."] : [])];
  return ["This appliance is 1U with eight fixed 1/10G SFP+ ports and two optional network bays. Earlier inventory incorrectly used 3U and 24 SFP28 plus eight QSFP28 ports; surplus saved endpoints remain unmapped.",
    "There is one 1G SFP management socket, not two RJ45 management sockets. The first saved management identity maps to its physical location."];
}

/** Describe a normalized hardware component without manufacturing-scale claims. */
function part(kind, x, y, width, height, label, variant) {
  return { kind, x, y, width, height, ...(label ? { label } : {}), ...(variant ? { variant } : {}) };
}

/** Attach immutable canonical and known legacy identities to one traced physical socket. */
function socket(device, label, x, y, width, physicalLabel, options = {}) {
  const port = device.ports.find((candidate) => candidate.label === label);
  if (!port) throw new Error(`${device.model}: documented socket ${label} is missing from the catalog`);
  return { label, type: port.type, portIndex: port.portIndex, x, y, width, height: .22, physicalLabel, ...options };
}

/** Follow Cisco's odd-above-even paired columns at explicitly measured centers. */
function copperBank(device, xs, ys, width) {
  return xs.flatMap((x, column) => ys.map((y, row) => socket(device, String(column * 2 + row + 1), x, y, width, `1/${column * 2 + row + 1}`)));
}

/** Trace the fanless 1010, including rear PoE sockets and the keyed four-contact DC input. */
function desktopFaces(device) {
  const front = { ports: [], components: [part("text", .04, .10, .28, .12, "Firepower 1000 Series"), part("text", .435, .45, .13, .21, "CISCO")] };
  const rear = { ports: [...copperBank(device, [.269, .340, .413, .484], [.30, .71], .063),
    socket(device, "MGMT1", .766, .30, .063, "MGMT"),
    socket(device, "CONSOLE1", .849, .77, .037, "USB CONSOLE", { height: .075, connectorKind: "usb-mini", compatibleTypes: ["USB_C_CONSOLE"] }),
    socket(device, "RJ45-CONSOLE1", .766, .70, .063, "CONSOLE"),
  ], components: [{ ...part("power", .05, .55, .055, .30, "12V", "dc-multipin"), columns: 2 },
    part("usb", .885, .43, .030, .36), part("button", .954, .69, .013, .065, undefined, "reset"),
    part("vent", .949, .10, .014, .18, undefined, "slit"), part("text", .025, .22, .063, .11, "CISCO"),
    part("text", .54, .44, .11, .12, "PoE+ 7/8"),
  ] };
  for (const x of [.027, .053, .079]) rear.components.push(part("led", x - .004, .06, .009, .05));
  return { front, rear };
}

/** Trace the 1120/1140 rear service cluster, copper bank, 1G optical bank and SSD. */
function smallRackFaces(device) {
  const front = { ports: [], components: [part("text", .025, .35, .05, .24, "CISCO"),
    part("text", .86, .10, .13, .12, "Firepower 1000 Series"), part("vent", .35, .40, .18, .55, undefined, "mesh")] };
  const rear = { ports: [...copperBank(device, [.391, .425, .457, .489], [.30, .70], .030),
    socket(device, "MGMT1", .340, .30, .035, "MGMT"),
    socket(device, "CONSOLE1", .301, .82, .020, "USB CONSOLE", { height: .075, connectorKind: "usb-mini", compatibleTypes: ["USB_C_CONSOLE"] }),
    socket(device, "RJ45-CONSOLE1", .340, .70, .035, "CONSOLE"),
  ], components: [part("button", .047, .15, .028, .50, undefined, "power"), part("power", .084, .08, .060, .52, "AC", "ac"),
    part("vent", .015, .78, .14, .20, undefined, "perforated"), part("vent", .159, .08, .035, .66, undefined, "perforated"),
    part("vent", .22, .51, .037, .40, undefined, "perforated"), part("usb", .272, .47, .013, .32),
    part("vent", .512, .07, .11, .70, undefined, "mesh"), part("vent", .695, .10, .035, .44, undefined, "mesh"),
    part("button", .724, .74, .008, .065, undefined, "reset"), part("led", .757, .83, .006, .045),
    part("module-bay", .787, .61, .198, .27, "SSD", "populated"),
  ] };
  for (let index = 0; index < 4; index++) rear.ports.push(socket(device, `SFP${index + 1}`, [.641, .675][Math.floor(index / 2)],
    [.30, .68][index % 2], .030, `1/${index + 9}`, { connectorKind: "sfp", compatibleTypes: ["SFP_PLUS_10G"] }));
  for (const x of [.540, .563, .586]) rear.components.push(part("led", x, .83, .006, .045));
  return { front, rear };
}

/** Trace the 2100 panels, keeping 2130 and 2140 power populations distinct. */
function mediumRackFaces(device, series) {
  const modular = series >= 2130;
  const front = { ports: [...copperBank(device, [.333, .366, .400, .434, .467, .501], [.39, .74], .031),
    socket(device, "MGMT1", .277, .39, .032, "MGMT"), socket(device, "CONSOLE1", .277, .74, .032, "CONSOLE", { connectorKind: "console", compatibleTypes: ["USB_C_CONSOLE"] }),
  ], components: [part("vent", .074, .32, .18, .34, undefined, "mesh"), part("usb", .212, .68, .028, .10),
    part("module-bay", modular ? .542 : .766, .04, .223, .26, "SSD 1", "populated"),
    part("module-bay", .773, modular ? .04 : .70, .215, .26, "SSD 2", "blank"),
    part("vent", .337, .03, .18, .07, undefined, "mesh"), part("handle", .415, .93, .075, .035),
  ] };
  for (let index = 0; index < 4; index++) front.ports.push(socket(device, `${modular ? "SFP+" : "SFP"}${index + 1}`,
    [.604, .638, .673, .708][index], .76, .031, `1/${index + 13}`, { connectorKind: "sfp", ...(modular ? {} : { compatibleTypes: ["SFP_PLUS_10G"] }) }));
  if (modular) front.components.push(part("module-bay", .773, .38, .215, .59, "NETWORK MODULE", "blank"));
  else front.components.push(part("vent", .79, .43, .17, .10, undefined, "mesh"));
  front.components.push(part("vent", .535, modular ? .43 : .20, .225, modular ? .11 : .34, undefined, "mesh"),
    part("vent", .535, .55, .035, .35, undefined, "mesh"), part("vent", .74, .55, .020, .35, undefined, "mesh"));
  for (const x of [.109, .127]) front.components.push(part("led", x - .003, .87, .006, .045));
  for (const x of [.159, .178, .194]) for (const y of [.855, .93]) front.components.push(part("led", x - .003, y, .006, .035));
  const rear = { ports: [], components: [part("button", .004, .21, .019, .43, undefined, "power")] };
  if (modular) {
    rear.components.push(part("psu", .035, .035, .233, .93, "PSU 1", "ac"),
      series === 2140 ? part("psu", .733, .035, .233, .93, "PSU 2", "ac") : part("module-bay", .733, .035, .233, .93, "PSU 2", "blank"));
    for (const x of [.323, .42, .516, .613]) rear.components.push(part("fan", x, .10, .070, .80));
  } else {
    rear.components.push(part("vent", .08, .125, .125, .74, undefined, "mesh"), part("power", .232, .215, .065, .51, "AC", "ac"),
      part("vent", .515, .08, .21, .85, undefined, "mesh"));
  }
  for (const y of [.43, .81]) rear.components.push(part("button", .978, y - .04, .012, .08, undefined, "ground"));
  return { front, rear };
}

/** Trace the 4100 fixed SFP bank, two expansion bays, six fans and base power supplies. */
function largeRackFaces(device, series) {
  const front = { ports: [socket(device, "CONSOLE1", .084, .30, .032, "CONSOLE"),
    socket(device, "MGMT1", .130, .30, .031, "MGMT", { connectorKind: "sfp", compatibleTypes: ["RJ45_1G"] })], components: [
    part("usb", .150, .245, .031, .11), part("vent", .005, .56, .305, .37, undefined, "mesh"),
    part("vent", .195, .065, .115, .29, undefined, "mesh"), part("vent", .005, .065, .025, .49, undefined, "mesh"),
    part("vent", .478, .065, .028, .87, undefined, "mesh"), part("handle", .335, .94, .11, .035),
    part("module-bay", .515, .04, .21, .26, "SSD 1", "populated"), part("module-bay", .766, .04, .21, .26, "SSD 2", "blank"),
    part("module-bay", .515, .36, .235, .59, "NETWORK MODULE 2", "blank"), part("module-bay", .766, .36, .22, .59, "NETWORK MODULE 3", "blank"),
  ] };
  for (let index = 0; index < 8; index++) front.ports.push(socket(device, `SFP+${index + 1}`,
    [.348, .384, .420, .456][Math.floor(index / 2)], [.32, .72][index % 2], .034, `1/${index + 1}`,
    { connectorKind: "sfp", compatibleTypes: ["SFP28_25G"] }));
  for (const x of [.042, .20]) front.components.push(part("led", x - .004, .31, .008, .065));
  const rear = { ports: [], components: [part("button", .055, .28, .018, .45, undefined, "power"),
    part("psu", .078, .065, .113, .87, "PSU 1", "ac"),
    series < 4140 ? part("module-bay", .217, .065, .113, .87, "PSU 2", "blank") : part("psu", .217, .065, .113, .87, "PSU 2", "ac"),
  ] };
  for (const x of [.360, .454, .547, .639, .730, .822]) rear.components.push(part("fan", x, .07, .081, .85));
  for (const y of [.23, .67]) rear.components.push(part("button", .924, y - .035, .010, .07, undefined, "ground"));
  return { front, rear };
}
