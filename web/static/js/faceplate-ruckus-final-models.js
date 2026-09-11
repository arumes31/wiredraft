import { canonicalFaceplateDevice } from "./faceplate-profile.js";

const definitions = new Map([
  ["ICX 7650 family", { sku: "ICX7650-48ZP", series: "7650", management: 57, frontPage: 14, rearPage: 15,
    mirror: "https://www.manualslib.com/manual/1402354/Ruckus-Wireless-Icx-7650.html",
    configuration: "ICX7650-48ZP with ICX7650-4X10GF front slot2, four fixed rear slot3 cages (left pair40G, right pair100G), two RPS16-E1000W AC supplies and two ICX-FAN12-E exhaust trays. Rear slot3 remains in stacking mode so front slot2 remains enabled. Left24 copper are Gigabit PoE; right24 are multi-rate100M/1G/2.5G/5G/10G with10000Mbps default. Front RJ45 management, RJ45 console and USB-C console." }],
  ["ICX 7850 family", { sku: "ICX7850-48F", series: "7850", management: 57, frontPage: 14, rearPage: 16,
    mirror: "https://www.manualslib.com/manual/2772662/Ruckus-Wireless-Icx-7850-Series.html",
    configuration: "ICX7850-48F with48 front25G SFP28 and eight front100G QSFP28 cages, two RPS19-E650W AC supplies and five ICX-FAN12-E exhaust trays. All SFP28 groups select25G; no breakout. The guide illustrates DC left and AC right as alternatives; this configuration uses the observed AC supply in both identical slots. USB-C console is vertical at front left; RJ45 console, management and USB storage are rear." }],
  ["ICX 8200 family", { sku: "ICX8200-48PF2", series: "8200", management: 53, frontPage: 15, rearPage: 18,
    mirror: "https://www.manualslib.com/manual/3320424/Ruckus-Wireless-Icx-8200.html",
    configuration: "ICX8200-48PF2 with48 Gigabit PoE+ copper ports and four25G SFP28 cages, two RPS23-E920W AC supplies and two ICX-FAN13-E exhaust trays. The eight-cage family maximum does not apply to this SKU. RJ45 management, RJ45 console, USB-C console and USB storage are front; rear has no logical endpoints." }],
]);
const profiles = new Map(), allocations = new WeakMap();

/** Resolve only the three disclosed configurations, retaining the actual saved inventory and rack allocation. */
export function resolveRuckusFinalFaceplate(device) {
  const definition = definitions.get(device?.model);
  if (device?.faceplate?.vendor !== "Ruckus" || !definition) return null;
  if (!profiles.has(device.model)) {
    const canonical = canonicalFaceplateDevice(device);
    if (!canonical) return null;
    const portIndexMap = { 59: definition.management };
    if (definition.series === "7650") for (let index = 25; index <= 48; index++) portIndexMap[index] = index;
    if (definition.series === "8200") for (let index = 49; index <= 52; index++) portIndexMap[index] = index;
    const source = `https://docs-be.commscope.com/bundle/icx${definition.series}-installguide/raw/resource/enus/icx${definition.series}-installguide.pdf`;
    profiles.set(device.model, { id: `ruckus-${definition.sku.toLowerCase()}-family-selection`, family: device.model,
      sku: definition.sku, fidelity: "model", defaultFace: "front", panelFidelity: { front: "model", rear: "model" },
      inventoryRevision: 1, inventoryComplete: true, rearHardwareVerified: true, source,
      sourcePage: `Manufacturer guide mirror pages${definition.frontPage}/${definition.rearPage}`,
      evidence: { scope: "model", models: [definition.sku], selectedModel: definition.sku, catalogAlias: device.model,
        front: `${definition.mirror}?page=${definition.frontPage}`, rear: `${definition.mirror}?page=${definition.rearPage}`, configuration: definition.configuration },
      note: `${device.model} explicitly selects ${definition.configuration}`,
      limitations: [definition.configuration,
        "Manufacturer-authored front/rear diagrams were personally inspected through the disclosed ManualsLib mirrors; publisher downloads require sign-in and the legacy PDF endpoint returned a service error. Tiny silkscreen, grille perforations and status lenses are simplified.",
        "The normalized-width scene contract preserves the native1U body within edited rack allocations independently at460 and690 pixels; it does not claim isotropic scaling between display widths."],
      catalogDiscrepancies: ["The independently executed frozen438 constructor produces59 endpoints in1U:48 RJ45_MGIG2500, eight SFP28_25G25000, Stack57/58 and management59. Saved types, labels, speeds, PoE, VLANs, IDs, cables and rack allocation remain unchanged.",
        `Revision zero maps only management59→${definition.management}${definition.series === "7650" ? " and supported multi-rate copper25–48" : definition.series === "8200" ? " and matching SFP28 ports49–52" : ""}. All maps are type-guarded; other placeholders and unknown revisions remain unmapped. Missing physical sockets are noninteractive ancillary art, never new saved endpoints.`],
      legacyLayouts: [{ inventoryRevision: 0, portIndexMap, portLabels: Object.fromEntries([
        ...Array.from({ length: 56 }, (_, index) => [index + 1, String(index + 1)]), [57, "STACK1"], [58, "STACK2"], [59, "MGMT"]]) }],
      chassis: { x: 0, y: .05, width: 1, height: .9 },
      faces: definition.series === "7650" ? panels7650(canonical.device.ports) : definition.series === "7850" ? panels7850(canonical.device.ports) : panels8200(canonical.device.ports) });
  }
  return fitAllocation(profiles.get(device.model), device);
}

/** Preserve the native one-unit body when an installed device reserves more rack space. */
function fitAllocation(profile, device) {
  const units = Math.max(1, Number(device.faceplate.unitsU) || 1);
  if (units === 1) return profile;
  if (!allocations.has(profile)) allocations.set(profile, new Map());
  const cache = allocations.get(profile);
  if (!cache.has(units)) cache.set(units, { ...profile, chassis: { ...profile.chassis, y: .05 / units, height: .9 / units } });
  return cache.get(units);
}

/** Describe an observed noninteractive physical part without logical endpoint ownership. */
function part(kind, x, y, width, height, role, variant, extra = {}) {
  return { kind, x, y, width, height, role, ...(variant ? { variant } : {}), ...extra };
}

/** Bind a canonical endpoint to a physical aperture with a complete finite caption anchor. */
function socket(ports, index, x, y, width, height, connectorKind, physicalLabel, captionY, boxWidth = .030, captionX = x) {
  const port = ports.find((entry) => entry.portIndex === index);
  return { portIndex: index, type: port.type, label: port.label, physicalLabel, x, y, width, height, connectorKind,
    descriptionAnchor: { x: captionX, y: captionY, fontSize: 5.5, boxHeight: 7, boxWidth } };
}

/** Trace four twelve-port copper banks with the source's odd upper and even lower row numbering. */
function copperBanks(ports, startX, topY, bottomY) {
  return Array.from({ length: 48 }, (_, index) => socket(ports, index + 1,
    startX + Math.floor(index / 12) * .202 + Math.floor(index % 12 / 2) * .032,
    index % 2 ? bottomY : topY, .027, .20, index % 2 ? "rj45-inverted" : "rj45", String(index + 1), index % 2 ? .950 : .575));
}

/** Trace the48ZP front module and reverse-numbered rear slot3 flanked by FAN12 and RPS16 assemblies. */
function panels7650(ports) {
  const front = copperBanks(ports, .086, .400, .755), rear = [];
  for (let index = 0; index < 4; index++) front.push(socket(ports, index + 49, .920 + Math.floor(index / 2) * .031,
    index % 2 ? .755 : .400, .028, .20, "sfp", String(index + 1), index % 2 ? .950 : .575));
  front.push(socket(ports, 57, .032, .755, .030, .20, "rj45", "MGMT", .950, .060),
    socket(ports, 58, .032, .400, .030, .20, "rj45", "CON", .575, .060),
    socket(ports, 59, .155, .105, .020, .085, "usb-c", "USB-C", -.060, .068));
  for (let index = 0; index < 4; index++) rear.push(socket(ports, index + 53, .170 + index * .050, .700,
    index < 2 ? .045 : .048, .20, "qsfp", `3/${4 - index}`, .470, .049));
  return { front: { ports: front, components: [
    part("usb", .018, .090, .032, .10, "storage"), part("button", .067, .095, .006, .045, "reset", "reset"),
    part("status-panel", .185, .045, .17, .12, "status", "ruckus-final-status"),
    part("vent", .380, .030, .495, .12, "upper-grille", "ruckus-final-grille"),
    part("handle", .977, .060, .012, .84, "front-module-latch", "ruckus-final-handle"),
    part("panel-accent", .480, .190, .395, .028, "high-poe-bank", "ruckus-final-poe"),
  ] }, rear: { ports: rear, components: [
    part("fan", .020, .045, .105, .91, "fan2", "ruckus-final-fan12", { model: "ICX-FAN12-E" }),
    part("fan", .367, .045, .105, .91, "fan1", "ruckus-final-fan12", { model: "ICX-FAN12-E" }),
    part("psu", .491, .045, .247, .91, "psu2", "ruckus-7450-psu", { model: "RPS16-E", watts: 1000 }),
    part("psu", .748, .045, .247, .91, "psu1", "ruckus-7450-psu", { model: "RPS16-E", watts: 1000 }),
    part("vent", .145, .070, .200, .20, "slot3-upper-grille", "ruckus-final-grille"),
    part("screw", .003, .580, .014, .12, "ground-terminal"),
  ] } };
}

/** Trace the48F's three SFP28 banks, eight QSFP28 cages, portrait USB-C and five-fan rear with two AC supplies. */
function panels7850(ports) {
  const front = [], rear = [];
  for (let index = 0; index < 48; index++) front.push(socket(ports, index + 1,
    .040 + Math.floor(index / 16) * .266 + Math.floor(index % 16 / 2) * .033,
    index % 2 ? .730 : .380, .029, .13, "sfp", String(index + 1), index % 2 ? .920 : .550, .031));
  for (let index = 0; index < 8; index++) front.push(socket(ports, index + 49, .840 + Math.floor(index / 2) * .044,
    index % 2 ? .730 : .380, .038, .13, "qsfp", String(index + 1), index % 2 ? .920 : .550, .040));
  front.push(socket(ports, 59, .012, .380, .010, .18, "ruckus-usbc-vertical", "USB-C", -.060, .080, .050));
  rear.push(socket(ports, 57, .540, .720, .030, .20, "rj45", "MGMT", .950, .068),
    socket(ports, 58, .540, .365, .030, .20, "rj45", "CON", .130, .068));
  return { front: { ports: front, components: [
    part("status-panel", .045, .060, .17, .12, "status", "ruckus-final-status"),
    part("vent", .240, .030, .735, .12, "upper-grille", "ruckus-final-grille"),
    part("button", .012, .745, .006, .045, "reset", "reset"),
  ] }, rear: { ports: rear, components: [
    part("psu", .012, .040, .135, .92, "psu2", "ruckus-final-rps19", { model: "RPS19-E", watts: 650 }),
    ...[.166, .280, .394, .622, .736].map((x, index) => part("fan", x, .040, .102, .92, `fan${5 - index}`, "ruckus-final-fan12", { model: "ICX-FAN12-E" })),
    part("usb", .580, .350, .014, .32, "storage", undefined, { orientation: "vertical" }),
    part("psu", .850, .040, .135, .92, "psu1", "ruckus-final-rps19", { model: "RPS19-E", watts: 650 }),
    part("screw", .989, .670, .010, .10, "ground-terminal"),
  ] } };
}

/** Trace the48PF2 front service column and four SFP28 cages, with its two removable fans and fan-left AC supplies. */
function panels8200(ports) {
  const front = copperBanks(ports, .105, .390, .745);
  for (let index = 0; index < 4; index++) front.push(socket(ports, index + 49, .925 + Math.floor(index / 2) * .039,
    index % 2 ? .745 : .390, .028, .20, "sfp", String(index + 1), index % 2 ? .950 : .575, .034));
  front.push(socket(ports, 53, .060, .390, .032, .22, "rj45", "MGMT", .575, .060, .058),
    socket(ports, 54, .060, .745, .032, .22, "rj45", "CON", .950, .060),
    socket(ports, 55, .095, .105, .020, .085, "usb-c", "USB-C", -.060, .068));
  return { front: { ports: front, components: [
    part("usb", .012, .400, .014, .36, "storage", undefined, { orientation: "vertical" }),
    part("button", .018, .870, .006, .045, "reset", "reset"),
    part("status-panel", .160, .045, .17, .12, "status", "ruckus-final-status"),
    part("vent", .345, .030, .635, .12, "upper-grille", "ruckus-final-grille"),
  ] }, rear: { ports: [], components: [
    part("fan", .026, .040, .105, .92, "fan2", "ruckus-final-fan13", { model: "ICX-FAN13-E" }),
    part("fan", .145, .040, .105, .92, "fan1", "ruckus-final-fan13", { model: "ICX-FAN13-E" }),
    part("screw", .584, .270, .012, .10, "ground-terminal"),
    part("psu", .620, .040, .175, .92, "psu2", "ruckus-final-rps23", { model: "RPS23-E", watts: 920 }),
    part("psu", .810, .040, .175, .92, "psu1", "ruckus-final-rps23", { model: "RPS23-E", watts: 920 }),
  ] } };
}
