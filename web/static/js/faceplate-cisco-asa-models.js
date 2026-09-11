const HARDWARE = "https://www.cisco.com/c/en/us/td/docs/security/asa/hw/maintenance/";
const models = new Map([
  ["ASA 5506-X", { series: 5506, guide: "5506xguide/b_Install_Guide_5506/b_Install_Guide_5506_chapter_01.html", figures: "Front panel Figure 4; rear panel Figure 6", widthMM: 199.9 }],
  ["ASA 5508-X", { series: 5508, guide: "5508xguide/b_install_guide_5508/b_install_guide_5508_chapter_0100.html", figures: "Front panel Figure 2; rear panel Figure 3" }],
  ["ASA 5516-X", { series: 5516, guide: "5508xguide/b_install_guide_5508/b_install_guide_5508_chapter_0100.html", figures: "Front panel Figure 2; rear panel Figure 3" }],
  ["ASA 5525-X", { series: 5525, guide: "5500xguide/5500xhw/asa_overview.html", figures: "Front panel Figure 1; rear panel Figure 5; power supplies" }],
  ["ASA 5545-X", { series: 5545, guide: "5500xguide/5500xhw/asa_overview.html", figures: "Front panel Figure 2; rear panel Figure 6; power supplies" }],
  ["ASA 5555-X", { series: 5555, guide: "5500xguide/5500xhw/asa_overview.html", figures: "Front panel Figure 2; rear panel Figure 6; power supplies" }],
]);

/** Build only ASA models whose individual front and rear illustrations were checked. */
export function buildCiscoASAModelFaceplate(device) {
  const definition = models.get(device.model);
  if (!definition || device.faceplate.vendor !== "Cisco") return null;
  const { series, guide, figures, widthMM = 438 } = definition;
  const source = `${HARDWARE}${guide}`;
  const width = widthMM / 438;
  const miniUSB = series <= 5516;
  return {
    id: `enterprise-cisco-asa-${series}-x`, family: device.model, fidelity: "model", source, sourcePage: figures,
    inventoryRevision: 1, inventoryComplete: true,
    legacyLayouts: [{ inventoryRevision: 0, portIndexMap: Object.fromEntries(Array.from({ length: 10 }, (_, index) => [index + 1, index + 1])) }],
    evidence: { models: [device.model], scope: "model", reviewed: "2026-09-10", front: source, rear: source,
      ...(series === 5508 || series === 5516 ? { sharedChassis: "Cisco explicitly identifies the ASA 5508-X and 5516-X panels as identical except the model number." }
        : series >= 5545 ? { sharedChassis: "Cisco explicitly scopes front Figure 2 and rear Figure 6 to both ASA 5545-X and ASA 5555-X." } : {}) },
    inventoryNotes: ["USB storage ports are decorative. Optional I/O cards and the second PSU slot are unpopulated in the base configuration."],
    catalogDiscrepancies: [miniUSB
      ? "The old catalog console was typed Micro-USB; the physical console is Mini-B. Its saved identity is preserved with Mini-B artwork. New inventory also includes the additional RJ45 console."
      : "The old catalog console was typed Micro-USB; this model has an RJ45 console. Its saved identity is preserved with RJ45 console artwork.",
    miniUSB ? "Catalog data labels 1–8 correspond to the physical GigabitEthernet 1/1–1/8 sockets."
      : "Catalog data labels 1–8 correspond to physical GigabitEthernet 0/0–0/7. The drawing preserves Cisco's descending paired column order."],
    defaultFace: "rear", chassis: { x: (1 - width) / 2, y: .05, width, height: .9 },
    faces: series === 5506 ? desktopFaces(device) : series <= 5516 ? smallRackFaces(device) : largeRackFaces(device, series),
  };
}

/** Describe a component relative to the physical chassis rectangle. */
function part(kind, x, y, width, height, label, variant) {
  return { kind, x, y, width, height, ...(label ? { label } : {}), ...(variant ? { variant } : {}) };
}

/** Keep saved identity separate from the manufacturer's connector and printed label. */
function socket(device, label, x, y, width, height = .22, connectorKind, physicalLabel = label) {
  const port = device.ports.find((candidate) => candidate.label === label);
  if (!port) throw new Error(`${device.model}: documented socket ${label} is missing from the catalog`);
  return { label, type: port.type, portIndex: port.portIndex, x, y, width, height, physicalLabel,
    ...(label === "CONSOLE1" ? { compatibleTypes: ["USB_MICRO_CONSOLE"] } : {}),
    ...(connectorKind ? { connectorKind } : {}) };
}

/** Trace the 5506-X's unlit front and single-row rear network bank. */
function desktopFaces(device) {
  const front = { ports: [], components: [
    part("text", .04, .38, .11, .26, "CISCO"), part("vent", .52, .24, .475, .53, undefined, "chevron"),
    part("text", .74, .43, .235, .2, device.model),
  ] };
  const rear = { ports: [.181, .25, .318, .390, .463, .532, .605, .676].map((x, index) =>
    socket(device, String(index + 1), x, .60, .060, .22, undefined, `1/${index + 1}`)), components: [
    { ...part("power", .065, .53, .050, .30, "12V", "dc-multipin"), columns: 2 },
    part("usb", .889, .43, .027, .32),
    part("button", .94, .66, .013, .06, undefined, "reset"), part("vent", .937, .155, .009, .18, undefined, "slit"),
  ] };
  rear.ports.push(socket(device, "MGMT1", .774, .319, .062, .22, undefined, "MGMT"),
    socket(device, "RJ45-CONSOLE1", .774, .638, .062, .22, undefined, "CONSOLE"),
    socket(device, "CONSOLE1", .853, .75, .033, .075, "usb-mini", "USB CONSOLE"));
  for (const [index, label] of ["PWR", "STATUS", "ACTIVE", "WLAN"].entries()) {
    rear.components.push({ ...part("led", .036 + index * .025, .10, .009, .05), active: label !== "WLAN" });
  }
  return { front, rear };
}

/** Trace the explicitly shared 5508-X/5516-X panels, including their rear SSD bay. */
function smallRackFaces(device) {
  const front = { ports: [], components: [
    part("text", .045, .35, .06, .30, "CISCO"), part("vent", .69, .275, .305, .44, undefined, "chevron"),
    part("text", .86, .43, .125, .18, device.model), part("vent", .035, .86, .93, .045, undefined, "slit"),
  ] };
  for (const [index, label] of ["SSD", "ACTIVE", "STATUS", "POWER"].entries()) {
    front.components.push(part("led", .602 + index * .021, .41, .006, .05),
      part("text", .59 + index * .021, .54, .030, .06, label));
  }
  const rear = { ports: [.359, .391, .426, .459, .492, .523, .556, .588].map((x, index) =>
    socket(device, String(index + 1), x, .635, .028, .22, undefined, `1/${index + 1}`)), components: [
    part("button", .052, .16, .030, .47, undefined, "power"), part("power", .089, .187, .055, .45, "AC", "ac"),
    part("vent", .016, .72, .16, .22, undefined, "perforated"), part("vent", .188, .40, .07, .45, undefined, "perforated"),
    part("usb", .687, .40, .011, .36),
    part("button", .710, .78, .008, .06, undefined, "reset"), part("led", .748, .78, .006, .045),
    part("module-bay", .773, .53, .218, .42, "SSD", "populated"),
    part("vent", .472, .12, .135, .26, undefined, "perforated"), part("vent", .687, .10, .04, .23, undefined, "perforated"),
  ] };
  rear.ports.push(socket(device, "MGMT1", .635, .40, .030, .22, undefined, "MGMT"),
    socket(device, "RJ45-CONSOLE1", .635, .67, .030, .22, undefined, "CONSOLE"),
    socket(device, "CONSOLE1", .671, .79, .021, .075, "usb-mini", "USB CONSOLE"));
  for (const x of [.282, .305, .327]) rear.components.push(part("led", x - .003, .8, .006, .045));
  return { front, rear };
}

/** Trace the 5525/5545/5555 descending two-row port bank and model-specific PSUs. */
function largeRackFaces(device, series) {
  const dual = series >= 5545;
  const front = { ports: [], components: [
    part("text", .055, .36, .070, .32, "CISCO"), part("vent", .126, .13, .515, .77, undefined, "chevron"),
    part("button", .675, .10, .016, .20, undefined, "power"), part("text", .65, .33, .078, .12, device.model),
    part("module-bay", .733, dual ? .57 : .49, .175, dual ? .32 : .42, dual ? "SSD 1" : "SSD", "populated"),
  ] };
  if (dual) front.components.push(part("module-bay", .733, .13, .175, .32, "SSD 0", "populated"));
  for (const x of [.661, .697]) for (const y of (dual ? [.51, .63, .75, .87] : [.56, .70, .84])) {
    front.components.push(part("led", x - .003, y, .006, .045));
  }
  const rear = { ports: [socket(device, "CONSOLE1", .38, .73, .033, .22, "console", "CONSOLE"),
    socket(device, "MGMT1", .436, .30, .032, .22, undefined, "MGMT")], components: [
    part("module-bay", .072, .04, .192, dual ? .48 : .77, "I/O EXPANSION", "blank"),
    part("usb", .422, .542, .028, .115), part("usb", .422, .752, .028, .115),
    part("vent", .335, .10, .06, .28, undefined, "perforated"), part("vent", .49, .05, .16, .10, undefined, "perforated"),
  ] };
  const xs = dual ? [.485, .537, .587, .637] : [.488, .54, .59, .64];
  for (let physical = 0; physical < 8; physical++) {
    rear.ports.push(socket(device, String(physical + 1), xs[3 - Math.floor(physical / 2)], physical % 2 ? .36 : .73,
      .032, .22, undefined, `0/${physical}`));
  }
  if (dual) {
    rear.components.push(part("psu", .716, .05, .127, .88, "PSU 0", "ac"),
      part("module-bay", .86, .05, .13, .88, "PSU 1", "blank"));
    for (let index = 0; index < 7; index++) rear.components.push(part("led", .12 + index * .015, .78, .006, .045));
  } else {
    rear.components.push(part("fan", .762, .10, .09, .80), part("power", .863, .20, .05, .68, "AC", "ac"),
      part("vent", .675, .10, .05, .80, undefined, "perforated"), part("vent", .938, .15, .05, .70, undefined, "perforated"));
  }
  return { front, rear };
}
