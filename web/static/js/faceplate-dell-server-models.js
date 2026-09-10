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
  const front = `${base}front-view-of-the-system?guid=guid-${definition.front}&lang=en-us`;
  const rear = `${base}rear-view-of-the-system?guid=guid-${definition.rear}&lang=en-us`;
  return { id: `dell-${definition.key}`, family: device.model, fidelity: "model", defaultFace: "rear",
    source: front, sourcePage: definition.figures, inventoryRevision: 1, inventoryComplete: true,
    note: definition.configuration, limitations: [definition.configuration],
    evidence: { models: [device.model], scope: "model", reviewed: "2026-09-10", front, rear,
      supplemental: definition.specification, configuration: definition.configuration },
    legacyLayouts: [{ inventoryRevision: 0, portIndexMap: { 1: 1, 2: 2, 5: 3 },
      portLabels: { 1: "NIC1", 2: "NIC2", 5: "iDRAC1" } }],
    catalogDiscrepancies: [definition.configuration,
      "Fixed LOM networking is two 1GbE sockets. The older four-10GbE family inventory retains NIC1/2 and iDRAC identities and settings; NIC3/4 remain unmapped because no installed add-in card was specified.",
      "New inventory adds front iDRAC Direct micro-USB and the R350's fixed DB9 serial socket. USB storage and VGA are hardware artwork rather than network endpoints.",
      "New R350/R450 instances occupy 1U; existing saved rack heights and positions remain unchanged. A non-native saved height scales the physical drawing to its reserved space."],
    chassis: { x: 0, y: .05, width: 1, height: .9 },
    faces: definition.key === "r350" ? { front: frontR350(device), rear: rearR350(device) }
      : definition.key === "r450" ? { front: frontR450(device), rear: rearR450(device) }
        : { front: frontR550(device), rear: rearR550(device) },
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
