import { canonicalFaceplateDevice } from "./faceplate-profile.js";
import { buildRuckusModelFaceplate } from "./faceplate-ruckus-models.js";

const guide7150 = "https://www.manualslib.com/manual/1370056/Ruckus-Wireless-Icx-7150-C12p.html";
const guide7250 = "https://www.manualslib.com/manual/1556197/Ruckus-Wireless-Icx-7250.html";
const definitions = new Map([
  ["ICX 7150 family", { sku: "ICX7150-48P-4X10GR", guide: guide7150, front: 16, rear: 18, management: 57,
    configuration: "ICX7150-48P-4X10GR, 48 PoE+ Gigabit access ports, two non-PoE Gigabit copper uplinks, four licensed 10G SFP+ ports, fixed internal 525W AC supply, 370W PoE budget and two fixed fans. Rear RJ45 console; front USB-C console and Ethernet management." }],
  ["ICX 7250 family", { sku: "ICX7250-48", guide: guide7250, front: 14, rear: 14, management: 57,
    configuration: "ICX7250-48 with ICX7250-2X10G-LIC-POD followed by ICX7250-8X10G-LIC-POD licenses, 48 non-PoE Gigabit copper ports, eight licensed 10G SFP+ uplink/stacking cages, fixed internal 100W AC supply and two fixed fans with sides-to-back airflow. EPS4000 is absent and its rear connector remains covered. Front Ethernet management and Mini-USB console." }],
]);
const profiles = new Map(), allocations = new WeakMap();

/** Resolve only the two disclosed Ruckus family selections using immutable canonical connector inventories. */
export function resolveRuckusFamilyFaceplate(device) {
  const definition = definitions.get(device?.model);
  if (device?.faceplate?.vendor !== "Ruckus" || !definition) return null;
  if (!profiles.has(device.model)) {
    const canonical = canonicalFaceplateDevice(device);
    if (!canonical) return null;
    const faces = device.model === "ICX 7150 family" ? exact7150Panels(canonical.device.ports) : panels7250(canonical.device.ports);
    profiles.set(device.model, { id: `ruckus-${definition.sku.toLowerCase()}-family-selection`, family: device.model,
      sku: definition.sku, defaultFace: "front", fidelity: "model", panelFidelity: { front: "model", rear: "model" },
      inventoryRevision: 1, inventoryComplete: true, rearHardwareVerified: true,
      source: definition.guide, sourcePage: `Manufacturer guide front page ${definition.front}, rear page ${definition.rear}`,
      evidence: { scope: "model", models: [definition.sku], selectedModel: definition.sku, catalogAlias: device.model,
        front: `${definition.guide}?page=${definition.front}`, rear: `${definition.guide}?page=${definition.rear}`,
        publisher: `https://support.ruckuswireless.com/documents/${device.model.includes("7150") ? "1397-ruckus-icx-7150" : "1223-ruckus-icx-7250"}-switch-hardware-installation-guide`,
        configuration: definition.configuration },
      note: `${device.model} explicitly selects ${definition.configuration}`,
      limitations: [definition.configuration,
        "Manufacturer-authored diagrams were personally inspected through a public guide mirror; the publisher PDF requires sign-in and the former HTML portal redirects to its replacement landing page.",
        "Fan grilles, tiny markings and status lenses are simplified front/rear projections. Fixed internal supplies are not removable PSU trays. USB storage is ancillary hardware; no separate logical stacking sockets are invented.",
        "The normalized-width scene contract preserves the native body inside edited rack allocations at each display width; it does not claim isotropic scaling between 460 and 690 pixels."],
      catalogDiscrepancies: ["The actual original family constructor had 59 endpoints in 1U: 48 RJ45_MGIG at 2500 Mbps, eight SFP28 at 25G, Stack endpoints 57/58 and management 59 after constructor zone sorting. All saved IDs, labels, types, speeds, PoE settings, cables and rack allocation remain unchanged.",
        "Revision zero maps only management 59 to selected management 57. Unsupported multi-gigabit, 25G and dedicated Stack endpoints remain unmapped. Their selected physical replacements are noninteractive ancillary artwork, not newly added logical endpoints. Unknown revisions never infer a mapping."],
      legacyLayouts: [{ inventoryRevision: 0, portIndexMap: { 59: definition.management },
        portLabels: Object.fromEntries([...Array.from({ length: 56 }, (_, index) => [index + 1, String(index + 1)]), [57, "STACK1"], [58, "STACK2"], [59, "MGMT"]]) }],
      chassis: { x: 0, y: .05, width: 1, height: .9 }, faces });
  }
  return fitAllocation(profiles.get(device.model), device);
}

/** Retain the native one-unit body when a saved device occupies a larger rack allocation. */
function fitAllocation(profile, device) {
  const units = Math.max(1, Number(device.faceplate.unitsU) || 1);
  if (units === 1) return profile;
  if (!allocations.has(profile)) allocations.set(profile, new Map());
  const cache = allocations.get(profile);
  if (!cache.has(units)) cache.set(units, { ...profile, chassis: { ...profile.chassis, y: .05 / units, height: .9 / units } });
  return cache.get(units);
}

/** Reuse the individually traced 7150-48P source geometry while rebinding canonical labels and reserving narrow captions. */
function exact7150Panels(ports) {
  const exactDevice = canonicalFaceplateDevice({ model: "ICX 7150-48P", faceplate: { vendor: "Ruckus" } }).device;
  const exact = buildRuckusModelFaceplate(exactDevice);
  return Object.fromEntries(Object.entries(exact.faces).map(([face, panel]) => [face, { ...panel,
    components: panel.components.map((component) => ({ ...component })),
    ports: panel.ports.map((slot) => ({ ...slot, label: ports.find((port) => port.portIndex === slot.portIndex).label,
      descriptionAnchor: { ...slot.descriptionAnchor, boxWidth: slot.width } })) }]));
}

/** Place a source-observed noninteractive chassis component. */
function part(kind, x, y, width, height, role, variant) {
  return { kind, x, y, width, height, role, ...(variant ? { variant } : {}) };
}

/** Bind one physical connector to an immutable canonical endpoint with a bounded caption strip. */
function socket(ports, index, x, y, width, height, connectorKind, label, captionY) {
  const port = ports.find((entry) => entry.portIndex === index);
  return { portIndex: index, type: port.type, label: port.label, physicalLabel: label, x, y, width, height, connectorKind,
    descriptionAnchor: { x, y: captionY, fontSize: 5.5, boxHeight: 7, boxWidth: width } };
}

/** Trace the annotated 48-port front and exact non-PoE 7250-48 rear with its closed EPS connector. */
function panels7250(ports) {
  const sockets = [];
  for (let index = 0; index < 48; index++) {
    const x = .079 + Math.floor(index / 12) * .198 + Math.floor(index % 12 / 2) * .032;
    sockets.push(socket(ports, index + 1, x, index % 2 ? .715 : .365, .026, .235,
      index % 2 ? "rj45-inverted" : "rj45", String(index + 1), index % 2 ? .925 : .540));
  }
  for (let index = 0; index < 8; index++) sockets.push(socket(ports, index + 49, .885 + Math.floor(index / 2) * .031,
    index % 2 ? .715 : .365, .027, .235, "sfp", String(index + 1), index % 2 ? .925 : .540));
  sockets.push(socket(ports, 57, .033, .475, .032, .275, "rj45", "MGMT", .950),
    socket(ports, 58, .038, .160, .023, .115, "usb-mini", "CON", -.035));
  return { front: { ports: sockets, components: [
    part("usb", .017, .720, .032, .135, "storage"), part("button", .008, .180, .008, .05, "reset", "reset"),
    part("status-panel", .062, .055, .17, .15, "system-indicators", "ruckus-7250-status"),
    part("vent", .867, .055, .122, .12, "optical-grille", "ruckus-7250-grille"),
  ] }, rear: { ports: [], components: [
    part("fan", .029, .075, .080, .85, "fixed-fan-1", "ruckus-7250-fixed-fan"),
    part("fan", .133, .075, .080, .85, "fixed-fan-2", "ruckus-7250-fixed-fan"),
    part("module-bay", .359, .400, .108, .48, "covered-eps-input", "ruckus-7250-eps-cover"),
    part("power", .908, .145, .078, .60, "fixed-100W-ac-input"),
    ...[.008, .470, .976].map((x) => part("screw", x, .785, .016, .13, "rear-retaining-screw")),
  ] } };
}
