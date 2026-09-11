import { canonicalFaceplateDevice } from "./faceplate-profile.js";

const source = "https://www.downloads.netgear.com/files/GDC/GS728TPS/GS7xxTS_TPS_HIG_18Jan2012.pdf";
const definitions = new Map([
  ["GS728T", { sku: "GS728TS", copper: 24, frontPage: 12, rearPage: 13 }],
  ["GS752T", { sku: "GS752TS", copper: 48, frontPage: 15, rearPage: 15 }],
]);
const profiles = new Map();

/** Select the explicitly documented TS suffix while preserving the saved alias and endpoint namespace. */
export function resolveNetgearTSFaceplate(device) {
  if (device?.faceplate?.vendor !== "NETGEAR" || !definitions.has(device.model)) return null;
  if (!profiles.has(device.model)) {
    const canonical = canonicalFaceplateDevice(device);
    if (!canonical) return null;
    profiles.set(device.model, tsProfile(canonical.device, definitions.get(device.model)));
  }
  return profiles.get(device.model);
}

/** Record the exact non-PoE configuration and the two additional shared-media apertures. */
function tsProfile(device, definition) {
  const { sku, copper, frontPage, rearPage } = definition;
  const original = copper + 4;
  return {
    id: `netgear-${sku.toLowerCase()}-2012`, sku, defaultFace: "front", fidelity: "model",
    inventoryRevision: 1, inventoryComplete: true, rearHardwareVerified: true,
    panelFidelity: { front: "model", rear: "model" }, source,
    sourcePage: `January 2012 guide: front ${frontPage}, rear ${rearPage}, shared media 19, stacking 28, specifications 35–36`,
    evidence: { scope: "model", models: [sku], selectedModel: sku, catalogAlias: device.model,
      configuration: `${sku}, non-PoE, ${copper} copper ports and six physical SFP apertures; standalone 1G uplinks and integrated AC supply.`,
      front: `${source}#page=${frontPage}`, rear: `${source}#page=${rearPage}`,
      provenance: "Original manufacturer photographs in the January 2012 hardware guide; other suffixes and hardware revisions are not substituted." },
    note: `${device.model} explicitly selects the ${sku} configuration documented in January 2012.`,
    limitations: [
      `Copper ${copper - 1}/${copper} and optical ${copper - 1}F/${copper}F are alternative media for two shared combo interfaces. All physical apertures are shown; both media of a combo cannot operate simultaneously.`,
      `Ports ${copper + 3}/${copper + 4} are shown as 1G uplinks. The documented optional AGC761 cable and stack mode support 2.5G stacking; this is not an extra pair of connectors.`,
      "The selected TS is non-PoE, with one integrated 100–240 VAC supply. TPS PoE variants have different controls and power requirements.",
      "The rear photograph has no exposed fan module. Side ventilation and top details are outside these normalized front/rear projections.",
      "Status lenses and the stack-ID display are static artwork. Identification labels omit device-specific MAC and serial data.",
    ],
    catalogDiscrepancies: [`Older ${device.model} inventories omit the two combo optical apertures. New devices append them at indices ${original + 1}/${original + 2}; existing endpoints, labels, speeds, VLANs, PoE settings and rack occupancy remain unchanged.`],
    legacyLayouts: [{ inventoryRevision: 0,
      portIndexMap: Object.fromEntries(Array.from({ length: original }, (_, i) => [i + 1, i + 1])),
      portLabels: Object.fromEntries(Array.from({ length: original }, (_, i) => [i + 1, String(i + 1)])),
    }],
    chassis: { x: .025, y: .04, width: .95, height: .92 },
    faces: { front: frontPanel(device.ports, definition), rear: rearPanel(definition) },
  };
}

/** Place ancillary source artwork without creating cable endpoints. */
function part(kind, x, y, width, height, role, variant) {
  return { kind, x, y, width, height, ...(role ? { role } : {}), ...(variant ? { variant } : {}) };
}

/** Keep source text inside its explicitly reserved chassis region. */
function marking(label, x, y, width, height, fontSize = 3) {
  return { ...part("text", x, y, width, height), label, fontSize };
}

/** Bind physical port order to immutable indices and reserve clear upper/lower captions. */
function socket(port, x, upper, kind, physicalLabel) {
  return { portIndex: port.portIndex, type: port.type, label: port.label, physicalLabel,
    connectorKind: kind, x, y: upper ? .40 : .725, width: kind === "sfp" ? .034 : .029, height: .25,
    descriptionAnchor: { x, y: upper ? .20 : .93, fontSize: 5.5, boxHeight: 7 } };
}

/** Leave real cutouts in the colored panel so its solid regions do not occupy any socket opening. */
function portPanelBackground(sockets) {
  const areas = [[.066, .10, .929, .175], [.066, .525, .929, .075], [.066, .85, .929, .125]];
  const columns = [...new Map(sockets.map((slot) => [slot.x, slot])).values()].sort((a, b) => a.x - b.x);
  let left = .066;
  for (const slot of columns) {
    const edge = slot.x - slot.width / 2;
    if (edge > left) areas.push([left, .275, edge - left, .575]);
    left = Math.max(left, slot.x + slot.width / 2);
  }
  if (left < .995) areas.push([left, .275, .995 - left, .575]);
  return areas.map(([x, y, width, height]) => ({
    ...part("panel-accent", x, y, width, height, "dark-port-panel"), taper: 0, color: "#2c3040",
  }));
}

/** Trace the TS photographs' two right-aligned or four full-width copper banks and three optical columns. */
function frontPanel(ports, { copper, sku }) {
  const large = copper === 48;
  const sockets = ports.slice(0, copper).map((port, index) => {
    const column = Math.floor(index / 2);
    return socket(port, (large ? .096 : .470) + column * .032 + Math.floor(column / 6) * .007,
      index % 2 === 0, index % 2 === 0 ? "rj45-inverted" : "rj45", String(index + 1));
  });
  const optical = [ports[copper + 4], ports[copper + 5], ...ports.slice(copper, copper + 4)];
  for (const [index, port] of optical.entries()) {
    sockets.push(socket(port, (large ? .89 : .877) + Math.floor(index / 2) * .040,
      index % 2 === 0, "sfp", String(copper - 1 + index)));
  }
  const components = [
    ...portPanelBackground(sockets),
    marking("NETGEAR", .004, .01, .10, .10, 7), marking(`ProSafe ${sku}`, .80, .01, .19, .10, 7),
    part("lcd", .044, .27, .019, .23, "stack-id", "seven-segment"),
    part("button", .012, .81, .008, .065, "reset", "reset"),
    part("button", .047, .81, .008, .065, "factory-defaults", "reset"),
    marking("Reset", .003, .91, .027, .06), marking("Defaults", .035, .91, .033, .06),
  ];
  for (const [index, label] of ["Power", "Fan", "Master"].entries()) {
    components.push({ ...part("led", .012, .275 + index * .105, .006, .045, `status-${label}`, "square"), active: false },
      marking(label, .022, .278 + index * .105, .022, .04, 2.5));
  }
  return { ports: sockets, components };
}

/** Trace each exact rear photograph's inlet location, security slot and unpersonalized identification labels. */
function rearPanel({ copper }) {
  const inletX = copper === 24 ? .876 : .810;
  return { ports: [], components: [
    part("power", inletX, .25, .065, .55, "integrated-ac", "ac-c14"),
    marking("100–240V~ 50–60Hz 1.4A max", inletX - .025, .85, .12, .075, 3.5),
    part("mounting-slot", .127, .42, .007, .18, "security-lock"),
    part("screw", .621, .06, .012, .12, "cover-fastener"),
    { ...part("panel-accent", .20, .18, .072, .17, "identification-label"), taper: 0, color: "#c5cccd" },
    { ...part("panel-accent", .20, .54, .072, .17, "identification-label"), taper: 0, color: "#c5cccd" },
  ] };
}
