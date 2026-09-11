import { canonicalFaceplateDevice } from "./faceplate-profile.js";

const root = "https://docs.paloaltonetworks.com/hardware/pa-5200-hardware-reference/";
const frontSource = `${root}pa-5200-series-firewall-overview/pa-5200-front-panel`;
const rearSource = `${root}pa-5200-series-firewall-overview/pa-5200-back-panel`;
const allocations = new Map();
let profile;

/** Fit the documented 3U chassis into saved allocations without changing rack occupancy. */
export function resolvePA5220Faceplate(device) {
  if (device?.faceplate?.vendor !== "Palo Alto" || device.model !== "PA-5200 family") return null;
  if (!profile) { const canonical = canonicalFaceplateDevice(device); if (!canonical) return null; profile = buildProfile(canonical.device); }
  const units = Math.max(1, Number(device.faceplate.unitsU) || 1);
  if (!allocations.has(units)) {
    const body = 690 * 133.3 / 482.6, scale = Math.min(1, (units * 100 - 28) / body);
    const width = 438.1 / 482.6 * scale, height = body * scale;
    allocations.set(units, { ...profile, chassis: { x: (1 - width) / 2, y: .06 / units, width, height: (height + Math.min(16, height / 4)) / (units * 100) } });
  }
  return allocations.get(units);
}

/** Name the selected hardware, source discrepancies and type-safe former endpoint mappings. */
function buildProfile(device) {
  const configuration = "PA-5220 with two 1100W AC supplies, two four-fan exhaust trays, two system SSDs and two log HDDs in their RAID-1 pairs, both front intake filters installed and empty optical cages.";
  return { id: "paloalto-pa5220", sku: "PA-5220", family: "PA-5220", fidelity: "model", panelFidelity: { front: "model", rear: "model" },
    inventoryRevision: 1, inventoryComplete: true, rearHardwareVerified: true, defaultFace: "front", source: frontSource,
    sourcePage: "PA-5220 front and AC back drawings/component tables; hardware reference PDF14-17,52-53",
    evidence: { scope: "model", models: ["PA-5220"], catalogAlias: device.model, selectedModel: "PA-5220", configuration, front: frontSource, rear: rearSource,
      supplemental: [`${root}pa-5200-series-firewall-specifications/pa-5200-series-physical-specifications`, `${root}pa-5200-series-firewall-specifications/pa-5200-series-electrical-specifications`] },
    limitations: [configuration, "The front component table says five LEDs, while its exact PA-5220 drawing shows eight lenses. This layout follows the drawing and leaves indicators inactive.",
      "PA-5250/5260/5280 100G capabilities are excluded. Storage capacity is disclosed only in the selected configuration; the artwork simplifies small legends, grille density and handles.",
      "Old copper1-4, MGMT1/index25 and console/index27 map to their matching physical sockets. Unsupported former copper5-16, 25G optics17-24 and MGMT2/index26 remain unmapped. Saved endpoints, settings, cables and rack units are unchanged.",
      "The existing normalized-width display contract is retained, matching native mechanical proportions at690px. Smaller saved allocations scale the body and hardware together; they do not acquire additional rack units."],
    legacyLayouts: [{ inventoryRevision: 0, portIndexMap: { 1: 1, 2: 2, 3: 3, 4: 4, 25: 31, 27: 30 }, portLabels: { 25: "MGMT1", 26: "MGMT2", 27: "CONSOLE" } }],
    faces: { front: frontPanel(device), rear: rearPanel() } };
}

/** Bind each physical socket to its canonical index and an independently bounded caption. */
function socket(device, index, x, y, kind, width = .031, height = .078, captionY = y < .5 ? .371 : .626, captionWidth = .039) {
  const port = device.ports.find(p => p.portIndex === index);
  return { portIndex: index, type: port.type, label: port.label, physicalLabel: index <= 24 ? String(index) : ({ 25: "HSCI", 26: "AUX-1", 27: "AUX-2", 28: "HA1-A", 29: "HA1-B", 30: "CON", 31: "MGT" })[index],
    x, y, width, height, connectorKind: kind, ...(index <= 4 ? { compatibleTypes: ["RJ45_1G", "RJ45_10G"] } : {}),
    descriptionAnchor: { x, y: captionY, fontSize: 5.5, boxHeight: 7, boxWidth: captionWidth } };
}

/** Describe source hardware without introducing an interactive network endpoint. */
function part(kind, x, y, width, height, role, variant, label) { return { kind, x, y, width, height, role, ...(variant ? { variant } : {}), ...(label ? { label } : {}) }; }

/** Trace the two filter strips around the copper, optical and dedicated service blocks. */
function frontPanel(device) {
  const ports = [], components = [part("vent", .015, .025, .970, .285, "upper-filter", "pa5220-mesh"), part("vent", .015, .690, .970, .285, "lower-filter", "pa5220-mesh"),
    part("text", .005, .45, .095, .10, "brand", undefined, "PALO ALTO"), part("text", .920, .350, .077, .08, "model", undefined, "PA-5220"),
    part("usb", .765, .549, .029, .038, "storage-usb")];
  for (let i = 0; i < 4; i++) ports.push(socket(device, i + 1, .127 + Math.floor(i / 2) * .034, i % 2 ? .555 : .431, i % 2 ? "rj45" : "rj45-inverted"));
  for (let i = 0; i < 16; i++) ports.push(socket(device, i + 5, .215 + Math.floor(i / 2) * .035 + (i >= 8 ? .012 : 0), i % 2 ? .555 : .431, "sfp", .033, .079));
  for (let i = 0; i < 4; i++) ports.push(socket(device, i + 21, .530 + Math.floor(i / 2) * .045, i % 2 ? .555 : .431, "qsfp", .042, .079, undefined, .044));
  ports.push(socket(device, 25, .627, .555, "qsfp", .044, .079, .635, .050),
    socket(device, 26, .679, .431, "sfp", .032, .079, .371, .045), socket(device, 27, .679, .555, "sfp", .032, .079, .635, .045),
    socket(device, 28, .728, .431, "rj45-inverted", .031, .078, .371, .045), socket(device, 29, .728, .555, "rj45", .031, .078, .635, .045),
    socket(device, 30, .779, .451, "rj45-inverted", .031, .078, .371, .044), socket(device, 31, .833, .555, "rj45-inverted", .031, .078, .635, .045));
  for (let i = 0; i < 8; i++) components.push(part("led", .880 + i % 2 * .013, .439 + Math.floor(i / 2) * .038, .008, .025, "status-indicator"));
  return { ports, components };
}

/** Preserve the rear drive stack, two four-fan trays, separated supplies and two-post ground lug. */
function rearPanel() {
  const components = [part("psu", .022, .649, .128, .317, "ac-supply", "pa5220-ac"), part("psu", .861, .649, .128, .317, "ac-supply", "pa5220-ac"),
    part("text", .025, .603, .115, .038, "supply-name", undefined, "PWR 1"), part("text", .865, .603, .115, .038, "supply-name", undefined, "PWR 2"),
    part("module-bay", .877, .030, .105, .079, "ground-lug", "pa5220-ground")];
  for (let i = 0; i < 4; i++) components.push(part("drive", .017, .056 + i * .135, .211, .115, "drive", "pa5220-drive", i < 2 ? `SYS ${i + 1}` : `LOG ${i - 1}`));
  for (const x of [.237, .555]) {
    components.push(part("module-bay", x, .019, .280, .963, "fan-tray", "pa5220-tray"));
    for (const dx of [.012, .147]) for (const y of [.074, .562]) components.push(part("fan", x + dx, y, .121, .378, "exhaust-fan", "pa5220-fan"));
    components.push(part("handle", x + .078, .477, .123, .035, "tray-handle", "pa5220-handle"));
  }
  return { ports: [], components };
}
