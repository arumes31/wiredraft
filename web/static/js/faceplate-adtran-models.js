import { canonicalFaceplateDevice } from "./faceplate-profile.js";

const guide = "https://www.adtran-networks.com/-/media/adva-main-site/resources/data-sheets/pdfs/fsp-150-ge-100-series.pdf";
const operator = "https://assets.ctfassets.net/jvm5di6no8oz/2Grufnn2mOp5UBBvjLQJ2Z/b92703b541251d96b6880d1b37d03763/2023.03.14_WEAS_Service_description_version_6.7__valid_from_1_june_2023__Final.pdf#page=45";
let cachedProfile;

/** Resolve the original optical-NNI GE104 AC independently of mutable saved port captions. */
export function resolveAdtranFaceplate(device) {
  if (device?.model !== "FSP 150-GE104" || device.faceplate?.vendor !== "ADTRAN" || device.category !== "Modem") return null;
  const canonical = canonicalFaceplateDevice(device);
  if (!canonical) return null;
  if (!cachedProfile) cachedProfile = ge104Profile(canonical.device);
  return cachedProfile;
}

/** Identify the exact photographed configuration and distinguish its source from later GE104(E) hardware. */
function ge104Profile(device) {
  const configuration = "Original ADVA FSP 150-GE104 AC: four copper/SFP access pairs numbered 3–6, optical-only network 1–2, RJ45 LAN and RS232, integrated AC supply and a vented rear grounding panel. No installed optical modules, dust plugs or mounting accessories.";
  return { id: "adtran-fsp150-ge104-ac", sku: "GE104 AC · optical NNI", fidelity: "model",
    inventoryRevision: 1, inventoryComplete: true, panelFidelity: { front: "model", rear: "model" },
    defaultFace: "front", source: guide, sourcePage: "November 2019 datasheet pages 3–4, legend item 7; KPN WEAS page 45; matching seller front/rear photos",
    note: configuration,
    evidence: { models: ["FSP 150-GE104"], scope: "model", reviewed: "2026-09-10", configuration,
      front: "https://i.ebayimg.com/images/g/ELgAAOSweM5nf1F-/s-l500.webp",
      rear: "https://i.ebayimg.com/images/g/PuYAAOSwmRlnf1F-/s-l500.webp",
      supplemental: operator, listing: "https://www.ebay.com.au/itm/135489768840",
      provenance: "Cyber Systems Australia seller photographs of the same used GE104, not manufacturer illustrations. The front identifies the original optical-only NNI configuration; the top part/revision label is unreadable. Manufacturer datasheet and KPN deployment specification independently establish interfaces and dimensions." },
    legacyLayouts: [{ inventoryRevision: 0, portIndexMap: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7 },
      portLabels: { 1: "UNI1", 2: "UNI2", 3: "UNI3", 4: "UNI4", 5: "NNI1", 6: "NNI2", 7: "MGMT" } }],
    limitations: [configuration,
      "This original GE104 has no copper NNI sockets. The later GE104(E) uses a different front and is not depicted.",
      "Copper and SFP sockets numbered 3–6 each share one logical interface. Both physical alternatives are cableable in the diagram; simultaneous media use is not validated.",
      "The half-width 220 × 44 mm front/rear aspect is represented in a 1U allocation. Top and side surfaces are outside these projections.",
      "The RJ45 LAN maximum speed is unspecified by the sources; new management ports use speed 0. USB is ancillary 3G/LTE host artwork, not another serial console.",
      "The source pair establishes original GE104 AC geometry, but does not identify a readable hardware revision or part number."],
    catalogDiscrepancies: [
      "Legacy UNI1–4 named the first through fourth access interfaces. They retain their identities at physical copper 3–6, with NNI1/2 and MGMT unchanged; saved captions, speeds, VLANs and rack placement are preserved.",
      "New revision-1 inventories append the real RJ45 RS232 as index 8 and four optical UNI alternatives as 9–12. Existing saved devices are not expanded automatically."],
    chassis: { x: .26, y: .065, width: .48, height: .8224 },
    faces: { front: frontGE104(device), rear: rearGE104() },
  };
}

/** Position an ancillary panel part without adding a logical network interface. */
function part(kind, x, y, width, height, role, variant) {
  return { kind, x, y, width, height, ...(role ? { role } : {}), ...(variant ? { variant } : {}) };
}

/** Bind one verified physical socket to a canonical port index and its separately placed printed number. */
function socket(device, index, x, y, width, height, physicalLabel, captionY, captionX = x) {
  const port = device.ports.find((candidate) => candidate.portIndex === index);
  if (!port) throw new Error(`GE104 canonical connector ${index} is missing`);
  return { portIndex: index, type: port.type, label: port.label, x, y, width, height, physicalLabel,
    descriptionAnchor: { x: captionX, y: captionY, fontSize: 5.5, boxHeight: 7 } };
}

/** Trace the original front's diagonal inlet, stacked services, four UNI media pairs and separated optical NNI. */
function frontGE104(device) {
  const ports = [
    socket(device, 1, .665, .34, .059, .22, "3", .155), socket(device, 2, .665, .705, .059, .22, "4", .925),
    socket(device, 3, .738, .34, .059, .22, "5", .155), socket(device, 4, .738, .705, .059, .22, "6", .925),
    socket(device, 5, .825, .79, .069, .20, "1", .60), socket(device, 6, .944, .79, .069, .20, "2", .60),
    socket(device, 7, .272, .34, .059, .22, "LAN", .155, .265), socket(device, 8, .272, .705, .059, .22, "RS232", .52),
    ...[.356, .426, .496, .566].map((x, index) => socket(device, index + 9, x, .79, .061, .20, String(index + 3), .60)),
  ];
  return { ports, components: [
    part("power", .027, .13, .16, .80, "ac-inlet", "c14-diagonal"),
    part("usb", .210, .59, .017, .24, "usb-mobile-host"),
    { ...part("led", .206, .89, .012, .05, "status"), active: false },
    part("vent", .320, .13, .278, .32, "access-vent"),
    part("vent", .792, .13, .186, .32, "network-vent"),
    { ...part("text", .605, .015, .18, .085, "brand"), label: "ADVA", fontSize: 5.5 },
    { ...part("text", .803, .015, .175, .085, "model"), label: "FSP 150-GE104", fontSize: 4 },
  ] };
}

/** Retain the perforated rear and its upper-right grounding plate without inventing rear connectors or fans. */
function rearGE104() {
  const components = [part("vent", .04, .10, .774, .66, "rear-mesh"),
    part("vent", .814, .35, .137, .41, "rear-mesh"),
    part("chassis", .818, .06, .139, .23, "grounding-plate"),
    ...[.843, .925].map((x) => part("service-jack", x, .125, .022, .10, "ground")),
    ...[.012, .968].map((x) => part("screw", x, .45, .02, .10, "side-fastener"))];
  for (const x of [.18, .49, .80]) for (const y of [.04, .83]) {
    components.push(part("screw", x, y, .024, .12, "panel-fastener"));
  }
  return { ports: [], components };
}
