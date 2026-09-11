import { canonicalFaceplateDevice } from "./faceplate-profile.js";

const stencil = "https://www.raritan.com/assets/ram/resources/visio_stencils/raritan-dsx2-n.vss";
const guide = "https://cdn1.raritan.com/download/sxii/2.6.0/SX2-UserGuide-v2.6.0.pdf";
let cachedProfile;
let cachedWithoutAdminLeader;

/** Select the documented 48-port modem appliance without using mutable saved labels or port counts. */
export function resolveRaritanFaceplate(device) {
  if (device?.faceplate?.vendor !== "Raritan" || device.model !== "Dominion Serial family" || device.category !== "Switch") return null;
  const canonical = canonicalFaceplateDevice(device);
  if (!canonical) return null;
  if (!cachedProfile) {
    cachedProfile = dsx248M(canonical.device);
    cachedWithoutAdminLeader = { ...cachedProfile, faces: { ...cachedProfile.faces,
      rear: { ...cachedProfile.faces.rear,
        components: cachedProfile.faces.rear.components.filter((component) => component.role !== "admin-caption-leader") } } };
  }
  const hasAdmin = device.faceplate.inventoryRevision === 1 && Array.isArray(device.ports) &&
    device.ports.some((port) => port.portIndex === 52 && port.type === "USB_MINI_CONSOLE");
  return hasAdmin ? cachedProfile : cachedWithoutAdminLeader;
}

/** Record the exact selected modem/dual-AC configuration and the scope of the original manufacturer drawings. */
function dsx248M(device) {
  const configuration = "Dominion SX II DSX2-48M, 48 serial device ports, dual 10/100/1000 Ethernet LAN, internal POTS modem and two integrated 100–240 VAC supplies. Both front power inlets are drawn; no external modems or KVM peripherals are installed.";
  return { id: "raritan-dsx2-48m-ac", sku: "DSX2-48M · dual AC · internal modem", fidelity: "model",
    inventoryRevision: 1, inventoryComplete: true, panelFidelity: { front: "model", rear: "model" },
    defaultFace: "rear", source: stencil, sourcePage: "Manufacturer Visio front/rear masters 7–8 (DSX2-48M); SX II 2.6 guide pages 7, 12–13 and 51",
    note: configuration,
    evidence: { models: ["Dominion Serial family"], sku: "DSX2-48M", scope: "model", reviewed: "2026-09-10",
      configuration, stencil, front: stencil, rear: stencil, guide,
      ordering: "https://www.raritan.com/products/kvm-serial/serial-console-servers/serial-over-ip-console-server",
      provenance: "Original manufacturer Visio stencil, matching DSX2-48M front and rear masters rendered from their embedded EMF drawings. The generic guide illustration is used for connector roles, not substituted for this 48-port panel or its numbering." },
    legacyLayouts: [{ inventoryRevision: 0,
      portIndexMap: Object.fromEntries(Array.from({ length: 50 }, (_, index) => [index + 1, index + 1])),
      portLabels: Object.fromEntries([...Array.from({ length: 48 }, (_, index) => [index + 1, String(index + 1)]), [49, "MGMT1"], [50, "MGMT2"]]) }],
    limitations: [configuration,
      "The family alias explicitly selects DSX2-48M. The non-modem DSX2-48, DC-powered models and other port counts are not depicted.",
      "The internal 56K POTS modem is an analog telephone endpoint, not DSL or Ethernet. Its integer-Mbps speed is 0; new telephone cables have no VLANs.",
      "The front USB-A and three rear USB-A sockets are peripheral hosts; rear DVI-D is ancillary local video. They are artwork rather than serial or Ethernet endpoints.",
      "The source establishes a keyed RJ11 modem housing but does not resolve its populated contact count. The telephone artwork deliberately omits guessed contacts.",
      "Blue front port indicators and the power indicator are static source artwork, not live device status. Unidentified small rear apertures are neutral holes, not invented status lamps.",
      "The front/rear projections retain the drawing's rack ears and supply grilles. The top, sides and projecting cables are outside these views.",
      "Readable application captions are offset from tiny source markings. ADMIN has a short leader around the DVI-D connector to its mini-B socket; the leader is an annotation, not chassis hardware."],
    catalogDiscrepancies: [
      "Legacy indices 1–48 retain their serial sockets; management 49/50 retain physical LAN1/LAN2, including IDs, custom captions, speeds, VLANs and rack placement.",
      "New revision-1 inventories append local RJ45 TERMINAL 51, mini-B USB ADMIN 52 and POTS MODEM 53. Existing saved inventories are preserved without adding these endpoints."],
    chassis: { x: 0, y: .1, width: 1, height: .8 },
    faces: { front: front248M(), rear: rear248M(device) } };
}

/** Place one non-interactive source component in normalized chassis coordinates. */
function part(kind, x, y, width, height, role, variant) {
  return { kind, x, y, width, height, ...(role ? { role } : {}), ...(variant ? { variant } : {}) };
}

/** Keep a small printed marking separate from application and cable captions. */
function marking(label, x, y, width, height, fontSize, ink) {
  return { ...part("text", x, y, width, height), label, fontSize, ...(ink ? { ink } : {}) };
}

/** Preserve the four horizontal rack-ear mounting apertures visible on each manufacturer projection. */
function rackEars() {
  return [.006, .974].flatMap((x) => [.065, .79].map((y) => part("mounting-slot", x, y, .020, .14, "rack-mount")));
}

/** Trace the front's numbered indicator banks and power 2/1 with their separate horizontal switches. */
function front248M() {
  const components = [
    { ...part("panel-accent", .050, .01, .562, .98, "black-front-panel"), taper: 0, color: "#192024" },
    ...rackEars(),
    marking("Raritan", .068, .12, .09, .20, 8, "#e5edf0"),
    marking("Dominion SX II", .322, .12, .11, .20, 7, "#e5edf0"),
    marking("DSX2-48M", .543, .12, .062, .20, 6, "#e5edf0"),
    part("usb", .086, .585, .034, .15, "front-usb-host"),
    { ...part("led", .097, .46, .011, .055, "power-status", "bar"), color: "#297dc4" },
    part("vent", .625, .055, .073, .85, "supply-2-grille", "honeycomb"),
    part("vent", .854, .055, .075, .85, "supply-1-grille", "honeycomb"),
    marking("Rating: 100–240V~, 47–63Hz, 0.6A Max", .709, .015, .132, .075, 3),
  ];
  for (const [bank, x] of [.174, .318, .462].entries()) for (let column = 0; column < 8; column++) {
    for (const [row, y] of [.615, .44].entries()) {
      const index = bank * 16 + row * 8 + column + 1;
      const left = x + column * .0144;
      components.push({ ...part("led", left, y, .0065, .065, `serial-status-${index}`, "square"), color: "#297dc4" });
      components.push(marking(String(index), left - .0025, row ? .33 : .70, .0115, .085, 3.5, "#dbe6eb"));
    }
  }
  for (const [index, x] of [.715, .784].entries()) {
    const power = 2 - index;
    components.push(part("button", x + .002, .22, .045, .19, `power-switch-${power}`, "rocker-horizontal"),
      part("power", x, .49, .05, .37, `power-${power}`, "ac-c14-inverted"),
      marking(String(power), x - .011, .11, .009, .09, 3.5));
  }
  for (const [x, y] of [[.692, .08], [.626, .835], [.921, .08], [.859, .835]]) {
    components.push(part("screw", x, y, .008, .085, "grille-fastener"));
  }
  return { ports: [], components };
}

/** Bind a physical socket to a durable inventory index and the separately traced printed caption. */
function socket(device, index, x, y, width, height, physicalLabel, captionY, captionX = x, fontSize = 4.5) {
  const port = device.ports.find((candidate) => candidate.portIndex === index);
  if (!port) throw new Error(`DSX2-48M canonical port ${index} is missing`);
  return { portIndex: index, type: port.type, label: port.label, x, y, width, height, physicalLabel,
    descriptionAnchor: { x: captionX, y: captionY, fontSize, boxHeight: 6 },
    ...(index <= 48 && (index - 1) % 16 >= 8 ? { connectorKind: "console-inverted" }
      : index === 50 ? { connectorKind: "rj45-inverted" } : index === 52 ? { connectorKind: "usb-mini" }
      : index === 53 ? { connectorKind: "rj11" } : {}) };
}

/** Route a readable mini-B caption around the source hardware using narrow orthogonal annotation segments. */
function adminCaptionLeader() {
  return [[.0972, .433, .0006, .042], [.0972, .471, .0454, .004],
    [.142, .471, .0006, .401], [.0972, .868, .0454, .004]].map(([x, y, width, height], index) => ({
    ...part("leader-line", x, y, width, height, "admin-caption-leader", width < height ? "vertical" : "horizontal"),
    color: "#c1d1d5", annotation: true, applicationOverlay: true,
    ...(index === 3 ? { captionPortIndex: 52 } : {}),
  }));
}

/** Trace rear serial banks with lower 1–8 and upper 9–16, plus the exact local console and LAN stack. */
function rear248M(device) {
  const ports = Array.from({ length: 48 }, (_, position) => {
    const bank = Math.floor(position / 16), inBank = position % 16;
    const upper = inBank >= 8;
    return socket(device, position + 1, [.230, .475, .720][bank] + (inBank % 8) * .0289,
      upper ? .31 : .68, .0255, .235, String(position + 1), upper ? .10 : .905);
  });
  ports.push(socket(device, 49, .1936, .69, .029, .24, "LAN1", .93, .1936, 4),
    socket(device, 50, .1936, .313, .029, .24, "LAN2", .10, .1936, 4),
    socket(device, 51, .0695, .33, .033, .30, "TERMINAL", .535, .082, 4),
    socket(device, 52, .0975, .393, .012, .08, "ADMIN", .87, .0975, 4),
    socket(device, 53, .1245, .325, .025, .285, "MODEM", .535, .122, 4));
  const components = [...rackEars(),
    part("dvi-d", .067, .60, .067, .16, "local-video"),
    marking("DVI", .081, .76, .04, .05, 3),
    ...[.27, .465, .66].map((y) => part("usb", .145, y, .028, .11, "rear-usb-host")),
    marking("USB", .148, .17, .026, .07, 3.5),
    part("button", .157, .83, .009, .09, "reset", "reset"),
    marking("RESET", .146, .935, .032, .06, 3.5),
    ...adminCaptionLeader(),
  ];
  for (const [x, y] of [[.091, .09], [.102, .09], [.091, .20], [.102, .20], [.118, .09], [.130, .09],
    [.153, .09], [.163, .09], [.054, .60], [.054, .70], [.054, .80], [.054, .90]]) {
    components.push(part("service-jack", x - .0018, y - .02, .0036, .04, "unidentified-aperture"));
  }
  return { ports, components };
}
