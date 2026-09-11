import { canonicalFaceplateDevice } from "./faceplate-profile.js";
import { fitAristaAllocation } from "./faceplate-arista-allocation.js";

const dataRoot = "https://www.arista.com/assets/data/pdf/";
const hardwareGuide = "https://www.arista.com/en/hg-dmf/hg-dmf-arista-supported-hardware";
const guide7280 = `${dataRoot}qsg/qsg-books/QS_7280R3.pdf`;
const definitions = new Map([
  ["7260 family", { sku: "DCS-7260CX3-64-F", source: hardwareGuide, page: "Arista 7260CX3-64, Figures 13 and 14",
    front: `${hardwareGuide}#bookmark59`, rear: `${hardwareGuide}#bookmark59`,
    supplemental: `${dataRoot}Datasheets/7260X3_Datasheet.pdf#page=7`,
    configuration: "7260CX3-64 (not 64E), 2U, 64 QSFP28 at 100G, two SFP+ at 10G, two PWR-745AC-F 750W supplies and four FAN-7002-F trays, front-to-rear airflow; no breakout endpoints or external ground extender.",
    map: [[57, 67], [58, 68]] }],
  ["7280 family", { sku: "DCS-7280SR3-48YC8-F", source: guide7280, page: "PDF front 55 Figure C-6; rear 57 Figure D-1",
    front: `${guide7280}#page=55`, rear: `${guide7280}#page=57`,
    supplemental: `${dataRoot}Datasheets/7280R3-Data-Sheet.pdf#page=13`,
    configuration: "7280SR3-48YC8, 1U, 48 SFP28 at 25G and eight QSFP28 at 100G, two PWR-511-AC-RED 500W supplies and two FAN-7011M-F modules, front-to-rear airflow; external ground extender absent.",
    map: [...Array.from({ length: 48 }, (_, i) => [i + 1, i + 1]), [57, 57], [58, 58]] }],
]);
const profiles = new Map();

/** Resolve only the two disclosed chassis selections, keeping old inventories behind explicit revision maps. */
export function resolveAristaNextFaceplate(device) {
  if (device?.faceplate?.vendor !== "Arista" || !definitions.has(device.model)) return null;
  if (!profiles.has(device.model)) {
    const canonical = canonicalFaceplateDevice(device);
    if (!canonical) return null;
    const definition = definitions.get(device.model);
    profiles.set(device.model, {
      id: `arista-${definition.sku.toLowerCase()}-family-selection`, family: device.model, sku: definition.sku,
      defaultFace: "front", fidelity: "model", panelFidelity: { front: "model", rear: "model" },
      inventoryRevision: 1, inventoryComplete: true, rearHardwareVerified: true,
      source: definition.source, sourcePage: definition.page,
      evidence: { scope: "model", models: [definition.sku], selectedModel: definition.sku, catalogAlias: device.model,
        front: definition.front, rear: definition.rear, supplemental: definition.supplemental, configuration: definition.configuration },
      note: `${device.model} explicitly selects ${definition.sku}. ${definition.configuration}`,
      limitations: [definition.configuration, "Only this selected chassis and airflow/power bundle is represented. Grille perforations and small manufacturer markings are simplified; status lenses are static and storage USB is decorative. Physical MGT/CON abbreviations do not replace edited captions."],
      catalogDiscrepancies: ["The historical family placeholder contained 48 SFP28, eight 400G QSFP-DD, management and console endpoints in 2U. Corrected inventories and rack height apply only to new instances; saved IDs, settings, captions, cables and rack allocation are preserved.",
        "Only explicitly compatible revision-zero endpoints map to sockets. The original 400G endpoints are unsupported; 7260 also leaves original SFP28 endpoints unmapped. Unknown revisions never infer a migration."],
      legacyLayouts: [{ inventoryRevision: 0, portIndexMap: Object.fromEntries(definition.map),
        portLabels: Object.fromEntries([...Array.from({ length: 56 }, (_, i) => [i + 1, String(i + 1)]), [57, "MGMT"], [58, "CONSOLE"]]) }],
      chassis: { x: .025, y: .04, width: .95, height: .92 },
      faces: device.model === "7260 family" ? panels7260(canonical.device.ports) : panels7280(canonical.device.ports),
    });
  }
  return fitAristaAllocation(profiles.get(device.model), device, device.model === "7260 family" ? 2 : 1);
}

/** Place one observed ancillary part using normalized panel coordinates. */
function part(kind, x, y, width, height, role, variant) {
  return { kind, x, y, width, height, ...(role ? { role } : {}), ...(variant ? { variant } : {}) };
}

/** Reserve a bounded manufacturer marking region. */
function marking(label, x, y, width, height, fontSize = 4) {
  return { ...part("text", x, y, width, height), label, fontSize };
}

/** Bind one canonical endpoint to its source socket and independently fitted caption strip. */
function socket(ports, index, x, y, kind, width, height, captionY, physicalLabel) {
  const port = ports.find((entry) => entry.portIndex === index);
  return { portIndex: index, type: port.type, label: port.label, physicalLabel: physicalLabel ?? port.label,
    connectorKind: kind, x, y, width, height,
    descriptionAnchor: { x, y: captionY, fontSize: 5.5, boxHeight: 7, boxWidth: physicalLabel ? .045 : width } };
}

/** Trace the non-enhanced 7260CX3-64: four QSFP rows, right service stack, four square trays and two stacked 745AC supplies. */
function panels7260(ports) {
  const rows = [.29, .43, .65, .79], captions = [.19, .515, .565, .89];
  const front = Array.from({ length: 64 }, (_, i) => {
    const row = Math.floor(i / 32) * 2 + i % 2;
    return socket(ports, i + 1, .105 + Math.floor(i % 32 / 4) * .108 + Math.floor(i % 4 / 2) * .042,
      rows[row], "qsfp", .039, .112, captions[row]);
  });
  front.push(socket(ports, 65, .956, .29, "sfp", .028, .11, .19),
    socket(ports, 66, .956, .43, "sfp", .028, .11, .52),
    socket(ports, 67, .956, .67, "rj45", .028, .12, .58, "MGT"),
    socket(ports, 68, .956, .86, "console", .028, .12, .965, "CON"));
  return { front: { ports: front, components: [
    marking("ARISTA 7260CX3-64", .009, .018, .15, .035),
    part("vent", .010, .105, .052, .85, "left-grille", "mesh"),
    part("vent", .163, .025, .820, .085, "top-grille", "mesh"),
    part("vent", .074, .95, .855, .030, "bottom-grille", "mesh"),
    ...Array.from({ length: 7 }, (_, i) => part("vent", .172 + i * .108, .23, .018, .63, `bank-grille-${i + 1}`, "mesh")),
    part("usb", .942, .758, .028, .035, "storage-usb"),
    ...Array.from({ length: 4 }, (_, i) => ({ ...part("led", .985, .585 + i * .036, .005, .019, `system-led-${i}`, "square"), active: false })),
  ] }, rear: { ports: [], components: [
    ...[.010, .205, .400, .595].map((x, i) => ({ ...part("fan-tray", x, .03, .187, .94, `fan-tray-${i + 1}`, "arista-fan-7002"), sku: "FAN-7002-F", fanCount: 1 })),
    ...[.03, .52].map((y, i) => ({ ...part("psu", .798, y, .192, .44, `PS${i + 1}`, "arista-pwr-745ac"), sku: "PWR-745AC-F", label: `PS${i + 1}` })),
  ] } };
}

/** Trace the 7280SR3 split SFP28 banks, central eight QSFP28 sockets and datasheet-confirmed two-module rear. */
function panels7280(ports) {
  const front = Array.from({ length: 48 }, (_, i) => socket(ports, i + 1,
    (i < 24 ? .028 : .609) + Math.floor(i % 24 / 2) * .0324 + (i % 24 >= 12 ? .007 : 0),
    i % 2 ? .76 : .41, "sfp", .028, .22, i % 2 ? .94 : .235));
  for (let i = 0; i < 8; i++) front.push(socket(ports, 49 + i, .435 + Math.floor(i / 2) * .0445,
    i % 2 ? .76 : .41, "qsfp", .040, .22, i % 2 ? .94 : .235));
  return { front: { ports: front, components: [
    marking("ARISTA", .007, .024, .057, .09),
    ...[[.065, .325], [.417, .177], [.608, .349]].map(([x, width]) => part("vent", x, .02, width, .125, undefined, "mesh")),
    ...Array.from({ length: 4 }, (_, i) => ({ ...part("led", .960 + i * .008, .07, .005, .045, `system-led-${i}`, "square"), active: false })),
  ] }, rear: { ports: [socket(ports, 57, .210, .29, "rj45", .027, .24, .08, "MGT"),
    socket(ports, 58, .210, .75, "console", .027, .24, .94, "CON")], components: [
    ...[.005, .818].map((x, i) => ({ ...part("psu", x, .035, .176, .93, `PS${i + 1}`, "arista-pwr-511-ac"), sku: "PWR-511-AC-RED", label: `PS${i + 1}` })),
    part("usb", .197, .465, .026, .085, "storage-usb"),
    ...[.242, .627].map((x, i) => ({ ...part("fan-tray", x, .035, .183, .93, `fan-tray-${i + 1}`, "arista-fan-7011m"), sku: "FAN-7011M-F", fanCount: 1 })),
    marking("ARISTA", .465, .19, .12, .10), marking("7280SR3", .465, .44, .12, .10),
    marking("PS1 <  FRONT TO REAR  > PS2", .434, .78, .185, .10, 3),
  ] } };
}
