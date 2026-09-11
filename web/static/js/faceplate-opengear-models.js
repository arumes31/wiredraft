import { canonicalFaceplateDevice } from "./faceplate-profile.js";

const guide = "https://ftp.opengear.com/download/documentation/quickstart/current/cm8100/QuickStartGuide-CM8100.pdf";
const datasheet = "https://resources.opengear.com/cm/datasheets/cm8100/";
let cachedProfile;

/** Resolve the explicitly pictured forty-eight-port, copper-network CM8148 with dual AC power. */
export function resolveOpengearFaceplate(device) {
  if (device?.model !== "Console Manager family" || device.faceplate?.vendor !== "Opengear" || device.category !== "Switch") return null;
  const canonical = canonicalFaceplateDevice(device);
  if (!canonical) return null;
  if (!cachedProfile) cachedProfile = cm8148Profile(canonical.device);
  return cachedProfile;
}

/** Identify both CM8148 panels and preserve the original serial and management endpoint namespace. */
function cm8148Profile(device) {
  const configuration = "CM8148: 48 front RJ45 RS-232 serial ports with X2 straight pinout, two front 1Gb Ethernet interfaces, one front local RJ45 RS-232 console with X1 rolled pinout, two USB 3.0 hosts and two rear 100–240V AC C14 inputs. The 10G, USB-serial, cellular and DC variants are not selected.";
  return { id: "opengear-cm8148", family: "CM8100", sku: "CM8148 · 48 serial / dual 1Gb / dual AC",
    fidelity: "model", inventoryRevision: 1, inventoryComplete: true,
    panelFidelity: { front: "model", rear: "model" }, defaultFace: "front",
    source: guide, sourcePage: "April 2026 Quick Start Guide page 3, explicitly identified CM8148 front/rear photographs; pages 8–10 and 13; CM8100 1G datasheet",
    note: configuration,
    evidence: { models: [device.model], catalogAlias: device.model, selectedModel: "CM8148", scope: "model", reviewed: "2026-09-10",
      front: `${guide}#page=3`, rear: `${guide}#page=3`, supplemental: datasheet,
      ordering: "https://opengear.com/products/cm8100-console-server/", configuration,
      provenance: "The manufacturer quick-start guide explicitly says its images use CM8148. The 1G datasheet identifies CM8148 as the dual-AC SKU and establishes passive cooling. The separately illustrated 10G and cellular variants are not substituted." },
    legacyLayouts: [{ inventoryRevision: 0,
      portIndexMap: Object.fromEntries(Array.from({ length: 50 }, (_, index) => [index + 1, index + 1])),
      portLabels: Object.fromEntries(Array.from({ length: 50 }, (_, index) => [index + 1, index < 48 ? String(index + 1) : `MGMT${index - 47}`])) }],
    catalogDiscrepancies: [
      "The former family cited an Operations Manager guide. This alias now explicitly selects the photographed CM8148 Console Manager, retaining serial1–48 and network49/50 at NET1/NET2. New revision1 appends the omitted local console as51; saved inventories and connections are not expanded or rewritten.",
      "NET1 and NET2 are the dual Ethernet interfaces; their printed hardware names do not overwrite existing MGMT or custom names. USB-A hosts remain ancillary sockets, not invented serial endpoints."],
    limitations: [configuration,
      "The 440 × 44 mm chassis occupies 1U. Passive cooling uses enclosure perforations, with no exposed fan or replaceable fan tray. Tiny angled-edge perforations and printed status legends are simplified in the straight-on projection.",
      "Serial baud rates are not Ethernet Mbps; RS-232 endpoints use speed0. X1 local-console and X2 managed-device pinouts are distinct despite the same connector shape. Status indicators are illustrative and show no live state.",
      "Red panel accents are simplified geometric decoration; brand text identifies the hardware without embedding the source photographs."],
    chassis: { x: 0, y: .06, width: 1, height: .875 },
    faces: { front: frontCM8148(device), rear: rearCM8148() },
  };
}

/** Describe bounded ancillary hardware without creating a cable endpoint. */
function part(kind, x, y, width, height, role, variant) {
  return { kind, x, y, width, height, ...(role ? { role } : {}), ...(variant ? { variant } : {}) };
}

/** Bind a numbered RJ45 opening with its physical caption separate from the saved port name. */
function socket(device, index, x, y, physicalLabel, captionY) {
  const port = device.ports.find((candidate) => candidate.portIndex === index);
  if (!port) throw new Error(`CM8148 canonical connector ${index} is missing`);
  return { portIndex: index, type: port.type, label: port.label, connectorKind: "rj45", x, y,
    width: index <= 48 ? .027 : .031, height: .25, physicalLabel,
    descriptionAnchor: { x, y: captionY, fontSize: 5.5, boxHeight: 7 } };
}

/** Trace three sixteen-port banks and the separate local-console, host and Ethernet service columns. */
function frontCM8148(device) {
  const ports = Array.from({ length: 48 }, (_, index) => {
    const bank = Math.floor(index / 16);
    const column = Math.floor(index % 16 / 2);
    return socket(device, index + 1, [.032, .292, .552][bank] + column * .0314,
      index % 2 ? .68 : .33, String(index + 1), index % 2 ? .925 : .085);
  });
  ports.push(socket(device, 49, .863, .39, "NET1", .14), socket(device, 50, .863, .75, "NET2", .94),
    socket(device, 51, .817, .30, "CONSOLE", .08));
  const components = [
    { ...part("panel-accent", .009, .01, .744, .045, "front-red-strip", "trapezoid"), color: "#cd1237" },
    part("usb", .802, .555, .030, .095, "usb-host1"), part("usb", .802, .765, .030, .095, "usb-host2"),
    part("button", .894, .79, .006, .065, "factory-erase", "reset"),
    { ...part("text", .915, .11, .078, .18, "brand"), label: "opengear", fontSize: 7 },
    { ...part("text", .922, .32, .065, .15, "model-mark"), label: "8100", fontSize: 6 },
  ];
  for (const [index, role] of ["status-power", "status-heartbeat", "status-lighthouse"].entries()) {
    components.push({ ...part("led", .970, .59 + index * .115, .008, .065, role), active: false });
  }
  return { components, ports };
}

/** Trace the red rear cover and two left-keyed C14 inlets without inventing fan modules. */
function rearCM8148() {
  return { ports: [], components: [
    { ...part("panel-accent", .01, .10, .70, .80, "rear-red-panel", "trapezoid"), color: "#cd1237" },
    { ...part("text", .72, .20, .14, .26, "brand"), label: "opengear", fontSize: 10 },
    { ...part("text", .76, .65, .085, .15, "model-mark"), label: "8100", fontSize: 6 },
    part("power", .875, .12, .052, .78, "ac-input1", "ac-sideways-left"),
    part("power", .936, .12, .052, .78, "ac-input2", "ac-sideways-left"),
  ] };
}
