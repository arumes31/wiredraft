import { canonicalFaceplateDevice } from "./faceplate-profile.js";

const source = "https://www.se.com/us/en/download/document/SPD_MMIS-8HUQTU_EN/";
const cardSource = "https://iportal2.schneider-electric.com/Contents/docs/UPS%20NETWORK%20MANAGEMENT%20CARD%203_USER%20GUIDE.PDF";
const cache = new Map();

/** Resolve the photographed 230V SMT1500RMI2U with an explicitly installed AP9641 NMC3. */
export function resolveAPCFaceplate(device) {
  if (device?.faceplate?.vendor !== "APC" || device.model !== "Smart-UPS Network family") return null;
  const canonical = canonicalFaceplateDevice(device);
  if (!canonical) return null;
  if (!cache.has(canonical.catalog)) cache.set(canonical.catalog, { profile: buildProfile(canonical.device), allocations: new Map() });
  const cached = cache.get(canonical.catalog), units = Math.max(1, Number(device.faceplate.unitsU) || 2);
  if (units === 2) return cached.profile;
  if (!cached.allocations.has(units)) {
    const scale = Math.min(1, units / 2), bodyHeight = 132 * scale;
    const rawHeight = bodyHeight < 64 ? bodyHeight / .8 : bodyHeight + 16;
    cached.allocations.set(units, { ...cached.profile, chassis: { x: (1 - .95 * scale) / 2, y: .1 * Math.min(1, 2 / units),
      width: .95 * scale, height: rawHeight / (units * 100) } });
  }
  return cached.allocations.get(units);
}

/** Record selected hardware and retain historical NMC1/AC1 identities independently of editable labels. */
function buildProfile(device) {
  const configuration = "SMT1500RMI2U 230V 1500VA rack UPS, factory front bezel installed, four IEC C13 outlets and one C14 input, with AP9641 Network Management Card 3 installed in the SmartSlot.";
  return { id: "apc-smt1500rmi2u-ap9641", sku: "SMT1500RMI2U + AP9641", fidelity: "model",
    panelFidelity: { front: "model", rear: "model" }, defaultFace: "rear", inventoryRevision: 1, inventoryComplete: true,
    source, sourcePage: "Installation PDF pages 7–8, 750/1000/1500VA 230V rear; AP9641 guide PDF page 14",
    evidence: { scope: "model", models: [device.model, "SMT1500RMI2U", "AP9641"], configuration,
      front: "https://download.se.com/files?p_Doc_Ref=APC-SLIE-8ADPUB_00&p_File_Type=rendition_369_jpg",
      rear: "https://download.se.com/files?p_Doc_Ref=SPD_SLIE-89ZJME_B_H&p_File_Type=rendition_369_jpg",
      card: `${cardSource}#page=14`, inventory: source },
    note: configuration,
    legacyLayouts: [{ inventoryRevision: 0, portIndexMap: { 1: 1, 2: 2 }, portLabels: { 1: "NMC1", 2: "AC1" } }],
    catalogDiscrepancies: ["NMC1 and AC1 retain their original endpoint identities. UPS serial and NMC Micro-USB console are added only to new devices."],
    limitations: [configuration, "Four output receptacles and two NMC Universal I/O sensor sockets are ancillary artwork; power distribution and environmental-sensor wiring are not simulated.",
      "The existing Power endpoint denotes the UPS input. USB-B monitoring and NMC USB-A storage sockets are ancillary; they are not serial-console endpoints.",
      "The selected historical SMT model does not have the later SmartConnect Ethernet port. Indicators and LCD are shown inactive."],
    chassis: { x: .025, y: .1, width: .95, height: .74 }, faces: { front: frontPanel(), rear: rearPanel(device.ports) } };
}

/** Describe static hardware with explicit source roles and no simulated operating state. */
function part(kind, x, y, width, height, role, variant) {
  return { kind, x, y, width, height, role, active: false, ...(kind === "panel-accent" ? { color: "#7b898e", taper: 0 } : {}), ...(variant ? { variant } : {}) };
}

/** Bind a canonical endpoint with a separate caption in clear panel space. */
function socket(port, x, y, width, height, label, captionY, connectorKind) {
  return { portIndex: port.portIndex, type: port.type, label: port.label, x, y, width, height, physicalLabel: label,
    connectorKind, descriptionAnchor: { x, y: captionY, fontSize: 5.5, boxHeight: 7 } };
}

/** Trace the long horizontal front grille and the compact right-hand status/LCD/keypad assembly. */
function frontPanel() {
  const components = [part("panel", .03, .08, .94, .84, "front-bezel", "apc-smt-bezel"),
    part("panel", .765, .16, .15, .69, "display-control", "apc-smt-display")];
  return { ports: [], components };
}

/** Place the SmartSlot, monitoring interfaces, C14 input, four C13 outputs and single fixed rear fan. */
function rearPanel(ports) {
  const components = [part("panel-accent", .032, .06, .285, .018, "smartslot-top"), part("panel-accent", .032, .52, .285, .018, "smartslot-bottom"),
    part("panel-accent", .032, .06, .008, .478, "smartslot-left"), part("panel-accent", .309, .06, .008, .478, "smartslot-right"),
    part("usb", .063, .205, .042, .09, "nmc-usb-storage"), part("usb", .063, .355, .042, .09, "nmc-usb-storage"),
    part("rj45", .121, .23, .037, .18, "environmental-io"), part("rj45", .168, .23, .037, .18, "environmental-io"),
    part("button", .297, .44, .006, .025, "nmc-reset"), part("button", .449, .43, .036, .19, "input-breaker", "apc-breaker"),
    part("panel", .38, .83, .026, .12, "ups-usb-monitor", "apc-usb-b"),
    part("screw", .79, .68, .015, .07, "chassis-ground"), part("fan", .825, .12, .155, .78, "rear-fan", "apc-smt-fan")];
  for (let i = 0; i < 4; i++) components.push(part("power", .507 + i * .064, .37, .057, .37, "c13-output", "apc-c13"));
  return { components, ports: [socket(ports[0], .271, .335, .038, .18, "NMC", .17, "rj45-inverted"),
    socket(ports[1], .404, .55, .058, .25, "AC IN", .32, "apc-c14"),
    socket(ports[2], .352, .89, .03, .12, "SERIAL", .72, "console"),
    socket(ports[3], .231, .425, .023, .06, "NMC CLI", .61, "usb-micro")] };
}
