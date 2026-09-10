const DOCUMENTS = "https://dl.dell.com/content/";
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
]);

/** Resolve three individually traced Dell models with explicit power configurations and inventory revisions. */
export function buildDellModelFaceplate(device) {
  const definition = models.get(device?.model);
  if (!definition || device.faceplate?.vendor !== "Dell") return null;
  const source = `${DOCUMENTS}${definition.guide}?language=en-us`;
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
function rearS5248(device) {
  const components = [part("psu", .015, .035, .198, .93, "AC", "ac-fan-right"),
    part("psu", .780, .035, .198, .93, "AC", "ac-fan-right"),
    part("usb", .502, .47, .013, .28), part("button", .505, .81, .008, .06, undefined, "reset"),
    part("module-bay", .530, .30, .008, .38, undefined, "populated")];
  for (const x of [.227, .338, .560, .670]) components.push(part("fan", x, .035, .098, .93));
  return { ports: [socket(device, 55, .474, .60, .027, .19, "CONSOLE"),
    socket(device, 56, .474, .295, .027, .19, "MGMT"),
    socket(device, 57, .474, .844, .018, .06, "MICRO-USB")], components };
}
