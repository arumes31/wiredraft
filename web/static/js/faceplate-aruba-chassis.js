import { canonicalFaceplateDevice } from "./faceplate-profile.js";

const sources = {
  "CX 6400 family": "https://arubanetworking.hpe.com/techdocs/hardware/switches/6400/IGSG/Aruba_6400_IGSG.pdf",
  "CX 8400 family": "https://arubanetworking.hpe.com/techdocs/hardware/switches/8400/IGSG/Aruba%208400_IGSG_en_us.pdf",
};
const cache = new Map();

/** Resolve only the selected modular configurations and fit their native body into saved rack bounds. */
export function resolveArubaChassisFaceplate(device) {
  if (device?.faceplate?.vendor !== "HPE Aruba" || !sources[device.model]) return null;
  const canonical = canonicalFaceplateDevice(device);
  if (!canonical) return null;
  if (!cache.has(canonical.catalog)) cache.set(canonical.catalog, { profile: buildChassis(canonical.device), allocations: new Map() });
  const cached = cache.get(canonical.catalog); const native = device.model === "CX 6400 family" ? 7 : 8;
  const units = Math.max(1, Number(device.faceplate.unitsU) || native);
  if (units === native) return cached.profile;
  if (!cached.allocations.has(units)) {
    const body = native * 100 * cached.profile.chassis.height - 16;
    const available = units * 100 * .94 - 16;
    const scale = Math.min(1, available / body);
    cached.allocations.set(units, { ...cached.profile, chassis: {
      x: (1 - .95 * scale) / 2, y: .03 * Math.min(1, native / units), width: .95 * scale,
      height: (body * scale + 16) / (units * 100),
    } });
  }
  return cached.allocations.get(units);
}

/** Describe a visible physical part; installed cards use edge strips so labels remain in open panel space. */
function part(kind, x, y, width, height, variant, label) {
  return { kind, x, y, width, height, ...(variant ? { variant } : {}), ...(label ? { label } : {}) };
}

/** Bind a current immutable socket to its printed number and explicit historical connector compatibility. */
function socket(port, x, y, width, height, physicalLabel, captionX, captionY, connectorKind, compatibleTypes = [], captionWidth) {
  return { portIndex: port.portIndex, type: port.type, label: port.label, x, y, width, height, physicalLabel,
    descriptionAnchor: { x: captionX, y: captionY, fontSize: 5.5, boxHeight: 7, ...(captionWidth ? { boxWidth: captionWidth } : {}) },
    ...(connectorKind ? { connectorKind } : {}), ...(compatibleTypes.length ? { compatibleTypes } : {}) };
}

/** Record selected parts, revision-zero identities, source pages and excluded family variants. */
function buildChassis(device) {
  const small = device.model === "CX 6400 family"; const source = sources[device.model];
  const configuration = small
    ? "R0X26A 6405 7U: R0X44A 48-port SFP28 module in line slot3; R0X31A management module in slot1; two R0X36A 3000W supplies and matching rear C20 inlet accessories in PSU slots1/2; two R0X32A trays with four fixed fans each. Line slots4–7, management slot2 and PSU/inlet slots3/4 are covered; the PSU bezel is installed."
    : "JL376A 8400 8U bundle: JL363A 32-port 10G SFP+ module in line slot1, JL365A eight-port40G QSFP+ module in line slot7; JL368A management module in slot5; three JL372A 2700W AC supplies in PSU slots1–3, two JL367A fabric modules in rear slots1/2, three JL371A fan-tray bundles containing18 JL370A fans. Remaining front slots are covered; the PSU bezel and all fan trays are installed, concealing supplies and fabric modules.";
  const map = small ? { ...Object.fromEntries(Array.from({ length: 48 }, (_, i) => [i + 1, i + 1])), 57: 49, 59: 50 }
    : { ...Object.fromEntries(Array.from({ length: 32 }, (_, i) => [i + 1, i + 1])),
      ...Object.fromEntries(Array.from({ length: 8 }, (_, i) => [i + 49, i + 33])), 57: 41, 59: 42 };
  return { id: small ? "aruba-r0x26a" : "aruba-jl376a", sku: small ? "R0X26A" : "JL376A", family: small ? "Aruba6405" : "Aruba8400",
    defaultFace: "front", fidelity: "model", panelFidelity: { front: "model", rear: "model" },
    inventoryComplete: true, rearHardwareVerified: true, inventoryRevision: 1, source,
    sourcePage: small ? "Installation guide pages25–38; QuickSpecs R0X26A configuration table" : "Installation guide pages8,21–34; QuickSpecs page2 front photograph and JL376A bundle table",
    evidence: { scope: "model", models: [small ? "R0X26A" : "JL376A"], catalogAlias: device.model,
      selectedModel: small ? "R0X26A" : "JL376A", configuration, inventory: source,
      front: `${source}#page=${small ? 27 : 25}`, rear: `${source}#page=${small ? 37 : 32}`,
      quickSpecs: `https://support.hpe.com/hpesc/public/api/document/${small ? "a00073541enw" : "a00017758enw"}` },
    legacyLayouts: [{ inventoryRevision: 0, portIndexMap: map, portLabels: { 57: "MGMT1", 59: "CONSOLE" } }],
    note: configuration,
    limitations: [configuration, "Installed slot positions are the explicitly selected configuration; the family alias does not describe every chassis or card population.",
      "The front bezel conceals the power modules. Rear power receptacles are chassis inlet accessories, not rear-mounted power supplies. Internal hardware and side/top panels are outside the projection.",
      "Relative geometry follows the manufacturer's diagrams and photographs, without claiming manufacturing dimensions. A historical smaller rack allocation fits the physical body without changing the saved device or rack placement."],
    catalogDiscrepancies: [small
      ? "Historical optical49–56 and second management58 have no sockets in the selected single-card6405 and stay unmapped. Old57 MGMT maps to49 and old59 USB-C maps to50; new RJ45 serial51 is new-instance-only."
      : "Historical SFP28 endpoints1–32 map to the32 physical10G cages; QSFP-DD49–56 map to eight physical40G cages. Saved types, speeds and edits remain unchanged. Old33–48 and second management58 stay unmapped. Old57 MGMT maps to41 and old59 USB-C serial maps to physical Micro-USB42; RJ45 serial43 is new only."],
    chassis: { x: .025, y: .03, width: .95, height: small ? .66 : .70 },
    faces: small ? panels6405(device.ports) : panels8400(device.ports),
  };
}

/** Trace the five horizontal line slots, left management module and installed PSU bezel of the6405. */
function panels6405(ports) {
  const sockets = []; const front = [part("vent", .015, .015, .97, .142, "aruba-chassis-bezel", "HPE")];
  // Slot1 management is left; slot2 is a blank half-width panel.
  front.push(part("module-bay", .51, .17, .47, .10, "aruba-chassis-blank"),
    part("vent", .025, .176, .46, .012, "aruba-chassis-grille"),
    part("status-panel", .046, .208, .21, .045, "aruba-chassis-status"),
    part("usb", .277, .211, .012, .039), part("text", .432, .192, .055, .02, undefined, "R0X31A"));
  sockets.push(socket(ports[48], .320, .221, .032, .039, "MGMT", .320, .263),
    socket(ports[49], .419, .237, .025, .013, "USB", .419, .263, "usb-c"),
    socket(ports[50], .374, .221, .032, .039, "CON", .374, .263));
  for (let slot = 0; slot < 5; slot++) {
    const y = .286 + slot * .139;
    if (slot > 0) front.push(part("module-bay", .025, y, .95, .128, "aruba-chassis-blank", String(slot + 3)));
    else {
      front.push(part("vent", .031, y, .938, .010, "aruba-chassis-grille"),
        part("text", .025, y + .045, .035, .023, undefined, "3"),
        part("text", .025, y + .080, .043, .018, undefined, "R0X44A"));
      for (let i = 0; i < 48; i++) {
        const col = Math.floor(i / 2); const lower = i % 2 === 1;
        const x = .088 + col * .0339 + Math.floor(col / 4) * .011;
        sockets.push(socket(ports[i], x, y + (lower ? .087 : .045), .030, .026, String(i + 1), x, y + (lower ? .117 : .018)));
      }
    }
  }
  const rear = [part("vent", .022, .24, .82, .045, "aruba-chassis-grille"),
    part("status-panel", .845, .075, .125, .15, "aruba-chassis-status"),
    part("screw", .445, .969, .022, .028), part("screw", .486, .969, .022, .028)];
  for (let i = 0; i < 4; i++) rear.push(part("power", .027 + i * .202, .034, .191, .17,
    i < 2 ? "aruba-6405-inlet" : "aruba-chassis-blank", String(i + 1)));
  for (let i = 0; i < 2; i++) rear.push(part("fan", .027, .313 + i * .328, .943, .301, "aruba-6405-fan-tray", String(i + 1)));
  return { front: { ports: sockets, components: front }, rear: { ports: [], components: rear } };
}

/** Trace the8400's vertical line-card banks, single management module and three complete rear fan trays. */
function panels8400(ports) {
  const sockets = []; const front = [part("vent", .012, .012, .976, .126, "aruba-chassis-bezel", "HPE")];
  const pitch = .095; const start = .025;
  for (let index = 0; index < 10; index++) {
    const x = start + index * pitch; const slot = index + 1;
    if (![1, 5, 7].includes(slot)) {
      front.push(part("module-bay", x, .15, .087, .83, "aruba-chassis-blank", String(slot))); continue;
    }
    front.push(part("vent", x, .15, .006, .83, "aruba-chassis-grille"),
      part("text", x + .022, .154, .040, .020, undefined, String(slot)),
      part("screw", x + .032, .965, .018, .014));
  }
  for (let i = 0; i < 32; i++) {
    const row = Math.floor(i / 2); const right = i % 2 === 1;
    const x = start + (right ? .067 : .029); const y = .204 + row * .0445 + Math.floor(row / 4) * .012;
    sockets.push(socket(ports[i], x, y, .020, .031, String(i + 1), x, y - .02225, "sfp-vertical", ["SFP28_25G"], .032));
  }
  const opticX = start + 6 * pitch;
  front.push(part("vent", opticX + .032, .224, .028, .17, "aruba-chassis-grille"));
  for (let i = 0; i < 8; i++) {
    const y = .470 + i * .060;
    sockets.push(socket(ports[32 + i], opticX + .033, y, .023, .043, String(i + 1), opticX + .068, y, "qsfp-vertical", ["QSFP_DD_400G"], .028));
  }
  const mm = start + 4 * pitch;
  front.push(part("status-panel", mm + .017, .19, .056, .43, "aruba-chassis-status"),
    part("usb", mm + .022, .697, .047, .015));
  sockets.push(socket(ports[40], mm + .046, .920, .037, .042, "MGMT", mm + .046, .958, undefined, [], .066),
    socket(ports[41], mm + .024, .772, .010, .024, "USB", mm + .054, .772, "usb-micro-vertical", ["USB_C_CONSOLE"], .027),
    socket(ports[42], mm + .046, .841, .037, .042, "CON", mm + .046, .879, undefined, [], .066));
  const rear = [part("vent", .025, .028, .95, .204, "aruba-chassis-grille"),
    part("status-panel", .038, .160, .365, .067, "aruba-chassis-status"),
    part("module-bay", .520, .169, .269, .057, "aruba-chassis-blank"),
    part("screw", .89, .213, .026, .027), part("screw", .941, .213, .026, .027)];
  for (let i = 0; i < 4; i++) rear.push(part("power", .108 + i * .238, .045, .089, .074, "aruba-8400-inlet", String(4 - i)));
  for (let tray = 0; tray < 3; tray++) {
    const y = .270 + tray * .237;
    rear.push(part("text", .025, y, .033, .020, undefined, String(tray + 1)));
    for (let fan = 0; fan < 6; fan++) rear.push(part("fan", .034 + fan * .157, y + .025, .145, .193, "aruba-8400-fan", String(fan + 1)));
  }
  return { front: { ports: sockets, components: front }, rear: { ports: [], components: rear } };
}
