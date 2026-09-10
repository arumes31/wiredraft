const guides = {
  c9200: "https://www.cisco.com/c/en/us/td/docs/switches/lan/catalyst9200/hardware/install/b-c9200-hig/product_overview.html",
  c9300: "https://www.cisco.com/c/en/us/td/docs/switches/lan/catalyst9300/hardware/install/b_c9300_hig/Product-overview.html",
};
const datasheets = {
  c9200: "https://www.cisco.com/c/en/us/products/collateral/switches/catalyst-9200-series-switches/nb-06-cat9200-ser-data-sheet-cte-en.html",
  c9300: "https://www.cisco.com/c/en/us/products/collateral/switches/catalyst-9300-series-switches/nb-06-cat9300-ser-data-sheet-cte-en.html",
};
const models = new Map([
  ["Catalyst C9200L-24T-4G", { series: "c9200", copper: 24, supply: "PWR-C5-125WAC" }],
  ["Catalyst C9200L-24P-4X", { series: "c9200", copper: 24, supply: "PWR-C5-600WAC" }],
  ["Catalyst C9200L-48T-4G", { series: "c9200", copper: 48, supply: "PWR-C5-125WAC" }],
  ["Catalyst C9200L-48P-4X", { series: "c9200", copper: 48, supply: "PWR-C5-1KWAC" }],
  ["Catalyst C9300L-24T-4G", { series: "c9300", copper: 24, supply: "PWR-C1-350WAC-P" }],
  ["Catalyst C9300L-48P-4X", { series: "c9300", copper: 48, supply: "PWR-C1-715WAC-P" }],
]);

/** Resolve individually listed fixed-uplink Catalyst SKUs in their documented base configuration. */
export function buildCiscoCatalystModelFaceplate(device) {
  const definition = models.get(device.model);
  if (!definition || device.faceplate?.vendor !== "Cisco") return null;
  const { series, copper, supply } = definition;
  const source = guides[series];
  const series9200 = series === "c9200";
  return {
    id: `enterprise-cisco-${device.model.slice(9).toLowerCase()}`, family: device.model, fidelity: "model",
    source, sourcePage: series9200
      ? "Table 1 individual SKUs; Front Panel of a C9200L Switch; rear Figure 3; datasheet Figure 1 and power/stack ordering tables"
      : "Table 2 individual SKUs; C9300L front Figure 4 and rear Figure 11; datasheet Figure 1 and power/stack ordering tables",
    evidence: { models: [device.model], scope: "model", reviewed: "2026-09-10", front: source, rear: source,
      supplemental: datasheets[series],
      configuration: `One AC supply (${supply}); optional PSU 2 bay covered; optional StackWise adapters uninstalled with both adapter positions covered.`,
      sharedChassis: "Cisco lists each SKU in the hardware-guide model table and scopes the front/rear illustrations to the fixed-uplink L chassis. Individual 24/48-port bank positions are corroborated by the datasheet product photographs.",
    },
    inventoryRevision: 1, inventoryComplete: true,
    legacyLayouts: [{ inventoryRevision: 0, portIndexMap: Object.fromEntries(
      Array.from({ length: copper + 5 }, (_, index) => [index + 1, index + 1])) }],
    catalogDiscrepancies: [
      "New inventory includes the previously omitted front Mini-B console and rear RJ45 management socket. Revision-zero saved devices retain their original data and rear RJ45 console identities; absent endpoints are not added.",
      `Base configuration: one ${supply} AC supply, a covered spare PSU bay and uninstalled optional StackWise adapters. Storage USB sockets are decorative. ${series9200 ? "The two rear fans are fixed." : "The rear has three fan modules and a separate USB 3.0 storage socket; C9300L has no StackPower sockets."}`,
    ],
    defaultFace: "front", chassis: { x: 0, y: .05, width: 1, height: .9 },
    faces: { front: frontPanel(device, definition), rear: series9200 ? rear9200(device, definition) : rear9300(device, definition) },
  };
}

/** Describe a measured physical component using normalized chassis bounds. */
function part(kind, x, y, width, height, label, variant) {
  return { kind, x, y, width, height, ...(label ? { label } : {}), ...(variant ? { variant } : {}) };
}

/** Bind a traced socket to its canonical index, independently of editable names. */
function socket(device, index, x, y, width, height, physicalLabel) {
  const port = device.ports.find((candidate) => candidate.portIndex === index);
  if (!port) throw new Error(`${device.model}: documented socket index ${index} is missing from the catalog`);
  return { label: port.label, type: port.type, portIndex: index, x, y, width, height, physicalLabel };
}

/** Trace the fixed copper banks, single-row uplinks and distinct L-series console/storage strip. */
function frontPanel(device, { series, copper }) {
  const series9200 = series === "c9200";
  const starts = series9200 ? [.033, .234, .436, .640] : [.030, .237, .440, .642];
  const activeBanks = copper === 24 ? starts.slice(2) : starts;
  const ports = Array.from({ length: copper }, (_, index) => socket(device, index + 1,
    activeBanks[Math.floor(index / 12)] + Math.floor((index % 12) / 2) * (series9200 ? .0315 : .0314),
    (index % 2 ? .69 : .36) + (series9200 ? .01 : 0), .0265, .22, String(index + 1)));
  const optical = series9200 ? [.854, .889, .924, .959] : [.859, .892, .926, .959];
  for (const [index, x] of optical.entries()) {
    ports.push(socket(device, copper + index + 1, x, series9200 ? .75 : .69, .031, .20,
      `${device.model.endsWith("4X") ? "10G" : "1G"}${index + 1}`));
  }
  ports.push(socket(device, copper + 6, series9200 ? .147 : .153, .105, series9200 ? .021 : .025, .08, "USB CONSOLE"));
  const components = [
    part("led", .009, .045, .009, .08, "UID"), part("text", .023, .035, .024, .07, "CISCO"),
    part("button", .049, .028, .012, .105, undefined, "reset"),
  ];
  const statusPositions = series9200
    ? [[.075, .04], [.091, .04], [.107, .04], [.075, .13], [.091, .13], [.107, .13]]
    : [[.071, .04], [.086, .04], [.101, .04], [.116, .04], [.131, .04], [.071, .13], [.086, .13]];
  for (const [x, y] of statusPositions) components.push(part("led", x, y, .004, .025));
  if (series9200) {
    components.push(part("usb", .166, .04, .031, .11), part("usb", .209, .04, .031, .11),
      part("vent", .258, .05, .152, .115, undefined, "slit"),
      part("vent", .426, .05, .186, .115, undefined, "slit"),
      part("vent", .630, .05, .185, .115, undefined, "slit"),
      part("vent", .836, .215, .14, .14, undefined, "mesh"));
  } else {
    components.push(part("usb", .173, .025, .039, .12),
      part("vent", .220, .025, .19, .115, undefined, "slit"),
      part("vent", .423, .025, .19, .115, undefined, "slit"),
      part("vent", .627, .025, .185, .115, undefined, "slit"),
      part("vent", .839, .04, .14, .29, undefined, "mesh"));
  }
  components.push(part("text", .699, .045, .104, .07, device.model.slice(9)));
  return { ports, components };
}

/** Trace the C9200L rear's two fixed fans, covered StackWise bays and left-inlet AC supply. */
function rear9200(device, { copper, supply }) {
  return { ports: [socket(device, copper + 5, .0622, .373, .034, .22, "CONSOLE"),
    socket(device, copper + 7, .0622, .761, .034, .22, "MGMT")], components: [
    part("led", .030, .89, .008, .045, "BEACON"),
    part("module-bay", .101, .06, .060, .90, "STACK BAY 1", "blank"),
    part("fan", .1644, .075, .0919, .851),
    part("module-bay", .262, .06, .061, .90, "STACK BAY 2", "blank"),
    part("fan", .325, .075, .087, .851),
    part("psu", .493, .045, .230, .91, supply, "ac"),
    part("module-bay", .748, .045, .230, .91, "OPTIONAL PSU 2", "blank"),
  ] };
}

/** Trace the C9300L rear's three fan modules, vertical storage USB and right-inlet AC supply. */
function rear9300(device, { copper, supply }) {
  return { ports: [socket(device, copper + 5, .061, .319, .0366, .22, "CONSOLE"),
    socket(device, copper + 7, .061, .695, .0366, .22, "MGMT")], components: [
    part("screw", .018, .16, .009, .06), part("screw", .018, .57, .009, .06),
    part("led", .019, .87, .008, .045, "BEACON"),
    part("fan", .103, .087, .085, .84),
    part("module-bay", .194, .06, .057, .90, "STACK BAY 1", "blank"),
    part("fan", .257, .087, .089, .84),
    part("module-bay", .351, .06, .058, .90, "STACK BAY 2", "blank"),
    part("fan", .413, .087, .090, .84), part("usb", .532, .29, .027, .61),
    part("psu", .592, .05, .186, .90, supply, "ac-inlet-right"),
    part("module-bay", .795, .05, .184, .90, "OPTIONAL PSU 2", "blank"),
  ] };
}
