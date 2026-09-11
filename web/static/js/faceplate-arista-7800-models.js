import { canonicalFaceplateDevice } from "./faceplate-profile.js";
import { fitAristaAllocation } from "./faceplate-arista-allocation.js";

const guide = "https://www.arista.com/assets/data/pdf/qsg/qsg-books/QS_7800_Modular.pdf";
const data = "https://www.arista.com/assets/data/pdf/Datasheets/7800R3-Data-Sheet.pdf";
const configuration = "DCS-7804R3-BND: DCS-7804-CH 10U, one DCS-7800-SUP1A in supervisor slot1, one DCS-7800R3-36D-LC in line slot3, six PWR-D1-3041-AC-BLUE 3kW supplies in front PSU3-8, six DCS-7804R3-FM in rear slots1-6 with four FAN-7802-H each (24 total), front-to-rear airflow. Supervisor2, line slots4-6 and PSU1/2 are covered. Both extraction tools are stored below the linecards.";
let profile;

/** Resolve one disclosed 7804R3 population and preserve the proportions within saved rack allocations. */
export function resolveArista7800Faceplate(device) {
  if (device?.faceplate?.vendor !== "Arista" || device.model !== "7800 family") return null;
  const canonical = canonicalFaceplateDevice(device);
  if (!canonical) return null;
  profile ||= buildProfile(canonical.device);
  return fitAristaAllocation(profile, device, 10);
}

/** Disclose exact installed parts and explicit compatible legacy endpoints without mutating saved inventories. */
function buildProfile(device) {
  return { id: "arista-7804r3-bnd-selection", sku: "DCS-7804R3-BND", family: device.model,
    defaultFace: "front", fidelity: "model", panelFidelity: { front: "model", rear: "model" },
    inventoryRevision: 1, inventoryComplete: true, rearHardwareVerified: true, source: guide,
    sourcePage: "DOC-04133-08 PDF69 front,74 rear arrangement,54 exact R3 fabric,43 supervisor,80 36D linecard,63 D1 AC supply",
    evidence: { scope: "model", models: ["DCS-7804R3-BND"], selectedModel: "DCS-7804R3-BND", catalogAlias: device.model,
      front: `${guide}#page=69`, rear: `${guide}#page=74`, supplemental: `${guide}#page=54`, datasheet: data, configuration },
    note: `7800 family explicitly selects ${configuration}`,
    limitations: [configuration,
      "Current guide rear overview depicts R4; its explicit earlier-series note and the exact R3 fabric figure establish six R3 fabrics, not five fabrics plus a cooling-only module.",
      "Datasheet specifies four serviceable fans per R3 fabric; the guide's status figure labels only three fan LEDs. Internal fan count follows the datasheet; external grilles follow the personally inspected exact R3 figure. Rotors and electronics behind grilles remain hidden.",
      "Clock input and two USB storage sockets are ancillary hardware. Supplies have two SAF-D-GRID inputs each; electrical wiring and optical breakout are not synthesized as network endpoints. Tiny markings, perforations and covered-slot details are simplified.",
      "The 36D cage openings are portrait with approximately 2:1 height-to-width at the460px reference. Vertical internal rails use the shared rotated cage primitive; the small source figure's overlaid numbers obscure precise release-notch handedness, which remains simplified.",
      "Body dimensions match 439 by441mm at460px reference width under the existing normalized-width scene contract; saved allocations preserve the native body ratio at each display width without changing rack units."],
    catalogDiscrepancies: ["The old 58-endpoint 2U placeholder remains intact. Only new instances receive39 endpoints and10U.",
      "Old QSFP-DD400G indices49-56 map to selected card ports1-8, MGMT57 to37 and CONSOLE58 to39. Old SFP28 indices1-48 have no compatible socket in the selected card and remain unmapped. Unknown revisions remain unmapped."],
    legacyLayouts: [{ inventoryRevision: 0,
      portIndexMap: Object.fromEntries([...Array.from({ length: 8 }, (_, i) => [49 + i, 1 + i]), [57, 37], [58, 39]]),
      portLabels: Object.fromEntries([...Array.from({ length: 56 }, (_, i) => [i + 1, String(i + 1)]), [57, "MGMT"], [58, "CONSOLE"]]) }],
    chassis: { x: .025, y: .025, width: .95, height: (.95 * 460 * 439 / 441 + 16) / 1000 },
    faces: panels(device.ports) };
}

/** Place a measured ancillary housing in normalized chassis coordinates. */
function part(kind, x, y, width, height, role, variant, sku) {
  return { kind, x, y, width, height, role, ...(variant ? { variant } : {}), ...(sku ? { sku } : {}) };
}

/** Place a source label inside its reserved noninteractive hardware region. */
function mark(label, x, y, width, height) { return { ...part("text", x, y, width, height), label, fontSize: 5 }; }

/** Bind a source-traced connector and explicit caption box to its immutable canonical index. */
function socket(ports, index, x, y, kind, width, height, captionY, physicalLabel) {
  const port = ports.find((entry) => entry.portIndex === index);
  return { portIndex: index, type: port.type, label: port.label, physicalLabel: physicalLabel ?? port.label,
    x, y, width, height, connectorKind: kind,
    descriptionAnchor: { x, y: captionY, fontSize: 5.5, boxHeight: 7, boxWidth: width } };
}

/** Represent a documented unpopulated slot with its fitted cover and no fictitious connectors. */
function cover(x, y, width, height, role, sku, label) {
  return { ...part("module-bay", x, y, width, height, role, "arista-7800-cover", sku), label };
}

/** Trace the selected SUP1A, portrait36D card, covered slots, six front supplies and exact six R3 rear fabrics. */
function panels(ports) {
  const sockets = [socket(ports, 37, .381, .131, "rj45", .029, .033, .176, "M1"),
    socket(ports, 38, .424, .134, "sfp", .027, .030, .176, "M2"),
    socket(ports, 39, .292, .131, "console", .029, .033, .176, "CON")];
  for (let i = 0; i < 36; i++) {
    const cage = socket(ports, i + 1, .081 + Math.floor(i / 2) * .049,
      i % 2 ? .323 : .265, "qsfp-vertical", .019, .038, i % 2 ? .37 : .22);
    cage.descriptionAnchor.boxWidth = .030;
    sockets.push(cage);
  }
  const front = [mark("ARISTA 7804R3", .095, .006, .22, .023),
    part("vent", .065, .048, .36, .032, "supervisor-1-grille", "arista-7800-mesh", "DCS-7800-SUP1A"),
    part("status-panel", .116, .101, .13, .050, "supervisor-1-status", "arista-7800-status"),
    part("lock", .025, .088, .032, .064, "supervisor-1-lock", "arista-7800-lock"),
    part("coax", .258, .132, .012, .016, "clock-input"),
    part("usb", .326, .114, .013, .037, "storage-usb-1"), part("usb", .346, .114, .013, .037, "storage-usb-2"),
    cover(.51, .045, .445, .122, "supervisor-2-cover", "DCS-7800-SCVR", "SUP2 COVER"),
    part("lock", .025, .257, .032, .064, "line-slot-3-left-lock", "arista-7800-lock"),
    part("lock", .951, .257, .032, .064, "line-slot-3-right-lock", "arista-7800-lock"),
    ...[.402, .525, .648].map((y, i) => cover(.051, y, .893, .107, `line-slot-${i + 4}-cover`, "DCS-7800-LCVR", `SLOT ${i + 4} COVER`)),
    ...Array.from({ length: 19 }, (_, i) => part("vent", .056 + i * .049, .247, .013, .093, `line-slot-3-mesh-${i}`, "arista-7800-mesh", "DCS-7800R3-36D-LC")),
    ...[.10, .705].map((x, i) => part("tool", x, .777, .225, .018, `extraction-tool-${i + 1}`, "arista-7800-tool")),
    ...Array.from({ length: 8 }, (_, i) => i < 2
      ? cover(.085 + i * .109, .827, .103, .148, `PS${i + 1}-cover`, "DCS-7800-PCVR", `PS${i + 1}`)
      : { ...part("psu", .085 + i * .109, .827, .103, .148, `PS${i + 1}`, "arista-7800-d1-ac", "PWR-D1-3041-AC-BLUE"), label: `PS${i + 1}`, inputCount: 2 }),
    part("screw", .060, .011, .014, .016, "left-ground"), part("screw", .930, .011, .014, .016, "right-ground")];
  const rear = [mark("ARISTA 7804R3", .093, .015, .24, .025),
    part("coax", .51, .023, .017, .017, "esd-ground"),
    part("vent", .06, .871, .893, .103, "lower-triangular-grille", "arista-7800-triangles"),
    ...Array.from({ length: 6 }, (_, i) => ({ ...part("fabric-module", .10 + i * .143, .082, .136, .758,
      `fabric-slot-${i + 1}`, "arista-7804r3-fabric", "DCS-7804R3-FM"), label: `FM${i + 1}`, fanCount: 4, fanSKU: "FAN-7802-H" }))];
  return { front: { ports: sockets, components: front }, rear: { ports: [], components: rear } };
}
