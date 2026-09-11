import { canonicalFaceplateDevice } from "./faceplate-profile.js";
import { resolveArubaMobilityFaceplate } from "./faceplate-aruba-mobility.js";

const source = "https://arubanetworking.hpe.com/techdocs/hardware/switches/10000/igsg_10000.pdf";
const cache = new Map();

/** Resolve the explicitly selected R8P13A bundle without interpreting editable endpoint labels. */
export function resolveArubaRemainingFaceplate(device) {
  const mobility = resolveArubaMobilityFaceplate(device);
  if (mobility) return mobility;
  if (device?.faceplate?.vendor !== "HPE Aruba" || device.model !== "CX 10000 family") return null;
  if (!cache.has(device.model)) {
    const canonical = canonicalFaceplateDevice(device);
    if (!canonical) return null;
    cache.set(device.model, { profile: profile10000(canonical.device), allocations: new Map() });
  }
  const cached = cache.get(device.model);
  const units = Math.max(1, Number(device.faceplate.unitsU) || 1);
  if (units === 1) return cached.profile;
  // Saved rack bounds remain 100 world pixels per U; only the source 1U body is fitted back to its native height.
  if (!cached.allocations.has(units)) cached.allocations.set(units, { ...cached.profile,
    chassis: { ...cached.profile.chassis, y: cached.profile.chassis.y / units, height: cached.profile.chassis.height / units } });
  return cached.allocations.get(units);
}

/** Record the observed configuration and explicit historical identities for the former 4U family placeholder. */
function profile10000(device) {
  const configuration = "R8P13A CX 10000-48Y6C 1U Front-to-Back bundle: 48 SFP28 25G, six QSFP28 100G, two R8R51A 800W AC supplies and six R8R53A fan trays.";
  return {
    id: "aruba-r8p13a", sku: "R8P13A", family: "Aruba CX 10000", defaultFace: "front", fidelity: "model",
    panelFidelity: { front: "model", rear: "model" }, inventoryComplete: true, rearHardwareVerified: true, inventoryRevision: 1,
    source, sourcePage: "Installation guide PDF pages 8–10, 13–18; manufacturer high-resolution front/rear product photographs",
    evidence: { scope: "model", models: ["R8P13A"], catalogAlias: device.model, selectedModel: "R8P13A", configuration,
      front: "https://assets.ext.hpe.com/is/image/hpedam/s00010743?wid=2400&fmt=png-alpha",
      rear: "https://assets.ext.hpe.com/is/image/hpedam/s00010745?wid=2400&fmt=png-alpha",
      inventory: source, quickSpecs: "https://support.hpe.com/hpesc/public/api/document/a50004267enw" },
    legacyLayouts: [{ inventoryRevision: 0, portIndexMap: {
      ...Object.fromEntries(Array.from({ length: 54 }, (_, index) => [index + 1, index + 1])), 57: 55, 59: 56,
    }, portLabels: { 57: "MGMT1", 59: "CONSOLE" } }],
    note: "The catalog alias selects the photographed R8P13A bundle; CX 10040 hardware is not represented.",
    limitations: [configuration, "Relative topology is traced from manufacturer photographs; no manufacturing dimensions are claimed. Side/top panels and the photograph's reflection are outside the projection.",
      "Rear fan handles are pale green in the manufacturer's photograph; the airflow direction and exact replaceable modules follow the guide's R8P13A bundle table."],
    catalogDiscrepancies: ["The former 4U placeholder becomes 1U only for newly created devices; saved rack allocations are preserved.",
      "Historical data 55/56 and second management 58 have no physical sockets and remain unmapped. Old MGMT1 57 maps to new 55; old USB-C serial 59 maps to new rear USB-C 56. Front RJ45 serial 57 is new only.",
      "Historical 400G QSFP-DD endpoints 49–54 retain their saved type and speed but map explicitly to the six physical 100G QSFP28 cages."],
    chassis: { x: .025, y: .04, width: .95, height: .92 }, faces: panels10000(device.ports),
  };
}

/** Place canonical sockets with explicit physical captions above/below paired banks. */
function socket(port, x, y, width, height, physicalLabel, captionY, connectorKind, compatibleTypes = []) {
  return { portIndex: port.portIndex, label: port.label, type: port.type, x, y, width, height, physicalLabel,
    descriptionAnchor: { x, y: captionY, fontSize: 5.5, boxHeight: 7 },
    ...(connectorKind ? { connectorKind } : {}), ...(compatibleTypes.length ? { compatibleTypes } : {}) };
}

/** Describe a nonconnectable observed marking, guard or installed component. */
function part(kind, x, y, width, height, variant, label) {
  return { kind, x, y, width, height, ...(variant ? { variant } : {}), ...(label ? { label } : {}) };
}

/** Trace three 16-port SFP banks, three paired QSFP cages and the split front/rear service connectors. */
function panels10000(ports) {
  const frontPorts = ports.slice(0, 48).map((port, index) => {
    const col = Math.floor(index / 2); const lower = index % 2 === 1;
    return socket(port, .031 + col * .0328 + Math.floor(col / 8) * .009, lower ? .70 : .38, .030, .21,
      String(index + 1), lower ? .88 : .18);
  });
  frontPorts.push(...ports.slice(48, 54).map((port, index) => {
    const lower = index % 2 === 1;
    return socket(port, .84 + Math.floor(index / 2) * .043, lower ? .70 : .38, .041, .21,
      String(index + 49), lower ? .88 : .18, undefined, ["QSFP_DD_400G"]);
  }));
  frontPorts.push(socket(ports[54], .971, .37, .031, .21, "MGMT", .18, "rj45-inverted"),
    socket(ports[56], .971, .70, .031, .21, "CONSOLE", .88, "console"));
  const front = [part("vent", .008, .008, .932, .10, "perforated"),
    part("vent", .012, .963, .85, .025, "mesh"), part("led", .967, .03, .01, .04),
    part("module-bay", .88, .965, .06, .025, "blank")];
  const rear = [part("psu", .014, .10, .13, .82, "aruba-10000-ac"),
    ...Array.from({ length: 6 }, (_, index) => part("fan", .159 + index * .109, .10, .097, .82, "aruba-10000-fan")),
    part("psu", .864, .10, .13, .82, "aruba-10000-ac"), part("usb", .838, .42, .012, .24),
    part("led", .822, .77, .004, .025), part("led", .836, .77, .004, .025),
    part("screw", .002, .74, .011, .10), part("screw", .986, .74, .011, .10)];
  rear[0].handleLeft = true;
  return { front: { ports: frontPorts, components: front }, rear: {
    ports: [socket(ports[55], .818, .54, .010, .18, "CONSOLE", .05, "usb-c")], components: rear,
  } };
}
