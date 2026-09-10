import { canonicalFaceplateDevice } from "./faceplate-profile.js";

const manualRoot = "https://www.dell.com/support/manuals/en-us/";
const definitions = {
  "PowerEdge R350": { key: "r350", manual: "r350_ism_pub", front: "b7153026-e83e-41a4-a630-b3d09b07d1d1", rear: "ea07e7b4-7645-4893-8630-fff8af537d7e",
    figures: "Front Figure 2 (four 3.5-inch drives); rear Figure 1",
    specification: "https://i.dell.com/sites/csdocuments/Product_Docs/en/Dell-EMC-PowerEdge-R350-Spec-sheet.pdf",
    configuration: "1U R350: four 3.5-inch drive carriers, slim optical drive and two-carrier BOSS-S2 installed, two 600W AC supplies, no bezel, and unpopulated PCIe slots." },
  "PowerEdge R450": { key: "r450", manual: "per450_ism_pub", front: "17342393-f0a2-4618-9166-3e9a572f3437", rear: "719cf98c-47ac-46e7-a4a1-1982e0e4c1c9",
    figures: "Front Figure 2 (eight 2.5-inch drives); rear Figure 1 with optional OCP card replaced by its documented blank",
    specification: "https://i.dell.com/sites/csdocuments/product_docs/en/dell-emc-poweredge-r450-technical-guide.pdf",
    configuration: "1U R450: eight 2.5-inch drive carriers in the three-upper/five-lower arrangement, two 600W AC supplies, no bezel, OCP or BOSS card, and unpopulated PCIe slots; optional serial omitted." },
  "PowerEdge R550": { key: "r550", manual: "per550_ism_pub", front: "3e339a3b-78a1-408f-ba1f-315280fb2bde", rear: "2cb6e3b9-9ff3-4d68-9160-5cbc9d9e3fee",
    figures: "Front Figure 3 (eight 3.5-inch drives); rear Figure 1; technical guide Figure 4 identifies OCP and riser blanks",
    specification: "https://i.dell.com/sites/csdocuments/product_docs/en/dell-emc-poweredge-r550-technical-guide.pdf",
    configuration: "2U R550: eight 3.5-inch drive carriers, optical-drive blank, two 600W AC supplies and two-carrier BOSS-S2 installed, no bezel, OCP NIC or PCIe cards; optional serial omitted." },
  "PowerEdge R650": { key: "r650",
    frontSource: "https://i.dell.com/sites/csdocuments/product_docs/en/poweredge-r650-technical-guide.pdf#page=10",
    rearSource: "https://i.dell.com/sites/csdocuments/product_docs/en/poweredge-r650-technical-guide.pdf#page=11",
    figures: "Technical guide front Figure 2, page 10; rear Figure 5, page 11; networking and 60mm PSU specifications pages 7–8 and 48",
    specification: "https://i.dell.com/sites/csdocuments/product_docs/en/poweredge-r650-technical-guide.pdf",
    configuration: "1U R650: eight 2.5-inch SAS/SATA carriers in the three-upper/five-lower arrangement, three low-profile PCIe covers, BOSS-S2 installed, two 800W AC supplies, standard air-cooled I/O, no bezel, OCP card, rear drives or optional serial." },
  "PowerEdge R6525": { key: "r6525", manual: "r6525_ism_pub", front: "32239a70-256e-467e-b129-2dcefe11f7b0",
    rearSource: "https://www.dell.com/support/manuals/en-us/oth-r6525/r6525_ism_pub/rear-view-of-the-system?guid=guid-a777823c-4da3-40ab-861f-dc06190475a1",
    figures: "Front Figure 2 and corresponding eight-drive rear Figure 2; rear table distinguishes LOM1/2 from the optional four-port OCP card",
    specification: "https://i.dell.com/sites/csdocuments/product_docs/en/poweredge-r6525-spec-sheet.pdf",
    configuration: "1U R6525: eight 2.5-inch carriers in the three-upper/five-lower arrangement, three PCIe covers, BOSS-S2 installed and two pictured 1400W AC supplies; no OCP card, rear drives, bezel or optional serial." },
  "PowerEdge R750": { key: "r750",
    frontSource: "https://i.dell.com/sites/csdocuments/Product_Docs/en/au/poweredge-r750-technical-guide.pdf#page=10",
    rearSource: "https://i.dell.com/sites/csdocuments/Product_Docs/en/au/poweredge-r750-technical-guide.pdf#page=10",
    figures: "Technical guide front Figures 6/7 and eight-PCIe rear Figure 11, page 10; 86mm 2400W supply in Table 18, page 44",
    specification: "https://i.dell.com/sites/csdocuments/Product_Docs/en/au/poweredge-r750-technical-guide.pdf",
    configuration: "2U R750: eight vertical 2.5-inch front carriers, eight covered PCIe positions, BOSS-S2 installed, two 86mm 2400W AC supplies with C20 inlets, dual 1GbE LOM, standard air cooling; no rear drives, OCP card, bezel or optional serial." },
  "PowerEdge R7525": { key: "r7525",
    frontSource: "https://i.dell.com/sites/csdocuments/Product_Docs/en/dell-emc-poweredge-r7525-technical-guide.pdf#page=10",
    rearSource: "https://i.dell.com/sites/csdocuments/Product_Docs/en/dell-emc-poweredge-r7525-technical-guide.pdf#page=11",
    figures: "Technical guide front Figure 3, page 10; standard eight-PCIe rear above Figure 6, page 11; pictured supplies read 2400W; LOM specifications page 20",
    specification: "https://i.dell.com/sites/csdocuments/Product_Docs/en/dell-emc-poweredge-r7525-technical-guide.pdf",
    configuration: "2U R7525: eight vertical 2.5-inch front carriers, eight covered PCIe positions, BOSS-S2 installed, two pictured 2400W AC supplies with C20 inlets, dual 1GbE LOM and standard air cooling; no rear drives, OCP card, bezel or optional serial." },
  "PowerEdge R6615": { key: "r6615", manual: "r6615_ism", front: "c4991c8c-8d12-4c72-8f0a-83e10648b8ec",
    rearSource: "https://www.dell.com/support/manuals/en-uk/poweredge-r6615/r6615_ism/rear-view-of-the-system?guid=guid-91b24241-401b-4ee3-952c-0787a3065e2d&lang=en-us",
    figures: "Front Figure 2, with separated four-drive banks; standard rear Figure 1 and its table, rather than the inconsistent autogenerated summary",
    specification: "https://www.dell.com/support/manuals/en-us/poweredge-r6615/r6615_ism/nic-port-specifications?guid=guid-b60e54dd-0519-4f84-ab7b-31c5d1d3c929&lang=en-us",
    optionalLOM: true,
    configuration: "1U R6615: eight 2.5-inch NVMe carriers in two separated four-drive banks, two covered PCIe positions, BOSS-N1 installed, optional two-port 1GbE LOM installed and two 800W AC supplies; no OCP card, bezel, rear drives, liquid cooling or optional serial." },
  "PowerEdge R7615": { key: "r7615",
    frontSource: "https://www.delltechnologies.com/asset/en-gb/products/servers/technical-support/poweredge-r7615-technical-guide.pdf#page=10",
    rearSource: "https://www.delltechnologies.com/asset/en-gb/products/servers/technical-support/poweredge-r7615-technical-guide.pdf#page=12",
    figures: "Technical guide front Figure 3, page 10; standard rear Figure 9, page 12; optional LOM page 67 and 86mm 2400W/C19-cord Table 29",
    specification: "https://www.delltechnologies.com/asset/en-gb/products/servers/technical-support/poweredge-r7615-technical-guide.pdf",
    optionalLOM: true,
    configuration: "2U R7615: eight vertical 2.5-inch front carriers, eight covered PCIe positions, BOSS-N1 installed, optional two-port 1GbE LOM installed and two 86mm 2400W AC supplies with C20 inlets; no OCP card, rear drives, bezel, liquid cooling or optional serial." },
};
const cache = new Map();

/** Resolve exact PowerEdge configurations from immutable canonical inventory, independently of saved rack allocation. */
export function resolveDellServerFaceplate(device) {
  const definition = definitions[device?.model];
  if (!definition || device.faceplate?.vendor !== "Dell" || device.category !== "Server") return null;
  const canonical = canonicalFaceplateDevice(device);
  if (!canonical) return null;
  if (!cache.has(canonical.catalog)) cache.set(canonical.catalog, serverProfile(canonical.device, definition));
  return cache.get(canonical.catalog);
}

/** Record the selected model, both physical references and a revision map that deliberately omits unsupported old NICs. */
function serverProfile(device, definition) {
  const base = `${manualRoot}poweredge-${definition.key}/${definition.manual}/`;
  const front = definition.frontSource || `${base}front-view-of-the-system?guid=guid-${definition.front}&lang=en-us`;
  const rear = definition.rearSource || `${base}rear-view-of-the-system?guid=guid-${definition.rear}&lang=en-us`;
  const builders = { r350: [frontR350, rearR350], r450: [frontR450, rearR450], r550: [frontR550, rearR550],
    r650: [frontR650, rearR650], r6525: [frontR6525, rearR6525], r750: [frontR750, rearR750],
    r7525: [frontR7525, rearR7525], r6615: [frontR6615, rearR6615], r7615: [frontR7615, rearR7615] };
  const [frontBuilder, rearBuilder] = builders[definition.key];
  return { id: `dell-${definition.key}`, family: device.model, fidelity: "model", defaultFace: "rear",
    source: front, sourcePage: definition.figures, inventoryRevision: 1, inventoryComplete: true,
    note: definition.configuration, limitations: [definition.configuration],
    evidence: { models: [device.model], scope: "model", reviewed: "2026-09-10", front, rear,
      supplemental: definition.specification, configuration: definition.configuration },
    legacyLayouts: [{ inventoryRevision: 0, portIndexMap: { 1: 1, 2: 2, 5: 3 },
      portLabels: { 1: "NIC1", 2: "NIC2", 5: "iDRAC1" } }],
    catalogDiscrepancies: [definition.configuration,
      `${definition.optionalLOM ? "The selected optional LOM card has" : "LOM networking is"} two 1GbE sockets. The older four-10GbE family inventory retains NIC1/2 and iDRAC identities and settings; NIC3/4 remain unmapped because no installed add-in card was specified.`,
      "New inventory adds front iDRAC Direct micro-USB and the R350's fixed DB9 serial socket. USB storage and VGA are hardware artwork rather than network endpoints.",
      "New R350/R450/R650/R6525/R6615 instances occupy 1U; existing saved rack heights and positions remain unchanged. A non-native saved height scales the physical drawing to its reserved space."],
    chassis: { x: 0, y: .05, width: 1, height: .9 },
    faces: { front: frontBuilder(device), rear: rearBuilder(device) },
  };
}

/** Place a measured component using normalized top-left chassis coordinates. */
function part(kind, x, y, width, height, label, variant) {
  return { kind, x, y, width, height, ...(label ? { label } : {}), ...(variant ? { variant } : {}) };
}

/** Bind a measured fixed connector by canonical index, retaining only a known legacy type mismatch. */
function socket(device, index, x, y, width, height, physicalLabel, connectorKind) {
  const port = device.ports.find((candidate) => candidate.portIndex === index);
  if (!port) throw new Error(`${device.model}: fixed connector ${index} missing from canonical inventory`);
  return { portIndex: index, label: port.label, type: port.type, x, y, width, height, physicalLabel,
    ...(connectorKind ? { connectorKind } : {}), ...(index <= 2 ? { compatibleTypes: ["RJ45_10G"] } : {}) };
}

/** Trace the R350's four wide front carriers, optical drive, left status strip and right management column. */
function frontR350(device) {
  const components = [part("module-bay", .096, .05, .277, .23, undefined, "populated"),
    part("vent", .38, .045, .558, .22), part("button", .952, .07, .017, .15),
    part("usb", .954, .28, .012, .32), { ...part("led", .030, .10, .021, .79, undefined, "bar"), color: "#168fd3" }];
  for (let index = 0; index < 4; index++) components.push(part("drive-carrier", .060 + index * .219, .32, .214, .62));
  for (const y of [.20, .35, .50, .65]) components.push(part("led", .051, y, .005, .045));
  return { components, ports: [{ ...socket(device, 5, .961, .785, .008, .14, "iDRAC DIRECT"),
    descriptionAnchor: { x: .961, y: .925 } }] };
}

/** Trace the R350's fixed serial/VGA and staggered LAN/service sockets before its empty expansion slots and dual supplies. */
function rearR350(device) {
  const components = [part("vga", .020, .61, .069, .23),
    part("usb", .143, .72, .028, .09), part("usb", .198, .72, .028, .09),
    { ...part("service-jack", .245, .675, .011, .10), role: "cma-led" },
    { ...part("button", .265, .665, .013, .12), role: "system-identification" },
    part("module-bay", .315, .075, .149, .32), part("module-bay", .478, .075, .153, .32),
    part("vent", .298, .635, .339, .25), part("vent", .095, .085, .139, .10),
    part("drive-carrier", .644, .08, .022, .78, undefined, "boss"),
    part("drive-carrier", .673, .08, .022, .78, undefined, "boss"),
    part("psu", .708, .035, .130, .93, "600W", "ac-inlet-right"),
    part("psu", .851, .035, .141, .93, "600W", "ac-inlet-right")];
  return { components, ports: [socket(device, 1, .160, .47, .035, .20, "1"),
    socket(device, 2, .215, .47, .035, .20, "2"),
    { ...socket(device, 3, .115, .715, .035, .20, "iDRAC"), descriptionAnchor: { x: .115, y: .91 } },
    { ...socket(device, 4, .053, .255, .069, .23, "SERIAL", "db9"), descriptionAnchor: { x: .053, y: .49 } }] };
}

/** Trace the R450's uneven eight-drive front and separate VGA and management columns. */
function frontR450(device) {
  const components = [part("vent", .574, .07, .326, .41),
    part("vga", .918, .30, .019, .39), part("button", .950, .04, .016, .15),
    part("usb", .952, .29, .014, .31), { ...part("led", .033, .16, .013, .66, undefined, "bar"), color: "#168fd3" }];
  for (let column = 0; column < 5; column++) {
    const x = .068 + column * .171;
    if (column < 3) components.push(part("drive-carrier", x, .15, .165, .32, String(column * 2)));
    components.push(part("drive-carrier", x, .59, .165, .32, String(column < 3 ? column * 2 + 1 : column + 3)));
  }
  for (let index = 0; index < 5; index++) components.push(part("led", .030, .16 + index * .13, .004, .045));
  return { components, ports: [{ ...socket(device, 4, .962, .78, .008, .14, "iDRAC DIRECT"),
    descriptionAnchor: { x: .962, y: .925 } }] };
}

/** Trace the R450 rear with a deliberately empty OCP position and its fixed motherboard I/O. */
function rearR450(device) {
  const components = [part("module-bay", .028, .07, .160, .38),
    part("vent", .207, .07, .080, .38),
    part("module-bay", .361, .07, .151, .38), part("module-bay", .529, .07, .157, .38),
    part("module-bay", .320, .545, .185, .37),
    part("usb", .249, .60, .032, .095), part("usb", .249, .83, .032, .095),
    part("vga", .570, .64, .071, .22), part("button", .666, .72, .010, .09),
    part("psu", .708, .035, .139, .93, "600W", "ac-inlet-right"),
    part("psu", .861, .035, .133, .93, "600W", "ac-inlet-right")];
  const ports = [[1, .091, "1"], [2, .129, "2"], [3, .177, "iDRAC"]].map(([index, x, label]) => ({
    ...socket(device, index, x, .745, .034, .20, label), descriptionAnchor: { x, y: .555 },
  }));
  return { components, ports };
}

/** Trace the R550's two rows of large carriers beneath the optical blank and full-width ventilation band. */
function frontR550(device) {
  const components = [part("vent", .073, .027, .871, .27), part("module-bay", .073, .105, .272, .13),
    part("vga", .976, .165, .018, .16), part("usb", .953, .165, .014, .16),
    part("button", .953, .035, .017, .085), { ...part("led", .038, .075, .014, .24, undefined, "bar"), color: "#168fd3" }];
  for (let column = 0; column < 4; column++) for (let row = 0; row < 2; row++) {
    components.push(part("drive-carrier", .060 + column * .223, .335 + row * .318, .216, .30));
  }
  for (let index = 0; index < 5; index++) components.push(part("led", .030, .065 + index * .05, .004, .020));
  return { components, ports: [{ ...socket(device, 4, .962, .815, .008, .09, "iDRAC DIRECT"),
    descriptionAnchor: { x: .962, y: .93 } }] };
}

/** Trace the R550's vertical expansion covers, central blank and low rear connector row. */
function rearR550(device) {
  const components = [part("vent", .057, .10, .152, .65), part("vent", .561, .12, .072, .61),
    part("module-bay", .305, .065, .196, .63), part("module-bay", .318, .845, .190, .11),
    part("usb", .254, .855, .031, .043), part("usb", .254, .928, .031, .043),
    part("vga", .572, .862, .069, .08), part("button", .605, .250, .017, .060),
    part("drive-carrier", .716, .09, .025, .43, undefined, "boss"),
    part("drive-carrier", .747, .09, .025, .43, undefined, "boss"),
    part("psu", .706, .58, .133, .385, "600W", "ac-inlet-right"),
    part("psu", .851, .58, .139, .385, "600W", "ac-inlet-right")];
  for (const x of [.025, .219, .525, .655]) components.push(part("module-bay", x, .11, .030, .73));
  return { components, ports: [[1, .089, "1"], [2, .129, "2"], [3, .177, "iDRAC"]].map(([index, x, label]) => ({
    ...socket(device, index, x, .905, .034, .072, label), descriptionAnchor: { x, y: .81 },
  })) };
}

/** Trace the R650's SAS/SATA eight-drive face, keeping the upper-right ventilation where no drives exist. */
function frontR650(device) {
  const components = [part("vent", .579, .07, .324, .39), part("vga", .920, .27, .020, .41),
    part("button", .953, .035, .016, .15), part("usb", .955, .275, .014, .30),
    { ...part("led", .029, .11, .014, .74, undefined, "bar"), color: "#168fd3" }];
  for (let column = 0; column < 5; column++) {
    const x = .060 + column * .172;
    if (column < 3) components.push(part("drive-carrier", x, .12, .165, .32, String(column * 2)));
    components.push(part("drive-carrier", x, .58, .165, .33, String(column < 3 ? column * 2 + 1 : column + 3)));
  }
  for (let index = 0; index < 5; index++) components.push(part("led", .050, .16 + index * .13, .004, .038));
  return { components, ports: [directManagement(device, .963, .785, .14, .92)] };
}

/** Trace the R6525 eight-drive chassis independently from its ten-drive and rear-storage alternatives. */
function frontR6525(device) {
  const components = [part("vent", .580, .075, .330, .40), part("vga", .920, .28, .018, .40),
    part("button", .950, .035, .015, .15), part("usb", .951, .29, .014, .30),
    { ...part("led", .033, .13, .013, .72, undefined, "bar"), color: "#168fd3" }];
  for (let column = 0; column < 5; column++) {
    const x = .061 + column * .172;
    if (column < 3) components.push(part("drive-carrier", x, .125, .165, .32));
    components.push(part("drive-carrier", x, .590, .165, .32));
  }
  for (let index = 0; index < 5; index++) components.push(part("led", .049, .17 + index * .13, .004, .038));
  return { components, ports: [directManagement(device, .959, .785, .14, .92)] };
}

/** Trace the R6615 eight-NVMe face as two four-drive banks separated by the documented cooling opening. */
function frontR6615(device) {
  const components = [part("vent", .408, .17, .146, .76), part("vga", .922, .30, .018, .38),
    part("button", .954, .045, .015, .14), part("usb", .953, .29, .014, .30),
    { ...part("led", .034, .14, .013, .70, undefined, "bar"), color: "#168fd3" }];
  for (const x of [.066, .232, .573, .739]) for (const y of [.19, .585]) {
    components.push(part("drive-carrier", x, y, .158, .32));
  }
  for (let index = 0; index < 5; index++) components.push(part("led", .052, .19 + index * .125, .004, .035));
  return { components, ports: [directManagement(device, .961, .79, .14, .92)] };
}

/** Trace the R750's eight vertical carriers and two broad ventilation panels with the right service column. */
function frontR750(device) {
  const components = [part("vent", .355, .055, .284, .90), part("vent", .655, .055, .274, .90),
    part("vga", .975, .15, .018, .17), part("usb", .952, .15, .013, .18),
    part("button", .951, .035, .017, .085),
    { ...part("led", .031, .09, .015, .25, undefined, "bar"), color: "#168fd3" }];
  for (let index = 0; index < 8; index++) components.push(part("drive-carrier", .053 + index * .037, .08, .033, .84, String(index)));
  for (let index = 0; index < 5; index++) components.push(part("led", .030, .40 + index * .055, .004, .02));
  return { components, ports: [directManagement(device, .960, .81, .09, .93)] };
}

/** Trace the R7525's individual eight-drive front and its slightly wider service-side ventilation panel. */
function frontR7525(device) {
  const components = [part("vent", .356, .06, .282, .88), part("vent", .648, .06, .294, .88),
    part("vga", .975, .17, .018, .18), part("usb", .951, .17, .013, .17),
    part("button", .951, .035, .016, .085),
    { ...part("led", .031, .09, .014, .25, undefined, "bar"), color: "#168fd3" }];
  for (let index = 0; index < 8; index++) components.push(part("drive-carrier", .054 + index * .037, .075, .033, .85));
  for (let index = 0; index < 5; index++) components.push(part("led", .030, .41 + index * .055, .004, .02));
  return { components, ports: [directManagement(device, .960, .81, .09, .93)] };
}

/** Trace the R7615 eight-drive front instead of copying its 16/24-drive or E3.S alternatives. */
function frontR7615(device) {
  const components = [part("vent", .357, .06, .284, .885), part("vent", .652, .06, .286, .885),
    part("vga", .975, .19, .018, .18), part("usb", .951, .19, .013, .17),
    part("button", .951, .045, .017, .085),
    { ...part("led", .031, .095, .014, .25, undefined, "bar"), color: "#168fd3" }];
  for (let index = 0; index < 8; index++) components.push(part("drive-carrier", .051 + index * .0375, .08, .033, .845));
  for (let index = 0; index < 5; index++) components.push(part("led", .030, .41 + index * .055, .004, .02));
  return { components, ports: [directManagement(device, .960, .825, .09, .94)] };
}

/** Anchor the front direct-management connector separately from storage USB and its small physical caption. */
function directManagement(device, x, y, height, captionY) {
  return { ...socket(device, 4, x, y, .008, height, "iDRAC DIRECT"),
    descriptionAnchor: { x, y: captionY, fontSize: 6.5, boxHeight: 8 } };
}

/** Mark a removable expansion cover so chassis variants can be audited without confusing it with an installed NIC. */
function pcieCover(x, y, width, height, label) {
  return { ...part("module-bay", x, y, width, height, label), role: "pcie-cover" };
}

/** Bind the lower rear LOM pair and dedicated management socket with captions in the clear strip above them. */
function lowerRearPorts(device, centers, y, height, captionY) {
  return centers.map((x, index) => ({ ...socket(device, index + 1, x, y, .037, height, index === 2 ? "iDRAC" : String(index + 1)),
    descriptionAnchor: { x, y: captionY, fontSize: 6.5, boxHeight: 8 } }));
}

/** Trace the R650 three-low-profile rear, far-left BOSS and separated narrow AC supplies. */
function rearR650(device) {
  const components = [part("drive-carrier", .012, .075, .023, .79, undefined, "boss"),
    part("drive-carrier", .042, .075, .023, .79, undefined, "boss"),
    part("psu", .074, .025, .145, .94, "800W", "ac-inlet-right-sideways"),
    part("psu", .839, .025, .153, .94, "800W", "ac-inlet-right-sideways"),
    pcieCover(.274, .10, .153, .33, "1"), pcieCover(.445, .10, .160, .33, "2"), pcieCover(.628, .10, .168, .33, "3"),
    { ...part("module-bay", .382, .665, .188, .23), role: "ocp-blank" },
    part("usb", .682, .69, .032, .08), part("usb", .682, .875, .032, .08),
    part("vga", .736, .72, .067, .18), part("button", .600, .705, .013, .13),
    part("vent", .225, .065, .031, .84), part("vent", .814, .065, .018, .83)];
  return { components, ports: lowerRearPorts(device, [.287, .334, .647], .79, .19, .57) };
}

/** Trace the R6525 eight-drive rear and deliberately cover the optional four-port OCP card pictured in its manual. */
function rearR6525(device) {
  const components = [part("drive-carrier", .028, .075, .025, .77, undefined, "boss"),
    part("drive-carrier", .060, .075, .025, .77, undefined, "boss"),
    part("psu", .095, .025, .137, .94, "1400W", "ac-inlet-right-sideways"),
    part("psu", .835, .025, .154, .94, "1400W", "ac-inlet-right-sideways"),
    pcieCover(.285, .115, .163, .32, "1"), pcieCover(.464, .115, .163, .32, "2"), pcieCover(.667, .115, .137, .32, "3"),
    { ...part("module-bay", .408, .675, .185, .24), role: "ocp-blank" },
    part("usb", .687, .69, .032, .075), part("usb", .687, .89, .032, .075),
    part("vga", .744, .735, .066, .18), part("button", .608, .700, .013, .12),
    part("vent", .242, .08, .025, .32), part("vent", .814, .09, .014, .82)];
  return { components, ports: lowerRearPorts(device, [.284, .337, .653], .805, .18, .575) };
}

/** Trace the R6615 two-slot rear with selected LOM, BOSS-N1 and a blank OCP position. */
function rearR6615(device) {
  const components = [part("drive-carrier", .016, .08, .025, .77, undefined, "boss"),
    part("drive-carrier", .048, .08, .025, .77, undefined, "boss"),
    part("psu", .078, .025, .143, .94, "800W", "ac-inlet-right-sideways"),
    part("psu", .836, .025, .154, .94, "800W", "ac-inlet-right-sideways"),
    pcieCover(.268, .13, .248, .31, "1"), pcieCover(.566, .13, .231, .31, "2"),
    { ...part("module-bay", .386, .65, .179, .25), role: "ocp-blank" },
    part("usb", .673, .695, .032, .075), part("usb", .673, .88, .032, .075),
    part("vga", .731, .72, .070, .185), part("button", .586, .69, .016, .16),
    part("vent", .229, .08, .026, .82), part("vent", .808, .09, .019, .80)];
  return { components, ports: lowerRearPorts(device, [.275, .317, .636], .79, .19, .575) };
}

/** Trace the R750 standard eight-PCIe rear and its 86mm supplies without adding the optional rear drive module. */
function rearR750(device) {
  const components = [part("psu", .018, .54, .210, .425, "2400W", "ac-fan-left-c20"),
    part("psu", .780, .54, .210, .425, "2400W", "ac-fan-left-c20"),
    part("drive-carrier", .305, .13, .021, .30, undefined, "boss"),
    part("drive-carrier", .332, .10, .021, .32, undefined, "boss"),
    pcieCover(.038, .11, .224, .115, "1"), pcieCover(.038, .30, .224, .115, "2"),
    pcieCover(.410, .11, .217, .115, "4"), pcieCover(.410, .30, .217, .115, "5"),
    pcieCover(.714, .11, .226, .115, "7"), pcieCover(.714, .30, .226, .115, "8"),
    pcieCover(.299, .59, .151, .145, "3"), pcieCover(.468, .59, .151, .145, "6"),
    { ...part("module-bay", .400, .845, .166, .095), role: "ocp-blank" },
    part("vent", .660, .535, .111, .24), part("usb", .657, .832, .031, .04), part("usb", .657, .919, .031, .04),
    part("vga", .701, .85, .070, .082), part("button", .583, .845, .013, .058)];
  return { components, ports: lowerRearPorts(device, [.287, .336, .630], .89, .08, .79) };
}

/** Trace the R7525 labeled rear cover banks, BOSS-S2 and motherboard I/O independently of the Intel chassis. */
function rearR7525(device) {
  const components = [part("psu", .021, .53, .207, .43, "2400W", "ac-fan-left-c20"),
    part("psu", .782, .53, .207, .43, "2400W", "ac-fan-left-c20"),
    part("drive-carrier", .303, .115, .024, .33, undefined, "boss"),
    part("drive-carrier", .334, .115, .024, .33, undefined, "boss"),
    pcieCover(.044, .095, .222, .13, "1"), pcieCover(.044, .29, .222, .13, "2"),
    pcieCover(.398, .095, .223, .13, "4"), pcieCover(.398, .29, .223, .13, "5"),
    pcieCover(.730, .115, .211, .13, "7"), pcieCover(.730, .31, .211, .13, "8"),
    pcieCover(.295, .595, .153, .145, "3"), pcieCover(.466, .595, .153, .145, "6"),
    { ...part("module-bay", .387, .845, .165, .095), role: "ocp-blank" },
    part("vent", .655, .535, .116, .24), part("usb", .655, .835, .031, .04), part("usb", .655, .925, .031, .04),
    part("vga", .703, .855, .066, .08), part("button", .576, .845, .013, .058)];
  return { components, ports: lowerRearPorts(device, [.286, .336, .620], .89, .08, .79) };
}

/** Trace the R7615 BOSS-N1 fittings and standard eight-slot rear, retaining only the selected optional LOM. */
function rearR7615(device) {
  const components = [part("psu", .024, .525, .214, .445, "2400W", "ac-fan-left-c20"),
    part("psu", .785, .525, .199, .445, "2400W", "ac-fan-left-c20"),
    part("drive-carrier", .310, .15, .021, .28, undefined, "boss"),
    part("drive-carrier", .337, .13, .021, .30, undefined, "boss"),
    part("button", .375, .28, .012, .06),
    pcieCover(.056, .08, .216, .135, "1"), pcieCover(.056, .29, .216, .135, "2"),
    pcieCover(.422, .08, .211, .135, "4"), pcieCover(.422, .29, .211, .135, "5"),
    pcieCover(.723, .11, .222, .135, "7"), pcieCover(.723, .32, .222, .135, "8"),
    pcieCover(.311, .585, .146, .155, "3"), pcieCover(.475, .585, .146, .155, "6"),
    { ...part("module-bay", .397, .825, .164, .115), role: "ocp-blank" },
    part("vent", .667, .535, .109, .23), part("usb", .664, .825, .031, .045), part("usb", .664, .925, .031, .045),
    part("vga", .710, .845, .067, .087), part("button", .594, .835, .017, .08)];
  return { components, ports: lowerRearPorts(device, [.292, .341, .638], .89, .08, .785) };
}
