import { canonicalFaceplateDevice } from "./faceplate-profile.js";
import { fitAristaAllocation } from "./faceplate-arista-allocation.js";

const root = "https://www.arista.com/assets/data/pdf/";
const definitions = new Map([
  ["7010 family", { sku: "DCS-7010T-48-F", guide: "QS_7010_1RU.pdf", front: 35, rear: 36,
    configuration: "7010T-48 with 48 non-PoE 1G copper ports, four 10G SFP+ ports, two integrated AC supplies and one reversible dual-inline-fan module set for front-to-rear airflow.",
    map: [[57, 53], [58, 54]] }],
  ["7020 family", { sku: "DCS-7020TR-48-F", guide: "QS_7020_1RU_Gen3.pdf", front: 33, rear: 34,
    configuration: "7020TR-48 with 48 non-PoE 1G copper ports, six 10G SFP+ ports, two PWR-500AC supplies and four rear fan trays, front-to-rear airflow.",
    map: [[57, 55], [58, 56]] }],
  ["7050 family", { sku: "DCS-7050SX3-48YC8-F", exact: "7050SX3-48YC8", guide: "QS_7050_1RU_Gen3.pdf", front: 47, rear: 51,
    configuration: "7050SX3-48YC8 with 48 SFP28 ports at 25G, eight QSFP28 ports at 100G, two PWR-511-AC supplies and two dual-fan trays, front-to-rear airflow; optional external grounding adapter absent.",
    map: [...Array.from({ length: 48 }, (_, i) => [i + 1, i + 1]), [57, 58], [58, 57]] }],
  ["7060 family", { sku: "DCS-7060CX2-32S-F", exact: "7060CX2-32S", guide: "QS_7060_1RU_Gen3.pdf", front: 38, rear: 40,
    configuration: "7060CX2-32S with 32 QSFP28 ports at 100G, two SFP+ ports at 10G, two PWR-500AC supplies and four rear fan trays, front-to-rear airflow.",
    map: [[57, 36], [58, 35]] }],
]);
const profiles = new Map();

/** Resolve disclosed family selections, accepting the exact-SKU resolver without creating a module dependency cycle. */
export function resolveAristaFamilyFaceplate(device, resolveExact) {
  if (device?.faceplate?.vendor !== "Arista" || !definitions.has(device.model)) return null;
  if (!profiles.has(device.model)) {
    const canonical = canonicalFaceplateDevice(device);
    if (!canonical) return null;
    const definition = definitions.get(device.model), ports = canonical.device.ports;
    const exact = definition.exact ? resolveExact({ model: definition.exact, faceplate: { vendor: "Arista" } }) : null;
    if (definition.exact && !exact) return null;
    const source = `${root}qsg/qsg-books/${definition.guide}`;
    profiles.set(device.model, {
      id: `arista-${definition.sku.toLowerCase()}-family-selection`, family: device.model, sku: definition.sku, defaultFace: "front",
      fidelity: "model", panelFidelity: { front: "model", rear: "model" },
      inventoryRevision: 1, inventoryComplete: true, rearHardwareVerified: true,
      source, sourcePage: `PDF front ${definition.front}, rear ${definition.rear}`,
      evidence: { scope: "model", models: [definition.sku], selectedModel: definition.sku, catalogAlias: device.model,
        front: `${source}#page=${definition.front}`, rear: `${source}#page=${definition.rear}`,
        configuration: definition.configuration,
        ...(exact?.evidence.supplemental ? { supplemental: exact.evidence.supplemental } : {}) },
      note: `${device.model} explicitly selects ${definition.sku}. ${definition.configuration}`,
      limitations: [definition.configuration,
        "The alias selects this exact chassis and power/airflow bundle, not every chassis in the series. Storage USB is decorative; status lenses are static hardware artwork.",
        "Small grille perforations, release handles and manufacturer markings are simplified in this front/rear projection. Service captions use MGT/CON abbreviations in narrow strips; edited captions remain untouched."],
      catalogDiscrepancies: ["The original family placeholder had 48 SFP28, eight 400G QSFP-DD, management and console endpoints in 2U. Only new instances receive the selected 1U inventory; historical rack occupancy, IDs, labels, speeds, types, settings and cables remain untouched.",
        "Revision zero maps only compatible original endpoints. Unsupported 25G/400G sockets are explicitly unmapped; unknown revisions never infer a migration."],
      legacyLayouts: [{ inventoryRevision: 0, portIndexMap: Object.fromEntries(definition.map),
        portLabels: Object.fromEntries([...Array.from({ length: 56 }, (_, i) => [i + 1, String(i + 1)]), [57, "MGMT"], [58, "CONSOLE"]]) }],
      chassis: { x: .025, y: .04, width: .95, height: .92 },
      faces: exact ? selectedExactPanels(exact, ports, definition.exact) : device.model === "7010 family" ? copper7010Panels(ports) : copper7020Panels(ports),
    });
  }
  return fitAristaAllocation(profiles.get(device.model), device, 1);
}

/** Place a source-observed ancillary component in normalized top-left coordinates. */
function part(kind, x, y, width, height, role, variant) {
  return { kind, x, y, width, height, ...(role ? { role } : {}), ...(variant ? { variant } : {}) };
}

/** Keep manufacturer markings inside their measured reserved regions. */
function marking(label, x, y, width, height, fontSize = 4) {
  return { ...part("text", x, y, width, height), label, fontSize };
}

/** Bind a canonical endpoint to one measured socket and an independently reserved caption position. */
function socket(ports, index, x, y, kind, width = .028, height = .23, captionY = y < .55 ? .20 : .92, physicalLabel) {
  const port = ports.find((entry) => entry.portIndex === index);
  return { portIndex: index, type: port.type, label: port.label, physicalLabel: physicalLabel ?? port.label,
    connectorKind: kind, x, y, width, height,
    descriptionAnchor: { x, y: captionY, fontSize: 5.5, boxHeight: 7, ...(physicalLabel ? { boxWidth: .040 } : {}) } };
}

/** Represent the specific gridded single-fan tray using its observed module, grille, right latch and status lens. */
function tray(x, width, index) {
  return [{ ...part("module-bay", x, .045, width, .91, `fan-tray-${index}`, "populated"), fanCount: 1 },
    part("vent", x + .008, .12, width - .030, .69, undefined, "mesh"),
    { ...part("handle", x + width - .020, .13, .013, .69), ink: "#8c2236" },
    { ...part("led", x + .010, .85, .005, .04, `fan-${index}-status`, "square"), active: false }];
}

/** Reuse only identical, independently inspected exact-SKU geometry and bind its sockets to the family catalog inventory. */
function selectedExactPanels(exact, ports, model) {
  const faces = structuredClone(exact.faces);
  for (const panel of Object.values(faces)) for (const slot of panel.ports) {
    const port = ports.find((entry) => entry.portIndex === slot.portIndex);
    slot.type = port.type; slot.label = port.label;
  }
  return anchorAristaExactPanels(faces, model);
}

/** Reserve source-compatible caption strips on the two matching exact SKUs without changing socket coordinates or saved captions. */
export function anchorAristaExactPanels(faces, model) {
  if (!["7050SX3-48YC8", "7060CX2-32S"].includes(model)) return faces;
  for (const panel of Object.values(faces)) for (const slot of panel.ports) {
    if (slot.type === "Console") slot.physicalLabel = "CON";
    if (slot.physicalLabel === "MGMT") slot.physicalLabel = "MGT";
    const service = slot.portIndex > (model === "7050SX3-48YC8" ? 56 : 34);
    const captionY = service ? (slot.y < .55 ? .08 : .94) : slot.y < .55 ? (model === "7050SX3-48YC8" ? .24 : .185) : .945;
    slot.descriptionAnchor = { x: slot.x, y: captionY, fontSize: 5.5, boxHeight: 7, ...(service ? { boxWidth: .048 } : {}) };
  }
  return faces;
}

/** Trace 7010T's three sixteen-copper banks, right uplinks/service stack, integrated AC and covered reversible fan module. */
function copper7010Panels(ports) {
  const front = Array.from({ length: 48 }, (_, i) => socket(ports, i + 1,
    .025 + Math.floor(i / 16) * .278 + Math.floor(i % 16 / 2) * .033,
    i % 2 ? .72 : .40, i % 2 ? "rj45" : "rj45-inverted"));
  for (let i = 0; i < 4; i++) front.push(socket(ports, 49 + i, .852 + Math.floor(i / 2) * .035,
    i % 2 ? .72 : .40, "sfp", .029, .23));
  front.push(socket(ports, 53, .932, .36, "rj45", .029, .24, .15, "MGT"),
    socket(ports, 54, .932, .72, "console", .029, .24, .94, "CON"));
  return { front: { ports: front, components: [marking("ARISTA 7010T-48", .008, .025, .14, .08),
    part("vent", .690, .025, .20, .09, undefined, "mesh"),
    part("vent", .954, .06, .028, .25, undefined, "mesh"), part("usb", .968, .51, .016, .30, "storage-usb"),
    ...Array.from({ length: 4 }, (_, i) => ({ ...part("led", .956, .36 + i * .10, .005, .035, `system-led-${i}`, "square"), active: false }))] },
  rear: { ports: [], components: [
    part("power", .016, .25, .085, .52, "integrated-ac-1", "ac-c14"),
    part("power", .900, .25, .085, .52, "integrated-ac-2", "ac-c14"),
    part("vent", .123, .17, .153, .66, "exhaust-grille", "mesh"),
    marking("ARISTA", .285, .10, .105, .13, 6), marking("7010T-48", .285, .28, .105, .10),
    marking("FRONT TO REAR", .285, .56, .105, .08, 3),
    { ...part("module-bay", .407, .055, .204, .89, "reversible-fan-module", "populated"), fanCount: 2 },
    part("handle", .490, .12, .018, .74, "fan-module-handle"),
    marking("FAN", .55, .12, .045, .08, 3),
    { ...part("led", .419, .16, .005, .04, "fan-status", "square"), active: false },
    marking("AC 100–240V", .006, .85, .10, .07, 3), marking("AC 100–240V", .896, .85, .10, .07, 3),
    marking("AIRFLOW →", .620, .30, .13, .12, 4),
    part("module-bay", .79, .69, .09, .18, "ground-pad", "populated"),
    part("screw", .80, .73, .010, .10), part("screw", .853, .73, .010, .10),
  ] } };
}

/** Trace 7020TR's four twelve-copper banks around the six central SFP+ sockets, rear controls and four fan trays. */
function copper7020Panels(ports) {
  const starts = [.035, .245, .585, .795];
  const front = Array.from({ length: 48 }, (_, i) => socket(ports, i + 1,
    starts[Math.floor(i / 12)] + Math.floor(i % 12 / 2) * .0328,
    i % 2 ? .70 : .38, i % 2 ? "rj45" : "rj45-inverted", .029, .22, i % 2 ? .875 : .19));
  for (let i = 0; i < 6; i++) front.push(socket(ports, 49 + i, .452 + Math.floor(i / 2) * .044,
    i % 2 ? .70 : .38, "sfp", .030, .22, i % 2 ? .875 : .19));
  return { front: { ports: front, components: [marking("ARISTA", .009, .015, .06, .07),
    part("vent", .076, .012, .890, .085, undefined, "mesh"),
    part("vent", .035, .95, .930, .035, undefined, "mesh"),
    part("usb", .978, .46, .013, .32, "front-storage-usb"),
    ...Array.from({ length: 4 }, (_, i) => ({ ...part("led", .982, .13 + i * .075, .005, .035, `system-led-${i}`, "square"), active: false }))] },
  rear: { ports: [socket(ports, 55, .235, .29, "rj45", .030, .24, .08, "MGT"),
    socket(ports, 56, .235, .72, "console", .030, .24, .94, "CON")], components: [
    { ...part("psu", .008, .035, .201, .93, "PS1", "arista-pwr-500ac"), label: "PS1" },
    { ...part("psu", .794, .035, .197, .93, "PS2", "arista-pwr-500ac"), label: "PS2" },
    part("usb", .221, .46, .028, .09, "rear-storage-usb"),
    ...[.263, .392, .521, .650].flatMap((x, i) => tray(x, .120, i + 1)),
    part("screw", .778, .15, .009, .09, "ground-1"), part("screw", .778, .70, .009, .09, "ground-2"),
  ] } };
}
