import { canonicalFaceplateDevice } from "./faceplate-profile.js";

const brief = "https://www.lantronix.com/wp-content/uploads/pdf/SLC8000_PB-CoBranded.pdf";
const guide = "https://cdn.lantronix.com/wp-content/uploads/pdf/900-704-RBD-SLC-UG.pdf";
let cachedProfile;

/** Resolve the explicitly photographed copper-network, single-AC SLC8000 configuration. */
export function resolveLantronixFaceplate(device) {
  if (device?.model !== "SLC Console Manager family" || device.faceplate?.vendor !== "Lantronix" || device.category !== "Switch") return null;
  const canonical = canonicalFaceplateDevice(device);
  if (!canonical) return null;
  if (!cachedProfile) cachedProfile = slc8000Profile(canonical.device);
  return cachedProfile;
}

/** Identify the exact two-panel photograph and retain the original serial and network endpoint namespace. */
function slc8000Profile(device) {
  const configuration = "SLC 8000 SLC80481201S: 48 RJ45 RS-232 serial ports in three FRRJ451601 modules, two copper gigabit Ethernet interfaces, one FR1ACPS01 100–240V AC supply, and a front local RJ45 console. No fiber networking, USB serial module or internal modem is selected.";
  return { id: "lantronix-slc80481201s", family: "SLC 8000", sku: "SLC 8000 · SLC80481201S · 48 serial / single AC",
    fidelity: "model", inventoryRevision: 1, inventoryComplete: true,
    panelFidelity: { front: "model", rear: "model" }, defaultFace: "rear",
    source: brief, sourcePage: "Manufacturer co-branded brief 941-004 Rev A (2015), page 2; current user guide pages 28, 33–40 and 45",
    note: configuration,
    evidence: { models: [device.model], catalogAlias: device.model, selectedModel: "SLC80481201S", scope: "model", reviewed: "2026-09-10",
      front: `${brief}#page=2`, rear: `${brief}#page=2`, supplemental: guide,
      ordering: "https://www.lantronix.com/products/lantronix-slc-8000/", configuration,
      provenance: "The manufacturer brief explicitly identifies both pictured panels as the 48-port single-AC SLC80481201S. The current guide's sample Figure 2-2 has inconsistent dual-AC and mixed-module captions, so its sample configuration is not substituted for the identified brief photographs." },
    legacyLayouts: [{ inventoryRevision: 0,
      portIndexMap: Object.fromEntries(Array.from({ length: 50 }, (_, index) => [index + 1, index + 1])),
      portLabels: Object.fromEntries(Array.from({ length: 50 }, (_, index) => [index + 1, index < 48 ? String(index + 1) : `MGMT${index - 47}`])) }],
    catalogDiscrepancies: [
      "The generation-free family now explicitly selects SLC80481201S. Existing serial1–48 and network49/50 retain their identities and settings. New revision1 appends the omitted front local console as51; saved inventories are not expanded automatically.",
      "The earlier fallback cited the older SLC generation. This layout uses the individually identified SLC8000 single-AC photographs and copper networking module."],
    limitations: [configuration,
      "The networking module has dual copper OR dual fiber interfaces; this selected SKU has only copper. USB-A hosts and the SD slot are ancillary, and the absent optional modem is a covered opening.",
      "The 438.15 × 44.45 mm front/rear aspect occupies 1U. Side cooling apertures are outside these projections; neither selected panel exposes a fan.",
      "RS-232 baud rates are not Ethernet Mbps; serial endpoints use speed0. The LCD is blank and keypad glyphs are simplified; this drawing reports no live device state."],
    chassis: { x: 0, y: .06, width: 1, height: .875 },
    faces: { front: frontSLC8000(device), rear: rearSLC8000(device) },
  };
}

/** Place an ancillary part without creating an additional connectable endpoint. */
function part(kind, x, y, width, height, role, variant) {
  return { kind, x, y, width, height, ...(role ? { role } : {}), ...(variant ? { variant } : {}) };
}

/** Bind a documented RJ45 socket by stable index and fit its printed caption independently of user names. */
function socket(device, index, x, y, width, height, physicalLabel, captionY, captionX = x) {
  const port = device.ports.find((candidate) => candidate.portIndex === index);
  if (!port) throw new Error(`SLC8000 canonical connector ${index} is missing`);
  return { portIndex: index, label: port.label, type: port.type, connectorKind: "rj45", x, y, width, height, physicalLabel,
    descriptionAnchor: { x: captionX, y: captionY, fontSize: 5.5, boxHeight: 7 } };
}

/** Trace the silver front's blank LCD, five-way controls, host media and separate local console. */
function frontSLC8000(device) {
  const components = [part("handle", .007, .07, .025, .86, "left-rack-ear"),
    part("handle", .971, .07, .022, .86, "right-rack-ear"),
    { ...part("text", .065, .34, .135, .34, "brand"), label: "LANTRONIX", fontSize: 10 },
    part("lcd", .225, .33, .19, .40, "display", "blank"),
    part("button", .469, .20, .061, .60, "keypad", "five-way"),
    part("card-slot", .772, .64, .059, .052, "memory-card", "plain"),
    part("usb", .851, .36, .026, .11, "usb-host1"), part("usb", .851, .60, .026, .11, "usb-host2"),
    part("module-bay", .939, .43, .026, .28, "modem-blank", "plain"),
    { ...part("text", .766, .42, .073, .095, "memory-label"), label: "MEMORY CARD", fontSize: 4 },
    { ...part("text", .844, .16, .037, .105, "usb-label"), label: "USB", fontSize: 4 },
  ];
  return { components, ports: [socket(device, 51, .905, .56, .029, .265, "CONSOLE", .19)] };
}

/** Trace three separate sixteen-port serial modules, left copper Ethernet and the single AC input module. */
function rearSLC8000(device) {
  const ports = Array.from({ length: 48 }, (_, offset) => {
    const bank = Math.floor(offset / 16);
    const column = Math.floor(offset % 16 / 2);
    return socket(device, offset + 1, [.078, .338, .598][bank] + column * .0314,
      offset % 2 ? .68 : .36, .026, .235, String(offset + 1), offset % 2 ? .91 : .12);
  });
  ports.push(socket(device, 49, .032, .36, .027, .235, "ETH1", .12),
    socket(device, 50, .032, .68, .027, .235, "ETH2", .91));
  const components = [part("button", .873, .31, .022, .36, "power-switch", "rocker"),
    part("module-bay", .905, .39, .014, .31, "fuse-carrier", "fuse-carrier"),
    part("power", .929, .22, .053, .56, "ac-inlet"),
    part("screw", .859, .14, .006, .055, "psu-fastener"), part("screw", .987, .81, .006, .055, "psu-fastener")];
  for (const left of [.060, .320, .580]) {
    components.push(part("chassis", left, .045, .002, .91, "serial-module-edge"),
      part("chassis", left + .253, .045, .002, .91, "serial-module-edge"));
  }
  return { ports, components };
}
