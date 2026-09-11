import { canonicalFaceplateDevice } from "./faceplate-profile.js";
import { resolveHPEEntryServerFaceplate } from "./faceplate-hpe-entry-models.js";
import { resolveHPEDL500Faceplate } from "./faceplate-hpe-dl500-models.js";
import { resolveHPETowerFaceplate } from "./faceplate-hpe-tower-models.js";

const support = "https://support.hpe.com/hpesc/public/docDisplay?docId=";
const definitions = {
  "ProLiant DL325": { key: "dl325", amd: true, guide: "sd00002107en_us", sku: "P54199-B21", backplane: "P54999-B21", units: 1, ocp: 21,
    front: "9EC6CD99-62A5-411B-B953-DA17A472A5BD", rear: "61E26535-0F29-4C2B-AE56-177C2C7AAFDB",
    drives: "C7B447D8-3B80-4A17-8D75-10026C3EF841", status: "CB86CD46-BBBD-4CF0-98ED-177878BD634A",
    quickspecs: "a50004297enw", slotGuide: "sd00002107en_us", slot: "9E235B49-E2A0-4B6C-BA35-B383CB329C4C" },
  "ProLiant DL345": { key: "dl345", amd: true, guide: "sd00002113en_us", sku: "P54205-B21", backplane: "P55082-B21", cable: "P57121-B21", units: 2, ocp: 21,
    front: "A13551C5-C2C9-48EF-88AE-8771A8A24026", rear: "A4380FB5-E123-4F92-B5FB-18B1B2B59511",
    drives: "FD58AC0C-4613-4727-BE73-1B404D37368D", status: "0595BDD9-DC2C-432D-9CF7-F1AB81181702",
    quickspecs: "a50004298enw", slotGuide: "sd00002113en_us", slot: "93C43CA3-9E36-4D59-96DB-5EC883838414" },
  "ProLiant DL385": { key: "dl385", amd: true, guide: "sd00002188en_us", sku: "P53921-B21", backplane: "P55082-B21", cable: "P57846-B21", units: 2, ocp: 22,
    front: "95BCCB0D-CB47-49D4-AFC7-95919770F05B", rear: "6A01EC98-C71D-41FB-AEDC-28E76BEA0380",
    drives: "D76D017F-0445-4C65-8936-740DD1FF1177", status: "0595BDD9-DC2C-432D-9CF7-F1AB81181702",
    quickspecs: "a50004300enw", slotGuide: "sd00002188en_us", slot: "531AB34A-2411-4BD7-A0EE-CDE3739051D7" },
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

/** Resolve explicitly selected HPE rack-server configurations, independently of saved rack height. */
export function resolveHPEServerFaceplate(device) {
  const tower = resolveHPETowerFaceplate(device);
  if (tower) return tower;
  const dl500 = resolveHPEDL500Faceplate(device);
  if (dl500) return dl500;
  const entry = resolveHPEEntryServerFaceplate(device);
  if (entry) return entry;
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
  const configuration = definition.amd ? amdConfiguration(device, definition)
    : `${definition.units}U ${device.model} Gen11 8SFF NC CTO ${definition.sku}: eight SATA Basic Carriers, ${definition.backplane} x1 backplane with direct SATA motherboard connection, one CPU, P10097-B21 BCM57416 dual 10Gb BASE-T in physical slot 15/OCP2 with P51911-B21 enablement, and two P38995-B21 800W C14 supplies. No bezel, optional media/SID, serial, rear drives, PCIe cards or second OCP card; unused positions are covered.`;
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
      power: "https://www.hpe.com/us/en/collaterals/collateral.c04346217.html", configuration,
      ...(definition.amd ? amdEvidence(definition) : {}) },
    legacyLayouts: [{ inventoryRevision: 0, portIndexMap: { 1: 1, 2: 2, 5: 3 },
      portLabels: { 1: "NIC1", 2: "NIC2", 5: "iLO1" } }],
    catalogDiscrepancies: [configuration,
      "The generation-free catalog formerly supplied four 10Gb NICs and iLO. The selected two-port adapter retains old NIC1/2 and iLO identities, labels, VLANs and settings; unspecified NIC3/4 remain unmapped.",
      "Front iLO Service USB-A is an ancillary maintenance host for a supported Q7Y55A USB-Ethernet adapter or flash drive, not a serial console or direct Ethernet endpoint. USB peripherals and VGA are artwork; rear iLO RJ45 is connectable.",
      definition.amd ? `New ${device.model} instances use ${definition.units}U. Existing saved rack heights and positions are unchanged; a saved non-native height scales the selected physical drawing to its reserved space.`
        : "New DL360 instances use 1U and DL380 uses 2U. Existing saved rack heights and positions are unchanged; a saved non-native height scales the selected physical drawing to its reserved space.",
      "The BCM57416 face uses identified supplier photographs because the HPE Store listing currently shows a different adapter. The manufacturer guides and QuickSpecs establish chassis and option compatibility."],
    chassis: { x: 0, y: definition.units === 1 ? .10 : .11, width: 1, height: definition.units === 1 ? .80 : .72 },
    faces: definition.amd ? { front: definition.units === 1 ? frontDL325() : frontAMD2U(definition), rear: rearAMD(device, definition) }
      : definition.units === 1 ? { front: frontDL360(), rear: rearDL360(device) }
      : { front: frontDL380(), rear: rearDL380(device) },
  };
}

/** Disclose each AMD CTO selection without carrying over Intel OCP cabling or optional risers. */
function amdConfiguration(device, definition) {
  const storage = definition.cable ? `right front box 3 ${definition.backplane} and ${definition.cable} direct SATA cable`
    : `${definition.backplane} x1 U.3 backplane with direct SATA connection`;
  const risers = definition.key === "dl325" ? "standard primary riser and covered secondary position"
    : definition.key === "dl345" ? "standard one-slot primary and secondary risers, with no cards"
      : "standard one-slot primary riser and full secondary riser blank";
  return `${definition.units}U ${device.model} Gen11 8SFF CTO ${definition.sku}: eight SATA Basic Carriers, ${storage}, one CPU, P10097-B21 BCM57416 dual 10Gb BASE-T in physical slot ${definition.ocp} at default x8 bandwidth, and two P38995-B21 800W C14 supplies. Selected ${risers}. No bezel, optional media/SID, serial, rear drives, boot device, liquid cooling, PCIe cards or second OCP card; unused positions are covered.`;
}

/** Record the separate model guides that establish shared parts and default AMD slot availability. */
function amdEvidence(definition) {
  const page = (guide, id) => `${support}${guide}&page=GUID-${id}.html`;
  return { slotSelection: definition.ocp === 21 ? "The individual User Guide directs a single NIC to slot 21. P10097-B21 uses default x8 bandwidth; no x16 upgrade cable is selected."
    : "The DL385 User Guide recommends the first NIC in slot 22. Availability with one CPU at default x8 is inferred from the default OCP rules and QuickSpecs: optional 1P x16 upgrade P57882-B21 disables OCP2, and only specified faster adapters require upgrade cabling. No upgrade is selected.",
  ...(definition.units === 2 ? {
    rearBlanks: page(definition.guide, definition.key === "dl345" ? "ABFFB538-3E3A-4F69-ACE9-83666C92A9CC" : "49724719-5059-4335-9F23-DDE421ED4EDC"),
    sharedParts: "The separate DL345 and DL385 guides serve the same ED839857 rear-bay blank, DE6F055A status and FA7D105B drive-numbering drawings. Their front SID and default secondary-riser populations differ and are drawn separately.",
    riser: definition.key === "dl345" ? page("sd00002226en_us", "495EE344-6E26-4D37-99AA-7694C00D7AA6")
      : page(definition.guide, "61A9834F-F25E-48D1-9768-B16D24A756FD"),
  } : {}) };
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

/** Trace DL325's own paired drive columns, blank media region and USB/status positions. */
function frontDL325() {
  const components = [part("handle", .003, .09, .028, .81, "left-rack-ear"),
    part("handle", .971, .09, .024, .81, "right-rack-ear"),
    part("vent", .581, .075, .311, .41, "media-blank"),
    part("chassis", .276, .015, .046, .042, "serial-information-tab"),
    part("usb", .925, .09, .016, .34, "ilo-service"), part("usb", .925, .58, .016, .29, "usb-storage"),
    part("button", .950, .195, .016, .12, "status-power"), part("led", .954, .365, .009, .065, "status-health"),
    part("led", .954, .50, .009, .065, "status-nic"), part("button", .950, .635, .016, .12, "status-uid")];
  for (let column = 0; column < 3; column++) components.push(drive(column * 2 + 1, .062 + column * .169, .13, .154, .35));
  for (let column = 0; column < 5; column++) components.push(drive(column < 3 ? column * 2 + 2 : column + 4,
    .062 + column * .169, .565, .154, .35));
  return { components, ports: [] };
}

/** Trace the source-confirmed 2U right drive box while retaining DL385's separate optional SID cover. */
function frontAMD2U(definition) {
  const components = [part("handle", .005, .58, .030, .35, "left-rack-ear"),
    part("handle", .974, .59, .024, .34, "right-rack-ear"),
    part("chassis", .043, .12, .007, .29, "serial-information-tab"),
    part("vent", .063, .08, .264, .84, "drive-box1-blank"), part("vent", .347, .08, .261, .84, "drive-box2-blank"),
    part("usb", .978, .075, .015, .19, "ilo-service"), part("usb", .978, .315, .015, .18, "usb-storage"),
    part("button", .950, .11, .016, .065, "status-power"), part("led", .953, .22, .009, .04, "status-health"),
    part("led", .953, .295, .009, .04, "status-nic"), part("button", .950, .36, .016, .065, "status-uid")];
  if (definition.key === "dl385") components.push(part("vent", .914, .09, .014, .36, "sid-vent"),
    part("module-bay", .912, .53, .019, .39, "sid-blank"));
  else components.push(part("vent", .913, .09, .019, .83, "right-front-vent"));
  for (let index = 0; index < 8; index++) components.push(drive(index + 1, .619 + index * .035, .06, .032, .89, true));
  return { components, ports: [] };
}

/** Place the same identified BCM57416 metal face in the model's prescribed left or right OCP opening. */
function amdAdapter(device, definition, components, centerY, height, captionY) {
  const left = definition.ocp === 21;
  const offset = left ? .062 : .405;
  for (const [dx, width] of [[0, .019], [.073, .014], [.137, .020]]) {
    components.push(part("vent", offset + dx, centerY - height / 2, width, height, `ocp${definition.ocp}-adapter-vent`));
  }
  const ports = [socket(device, 1, offset + .048, centerY, .035, height, "P1", captionY),
    socket(device, 2, offset + .111, centerY, .035, height, "P2", captionY),
    socket(device, 3, .302, centerY, .033, height, "iLO", captionY, .307)];
  components.push(part("vent", left ? .405 : .062, centerY - height / 2, .157, height, `ocp${left ? 22 : 21}-blank`));
  return ports;
}

/** Trace AMD rear hardware with two DL325 covers and distinct DL345/DL385 default riser populations. */
function rearAMD(device, definition) {
  const small = definition.units === 1;
  const components = [part("handle", .008, small ? .18 : .78, .024, small ? .66 : .17, "left-rack-ear"),
    part("handle", .968, small ? .18 : .78, .024, small ? .66 : .17, "right-rack-ear"),
    part("usb", .242, small ? .615 : .79, .030, small ? .10 : .047, "usb-storage"),
    part("usb", .242, small ? .79 : .90, .030, small ? .10 : .047, "usb-storage"),
    { ...part("led", .229, small ? .81 : .885, .006, small ? .05 : .026, "rear-uid"), color: "#238be3", active: false },
    part("module-bay", .333, small ? .64 : .815, .062, small ? .22 : .105, "serial-blank"),
    part("vga", .574, small ? .65 : .83, .063, small ? .22 : .11, "vga"),
    part("psu", .651, small ? .035 : .515, .143, small ? .91 : .425, "ps2", "hpe-flexslot-800"),
    part("psu", .802, small ? .035 : .515, .143, small ? .91 : .425, "ps1", "hpe-flexslot-800")];
  if (small) {
    components.push(part("module-bay", .085, .04, .232, .49, "pcie-cover"),
      part("module-bay", .394, .04, .232, .49, "pcie-cover"),
      part("vent", .052, .065, .027, .43, "left-riser-vent"),
      part("vent", .336, .065, .044, .43, "center-riser-vent"),
      part("vent", .632, .065, .013, .43, "right-riser-vent"));
  } else {
    for (const [x, installed] of [[.082, true], [.394, definition.key === "dl345"]]) {
      for (let row = 0; row < 3; row++) {
        if (installed && row === 2) components.push(part("module-bay", x, .523, .231, .19, "pcie-cover"));
        else components.push(part("vent", x, .06 + row * .231, .231, .155,
          installed ? "unused-riser-position" : "secondary-riser-blank"));
      }
    }
    components.push(part("vent", .652, .07, .025, .35, "rear-bay-edge-vent"),
      part("vent", .689, .06, .167, .37, "rear-drive-blank"),
      part("vent", .861, .07, .018, .35, "rear-bay-center-vent"),
      part("vent", .892, .06, .052, .37, "rear-boot-blank"));
  }
  const ports = amdAdapter(device, definition, components, small ? .754 : .865, small ? .232 : .113, small ? .94 : .969);
  return { components, ports };
}
