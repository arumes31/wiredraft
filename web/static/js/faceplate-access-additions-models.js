import { canonicalFaceplateDevice } from "./faceplate-profile.js";
import { accessAdditionProfiles, accessAdditionSources } from "./catalog-access-additions.js";

const selections = new Map(accessAdditionProfiles.map(row => [`${row.vendor}\0${row.model}`, row]));
const cache = new Map();

/** Resolve only exact vendor/model keys and fit the source body inside the unchanged rack allocation. */
export function resolveAccessAdditionFaceplate(device) {
  const key = `${device?.faceplate?.vendor}\0${device?.model}`, selected = selections.get(key);
  if (!selected) return null;
  if (!cache.has(key)) {
    const canonical = canonicalFaceplateDevice(device);
    if (!canonical) return null;
    cache.set(key, { profile: buildProfile(canonical.device, selected), allocations: new Map() });
  }
  const entry = cache.get(key), rawUnits = Number(device.faceplate.unitsU);
  const units = Number.isFinite(rawUnits) && rawUnits >= 1 ? rawUnits : 1;
  if (!entry.allocations.has(units)) entry.allocations.set(units, { ...entry.profile,
    chassis: { ...entry.profile.chassis, y: entry.profile.chassis.y / units, height: entry.profile.chassis.height / units } });
  return entry.allocations.get(units);
}

/** Define a source-positioned physical component without giving it a topology identity. */
function part(kind, x, y, width, height, variant, extra = {}) {
  return { kind, x, y, width, height, ...(variant ? { variant } : {}), active: false, ...extra };
}

/** Bind a canonical connector to its physical aperture while reserving a readable caption. */
function socket(device, index, x, y, width, height, connectorKind, captionY, captionX = x, captionWidth = width) {
  const port = device.ports.find(port => port.portIndex === index);
  return { portIndex: index, type: port.type, label: port.label, physicalLabel: port.label,
    x, y, width, height, connectorKind,
    descriptionAnchor: { x: captionX, y: captionY, fontSize: 5.5, boxHeight: 7, boxWidth: captionWidth } };
}

/** Fit source body coordinates between explicit rack ears; only these panels are socket containers. */
function mountedPanels(panels, bodyWidth, frontColor, rearColor) {
  const width = bodyWidth / (482.6 * .985), left = (1 - width) / 2;
  return Object.fromEntries(Object.entries(panels).map(([face, panel]) => [face, {
    ports: panel.ports.map(port => ({ ...port, x: left + port.x * width, width: port.width * width,
      descriptionAnchor: { ...port.descriptionAnchor, x: left + port.descriptionAnchor.x * width,
        boxWidth: port.descriptionAnchor.boxWidth * width } })),
    components: [
      part("panel", left, 0, width, 1, "access-addition-body", { bodyWidthMm: bodyWidth,
        color: face === "front" ? frontColor : rearColor, hardwareLayer: "chassis-container", captionBackground: true, role: "source-body" }),
      ...[0, 1 - left].map(x => part("mounting-bracket", x, 0, left, 1, "access-addition-rack-ear", { face, role: "rack-bracket" })),
      ...panel.components.map(component => ({ ...component, x: left + component.x * width, width: component.width * width })),
    ],
  }]));
}

/** Assemble source evidence, exact inventory and native dimensions independently of saved port arrays. */
function buildProfile(device, row) {
  const cisco = row.vendor === "Cisco", office = row.sku === "JL381A";
  const widthMm = cisco ? 438.1 : office ? 442.5 : 443, heightMm = cisco ? 43.9 : 44;
  const body = 690 * heightMm / 482.6, rawHeight = body < 64 ? body / .8 : body + 16;
  const panels = cisco ? c8200Panels(device) : office ? officePanels(device) : aruba2530Panels(device, row.sku === "J9775A" ? 48 : 24);
  return { id: `access-addition-${row.sku.toLowerCase()}`, sku: row.sku, family: row.model,
    note: row.note,
    fidelity: "model", panelFidelity: { front: "model", rear: "model" }, inventoryComplete: true,
    inventoryRevision: 1, legacyLayouts: [], rearHardwareVerified: true, defaultFace: "front",
    source: row.source, sourcePage: cisco ? "Figures 1/2, PDF8/9; mounting Figure8 PDF34; datasheet Figure1 confirms port numbering" :
      office ? "Installation Guide 5200-2835a: PDF6 exact JL381A front, PDF16 shared 24/48-port rear, PDF13 fanless, PDF36 dimensions" :
        `Installation Guide 5998-7034a: PDF${row.sku === "J9775A" ? 10 : 9} exact ${row.sku} front, PDF19 explicitly applicable rear, PDF18 consoles, PDF71 dimensions`,
    evidence: { scope: "model", models: [row.model], selectedModel: row.model, selectedSku: row.sku,
      configuration: row.note, front: row.source, rear: row.source, reviewed: "2026-09-11",
      physicalDimensions: { widthMm, heightMm, rackWidthMm: 482.6 } },
    limitations: [row.note,
      "These are new revision-1 catalog additions. No historical revision is inferred from labels, count or media. Revision 0 and unknown revisions remain unmapped; saved IDs, records, cables, positions and rack reservations are never changed.",
      "Source body dimensions are retained at the 690-pixel reference; the existing normalized-width contract scales display width independently at 460. Supplied rack brackets occupy the surrounding 19-inch envelope. Fine perforation density, certification printing and bracket depth are simplified.",
      cisco ? "The manufacturer datasheet photo has optional LTE/PVDM cards; this selected base population instead uses the NIM and PIM covers shown in the installation guide. The unconnected PoE-adapter input remains physical art; no adapter, PoE module, extra management or USB console is invented." :
        office ? "The installation guide rear drawing explicitly covers 24/48-port models. Its fanless rear contains one AC inlet; side ventilation is not relocated onto the rear. English manufacturer PDF inspected from an ITT mirror because the HPE media URL rejected direct download." :
          "RJ45 and micro-B console sockets are alternative console paths. The cited rear figure explicitly includes both selected SKUs; cooling apertures on other faces and PoE-model power fittings are not added to this rear.",
    ],
    chassis: { x: .0075, y: .055, width: .985, height: rawHeight / 100 },
    faces: mountedPanels(panels, widthMm, cisco ? "#c6c9c8" : office ? "#a4a5a3" : "#cbd6d8", cisco ? "#c6c9c8" : office ? "#bfc4c3" : "#455b70"),
  };
}

/** Trace C8200's two separate WAN stacks, covered expansion bays and exact two-fan AC rear. */
function c8200Panels(device) {
  const ports = [socket(device, 1, .243, .36, .040, .29, "rj45-inverted", .32, .775, .105),
    socket(device, 2, .243, .72, .040, .29, "rj45", .71, .775, .105),
    socket(device, 3, .291, .36, .039, .29, "sfp", .32, .889, .105),
    socket(device, 4, .291, .72, .039, .29, "sfp-inverted", .71, .889, .105),
    socket(device, 5, .090, .70, .038, .30, "console", .94, .09, .065)];
  const front = [part("text", .015, .08, .048, .17, undefined, { label: "CISCO", fontSize: 5.5 }),
    part("vent", .064, .28, .102, .22, "access-addition-honeycomb"),
    part("status-panel", .066, .08, .078, .12, "access-addition-cisco-leds"),
    part("usb", .124, .68, .032, .12, "a", { role: "usb-storage" }),
    part("module-bay", .337, .24, .150, .56, "access-addition-pim-cover", { role: "pim-cover" }),
    part("module-bay", .505, .08, .201, .72, "access-addition-nim-cover", { role: "nim-cover" }),
    part("module-bay", .537, .862, .167, .115, "access-addition-m2-cover", { role: "m2-storage", installedStorageGB: 16 }),
    part("vent", .169, .018, .336, .070, "access-addition-honeycomb"),
    part("vent", .337, .882, .192, .065, "access-addition-honeycomb"),
    part("slot", .950, .085, .025, .075, "access-addition-lock", { role: "security-lock" }),
    part("panel", .981, .04, .017, .91, "access-addition-rfid", { role: "rfid-tag" })];
  const rear = [part("switch", .019, .23, .025, .58, "access-addition-rocker", { role: "power-switch" }),
    part("power", .049, .11, .053, .73, "ac-sideways", { role: "ac-inlet" }),
    part("power", .129, .61, .026, .28, "access-addition-poe-input", { role: "optional-poe-input" }),
    ...[.36, .731].map(x => part("fan", x, .08, .10, .82, "access-addition-fan-grille", { role: "fixed-fan" })),
    part("ground", .962, .25, .027, .61, "access-addition-ground", { role: "ground-studs" })];
  return { front: { ports, components: front }, rear: { ports: [], components: rear } };
}

/** Trace the non-PoE 2530 models' different copper-bank starts and shared four-cage/service block. */
function aruba2530Panels(device, count) {
  const ports = [], start = count === 48 ? .112 : .520;
  for (let i = 0; i < count; i++) {
    const col = Math.floor(i / 2), upper = i % 2 === 0;
    ports.push(socket(device, i + 1, start + col * .032 + Math.floor(col / 6) * .012,
      upper ? .35 : .70, .029, .25, upper ? "rj45-inverted" : "rj45", upper ? .10 : .94));
  }
  for (let i = 0; i < 4; i++) ports.push(socket(device, count + i + 1, .925 + Math.floor(i / 2) * .034,
    i % 2 ? .70 : .35, .032, .25, i % 2 ? "sfp-inverted" : "sfp", i % 2 ? .94 : .10));
  ports.push(socket(device, count + 5, .028, .71, .032, .27, "console", .94, .025, .048),
    socket(device, count + 6, .083, .385, .020, .060, "usb-micro", .94, .078, .05));
  return { front: { ports, components: [
    part("panel", .004, .025, .043, .88, "access-addition-hp-strip", { hardwareLayer: "chassis-container", captionBackground: true }),
    part("panel", .054, .04, .040, .235, "access-addition-hp-badge", { label: "2530" }),
    part("status-panel", .052, .515, .044, .34, "access-addition-hp-controls"),
  ] }, rear: { ports: [], components: [part("power", .862, .24, .063, .49, "ac-c14", { role: "ac-inlet" }),
    ...[.016, .5, .983].map(x => part("screw", x - .006, .844, .012, .12, "access-addition-screw")),
    part("panel", .795, .18, .032, .06, "access-addition-tiny-mark"),
  ] } };
}

/** Trace JL381A's two right-hand copper banks, stacked SFP pair, remote LED matrix and plain fanless rear. */
function officePanels(device) {
  const ports = [];
  for (let i = 0; i < 24; i++) {
    const col = Math.floor(i / 2), upper = i % 2 === 0;
    ports.push(socket(device, i + 1, .512 + col * .032 + Math.floor(col / 6) * .014,
      upper ? .38 : .72, .029, .25, upper ? "rj45-inverted" : "rj45", upper ? .12 : .945));
  }
  ports.push(socket(device, 25, .963, .38, .035, .25, "sfp", .12, .957, .05),
    socket(device, 26, .963, .72, .035, .25, "sfp-inverted", .945, .957, .05));
  return { front: { ports, components: [
    part("text", .012, .07, .330, .14, undefined, { label: "HPE OfficeConnect 1920S · JL381A", fontSize: 5.5 }),
    part("status-panel", .066, .375, .19, .44, "access-addition-office-led-matrix", { role: "24-port-led-matrix" }),
    part("status-panel", .009, .385, .038, .48, "access-addition-office-controls"),
  ] }, rear: { ports: [], components: [part("power", .887, .22, .067, .54, "ac-c14", { role: "ac-inlet" }),
    ...[.017, .50, .976].map(x => part("screw", x - .006, .845, .012, .12, "access-addition-screw")),
    part("panel", .024, .10, .10, .19, "access-addition-rating-label"),
  ] } };
}
