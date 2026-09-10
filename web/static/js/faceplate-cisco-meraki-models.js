const GUIDE = "https://documentation.meraki.com/Switching/MS_-_Switches/Install_and_Get_Started/Installation_Guides/";
const models = new Map([
  ["Meraki MS120-24P", { series: 120, copper: 24, source: `${GUIDE}MS120_Series_Installation_Guide`,
    figures: "Individual MS120-24P model table; MS120-24 front illustration; MS120 rear illustration",
    configuration: "MS120-24P with 24 PoE+ copper ports, four fixed 1G optical uplinks and fixed internal AC power." }],
  ["Meraki MS225-48FP", { series: 225, copper: 48, source: `${GUIDE}MS225_Series_Installation_Guide`,
    figures: "Individual MS225-48FP model table; MS225-48 front illustration; MS225 rear illustration and 22-pin RPS description",
    configuration: "MS225-48FP with 48 PoE+ copper ports, four fixed 10G optical uplinks, two 40G QSFP stacking sockets and fixed internal AC power. The external RPS2300 supply is optional and not installed." }],
]);
const STACK_CABLES = "https://documentation.meraki.com/Platform_Management/Product_Information/Overviews_and_Datasheets/Small-Form_Factor_Pluggable_%28SFP%29_and_Stacking_Accessories";

/** Resolve individual Meraki models while keeping their former nonexistent Console inventory explicitly unmapped. */
export function buildCiscoMerakiModelFaceplate(device) {
  const definition = models.get(device.model);
  if (!definition || device.faceplate?.vendor !== "Cisco") return null;
  const { series, copper, source, figures, configuration } = definition;
  return {
    id: `enterprise-cisco-ms${series}-${copper}`, family: device.model, fidelity: "model", source, sourcePage: figures,
    evidence: { models: [device.model], scope: "model", reviewed: "2026-09-10", front: source, rear: source, configuration,
      ...(series === 225 ? { stacking: STACK_CABLES } : {}),
    },
    inventoryRevision: 1, inventoryComplete: true,
    legacyLayouts: [{ inventoryRevision: 0, portIndexMap: Object.fromEntries(
      Array.from({ length: copper + 4 }, (_, index) => [index + 1, index + 1])) }],
    catalogDiscrepancies: [configuration,
      "These models have no serial console socket. The former Console endpoint stays routable through the unmapped-inventory marker; it is never reassigned to a management or stacking socket at the same index.",
      series === 120 ? "New inventory replaces the nonexistent console with the documented rear management interface. Existing data endpoint identities remain unchanged."
        : "New inventory includes the formerly omitted rear management and two 40G QSFP stacking sockets. The documented 22-contact RPS connector is decorative hardware. Existing data endpoint identities remain unchanged.",
    ],
    defaultFace: "front", chassis: { x: 0, y: .05, width: 1, height: .9 },
    faces: series === 120 ? { front: front120(device), rear: rear120(device) } : { front: front225(device), rear: rear225(device) },
  };
}

/** Describe a physical part relative to the chassis rectangle. */
function part(kind, x, y, width, height, label, variant) {
  return { kind, x, y, width, height, ...(label ? { label } : {}), ...(variant ? { variant } : {}) };
}

/** Bind a physical socket to canonical inventory while allowing dedicated QSFP stacking artwork. */
function socket(device, index, x, y, width, height, physicalLabel, connectorKind) {
  const port = device.ports.find((candidate) => candidate.portIndex === index);
  if (!port) throw new Error(`${device.model}: documented socket index ${index} is missing from the catalog`);
  return { label: port.label, type: port.type, portIndex: index, x, y, width, height, physicalLabel,
    ...(connectorKind ? { connectorKind } : {}) };
}

/** Trace the MS120-24P's right-hand copper banks and two paired columns of 1G uplinks. */
function front120(device) {
  const ports = Array.from({ length: 24 }, (_, index) => socket(device, index + 1,
    (index < 12 ? .491 : .673) + Math.floor(index % 12 / 2) * .0289,
    index % 2 ? .663 : .35, .026, .22, String(index + 1)));
  for (let index = 0; index < 4; index++) ports.push(socket(device, index + 25,
    index < 2 ? .858 : .885, index % 2 ? .65 : .35, .025, .19, String(index + 25)));
  return { ports, components: [part("text", .910, .62, .054, .20, "CISCO"),
    part("led", .064, .30, .005, .04), part("led", .064, .69, .005, .04),
    part("button", .061, .80, .009, .08, undefined, "reset")] };
}

/** Trace the MS120's single management interface, perforated exhaust and fixed AC inlet. */
function rear120(device) {
  return { ports: [socket(device, 29, .144, .635, .033, .22, "MGMT")], components: [
    part("vent", .382, .294, .111, .60, undefined, "perforated"),
    part("power", .842, .19, .064, .52, "AC", "ac"), part("screw", .060, .82, .010, .08),
  ] };
}

/** Trace the MS225-48FP's two 24-port copper banks and four single-row 10G uplinks. */
function front225(device) {
  const ports = Array.from({ length: 48 }, (_, index) => socket(device, index + 1,
    (index < 24 ? .0945 : .4626) + Math.floor(index % 24 / 2) * .0288,
    index % 2 ? .683 : .366, .025, .22, String(index + 1)));
  for (const [index, x] of [.8275, .857, .8857, .9154].entries()) ports.push(socket(device, index + 49, x, .695, .028, .19, String(index + 49)));
  return { ports, components: [part("text", .884, .24, .058, .21, "CISCO"),
    part("led", .063, .31, .005, .045), part("led", .063, .58, .005, .045),
    part("button", .060, .75, .009, .08, undefined, "reset")] };
}

/** Trace the MS225 rear's QSFP stack pair, 22-contact RPS fitting and fixed internal cooling/power. */
function rear225(device) {
  return { ports: [socket(device, 53, .177, .709, .040, .19, "STACK 1", "qsfp"),
    socket(device, 54, .220, .709, .040, .19, "STACK 2", "qsfp"),
    socket(device, 55, .099, .663, .032, .22, "MGMT")], components: [
    part("vent", .3746, .209, .110, .593, undefined, "perforated"),
    { ...part("power", .655, .43, .184, .43, "RPS 22-PIN", "dc-multipin"), columns: 11 },
    part("power", .875, .17, .060, .47, "AC", "ac"),
    part("screw", .248, .85, .010, .08), part("screw", .010, .85, .010, .08),
  ] };
}
