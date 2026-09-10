import { canonicalFaceplateDevice } from "./faceplate-profile.js";

const support = "https://support.hpe.com/hpesc/public/docDisplay?docId=";
const definitions = {
  "ProLiant DL360": { key: "dl360", guide: "sd00002444en_us", sku: "P52499-B21", backplane: "P48895-B21", units: 1,
    front: "5A9FE613-8CE7-4C3D-AB90-33B2AEB3125B", rear: "F07EAA50-6E50-4740-892B-0D6B48506F27",
    drives: "DF9B0BF4-CE01-4C22-8FD2-A064BA9C8930", status: "B3D15897-7D25-48A6-9ED9-A71BFA7FF1FA",
    quickspecs: "a50004306enw", slotGuide: "sd00002445en_us", slot: "B6A57ACE-23B5-4D78-A8DD-DB534D3932A0" },
  "ProLiant DL380": { key: "dl380", guide: "sd00002446en_us", sku: "P52534-B21", backplane: "P48813-B21", units: 2,
    front: "642A6FA5-F589-4B91-BE33-DD6CA55DA367", rear: "17080FBE-2D18-4FD2-BD72-8000713F6A68",
    drives: "E0AC714A-213E-4C40-B4D9-10278C9C3821", status: "4A9243DE-B0EA-45C4-B921-A7637D55D4E9",
    quickspecs: "a50004307enw", slotGuide: "sd00002446en_us", slot: "A77F7015-DE6A-4224-9AEF-A8809C9F11E4" },
};
const cache = new Map();

/** Resolve only the two explicitly selected Gen11 configurations, independently of saved rack height. */
export function resolveHPEServerFaceplate(device) {
  const definition = definitions[device?.model];
  if (!definition || device.faceplate?.vendor !== "HPE" || device.category !== "Server") return null;
  const canonical = canonicalFaceplateDevice(device);
  if (!canonical) return null;
  if (!cache.has(canonical.catalog)) cache.set(canonical.catalog, serverProfile(canonical.device, definition));
  return cache.get(canonical.catalog);
}

/** Link each measured panel and option to its exact manufacturer or identified supplier evidence. */
function serverProfile(device, definition) {
  const page = (id) => `${support}${definition.guide}&page=GUID-${id}.html`;
  const configuration = `${definition.units}U ${device.model} Gen11 8SFF NC CTO ${definition.sku}: eight SATA Basic Carriers, ${definition.backplane} x1 backplane with direct SATA motherboard connection, one CPU, P10097-B21 BCM57416 dual 10Gb BASE-T in physical slot 15/OCP2 with P51911-B21 enablement, and two P38995-B21 800W C14 supplies. No bezel, optional media/SID, serial, rear drives, PCIe cards or second OCP card; unused positions are covered.`;
  return { id: `hpe-${definition.key}-gen11`, family: `${device.model} Gen11`, fidelity: "model", defaultFace: "rear",
    sku: `${device.model} Gen11 · ${definition.sku} · 8SFF / BCM57416`,
    source: page(definition.front), sourcePage: "Individual Gen11 User Guide: SFF front, rear, drive boxes/numbering and status diagrams; exact BCM57416 supplier front and product-label photographs",
    inventoryRevision: 1, inventoryComplete: true, note: configuration, limitations: [configuration],
    evidence: { models: [device.model], sku: definition.sku, scope: "model", reviewed: "2026-09-10",
      front: page(definition.front), rear: page(definition.rear), drives: page(definition.drives), status: page(definition.status),
      supplemental: `https://www.hpe.com/us/en/collaterals/collateral.${definition.quickspecs}.html`,
      slot: `${support}${definition.slotGuide}&page=GUID-${definition.slot}.html`,
      adapterFront: "https://www.itcreations.com/images/products/large/P13640-001_3.jpg?1641546953",
      adapterIdentity: "https://www.itcreations.com/images/products/large/P13640-001_4.jpg?1641546963",
      adapterProvenance: "IT Creations supplier-watermarked five-angle photo set, not an HPE photograph. The same set visibly identifies SPS P13640-001, BCM57416 and option P10097-B21; its straight-on panel labels P1 left and P2 right.",
      power: "https://www.hpe.com/us/en/collaterals/collateral.c04346217.html", configuration },
    legacyLayouts: [{ inventoryRevision: 0, portIndexMap: { 1: 1, 2: 2, 5: 3 },
      portLabels: { 1: "NIC1", 2: "NIC2", 5: "iLO1" } }],
    catalogDiscrepancies: [configuration,
      "The generation-free catalog formerly supplied four 10Gb NICs and iLO. The selected two-port adapter retains old NIC1/2 and iLO identities, labels, VLANs and settings; unspecified NIC3/4 remain unmapped.",
      "Front iLO Service USB-A is an ancillary maintenance host for a supported Q7Y55A USB-Ethernet adapter or flash drive, not a serial console or direct Ethernet endpoint. USB peripherals and VGA are artwork; rear iLO RJ45 is connectable.",
      "New DL360 instances use 1U and DL380 uses 2U. Existing saved rack heights and positions are unchanged; a saved non-native height scales the selected physical drawing to its reserved space.",
      "The BCM57416 face uses identified supplier photographs because the HPE Store listing currently shows a different adapter. The manufacturer guides and QuickSpecs establish chassis and option compatibility."],
    chassis: { x: 0, y: definition.units === 1 ? .10 : .11, width: 1, height: definition.units === 1 ? .80 : .72 },
    faces: definition.units === 1 ? { front: frontDL360(), rear: rearDL360(device) }
      : { front: frontDL380(), rear: rearDL380(device) },
  };
}

/** Place a physical component by its measured top-left bounds; roles remain metadata rather than printed text. */
function part(kind, x, y, width, height, role, variant) {
  return { kind, x, y, width, height, ...(role ? { role } : {}), ...(variant ? { variant } : {}) };
}

/** Bind canonical inventory to the selected card, using only photographed physical labels. */
function socket(device, index, x, y, width, height, physicalLabel, captionY, captionX = x) {
  const port = device.ports.find((candidate) => candidate.portIndex === index);
  if (!port) throw new Error(`${device.model}: selected connector ${index} is absent from canonical inventory`);
  return { portIndex: index, type: port.type, label: port.label, x, y, width, height, physicalLabel,
    descriptionAnchor: { x: captionX, y: captionY, fontSize: 5.5, boxHeight: 7 } };
}

/** Keep the Basic Carrier's printed bay number and source orientation distinct from network-port inventory. */
function drive(number, x, y, width, height, vertical = false) {
  return { ...part("drive-carrier", x, y, width, height, "sata-drive", "hpe-basic"), driveNumber: number,
    ...(vertical ? { orientation: "vertical" } : {}) };
}

/** Trace DL360's three stacked carrier pairs and two lower-right bays, with the optional media area blanked. */
function frontDL360() {
  const components = [part("handle", .008, .09, .031, .81, "left-rack-ear"),
    part("handle", .973, .09, .023, .81, "right-rack-ear"),
    part("vent", .573, .13, .324, .32, "media-blank"),
    part("usb", .929, .10, .013, .28, "ilo-service"), part("usb", .929, .57, .013, .28, "usb-storage"),
    part("button", .949, .16, .017, .15, "status-power"), part("led", .953, .37, .009, .08, "status-health"),
    part("led", .953, .53, .009, .08, "status-nic"), part("button", .949, .69, .017, .15, "status-uid")];
  for (let column = 0; column < 3; column++) components.push(drive(column * 2 + 1, .064 + column * .169, .135, .159, .335));
  for (let column = 0; column < 5; column++) components.push(drive(column < 3 ? column * 2 + 2 : column + 4,
    .064 + column * .169, .55, .159, .335));
  return { components, ports: [] };
}

/** Trace DL380's right-hand eight-drive box and separate status/service strip without optional SID hardware. */
function frontDL380() {
  const components = [part("handle", .004, .53, .032, .42, "left-rack-ear"),
    part("handle", .970, .53, .026, .42, "right-rack-ear"),
    part("vent", .074, .105, .246, .77, "drive-box1-blank"), part("vent", .353, .105, .254, .77, "drive-box2-blank"),
    part("vent", .913, .11, .016, .33, "sid-vent"), part("module-bay", .910, .52, .023, .39, "sid-blank"),
    part("usb", .978, .09, .012, .15, "ilo-service"), part("usb", .978, .315, .012, .15, "usb-storage"),
    part("button", .952, .102, .015, .065, "status-power"), part("led", .955, .19, .009, .04, "status-health"),
    part("led", .955, .266, .009, .04, "status-nic"), part("button", .952, .34, .015, .065, "status-uid")];
  for (let index = 0; index < 8; index++) components.push(drive(index + 1, .625 + index * .035, .08, .0328, .87, true));
  return { components, ports: [] };
}

/** Trace the adapter's perforated metal between its two RJ45 sockets without placing a blank over live ports. */
function adapterVents(y, height) {
  return [part("vent", .406, y, .025, height, "ocp15-left-vent"),
    part("vent", .478, y, .014, height, "ocp15-center-vent"), part("vent", .538, y, .026, height, "ocp15-right-vent")];
}

/** Trace DL360's three covered PCIe positions and its separate lower service/card row. */
function rearDL360(device) {
  const components = [part("handle", .009, .16, .024, .69, "left-rack-ear"),
    part("handle", .969, .16, .024, .69, "right-rack-ear"),
    part("vent", .038, .055, .040, .43, "left-exhaust"),
    part("module-bay", .085, .045, .230, .48, "pcie-cover"),
    part("module-bay", .326, .045, .122, .48, "pcie-cover"),
    part("module-bay", .468, .045, .174, .48, "pcie-cover"),
    part("vent", .060, .615, .160, .26, "ocp14-blank"),
    part("usb", .247, .60, .030, .10, "usb-storage"), part("usb", .247, .78, .030, .10, "usb-storage"),
    part("module-bay", .331, .62, .063, .24, "serial-blank"),
    part("vga", .574, .64, .064, .23, "vga"), ...adapterVents(.615, .24),
    part("psu", .651, .035, .143, .91, "ps2", "hpe-flexslot-800"),
    part("psu", .802, .035, .143, .91, "ps1", "hpe-flexslot-800")];
  return { components, ports: [socket(device, 1, .455, .748, .037, .235, "P1", .935),
    socket(device, 2, .516, .748, .037, .235, "P2", .935),
    socket(device, 3, .300, .748, .033, .235, "iLO", .935, .307)] };
}

/** Trace DL380's two three-slot riser banks, covered tertiary riser and low service row above the chassis lip. */
function rearDL380(device) {
  const components = [part("handle", .009, .76, .024, .19, "left-rack-ear"),
    part("handle", .969, .76, .024, .19, "right-rack-ear"),
    part("vent", .659, .090, .081, .285, "tertiary-riser-left-blank"),
    part("handle", .748, .060, .032, .35, "tertiary-riser-handle"),
    part("vent", .787, .090, .067, .285, "tertiary-riser-right-blank"),
    part("vent", .886, .09, .046, .285, "right-exhaust"),
    part("vent", .060, .810, .160, .13, "ocp14-blank"),
    part("usb", .247, .785, .030, .045, "usb-storage"), part("usb", .247, .905, .030, .045, "usb-storage"),
    part("module-bay", .331, .805, .063, .115, "serial-blank"),
    part("vga", .574, .825, .064, .11, "vga"), ...adapterVents(.817, .113),
    part("psu", .651, .525, .143, .425, "ps2", "hpe-flexslot-800"),
    part("psu", .802, .525, .143, .425, "ps1", "hpe-flexslot-800")];
  for (const x of [.082, .394]) for (let row = 0; row < 3; row++) {
    components.push(part("module-bay", x, .065 + row * .22, .229, .188, "pcie-cover"));
  }
  return { components, ports: [socket(device, 1, .455, .865, .037, .115, "P1", .965),
    socket(device, 2, .516, .865, .037, .115, "P2", .965),
    socket(device, 3, .300, .865, .033, .115, "iLO", .965, .307)] };
}
