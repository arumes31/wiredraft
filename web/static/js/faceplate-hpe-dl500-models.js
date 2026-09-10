import { canonicalFaceplateDevice } from "./faceplate-profile.js";

const source = "https://support.hpe.com/hpesc/public/api/document/a00008181enw";
const cache = new Map();

/** Resolve the explicitly selected DL560 Gen10 configuration without guessing installed hardware from labels. */
export function resolveHPEDL500Faceplate(device) {
  if (device?.faceplate?.vendor !== "HPE" || device.category !== "Server" || device.model !== "ProLiant DL560") return null;
  const canonical = canonicalFaceplateDevice(device);
  if (!canonical) return null;
  if (!cache.has(canonical.catalog)) cache.set(canonical.catalog, dl560Profile(canonical.device));
  return cache.get(canonical.catalog);
}

/** Record the sourced CTO population and keep the historical five endpoints in their original namespace. */
function dl560Profile(device) {
  const configuration = "ProLiant DL560 Gen10 841730-B21, 2U 8SFF: two CPUs, eight SATA Smart Carriers in right Box 3 with S100i storage, " +
    "default primary riser and 872253-B21 combined secondary/tertiary riser assembly, all eight PCIe positions covered; " +
    "665240-B21 I350-T4V2 four-port 1Gb FlexibleLOM and two 865414-B21 800W Platinum AC supplies. " +
    "Box 1/2, optional media, SID and additional PCIe adapters are absent. Dedicated iLO and rear DB9 serial are present.";
  return {
    id: "hpe-dl560-gen10", sku: "ProLiant DL560 Gen10 · 841730-B21", family: "ProLiant DL560 Gen10",
    defaultFace: "rear", fidelity: "model", panelFidelity: { front: "model", rear: "model" },
    inventoryRevision: 1, inventoryComplete: true, rearHardwareVerified: true,
    source, sourcePage: "QuickSpecs pages 1–2: individual front/rear; 9: risers; 26: base CTO; 29–30: power/network options",
    evidence: { scope: "model", models: [device.model], sku: "841730-B21", reviewed: "2026-09-11",
      front: `${source}#page=1`, rear: `${source}#page=2`, configuration,
      inventory: `${source}#page=30`, risers: `${source}#page=9`, power: `${source}#page=29` },
    note: configuration,
    limitations: [configuration, "The generation-free catalog name selects this Gen10 configuration, not every DL560 generation or option.",
      "The selected butterfly riser assembly replaces the separate secondary assembly; it does not add a second overlapping riser.",
      "Diagrams preserve relative panel topology. Side/top details, live LEDs and internal components are outside the projection."],
    legacyLayouts: [{ inventoryRevision: 0, portIndexMap: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 },
      portLabels: { 1: "NIC1", 2: "NIC2", 3: "NIC3", 4: "NIC4", 5: "iLO1" } }],
    catalogDiscrepancies: ["The former four 10Gb NIC endpoints retain IDs, saved types and speeds on the selected four 1Gb FlexibleLOM sockets. The rightmost physical jack is port 1.",
      "New devices append DB9 serial at index 6; saved inventories retain all five original endpoints without fabrication or replacement.",
      "Front iLO Service USB-A is ancillary maintenance hardware, not a serial console or direct Ethernet endpoint. Host USB and VGA remain artwork."],
    chassis: { x: 0, y: .10, width: 1, height: .68 },
    faces: { front: dl560Front(), rear: dl560Rear(device.ports) },
  };
}

/** Position static ancillary hardware separately from connectable endpoint inventory. */
function part(kind, x, y, width, height, role, variant) {
  return { kind, x, y, width, height, role, active: false, ...(variant ? { variant } : {}) };
}

/** Trace each covered expansion bracket's metal border around a recessed perforated grille. */
function slotCover(x, y, width) {
  return [part("module-bay", x, y, width, .16, "pcie-slot-cover", "blank"),
    part("vent", x + width * .13, y + .025, width * .74, .11, "pcie-airflow", "perforated")];
}

/** Trace the two empty drive boxes, right-hand eight-SFF cage and standard front service strip. */
function dl560Front() {
  const components = [part("handle", .009, .08, .035, .86, "left-rack-ear"),
    part("handle", .963, .08, .029, .86, "right-rack-ear"),
    ...[.060, .340].flatMap((x) => [part("module-bay", x, .04, .271, .91, "empty-drive-box", "blank"),
      part("vent", x + .025, .18, .221, .64, "drive-box-airflow", "perforated")]),
    ...Array.from({ length: 8 }, (_, index) => ({ ...part("drive-carrier", .625 + index * .036, .05, .033, .88, "box-3-sata", "hpe-smart"), orientation: "vertical" })),
    part("button", .933, .075, .011, .068, "power"), part("led", .934, .19, .009, .042, "health"),
    part("led", .934, .29, .009, .042, "nic"), part("button", .933, .39, .011, .060, "uid"),
    part("usb", .929, .53, .012, .17, "ilo-service"), part("usb", .929, .76, .012, .17, "usb3-host"),
    part("module-bay", .912, .67, .006, .27, "serial-label-pull-tag", "blank")];
  return { ports: [], components };
}

/** Bind the four reversed FlexibleLOM jacks, dedicated iLO and DB9 to stable canonical indices. */
function dl560Rear(ports) {
  const positions = [
    [.184, .88, .030, .12, "1", "rj45-inverted"], [.150, .88, .030, .12, "2", "rj45-inverted"],
    [.116, .88, .030, .12, "3", "rj45-inverted"], [.082, .88, .030, .12, "4", "rj45-inverted"],
    [.505, .88, .030, .12, "iLO", "rj45-inverted"], [.570, .88, .075, .14, "SERIAL", "db9"],
  ];
  const sockets = positions.map(([x, y, width, height, physicalLabel, connectorKind], index) => ({
    portIndex: ports[index].portIndex, type: ports[index].type, label: ports[index].label,
    x, y, width, height, physicalLabel, connectorKind,
    ...(index < 4 ? { compatibleTypes: ["RJ45_10G"] } : {}),
    descriptionAnchor: { x, y: .745, fontSize: 5.5, boxHeight: 7 },
  }));
  const components = [
    ...[.063, .373].flatMap((x) => Array.from({ length: 3 }, (_, i) => slotCover(x, .07 + i * .205, .238)).flat()),
    ...Array.from({ length: 2 }, (_, i) => slotCover(.663, .07 + i * .205, .222)).flat(),
    ...[.655, .823].map((x) => ({ ...part("psu", x, .49, .162, .48, "ac-supply", "hpe-flexslot-800"), sku: "865414-B21", watts: 800 })),
    ...[.805, .900].flatMap((y) => [part("usb", .245, y, .033, .061, "usb3-host"), part("usb", .365, y, .033, .061, "usb2-host")]),
    part("vga", .412, .826, .071, .107, "rear-vga"),
    part("led", .229, .875, .005, .035, "rear-uid"), part("vent", .303, .81, .034, .13, "rear-airflow", "perforated"),
    part("screw", .034, .80, .018, .10, "retaining-screw"), part("screw", .630, .80, .016, .10, "retaining-screw"),
    part("screw", .322, .14, .016, .10, "riser-screw"), part("screw", .612, .14, .016, .10, "riser-screw")];
  return { ports: sockets, components };
}
