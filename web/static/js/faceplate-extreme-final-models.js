import { canonicalFaceplateDevice } from "./faceplate-profile.js";

const root = "https://documentation.extremenetworks.com/ExtremeSwitching%20Installation%20Guide%20for%20Switches%20Using%20ExtremeXOS%20Version%2030/Wired_Hardware/ExtremeSwitching_Installation_Guide_for_Switches_Using_ExtremeXOS_Version_30/topics/";
const definitions = new Map([
  ["X695", { sku: "X695-48Y-8C", management: 57, heightMM: 43.4, widthMM: 439.6, page: "extremeswitching_x695_switch.shtml",
    configuration: "X695-48Y-8C with two XN-ACPWR-750W-F 750 W AC supplies, six XN-FAN-001-F fan modules, front-to-back airflow, internal 128 GB SSD and included XN-4P-RKMT298 four-post kit. All 48 SFP28 ports select 25G and all eight QSFP28 cages select unpartitioned 100G Ethernet. No optics or stacking." }],
  ["X870", { sku: "X870-32c", management: 33, heightMM: 44.5, widthMM: 431.8, page: "extremeswitching_x870-32c_switch_ports_and_slots.shtml",
    configuration: "X870-32c (17800) with six 17115 front-to-back fans, two 10960 770 W AC-FB supplies and included mounting brackets. All 32 QSFP28 cages select unpartitioned 100G Ethernet, with EXOS port numbers 1, 5, 9 through 125. No optics, breakout or stacking. Unsupported 1PPS/10MHz timing sockets and Micro-A storage are physical art only." }],
]);
const profiles = new Map(), allocations = new WeakMap();

/** Resolve exact manufacturer configurations while preserving actual saved inventories and rack allocations. */
export function resolveExtremeFinalFaceplate(device) {
  const definition = definitions.get(device?.model);
  if (!definition || device?.faceplate?.vendor !== "Extreme") return null;
  if (!profiles.has(device.model)) {
    const canonical = canonicalFaceplateDevice(device);
    if (!canonical) return null;
    profiles.set(device.model, {
      id: `extreme-${definition.sku.toLowerCase()}-selection`, family: device.model, sku: definition.sku,
      fidelity: "model", defaultFace: "front", panelFidelity: { front: "model", rear: "model" },
      inventoryRevision: 1, inventoryComplete: true, rearHardwareVerified: true,
      source: root + definition.page, sourcePage: "Exact front/rear diagrams, QRG module population, dimensions and physical port numbering",
      evidence: { scope: "model", models: [definition.sku], selectedModel: definition.sku, catalogAlias: device.model,
        front: root + definition.page, rear: root + definition.page, configuration: definition.configuration },
      note: `${device.model} explicitly selects ${definition.configuration}`,
      limitations: [definition.configuration,
        "Source paint and perforations are simplified. Internal SSD, hidden rack rails and internal cooling are not invented as additional front/rear hardware. USB storage and unsupported timing connectors are noninteractive.",
        "Native chassis dimensions set the body aspect at 460 px. The existing normalized-width contract widens the body at 690 px without increasing height. At each width the body remains identical in native and larger saved rack allocations; no isotropic scaling across widths is claimed.",
        device.model === "X695" ? "The manufacturer explicitly reuses a VSP rear image on the X695 page; the X695 quick reference independently confirms the same six-fan/two-supply bay arrangement. The selected supplies are installed at both ends, using the exact XN-ACPWR-750W-F installation figure and red airflow tabs. Physical QSFP labels49,50,51,55,56,60,61,62 are distinct from dense endpoint indices." : "The QRG callout table reverses management/console names; actual front silkscreen and the exact-model hardware guide agree: console at left, management at right. Unsupported timing BNC connectors are visible but cannot be cable endpoints."],
      catalogDiscrepancies: ["Independently executed frozen 438 constructor: both aliases were 1U with 59 endpoints: 1–48 RJ45_MGIG 2500, 49–56 SFP28_25G 25000, 57/58 Stack 40000, 59 RJ45_1G MGMT.",
        `Revision 0 maps only management 59→${definition.management}, guarded by canonical type. Other saved endpoints and all unknown-revision endpoints remain unmapped. IDs, labels, types, speeds, PoE, VLANs, cables and rack units are never changed.`],
      legacyLayouts: [{ inventoryRevision: 0, portIndexMap: { 59: definition.management }, portLabels: Object.fromEntries([
        ...Array.from({ length: 56 }, (_, i) => [i + 1, String(i + 1)]), [57, "STACK1"], [58, "STACK2"], [59, "MGMT"]]) }],
      chassis: { x: 0, y: .10, width: 1, height: (460 * definition.heightMM / definition.widthMM) / .8 / 100 },
      faces: device.model === "X695" ? aggregationPanels(canonical.device.ports) : spinePanels(canonical.device.ports),
    });
  }
  const profile = profiles.get(device.model), units = Math.max(1, Number(device.faceplate.unitsU) || 1);
  if (units === 1) return profile;
  if (!allocations.has(profile)) allocations.set(profile, new Map());
  const cache = allocations.get(profile);
  if (!cache.has(units)) cache.set(units, { ...profile, chassis: { ...profile.chassis, y: profile.chassis.y / units, height: profile.chassis.height / units } });
  return cache.get(units);
}

/** Describe a sourced physical assembly without adding logical cable endpoints. */
function part(kind, x, y, width, height, role, variant, extra = {}) {
  return { kind, x, y, width, height, role, ...(variant ? { variant } : {}), ...extra };
}

/** Bind a canonical identity to a source aperture and an explicit finite caption anchor. */
function socket(ports, index, x, y, width, height, kind, captionY, physicalLabel, boxWidth = .032) {
  const port = ports.find(p => p.portIndex === index);
  return { portIndex: index, type: port.type, label: port.label, physicalLabel, connectorKind: kind, x, y, width, height,
    descriptionAnchor: { x, y: captionY, boxWidth, boxHeight: 7, fontSize: 5.5 } };
}

/** Trace X695 three SFP28 banks, irregularly numbered QSFP cages and the removable top service set. */
function aggregationPanels(ports) {
  const front = [];
  for (let i = 0; i < 48; i++) front.push(socket(ports, i + 1, .027 + Math.floor(i / 16) * .267 + Math.floor(i % 16 / 2) * .0325,
    i % 2 ? .820 : .500, .029, .190, i % 2 ? "extreme-next-sfp-inverted" : "sfp", i % 2 ? 1.045 : .315, String(i + 1)));
  for (let i = 0; i < 8; i++) front.push(socket(ports, 49 + i, .832 + Math.floor(i / 2) * .043,
    i % 2 ? .820 : .500, .039, .190, i % 2 ? "extreme-next-qsfp-inverted" : "qsfp", i % 2 ? 1.045 : .315,
    String([49,50,51,55,56,60,61,62][i]), .041));
  front.push(socket(ports, 57, .145, .120, .033, .190, "rj45", -.095, "MGMT", .078),
    socket(ports, 58, .095, .120, .033, .190, "rj45", -.095, "CON", .068));
  const frontParts = [part("usb", .035, .045, .033, .14, "storage"),
    part("handle", .228, .030, .051, .16, "management-set-slide", "extreme-final-slide"),
    part("status-panel", .170, .075, .043, .07, "status", "extreme-next-status"),
    part("vent", .311, .025, .488, .075, "upper-perforations", "extreme-next-grille")];
  const rearParts = [part("screw", .005, .245, .018, .19, "ground-upper"),part("screw", .005, .650, .018, .19, "ground-lower")];
  for (const [x, number] of [[.033,2],[.853,1]]) rearParts.push(part("psu", x, .035, .137, .93, `psu-${number}`, "extreme-final-750w", { model: "XN-ACPWR-750W-F", watts: 750, inlet: "IEC C14", airflow: "front-to-back" }));
  for (let i = 0; i < 6; i++) rearParts.push(part("fan", .183 + i * .111, .035, .104, .93, `fan-${i+1}`, "extreme-final-fan001", { model: "XN-FAN-001-F", airflow: "front-to-back" }));
  return { front: { ports: front, components: frontParts }, rear: { ports: [], components: rearParts } };
}

/** Trace X870 four eight-cage banks, left console/management/timing sockets and exact shared17115/10960 rear hardware. */
function spinePanels(ports) {
  const front = [];
  for (let i = 0; i < 32; i++) front.push(socket(ports, i + 1, .271 + Math.floor(i / 8) * .184 + Math.floor(i % 8 / 2) * .043,
    i % 2 ? .700 : .350, .041, .220, i % 2 ? "extreme-next-qsfp-inverted" : "qsfp", i % 2 ? .940 : .145, String(1 + i * 4), .041));
  front.push(socket(ports, 33, .215, .580, .038, .265, "rj45-inverted", .895, "MGMT", .078),
    socket(ports, 34, .160, .580, .038, .265, "rj45", .895, "CON", .078),
    socket(ports, 35, .215, .205, .022, .08, "usb-micro", .070, "USB", .050));
  const frontParts = [part("extreme-final-micro-a", .153, .165, .023, .08, "storage"),
    part("power", .083, .160, .025, .24, "unsupported-1pps", "extreme-final-timing", { supported: false, signal: "1PPS" }),
    part("power", .083, .450, .025, .24, "unsupported-10mhz", "extreme-final-timing", { supported: false, signal: "10MHz" }),
    part("status-panel", .054, .30, .026, .42, "status", "extreme-final-status"),
    part("vent", .249, .018, .725, .043, "upper-perforations", "extreme-next-grille"),
    part("handle", .978, .270, .020, .44, "right-release-tab", "extreme-final-tab")];
  const rearParts = [part("screw", .014, .320, .021, .30, "ground-lug")];
  for (let i = 0; i < 6; i++) rearParts.push(part("fan", .047 + i * .111, .040, .102, .915, `fan-${6-i}`, "extreme-next-fan17115", { model: "17115", airflow: "front-to-back" }));
  for (let i = 0; i < 2; i++) rearParts.push(part("psu", .709 + i * .142, .040, .135, .915, `psu-${2-i}`, "extreme-next-psu10960", { model: "10960", watts: 770, airflow: "front-to-back", inlet: "IEC C14" }));
  return { front: { ports: front, components: frontParts }, rear: { ports: [], components: rearParts } };
}
