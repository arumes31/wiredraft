import { canonicalFaceplateDevice } from "./faceplate-profile.js";

const guide = "https://wiki.teltonika-networks.com/view/QSG_RUTX50";
const dimensions = "https://wiki.teltonika-networks.com/images/2/28/Networking_rutx50_manual_spatial_measurements.pdf#page=2";
let cachedProfile;

/** Resolve the RUTX50's individually documented panels independently of saved Ethernet labels and ordering. */
export function resolveTeltonikaFaceplate(device) {
  if (device?.model !== "RUTX50" || device.faceplate?.vendor !== "Teltonika Networks") return null;
  const canonical = canonicalFaceplateDevice(device);
  if (!canonical) return null;
  if (!cachedProfile) cachedProfile = rutx50Profile(canonical.device);
  return cachedProfile;
}

/** Record the exact compact chassis and its complete fixed Ethernet inventory with both panel references. */
function rutx50Profile(device) {
  return {
    id: "teltonika-rutx50", sku: "RUTX50", fidelity: "model", inventoryComplete: true,
    panelFidelity: { front: "model", rear: "model" }, defaultFace: "front", source: guide,
    sourcePage: "Front and back labeled QSG illustrations; spatial measurements page 2",
    note: "The RUTX50 fixed front and rear follow its labeled quick-start drawings and dimensioned chassis projections.",
    evidence: { models: ["RUTX50"], scope: "model", reviewed: "2026-09-10",
      front: "https://wiki.teltonika-networks.com/images/0/05/RUTX50_Front_view_Schematics.png",
      rear: "https://wiki.teltonika-networks.com/images/f/f8/RUTX50_Back_view_Schematics.png",
      supplemental: dimensions,
      configuration: "RUTX50 fixed chassis with two closed physical SIM holders, exposed antenna sockets and no attached antenna rods or mounting accessories." },
    limitations: [
      "The 132 × 44.2 mm front/rear aspect is represented within its existing 1U display allocation. Top, side and DIN mounting details are outside these projections.",
      "LAN1 supports passive PoE input; the five Ethernet ports are not PoE output sources.",
      "Four mobile SMA, one GNSS SMA and two Wi-Fi RP-SMA connectors, storage USB, power/I/O and SIM hardware are artwork rather than additional network endpoints."],
    chassis: { x: .34, y: .05, width: .32, height: .9 },
    faces: { front: frontRUTX50(device), rear: rearRUTX50() },
  };
}

/** Place a normalized physical component without creating an endpoint for non-Ethernet hardware. */
function part(kind, x, y, width, height, role, label, variant) {
  return { kind, x, y, width, height, ...(role ? { role } : {}), ...(label ? { label } : {}), ...(variant ? { variant } : {}) };
}

/** Retain the four corner panel fasteners visible on both measured chassis projections. */
function cornerScrews() {
  return [.018, .935].flatMap((x) => [.06, .85].map((y) => part("screw", x, y, .046, .135)));
}

/** Trace the separated LAN/WAN row beneath two SIM holders and the left power, needle and reset controls. */
function frontRUTX50(device) {
  const centers = [.370, .490, .617, .738, .875];
  const ports = device.ports.map((port) => ({ portIndex: port.portIndex, type: port.type, label: port.label,
    physicalLabel: port.label, x: centers[port.portIndex - 1], y: .605, width: .11, height: .304,
    descriptionAnchor: { x: centers[port.portIndex - 1], y: .88 } }));
  return { ports, components: [...cornerScrews(),
    part("power", .058, .50, .06, .27, "power-io", undefined, "dc-keyed4"),
    part("handle", .153, .455, .009, .18, "sim-needle"),
    part("button", .150, .695, .018, .035, "reset", undefined, "reset"),
    part("led", .083, .793, .009, .025, "power-status"),
    part("module-bay", .350, .282, .158, .11, "sim-holder", "SIM1", "populated"),
    part("module-bay", .693, .282, .158, .11, "sim-holder", "SIM2", "populated"),
    part("button", .525, .318, .012, .035, "sim-eject", undefined, "reset"),
    part("button", .866, .318, .012, .035, "sim-eject", undefined, "reset"),
    ...[.083, .151, .218, .285].map((x) => part("led", x, .229, .012, .035, "wan-type")),
    ...[.398, .432, .466].map((x) => part("led", x, .221, .012, .035, "mobile-type")),
    ...[.743, .778, .812].map((x) => part("led", x, .221, .012, .035, "signal-strength")),
    ...[.245, .278].map((x) => part("led", x, .79, .012, .035, "wifi-band")),
  ] };
}

/** Trace five upper SMA sockets, two lower Wi-Fi sockets and the distinct rear USB and grounding hardware. */
function rearRUTX50() {
  const width = .052;
  const height = .156;
  return { ports: [], components: [...cornerScrews(),
    ...[13.75, 39.90, 66, 92.15, 118.25].map((millimeters, index) =>
      part("coax", millimeters / 132 - width / 2, .245 - height / 2, width, height, index === 2 ? "gnss" : "mobile")),
    ...[26.8, 79.05].map((millimeters) => part("coax", millimeters / 132 - width / 2, .734 - height / 2, width, height, "wifi")),
    part("usb", .746, .587, .102, .157, "storage"),
    part("screw", .084, .626, .04, .12, "ground"),
  ] };
}
