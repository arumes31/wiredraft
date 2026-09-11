import { canonicalFaceplateDevice } from "./faceplate-profile.js";
import { fitAristaAllocation } from "./faceplate-arista-allocation.js";

const root = "https://www.arista.com/assets/data/pdf/";
// Datasheet body heights/widths are matched at the application's 460px reference width;
// the normalized scene contract retains its per-width proportions at other display widths.
const definitions = new Map([
  ["7300 family", { sku: "DCS-7304X3-BND-F", native: 8, height: (.95 * 460 * 35.2 / 44.1 + 16) / 800, guide: "QS_7300_Modular.pdf", front: 50, rear: 53,
    datasheet: "7300X3-Datasheet.pdf", map: [...Array.from({ length: 48 }, (_, i) => [i + 1, i + 1]), [57, 53], [58, 55]],
    configuration: "DCS-7304X3-BND-F: DCS-7304-CH 8U, one DCS-7300-SUP in slot1, one DCS-7300X3-48YC4-LC in slot3, two PWR-3KT-AC-BLUE in PSU1/2, four DCS-7304X3-FM-F in rear slots1-4 with eight FAN-7002H-F fans; front-to-rear airflow. Supervisor2, line slots4-6 and PSU3/4 have blank covers." }],
  ["7500 family", { sku: "DCS-7504R3-BND", native: 7, height: (.95 * 460 * 31.2 / 44.1 + 16) / 700, guide: "QS_7500N_Modular.pdf", front: 57, rear: 60,
    datasheet: "7500R3-Data-Sheet.pdf", map: [[57, 37], [58, 39]],
    configuration: "DCS-7504R3-BND: DCS-7504N-CH 7U, one DCS-7500-SUP2 in slot1 without SSD, one DCS-7500R3-36CQ-LC in slot3, four PWR-3KT-AC-RED in PSU1-4 and six DCS-7504R3-FM integrated fan/fabric modules in rear slots1-6; front-to-rear airflow. Supervisor2 and line slots4-6 have blank covers; optional clock input and touch-point shield are absent." }],
]);
const cache = new Map();

/** Resolve the exact selected population and proportionally fit its body inside a historical rack allocation. */
export function resolveAristaModularFaceplate(device) {
  if (device?.faceplate?.vendor !== "Arista" || !definitions.has(device.model)) return null;
  const canonical = canonicalFaceplateDevice(device);
  if (!canonical) return null;
  const definition = definitions.get(device.model);
  if (!cache.has(device.model)) cache.set(device.model, buildProfile(canonical.device, definition));
  return fitAristaAllocation(cache.get(device.model), device, definition.native);
}

/** Record source pages, exact population and immutable revision-zero compatibility rather than migrating saved ports. */
function buildProfile(device, definition) {
  const source = `${root}qsg/qsg-books/${definition.guide}`;
  return { id: `arista-${definition.sku.toLowerCase()}-selection`, sku: definition.sku, family: device.model,
    defaultFace: "front", fidelity: "model", panelFidelity: { front: "model", rear: "model" },
    inventoryRevision: 1, inventoryComplete: true, rearHardwareVerified: true, source,
    sourcePage: `PDF front ${definition.front}, rear ${definition.rear}; supervisor ${definition.native === 8 ? 31 : 42}; linecard ${definition.native === 8 ? 56 : 69}`,
    evidence: { scope: "model", models: [definition.sku], selectedModel: definition.sku, catalogAlias: device.model,
      front: `${source}#page=${definition.front}`, rear: `${source}#page=${definition.rear}`,
      supplemental: `${root}Datasheets/${definition.datasheet}`, configuration: definition.configuration },
    note: `${device.model} explicitly selects ${definition.sku}. ${definition.configuration}`,
    limitations: [definition.configuration,
      "The selected single-card population is explicit, not a depiction of every chassis/card combination in the family. Fabric electronics and fan rotors behind protective grilles are hidden; only the installed external housings are drawn.",
      "USB storage and the 7300 MCX clock input are ancillary hardware rather than network/console endpoints. Small perforations and markings are simplified. Cable retention clips and external grounding leads are absent.",
      "Historical rack allocations fit the entire body proportionally without changing units, position or saved inventory. Physical abbreviations never replace edited labels."],
    catalogDiscrepancies: ["The historical 2U family placeholder had 48 SFP28, eight 400G QSFP-DD, management and console endpoints. New instances alone receive the selected native height and inventory.",
      "Old 400G endpoints are unsupported in both selected linecards; old SFP28 endpoints are also unsupported by the selected 7500 100G card. Explicit revision-zero maps preserve only compatible sockets. Unknown revisions remain unmapped."],
    legacyLayouts: [{ inventoryRevision: 0, portIndexMap: Object.fromEntries(definition.map),
      portLabels: Object.fromEntries([...Array.from({ length: 56 }, (_, i) => [i + 1, String(i + 1)]), [57, "MGMT"], [58, "CONSOLE"]]) }],
    chassis: { x: .025, y: .03, width: .95, height: definition.height },
    faces: definition.native === 8 ? panels7304(device.ports) : panels7504(device.ports),
  };
}

/** Place one measured external component in normalized body coordinates. */
function part(kind, x, y, width, height, role, variant, sku) {
  return { kind, x, y, width, height, ...(role ? { role } : {}), ...(variant ? { variant } : {}), ...(sku ? { sku } : {}) };
}

/** Fit a manufacturer or slot marking into a dedicated panel region. */
function mark(label, x, y, width, height, fontSize = 5) {
  return { ...part("text", x, y, width, height), label, fontSize };
}

/** Bind a physical socket and caption reservation to its stable canonical endpoint index. */
function socket(ports, index, x, y, kind, width, height, captionY, physicalLabel) {
  const port = ports.find((entry) => entry.portIndex === index);
  return { portIndex: index, type: port.type, label: port.label, physicalLabel: physicalLabel ?? port.label,
    connectorKind: kind, x, y, width, height,
    descriptionAnchor: { x, y: captionY, fontSize: 5.5, boxHeight: 7, boxWidth: width } };
}

/** Trace one covered front slot without inventing sockets or hardware concealed by its cover. */
function blank(x, y, width, height, role, sku, label) {
  return { ...part("module-bay", x, y, width, height, role, "arista-modular-blank", sku), label };
}

/** Trace the left 7300 supervisor's console/two management sockets, status bank, USB pair and MCX input. */
function supervisor7300(ports) {
  return { ports: [socket(ports, 53, .337, .135, "rj45", .030, .037, .183, "M1"),
    socket(ports, 54, .376, .135, "rj45", .030, .037, .183, "M2"),
    socket(ports, 55, .285, .135, "console-inverted", .030, .037, .183, "CON")],
  components: [part("vent", .052, .046, .428, .046, "supervisor-1-grille", "arista-modular-mesh", "DCS-7300-SUP"),
    part("status-panel", .052, .108, .185, .048, "supervisor-1-status", "arista-7300-status"),
    part("usb", .403, .116, .013, .040, "storage-usb-1"), part("usb", .430, .116, .013, .040, "storage-usb-2"),
    part("coax", .459, .127, .016, .019, "clock-input-mcx", "arista-mcx"),
    part("handle", .125, .168, .065, .012, "supervisor-1-release"),
    blank(.515, .043, .436, .133, "supervisor-2-cover", "DCS-7300-SCVR", "SUP2 COVER"),
  ] };
}

/** Trace 7304's four horizontal line slots, two front supplies and four rear fabrics with two fan modules each. */
function panels7304(ports) {
  const supervisor = supervisor7300(ports), sockets = [...supervisor.ports];
  for (let i = 0; i < 48; i++) sockets.push(socket(ports, i + 1, (i < 24 ? .073 : .585) + Math.floor(i % 24 / 2) * .0308,
    i % 2 ? .315 : .270, "sfp", .026, .023, i % 2 ? .348 : .238));
  for (let i = 0; i < 4; i++) sockets.push(socket(ports, 49 + i, .47 + Math.floor(i / 2) * .044,
    i % 2 ? .315 : .270, "qsfp", .035, .023, i % 2 ? .348 : .238));
  const front = [mark("ARISTA 7304X3", .052, .008, .22, .022), ...supervisor.components,
    part("vent", .049, .207, .904, .008, "line-slot-3-grille", "arista-modular-mesh", "DCS-7300X3-48YC4-LC"),
    part("handle", .023, .263, .025, .067, "line-slot-3-left-release"), part("handle", .956, .263, .023, .067, "line-slot-3-right-release"),
    mark("3", .020, .218, .020, .019),
    ...[.375, .505, .635].map((y, i) => blank(.048, y, .904, .109, `line-slot-${i + 4}-cover`, "DCS-7300-LCVR", `SLOT ${i + 4} COVER`)),
    ...[.051, .277].map((x, i) => ({ ...part("psu", x, .785, .214, .177, `PS${i + 1}`, "arista-3kt-blue", "PWR-3KT-AC-BLUE"), label: `PS${i + 1}` })),
    ...[.503, .729].map((x, i) => blank(x, .785, .214, .177, `PS${i + 3}-cover`, "DCS-7300-PCVR", `PS${i + 3} COVER`)),
  ];
  const rear = [part("vent", .043, .25, .065, .70, "left-exhaust", "arista-modular-mesh"),
    part("vent", .13, .905, .815, .065, "bottom-exhaust", "arista-modular-mesh"),
    part("coax", .127, .06, .016, .020, "esd-ground", "arista-mcx")];
  for (let i = 0; i < 4; i++) {
    const x = .135 + i * .205;
    rear.push({ ...part("fabric-module", x, .13, .194, .745, `fabric-slot-${i + 1}`, "arista-7304x3-fabric", "DCS-7304X3-FM-F"), fanCount: 2, fanSKU: "FAN-7002H-F", label: `FM${i + 1}` });
  }
  return { front: { ports: sockets, components: front }, rear: { ports: [], components: rear } };
}

/** Trace SUP2's optional clock cover, status bank, two USB ports, console and two management sockets. */
function supervisor7500(ports) {
  return { ports: [socket(ports, 37, .336, .243, "rj45", .030, .039, .298, "M1"),
    socket(ports, 38, .375, .243, "rj45", .030, .039, .298, "M2"),
    socket(ports, 39, .283, .243, "console", .030, .039, .298, "CON")],
  components: [part("vent", .10, .158, .345, .039, "supervisor-1-grille", "arista-modular-mesh", "DCS-7500-SUP2"),
    part("status-panel", .085, .221, .160, .045, "supervisor-1-status", "arista-7500-status"),
    part("usb", .412, .227, .013, .041, "storage-usb-1"), part("usb", .439, .227, .013, .041, "storage-usb-2"),
    part("button", .250, .245, .012, .015, "optional-clock-cover"),
    part("handle", .030, .23, .034, .049, "supervisor-1-left-ejector"), part("handle", .473, .23, .028, .049, "supervisor-1-right-ejector"),
    blank(.528, .153, .437, .123, "supervisor-2-cover", "DCS-7500-SCVR", "SUP2 COVER"),
  ] };
}

/** Trace 7504N's one 36CQ card, covered remaining slots and six rear integrated fabric/fan modules below four supplies. */
function panels7504(ports) {
  const supervisor = supervisor7500(ports), sockets = [...supervisor.ports];
  for (let i = 0; i < 36; i++) sockets.push(socket(ports, i + 1, .077 + Math.floor(i / 4) * .102 + Math.floor(i % 4 / 2) * .042,
    i % 2 ? .463 : .415, "qsfp", .034, .026, i % 2 ? .504 : .374));
  return { front: { ports: sockets, components: [mark("ARISTA 7504N", .06, .024, .22, .027),
    part("vent", .05, .093, .421, .029, "left-upper-grille", "arista-modular-mesh"),
    part("vent", .536, .093, .421, .029, "right-upper-grille", "arista-modular-mesh"),
    ...supervisor.components,
    part("vent", .062, .335, .886, .011, "line-slot-3-grille", "arista-modular-mesh", "DCS-7500R3-36CQ-LC"),
    part("handle", .024, .403, .025, .072, "line-slot-3-left-release"), part("handle", .955, .403, .023, .072, "line-slot-3-right-release"),
    ...[.54, .687, .834].map((y, i) => blank(.049, y, .904, .115, `line-slot-${i + 4}-cover`, "DCS-7500-LCVR", `SLOT ${i + 4} COVER`)),
    ...[.062, .908].map((x, i) => part("screw", x, .060, .015, .018, `ground-${i + 1}`)),
  ] }, rear: { ports: [], components: [
    ...Array.from({ length: 4 }, (_, i) => ({ ...part("psu", .049 + i * .228, .040, .218, .228, `PS${i + 1}`, "arista-3kt-red", "PWR-3KT-AC-RED"), label: `PS${i + 1}` })),
    ...Array.from({ length: 6 }, (_, i) => ({ ...part("fabric-module", .115 + i * .142, .315, .133, .635, `fabric-slot-${i + 1}`, "arista-7504r3-fabric", "DCS-7504R3-FM"), label: `FM${i + 1}`, integratedFanModule: true })),
    part("status-panel", .047, .337, .043, .11, "chassis-status", "arista-7504-status"),
    part("screw", .05, .63, .019, .025, "chassis-ground"),
  ] } };
}
