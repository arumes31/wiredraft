const overview = "https://www.cisco.com/c/en/us/td/docs/IIOT/routers/ir1101/hw-install-guide/b-ir1101-hig/m-product-overview.html";
const installation = "https://www.cisco.com/c/en/us/td/docs/IIOT/routers/ir1101/hw-install-guide/b-ir1101-hig/m-installing-the-router.html";
const imageRoot = "https://www.cisco.com/c/dam/en/us/td/i/400001-500000/420001-430000/";

/** Resolve the documented IR1101-K9 base without inferring an optional cellular or expansion module. */
export function buildCiscoIndustrialModelFaceplate(device) {
  if (device?.faceplate?.vendor !== "Cisco" || device.model !== "Catalyst IR1101") return null;
  return {
    id: "cisco-ir1101-k9", sku: "IR1101-K9", family: device.model, fidelity: "model",
    panelFidelity: { front: "model", rear: "model" }, defaultFace: "front", source: overview,
    sourcePage: "Product Overview SKU table and front Figure 4; Installing the Router blank-cover Figure 4 and rear mounting Figure 11",
    inventoryRevision: 1, inventoryComplete: true,
    legacyLayouts: [{ inventoryRevision: 0, portIndexMap: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7 } }],
    evidence: { models: [device.model], scope: "model", reviewed: "2026-09-10",
      front: `${imageRoot}428001-429000/428004.jpg`, rear: `${imageRoot}427001-428000/427995.jpg`,
      supplemental: installation,
      configuration: "IR1101-K9 base with no PIM or expansion module; the PIM position has the illustrated blank cover. USB dust covers and optional DIN/wall brackets are removed to expose the fixed interfaces and rear mounting holes." },
    catalogDiscrepancies: [
      "Revision 1 corrects console index 7 from Micro-B to Mini-B and appends the omitted independent RJ45 serial interface at index 8. Original indices 1–7, IDs, types, names and settings remain unchanged on saved devices.",
      "Selected IR1101-K9 base: covered PIM slot, no expansion module or external antenna sockets. The rear is a closed mounting panel, with no network, console or power connectors."],
    limitations: [
      "The Gigabit RJ45 and SFP WAN cages are the two physical members of one combo interface; the topology preserves both sockets without implying simultaneous use.",
      "The RJ45 serial socket is an RS232 DTE interface for attached serial equipment. Mini-B is the distinct router console; the existing Console schema also represents the serial endpoint.",
      "Four LAN ports are 10/100 Fast Ethernet without PoE output. USB-A storage and the four-contact 12–48 VDC/alarm connector are decorative hardware.",
      "The 132.5 × 60 mm front/rear body is fitted within the existing display allocation. Side grounding hardware, underside expansion cover and mounting details on other planes are outside these projections."],
    chassis: { x: .378, y: .04, width: .244, height: .92 },
    faces: { front: frontIR1101(device), rear: rearIR1101() },
  };
}

/** Give each traced physical part an explicit role without introducing cableable endpoints. */
function part(kind, x, y, width, height, role, extra = {}) {
  return { kind, x, y, width, height, role, ...extra };
}

/** Trace the fixed front sockets around the USB column, combined WAN bank and covered PIM. */
function frontIR1101(device) {
  const positions = new Map([
    [1, [.492, .285, .105, .190]], [2, [.608, .285, .105, .190]],
    [3, [.755, .285, .105, .190]], [4, [.871, .285, .105, .190]],
    [5, [.329, .285, .112, .190]], [6, [.108, .275, .107, .152]],
    [7, [.309, .800, .075, .086]], [8, [.329, .530, .112, .190]],
  ]);
  const ports = device.ports.map((port) => {
    const [x, y, width, height] = positions.get(port.portIndex);
    return { portIndex: port.portIndex, type: port.type, label: port.label, x, y, width, height,
      physicalLabel: port.portIndex <= 4 ? String(port.portIndex) : port.portIndex === 5 ? "1G" : port.portIndex === 6 ? "SFP 1G" : port.portIndex === 8 ? "SERIAL" : "CONSOLE",
      ...(port.portIndex === 7 ? { connectorKind: "usb-mini", compatibleTypes: ["USB_MICRO_CONSOLE"] } : {}),
      ...(port.portIndex === 8 ? { connectorKind: "console" } : {}),
      descriptionAnchor: { x: port.portIndex === 7 ? .374 : x,
        y: port.portIndex <= 6 ? .13 : port.portIndex === 7 ? .94 : .680, fontSize: 6, boxHeight: 7.5 } };
  });
  return { ports, components: [
    part("usb", .185, .177, .048, .270, "storage"),
    part("screw", .201, .040, .036, .077, "panel-fastener"),
    part("screw", .292, .890, .030, .066, "console-cover-fastener"),
    part("terminal", .055, .735, .195, .170, "power-alarm", { pins: 4, variant: "pluggable" }),
    part("button", .376, .794, .018, .040, "reset", { variant: "reset" }),
    part("chassis", .442, .464, .483, .385, "pim-blank"),
    part("chassis", .664, .828, .068, .128, "pim-latch"),
    part("screw", .683, .884, .028, .061, "pim-lock"),
    part("text", .039, .492, .170, .18, "physical-name", { label: "IR1101", fontSize: 7 }),
    ...[.073, .111, .149].map((x, index) => part("led", x, .064, .014, .030,
      ["system", "vpn", "alarm"][index], { active: false })),
    ...[.296, .349].map((x) => part("led", x, .069, .013, .028, "wan-status", { active: false })),
    ...[.514, .630, .777, .893].map((x) => part("led", x, .069, .013, .028, "lan-status", { active: false })),
  ] };
}

/** Trace the closed rear's end screws and bracket holes from the exploded vertical DIN mounting drawing. */
function rearIR1101() {
  return { ports: [], components: [
    ...[.027, .944].flatMap((x) => [.43, .83].map((y) => part("screw", x, y, .028, .061, "panel-fastener"))),
    ...[.31, .65].map((y) => part("service-jack", .570, y, .021, .046, "din-mount-hole")),
  ] };
}
