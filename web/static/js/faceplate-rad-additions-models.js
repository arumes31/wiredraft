import { canonicalFaceplateDevice } from "./faceplate-profile.js";
import { radAdditionProfiles } from "./catalog-rad-additions.js";

const selections = new Map(radAdditionProfiles.map(row => [`${row.vendor}\0${row.model}`, row]));
const cache = new Map();

/** Resolve exact RAD identities and preserve the source body inside any retained larger allocation. */
export function resolveRadAdditionFaceplate(device) {
  const key = `${device?.faceplate?.vendor}\0${device?.model}`, row = selections.get(key);
  if (!row) return null;
  if (!cache.has(key)) {
    const canonical = canonicalFaceplateDevice(device);
    if (!canonical) return null;
    cache.set(key, { profile: buildProfile(canonical.device, row), allocations: new Map() });
  }
  const entry = cache.get(key), value = Number(device.faceplate.unitsU), units = Number.isFinite(value) && value >= 1 ? value : 1;
  if (!entry.allocations.has(units)) entry.allocations.set(units, { ...entry.profile,
    chassis: { ...entry.profile.chassis, y: entry.profile.chassis.y / units, height: entry.profile.chassis.height / units } });
  return entry.allocations.get(units);
}

/** Describe one noninteractive physical assembly without adding a logical endpoint. */
function component(kind, x, y, width, height, variant, extra = {}) {
  return { kind, x, y, width, height, variant, active: false, ...extra };
}

/** Place a canonical rear socket by printed source identity rather than array order or editable labels. */
function socket(device, index, x, y, width, height, connectorKind, captionY, captionWidth = width) {
  const port = device.ports.find(port => port.portIndex === index);
  return { portIndex: index, type: port.type, label: port.label, physicalLabel: port.label, x, y, width, height, connectorKind,
    descriptionAnchor: { x, y: captionY, fontSize: 5.5, boxHeight: 7, boxWidth: captionWidth } };
}

/** Center the documented217mm appliance on an explicitly schematic rack shelf, keeping its source proportions. */
function mountPanel(panel, face) {
  const width = 217 / (482.6 * .985), left = (1 - width) / 2;
  return { ports: panel.ports.map(port => ({ ...port, x: left + width * port.x, width: width * port.width,
    descriptionAnchor: { ...port.descriptionAnchor, x: left + width * port.descriptionAnchor.x, boxWidth: width * port.descriptionAnchor.boxWidth } })),
  components: [
    component("mounting-bracket", .015, .965, .97, .035, "rad-addition-shelf", { role: "schematic-rack-shelf", accessoryFidelity: "schematic" }),
    ...[.005, .972].map(x => component("mounting-bracket", x, .08, .023, .86, "rad-addition-ear", { role: "schematic-rack-ear", accessoryFidelity: "schematic" })),
    component("panel", left, 0, width, .965, "rad-addition-body", { face, role: "source-body", bodyWidthMm: 217,
      hardwareLayer: "chassis-container", captionBackground: true }),
    ...panel.components.map(part => ({ ...part, x: left + width * part.x, width: width * part.width })),
  ] };
}

/** Build the inspected plastic six-data-port chassis; only revision1 records can map to its eight sockets. */
function buildProfile(device, row) {
  const heightMm = 43.7, body = 690 * heightMm / (482.6 * .965), rawHeight = body < 64 ? body / .8 : body + 16;
  const front = { ports: [], components: [component("status-panel", .035, .08, .93, .77, "rad-addition-front", { role: "front-status", ink: "#394d53" })] };
  const rear = { ports: [
    socket(device, 3, .337, .65, .080, .28, "sfp", .25, .095), socket(device, 4, .445, .65, .080, .28, "sfp", .25, .095),
    socket(device, 1, .553, .65, .080, .32, "rj45", .25, .095), socket(device, 2, .661, .65, .080, .32, "rj45", .25, .095),
    socket(device, 5, .769, .65, .080, .28, "sfp", .25, .095), socket(device, 6, .877, .65, .080, .28, "sfp", .25, .095),
    socket(device, 7, .238, .65, .067, .26, "mgmt", .89, .105), socket(device, 8, .238, .29, .067, .26, "console-inverted", .055, .105),
  ], components: [component("power", .045, .205, .125, .61, "ac-sideways-left", { role: "ac-inlet" }),
    component("status-panel", .181, .18, .014, .16, "rad-addition-warning", { role: "electrical-warning" })] };
  return { id: "rad-addition-etx203ax-plastic", sku: row.sku, family: row.model, note: row.note,
    fidelity: "model", panelFidelity: { front: "model", rear: "model" }, inventoryRevision: 1, inventoryComplete: true,
    legacyLayouts: [], rearHardwareVerified: true, defaultFace: "front", source: row.source,
    sourcePage: "RAD datasheet530-110-04/12 PDF1 exact front/rear photograph, PDF4 dimensions and management, PDF6 ordering; RAD2011 product presentation slide10 physical view",
    evidence: { scope: "model", models: [row.model], selectedModel: row.model, selectedSku: row.sku, configuration: row.note,
      front: row.source, rear: row.source, reviewed: "2026-09-11", physicalDimensions: { widthMm: 217, heightMm, rackWidthMm: 482.6 },
      rackCompatibility: "https://tech-guides.rad.com/MountingKit/MountingKit.aspx?rus=1", accessoryFidelity: "schematic" },
    limitations: [row.note,
      "Device geometry follows manufacturer photographs. The generic supporting shelf is schematic: exact RM-33-2 fasteners, brackets and position are not claimed. The official mounting guide confirms this plastic enclosure's19-inch rack compatibility.",
      "The selected GE license provides1Gbps data ports; MNG-ETH is10/100. Four SFP apertures contain no optics. The original plastic model has front LEDs and all connections rear; metal, NEBS, LTE and other media populations are not substituted.",
      "The2012 datasheet specifies217×43.7mm plastic enclosure; older manual/presentation rounded dimensions differ. Body aspect is retained at690, using the renderer's existing independently scaled width contract at460. Plastic curvature and tiny printing are approximated.",
      "Brand-new revision1 only. Unknown revisions/types stay unmapped. Saved IDs, labels, speeds, settings, links, sparse/reordered arrays and rack allocation are unchanged.",
    ], chassis: { x: .0075, y: .055, width: .985, height: rawHeight / 100, componentDrawn: true },
    faces: { front: mountPanel(front, "front"), rear: mountPanel(rear, "rear") } };
}
