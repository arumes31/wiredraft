const DOCUMENTS = "https://dl.dell.com/content/";
const XC_GUIDE = "https://downloads.dell.com/solutions/networking-solution-resources/XC_Series_Networking_Guide_v2.0.pdf";
const VCF_GUIDE = "https://dl.dell.com/manuals/common/vcf_on_vxrail_nsxt.pdf";
const models = new Map([
  ["PowerSwitch N3248TE-ON", { key: "n3248te", guide: "manual27697230-dell-powerswitch-n3200-on-e3200-on-series-installation-guide.pdf", front: 12, rear: 13,
    figures: "Individual N3248TE I/O illustration page 12; explicitly scoped PSU-side illustration page 13; management page 73",
    supplemental: "https://www.delltechnologies.com/asset/en-gb/products/networking/technical-support/dell-powerswitch-n3248te-on-spec-sheet.pdf",
    configuration: "N3248TE-ON with two 550W AC supplies, including the optional second supply, and three fan modules; normal I/O-to-PSU airflow." }],
  ["PowerSwitch S4148F-ON", { key: "s4148f", guide: "manual45603856-dell-powerswitch-s4100-on-series-installation-guide-september-2023.pdf", front: 9, rear: 11,
    figures: "Individual front Figure 3 page 9; scoped rear Figure 8 page 11; upper RJ45 serial console Figure 28 page 38",
    supplemental: "https://www.dell.com/support/manuals/en-us/dell-emc-smartfabric-os10/smartfabric-os-user-guide-10-5-3/s4148-on-series-port-profiles?guid=guid-a0648aef-1d5f-4b4a-b2bb-452b98cb9d5a&lang=en-us",
    configuration: "S4148F-ON with two AC supplies and four fan modules; normal I/O-to-PSU airflow. All physical cages are drawn; active speeds and breakout availability depend on the configured NOS port profile." }],
  ["PowerSwitch S5248F-ON", { key: "s5248f", guide: "manual38150967-dell-powerswitch-s5200f-on-series-installation-guide-july-2023.pdf", front: 8, rear: 10,
    figures: "Individual S5248F I/O illustration page 8; explicitly scoped PSU-side illustration page 10; management detail page 52",
    supplemental: "https://infohub.delltechnologies.com/en-uk/l/switch-configurations-roce-and-iwarp-reference-guide-1/dell-s5248f-on-port-assignment-recommendations-for-all-tor-switches/",
    configuration: "S5248F-ON with two AC supplies and four fan modules; normal I/O-to-PSU airflow. Each 200G QSFP-DD cage represents two 100G logical interfaces in the documented OS10 numbering." }],
  ["PowerSwitch S3048", { key: "s3048", sku: "S3048-ON", guide: "manual29602505-dell-powerswitch-s3048-on-installation-guide-february-2024.pdf", front: 6, rear: 6,
    figures: "Individual S3048-ON front/rear figures page 6; front service detail page 8 and explicit console-top/management-bottom description page 27; optional second AC supply page 24; XC deployment guide page 9 Figure 12 confirms printed port numbering",
    configuration: "S3048-ON with three fan modules and two AC supplies, including the optional second supply; normal I/O-to-PSU airflow." }],
  ["PowerSwitch S4048", { key: "s4048", sku: "S4048-ON", guide: "manual30473339-dell-powerswitch-s4048-on-installation-guide-february-2024.pdf", front: 6, rear: 7,
    figures: "Individual S4048-ON front page 6, rear page 7, USB console access page 33; XC deployment guide page 8 Figure 4 confirms front micro-USB position, single-digit display and numbering; optional second AC supply page 24",
    supplemental: "https://www.dell.com/support/manuals/en-al/dell-emc-os-9/s4048-on-9.14.2.5-config-pub/stack-groupport-numbers?guid=guid-345879bf-2087-4272-8d54-d43ac5c70db1&lang=en-us",
    configuration: "S4048-ON with three horizontal dual-rotor fan modules and two AC supplies, including the optional second supply; normal I/O-to-PSU airflow." }],
  ["PowerSwitch S5048", { key: "s5048", sku: "S5048F-ON", guide: "manual29957947-dell-powerswitch-s5048f-on-installation-guide-june-2023.pdf", front: 7, rear: 8,
    figures: "Individual S5048F-ON front page 7, rear page 8 and enlarged front/rear services page 9; XC deployment guide page 8 Figure 8 confirms numbering; dual AC supply configuration pages 11/26",
    configuration: "S5048F-ON with four fan modules and two AC supplies; normal I/O-to-PSU airflow. Each 100G QSFP28 cage is a separate socket; logical breakout interfaces are not extra connectors." }],
  ["PowerSwitch S5248", { key: "s5248", sku: "S5248F-ON", guide: "manual38150967-dell-powerswitch-s5200f-on-series-installation-guide-july-2023.pdf", front: 8, rear: 10,
    figures: "Individual S5248F-ON front page8, scoped rear page10, AC supply page45, radial fan page49 and rear services page52; VCF deployment page11 Figure5 verifies the numbered front photograph",
    panelDetail: `${VCF_GUIDE}#page=11`,
    configuration: "S5248F-ON with two AC supplies and four radial fan modules; normal I/O-to-PSU airflow. Each 200G QSFP-DD cage represents paired logical interfaces49/50 or51/52, followed by four separate100G sockets53–56." }],
  ["PowerSwitch Z9264", { key: "z9264", sku: "Z9264F-ON", guide: "manual71606330-dell-emc-powerswitch-z9264f-on-installation-guide-march-2022.pdf", front: 6, rear: 7,
    figures: "Individual Z9264F-ON front page6, rear page7, populated configuration page10, AC supplies page26, fans page30 and console-top detail page32; VCF deployment page11 Figure6 verifies every printed row and SFP65/66",
    panelDetail: `${VCF_GUIDE}#page=11`,
    configuration: "Z9264F-ON 2U with two vertically stacked AC supplies and four radial fan modules; normal I/O-to-PSU airflow. All64 QSFP28 cages and both10G SFP+ sockets are physical endpoints; logical breakouts are not extra connectors." }],
  ["PowerSwitch Z9332", { key: "z9332", sku: "Z9332F-ON", guide: "manual52104333-dell-emc-powerswitch-z9332f-on-installation-guide-march-2022.pdf", front: 8, rear: 8,
    figures: "Individual Z9332F-ON front/rear page8, selected configuration page11, AC PSU page24, covered fan modules page26 and front services page28; manufacturer specification photograph page1 verifies paired numbering1–34",
    panelDetail: "https://www.delltechnologies.com/assetlink/doc/en-us/dell-emc-networking-z9332f-spec-sheet-en-dl1li42-original.pdf#page=1",
    configuration: "Z9332F-ON with two highline200–240VAC supplies and seven covered fan modules; normal I/O-to-PSU airflow. DC power is unsupported. The32 physical400G QSFP-DD cages and two10G SFP+ sockets are drawn without logical breakout endpoints." }],
]);

/** Resolve individually traced Dell models with explicit power configurations and inventory revisions. */
export function buildDellModelFaceplate(device) {
  const definition = models.get(device?.model);
  if (!definition || device.faceplate?.vendor !== "Dell") return null;
  const source = `${DOCUMENTS}${definition.guide}?language=en-us`;
  if (definition.sku) return buildShortDellProfile(device, definition, source);
  return {
    id: `enterprise-dell-${definition.key}`, family: device.model, fidelity: "model", source, sourcePage: definition.figures,
    evidence: { models: [device.model], scope: "model", reviewed: "2026-09-10",
      front: `${source}#page=${definition.front}`, rear: `${source}#page=${definition.rear}`,
      supplemental: definition.supplemental, configuration: definition.configuration },
    inventoryRevision: 1, inventoryComplete: true, legacyLayouts: [legacyInventory(definition.key)],
    catalogDiscrepancies: [definition.configuration,
      "Revision-one inventory adds the omitted Ethernet management and micro-USB console sockets. Saved devices keep all original endpoint IDs, types, speeds, settings and custom labels; missing endpoints are not added automatically.",
      ...inventoryNotes(definition.key)],
    defaultFace: "front", chassis: { x: 0, y: .05, width: 1, height: .9 },
    faces: definition.key === "n3248te" ? { front: frontN3248(device), rear: rearN3248(device) }
      : definition.key === "s4148f" ? { front: frontS4148(device), rear: rearS4148(device) }
        : { front: frontS5248(device), rear: rearS5248(device) },
  };
}

/** Resolve a short catalog name to its disclosed exact SKU without mutating the saved identity or inventory. */
function buildShortDellProfile(device, definition, source) {
  const panels = shortPanels(device, definition.key);
  return {
    id: `enterprise-dell-${definition.key}`, family: device.model, sku: definition.sku,
    fidelity: "model", source, sourcePage: definition.figures,
    evidence: { models: [device.model], selectedModel: definition.sku, scope: "model", reviewed: "2026-09-10",
      front: `${source}#page=${definition.front}`, rear: `${source}#page=${definition.rear}`,
      supplemental: definition.supplemental, panelDetail: definition.panelDetail || `${XC_GUIDE}#page=${definition.key === "s3048" ? 9 : 8}`,
      configuration: definition.configuration },
    inventoryRevision: 1, inventoryComplete: true, rearHardwareVerified: true,
    legacyLayouts: [shortLegacyInventory(definition.key)],
    catalogDiscrepancies: [definition.configuration,
      "The short catalog name selects the full SKU above. Saved endpoint IDs, types, speeds, VLANs, PoE settings and custom labels remain unchanged; corrected inventory applies to newly added devices.",
      ...shortInventoryNotes(definition.key)],
    limitations: ["Panel geometry follows the exact model's source illustrations; normalized dimensions are illustrative, not manufacturing measurements."],
    defaultFace: "front", chassis: { x: 0, y: definition.key === "z9264" ? .125 : .05, width: 1, height: definition.key === "z9264" ? .75 : .9 }, faces: panels,
  };
}

/** Select exact short-entry panels while keeping each catalog's independent service inventory order. */
function shortPanels(device, key) {
  if (key === "s3048") return { front: frontS3048(device), rear: rearS3048() };
  if (key === "s4048") return { front: frontS4048(device), rear: rearS4048(device) };
  if (key === "s5048") return { front: frontS5048(device), rear: rearS5048(device) };
  if (key === "s5248") return { front: frontS5248Short(device), rear: rearS5248(device, [56, 55, 57], true) };
  if (key === "z9264") return { front: frontZ9264(device), rear: rearZ9264() };
  return { front: frontZ9332(device), rear: rearZ9332() };
}

/** Preserve explicit revision-zero physical roles while leaving documented surplus old records unmapped. */
function shortLegacyInventory(key) {
  const portIndexMap = {}; const portLabels = {};
  for (let index = 1; index <= 56; index++) {
    if (key === "s3048" && (index === 53 || index === 54)) continue;
    if (key === "z9332" && index >= 35 && index <= 54) continue;
    const serviceOffset = key === "s3048" ? -2 : key === "z9264" ? 12 : key === "z9332" ? -20 : 0;
    portIndexMap[index] = index >= 55 ? index + serviceOffset : index;
    portLabels[index] = index === 55 ? "MGMT" : index === 56 ? "CONSOLE" : String(index);
  }
  return { inventoryRevision: 0, portIndexMap, portLabels };
}

/** Record catalog corrections and conflicting generic source prose separately from the model-specific illustrations. */
function shortInventoryNotes(key) {
  if (key === "s3048") return ["The former generic 48 SFP28 and six QSFP28 inventory is corrected to 48 copper 1GbE ports and four 10G SFP+ cages. Old data indices 1–52 retain their sequential identities with explicit legacy type compatibility. Old management55 and console56 map to new53/54; obsolete uplinks53/54 stay visible as unmapped connections.",
    "The five front system lenses and vertical storage USB-A are hardware artwork; the source documents no USB console on this model.",
    "The installation guide's enlarged service drawing and explicit page27 console-top/management-bottom description establish the serial console above management. XC deployment Figure12 reverses their symbols; the individual installation instructions are used here, while XC verifies numbered data ports."];
  if (key === "s4048") return ["The former SFP28/100G types are corrected to 10G SFP+ and 40G QSFP+ for new devices. Existing data1–54, management55 and console56 retain their identities with explicit legacy type compatibility; new micro-USB console57 is not added to saved devices automatically.",
    "The installation guide's generic prose incorrectly calls the data sockets RJ45 and lists the rear management/serial sockets on the I/O side. Its individually captioned SFP+/QSFP+ front and PSU-side illustrations establish the physical connectors and faces.",
    "The installation illustration omits the documented micro-USB socket and draws a two-digit display. The exact S4048-ON front in Dell's XC deployment Figure4 resolves the micro-USB above a single-digit stack display, with USB-A below."];
  if (key === "s5248") return ["Old data1–54, management55 and console56 retain explicit physical ordinal/role identities. The old100G data types on sockets49/50 remain saved settings; their source-correct artwork shows the two200G DD cages with paired logical49/50 and51/52. New micro-USB console57 is not added to saved devices automatically.",
    "This short entry's management55/console56 order differs from the individual full-SKU catalog entry. The exact rear figure establishes management above serial console and micro-USB below; storageUSB and the luggage tag are decorative hardware."];
  if (key === "z9264") return ["New devices have64 QSFP28 ports, SFP+65/66 and management67/console68/micro-USB69. Old data1–54 preserve their numbered identities with explicit old SFP28 compatibility; old management55 maps to67 and console56 to68. Existing endpoint settings and original1U rack allocation remain unchanged; newly added devices use the documented2U chassis.",
    "The detailed console section page32 places serial console TOP and Ethernet management BOTTOM. The introduction page6 reverses these captions; the dedicated connection instructions establish their roles.",
    "The manufacturer VCF deployment photograph verifies all four numbered rows, SFP65 above66, and the upper-right stack display. Logical breakout interfaces are not additional physical sockets."];
  if (key === "z9332") return ["New devices have32 physical400G QSFP-DD cages, SFP+33/34, management35 and console36. Old1–34 retain numbered physical identities with explicit old SFP28 compatibility; surplus old35–54 stay visible as unmapped connections. Old management55 maps to35 and console56 to36. Existing operational types and settings remain unchanged.",
    "The individually illustrated rear and PSU-removal figure show the AC inlet on the RIGHT of its grille; generic PSU page24 connector-left prose conflicts with the model-specific illustration. Seven fan covers conceal the rotors, so only their apertures and horizontal grips are drawn.",
    "The front service stack is console above storageUSB-A above Ethernet management. StorageUSB is artwork, and this model has no micro-USB console. DC supplies are unsupported; the selected AC configuration requires200–240VAC."];
  return ["The original 54 data cages, management55 and serial console56 retain their identities; new micro-USB console57 is not added to saved devices automatically. Unlike S5248F-ON, this model has six separate QSFP28 cages numbered49–54.",
    "The exact rear figure shows both IEC inlets on the LEFT of their PSU fans. Generic page27 inlet-right prose conflicts with that individual illustration. The stack-ID display is present as hardware, but this model does not support stacking."];
}

/** Map the original grouped inventory into documented physical order without inspecting editable names or array positions. */
function legacyInventory(key) {
  const portIndexMap = {}; const portLabels = {};
  for (let index = 1; index <= 55; index++) {
    portIndexMap[index] = key === "s4148f" && index >= 25 && index <= 48 ? index + 6
      : key === "s4148f" && index >= 49 && index <= 54 ? index - 24 : index;
    portLabels[index] = index === 55 ? "CONSOLE" : String(index);
  }
  return { inventoryRevision: 0, portIndexMap, portLabels };
}

/** Describe source-confirmed catalog corrections while keeping legacy operational data unchanged. */
function inventoryNotes(key) {
  if (key === "n3248te") return ["The former six 100G uplinks are corrected to four front 10G SFP+ cages and two rear 100G QSFP28 cages. Rear printed ports 1/2 correspond to OS10 Ethernet 53/54; OS6 can use them for stacking. The non-PoE chassis has no external PoE supply connector."];
  if (key === "s4148f") return ["The physical central bank is 100G ports 25/26, 40G ports 27/28, and 100G ports 29/30. The right SFP+ bank is numbered 31–54. Explicit revision-zero maps retain the old first/second SFP banks and six uplink identities; the old 100G types on the two 40G-only cages are preserved as legacy data.",
    "RJ45 and RS-232 console descriptions refer to the same upper rear socket. Storage USB-A is decorative hardware; it does not create a network endpoint."];
  return ["The two leftmost large cages are 200G QSFP-DD, with paired logical labels 49/50 and 51/52. The four 100G QSFP28 cages are numbered 53–56. Each physical cage receives one endpoint; logical breakout interfaces are not drawn as extra sockets.",
    "The individual rear illustration places micro-USB below the serial console, despite generic console text mentioning the I/O side. Storage USB-A and the luggage tag remain decorative hardware."];
}

/** Describe a traced hardware component using normalized top-left chassis coordinates. */
function part(kind, x, y, width, height, label, variant) {
  return { kind, x, y, width, height, ...(label ? { label } : {}), ...(variant ? { variant } : {}) };
}

/** Bind a measured socket to canonical inventory, with explicit compatibility for a documented old type error. */
function socket(device, index, x, y, width, height, physicalLabel = String(index), oldType) {
  const port = device.ports.find((candidate) => candidate.portIndex === index);
  if (!port) throw new Error(`${device.model}: documented socket ${index} is missing from the catalog`);
  return { label: port.label, type: port.type, portIndex: index, x, y, width, height, physicalLabel,
    ...(oldType ? { compatibleTypes: [oldType], connectorKind: port.type.startsWith("QSFP") ? "qsfp" : "sfp" } : {}) };
}

/** Trace the N3248TE's four copper banks, lower optical row and upper-right service cluster. */
function frontN3248(device) {
  const ports = Array.from({ length: 48 }, (_, index) => socket(device, index + 1,
    [.034, .240, .446, .652][Math.floor(index / 12)] + Math.floor(index % 12 / 2) * .0326,
    index % 2 ? .64 : .37, .027, .19));
  for (let index = 0; index < 4; index++) ports.push(socket(device, index + 49,
    [.852, .888, .928, .962][index], .71, .029, .19, String(index + 49), "QSFP28_100G"));
  ports.push(socket(device, 55, .856, .285, .028, .19, "CONSOLE"),
    socket(device, 56, .892, .285, .028, .19, "MGMT"),
    socket(device, 57, .971, .185, .017, .07, "MICRO-USB"));
  const components = [part("usb", .920, .15, .013, .30), part("lcd", .940, .12, .020, .28),
    part("module-bay", .004, .17, .008, .62, undefined, "populated"),
    part("button", .986, .07, .007, .055, undefined, "reset")];
  for (const y of [.39, .53, .67, .81]) components.push(part("led", .983, y, .005, .035));
  return { ports, components };
}

/** Trace the N3248TE's paired rear ports, three fan trays, plain spacer and adjacent dual-AC supplies. */
function rearN3248(device) {
  const components = [part("module-bay", .463, .035, .098, .93),
    part("psu", .575, .035, .201, .93, "550W AC", "ac-fan-left"),
    part("psu", .790, .035, .198, .93, "550W AC", "ac-fan-left")];
  for (const x of [.125, .238, .351]) components.push(part("fan", x, .035, .098, .93));
  for (const y of [.18, .35, .60, .77]) components.push(part("led", .020, y, .005, .045));
  return { ports: [socket(device, 53, .066, .34, .041, .20, "1"), socket(device, 54, .066, .66, .041, .20, "2")], components };
}

/** Trace the S4148F's interrupted SFP banks around its six central QSFP sockets and separate front USB console. */
function frontS4148(device) {
  const ports = [];
  for (let index = 0; index < 48; index++) {
    const column = Math.floor(index % 24 / 2);
    ports.push(socket(device, index < 24 ? index + 1 : index + 7,
      (index < 24 ? .030 : .573) + column * .032 + (column >= 6 ? .009 : 0),
      index % 2 ? .65 : .43, .027, .18));
  }
  for (let index = 0; index < 6; index++) ports.push(socket(device, index + 25,
    [.443, .485, .527][Math.floor(index / 2)], index % 2 ? .68 : .43, .040, .20,
    String(index + 25), index === 2 || index === 3 ? "QSFP28_100G" : undefined));
  ports.push({ ...socket(device, 57, .978, .425, .020, .080, "MICRO-USB"),
    descriptionAnchor: { x: .978, y: .925 } });
  const components = [part("lcd", .970, .06, .017, .26), part("usb", .970, .58, .016, .27)];
  for (const slot of ports.filter((port) => port.portIndex <= 54)) components.push(part("led", slot.x - .002, slot.y < .5 ? .18 : .88, .004, .035));
  return { ports, components };
}

/** Trace the S4148F's fan-left AC supplies, four consecutive fan trays and upper serial console. */
function rearS4148(device) {
  const components = [part("psu", .022, .035, .176, .93, "AC", "ac-fan-left"),
    part("psu", .805, .035, .176, .93, "AC", "ac-fan-left")];
  for (const x of [.218, .332, .446, .560]) components.push(part("fan", x, .035, .093, .93));
  for (const y of [.26, .49, .72]) components.push(part("led", .767, y, .005, .04));
  return { ports: [socket(device, 55, .730, .30, .027, .20, "CONSOLE"),
    socket(device, 56, .730, .62, .027, .20, "MGMT")], components };
}

/** Trace the S5248F's three SFP28 banks followed by one DD and two QSFP28 paired columns. */
function frontS5248(device) {
  const ports = Array.from({ length: 48 }, (_, index) => {
    const column = Math.floor(index / 2);
    return socket(device, index + 1, .0558 + column * .0328 + Math.floor(column / 8) * .006,
      index % 2 ? .674 : .337, .029, .20);
  });
  for (let index = 0; index < 6; index++) ports.push(socket(device, index + 49,
    [.862, .918, .965][Math.floor(index / 2)], index % 2 ? .674 : .337, .044, .22,
    index < 2 ? ["49/50", "51/52"][index] : String(index + 51), index < 2 ? "QSFP28_100G" : undefined));
  const components = [part("lcd", .009, .09, .020, .28)];
  for (const [x, y] of [[.010, .55], [.022, .55], [.010, .69], [.022, .69], [.010, .83]]) components.push(part("led", x, y, .005, .04));
  return { ports, components };
}

/** Trace the S5248F's central service cluster between two pairs of fans and its fan-right AC supplies. */
function rearS5248(device, serviceIndices = [55, 56, 57], detailed = false) {
  const components = [part("psu", .015, .035, .198, .93, "AC", detailed ? "ac-fan-right-sideways" : "ac-fan-right"),
    part("psu", .780, .035, .198, .93, "AC", detailed ? "ac-fan-right-sideways" : "ac-fan-right"),
    part("usb", .502, .47, .013, .28), part("button", .505, .81, .008, .06, undefined, "reset"),
    part("module-bay", .530, .30, .008, .38, undefined, "populated")];
  for (const x of [.227, .338, .560, .670]) components.push(part("fan", x, .035, .098, .93, undefined, detailed ? "dell-radial-handle" : undefined));
  return { ports: [socket(device, serviceIndices[0], .474, .60, .027, .19, "CONSOLE"),
    socket(device, serviceIndices[1], .474, .295, .027, .19, "MGMT"),
    socket(device, serviceIndices[2], .474, .844, .018, .06, "MICRO-USB")], components };
}

/** Reuse the individually traced S5248F front with the photograph-confirmed single inactive stack digit. */
function frontS5248Short(device) {
  const panel = frontS5248(device);
  panel.components = panel.components.map((component) => component.kind === "lcd"
    ? { ...component, variant: "seven-segment", digits: 1 } : component);
  return panel;
}

/** Trace Z9264's upper and lower thirty-two-port banks, separated at the center, and its end service clusters. */
function frontZ9264(device) {
  const ports = Array.from({ length: 64 }, (_, index) => {
    const column = Math.floor(index % 32 / 2);
    const x = .110 + column * .052 + (column >= 8 ? .015 : 0);
    const row = Math.floor(index / 32) * 2 + index % 2;
    return { ...socket(device, index + 1, x, [.335, .46, .585, .705][row], .044, .105,
      String(index + 1), index < 48 ? "SFP28_25G" : undefined),
    descriptionAnchor: { x, y: [.06, .18, .82, .94][row], fontSize: 5.5, boxHeight: 7 } };
  });
  ports.push({ ...socket(device, 65, .948, .63, .035, .115), descriptionAnchor: { x: .936, y: .935, fontSize: 5.5, boxHeight: 7 } },
    { ...socket(device, 66, .948, .80, .035, .115), descriptionAnchor: { x: .965, y: .935, fontSize: 5.5, boxHeight: 7 } },
    { ...socket(device, 67, .061, .61, .033, .135, "MGMT"), descriptionAnchor: { x: .061, y: .78, fontSize: 6, boxHeight: 8 } },
    { ...socket(device, 68, .061, .39, .033, .135, "CONSOLE"), descriptionAnchor: { x: .061, y: .25, fontSize: 6, boxHeight: 8 } },
    { ...socket(device, 69, .019, .53, .023, .05, "MICRO-USB"), descriptionAnchor: { x: .030, y: .86 } });
  const components = [{ ...part("lcd", .967, .11, .021, .18, undefined, "seven-segment"), digits: 1 },
    part("usb", .970, .34, .012, .19), part("button", .943, .41, .006, .035, undefined, "reset"),
    part("module-bay", .989, .50, .007, .15, undefined, "populated"),
    part("vent", .003, .025, .077, .22, undefined, "mesh"), part("vent", .005, .73, .067, .075, undefined, "mesh")];
  for (const [x, y] of [[.013, .29], [.028, .29], [.013, .37], [.028, .37]]) components.push(part("led", x, y, .005, .025));
  return { ports, components };
}

/** Trace Z9264's four large gray-grip radial fan trays and two vertically stacked fan-right AC supplies. */
function rearZ9264() {
  const components = [part("psu", .786, .025, .196, .465, "AC PSU1", "ac-fan-right-sideways"),
    part("psu", .786, .510, .196, .465, "AC PSU2", "ac-fan-right-sideways")];
  for (const x of [.020, .212, .404, .596]) components.push({ ...part("fan", x, .03, .190, .94, undefined, "dell-radial-handle"), gripColor: "#9daeb8" });
  return { ports: [], components };
}

/** Trace Z9332's sixteen DD pairs followed by SFP33/34 and its console, storage and management stack. */
function frontZ9332(device) {
  const ports = Array.from({ length: 32 }, (_, index) => socket(device, index + 1,
    .039 + Math.floor(index / 2) * .0503, index % 2 ? .68 : .36, .044, .225, String(index + 1), "SFP28_25G"));
  ports.push(socket(device, 33, .842, .36, .033, .205, "33", "SFP28_25G"),
    socket(device, 34, .842, .68, .033, .205, "34", "SFP28_25G"),
    socket(device, 35, .908, .79, .035, .215, "MGMT"),
    socket(device, 36, .908, .23, .035, .215, "CONSOLE"));
  const components = [part("usb", .892, .46, .032, .11),
    part("module-bay", .949, .57, .009, .29, undefined, "populated"),
    part("vent", .005, .01, .852, .13, undefined, "mesh"),
    part("vent", .005, .88, .852, .10, undefined, "mesh")];
  for (const y of [.26, .44, .62, .80]) components.push(part("led", .874, y, .005, .045));
  return { ports, components };
}

/** Trace Z9332's two AC end supplies and seven covered fan modules with horizontal pull bars. */
function rearZ9332() {
  const components = [part("psu", .009, .025, .142, .95, "AC PSU1", "dell-z9332-ac"),
    part("psu", .853, .025, .142, .95, "AC PSU2", "dell-z9332-ac")];
  for (let index = 0; index < 7; index++) components.push(part("fan", .154 + index * .0996, .035, .098, .93, undefined, "dell-z9332-covered"));
  return { ports: [], components };
}

/** Trace the S3048's three sixteen-port copper banks and its front-only optical and management connectors. */
function frontS3048(device) {
  const ports = Array.from({ length: 48 }, (_, index) => ({ ...socket(device, index + 1,
    [.047, .296, .543][Math.floor(index / 16)] + Math.floor(index % 16 / 2) * .029,
    index % 2 ? .64 : .36, .024, .20, String(index + 1), "SFP28_25G"), connectorKind: "rj45" }));
  for (let index = 0; index < 4; index++) ports.push(socket(device, index + 49,
    [.799, .842][Math.floor(index / 2)], index % 2 ? .66 : .36, .036, .17, String(index + 49), "QSFP28_100G"));
  ports.push(socket(device, 53, .892, .65, .029, .20, "MGMT"),
    socket(device, 54, .892, .36, .029, .20, "CONSOLE"));
  const components = [part("usb", .939, .57, .013, .28)];
  for (const [x, y] of [[.924, .15], [.944, .15], [.964, .15], [.944, .32], [.964, .32]]) {
    components.push(part("led", x, y, .006, .05));
  }
  return { ports, components };
}

/** Trace the S3048's plain left spacer, three fans and adjacent fan-left AC supplies. */
function rearS3048() {
  const components = [part("psu", .530, .035, .189, .93, "AC", "ac-fan-left"),
    part("psu", .739, .035, .189, .93, "AC", "ac-fan-left")];
  for (const x of [.190, .297, .404]) components.push(part("fan", x, .035, .093, .93));
  return { ports: [], components };
}

/** Trace the S4048's three SFP+ banks, six QSFP+ cages and right-side storage/display cluster. */
function frontS4048(device) {
  const ports = Array.from({ length: 48 }, (_, index) => socket(device, index + 1,
    [.060, .309, .558][Math.floor(index / 16)] + Math.floor(index % 16 / 2) * .030,
    index % 2 ? .64 : .34, .026, .19, String(index + 1), "SFP28_25G"));
  for (let index = 0; index < 6; index++) ports.push(socket(device, index + 49,
    [.816, .849, .882][Math.floor(index / 2)], index % 2 ? .70 : .42, .032, .19,
    String(index + 49), "QSFP28_100G"));
  ports.push({ ...socket(device, 57, .932, .095, .021, .065, "MICRO-USB"),
    descriptionAnchor: { x: .980, y: .91 } });
  const components = [{ ...part("lcd", .923, .24, .018, .28, undefined, "seven-segment"), digits: 1 },
    part("usb", .925, .61, .013, .29), part("vent", .13, .02, .64, .10, undefined, "mesh")];
  for (const x of [.806, .823, .840, .857, .874]) components.push(part("led", x, .055, .005, .04));
  return { ports, components };
}

/** Trace S4048's three horizontal dual-fan trays between both AC supplies and its two rear RJ45 services. */
function rearS4048(device) {
  const components = [part("psu", .023, .035, .167, .93, "AC", "ac-fan-left"),
    part("psu", .807, .035, .171, .93, "AC", "ac-fan-left")];
  for (const x of [.199, .385, .571]) components.push(part("fan", x, .035, .179, .93, undefined, "dell-dual-horizontal"));
  for (const x of [.772, .782, .792]) components.push(part("led", x, .055, .005, .04));
  return { ports: [socket(device, 55, .781, .36, .023, .21, "MGMT"),
    socket(device, 56, .781, .75, .023, .21, "CONSOLE")], components };
}

/** Trace S5048F's left single-digit display, three SFP28 banks and six independently numbered QSFP28 cages. */
function frontS5048(device) {
  const ports = Array.from({ length: 48 }, (_, index) => socket(device, index + 1,
    [.103, .355, .607][Math.floor(index / 16)] + Math.floor(index % 16 / 2) * .0303,
    index % 2 ? .65 : .36, .027, .18));
  for (let index = 0; index < 6; index++) ports.push(socket(device, index + 49,
    [.866, .902, .938][Math.floor(index / 2)], index % 2 ? .65 : .36, .034, .19));
  const components = [{ ...part("lcd", .050, .15, .018, .30, undefined, "seven-segment"), digits: 1 }];
  for (const [x, y] of [[.045, .60], [.063, .60], [.045, .74], [.063, .74], [.063, .88]]) {
    components.push(part("led", x, y, .005, .04));
  }
  return { ports, components };
}

/** Trace S5048F's four fans and central management, serial, micro-USB, storage and luggage-tag cluster. */
function rearS5048(device) {
  const components = [part("psu", .044, .035, .167, .93, "AC", "ac-fan-right"),
    part("psu", .785, .035, .167, .93, "AC", "ac-fan-right"),
    part("usb", .500, .48, .012, .29), part("module-bay", .535, .16, .008, .63, undefined, "populated")];
  for (const x of [.225, .325, .591, .691]) components.push(part("fan", x, .035, .088, .93, undefined, "dell-single-handle"));
  return { ports: [socket(device, 55, .471, .31, .027, .20, "MGMT"),
    socket(device, 56, .471, .64, .027, .20, "CONSOLE"),
    socket(device, 57, .471, .90, .019, .065, "MICRO-USB")], components };
}
