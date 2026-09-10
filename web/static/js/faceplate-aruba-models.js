import { canonicalFaceplateDevice } from "./faceplate-profile.js";

const guides = {
  "6100": "https://arubanetworking.hpe.com/techdocs/hardware/switches/6100/IGSG/igsg_6000-6100.pdf",
  "6200": "https://arubanetworking.hpe.com/techdocs/Switches/Aruba_6200/5200-6885/index.html",
  "8325": "https://arubanetworking.hpe.com/techdocs/hardware/switches/8325/IGSG/Aruba_8325_IGSG_en_us.pdf",
};

const models = new Map([
  ["CX 6100 24G 4SFP+", { sku: "JL678A", series: "6100", copper: 24 }],
  ["CX 6100 48G 4SFP+", { sku: "JL676A", series: "6100", copper: 48 }],
  ["CX 6200F 24G 4SFP+", { sku: "JL725A", series: "6200", copper: 24 }],
  ["CX 6200F 48G 4SFP+", { sku: "JL727A", series: "6200", copper: 48 }],
  ["CX 8325-48Y8C", { sku: "JL624A", series: "8325" }],
]);
const cache = new Map();

/** Resolve only an explicitly traced Aruba chassis and its documented hardware configuration. */
export function resolveArubaFaceplate(device) {
  if (device?.faceplate?.vendor !== "HPE Aruba" || !models.has(device.model)) return null;
  if (!cache.has(device.model)) {
    const definition = models.get(device.model);
    const canonical = canonicalFaceplateDevice(device);
    if (!canonical) return null;
    const { sku, series, copper } = definition;
    const originalCount = copper ? copper + 5 : 57;
    const source = guides[series];
    const front = series === "6200" ? source.replace("index.html", "tov_001.png") : `${source}#page=${series === "6100" ? 7 : 10}`;
    const rear = series === "6200" ? source.replace("index.html", "tel_026.png") : `${source}#page=${series === "6100" ? 13 : 22}`;
    cache.set(device.model, {
      id: `aruba-${sku.toLowerCase()}`, sku, defaultFace: "front", fidelity: "model",
      panelFidelity: { front: "model", rear: "model" }, inventoryComplete: true,
      source, sourcePage: series === "6200" ? "Front and rear panel illustrations" : `Front ${series === "6100" ? "7–10" : "10, 18"}; rear ${series === "6100" ? 13 : "22–23"}`,
      evidence: { models: [device.model, sku], front, rear }, inventoryRevision: 1,
      legacyLayouts: [{ inventoryRevision: 0,
        portIndexMap: Object.fromEntries(Array.from({ length: originalCount }, (_, index) => [index + 1, index + 1])),
        portLabels: { [originalCount]: "CONSOLE1" } }],
      note: `The ${sku} front and rear are traced from the manufacturer's installation guide.`,
      limitations: [series === "6200" ? `The selected ${sku} is the 370W Class 4 PoE configuration; the catalog title omits its power suffix.`
        : series === "8325" ? "The selected JL624A bundle has front-to-back airflow, six fans and two AC power supplies; DC bundles use different inlets."
          : `The selected ${sku} is the non-PoE chassis.`,
        "Side ventilation and top details are outside the front/rear projection."],
      catalogDiscrepancies: [series === "8325"
        ? "Older inventories omit OOB Ethernet and the Micro-USB console. New instances include both, with the existing RJ45 console index retained."
        : "The physical console is USB-C. Older Console endpoint types remain unchanged; their socket artwork follows the actual USB-C inlet.",
        ...(series === "6200" ? ["Older inventories omit the dedicated OOB Ethernet socket. New instances append it without shifting the original console index."] : [])],
      chassis: { x: .025, y: .04, width: .95, height: .92 },
      faces: series === "8325" ? corePanels(canonical.device.ports) : accessPanels(canonical.device.ports, definition),
    });
  }
  return cache.get(device.model);
}

/** Create one nonconnectable physical control, cooling element or printed marking. */
function part(kind, x, y, width, height, label, variant) {
  return { kind, x, y, width, height, ...(label ? { label } : {}), ...(variant ? { variant } : {}) };
}

/** Bind canonical and compatible historical port types to the same observed connector. */
function socket(port, x, y, width, height, physicalLabel, connectorKind) {
  return { portIndex: port.portIndex, type: port.type, label: port.label, x, y, width, height, physicalLabel,
    ...(connectorKind ? { connectorKind } : {}),
    ...(port.type === "USB_C_CONSOLE" ? { compatibleTypes: ["Console"] } : {}) };
}

/** Trace the different copper banks, optical side and service strip on 6100 and 6200F models. */
function accessPanels(ports, definition) {
  const { copper, series } = definition;
  const is6100 = series === "6100";
  const start = is6100 ? (copper === 24 ? .54 : .14) : (copper === 24 ? .45 : .03);
  const step = is6100 ? .0325 : .0335;
  const frontPorts = ports.slice(0, copper).map((port, index) => {
    const column = Math.floor(index / 2);
    return socket(port, start + column * step + Math.floor(column / 6) * .009, index % 2 ? .72 : .38, .027, .235, String(index + 1));
  });
  frontPorts.push(...ports.slice(copper, copper + 4).map((port, index) => socket(port,
    (is6100 ? .035 : .868) + Math.floor(index / 2) * .039, index % 2 ? .73 : .38, .026, .205, String(copper + index + 1))));
  frontPorts.push(socket(ports[copper + 4], is6100 ? .977 : .938, is6100 ? .88 : .135, .025, .09, "CONSOLE", "usb-c"));
  if (!is6100) frontPorts.push(socket(ports[copper + 5], .962, .45, .030, .25, "MGMT", "rj45"));
  const front = [part("text", .92, .01, .065, .08, "aruba"),
    part("usb", is6100 ? .951 : .947, is6100 ? .51 : .66, is6100 ? .009 : .032, is6100 ? .26 : .11),
    part("button", is6100 ? .969 : .955, is6100 ? .71 : .10, .007, .06, undefined, "reset"),
    ...[0, 1, 2, 3].map((index) => part("led", is6100 ? .935 : .847, .11 + index * .085, .004, .035))];
  const rear = is6100 ? [part("power", .085, .29, .06, .46, "AC", "ac"),
    part("screw", .045, .51, .015, .10), part("text", .83, .14, .13, .16, definition.sku)]
    : [part("fan", .03, .10, .09, .80), part("fan", .125, .10, .09, .80),
      part("fan", .32, .10, .09, .80), part("screw", .48, .23, .014, .11),
      part("power", .916, .17, .055, .64, "AC", "ac")];
  return { front: { ports: frontPorts, components: front }, rear: { ports: [], components: rear } };
}

/** Trace the 8325's three-row SFP28 blocks, lower QSFP bank and six separate rear fan trays. */
function corePanels(ports) {
  const frontPorts = ports.slice(0, 48).map((port, index) => {
    const column = Math.floor(index / 3);
    return socket(port, .058 + column * .035 + Math.floor(column / 2) * .007, [.20, .53, .85][index % 3], .029, .16, String(index + 1));
  });
  frontPorts.push(...ports.slice(48, 56).map((port, index) => socket(port,
    .714 + Math.floor(index / 2) * .049, index % 2 ? .85 : .56, .043, .19, String(index + 49))));
  frontPorts.push(socket(ports[56], .955, .55, .031, .22, "CONSOLE", "rj45"),
    socket(ports[57], .955, .20, .031, .22, "MGMT", "rj45"),
    socket(ports[58], .955, .77, .024, .075, "USB CONSOLE", "usb-micro"));
  const front = [part("vent", .003, .15, .015, .77, undefined, "perforated"),
    part("vent", .984, .15, .013, .77, undefined, "perforated"),
    part("usb", .89, .81, .029, .105), part("button", .023, .73, .008, .07, undefined, "reset"),
    ...[0, 1, 2, 3, 4].map((index) => part("led", .025, .17 + index * .105, .004, .035)),
    ...Array.from({ length: 8 }, (_, index) => part("led", .701 + Math.floor(index / 2) * .049, index % 2 ? .29 : .12, .004, .03))];
  const rear = [part("psu", .025, .055, .135, .88, "PS2", "ac-inlet-right"), part("psu", .84, .055, .135, .88, "PS1", "ac-inlet-right"),
    ...Array.from({ length: 6 }, (_, index) => part("fan", .175 + index * .11, .08, .10, .84, String(6 - index)))];
  return { front: { ports: frontPorts, components: front }, rear: { ports: [], components: rear } };
}
