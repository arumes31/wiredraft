import { canonicalFaceplateDevice } from "./faceplate-profile.js";

const sourceRoot = "https://documentation.extremenetworks.com/";
const definitions = new Map([
  ["X440-G2", { sku: "X440-G2-48p-10GE4", management: 53, bodyWidth: 441.5,
    source: `${sourceRoot}ExtremeSwitching%20Installation%20Guide%20for%20Switches%20Using%20ExtremeXOS%20Version%2030/Wired_Hardware/ExtremeSwitching_Installation_Guide_for_Switches_Using_ExtremeXOS_Version_30/topics/extremeswitching_x440-g2-48p-10ge4_switch_ports_and_slots.shtml`,
    configuration: "X440-G2-48p-10GE4 (16535), fixed internal AC supply and cooling, no external redundant supply. Four rear SFP+ ports49–52 select licensed10G Ethernet with stacking disabled. Front copper45–48 and rear optical51/52 are the selected halves of combination interfaces. Four front SFP alternatives and two rear copper alternatives remain visible noninteractive art, not additional independent endpoints." }],
  ["X450-G2", { sku: "X450-G2-48p-10GE4", management: 55, bodyWidth: 441,
    source: `${sourceRoot}summit/GUID-F0DFA320-37AE-4E53-ACA5-3FA03007B623.shtml`,
    configuration: "X450-G2-48p-10GE4 with installed10945 front-to-back three-fan module, one10951 715W AC-FB supply at right and left PSU cover. Front48Gigabit PoE+ and four10G SFP+ Ethernet ports, rear dedicated21Gb QSFP-shaped SummitStack-V84 ports1/2. No optics or external power system. One715W supply does not imply full48-port30W PoE capacity." }],
  ["X460-G2", { sku: "X460-G2-48p-10GE4", management: 53, bodyWidth: 441,
    source: `${sourceRoot}summit/GUID-3BFF8039-D60F-4451-A199-D99B22DA0E7E.shtml`,
    configuration: "X460-G2-48p-10GE4 (16704) with installed10945 front-to-back three-fan module, one10951 715W AC-FB supply at right and left PSU cover. VIM and TM-CLK slots covered; no optional cards or optics. Front48Gigabit PoE+ and four10G SFP+ ports select Ethernet mode. One715W supply does not imply full48-port30W PoE capacity." }],
]);
const profiles = new Map(), allocations = new WeakMap();

/** Resolve the three documented G2 configurations from canonical identities while fitting the actual saved rack allocation. */
export function resolveExtremeG2Faceplate(device) {
  const definition = definitions.get(device?.model);
  if (!definition || device?.faceplate?.vendor !== "Extreme") return null;
  if (!profiles.has(device.model)) {
    const canonical = canonicalFaceplateDevice(device);
    if (!canonical) return null;
    const portIndexMap = { 59: definition.management };
    if (device.model === "X450-G2") Object.assign(portIndexMap, { 57: 53, 58: 54 });
    // The shared scene reserves20% for identity when the normalized frame is less than80px high.
    const height = (460 * 44 / definition.bodyWidth) / .8 / 100;
    profiles.set(device.model, { id: `extreme-${definition.sku.toLowerCase()}-selection`, family: device.model, sku: definition.sku,
      fidelity: "model", defaultFace: "front", panelFidelity: { front: "model", rear: "model" },
      inventoryRevision: 1, inventoryComplete: true, rearHardwareVerified: true, source: definition.source,
      sourcePage: "Exact model front/rear illustrations; 10945 fan and10951 supply support/specifications",
      evidence: { scope: "model", models: [definition.sku], selectedModel: definition.sku, catalogAlias: device.model,
        front: definition.source, rear: definition.source, configuration: definition.configuration },
      note: `${device.model} explicitly selects ${definition.configuration}`,
      limitations: [definition.configuration,
        "Installed with the supplied19in mounting brackets. Side brackets, internal cooling and other hidden faces are not projected as invented front/rear components. Source perforations, status lenses and silkscreen are simplified.",
        "The44mm chassis height and source body width set the native aspect at460px. The existing normalized-width contract widens the body at690 without increasing its height; this is not isotropic scaling between display widths. Saved rack units remain unchanged.",
        "Management and console are separate front RJ45 sockets. USB-A storage is noninteractive. Power and combination alternatives are physical artwork, not additional logical interfaces."],
      catalogDiscrepancies: ["Independently executed frozen438 constructor:59 endpoints in1U, with1–48RJ45_MGIG2500,49–56SFP28_25G25000,57/58Stack40000 and management59. All saved IDs, labels, types, speeds, PoE, VLANs, links and rack allocation remain unchanged.",
        `Revision zero maps only management59→${definition.management}${device.model === "X450-G2" ? " and dedicated Stack1/2 identities57→53 and58→54. Historical40000Mbps stack settings remain stored, while the selected physical links are21Gb, not standard40Gb Ethernet" : ""}. All maps are type-guarded; unsupported and unknown revisions stay unmapped with noninteractive missing physical sockets.`],
      legacyLayouts: [{ inventoryRevision: 0, portIndexMap, portLabels: Object.fromEntries([
        ...Array.from({ length: 56 }, (_, index) => [index + 1, String(index + 1)]), [57, "STACK1"], [58, "STACK2"], [59, "MGMT"]]) }],
      chassis: { x: 0, y: .10, width: 1, height },
      faces: panels(canonical.device.ports, device.model, definition.management) });
  }
  return fitAllocation(profiles.get(device.model), device);
}

/** Keep the native traced body and identity reservation constant within edited allocations without changing saved units. */
function fitAllocation(profile, device) {
  const units = Math.max(1, Number(device.faceplate.unitsU) || 1);
  if (units === 1) return profile;
  if (!allocations.has(profile)) allocations.set(profile, new Map());
  const cache = allocations.get(profile);
  if (!cache.has(units)) cache.set(units, { ...profile, chassis: { ...profile.chassis, y: profile.chassis.y / units, height: profile.chassis.height / units } });
  return cache.get(units);
}

/** Describe an observed noninteractive surface or a disclosed combination-interface alternative. */
function part(kind, x, y, width, height, role, variant, extra = {}) {
  return { kind, x, y, width, height, role, ...(variant ? { variant } : {}), ...extra };
}

/** Bind a stable canonical endpoint to an aperture and a finite, bounded caption anchor. */
function socket(ports, index, x, y, width, height, kind, captionY, physicalLabel, boxWidth = .030, captionX = x) {
  const port = ports.find((entry) => entry.portIndex === index);
  return { portIndex: index, type: port.type, label: port.label, physicalLabel, connectorKind: kind, x, y, width, height,
    descriptionAnchor: { x: captionX, y: captionY, fontSize: 5.5, boxHeight: 7, boxWidth } };
}

/** Trace the shared family front arrangement with SKU-specific optical sharing and a distinct source rear panel. */
function panels(ports, model, management) {
  const front = [], rear = [], frontParts = [];
  for (let index = 0; index < 48; index++) front.push(socket(ports, index + 1,
    .112 + Math.floor(index / 16) * .271 + Math.floor(index % 16 / 2) * .032,
    index % 2 ? .770 : .300, .027, .25, index % 2 ? "rj45" : "rj45-inverted", index % 2 ? 1.035 : .535, String(index + 1)));
  front.push(socket(ports, management, .067, .300, .030, .25, "rj45-inverted", .535, "MGMT", .053, .065),
    socket(ports, management + 1, .067, .770, .030, .25, "rj45", 1.035, "CON", .067));
  frontParts.push(part("usb", .025, .190, .012, .30, "storage", undefined, { orientation: "vertical" }),
    part("status-panel", .018, .640, .024, .31, "stack-number", "extreme-g2-stack-number"),
    part("status-panel", .012, .040, .071, .075, "status", "extreme-g2-status"),
    part("vent", .107, .045, .780, .060, "upper-perforations", "extreme-g2-grille"));
  for (let index = 0; index < 4; index++) {
    const x = .925 + Math.floor(index / 2) * .040, y = index % 2 ? .770 : .300;
    const kind = index % 2 ? "extreme-sfp-inverted" : "sfp";
    if (model === "X440-G2") frontParts.push(part(kind, x - .015, y - .125, .030, .25,
      `combo-alternative-${45 + index}`, undefined, { comboAlternative: true, sharedWithPortIndex: 45 + index, physicalLabel: String(45 + index) }));
    else front.push(socket(ports, 49 + index, x, y, .030, .25, kind, index % 2 ? 1.035 : .535, String(49 + index), .036));
  }
  if (model === "X440-G2") {
    frontParts.push(part("panel-accent", .831, .125, .148, .022, "shared-combo-upper", "extreme-g2-combo-mark"),
      part("panel-accent", .831, .925, .148, .018, "shared-combo-lower", "extreme-g2-combo-mark"));
    for (let index = 0; index < 4; index++) rear.push(socket(ports, 49 + index, .192 + Math.floor(index / 2) * .039,
      index % 2 ? .770 : .300, .033, .25, index % 2 ? "extreme-sfp-inverted" : "sfp", index % 2 ? 1.035 : .535, String(49 + index), .037));
    return { front: { ports: front, components: frontParts }, rear: { ports: rear, components: [
      part("rj45-inverted", .264, .175, .031, .25, "combo-alternative-51", undefined, { comboAlternative: true, sharedWithPortIndex: 51, physicalLabel: "51" }),
      part("rj45", .264, .645, .031, .25, "combo-alternative-52", undefined, { comboAlternative: true, sharedWithPortIndex: 52, physicalLabel: "52" }),
      part("power", .420, .150, .075, .66, "fixed-ac-inlet", "extreme-g2-c14", { model: "fixed internal AC" }),
      part("power", .752, .360, .137, .50, "redundant-power-input", "extreme-g2-rps", { installedExternalSupply: false }),
      part("screw", .954, .570, .020, .31, "ground-lug"),
      part("vent", .311, .080, .031, .78, "rear-perforations", "extreme-g2-grille"),
      part("panel-accent", .213, .125, .085, .022, "shared-combo-upper", "extreme-g2-combo-mark"),
      part("panel-accent", .213, .925, .085, .018, "shared-combo-lower", "extreme-g2-combo-mark"),
    ] } };
  }
  const rearParts = [
    part("fan", .300, .040, .285, .91, "fan-module", "extreme-g2-fan10945", { model: "10945", rotors: 3, airflow: "front-to-back" }),
    part("module-bay", .591, .045, .188, .90, "psu-left-cover", "extreme-g2-cover"),
    part("psu", .789, .040, .205, .91, "psu-right", "extreme-g2-psu10951", { model: "10951", watts: 715, airflow: "front-to-back", inlet: "IEC C16" }),
  ];
  if (model === "X450-G2") {
    rear.push(socket(ports, 53, .070, .300, .044, .24, "qsfp", .535, "STACK1", .080),
      socket(ports, 54, .070, .770, .044, .24, "extreme-qsfp-inverted", 1.035, "STACK2", .080));
    rearParts.push(part("screw", .193, .270, .027, .40, "ground-lug"));
  } else {
    rearParts.push(part("module-bay", .004, .045, .070, .90, "tm-clk-cover", "extreme-g2-cover", { model: "TM-CLK unpopulated" }),
      part("module-bay", .083, .045, .207, .90, "vim-cover", "extreme-g2-cover", { model: "VIM unpopulated" }));
  }
  return { front: { ports: front, components: frontParts }, rear: { ports: rear, components: rearParts } };
}
