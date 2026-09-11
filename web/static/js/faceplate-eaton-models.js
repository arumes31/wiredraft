import { canonicalFaceplateDevice } from "./faceplate-profile.js";

const source = "https://www.eaton.com/content/dam/eaton/products/backup-power-ups-surge-it-power-distribution/backup-power-ups/eaton-5px-g2-ups/eaton-5px-g2-ups-emea/eaton-5px-g2-ups-emea-resources/eaton-5pxgen2-advanceduserguide-guide-en-gb.pdf";
const cardSource = "https://www.eaton.com/content/dam/eaton/products/backup-power-ups-surge-it-power-distribution/power-management-software-connectivity/eaton-gigabit-network-card/eaton-network-m2-user-guide.pdf";
const cache = new Map();

/** Resolve the selected 1500VA Gen2 installation while fitting its body inside existing rack allocations. */
export function resolveEatonFaceplate(device) {
  if (device?.faceplate?.vendor !== "Eaton" || device.model !== "Network UPS family") return null;
  const canonical = canonicalFaceplateDevice(device);
  if (!canonical) return null;
  if (!cache.has(canonical.catalog)) cache.set(canonical.catalog, { profile: buildProfile(canonical.device), allocations: new Map() });
  const cached = cache.get(canonical.catalog), units = Math.max(1, Number(device.faceplate.unitsU) || 2);
  if (units === 2) return cached.profile;
  if (!cached.allocations.has(units)) {
    const scale = Math.min(1, units / 2), body = 128 * scale;
    const rawHeight = body < 64 ? body / .8 : body + 16;
    cached.allocations.set(units, { ...cached.profile, chassis: { x: (1 - .95 * scale) / 2, y: .08 * Math.min(1, 2 / units), width: .95 * scale, height: rawHeight / (units * 100) } });
  }
  return cached.allocations.get(units);
}

/** Disclose the installed card and explicit revision-zero endpoint correspondence without changing saved data. */
function buildProfile(device) {
  const configuration = "Eaton 5PX1500IRT2UG2, 230V 1500VA/1500W, rack 2U, standard battery bezel installed, eight C13 outputs and one C14 input; NETWORK-M2 card explicitly installed in the MiniSlot, no external battery module or environmental sensor.";
  return { id: "eaton-5px1500irt2ug2-network-m2", sku: "5PX1500IRT2UG2 + NETWORK-M2", fidelity: "model", defaultFace: "rear",
    panelFidelity: { front: "model", rear: "model" }, inventoryRevision: 1, inventoryComplete: true, rearHardwareVerified: true,
    source, sourcePage: "PDF7 rack front,8 exact1000/1500 rear,16 control panel; Network-M2 PDF16 card and serial-over-USB",
    evidence: { scope: "model", models: [device.model], sku: "5PX1500IRT2UG2", configuration, front: `${source}#page=7`, rear: `${source}#page=8`, card: `${cardSource}#page=16` },
    note: configuration,
    legacyLayouts: [{ inventoryRevision: 0, portIndexMap: { 1: 1, 2: 2 }, portLabels: { 1: "NETWORK1", 2: "AC1" } }],
    catalogDiscrepancies: ["Original NETWORK1/AC1 IDs, types, speeds, labels, settings and cables remain unchanged. UPS RS232 and card Micro-B CLI endpoints are added only to new instances."],
    limitations: [configuration, "The base SKU excludes a network card; this drawing selects an installed NETWORK-M2, not a claim about the newest card or every Netpack revision.",
      "HID USB-B, card sensor USB-A, dry contacts, battery detection/expansion and eight outputs are ancillary artwork. The Power endpoint represents the input; electrical distribution and battery wiring are not simulated.",
      "The M2 Settings Micro-B supports both serial CLI and RNDIS; it is modeled as the supported serial endpoint. Small printing and perforations are simplified; indicators and LCD are inactive."],
    chassis: { x: .025, y: .08, width: .95, height: .72 }, faces: { front: frontPanel(), rear: rearPanel(device.ports) } };
}

/** Describe an observed ancillary part in normalized chassis coordinates with inactive indicators. */
function part(kind, x, y, width, height, role, variant) {
  return { kind, x, y, width, height, role, active: false, ...(variant ? { variant } : {}) };
}

/** Bind one canonical endpoint and a capped caption in an independently reserved area. */
function socket(port, x, y, width, height, physicalLabel, captionX, captionY, boxWidth, connectorKind) {
  return { portIndex: port.portIndex, label: port.label, type: port.type, x, y, width, height, physicalLabel, connectorKind,
    descriptionAnchor: { x: captionX, y: captionY, fontSize: 5.5, boxHeight: 7, boxWidth } };
}

/** Trace the silver perforated battery bezel and right-hand LCD with its five-button row. */
function frontPanel() {
  return { ports: [], components: [part("panel", .018, .04, .964, .92, "front-bezel", "eaton-bezel"),
    part("panel", .795, .17, .155, .68, "display-control", "eaton-display")] };
}

/** Trace the exact 1500 rear, including its vertical card, monitoring stack and two rows of four outlets. */
function rearPanel(ports) {
  const components = [part("vent", .13, .08, .215, .82, "rear-exhaust", "eaton-mesh"),
    part("panel", .363, .07, .081, .007, "card-top", "eaton-strip"), part("panel", .363, .85, .081, .007, "card-bottom", "eaton-strip"),
    part("panel", .363, .07, .002, .78, "card-left", "eaton-strip"), part("panel", .442, .07, .002, .78, "card-right", "eaton-strip"),
    part("usb", .393, .40, .037, .05, "m2-sensor-usb", "eaton-usb-a"), part("button", .398, .54, .009, .045, "m2-reset", "eaton-button"),
    part("led", .387, .59, .005, .024, "m2-status", "square"), part("led", .415, .59, .005, .024, "m2-link", "square"),
    part("panel", .463, .13, .023, .22, "roo-rpo", "eaton-terminal"), part("panel", .463, .70, .023, .22, "relay-output", "eaton-terminal"),
    part("rj45", .458, .43, .030, .17, "battery-detection"), part("panel", .502, .20, .024, .15, "hid-usb-monitor", "eaton-usb-b"),
    part("panel", .553, .25, .055, .50, "battery-expansion", "eaton-battery"), part("screw", .574, .82, .014, .07, "ground"),
    part("panel", .633, .03, .002, .93, "output-divider", "eaton-strip")];
  for (let row = 0; row < 2; row++) for (let col = 0; col < 4; col++) components.push(part("power", .695 + col * .055, .10 + row * .43, .050, .35, "c13-output", "eaton-c13"));
  return { components, ports: [socket(ports[0], .412, .285, .029, .16, "NET", .410, .135, .06, "eaton-rj45"),
    socket(ports[1], .060, .55, .059, .46, "AC IN", .06, .20, .08, "eaton-c14"),
    socket(ports[2], .514, .53, .023, .28, "RS232", .52, .84, .050, "eaton-db9"),
    socket(ports[3], .391, .73, .012, .09, "CLI", .40, .94, .06, "eaton-micro")] };
}
