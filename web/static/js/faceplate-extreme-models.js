import { canonicalFaceplateDevice } from "./faceplate-profile.js";

const ROOT = "https://documentation.extremenetworks.com/";
const GUIDE5320 = `${ROOT}5320%20Series%20Installation%20Guide/Universal_Hardware/5320_Series_Installation_Guide/`;
const GUIDE5520 = `${ROOT}5520%20Series%20Installation%20Guide/Universal_Hardware/5520_Series_Installation_Guide/`;
const GUIDEVSP = `${ROOT}VOSS/VSP7400/HW/`;
const definitions = new Map([
  ["5320-24P-8XE", { source: `${GUIDE5320}topics/5320_24p_8xe_switch_features.shtml`,
    sourcePage: "9037258-00 Rev AR: individual front/rear illustrations; fixed-PSU MTBF table", oldCount: 33,
    supplemental: `${GUIDE5320}topics/mean_time_between_failure.shtml`,
    configuration: "5320-24P-8XE with its fixed 550W AC supply; no removable rear fan trays. The last two SFP+ cages are Universal/stacking ports.",
    build: accessPanels }],
  ["5520-48W", { source: `${GUIDE5520}topics/5520_48w_switch_features.shtml`,
    sourcePage: "9036817-00 Rev BA: individual front/rear illustrations; installed 5520-VIM-4YE figure; 715W PSU section", oldCount: 53,
    supplemental: `${GUIDE5520}topics/replace_versatile_interface_modules.shtml`,
    configuration: "5520-48W with 5520-VIM-4YE (four 25G cages), three front-to-back fan modules, one XN-ACPWR-715W-FB supply at the right and a covered left PSU bay. Universal ports are shown in single-channel 40G Ethernet mode.",
    build: campusPanels }],
  ["VSP 7400-48Y-8C", { source: `${GUIDEVSP}GUID-D5E41201-D492-4052-A05B-73C44F92771F.shtml`,
    sourcePage: "121229-01 Rev 10: VSP 7400-48Y front/rear Figures 3/4; AC-F package table; 750W AC installation figure", oldCount: 57,
    supplemental: `${GUIDEVSP}GUID-6C89780A-F02C-4F22-9B89-473C969FCC16.shtml`, sku: "VSP7400-48Y-8C-AC-F",
    configuration: "VSP7400-48Y-8C-AC-F with six front-to-back fan modules, one XN-ACPWR-750W-F supply in right PSU1 and a covered left PSU2 bay.",
    build: aggregationPanels }],
]);
const cache = new Map();

/** Resolve only the three individually documented Extreme chassis, independently of saved inventory edits. */
export function resolveExtremeFaceplate(device) {
  const definition = definitions.get(device?.model);
  if (!definition || device.faceplate?.vendor !== "Extreme") return null;
  const canonical = canonicalFaceplateDevice(device);
  if (!canonical) return null;
  if (!cache.has(canonical.catalog)) cache.set(canonical.catalog, modelProfile(canonical.device, definition));
  return cache.get(canonical.catalog);
}

/** Record the selected hardware and explicit old-index mapping before constructing its two panels. */
function modelProfile(device, definition) {
  const campus = device.model === "5520-48W";
  const portIndexMap = Object.fromEntries(Array.from({ length: definition.oldCount }, (_, index) =>
    [index + 1, campus && index === 52 ? 55 : index + 1]));
  const portLabels = Object.fromEntries(Array.from({ length: definition.oldCount }, (_, index) =>
    [index + 1, index + 1 === definition.oldCount ? "CONSOLE" : String(index + 1)]));
  const limitations = [definition.configuration,
    "USB-A storage sockets are decorative. Side cooling and small grille, latch and fastener details use shared artwork; airflow is a selected configuration, not inferred from the saved topology."];
  if (campus) limitations.push("The QSFP28-shaped Universal cages do not support native 1x100G. Single-channel Ethernet is 40G; stacking and breakout modes depend on the operating system and configuration. The VIM is optional and is explicitly fitted in this drawing.");
  if (device.model === "VSP 7400-48Y-8C") limitations.push("The chassis prints Reserved above ports 55 and 56. VOSS reserves 55/56, or 53–56, when features including Fabric Connect are enabled. These physical cages remain represented; usable ports depend on configuration. This model does not support QSFP breakout/channelization.");
  return {
    id: `extreme-${device.model.toLowerCase().replaceAll(" ", "-")}`, family: device.model,
    ...(definition.sku ? { sku: definition.sku } : {}), fidelity: "model", defaultFace: "front",
    panelFidelity: { front: "model", rear: "model" }, inventoryRevision: 1, inventoryComplete: true,
    source: definition.source, sourcePage: definition.sourcePage, limitations,
    evidence: { models: [device.model], scope: "model", reviewed: "2026-09-10",
      front: definition.source, rear: definition.source, supplemental: definition.supplemental,
      configuration: definition.configuration,
      ...(campus ? { operatingModes: `${ROOT}switchengine_commands_32.2/GUID-FD9CDCE4-5A52-4861-8F09-AF7690A207F2.shtml`,
        power: `${GUIDE5520}topics/summit_715_w_ac_power_supplies.shtml` } : {}),
      ...(definition.sku ? { operatingModes: `${ROOT}VOSS%20v9.4%20Release%20Notes/Switch_Operating_Systems/VOSS_and_Fabric_Engine/voss_release_notes/topics/vsp_7400_hardware_compatibility.shtml`,
        power: `${GUIDEVSP}GUID-F1F1E9E9-FFF7-40E2-83ED-DC8DA9ED3FCB.shtml` } : {}) },
    legacyLayouts: [{ inventoryRevision: 0, portIndexMap, portLabels }],
    catalogDiscrepancies: ["New instances include the previously omitted Micro-B console or OOB management sockets. Saved revision-zero endpoints retain their IDs, names, media, speeds and settings and do not gain missing endpoints automatically.",
      ...(campus ? ["New 5520-48W copper ports are 1GbE; the older catalog incorrectly assigned 2.5G speeds and RJ45_10G media. Old VIM indices 49–52 remain on the four fitted 25G cages. Old console index 53 maps to new 55 after the two Universal cages are added."] : [])],
    chassis: { x: .02, y: .04, width: .96, height: .92 }, faces: definition.build(device.ports),
  };
}

/** Describe one decorative component using normalized top-left chassis bounds. */
function part(kind, x, y, width, height, label, variant) {
  return { kind, x, y, width, height, ...(label ? { label } : {}), ...(variant ? { variant } : {}) };
}

/** Bind a measured socket to its stable canonical index and printed physical label. */
function socket(ports, index, x, y, width, height, physicalLabel = String(index), descriptionAnchor) {
  const port = ports.find((candidate) => candidate.portIndex === index);
  if (!port) throw new Error(`Extreme physical slot ${index} is missing from canonical inventory`);
  return { portIndex: index, label: port.label, type: port.type, x, y, width, height, physicalLabel,
    ...(descriptionAnchor ? { descriptionAnchor } : {}) };
}

/** Compose a visible fan tray and its source-specific pull-handle orientation without implying grille fidelity. */
function fanTray(x, width, index, horizontal) {
  return [{ ...part("fan", x, .035, width, .93), role: "fan-tray", fanCount: 1 },
    horizontal ? part("handle", x + width * .14, .44, width * .72, .15)
      : part("handle", x + width * .03, .14, width * .14, .70),
    part("text", x + width * .28, .86, width * .45, .07, String(index))];
}

/** Trace the 5320's right-side copper/optical banks, far-left services and sparse fixed-power rear. */
function accessPanels(ports) {
  const front = [];
  for (let index = 0; index < 24; index++) front.push(socket(ports, index + 1,
    .470 + Math.floor(index / 12) * .200 + Math.floor(index % 12 / 2) * .033,
    index % 2 ? .71 : .37, .028, .23));
  for (let index = 0; index < 8; index++) front.push(socket(ports, index + 25,
    .870 + Math.floor(index / 2) * .033, index % 2 ? .70 : .35, .028, .20,
    index < 6 ? String(index + 25) : `U${index - 5}`));
  front.push(socket(ports, 33, .034, .44, .035, .27, "CONSOLE", { x: .11, y: .44 }),
    socket(ports, 34, .034, .92, .028, .10, "USB CONSOLE", { x: .115, y: .92 }));
  const components = [part("text", .008, .04, .07, .08, "EXTREME"),
    part("usb", .017, .68, .034, .10), part("button", .096, .055, .014, .13),
    ...Array.from({ length: 6 }, (_, index) => part("led", .124 + index * .014, .055, .006, .055))];
  return { front: { ports: front, components }, rear: { ports: [], components: [
    part("power", .216, .19, .070, .57, undefined, "ac"),
    part("screw", .136, .55, .025, .28), part("ring", .291, .43, .012, .14),
    part("text", .208, .86, .09, .08, "550W AC") ] } };
}

/** Trace the 5520's four copper banks and verified odd-top VIM positions with rear stacked management. */
function campusPanels(ports) {
  const front = [];
  for (let index = 0; index < 48; index++) front.push({ ...socket(ports, index + 1,
    .052 + Math.floor(index / 12) * .202 + Math.floor(index % 12 / 2) * .0315,
    index % 2 ? .70 : .36, .027, .235, String(index + 1), index === 0 ? { x: .054, y: .137 } : undefined),
    compatibleTypes: ["RJ45_10G"] });
  // The installed 5520-VIM-4YE figure prints 1/2 down the left and 3/4 down the right.
  for (let index = 0; index < 4; index++) front.push(socket(ports, index + 49,
    .927 + Math.floor(index / 2) * .034, index % 2 ? .72 : .40, .027, .20, String(index + 1)));
  front.push(socket(ports, 53, .866, .33, .040, .21, "U1"),
    socket(ports, 54, .866, .74, .040, .21, "U2"),
    socket(ports, 56, .025, .14, .026, .10, "USB CONSOLE", { x: .025, y: -.017 }));
  const frontComponents = [part("usb", .012, .51, .013, .29), part("button", .019, .31, .011, .10),
    { ...part("module-bay", .898, .03, .098, .94, undefined, "populated"), role: "vim", module: "5520-VIM-4YE" },
    part("vent", .210, .025, .673, .095, undefined, "mesh"),
    part("vent", .03, .925, .86, .05, undefined, "mesh")];
  const rear = [socket(ports, 55, .442, .40, .035, .26, "CONSOLE", { x: .51, y: .33 }),
    socket(ports, 57, .442, .76, .035, .26, "MGMT", { x: .51, y: .87 })];
  const rearComponents = [...[.027, .139, .251].flatMap((x, index) => fanTray(x, .100, index + 1, true)),
    part("screw", .373, .38, .026, .27), part("usb", .469, .56, .017, .32),
    part("led", .535, .74, .006, .06),
    { ...part("module-bay", .584, .035, .202, .93, "PSU 2"), role: "psu-blank" },
    part("psu", .796, .035, .194, .93, "PSU 1", "ac-inlet-right")];
  return { front: { ports: front, components: frontComponents }, rear: { ports: rear, components: rearComponents } };
}

/** Trace VSP7400's three SFP banks, eight physical QSFP cages, top service strip and six rear fans. */
function aggregationPanels(ports) {
  const front = [];
  // Compact upper captions occupy the real gap below management without moving any sockets.
  for (let index = 0; index < 56; index++) {
    const x = index < 48 ? .029 + Math.floor(index / 16) * .269 + Math.floor(index % 16 / 2) * .033
      : .838 + Math.floor((index - 48) / 2) * .043;
    const descriptionAnchor = index % 2 ? { x, y: .97 }
      : { x, y: .29, fontSize: 6, boxHeight: 8 };
    front.push(socket(ports, index + 1, x, index % 2 ? .78 : .46, index < 48 ? .029 : .039, .22,
      String(index + 1), descriptionAnchor));
  }
  front.push(socket(ports, 57, .094, .125, .033, .21, "CONSOLE", { x: .094, y: -.0335, fontSize: 5.5, boxHeight: 7 }),
    socket(ports, 58, .143, .125, .033, .21, "MGMT", { x: .143, y: -.0335, fontSize: 5.5, boxHeight: 7 }));
  const components = [part("usb", .037, .035, .034, .13),
    part("handle", .229, .045, .052, .145),
    ...Array.from({ length: 5 }, (_, index) => part("led", .172 + index * .008, .105, .005, .04)),
    part("vent", .302, .025, .498, .085, undefined, "mesh"),
    part("text", .942, .055, .050, .075, "Reserved")];
  const rearComponents = [{ ...part("module-bay", .033, .035, .137, .93, "PSU 2"), role: "psu-blank" },
    ...[.184, .295, .406, .517, .628, .739].flatMap((x, index) => fanTray(x, .103, index + 1, false)),
    part("psu", .853, .035, .139, .93, "PSU 1", "ac-fan-right"),
    part("screw", .005, .24, .018, .17), part("screw", .005, .64, .018, .17)];
  return { front: { ports: front, components }, rear: { ports: [], components: rearComponents } };
}
