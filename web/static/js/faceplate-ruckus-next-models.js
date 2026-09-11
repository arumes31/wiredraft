import { canonicalFaceplateDevice } from "./faceplate-profile.js";
import { buildRuckusModelFaceplate } from "./faceplate-ruckus-models.js";

const definitions = new Map([
  ["ICX 7450 family", { sku: "ICX7450-48P", management: 55,
    source: "https://fohdeesha.com/data/other/brocade/icx7450-installguide.pdf", pages: "PDF16 front Figure5; PDF17 rear Figure7; PDF18–19 numbering Figures10/12",
    configuration: "ICX7450-48P with ICX7400-4X10GF in front slot2, two ICX7400-1X40GQ modules in rear slots3/4, two RPS16-E1000W AC supplies and two ICX-FAN10-E fan trays, port-side intake and power-supply-side exhaust. 48 Gigabit PoE access ports, four10G SFP+ and two40G QSFP+ data/stacking cages; front Gigabit management and Mini-USB console." }],
  ["ICX 7550 family", { sku: "ICX7550-48ZP", management: 54,
    source: "https://storage.googleapis.com/habitech_product_information/Ruckus/Manuals/icx7550-installguide.pdf", pages: "PDF17 front Figure6; PDF20 rear Figure12; PDF22 Table9 and PDF112 Figure84 modules",
    configuration: "ICX7550-48ZP with ICX7650-1X100GQ single 100G expansion module in slot3, two fixed 100G QSFP28 ports in slot2, dual RPS22-E 1200W AC supplies at 180–240VAC and three ICX-FAN12-E front-to-back fan trays. 36 ports up to 2.5G and 12 ports up to 10G; front USB-C console, rear RJ45 console and management. External clock input and USB storage are noninteractive hardware." }],
]);
const profiles = new Map(), allocations = new WeakMap();

/** Resolve only the two explicitly selected family configurations without mutating saved inventories or allocations. */
export function resolveRuckusNextFaceplate(device) {
  const definition = definitions.get(device?.model);
  if (device?.faceplate?.vendor !== "Ruckus" || !definition) return null;
  if (!profiles.has(device.model)) {
    const canonical = canonicalFaceplateDevice(device);
    if (!canonical) return null;
    const is7550 = device.model === "ICX 7550 family";
    const portIndexMap = { 59: definition.management };
    if (is7550) for (let index = 1; index <= 36; index++) portIndexMap[index] = index;
    profiles.set(device.model, { id: `ruckus-${definition.sku.toLowerCase()}-family-selection`, family: device.model,
      sku: definition.sku, defaultFace: "front", fidelity: "model", panelFidelity: { front: "model", rear: "model" },
      inventoryRevision: 1, inventoryComplete: true, rearHardwareVerified: true,
      source: definition.source, sourcePage: definition.pages,
      evidence: { scope: "model", models: [definition.sku], selectedModel: definition.sku, catalogAlias: device.model,
        front: `${definition.source}#page=${is7550 ? 17 : 16}`, rear: `${definition.source}#page=${is7550 ? 20 : 17}`,
        configuration: definition.configuration },
      note: `${device.model} explicitly selects ${definition.configuration}`,
      limitations: [definition.configuration,
        "Manufacturer-authored drawings were personally inspected through disclosed public PDF mirrors because publisher downloads require sign-in. Tiny silkscreen, grille perforations and status lenses are simplified projections.",
        "The normalized-width scene contract preserves the native1U body within edited rack allocations at each display width; it does not claim isotropic scaling between460 and690 pixels."],
      catalogDiscrepancies: ["The independently executed original checkpoint438 constructor has59 endpoints in1U:48 RJ45_MGIG2500, eight SFP28_25G25000, Stack57/58 and management59 after zone sorting. Stored IDs, labels, types, speeds, PoE, VLANs, cables and rack allocation remain unchanged.",
        is7550 ? "Revision zero maps only compatible copper1–36 and management59→54. Copper37–48, 25G and Stack placeholders remain unmapped." : "Revision zero maps only management59→55. Multi-gigabit,25G and Stack placeholders remain unmapped.",
        "Unclaimed selected physical sockets remain noninteractive ancillary art, with no added logical endpoints. Unknown revisions never infer mappings."],
      legacyLayouts: [{ inventoryRevision: 0, portIndexMap,
        portLabels: Object.fromEntries([...Array.from({ length: 56 }, (_, index) => [index + 1, String(index + 1)]), [57, "STACK1"], [58, "STACK2"], [59, "MGMT"]]) }],
      chassis: { x: 0, y: .05, width: 1, height: .9 },
      faces: is7550 ? exact7550Panels(canonical.device.ports) : panels7450(canonical.device.ports) });
  }
  return fitAllocation(profiles.get(device.model), device);
}

/** Retain native one-unit body dimensions when a saved device occupies additional rack units. */
function fitAllocation(profile, device) {
  const units = Math.max(1, Number(device.faceplate.unitsU) || 1);
  if (units === 1) return profile;
  if (!allocations.has(profile)) allocations.set(profile, new Map());
  const cache = allocations.get(profile);
  if (!cache.has(units)) cache.set(units, { ...profile, chassis: { ...profile.chassis, y: .05 / units, height: .9 / units } });
  return cache.get(units);
}

/** Reuse the exact matching7550 SKU and module geometry while discarding compatibility allowances for unrelated old exact inventories. */
function exact7550Panels(ports) {
  const exact = buildRuckusModelFaceplate(canonicalFaceplateDevice({ model: "ICX 7550-48ZP", faceplate: { vendor: "Ruckus" } }).device);
  return Object.fromEntries(Object.entries(exact.faces).map(([face, panel]) => [face, { ...panel,
    components: panel.components.map((component) => ({ ...component })),
    ports: panel.ports.map(({ compatibleTypes, ...slot }) => ({ ...slot,
      type: ports.find((port) => port.portIndex === slot.portIndex).type,
      label: ports.find((port) => port.portIndex === slot.portIndex).label,
      descriptionAnchor: caption7550(slot) })) }]));
}

/** Supply complete finite anchors for formerly automatic7550 captions, retaining two-digit access labels at460px. */
function caption7550(slot) {
  const index = slot.portIndex;
  const y = index <= 48 ? (index % 2 ? .580 : .950) : index === 49 ? .890 : index === 50 ? .550 : .950;
  return { x: slot.x, y, ...slot.descriptionAnchor, fontSize: 5.5, boxHeight: 7,
    boxWidth: index >= 52 ? .068 : index <= 48 ? .030 : .058 };
}

/** Describe a personally observed noninteractive chassis part in normalized coordinates. */
function part(kind, x, y, width, height, role, variant, extra = {}) {
  return { kind, x, y, width, height, role, ...(variant ? { variant } : {}), ...extra };
}

/** Bind one selected physical aperture and bounded caption to its canonical endpoint. */
function socket(ports, index, x, y, width, height, connectorKind, physicalLabel, captionY) {
  const port = ports.find((entry) => entry.portIndex === index);
  return { portIndex: index, type: port.type, label: port.label, physicalLabel, x, y, width, height, connectorKind,
    descriptionAnchor: { x, y: captionY, fontSize: 5.5, boxHeight: 7, boxWidth: index <= 48 ? .030 : index >= 55 ? .060 : width } };
}

/** Trace the48P front with four-port optical module and the distinct rear fan/module/PSU order from Figures5/7/12. */
function panels7450(ports) {
  const front = [], rear = [];
  for (let index = 0; index < 48; index++) front.push(socket(ports, index + 1,
    .086 + Math.floor(index / 12) * .202 + Math.floor(index % 12 / 2) * .032,
    index % 2 ? .690 : .335, .027, .235, index % 2 ? "rj45-inverted" : "rj45", String(index + 1), index % 2 ? .910 : .512));
  for (let index = 0; index < 4; index++) front.push(socket(ports, index + 49, .921 + Math.floor(index / 2) * .031,
    index % 2 ? .690 : .335, .028, .235, "sfp", String(index + 1), index % 2 ? .910 : .512));
  front.push(socket(ports, 55, .036, .415, .032, .25, "rj45", "MGMT", .190),
    socket(ports, 56, .036, .870, .024, .105, "usb-mini", "CON", 1.025));
  rear.push(socket(ports, 53, .293, .680, .047, .23, "qsfp", "3/1", .420),
    socket(ports, 54, .194, .680, .047, .23, "qsfp", "4/1", .420));
  const rearParts = [part("fan", .020, .045, .105, .91, "fan2", "ruckus-7450-fan", { model: "ICX-FAN10-E" }),
    part("fan", .356, .045, .105, .91, "fan1", "ruckus-7450-fan", { model: "ICX-FAN10-E" }),
    part("psu", .491, .045, .247, .91, "psu2", "ruckus-7450-psu", { model: "RPS16-E", watts: 1000 }),
    part("psu", .748, .045, .247, .91, "psu1", "ruckus-7450-psu", { model: "RPS16-E", watts: 1000 }),
    part("screw", .003, .580, .014, .12, "ground-terminal")];
  for (const x of [.145, .244]) rearParts.push(
    part("panel-accent", x, .060, .085, .24, "40G-module-upper", "ruckus-7450-module-upper", { model: "ICX7400-1X40GQ" }),
    part("handle", x + .017, .860, .062, .085, "40G-module-pull", "ruckus-7450-handle"),
    part("panel-accent", x + .088, .310, .007, .49, "40G-module-latch", "ruckus-7450-handle"));
  return { front: { ports: front, components: [
    part("usb", .019, .620, .034, .12, "storage"), part("button", .057, .850, .007, .05, "reset", "reset"),
    part("status-panel", .070, .020, .12, .12, "status", "ruckus-7450-status"),
    part("vent", .197, .020, .677, .10, "top-grille", "ruckus-7450-grille"),
    part("handle", .977, .080, .012, .83, "front-module-latch", "ruckus-7450-handle"),
    part("panel-accent", .073, .154, .127, .026, "high-poe-upper", "ruckus-7450-poe"),
  ] }, rear: { ports: rear, components: rearParts } };
}
