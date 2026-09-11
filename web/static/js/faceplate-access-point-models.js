import { canonicalFaceplateDevice } from "./faceplate-profile.js";

const ap635Guide = "https://arubanetworking.hpe.com/techdocs/hardware/aps/ap630/ig/AP-630_Install_Guide_EN.pdf";
const cw9166Guide = "https://www.cisco.com/c/en/us/td/docs/wireless/access_point/cw916x/cw9166/install-guide/b-hig-cw9166i/hardware-features.html";
const fap231fGuide = "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/c03ec18a-01b9-11eb-96b9-00505692583a/FortiAP-231F-QSG.pdf";
let ap635Profile;
let cw9166Profile;
let fap231fProfile;

/** Resolve only access-point models whose front and underside drawings have been individually inspected. */
export function resolveAccessPointFaceplate(device) {
  if (device?.faceplate?.vendor === "Fortinet" && device.model === "FortiAP 231F") {
    const canonical = canonicalFaceplateDevice(device);
    if (!canonical) return null;
    fap231fProfile ||= fap231fModel(canonical.device.ports);
    return fap231fProfile;
  }
  if (device?.faceplate?.vendor === "Cisco" && device.model === "Catalyst 9166I") {
    const canonical = canonicalFaceplateDevice(device);
    if (!canonical) return null;
    cw9166Profile ||= cw9166Model(canonical.device.ports);
    return cw9166Profile;
  }
  if (device?.faceplate?.vendor !== "HPE Aruba" || device.model !== "AP-635") return null;
  if (!ap635Profile) {
    const canonical = canonicalFaceplateDevice(device);
    if (!canonical) return null;
    ap635Profile = {
      id: "aruba-ap-635", sku: "AP-635", defaultFace: "rear", fidelity: "model",
      panelFidelity: { front: "model", rear: "model" },
      source: ap635Guide, sourcePage: "Front printed page 4 (PDF 6); back printed page 7 (PDF 9)",
      evidence: { models: ["AP-635"], front: `${ap635Guide}#page=6`, rear: `${ap635Guide}#page=9` },
      note: "The AP-635 cover and underside follow Figures 1 and 3 of the May 2025 installation guide.",
      limitations: [
        "Rear means the mounting underside. Ethernet and DC sockets occupy its lower-right diagonal edge; connector art remains upright in this projection.",
        "Curved perimeter heatsink ribs are represented by straight fin segments. The cover's decorative swirl and optional mounting kits are omitted.",
      ],
      catalogDiscrepancies: [
        "New catalog instances append the Micro-B serial console. Existing E0/E1 inventory indices are retained. The USB host connector and DC power jack remain nonconnectable artwork.",
      ],
      chassis: { x: .04, y: .04, width: .92, height: .92, shape: "square" },
      faces: ap635Panels(canonical.device.ports),
    };
  }
  return ap635Profile;
}

/** Describe the bare FAP-231F with its fixed Ethernet and serial inventory. */
function fap231fModel(ports) {
  return {
    id: "fortinet-fap-231f", sku: "FAP-231F", defaultFace: "rear", fidelity: "model", inventoryComplete: true,
    inventoryRevision: 1,
    legacyLayouts: [{ inventoryRevision: 0, portIndexMap: { 1: 1, 2: 2 }, portLabels: { 1: "ETH0", 2: "ETH1" } }],
    panelFidelity: { front: "model", rear: "model" }, rearHardwareVerified: true,
    source: fap231fGuide, sourcePage: "PDF 3: cover, underside and connector edges; PDF 4: indicators and mounting",
    note: "The FAP-231F cover and bare mounting underside follow the individual March 2024 QuickStart Guide illustrations.",
    evidence: { models: ["FortiAP 231F"], scope: "model", reviewed: "2026-09-10",
      front: `${fap231fGuide}#page=3`, rear: `${fap231fGuide}#page=3`,
      configuration: "FAP-231F bare housing without either optional ceiling bracket; no external power adapter or USB device is drawn.",
    },
    limitations: [
      "Rear means the mounting underside. Its two connector edges are folded out and drawn face-on: the bottom network edge reads CONSOLE, LAN2, LAN1/PoE, RESET, DC from left to right when looking into the sockets; USB occupies the opposite edge.",
      "The underside's printed callouts look across the connector edge from the opposite direction. They are not mirrored into the unfolded socket row. Curved heatsink ribs and tapered mounting keyholes use simplified straight ribs and rounded openings.",
      "This is FAP-231F, not the distinct FAP-U231F enclosure. LAN1 receives PoE; neither Ethernet port is modeled as a PoE output.",
    ],
    catalogDiscrepancies: ["Revision 1 retains ETH0 as LAN1/PoE at index 1 and ETH1 as LAN2 at index 2, then appends the omitted RJ45 console at index 3. Saved names, settings and cable references remain intact."],
    chassis: { x: .04, y: .04, width: .92, height: .92, shape: "square" },
    faces: fap231fPanels(ports),
  };
}

/** Trace the cover indicators, underside ribs and keyed mounts with two unfolded connector edges. */
function fap231fPanels(ports) {
  const physical = [[1, .675, "LAN1/PoE"], [2, .535, "LAN2"], [3, .395, "CONSOLE"]];
  const sockets = physical.map(([index, x, label]) => ({
    ...socket(ports.find((port) => port.portIndex === index), x, .82, .092, .082, index === 3 ? "console" : "rj45"),
    physicalLabel: label, descriptionAnchor: { x, y: .92 },
  }));
  const front = [part("text", .30, .46, .40, .055, "FORTINET"),
    { ...part("text", .36, .52, .28, .035, "FortiAP 231F"), fontSize: 7 },
    { ...part("vent", .325, .845, .35, .008, undefined, "slit"), role: "indicator-strip" }];
  for (const [index, label] of ["PWR", "LAN1", "LAN2", "Wi-Fi", "BLE"].entries()) {
    const x = .345 + index * .072;
    front.push({ ...part("led", x, .87, .012, .012), role: `indicator-${label}` },
      { ...part("text", x - .022, .9, .057, .026, label), fontSize: 6 });
  }
  const rear = [
    { ...part("usb", .655, .018, .060, .033), role: "usb-host" },
    ...[[.10, .17], [.87, .17], [.10, .73], [.87, .73]].map(([x, y]) =>
      ({ ...part("screw", x, y, .033, .033), role: "cover-screw" })),
    { ...part("vent", .17, .03, .43, .13, undefined, "fins"), role: "heatsink-ribs" },
    { ...part("vent", .75, .03, .10, .13, undefined, "fins"), role: "heatsink-ribs" },
    { ...part("vent", .03, .22, .12, .50), role: "heatsink-ribs" },
    { ...part("vent", .85, .22, .12, .50), role: "heatsink-ribs" },
    ...[.205, .245, .285, .325].map((y) =>
      ({ ...part("vent", .40, y, .40, .016, undefined, "slit"), role: "heatsink-ribs" })),
    ...[.57, .615, .66, .705].map((y) =>
      ({ ...part("vent", .18, y, .32, .016, undefined, "slit"), role: "heatsink-ribs" })),
    ...[[.18, .20], [.565, .585]].flatMap(([x, y]) => [
      { ...part("chassis", x, y, .19, .13), role: "mounting-recess" },
      { ...part("ring", x + .022, y + .029, .075, .075), role: "mounting-keyhole" },
      { ...part("vent", x + .085, y + .047, .080, .035, undefined, "slit"), role: "mounting-key-slot" },
    ]),
    ...[[.21, .745, .65, .012], [.21, .97, .65, .012], [.21, .745, .012, .235], [.85, .745, .012, .235]]
      .map(([x, y, width, height]) => ({ ...part("chassis", x, y, width, height), role: "connector-recess-wall" })),
    { ...part("button", .742, .810, .017, .017, undefined, "reset"), role: "reset" },
    { ...part("power", .785, .795, .050, .050, undefined, "dc-barrel"), role: "12VDC" },
  ];
  return { front: { ports: [], components: front }, rear: { ports: sockets, components: rear } };
}

/** Describe the exact internal-antenna CW9166I cover and mounting-side connector projection. */
function cw9166Model(ports) {
  return {
    id: "cisco-cw9166i", sku: "CW9166I", defaultFace: "rear", fidelity: "model", inventoryComplete: true,
    panelFidelity: { front: "model", rear: "model" },
    source: cw9166Guide, sourcePage: "Hardware Features: Figure 1 Face View and Figure 2 Top View with Connectors and Ports",
    note: "CW9166I cover, mounting underside and recessed connectors follow the individual Cisco hardware-guide illustrations.",
    evidence: { models: ["Catalyst 9166I"], scope: "model", reviewed: "2026-09-10",
      front: "https://www.cisco.com/c/dam/en/us/td/i/300001-400000/350001-360000/357001-358000/357830.jpg",
      rear: "https://www.cisco.com/c/dam/en/us/td/i/300001-400000/350001-360000/357001-358000/357831.jpg",
      configuration: "CW9166I with internal antennas and no optional mounting bracket installed. The two fixed data/service connectors are 5GbE PoE input and RJ45 serial console.",
    },
    limitations: [
      "Rear represents the mounting underside in the orientation of Cisco's Figure 2, with the recessed connector edge at the bottom. Its vertical connector wall is shown face-on for cable selection.",
      "The curved cover and recessed walls are simplified to rounded rectangles. The USB connector on the side edge is shown face-on; no optional mounting bracket, power adapter or USB device is installed.",
      "Regional and Catalyst/Meraki management suffixes do not change this documented connector arrangement. The distinct CW9166D1 directional-antenna enclosure is not represented.",
    ],
    catalogDiscrepancies: ["Existing 5GbE uplink and RJ45 console indices remain unchanged. DC power and the USB host connector are nonconnectable hardware; there is no separate management Ethernet port."],
    chassis: { x: .04, y: .04, width: .92, height: .92, shape: "square" },
    faces: cw9166Panels(ports),
  };
}

/** Trace the cover indicator, four mounting feet, sensor vents and recessed console/Ethernet/DC cluster. */
function cw9166Panels(ports) {
  const console = { ...socket(ports[1], .50, .695, .065, .060, "console"), physicalLabel: "CONSOLE" };
  const uplink = { ...socket(ports[0], .62, .695, .065, .060, "rj45"), physicalLabel: "5G PoE" };
  return {
    front: { ports: [], components: [
      part("text", .35, .49, .30, .08, "CISCO"),
      { ...part("led", .494, .80, .012, .032, undefined, "bar"), color: "#29c7d9", role: "status" },
    ] },
    rear: { ports: [uplink, console], components: [
      ...[[.285, .12], [.705, .12], [.25, .45], [.75, .45]].map(([x, y]) =>
        ({ ...part("ring", x, y, .040, .040), role: "mounting-foot" })),
      { ...part("chassis", .35, .22, .30, .19), role: "product-label-recess" },
      { ...part("vent", .24, .30, .030, .015, undefined, "slit"), role: "mounting-clip" },
      { ...part("vent", .76, .30, .030, .015, undefined, "slit"), role: "mounting-clip" },
      ...[[.18, .56, .64, .016], [.18, .844, .64, .016], [.18, .56, .016, .30], [.804, .56, .016, .30]]
        .map(([x, y, width, height]) => ({ ...part("chassis", x, y, width, height), role: "connector-recess-wall" })),
      { ...part("vent", .365, .625, .043, .016, undefined, "slit"), role: "environment-sensor" },
      { ...part("vent", .365, .675, .043, .016, undefined, "slit"), role: "environment-sensor" },
      { ...part("button", .426, .680, .016, .016, undefined, "reset"), role: "mode" },
      { ...part("power", .71, .665, .055, .055, undefined, "dc-barrel"), role: "54VDC" },
      { ...part("usb", .952, .44, .025, .075), role: "usb-host" },
      { ...part("vent", .135, .820, .031, .014, undefined, "slit"), role: "kensington-lock" },
      { ...part("handle", .235, .685, .035, .10), role: "security-hasp" },
    ] },
  };
}

/** Create one normalized, nonconnectable access-point shell detail. */
function part(kind, x, y, width, height, label, variant) {
  return { kind, x, y, width, height, ...(label ? { label } : {}), ...(variant ? { variant } : {}) };
}

/** Attach a stable canonical inventory endpoint to an observed underside socket. */
function socket(port, x, y, width, height, connectorKind) {
  return { portIndex: port.portIndex, type: port.type, label: port.label, x, y, width, height, connectorKind };
}

/** Trace the AP-635's four cover indicators, mounting rail, recessed USB and diagonal Ethernet/DC cluster. */
function ap635Panels(ports) {
  const front = [part("text", .30, .47, .40, .065, "HPE Aruba")];
  for (const [index, label] of ["SYS", "2GHz", "5GHz", "6GHz"].entries()) {
    front.push(part("led", .421 + index * .042, .872 + index * .014, .012, .012),
      part("text", .407 + index * .042, .937, .041, .018, label));
  }
  return {
    front: { ports: [], components: front },
    rear: { ports: [socket(ports[0], .713, .839, .062, .067, "rj45"),
      socket(ports[1], .791, .762, .062, .067, "rj45"), socket(ports[2], .50, .148, .047, .025, "usb-micro")],
    components: [
      part("usb", .486, .035, .029, .07), part("button", .493, .24, .013, .013, undefined, "reset"),
      part("power", .847, .656, .052, .052, undefined, "dc-barrel"),
      part("vent", .940, .24, .027, .01, undefined, "slit"),
      part("handle", .16, .455, .68, .10), part("module-bay", .36, .60, .28, .16, undefined, "populated"),
      part("vent", .15, .025, .29, .13, undefined, "fins"), part("vent", .58, .025, .25, .13, undefined, "fins"),
      part("vent", .025, .19, .125, .55), part("vent", .85, .28, .12, .30),
      part("vent", .17, .845, .39, .13, undefined, "louver"),
    ] },
  };
}
