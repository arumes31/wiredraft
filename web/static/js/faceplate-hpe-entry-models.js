import { canonicalFaceplateDevice } from "./faceplate-profile.js";

const support = "https://support.hpe.com/hpesc/public/docDisplay?docId=";
const dl180Manual = "https://www.itcreations.com/user-manuals/dl180-gen10/hpe-proliant-dl180-gen10-server-user-guide.pdf?nr=";
const definitions = {
  "ProLiant DL20": { key: "dl20", generation: "Gen11", units: 1, sku: "P65392-B21", drives: 4, guide: "sd00003425en_us", quickspecs: "a50007009enw",
    front: "6083DEC1-AE75-4A78-9AB0-114DAEE09780", rear: "7B9072A6-5022-41F5-BFEC-2FFB3E4996F7",
    numbering: "260CFF64-C7E5-4AFF-9896-1472BB2062EC", status: "5D25F0FF-9CA7-4EB9-94C6-0C7F4E7BAFF8" },
  "ProLiant DL160": { key: "dl160", generation: "Gen10", units: 1, sku: "878973-B21", drives: 8, guide: "a00066666en_us", quickspecs: "a00021860enw",
    front: "249338C2-8F8A-429C-96BC-E0CD34100A44", rear: "FA034078-91B3-4D21-B4C6-564F4175EB54",
    numbering: "387D3BCA-1EFA-4B7C-82C6-76AD606BED87", status: "C72F9F5C-322B-4559-9457-482F79852F37" },
  "ProLiant DL180": { key: "dl180", generation: "Gen10", units: 2, sku: "879517-B21", drives: 8, quickspecs: "a00021862enw" },
};
const cache = new Map();

/** Resolve only the disclosed entry-server configurations and fit their physical bodies within saved rack allocations. */
export function resolveHPEEntryServerFaceplate(device) {
  const definition = definitions[device?.model];
  if (!definition || device.faceplate?.vendor !== "HPE" || device.category !== "Server") return null;
  const canonical = canonicalFaceplateDevice(device);
  if (!canonical) return null;
  if (!cache.has(canonical.catalog)) cache.set(canonical.catalog, { profile: buildProfile(canonical.device, definition), allocations: new Map() });
  const cached = cache.get(canonical.catalog);
  const units = Math.max(1, Number(device.faceplate.unitsU) || 1);
  if (definition.units !== 1 || units === 1) return cached.profile;
  // Canvas and rack bounds reserve 100 world pixels per saved U. Scale only the
  // normalized body back to its source 1U; the saved device and bounds stay intact.
  if (!cached.allocations.has(units)) {
    const { profile } = cached;
    cached.allocations.set(units, { ...profile,
      chassis: { ...profile.chassis, y: profile.chassis.y / units, height: profile.chassis.height / units } });
  }
  return cached.allocations.get(units);
}

/** Record the exact CTO options and a revision-specific migration rather than guessing a saved device's installed cards. */
function buildProfile(device, definition) {
  const dl20 = definition.key === "dl20";
  const large = definition.key === "dl180";
  const page = (id) => `${support}${definition.guide}&page=GUID-${id}.html`;
  const configuration = `${device.model} ${definition.generation} ${definition.sku}, ${definition.units}U ${definition.drives}SFF CTO: one CPU, ` +
    (dl20 ? "four SATA Basic Carriers in Box2 with direct SlimSAS x4 port2 connection, four embedded BCM5719 1Gb NICs, and P65407-B21 dedicated iLO/serial kit with its DB9 serial cable installed. Standard PCIe x16 and OCP15 positions covered. "
      : `eight P18424-B21 SATA SmartCarrier SSDs ${large ? "in right Box3 " : ""}connected to the motherboard/S100i, two embedded 1Gb NICs and dedicated iLO. Selected ${large ? "878484-B21 primary x8/x8/x8 riser and full secondary-riser blank" : "standard primary x16 FH/x8 LP riser and covered secondary position"}; 866442-B21 redundant power enablement. `) +
    "Two 865438-B21 800W Titanium C14 FlexSlot supplies, requiring 200–240V AC high-line input. No bezel, optional media/extra drives, boot device, M.2, additional NICs or PCIe cards; all unused positions covered.";
  const oldMap = dl20 ? { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 } : { 1: 1, 2: 2, 5: 3 };
  const portLabels = dl20 ? { 1: "NIC1", 2: "NIC2", 3: "NIC3", 4: "NIC4", 5: "iLO1" } : { 1: "NIC1", 2: "NIC2", 5: "iLO1" };
  return { id: `hpe-${definition.key}-${definition.generation.toLowerCase()}`, family: `${device.model} ${definition.generation}`,
    fidelity: "model", defaultFace: "rear", inventoryRevision: 1, inventoryComplete: true,
    sku: `${device.model} ${definition.generation} · ${definition.sku} · ${definition.drives}SFF / embedded 1Gb`,
    source: large ? dl180Manual : page(definition.front),
    sourcePage: large ? "HPE User Guide 874513-009, December 2020 edition9: pages8–14,24–26,86,117; supplier-hosted original manufacturer PDF"
      : "Individual HPE User Guide front/rear, drive-numbering, indicator and option-installation diagrams",
    note: configuration, limitations: [configuration],
    evidence: { models: [device.model], sku: definition.sku, scope: "model", reviewed: "2026-09-10", configuration,
      front: large ? `${dl180Manual}#page=8` : page(definition.front), rear: large ? `${dl180Manual}#page=13` : page(definition.rear),
      drives: large ? `${dl180Manual}#page=26` : page(definition.numbering), status: large ? `${dl180Manual}#page=10` : page(definition.status),
      supplemental: `https://www.hpe.com/us/en/collaterals/collateral.${definition.quickspecs}.html`,
      power: "https://www.hpe.com/us/en/collaterals/collateral.c04346217.html",
      powerPhoto: "https://www.servershop24.de/en/hpe-800w-power-supply-gen10-gen11/a-133126/",
      powerLabel: "https://cdn02.plentyone.com/269f2q1olluv/item/images/133126/full/133126--5-von-1-.jpg",
      powerProvenance: "First-hand seller photographs of the selected used supply; the pictured HPE label identifies 865436-101, spare866793-001 and option865438-B21. Manufacturer QuickSpecs establish the compatible part and high-line input rating. The projecting black handle is flattened into the panel view; the silver lever and pink latch retain their visible occlusion of the C14 inlet rather than inventing exposed contacts.",
      ...(large ? { provenance: "HPE-authored User Guide874513-009 hosted by IT Creations. The current HPE Maintenance Guide website returns its abstract for linked subtopics; manufacturer PDF pages and current QuickSpecs establish the selection.",
        rearBlank: `${dl180Manual}#page=86`, storage: `${dl180Manual}#page=117`,
        riser: `${support}a00077198en_us&page=GUID-3DE77529-5B0A-465C-96D3-A4542614E6AA.html` } : {}),
      ...(dl20 ? { management: page("27E071F5-2A0E-4930-A6E5-E7818740DE0C"),
        bootBlank: "https://assets.ext.hpe.com/is/image/hpedam/a50007009enw_block1img2?%24crimg%24=",
        photoScope: "QuickSpecs photograph establishes the empty boot-device grille only. Its older SmartCarrier depiction is superseded by the current individual User Guide's BasicCarrier drawing." } : {}),
    },
    legacyLayouts: [{ inventoryRevision: 0, portIndexMap: oldMap, portLabels }],
    catalogDiscrepancies: [configuration,
      dl20 ? "The former generation-free catalog supplied four 10Gb NICs and iLO. Their identities remain attached to the selected four physical 1Gb NICs and dedicated iLO; existing speeds and settings stay unchanged. The newly selected serial connector is added only to new revision1 instances."
        : "The former generation-free catalog supplied four 10Gb NICs and iLO. Old NIC1/2 and iLO retain their identities on the embedded 1Gb network and management sockets. Unspecified old NIC3/4 remain unmapped; saved speeds and settings remain unchanged.",
      "Front iLO Service USB-A is an ancillary maintenance host for a supported USB-Ethernet adapter or flash drive, not a serial console or direct Ethernet endpoint. Host USB and video connectors are artwork; rear iLO is connectable.",
      `New instances use ${definition.units}U. Existing saved rack height, position, names, links, VLANs and other settings remain unchanged.` +
        (definition.units === 1 ? " The selected 1U physical body retains its proportions inside a larger saved rack allocation." : ""),
      ...(dl20 ? ["The selected P65407-B21 module includes dedicated iLO and the installed serial cable. NIC1 is shared with iLO by default; dedicated iLO needs firmware selection. Serial6 represents the physical DB9 port, not an RJ45 socket."]
        : ["Optional Media Module NIC3/4, FlexibleLOM and serial are absent and covered in this selected configuration."]),
    ],
    chassis: { x: 0, y: definition.units === 1 ? .1 : .11, width: 1, height: definition.units === 1 ? .8 : .72 },
    faces: dl20 ? { front: frontDL20(), rear: rearDL20(device) }
      : large ? { front: frontDL180(), rear: rearDL180(device) } : { front: frontDL160(), rear: rearDL160(device) },
  };
}

/** Position ancillary hardware by the measured top-left bounds of its own chassis drawing. */
function part(kind, x, y, width, height, role, variant) {
  return { kind, x, y, width, height, ...(role ? { role } : {}), ...(variant ? { variant } : {}) };
}

/** Bind an explicitly numbered canonical endpoint while accepting its known historical 10Gb copper type. */
function socket(device, index, x, y, width, height, physicalLabel, captionY, captionX = x) {
  const port = device.ports.find((entry) => entry.portIndex === index);
  return { portIndex: index, type: port.type, label: port.label, x, y, width, height, physicalLabel,
    ...(port.type === "RJ45_1G" ? { compatibleTypes: ["RJ45_10G"], connectorKind: "rj45" } : { connectorKind: "db9" }),
    descriptionAnchor: { x: captionX, y: captionY, fontSize: 5.5, boxHeight: 7 } };
}

/** Distinguish numbered SmartCarriers and BasicCarriers from connectable port inventory. */
function drive(number, x, y, width, height, basic = false, vertical = false) {
  return { ...part("drive-carrier", x, y, width, height, "sata-drive", basic ? "hpe-basic" : "hpe-smart"),
    driveNumber: number, ...(vertical ? { orientation: "vertical" } : {}) };
}

/** Draw the selected Titanium supplies separately from the guides' alternative ATX configurations. */
function supplies(x, y, width, height, gap) {
  return [2, 1].map((number, index) => ({ ...part("psu", x + index * (width + gap), y, width, height, `power-supply-${number}`, "hpe-flexslot-800-titanium"),
    watts: 800, sku: "865438-B21", inputVoltage: "200–240V AC" }));
}

/** Trace DL20's lower1/2/4 and upper3 carriers with its distinct central service strip and boot blank. */
function frontDL20() {
  const components = [part("handle", .008, .1, .031, .8, "left-rack-ear"), part("handle", .969, .1, .026, .8, "right-rack-ear"),
    part("vent", .061, .10, .332, .33, "media-blank"), part("vent", .657, .09, .041, .81, "boot-device-blank"),
    part("vent", .712, .11, .235, .78, "front-airflow"), part("usb", .598, .10, .015, .32, "ilo-service"),
    part("usb", .598, .56, .015, .32, "usb-storage"),
    part("button", .625, .13, .015, .14, "status-power"), part("led", .628, .34, .009, .09, "status-health"),
    part("led", .628, .50, .009, .09, "status-nic"), { ...part("button", .625, .70, .015, .14, "status-uid"), active: false },
    part("text", .76, .90, .18, .08, "model-mark")];
  components.at(-1).text = "ProLiant DL20 Gen11";
  components.at(-1).fontSize = 5.5;
  components.push(drive(3, .404, .095, .162, .34, true));
  for (const [index, number] of [1, 2, 4].entries()) components.push(drive(number, .061 + index * .1715, .55, .162, .34, true));
  return { components, ports: [] };
}

/** Keep DL20's stacked NIC3/4, serial-over-VGA, DisplayPort and separate dedicated iLO positions. */
function rearDL20(device) {
  const components = [part("handle", .007, .14, .031, .75, "left-rack-ear"), part("handle", .969, .14, .026, .75, "right-rack-ear"),
    part("module-bay", .410, .08, .213, .39, "pcie-cover"), part("module-bay", .410, .58, .224, .32, "ocp15-blank"),
    part("vga", .224, .68, .061, .23, "vga"), part("displayport", .295, .71, .035, .16, "displayport"),
    part("vent", .295, .16, .044, .32, "rear-airflow"), part("vent", .114, .19, .017, .65, "rear-airflow"),
    ...supplies(.646, .10, .150, .80, .012)];
  for (const x of [.070, .133]) for (const y of [.52, .72]) components.push(part("usb", x, y, .033, .13, "usb-storage"));
  return { components, ports: [socket(device, 1, .0865, .265, .036, .23, "1", .08),
    socket(device, 2, .1495, .265, .036, .23, "2", .08),
    socket(device, 3, .195, .36, .033, .23, "3", .10),
    socket(device, 4, .195, .69, .033, .23, "4", .93),
    socket(device, 5, .361, .60, .034, .23, "iLO", .90),
    socket(device, 6, .255, .31, .061, .23, "SERIAL", .55)] };
}

/** Trace DL160's three paired carrier columns and lower7/8 bays, with upper media grille and reversed USB roles. */
function frontDL160() {
  const components = [part("handle", .010, .1, .031, .8, "left-rack-ear"), part("handle", .969, .1, .025, .8, "right-rack-ear"),
    part("vent", .564, .10, .328, .35, "media-blank"), part("usb", .929, .10, .015, .30, "usb-storage"),
    part("usb", .929, .55, .015, .32, "ilo-service"),
    part("button", .903, .13, .015, .14, "status-power"), part("led", .906, .34, .009, .08, "status-health"),
    part("led", .906, .53, .009, .08, "status-nic"), { ...part("button", .903, .71, .015, .14, "status-uid"), active: false }];
  for (let column = 0; column < 3; column++) components.push(drive(column * 2 + 1, .061 + column * .169, .105, .158, .33));
  for (let column = 0; column < 5; column++) components.push(drive(column < 3 ? column * 2 + 2 : column + 4, .061 + column * .169, .555, .158, .33));
  return { components, ports: [] };
}

/** Trace DL160's lower management/video/network row and covered optional MediaModule and serial positions. */
function rearDL160(device) {
  const components = [part("handle", .008, .15, .031, .75, "left-rack-ear"), part("handle", .970, .15, .023, .75, "right-rack-ear"),
    part("module-bay", .081, .095, .221, .31, "pcie-cover"), part("module-bay", .319, .095, .117, .31, "pcie-cover"),
    part("module-bay", .480, .095, .140, .31, "secondary-position-blank"),
    part("module-bay", .082, .61, .089, .24, "media-module-blank"),
    part("usb", .185, .585, .025, .105, "usb-storage"), part("usb", .185, .75, .025, .105, "usb-storage"),
    part("vga", .265, .62, .066, .22, "vga"), part("module-bay", .515, .65, .045, .18, "serial-blank"),
    part("vent", .421, .62, .021, .22, "rear-airflow"), part("vent", .569, .57, .048, .30, "rear-airflow"),
    ...supplies(.646, .10, .145, .80, .011)];
  return { components, ports: [socket(device, 1, .354, .74, .032, .23, "1", .94),
    socket(device, 2, .389, .74, .032, .23, "2", .50), socket(device, 3, .244, .74, .035, .23, "iLO", .50)] };
}

/** Trace DL180's right eight vertical SmartCarriers, two full bay blanks and separate ear controls. */
function frontDL180() {
  const components = [part("handle", .006, .52, .032, .41, "left-rack-ear"), part("handle", .969, .57, .026, .36, "right-rack-ear"),
    part("vent", .067, .095, .245, .79, "box1-blank"), part("vent", .344, .095, .245, .79, "box2-blank"),
    part("vent", .912, .29, .023, .55, "front-airflow"), part("usb", .922, .10, .009, .14, "ilo-service"),
    part("usb", .969, .40, .025, .075, "usb-storage"),
    part("led", .947, .115, .006, .045, "status-health"), part("led", .947, .21, .006, .045, "status-nic"),
    part("button", .969, .09, .023, .12, "status-power"), { ...part("button", .973, .265, .017, .06, "status-uid"), active: false }];
  for (let index = 0; index < 8; index++) components.push(drive(index + 1, .621 + index * .0355, .09, .031, .78, false, true));
  return { components, ports: [] };
}

/** Trace DL180's three primary covers and one full secondary blank above two supplies, with no optional NIC or serial card. */
function rearDL180(device) {
  const components = [part("handle", .008, .55, .031, .38, "left-rack-ear"), part("handle", .970, .55, .022, .38, "right-rack-ear"),
    part("vent", .478, .05, .467, .43, "secondary-riser-blank"), part("vent", .478, .59, .152, .28, "rear-airflow"),
    part("vent", .350, .10, .062, .13, "rear-airflow"), part("module-bay", .350, .32, .069, .15, "serial-blank"),
    part("vent", .335, .53, .105, .20, "rear-airflow"),
    part("module-bay", .085, .825, .085, .12, "media-module-blank"),
    part("usb", .187, .785, .025, .055, "usb-storage"), part("usb", .187, .88, .025, .055, "usb-storage"),
    part("vga", .267, .81, .064, .13, "vga"), ...supplies(.642, .55, .145, .40, .011)];
  for (const y of [.055, .275, .495]) components.push(part("module-bay", .08, y, .225, .17, "pcie-cover"));
  return { components, ports: [socket(device, 1, .361, .87, .028, .12, "1", .97),
    socket(device, 2, .395, .87, .028, .12, "2", .76), socket(device, 3, .242, .87, .030, .12, "iLO", .75)] };
}
