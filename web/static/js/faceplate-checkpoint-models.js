const GUIDE_3000 = "https://sc1.checkpoint.com/documents/3000/GSG/EN/CP_3000_Appliances_GettingStartedGuide.pdf";
const GUIDE_SPARK = "https://sc1.checkpoint.com/documents/Appliances/GSG_V2V3/EN/CP_1600_1800_Appliance_GettingStartedGuide.pdf";
const SPARK_DATASHEET = "https://www.checkpoint.com/downloads/products/1600-1800-security-gateway-datasheet.pdf";
const GUIDE_6000 = "https://sc1.checkpoint.com/documents/6000_7000/GSG/EN/CP_6000_7000_Appliances_GettingStartedGuide.pdf";
const rackModels = new Set(["Quantum 6200", "Quantum 6400", "Quantum 6600", "Quantum 6700", "Quantum 6900", "Quantum 7000"]);
const models = new Set(["Quantum 1600", "Quantum 1800", "Quantum 3600", "Quantum 3800", ...rackModels]);

/** Build only Check Point models whose individual front and rear panels are documented. */
export function buildCheckPointModelFaceplate(device) {
  if (device?.faceplate?.vendor !== "Check Point" || !models.has(device.model)) return null;
  if (device.model === "Quantum 1600" || device.model === "Quantum 1800") return sparkProfile(device);
  if (rackModels.has(device.model)) return rackProfile(device);
  return {
    id: `checkpoint-${device.model.slice(8)}`, family: device.model, fidelity: "model",
    panelFidelity: { front: "model", rear: "model" }, inventoryComplete: true, inventoryRevision: 0,
    source: GUIDE_3000, sourcePage: "PDF pages 30–33: 3600/3800 front, console types and dual-inlet rear",
    evidence: { scope: "model", models: [device.model], front: `${GUIDE_3000}#page=30`, rear: `${GUIDE_3000}#page=33` },
    limitations: ["The guide explicitly shows the same physical panels for 3600 and 3800. Both DC inlets are drawn; external power adapters are outside this projection."],
    catalogDiscrepancies: [], defaultFace: "front",
    chassis: { x: .255, y: .08, width: .49, height: .84 }, faces: desktopPanels(device.ports),
  };
}

/** Describe a nonconnectable physical control, ventilation opening or printed marking. */
function part(kind, x, y, width, height, label, variant) {
  return { kind, x, y, width, height, ...(label ? { label } : {}), ...(variant ? { variant } : {}) };
}

/** Attach observed socket geometry to a stable catalog index and connector type. */
function socket(port, x, y, width, height, connectorKind) {
  return { portIndex: port.portIndex, type: port.type, label: port.label, x, y, width, height,
    ...(connectorKind ? { connectorKind } : {}) };
}

/** Record separately illustrated Spark chassis, including their different combo banks and power populations. */
function sparkProfile(device) {
  const larger = device.model === "Quantum 1800";
  const frontPage = larger ? 17 : 15;
  return {
    id: `checkpoint-${larger ? 1800 : 1600}`, family: device.model, fidelity: "model",
    panelFidelity: { front: "model", rear: "model" }, inventoryComplete: true,
    source: GUIDE_SPARK, sourcePage: `PDF front ${frontPage}, rear 22; datasheet ${larger ? 5 : 4} for physical interface speeds`,
    evidence: { scope: "model", models: [device.model], front: `${GUIDE_SPARK}#page=${frontPage}`, rear: `${GUIDE_SPARK}#page=22`, supplemental: SPARK_DATASHEET },
    inventoryRevision: larger ? 1 : 0,
    ...(larger ? { legacyLayouts: [{ inventoryRevision: 0,
      portIndexMap: Object.fromEntries(Array.from({ length: 27 }, (_, index) => [index + 1, index + 1])) }] } : {}),
    limitations: ["Each WAN or DMZ copper/fiber pair represents alternative media for one interface, not two simultaneously active interfaces.",
      "Interface speeds follow the manufacturer's hardware datasheet. The newer installation guide contains conflicting speed prose for 1600 LAN and 1800 WAN ports."],
    catalogDiscrepancies: larger ? ["The 2.5G LAN sockets are ports 1 and 2. Older inventories assign 2.5G to ports 17 and 18; existing cable identities and configuration remain intact."] : [],
    defaultFace: "front", chassis: { x: .025, y: .04, width: .95, height: .92 },
    faces: sparkPanels(device.ports, larger),
  };
}

/** Trace Spark's model-specific LAN banks, adjacent copper/fiber combo sockets, service strip and five rear fans. */
function sparkPanels(ports, larger) {
  const lanCount = larger ? 18 : 16;
  const frontPorts = ports.slice(0, lanCount).map((port, index) => {
    const bankIndex = larger ? index - 2 : index;
    const column = Math.floor(bankIndex / 2);
    const x = larger && index < 2 ? .148 : .198 + column * .036 + Math.floor(column / 4) * .014;
    const slot = socket(port, x, index % 2 ? .40 : .73, .030, .25);
    if (larger && (index < 2 || index >= 16)) slot.compatibleTypes = ["RJ45_1G", "RJ45_MGIG"];
    return slot;
  });
  if (larger) {
    frontPorts.push(socket(ports[18], .518, .73, .030, .25), socket(ports[19], .518, .40, .030, .25),
      socket(ports[20], .562, .73, .030, .25), socket(ports[21], .562, .40, .030, .25),
      socket(ports[22], .61, .73, .030, .25), socket(ports[23], .655, .73, .030, .25),
      { ...socket(ports[24], .70, .73, .030, .25), physicalLabel: "EXT" });
  } else {
    frontPorts.push(socket(ports[16], .518, .73, .030, .25), socket(ports[17], .562, .73, .030, .25),
      socket(ports[18], .518, .40, .030, .25), socket(ports[19], .562, .40, .030, .25));
  }
  frontPorts.push(socket(ports.at(-2), .790, .34, .030, .25, "rj45"),
    socket(ports.at(-1), .746, .84, .024, .075, "usb-c"));
  const front = [part("vent", .02, .035, larger ? .096 : .15, .34, undefined, "perforated"),
    part("vent", .585, .035, .18, larger ? .30 : .38, undefined, "perforated"),
    part("module-bay", .025, .78, .055, .12, "SD"),
    part("usb", .775, .54, .030, .12), part("usb", .775, .76, .030, .12),
    ...Array.from({ length: larger ? 5 : 3 }, (_, index) => part("led", .831, (larger ? .26 : .52) + index * .125, .005, .045)),
    part("button", .856, .84, .007, .045, undefined, "reset"),
    part("text", .88, .48, .10, .32, "Check Point")];
  const rear = [part("power", .02, .22, .065, .66, "AC1", "ac"),
    ...(larger ? [part("power", .12, .22, .065, .66, "AC2", "ac")] : []),
    part("switch", .188, .42, .027, .43),
    ...Array.from({ length: 5 }, (_, index) => part("fan", .235 + index * .105, .12, .09, .76)),
    part("screw", .863, .48, .017, .16)];
  return { front: { ports: frontPorts, components: front }, rear: { ports: [], components: rear } };
}

/** Pin the documented base chassis and selected LOM/AC configuration for each 6000/7000 model. */
function rackProfile(device) {
  const series = Number(device.model.slice(8));
  const frontPage = series >= 6900 ? 39 : 38;
  const rearPage = series === 6200 ? 42 : series === 7000 ? 44 : 43;
  return {
    id: `checkpoint-${series}`, family: device.model, fidelity: "model",
    panelFidelity: { front: "model", rear: "model" }, inventoryComplete: true, inventoryRevision: 1,
    source: GUIDE_6000, sourcePage: `PDF front ${frontPage}, service sockets 40–41, rear ${rearPage}, fan/PSU specifications 44–45`,
    evidence: { scope: "model", models: [device.model], front: `${GUIDE_6000}#page=${frontPage}`, rear: `${GUIDE_6000}#page=${rearPage}` },
    legacyLayouts: [{ inventoryRevision: 0, portIndexMap: Object.fromEntries(Array.from({ length: 12 }, (_, index) => [index + 1, index + 1])) }],
    limitations: [`The selected configuration is ${series === 6200 ? "6200 Base with its single AC supply" : `${series} with both AC supplies installed`}, the LOM card installed, and empty network expansion bays. Other power populations or interface cards require their matching configuration.`,
      ...(series >= 6900 ? ["Both front storage carriers shown in the guide are represented; drive capacity is not inferred."] : [])],
    catalogDiscrepancies: ["Older inventories omit the dedicated LOM Ethernet socket. New instances append it; original endpoint indices and user names remain unchanged."],
    defaultFace: "front", chassis: { x: .025, y: .04, width: .95, height: .92 }, faces: rackPanels(device.ports, series),
  };
}

/** Trace row-major LAN numbering, service connectors and each model's expansion, power and cooling regions. */
function rackPanels(ports, series) {
  const frontPorts = ports.slice(0, 8).map((port, index) => socket(port, .468 + index % 4 * .032,
    index < 4 ? .35 : .69, .027, .23));
  frontPorts.push(socket(ports[8], .608, .69, .030, .23), socket(ports[9], .608, .35, .030, .23),
    socket(ports[10], .659, .27, .030, .23, "rj45"), socket(ports[11], .746, .81, .025, .075, "usb-c"),
    socket(ports[12], .706, .69, .030, .23, "rj45"));
  const front = [part("module-bay", .01, .045, .212, .91, "SLOT 1", "blank"),
    ...(series >= 6900 ? [part("module-bay", .224, .045, .212, .91, "SLOT 2", "blank"),
      part("module-bay", .813, .075, .167, .34, "DISK 1", "populated"),
      part("module-bay", .813, .55, .167, .34, "DISK 2", "populated")]
      : [part("text", .84, .46, .13, .34, "Check Point")]),
    part("usb", .644, .46, .030, .12), part("usb", .644, .69, .030, .12),
    ...Array.from({ length: series === 6200 ? 4 : 5 }, (_, index) => part("led", .774, .24 + index * .13, .005, .05)),
    part("button", .794, .82, .007, .05, undefined, "reset"), part("button", .794, .69, .007, .05)];
  const rear = [];
  if (series === 6200 || series === 6400) {
    for (const x of series === 6200 ? [.015] : [.015, .68]) {
      rear.push(part("module-bay", x, .045, .185, .91, undefined, "populated"),
        part("power", x + .015, .21, .055, .62, undefined, "ac"),
        part("fan", x + .09, .075, .087, .84, undefined, "fixed"));
    }
  } else rear.push(part("psu", .015, .04, .123, .92, "PS1", "ac-inlet-right"),
    part("psu", .14, .04, .123, .92, "PS2", "ac-inlet-right"),
    part("button", .279, .52, .008, .07));
  const start = series <= 6400 ? .24 : .315;
  const step = series === 7000 ? .107 : .10;
  rear.push(...Array.from({ length: series === 7000 ? 5 : 4 }, (_, index) =>
    part("fan", start + index * step, .09, .096, .82, String((series === 7000 ? 5 : 4) - index), "fixed")),
    part("switch", .884, .43, .025, .44), part("led", .922, .49, .007, .055),
    part("power", .942, .47, .020, .16, "ESD", "dc-barrel"),
    part("screw", .975, .65, .012, .10));
  return { front: { ports: frontPorts, components: front }, rear: { ports: [], components: rear } };
}

/** Trace the compact 3600/3800 six-port bank, dual console and two threaded DC power inlets. */
function desktopPanels(ports) {
  const frontPorts = ports.slice(0, 6).map((port, index) => socket(port, .10 + index * .097, .65, .074, .29));
  frontPorts.push(socket(ports[6], .765, .65, .077, .29, "rj45"),
    socket(ports[7], .85, .74, .043, .075, "usb-c"));
  const front = [part("vent", .27, .06, .70, .24, undefined, "perforated"),
    part("text", .025, .07, .22, .23, "Check Point"),
    part("usb", .65, .47, .056, .13), part("usb", .65, .69, .056, .13),
    ...Array.from({ length: 4 }, (_, index) => part("led", .91, .35 + index * .13, .012, .07)),
    part("button", .95, .71, .014, .07, undefined, "reset")];
  const rear = [part("fan", .36, .06, .19, .86, undefined, "fixed"),
    part("power", .655, .58, .045, .25, "DC1", "dc-barrel"),
    part("power", .725, .58, .045, .25, "DC2", "dc-barrel"),
    part("led", .608, .68, .016, .09), part("led", .793, .68, .016, .09),
    part("switch", .875, .30, .045, .52),
    part("screw", .025, .06, .06, .24), part("screw", .925, .06, .06, .24)];
  return { front: { ports: frontPorts, components: front }, rear: { ports: [], components: rear } };
}
