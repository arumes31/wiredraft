import { canonicalFaceplateDevice } from "./faceplate-profile.js";

const root = "https://documentation.extremenetworks.com/ExtremeSwitching%20Installation%20Guide%20for%20Switches%20Using%20ExtremeXOS%20Version%2030/Wired_Hardware/ExtremeSwitching_Installation_Guide_for_Switches_Using_ExtremeXOS_Version_30/topics/";
const definitions = new Map([
  ["X465", { sku: "X465-24MU-24W", management: 55, heightMM: 43.6, widthMM: 440,
    page: "extremeswitching_x465-24mu-24w_switch_ports_and_slots.shtml",
    configuration: "X465-24MU-24W with VIM5-4Y (all four25G ports49–52 enabled), three XN-FAN-002-F front-to-back fans, one10941 1100W AC-FB supply at right, left PSU cover, SSD slot covered and included XN-4P-RKMT-001 four-post brackets. Dedicated40G STACK1/2 enabled. No optics. One1100W supply does not imply simultaneous maximum60W/90W PoE on all48 ports." }],
  ["X590", { sku: "X590-24t-1q-2c", management: 28, heightMM: 43.5, widthMM: 441,
    page: "extremeswitching_x590-24t-1q-2c_switch_ports_and_slots.shtml",
    configuration: "X590-24t-1q-2c (16791) with four17115 front-to-back fans in outer two-plus-two positions, two permanently covered center fan bays, two10960 770W AC-FB supplies and included rack brackets.24x10G copper, one40G and two100G unpartitioned Ethernet ports. Stacking disabled; no optics or breakout interfaces." }],
  ["X690", { sku: "X690-48t-2q-4c", management: 55, heightMM: 43.5, widthMM: 441,
    page: "extremeswitching_x690-48t-2q-4c_switch_ports_and_slots.shtml",
    configuration: "X690-48t-2q-4c (17351) with six17115 front-to-back fans, two10960 770W AC-FB supplies and included rack brackets.48x10G copper, two40G and four100G unpartitioned Ethernet ports. Stacking disabled; no optics or breakout interfaces." }],
]);
const profiles = new Map(), allocations = new WeakMap();

/** Resolve exact disclosed configurations against canonical identity, retaining the actual saved allocation. */
export function resolveExtremeNextFaceplate(device) {
  const definition = definitions.get(device?.model);
  if (!definition || device?.faceplate?.vendor !== "Extreme") return null;
  if (!profiles.has(device.model)) {
    const canonical = canonicalFaceplateDevice(device);
    if (!canonical) return null;
    const portIndexMap = { 59: definition.management };
    if (device.model === "X465") {
      for (const index of [...Array.from({ length: 24 }, (_, i) => i + 1), 49, 50, 51, 52]) portIndexMap[index] = index;
      Object.assign(portIndexMap, { 57: 53, 58: 54 });
    }
    profiles.set(device.model, {
      id: `extreme-${definition.sku.toLowerCase()}-selection`, family: device.model, sku: definition.sku,
      fidelity: "model", panelFidelity: { front: "model", rear: "model" }, defaultFace: "front",
      inventoryRevision: 1, inventoryComplete: true, rearHardwareVerified: true,
      source: root + definition.page, sourcePage: "Exact model ports, source front/rear diagrams, QRG population and PSU specifications",
      evidence: { scope: "model", models: [definition.sku], selectedModel: definition.sku, catalogAlias: device.model,
        front: device.model === "X465" ? "https://documentation.extremenetworks.com/HW_QRG/121231-00_x465_qrg.pdf" : root + definition.page,
        rear: device.model === "X465" ? "https://documentation.extremenetworks.com/HW_QRG/121231-00_x465_qrg.pdf" : root + definition.page,
        configuration: definition.configuration },
      note: `${device.model} explicitly selects ${definition.configuration}`,
      limitations: [definition.configuration,
        "Hidden brackets, internal cooling and unpopulated expansion electronics are not projected onto the front/rear. Perforations, status lenses and silkscreen are simplified from the source.",
        "Native height uses the source face dimension at460px; the existing normalized-width contract widens the body at690 without increasing its height. Saved rack allocation remains unchanged; this is not isotropic scaling across widths.",
        device.model === "X465" ? "Manufacturer QRG and PDF figures show the correct48-port chassis; the current HTML overview incorrectly links G2 pictures. USB-A storage is noninteractive; front Micro-B and rear RJ45 are distinct console connectors." : "Manufacturer dimension table calls487mm width and441mm length. The traced~10:1 front face and19in rack fit identify441mm as the face dimension; that axis interpretation is disclosed. Physical silkscreen ranges represent breakout capabilities; selected labels show unpartitioned port numbers."],
      catalogDiscrepancies: ["Frozen438 constructor independently executed:1U,59 endpoints:1–48RJ45_MGIG2500,49–56SFP28_25G25000,57/58Stack40000,59RJ45_1G MGMT. Saved IDs, types, labels, speeds, PoE, VLANs, cables and units are preserved.",
        device.model === "X465" ? "Revision0 maps only1–24,49–52,Stack57→53,58→54 andMGMT59→55. Canonical type guards reject changed types. Historical2.5G settings remain stored on supported5G-capable interfaces." : `Revision0 maps onlyMGMT59→${definition.management}. Historical multigig placeholders are not relabeled as fixed10G interfaces; all other saved and unknown-revision endpoints stay unmapped.`],
      legacyLayouts: [{ inventoryRevision: 0, portIndexMap, portLabels: Object.fromEntries([
        ...Array.from({ length: 56 }, (_, i) => [i + 1, String(i + 1)]), [57, "STACK1"], [58, "STACK2"], [59, "MGMT"]]) }],
      chassis: { x: 0, y: .10, width: 1, height: (460 * definition.heightMM / definition.widthMM) / .8 / 100 },
      faces: device.model === "X465" ? campusPanels(canonical.device.ports) : aggregationPanels(canonical.device.ports, device.model, definition.management),
    });
  }
  return fitAllocation(profiles.get(device.model), device);
}

/** Preserve the traced world body inside any larger saved allocation without mutating the saved record. */
function fitAllocation(profile, device) {
  const units = Math.max(1, Number(device.faceplate.unitsU) || 1);
  if (units === 1) return profile;
  if (!allocations.has(profile)) allocations.set(profile, new Map());
  const cache = allocations.get(profile);
  if (!cache.has(units)) cache.set(units, { ...profile, chassis: { ...profile.chassis, y: profile.chassis.y / units, height: profile.chassis.height / units } });
  return cache.get(units);
}

/** Describe a noninteractive observed assembly with optional installed hardware metadata. */
function part(kind, x, y, width, height, role, variant, extra = {}) {
  return { kind, x, y, width, height, role, ...(variant ? { variant } : {}), ...extra };
}

/** Bind a stable physical socket to its canonical type and bounded finite caption. */
function socket(ports, index, x, y, width, height, kind, captionY, physicalLabel, boxWidth = .030, captionX = x) {
  const port = ports.find(p => p.portIndex === index);
  return { portIndex: index, type: port.type, label: port.label, physicalLabel, connectorKind: kind, x, y, width, height,
    descriptionAnchor: { x: captionX, y: captionY, boxWidth, fontSize: 5.5, boxHeight: 7 } };
}

/** Trace X465 four banks of twelve, dedicated stack cages, VIM5-4Y and its separate rear management plane. */
function campusPanels(ports) {
  const front = [], rear = [];
  for (let i = 0; i < 48; i++) front.push(socket(ports, i + 1, .033 + Math.floor(i / 12) * .200 + Math.floor(i % 12 / 2) * .032,
    i % 2 ? .745 : .360, .026, .215, i % 2 ? "rj45" : "rj45-inverted", i % 2 ? 1.015 : .550, String(i + 1)));
  for (let i = 0; i < 4; i++) front.push(socket(ports, 49 + i, .914 + Math.floor(i / 2) * .034,
    i % 2 ? .745 : .360, .029, .215, i % 2 ? "extreme-next-sfp-inverted" : "sfp", i % 2 ? 1.015 : .550, String(49 + i), .032));
  for (let i = 0; i < 2; i++) front.push(socket(ports, 53 + i, .845, i ? .745 : .360, .039, .215,
    i ? "extreme-next-qsfp-inverted" : "qsfp", i ? 1.015 : .550, `STK${i + 1}`, .066));
  front.push(socket(ports, 57, .284, .135, .019, .090, "usb-micro", -.045, "USB", .044));
  rear.push(socket(ports, 55, .049, .730, .032, .245, "rj45", 1.015, "MGMT", .075),
    socket(ports, 56, .049, .320, .032, .245, "rj45-inverted", .525, "CON", .075));
  const frontParts = [part("usb", .311, .072, .032, .14, "storage-a"), part("usb", .376, .072, .032, .14, "storage-b"),
    part("status-panel", .171, .070, .088, .14, "status", "extreme-next-status"),
    part("vent", .440, .040, .365, .09, "upper-perforations", "extreme-next-grille"),
    part("module-bay", .880, .065, .014, .87, "vim-left-rail", "extreme-next-vim-rail", { model: "VIM5-4Y" }),
    part("module-bay", .972, .065, .014, .87, "vim-right-rail", "extreme-next-vim-rail", { model: "VIM5-4Y" })];
  const rearParts = [part("screw", .011, .080, .022, .25, "ground-lug"),
    part("module-bay", .096, .050, .090, .88, "ssd-cover", "extreme-next-cover", { installed: false }),
    part("module-bay", .586, .045, .194, .90, "psu-left-cover", "extreme-next-cover"),
    part("psu", .789, .035, .205, .93, "psu-right", "extreme-next-psu10941", { model: "10941", watts: 1100, airflow: "front-to-back", inlet: "IEC C16" })];
  for (let i = 0; i < 3; i++) rearParts.push(part("fan", .198 + i * .128, .045, .121, .90, `fan-${3 - i}`, "extreme-next-fan002", { model: "XN-FAN-002-F", airflow: "front-to-back" }));
  return { front: { ports: front, components: frontParts }, rear: { ports: rear, components: rearParts } };
}

/** Trace the different24/48-copper aggregation faces and their four/six-fan source rear populations. */
function aggregationPanels(ports, model, management) {
  const count = model === "X590" ? 24 : 48, front = [];
  for (let i = 0; i < count; i++) front.push(socket(ports, i + 1,
    .082 + Math.floor(i / 16) * .265 + Math.floor(i % 16 / 2) * .0318, i % 2 ? .720 : .385,
    .028, .240, i % 2 ? "rj45" : "rj45-inverted", i % 2 ? 1.015 : .175, String(i + 1)));
  front.push(socket(ports, management, .036, .275, .032, .245, "rj45-inverted", .055, "MGMT", .068),
    socket(ports, management + 1, .036, .655, .032, .245, "rj45", 1.025, "CON", .065));
  if (model === "X590") {
    front.push(socket(ports, 25, .880, .730, .041, .24, "qsfp", 1.015, "25", .060),
      socket(ports, 26, .963, .400, .041, .24, "qsfp", .175, "29", .060),
      socket(ports, 27, .963, .760, .041, .24, "extreme-next-qsfp-inverted", 1.015, "33", .060));
  } else for (let i = 0; i < 6; i++) front.push(socket(ports, 49 + i, .870 + Math.floor(i / 2) * .045,
    i % 2 ? .730 : .400, .039, .240, i % 2 ? "extreme-next-qsfp-inverted" : "qsfp", i % 2 ? 1.015 : .175,
    String([49, 53, 57, 61, 65, 69][i]), .042));
  const frontParts = [part("usb", .035, .820, .017, .065, "storage"),
    part("status-panel", .071, .025, .048, .04, "status", "extreme-next-status"),
    part("vent", .135, .025, .708, .04, "upper-perforations", "extreme-next-grille")];
  if (model === "X590") frontParts.push(part("vent", .861, .245, .065, .265, "uplink-perforations", "extreme-next-grille"));
  const rearParts = [part("screw", .014, .320, .021, .30, "ground-lug")];
  for (let i = 0; i < 6; i++) {
    if (model === "X590" && (i === 2 || i === 3)) continue;
    rearParts.push(part("fan", .047 + i * .111, .040, .102, .915, `fan-${6 - i}`, "extreme-next-fan17115", { model: "17115", airflow: "front-to-back" }));
  }
  if (model === "X590") rearParts.push(part("module-bay", .268, .035, .213, .925, "permanent-fan-covers", "extreme-next-permanent-cover", { coveredBays: 2, removableForOperation: false }));
  for (let i = 0; i < 2; i++) rearParts.push(part("psu", .709 + i * .142, .040, .135, .915, `psu-${2 - i}`, "extreme-next-psu10960", { model: "10960", watts: 770, airflow: "front-to-back", inlet: "IEC C14" }));
  return { front: { ports: front, components: frontParts }, rear: { ports: [], components: rearParts } };
}
