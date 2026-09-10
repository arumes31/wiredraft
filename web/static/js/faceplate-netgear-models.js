import { canonicalFaceplateDevice } from "./faceplate-profile.js";
import { resolveNetgearTSFaceplate } from "./faceplate-netgear-ts-models.js";

const guides = {
  m4300: "https://www.downloads.netgear.com/files/GDC/M4300/M4300_HIG_EN.pdf",
  m4250: "https://www.downloads.netgear.com/files/GDC/M4250/M4250_HIG_EN.pdf",
  gs110: "https://www.downloads.netgear.com/files/GDC/GS110T/GS110T_HIG_25Oct11.pdf",
  gs108: "https://www.downloads.netgear.com/files/GDC/GS108Tv3/GS108Tv3_GS110TPv3_HIG_EN.pdf",
  gsv6: "https://www.downloads.netgear.com/files/GDC/GS748Tv6/GS724Tv6_GS748Tv6_HIG_EN.pdf",
};
const definitions = {
  "M4300-28G": { sku: "GSM4328S", series: "m4300", copper: 24, frontPage: 24, rearPage: 28 },
  "M4300-52G": { sku: "GSM4352S", series: "m4300", copper: 48, frontPage: 26, rearPage: 28 },
  "M4250-26G4F-PoE+": { sku: "GSM4230P", series: "m4250", frontPage: 23, rearPage: 24 },
  GS110T: { sku: "GS110T (2011 hardware guide)", series: "gs110", copper: 8, frontPage: 11, rearPage: 12 },
  GS108T: { sku: "GS108Tv3", series: "gs108", copper: 8, frontPage: 13, rearPage: 13 },
  GS724T: { sku: "GS724Tv6", series: "gsv6", copper: 24, frontPage: 11, rearPage: 13 },
  GS748T: { sku: "GS748Tv6", series: "gsv6", copper: 48, frontPage: 11, rearPage: 14 },
};
const cache = new Map();

/** Resolve individually traced NETGEAR SKUs while keeping older inventory identities intact. */
export function resolveNetgearFaceplate(device) {
  const ts = resolveNetgearTSFaceplate(device);
  if (ts) return ts;
  if (device?.faceplate?.vendor !== "NETGEAR" || !Object.hasOwn(definitions, device.model)) return null;
  const canonical = canonicalFaceplateDevice(device);
  if (!canonical) return null;
  if (!cache.has(device.model)) {
    const definition = definitions[device.model];
    if (definition.series === "gs108") {
      cache.set(device.model, gs108Profile(canonical, definition));
      return cache.get(device.model);
    }
    if (definition.series.startsWith("gs")) {
      cache.set(device.model, gsProfile(canonical, definition));
      return cache.get(device.model);
    }
    const m4300 = definition.series === "m4300";
    cache.set(device.model, {
      id: `netgear-${definition.sku.toLowerCase()}`, sku: definition.sku, defaultFace: m4300 ? "front" : "rear",
      fidelity: "model", panelFidelity: { front: "model", rear: "model" },
      ...(!m4300 ? { inventoryRevision: 1, legacyLayouts: [{ inventoryRevision: 0,
        portIndexMap: Object.fromEntries(Array.from({ length: 29 }, (_, index) => [index + 1, index < 24 ? index + 1 : index + 3])),
        portLabels: { 25: "25", 26: "26", 27: "27", 28: "28" } }] } : {}),
      source: guides[definition.series], sourcePage: `Front page ${definition.frontPage}; rear page ${definition.rearPage}`,
      evidence: { models: [device.model, definition.sku], front: `${guides[definition.series]}#page=${definition.frontPage}`,
        rear: `${guides[definition.series]}#page=${definition.rearPage}` },
      note: `The ${definition.sku} front and rear are traced from the manufacturer's hardware installation guide.`,
      limitations: ["Side ventilation and top details are outside the front/rear projection.",
        m4300 ? "The guide's standard population has one APS150W power supply; the second bay is optional and shown empty."
          : "This is the GSM4230P PoE+ chassis with one AC inlet, not the different PoE++ chassis."],
      catalogDiscrepancies: m4300 ? [
        "The manufacturer specifies two 10G RJ45 uplinks and two SFP+ uplinks. Older catalog entries assign SFP+ to all four; existing types are retained while socket artwork follows the physical connectors.",
        "Older catalog entries omit the front OOB Ethernet and mini-USB console. New instances include them; the USB storage connector remains nonconnectable artwork.",
      ] : [
        "Older catalog entries omit physical Ethernet ports 25/26 and rear OOB/Type-C console. New instances include them; revision mapping keeps old SFP and console cable identities on the correct physical sockets.",
        "Front USB storage and the unused LED extension connector are nonconnectable artwork.",
      ],
      chassis: { x: .025, y: .04, width: .95, height: .92 },
      faces: m4300 ? m4300Panels(canonical.device.ports, definition) : m4250Panels(canonical.device.ports),
    });
  }
  return cache.get(device.model);
}

/** Create one bounded, nonconnectable hardware component in normalized panel coordinates. */
function part(kind, x, y, width, height, label, variant) {
  return { kind, x, y, width, height, ...(label ? { label } : {}), ...(variant ? { variant } : {}) };
}

/** Bind one stable inventory index to its observed physical socket and printed label. */
function socket(port, x, y, width = .030, height = .27, connectorKind, physicalLabel) {
  return { portIndex: port.portIndex, type: port.type, label: port.label, x, y, width, height,
    ...(connectorKind ? { connectorKind } : {}), ...(physicalLabel ? { physicalLabel } : {}) };
}

/** Draw the M4300's left status controls independently of port operational state. */
function m4300Controls() {
  return [part("lcd", .009, .175, .013, .20),
    ...[.44, .52, .60, .70].map((y) => part("led", .01, y, .004, .035)),
    part("button", .007, .79, .008, .07), part("usb", .954, .72, .035, .115),
    part("vent", .054, .025, .884, .14, undefined, "perforated")];
}

/** Trace the distinct M4300 copper banks, mixed uplinks and shared documented rear assembly. */
function m4300Panels(ports, definition) {
  const copper = ports.filter((port) => port.portIndex <= definition.copper);
  const uplinks = ports.filter((port) => port.portIndex > definition.copper && port.portIndex <= definition.copper + 4);
  const front = copper.map((port, index) => {
    const column = Math.floor(index / 2);
    return socket(port, (definition.copper === 24 ? .470 : .070) + column * .0327 + Math.floor(column / 6) * .0065,
      index % 2 === 0 ? .425 : .715);
  });
  for (const [index, port] of uplinks.entries()) front.push({ ...socket(port, index < 2 ? .879 : .925,
    index % 2 === 0 ? .425 : .715, index < 2 ? .030 : .034, .27, index < 2 ? "rj45" : "sfp"),
    ...(index < 2 ? { compatibleTypes: ["SFP_PLUS_10G"] } : {}) });
  front.push(socket(ports.find((port) => port.portIndex === definition.copper + 6), .9715, .535, .035, .26, "rj45"),
    socket(ports.find((port) => port.type === "USB_MINI_CONSOLE"), .035, .81, .020, .11, "usb-mini"));
  const rear = [part("psu", .602, .025, .169, .95, "PSU1", "ac-fan-left"),
    part("module-bay", .793, .025, .170, .95, "PSU2", "blank")];
  for (const x of [.137, .229, .321]) rear.push(part("fan", x, .045, .087, .88));
  return {
    front: { ports: front, components: m4300Controls() },
    rear: { ports: [socket(ports.find((port) => port.type === "Console"), .077, .72, .035, .30)], components: rear },
  };
}

/** Trace the AV switch's front replicated indicators and rear connectors without reversing inventory numbering. */
function m4250Panels(ports) {
  const front = [part("text", .015, .13, .15, .13, "NETGEAR AV"),
    part("usb", .066, .64, .035, .15), part("usb-c", .132, .735, .024, .075),
    part("button", .492, .39, .018, .18)];
  for (let index = 0; index < 30; index++) front.push(part("led", .54 + Math.floor(index / 2) * .0252,
    index % 2 === 0 ? .345 : .55, .006, .055));
  for (const y of [.40, .50, .60]) front.push(part("led", .956, y, .006, .035));
  const copper = ports.filter((port) => port.portIndex <= 26);
  const rear = copper.map((port, index) => {
    const column = Math.floor(index / 2);
    return socket(port, index < 24 ? .192 + column * .0325 + Math.floor(column / 6) * .012 : .603,
      index % 2 === 0 ? .35 : .66);
  });
  const optical = ports.filter((port) => port.type === "SFP_1G");
  for (const [index, port] of optical.entries()) rear.push(socket(port, .646 + Math.floor(index / 2) * .043,
    index % 2 === 0 ? .35 : .66, .034, .28, "sfp", String(index + 27)));
  rear.push(socket(ports.find((port) => port.type === "Console"), .117, .635, .035, .27));
  rear.push(socket(ports.find((port) => port.portIndex === 32), .072, .635, .034, .27),
    socket(ports.find((port) => port.type === "USB_C_CONSOLE"), .154, .7625, .020, .075, "usb-c"));
  const components = [part("power", .892, .235, .043, .58, undefined, "ac"), part("switch", .864, .295, .026, .48),
    part("button", .031, .765, .008, .065), part("text", .595, .02, .035, .075, "25/26")];
  for (const y of [.395, .50, .605]) components.push(part("led", .017, y, .005, .035));
  return { front: { ports: [], components: front }, rear: { ports: rear, components } };
}

/** Trace the GS108Tv3's two four-socket banks and rear power without treating its PoE input as an output. */
function gs108Profile(canonical, definition) {
  const source = guides.gs108;
  return {
    id: "netgear-gs108t-v3", sku: definition.sku, defaultFace: "front", fidelity: "model",
    panelFidelity: { front: "model", rear: "model" }, source, sourcePage: "Front and rear page 13",
    evidence: { models: [canonical.catalog.model, definition.sku], front: `${source}#page=13`, rear: `${source}#page=13` },
    note: "The GS108Tv3 front and rear are traced from Figures 1 and 2 of the manufacturer's hardware guide.",
    limitations: ["This drawing selects hardware revision v3; earlier GS108T revisions can differ.",
      "Port 1 can receive PoE power as a powered device. None of the eight Ethernet ports supplies PoE power.",
      "The switch is fanless. Top, bottom and side details are outside the front/rear projection."],
    chassis: { x: .28, y: .16, width: .44, height: .68 },
    faces: {
      front: { ports: canonical.device.ports.map((port, index) =>
        socket(port, .230 + index * .098 + (index >= 4 ? .009 : 0), .462, .086, .43)),
      components: [part("text", .02, .03, .14, .10, "NETGEAR"),
        part("led", .043, .555, .015, .07), part("button", .111, .54, .020, .11, undefined, "reset")] },
      rear: { ports: [], components: [part("power", .815, .26, .054, .43, undefined, "dc-barrel"),
        { ...part("vent", .260, .20, .050, .08, undefined, "slit"), role: "security-lock" }] },
    },
  };
}

/** State the exact GS hardware revision and retain physical combo connectors as separate inventory endpoints. */
function gsProfile(canonical, definition) {
  const compact = definition.series === "gs110";
  const source = guides[definition.series];
  return {
    id: `netgear-${canonical.catalog.model.toLowerCase()}-${compact ? "2011" : "v6"}`,
    sku: definition.sku, defaultFace: "front", fidelity: "model", panelFidelity: { front: "model", rear: "model" },
    source, sourcePage: `Front page ${definition.frontPage}; rear page ${definition.rearPage}`,
    evidence: { models: [canonical.catalog.model, definition.sku], front: `${source}#page=${definition.frontPage}`,
      rear: `${source}#page=${definition.rearPage}` },
    note: `The ${definition.sku} front and rear are traced from the manufacturer's hardware installation guide.`,
    limitations: compact ? [
      "This trace follows the October 2011 GS110T guide, not the different GS110TP PoE models.",
      "The guide's rear illustration and technical specifications disagree on the DC voltage; the drawing therefore identifies only the barrel connector.",
    ] : [
      "This trace is specifically hardware v6 from the March 2024 guide; earlier GS724T/GS748T revisions can differ.",
      definition.copper === 24 ? "GS724Tv6 is fanless; side ventilation is outside the front/rear projection."
        : "GS748Tv6 has an internal fan; its rear drawing has no exposed fan module. Side ventilation is outside this projection.",
    ],
    catalogDiscrepancies: definition.copper === 48 ? [
      "Copper 47/48 and optical 47F/48F are alternative media for shared combo interfaces. The inventory retains all physical connectors; both media cannot operate simultaneously.",
    ] : [],
    chassis: compact ? { x: .24, y: .15, width: .52, height: .70 } : { x: .025, y: .04, width: .95, height: .92 },
    faces: compact ? gs110Panels(canonical.device.ports) : gsV6Panels(canonical.device.ports, definition.copper),
  };
}

/** Trace the compact GS110T's single Ethernet row and separate rear barrel inlet. */
function gs110Panels(ports) {
  const front = ports.map((port, index) => index < 8
    ? socket(port, .222 + index * .0675, .49, .054, .42)
    : socket(port, .808 + (index - 8) * .101, .605, .065, .42, "sfp", `${index + 1}F`));
  return {
    front: { ports: front, components: [part("text", .025, .10, .12, .14, "NETGEAR"),
      part("led", .027, .62, .012, .10), part("button", .069, .605, .016, .13, undefined, "reset"),
      part("button", .955, .60, .016, .13, undefined, "reset")] },
    rear: { ports: [], components: [part("power", .809, .32, .066, .40, undefined, "dc-barrel"),
      part("vent", .258, .20, .05, .13, undefined, "slit"), part("button", .112, .67, .028, .13),
      part("text", .153, .65, .06, .14, "GND")] },
  };
}

/** Trace v6 rack copper banks and their distinct single-row or paired optical sockets. */
function gsV6Panels(ports, copperCount) {
  const large = copperCount === 48;
  const front = ports.map((port, index) => {
    if (index < copperCount) {
      const column = Math.floor(index / 2);
      return socket(port, (large ? .094 : .346) + column * (large ? .0322 : .042) + Math.floor(column / 6) * (large ? .012 : .016),
        index % 2 === 0 ? .38 : .725, large ? .0285 : .039, .25);
    }
    const optical = index - copperCount;
    return socket(port, large ? .9165 + Math.floor(optical / 2) * .0515 : .885 + optical * .057,
      large && optical % 2 === 0 ? .40 : .73, large ? .035 : .046, .25, "sfp",
      `${(large ? 47 : 25) + optical}F`);
  });
  const components = [part("led", large ? .010 : .038, .30, .007, .06),
    part("button", large ? .008 : .037, .80, .010, .10, undefined, "reset")];
  if (large) {
    components.push(part("led", .010, .48, .007, .06), part("button", .039, .80, .010, .10, undefined, "reset"));
  } else {
    for (let index = 0; index < 24; index++) components.push(part("led", .078 + Math.floor(index / 2) * .0153,
      index % 2 === 0 ? .30 : .58, .006, .055));
    components.push(part("led", .273, .58, .006, .055), part("led", .290, .58, .006, .055));
  }
  return { front: { ports: front, components }, rear: { ports: [], components: [
    part("power", large ? .81 : .834, .22, large ? .0695 : .095, .56, undefined, "ac"),
    part("vent", large ? .353 : .116, .42, .014, .18, undefined, "slit"),
  ] } };
}
