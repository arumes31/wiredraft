import { canonicalFaceplateDevice } from "./faceplate-profile.js";

const keys = new Set(["SEH\0myUTN-80", "Generic Facility\0Rack power strip 8 Schuko", "Generic Facility\0Rack power strip 8 C13 + 2 C19"]);
const rackGuide = "https://www.seh-technology.com/fileadmin/user/downloads/rmk/eb_RMK1_13.pdf";
const cache = new Map();

/** Resolve the exact accessory entry with canonical socket identity and the user's retained rack allocation. */
export function resolveRackAccessoryFaceplate(device) {
  if (!keys.has(`${device?.faceplate?.vendor}\0${device?.model}`)) return null;
  const canonical = canonicalFaceplateDevice(device);
  if (!canonical) return null;
  const units = Math.max(1, Number(device.faceplate.unitsU) || 1), key = `${canonical.catalog.vendor}\0${device.model}\0${units}`;
  if (!cache.has(key)) cache.set(key, buildProfile(canonical.device, canonical.catalog, units));
  return cache.get(key);
}

/** Disclose the selected enclosure and keep external inventories separate from hidden USB dongles. */
function buildProfile(device, catalog, units) {
  const seh = catalog.vendor === "SEH";
  return { id: seh ? "seh-myutn80-rmk1" : catalog.model.includes("Schuko") ? "generic-rack-schuko" : "generic-rack-iec",
    sku: catalog.sku, fidelity: seh ? "model" : "schematic", panelFidelity: { front: seh ? "model" : "schematic", rear: seh ? "model" : "schematic" },
    defaultFace: "front", inventoryRevision: 1, inventoryComplete: true, rearHardwareVerified: seh,
    source: catalog.source, sourcePage: seh ? "QIG PDF8 hardware,20 closed cover; RMK1 PDF14 rear,15 rack front" : "Generic configurable equipment contract",
    evidence: { scope: seh ? "model" : "schematic", models: [device.model], configuration: catalog.note,
      front: seh ? `${rackGuide}#page=15` : catalog.source, rear: seh ? `${rackGuide}#page=14` : catalog.source },
    note: catalog.note, legacyLayouts: [{ inventoryRevision: 0, portIndexMap: {} }],
    limitations: [catalog.note, "Power links document cable connections only; electrical loading, battery behavior and USB-over-IP operation are not simulated.",
      ...(seh ? ["The stored RJ45_1G physical class uses the manufacturer's 100Mbps rate; this model has no gigabit interface. The supplied DC barrel input is represented by Power. Hidden USB sockets are not exterior endpoints.",
        "Rear orthographic projection follows the RMK1 rear photograph. The separate power pack and its loose cables are outside the faceplate; rack tray depth is not shown."] : [])],
    chassis: { x: .025, y: .025 / units, width: .95, height: .80 / units, ...(seh ? { componentDrawn: true } : {}) },
    faces: seh ? sehPanels(device) : stripPanels(device) };
}

/** Reserve the center-based socket and its separate, capped caption region. */
function socket(device, index, x, y, width, height, kind, captionY, captionWidth = .075) {
  const port = device.ports.find(p => p.portIndex === index);
  return { portIndex: index, type: port.type, label: port.label, x, y, width, height, connectorKind: kind,
    descriptionAnchor: { x, y: captionY, fontSize: 5.5, boxHeight: 7, boxWidth: captionWidth } };
}

/** Describe a bounded physical assembly; only genuine containing panels opt into containment semantics. */
function part(kind, x, y, width, height, role, variant, extra = {}) {
  return { kind, x, y, width, height, role, variant, active: false, ...extra };
}

/** Trace the RMK1 plate and closed blue cover, plus the centered enclosure and DC jack from its rear photograph. */
function sehPanels(device) {
  const front = [part("panel", .004, .04, .992, .92, "rmk1-front-plate", "rack-accessory-silver", { hardwareLayer: "chassis-container" }),
    part("panel", .28, .05, .14, .90, "seh-status-face", "rack-accessory-seh-status", { hardwareLayer: "chassis-container" }),
    part("panel", .424, .05, .296, .90, "locked-dongle-cover", "rack-accessory-seh-cover"),
    part("text", .288, .07, .122, .15, "model-marking", undefined, { label: "myUTN-80", fontSize: 6, ink: "#315269" })];
  for (const x of [.021, .958]) for (const y of [.17, .72]) front.push(part("panel", x, y, .022, .14, "rack-mount-hole", "rack-accessory-mount-hole"));
  const rear = [part("panel", .28, .05, .44, .88, "seh-rear-body", "rack-accessory-seh-rear", { hardwareLayer: "chassis-container" }),
    part("panel", .004, .935, .992, .025, "rmk1-tray-edge", "rack-accessory-silver")];
  return { front: { components: front, ports: [socket(device, 1, .309, .49, .035, .35, "rj45", .79, .052)] },
    rear: { components: rear, ports: [socket(device, 2, .495, .58, .018, .18, "rack-dc-barrel", .83, .075)] } };
}

/** Place generic outlets in one horizontal row while keeping their keyed input on the rear. */
function stripPanels(device) {
  const schuko = device.model.includes("Schuko"), count = schuko ? 8 : 10;
  const ports = Array.from({ length: count }, (_, i) => socket(device, i + 1, .13 + i * .77 / (count - 1), .57,
    schuko ? .065 : i < 8 ? .035 : .045, schuko ? .67 : .42,
    schuko ? "rack-schuko" : i < 8 ? "rack-c13" : "rack-c19", .13, .075));
  const mounts = [.025, .952].flatMap(x => [.16, .71].map(y => part("panel", x, y, .023, .14, "rack-mount-hole", "rack-accessory-mount-hole")));
  return { front: { ports, components: mounts }, rear: { ports: [socket(device, count + 1, .15, .57, .050, .45, "rack-c20", .16)], components: mounts.map(p => ({ ...p })) } };
}
