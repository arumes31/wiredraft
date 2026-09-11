import { canonicalFaceplateDevice } from "./faceplate-profile.js";
import { resolveAristaFamilyFaceplate, anchorAristaExactPanels } from "./faceplate-arista-family-models.js";
import { resolveAristaNextFaceplate } from "./faceplate-arista-next-models.js";
import { resolveAristaModularFaceplate } from "./faceplate-arista-modular-models.js";
import { resolveArista7800Faceplate } from "./faceplate-arista-7800-models.js";

const ROOT = "https://www.arista.com/assets/data/pdf/";
const definitions = new Map([
  ["7050SX3-48YC8", { sku: "DCS-7050SX3-48YC8-F", guide: "QS_7050_1RU_Gen3.pdf", frontPage: 47, rearPage: 51,
    figures: "Front C-15; rear D-3, identified by model in grounding Figure 4-3 (PDF 24) and architecture white paper Figure 20 (PDF 12)",
    supplemental: `${ROOT}Whitepapers/7050X3_Architecture_WP.pdf#page=12`, oldCount: 57,
    configuration: "DCS-7050SX3-48YC8-F with two PWR-511-AC supplies and two dual-fan trays (four rotors), front-to-rear airflow. The optional external grounding adapter is not fitted." }],
  ["7060CX2-32S", { sku: "DCS-7060CX2-32S-F", guide: "QS_7060_1RU_Gen3.pdf", frontPage: 38, rearPage: 40,
    figures: "Front C-2; rear D-1 for models with front management ports; power input Table 4", oldCount: 35,
    configuration: "DCS-7060CX2-32S-F with two PWR-500AC supplies and four fan trays, front-to-rear airflow." }],
  ["720XP-48ZC2", { sku: "CCS-720XP-48ZC2-2F", guide: "QS_720XP_722XPM_1RU_Gen3.pdf", frontPage: 38, rearPage: 42,
    figures: "Front C-1; rear D-1; power-supply Table 5; 720XP datasheet specifications and ordering table", oldCount: 51,
    supplemental: `${ROOT}Datasheets/CCS-720XP-Datasheet.pdf`,
    configuration: "CCS-720XP-48ZC2-2F with two PWR-1021-AC-RED supplies and three fan trays, front-to-rear airflow." }],
]);
const cache = new Map();

/** Resolve individually inspected Arista SKUs and explicitly selected family configurations. */
export function resolveAristaFaceplate(device) {
  const chassis7800 = resolveArista7800Faceplate(device);
  if (chassis7800) return chassis7800;
  const modular = resolveAristaModularFaceplate(device);
  if (modular) return modular;
  const next = resolveAristaNextFaceplate(device);
  if (next) return next;
  const family = resolveAristaFamilyFaceplate(device, resolveAristaFaceplate);
  if (family) return family;
  const definition = definitions.get(device?.model);
  if (!definition || device.faceplate?.vendor !== "Arista") return null;
  if (!cache.has(device.model)) {
    const canonical = canonicalFaceplateDevice(device);
    if (!canonical) return null;
    const campus = device.model === "720XP-48ZC2";
    const source = `${ROOT}qsg/qsg-books/${definition.guide}`;
    const portIndexMap = Object.fromEntries(Array.from({ length: definition.oldCount }, (_, index) =>
      [index + 1, campus && index >= 48 ? index + 5 : index + 1]));
    cache.set(device.model, {
      id: `arista-${device.model.toLowerCase()}`, family: device.model, sku: definition.sku, defaultFace: "front",
      fidelity: "model", panelFidelity: { front: "model", rear: "model" }, inventoryRevision: 1, inventoryComplete: true,
      source, sourcePage: `PDF front ${definition.frontPage}, rear ${definition.rearPage}. ${definition.figures}.`,
      evidence: { models: [device.model], sku: definition.sku, scope: "model", reviewed: "2026-09-10",
        front: `${source}#page=${definition.frontPage}`, rear: `${source}#page=${definition.rearPage}`,
        configuration: definition.configuration, ...(definition.supplemental ? { supplemental: definition.supplemental } : {}) },
      legacyLayouts: [{ inventoryRevision: 0, portIndexMap,
        ...(campus ? { portLabels: { 49: "49", 50: "50", 51: "CONSOLE" } } : {}) }],
      limitations: [definition.configuration,
        "The catalog omits airflow and power-bundle suffixes. Storage USB is decorative; side ventilation and fine grille/release details use shared artwork."],
      catalogDiscrepancies: ["New inventory includes the previously omitted 1G Ethernet management endpoint. Revision-zero saved devices retain their original endpoint IDs and do not gain missing sockets automatically.",
        ...(campus ? ["New inventory corrects ports 1–40 to 2.5G and 41–48 to 5G copper, adds SFP28 ports 49–52, and numbers QSFP28 ports 53–54. Old QSFP indices 49–50 map to physical 53–54, and old console index 51 maps to 55; saved types, speeds and custom names remain unchanged."] : [])],
      chassis: { x: .025, y: .04, width: .95, height: .92 },
      faces: anchorAristaExactPanels(campus ? campusPanels(canonical.device.ports) : device.model === "7050SX3-48YC8"
        ? leafPanels(canonical.device.ports) : spinePanels(canonical.device.ports), device.model),
    });
  }
  return cache.get(device.model);
}

/** Describe a control, marking or field-replaceable module in normalized chassis coordinates. */
function part(kind, x, y, width, height, label, variant) {
  return { kind, x, y, width, height, ...(label ? { label } : {}), ...(variant ? { variant } : {}) };
}

/** Bind a measured socket to its canonical index and retain compatible older copper endpoint types. */
function socket(ports, index, x, y, width, height, physicalLabel = String(index), connectorKind) {
  const port = ports[index - 1];
  return { portIndex: port.portIndex, type: port.type, label: port.label, x, y, width, height, physicalLabel,
    ...(connectorKind ? { connectorKind } : {}), ...(port.type === "RJ45_MGIG" ? { compatibleTypes: ["RJ45_10G"] } : {}) };
}

/** Draw the visible grille and release handle of a tray without inventing exposed rotor openings. */
function fanTray(x, width, index, fanCount = 1) {
  return [
    { ...part("module-bay", x, .045, width, .91, `FAN ${index}`, "populated"), role: "fan-tray", fanCount },
    part("vent", x + .009, .13, width - .034, .64, undefined, "mesh"),
    part("handle", x + (fanCount === 2 ? width * .46 : width - .022), .15, .015, .62),
    part("led", x + .012, .84, .007, .05),
  ];
}

/** Trace 7050SX3's split 24-port SFP banks, central QSFP bank and separated dual-fan trays. */
function leafPanels(ports) {
  const front = ports.slice(0, 48).map((port, index) => socket(ports, port.portIndex,
    (index < 24 ? .028 : .606) + Math.floor(index % 24 / 2) * .0333,
    index % 2 ? .78 : .40, .028, .205));
  for (let index = 0; index < 8; index++) front.push(socket(ports, index + 49,
    .436 + Math.floor(index / 2) * .044, index % 2 ? .78 : .40, .040, .22));
  const frontComponents = [part("text", .008, .025, .051, .09, "ARISTA"),
    part("vent", .069, .025, .865, .16, undefined, "mesh"),
    ...Array.from({ length: 4 }, (_, index) => part("led", .948 + index * .011, .07, .006, .045))];
  const rear = [socket(ports, 57, .209, .75, .031, .255, "CONSOLE", "rj45"),
    socket(ports, 58, .209, .28, .031, .255, "MGMT", "rj45")];
  const rearComponents = [part("psu", .005, .035, .176, .93, "PS1", "arista-pwr-511-ac"),
    part("psu", .818, .035, .176, .93, "PS2", "arista-pwr-511-ac"),
    part("usb", .194, .47, .030, .085), ...fanTray(.242, .183, 1, 2), ...fanTray(.627, .183, 2, 2),
    part("text", .447, .29, .156, .12, "7050SX3-48YC8")];
  return { front: { ports: front, components: frontComponents }, rear: { ports: rear, components: rearComponents } };
}

/** Trace 7060CX2's left SFP pair, eight QSFP blocks, right service stack and four rear trays. */
function spinePanels(ports) {
  const front = ports.slice(0, 32).map((port, index) => socket(ports, port.portIndex,
    .096 + Math.floor(index / 4) * .107 + Math.floor(index % 4 / 2) * .044,
    index % 2 ? .73 : .35, .040, .205));
  front.push(socket(ports, 33, .040, .35, .028, .20), socket(ports, 34, .040, .73, .028, .20),
    socket(ports, 35, .948, .73, .030, .255, "CONSOLE", "rj45"),
    socket(ports, 36, .948, .29, .030, .255, "MGMT", "rj45"));
  const frontComponents = [part("text", .006, .01, .06, .08, "ARISTA"),
    part("vent", .074, .025, .84, .10, undefined, "mesh"),
    part("usb", .934, .48, .028, .07),
    ...Array.from({ length: 8 }, (_, index) => part("vent", .074 + index * .107, .51, .087, .07, undefined, "mesh")),
    ...Array.from({ length: 4 }, (_, index) => part("led", .981, .17 + index * .085, .005, .04))];
  const rearComponents = [part("psu", .010, .035, .201, .93, "PS1", "arista-pwr-500ac"),
    part("psu", .800, .035, .189, .93, "PS2", "arista-pwr-500ac"),
    ...[.242, .377, .512, .647].flatMap((x, index) => fanTray(x, .121, index + 1)),
    part("screw", .219, .28, .013, .105), part("screw", .219, .64, .013, .105)];
  return { front: { ports: front, components: frontComponents }, rear: { ports: [], components: rearComponents } };
}

/** Trace 720XP's four copper blocks, four SFP28/two QSFP28 uplinks and rear service/fan/PSU banks. */
function campusPanels(ports) {
  const starts = [.035, .303, .449, .720];
  const front = ports.slice(0, 48).map((port, index) => {
    const group = index < 16 ? 0 : index < 24 ? 1 : index < 40 ? 2 : 3;
    const offset = [0, 16, 24, 40][group];
    return socket(ports, port.portIndex, starts[group] + Math.floor((index - offset) / 2) * .0317,
      index % 2 ? .72 : .38, .0275, .22);
  });
  for (let index = 0; index < 4; index++) front.push(socket(ports, index + 49,
    .872 + Math.floor(index / 2) * .034, index % 2 ? .72 : .38, .027, .19));
  front.push(socket(ports, 53, .955, .38, .040, .205), socket(ports, 54, .955, .72, .040, .205));
  const frontComponents = [part("text", .006, .012, .046, .09, "ARISTA"),
    part("vent", .056, .020, .919, .12, undefined, "mesh"),
    ...Array.from({ length: 4 }, (_, index) => part("led", .983, .24 + index * .075, .005, .04)),
    part("text", .61, .90, .075, .07, "2.5G PoE"), part("text", .76, .90, .08, .07, "5G PoE")];
  const rear = [socket(ports, 55, .129, .73, .030, .25, "CONSOLE", "rj45"),
    socket(ports, 56, .129, .30, .030, .25, "MGMT", "rj45")];
  const rearComponents = [part("text", .039, .075, .045, .08, "ARISTA"),
    part("screw", .018, .13, .014, .11), part("screw", .018, .49, .014, .11),
    part("usb", .114, .48, .03, .07),
    ...[.185, .319, .453].flatMap((x, index) => fanTray(x, .126, index + 1)),
    part("psu", .596, .035, .191, .93, "PS1", "ac-fan-left"),
    part("psu", .801, .035, .191, .93, "PS2", "ac-fan-left")];
  return { front: { ports: front, components: frontComponents }, rear: { ports: rear, components: rearComponents } };
}
