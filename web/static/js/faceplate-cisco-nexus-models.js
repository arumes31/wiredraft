const HARDWARE = "https://www.cisco.com/c/en/us/td/docs/";
const models = new Map([
  ["Nexus 93180YC-FX3", { dataPorts: 54,
    guide: "dcn/hw/nx-os/nexus9000/93180yc-fx3/cisco-nexus-93180yc-fx3-nx-os-mode-switch-hardware-installation-guide/m_overview1.html",
    figures: "Overview: front illustration 502822 and rear illustration 502823; fan and power-supply options",
    configuration: "N9K-C93180YC-FX3 with two NXA-PAC-650W-PE AC supplies and four NXA-FAN-35CFM-PE fan modules; port-side exhaust airflow." }],
  ["Nexus 9336C-FX2", { dataPorts: 36,
    guide: "switches/datacenter/nexus9000/hw/n9336cfx2_hig/guide/b_n9336cFX2_nxos_hardware_installation_guide/b_n9336cFX2_nxos_hardware_installation_guide_chapter_01.html",
    figures: "Front Figure 1 and power-side Figure 2; individual datasheet Figure 1; management-speed security-target Table 5 page 20",
    supplemental: "https://www.cisco.com/c/en/us/products/collateral/switches/nexus-9000-series-switches/datasheet-c78-742282.html",
    configuration: "N9K-C9336C-FX2 with two NXA-PAC-750W-PE AC supplies and three NXA-FAN-65CFM-PE fan modules; port-side exhaust airflow." }],
]);
const MANAGEMENT_SPEED = "https://www.cisco.com/c/dam/en_us/solutions/industries/government/security_certification/pdfs/eucc-3110-2025-12-2500098-01-security-target.pdf";

/** Resolve only the two Nexus chassis whose individual port-side and power-side drawings were inspected. */
export function buildCiscoNexusModelFaceplate(device) {
  const definition = models.get(device.model);
  if (!definition || device.faceplate?.vendor !== "Cisco") return null;
  const source = `${HARDWARE}${definition.guide}`;
  const fx3 = definition.dataPorts === 54;
  return {
    id: `enterprise-cisco-${device.model.toLowerCase().replaceAll(" ", "-")}`, family: device.model, fidelity: "model",
    source, sourcePage: definition.figures,
    evidence: { models: [device.model], scope: "model", reviewed: "2026-09-10", front: source, rear: source,
      configuration: definition.configuration,
      ...(definition.supplemental ? { supplemental: definition.supplemental, managementSpeed: MANAGEMENT_SPEED } : {}),
    },
    inventoryRevision: 1, inventoryComplete: true,
    legacyLayouts: [{ inventoryRevision: 0, portIndexMap: Object.fromEntries(
      Array.from({ length: definition.dataPorts + 1 }, (_, index) => [index + 1, index + 1])) }],
    catalogDiscrepancies: [definition.configuration,
      fx3 ? "New inventory adds the omitted rear RJ45 management socket. The two SMB timing connectors, SMA antenna connector, unsupported ToD socket and storage USB are decorative hardware."
        : "New inventory adds the omitted rear RJ45 and optical management sockets. Cisco's security target specifies 1Gbps operation for the SFP+ management cage; it is represented as a 1G optical endpoint. Storage USB is decorative.",
      "Revision-zero data and serial-console endpoint identities remain unchanged; absent management endpoints are not added to saved devices. Each fan-module symbol represents the documented replaceable tray containing two rotors.",
    ],
    defaultFace: "front", chassis: { x: 0, y: .05, width: 1, height: .9 },
    faces: fx3 ? { front: front93180(device), rear: rear93180(device) } : { front: front9336(device), rear: rear9336(device) },
  };
}

/** Describe a component using normalized physical chassis bounds. */
function part(kind, x, y, width, height, label, variant) {
  return { kind, x, y, width, height, ...(label ? { label } : {}), ...(variant ? { variant } : {}) };
}

/** Associate a measured socket with its canonical endpoint rather than an editable label. */
function socket(device, index, x, y, width, height, physicalLabel) {
  const port = device.ports.find((candidate) => candidate.portIndex === index);
  if (!port) throw new Error(`${device.model}: documented socket index ${index} is missing from the catalog`);
  return { label: port.label, type: port.type, portIndex: index, x, y, width, height, physicalLabel };
}

/** Trace the 93180YC-FX3's two SFP28 banks, three paired QSFP28 columns and timing fittings. */
function front93180(device) {
  const ports = Array.from({ length: 48 }, (_, index) => socket(device, index + 1,
    (index < 24 ? .055 : .450) + Math.floor(index % 24 / 2) * .033,
    index % 2 ? .65 : .33, .026, .19, String(index + 1)));
  for (let index = 0; index < 6; index++) ports.push(socket(device, index + 49,
    [.857, .908, .961][Math.floor(index / 2)], index % 2 ? .65 : .33, .042, .22, String(index + 49)));
  const components = [part("text", .002, .014, .030, .080, "CISCO"),
    part("vent", .050, .025, .929, .065, undefined, "mesh"),
    part("vent", .145, .915, .832, .067, undefined, "perforated"),
    part("coax", .016, .13, .018, .16, "1PPS"), part("coax", .016, .40, .018, .16, "10MHz"),
    part("coax", .016, .68, .018, .16, "ANT")];
  for (const x of [.050, .075, .100]) components.push(part("led", x, .90, .007, .05));
  return { ports, components };
}

/** Trace the 93180YC-FX3's PSU ends, four central fan trays and distinct console/management/ToD cluster. */
function rear93180(device) {
  const components = [part("psu", .009, .025, .222, .94, "650W AC", "ac-fan-left"),
    part("psu", .769, .025, .220, .94, "650W AC", "ac-fan-left"),
    part("rj45", .719, .22, .027, .22, "ToD"), part("usb", .715, .59, .034, .11)];
  for (const x of [.247, .348, .454, .557]) components.push(part("fan", x, .045, .090, .91));
  for (const x of [.695, .710, .725]) components.push(part("led", x, .86, .005, .045));
  return { ports: [socket(device, 55, .680, .33, .026, .22, "CONSOLE"),
    socket(device, 56, .680, .68, .026, .22, "MGMT")], components };
}

/** Trace the 9336C-FX2's eighteen paired QSFP28 columns and left-hand lane-selector controls. */
function front9336(device) {
  const ports = Array.from({ length: 36 }, (_, index) => socket(device, index + 1,
    .061 + Math.floor(index / 2) * .05255, index % 2 ? .68 : .32, .040, .23, String(index + 1)));
  const components = [part("text", .003, .045, .030, .085, "CISCO"),
    part("button", .009, .77, .012, .10, undefined, "reset"),
    part("vent", .043, .025, .936, .07, undefined, "perforated"),
    part("vent", .043, .91, .936, .067, undefined, "perforated")];
  for (const y of [.27, .43, .59]) components.push(part("led", .009, y, .005, .045));
  for (const y of [.20, .35, .50, .65]) components.push(part("led", .026, y, .004, .035));
  return { ports, components };
}

/** Trace the 9336C-FX2's wider fan trays and both copper and optical management connectors. */
function rear9336(device) {
  const components = [part("psu", .008, .035, .135, .92, "750W AC", "ac-fan-right"),
    part("psu", .865, .035, .125, .92, "750W AC", "ac-fan-right"),
    part("usb", .842, .15, .014, .31)];
  for (const x of [.157, .363, .569]) components.push(part("fan", x, .035, .185, .92));
  for (const x of [.774, .794]) components.push(part("led", x, .90, .005, .045));
  return { ports: [socket(device, 37, .780, .69, .026, .22, "CONSOLE"),
    socket(device, 38, .780, .31, .026, .22, "MGMT RJ45"),
    socket(device, 39, .824, .69, .030, .19, "MGMT SFP")], components };
}
