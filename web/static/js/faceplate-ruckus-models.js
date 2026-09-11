const guide = "https://storage.googleapis.com/habitech_product_information/Ruckus/Manuals/icx7550-installguide.pdf";
const datasheet = "https://www.ruckusnetworks.com/globalassets/digizuite/960411-ruckus-icx-7550-switch-data-sheet.pdf";
const guide7150 = "https://www.manualslib.com/manual/1370056/Ruckus-Wireless-Icx-7150-C12p.html";
const datasheet7150 = "https://webresources.vistancenetworks.com/download/assets/Ruckus%2BICX%2B7150%2BSwitch%2BData%2BSheet/7d4d931ad7ae11f0ae85be274297c0a4";

/** Resolve only individually traced Ruckus chassis and their explicitly documented hardware configurations. */
export function buildRuckusModelFaceplate(device) {
  if (device?.faceplate?.vendor !== "Ruckus") return null;
  if (device.model === "ICX 7150-24P") return profile7150(device, 24);
  if (device.model === "ICX 7150-48P") return profile7150(device, 48);
  if (device.model !== "ICX 7550-48ZP") return null;
  return {
    id: "enterprise-ruckus-icx7550-48zp", family: device.model, sku: "ICX7550-48ZP", fidelity: "model", inventoryComplete: true,
    panelFidelity: { front: "model", rear: "model" }, defaultFace: "front", source: guide,
    sourcePage: "RUCKUS guide 53-1005648-11: front Figure 6 page 17, rear Figure 12 page 20, module Figure 84 page 112 and module 3/1 in Table 9 page 22; datasheet module photo page 4",
    evidence: { models: [device.model], scope: "model", reviewed: "2026-09-10",
      front: `${guide}#page=17`, rear: `${guide}#page=20`, supplemental: `${datasheet}#page=4`,
      publisher: "https://support.ruckuswireless.com/documents/3484-ruckus-icx-7550-switch-hardware-installation-guide",
      configuration: "ICX7650-1X100GQ single-port 100G QSFP28 expansion module, supported on the ICX7550-48ZP; two RPS22-E 1200W AC supplies and three ICX-FAN12-E fans with front-to-back airflow.",
    },
    inventoryRevision: 1,
    legacyLayouts: [{ inventoryRevision: 0,
      portIndexMap: { ...Object.fromEntries(Array.from({ length: 49 }, (_, index) => [index + 1, index + 1])), 53: 50, 54: 51, 57: 52 },
      portLabels: { ...Object.fromEntries(Array.from({ length: 56 }, (_, index) => [index + 1, String(index + 1)])), 57: "CONSOLE" },
    }],
    catalogDiscrepancies: [
      "New inventory has 36 copper ports up to 2.5G, twelve up to 10G, one selected module 100G QSFP28 cage and two fixed 100G QSFP28 uplink/stacking cages. The former eight SFP28 entries overstated the physical optical cage count.",
      "Revision-zero copper ports 1–48 and module endpoint 49 retain their identities; old fixed-cage endpoints 53/54 map to 50/51 and old console 57 maps to 52. Unsupported optical endpoints 50–52 and 55/56 remain unmapped. Saved types, speeds, labels and IDs remain unchanged.",
      "Front USB-C console and rear Ethernet management are newly included endpoints. The separate rear reference-clock coax input and storage USB-A are decorative hardware. Logical breakout interfaces are not extra physical cages.",
      "The selected ICX7650-1X100GQ module has one socket below its ventilation and indicators, identified as module 3/1 by the hardware guide. Its SKU and ICX7550-48ZP compatibility are confirmed by the official datasheet. The manufacturer guide is read from its distributor mirror; its publisher entry requires sign-in.",
    ],
    chassis: { x: 0, y: .05, width: 1, height: .9 },
    faces: { front: front7550(device), rear: rear7550(device) },
  };
}

/** Place a manufacturer-documented component within normalized chassis coordinates. */
function part(kind, x, y, width, height, label, variant) {
  return { kind, x, y, width, height, ...(label ? { label } : {}), ...(variant ? { variant } : {}) };
}

/** Bind a physical cage to immutable inventory identity and any explicitly retained historical media error. */
function socket(device, index, x, y, width, height, physicalLabel, oldType) {
  const port = device.ports.find((candidate) => candidate.portIndex === index);
  if (!port) throw new Error(`${device.model}: documented connector ${index} is absent`);
  return { portIndex: index, type: port.type, label: port.label, x, y, width, height, physicalLabel,
    ...(oldType ? { compatibleTypes: [oldType], connectorKind: port.type.startsWith("QSFP") ? "qsfp" : "rj45" } : {}) };
}

/** Trace four copper banks, vertically stacked fixed QSFP cages and the documented lower-centered single-module socket. */
function front7550(device) {
  const ports = [];
  for (let index = 0; index < 48; index++) {
    const bank = Math.floor(index / 12);
    ports.push(socket(device, index + 1, .043 + bank * .199 + Math.floor(index % 12 / 2) * .032,
      index % 2 === 0 ? .405 : .755, .026, .20, String(index + 1), index < 36 ? "RJ45_10G" : undefined));
  }
  ports.push(socket(device, 49, .942, .675, .042, .21, "3/1", "SFP28_25G"),
    socket(device, 50, .855, .355, .042, .21, "2/1", "SFP28_25G"),
    socket(device, 51, .855, .755, .042, .21, "2/2", "SFP28_25G"),
    { ...socket(device, 53, .223, .105, .020, .085, "USB-C"),
      descriptionAnchor: { x: .223, y: -.06, fontSize: 5.5, boxHeight: 7, boxWidth: .068 } });
  return { ports, components: [
    part("text", .006, .035, .048, .07, "RUCKUS"),
    ...Array.from({ length: 8 }, (_, index) => part("led", .065 + index * .016, .090, .005, .04)),
    part("button", .012, .790, .010, .07, undefined, "reset"),
    part("vent", .292, .050, .525, .11, undefined, "perforated"),
    part("module-bay", .894, .060, .097, .88, undefined, "populated"),
    part("vent", .901, .220, .079, .12, undefined, "mesh"),
    part("vent", .901, .355, .014, .32, undefined, "mesh"),
    part("vent", .969, .355, .013, .32, undefined, "mesh"),
    ...Array.from({ length: 4 }, (_, index) => part("led", .927 + index * .009, .460, .004, .035)),
    part("led", .975, .790, .005, .035),
    part("screw", .977, .075, .011, .085),
  ] };
}

/** Preserve the source's rear fan bank, service column, clock input and two independently removable AC supplies. */
function rear7550(device) {
  return { ports: [
    { ...socket(device, 52, .414, .380, .030, .25, "CONSOLE"), descriptionAnchor: { x: .414, y: .100 } },
    { ...socket(device, 54, .414, .720, .030, .25, "MGMT"), descriptionAnchor: { x: .414, y: .975 } },
  ], components: [
    ...[.020, .136, .252].map((x, index) => part("fan", x, .035, .108, .925, `FAN ${3 - index}`)),
    { ...part("coax", .449, .580, .029, .25), role: "reference-clock" },
    { ...part("usb", .488, .530, .014, .30), orientation: "vertical" },
    part("psu", .540, .035, .205, .925, "RPS22 PSU 2", "ac-fan-right"),
    part("psu", .758, .035, .205, .925, "RPS22 PSU 1", "ac-fan-right"),
    part("screw", .976, .430, .016, .14),
  ] };
}

/** Record both fixed ICX7150 panels and retain every valid historical endpoint through an explicit revision map. */
function profile7150(device, count) {
  return {
    id: `enterprise-ruckus-icx7150-${count}p`, family: device.model, sku: `ICX7150-${count}P-4X10GR`,
    fidelity: "model", inventoryComplete: true, inventoryRevision: 1,
    panelFidelity: { front: "model", rear: "model" }, defaultFace: "front", source: `${guide7150}?page=16`,
    sourcePage: `RUCKUS guide 53-1004928-05: front Figure ${count === 24 ? 2 : 3} page 16, rear Figure 8 page 18, optical numbering Figure 47 page 70 and LEDs pages 92–94; ordering datasheet page 11`,
    evidence: { models: [device.model], scope: "model", reviewed: "2026-09-10",
      front: `${guide7150}?page=16`, rear: `${guide7150}?page=18`, supplemental: `${datasheet7150}#page=11`,
      publisher: "https://support.ruckuswireless.com/documents/1397-ruckus-icx-7150-switch-hardware-installation-guide",
      configuration: `ICX7150-${count}P-4X10GR with all four optical uplinks licensed for 10G, 370W PoE budget, one fixed internal 525W AC supply and two fixed fans.`,
    },
    legacyLayouts: [{ inventoryRevision: 0,
      portIndexMap: Object.fromEntries(Array.from({ length: count + 5 }, (_, index) =>
        [index + 1, index < count ? index + 1 : index + 3])),
      portLabels: { ...Object.fromEntries(Array.from({ length: count + 4 }, (_, index) => [index + 1, String(index + 1)])),
        [count + 5]: "CONSOLE" },
    }],
    catalogDiscrepancies: [
      "New inventory includes the previously omitted C1/C2 non-PoE Gigabit copper uplinks, front Ethernet management and front USB-C console. USB-A storage is artwork rather than a network endpoint.",
      "Revision-zero data ports, optical cages and serial console all retain their saved identities, labels and settings. Adding the two copper uplinks shifts optical and service indices only in new inventory; the explicit historical map prevents old optical endpoints from becoming copper ports.",
      `The RJ45 serial console is on the ${count === 24 ? "front" : "rear"} of this specific chassis. The 48PF and 48ZP rear configurations are different and are not used here.`,
      "The physical SFP+ bank is numbered X1/X3 above X2/X4, verified by the guide's enlarged stacking-port inset. The selected -4X10GR orderable configuration matches the existing four-10G inventory intent.",
      "Manufacturer illustrations were inspected through the public guide mirror; the publisher's current download requires sign-in. The 24P PoE mode indicator exists but is described as inactive in this guide revision.",
    ],
    chassis: { x: 0, y: .05, width: 1, height: .9 },
    faces: { front: front7150(device, count), rear: rear7150(device, count) },
  };
}

/** Fit a small readable annotation into the gap between a paired bank's physical sockets. */
function paired7150Socket(device, index, x, row, width, label) {
  return { ...socket(device, index, x, row ? .715 : .365, width, .235, label),
    descriptionAnchor: { x, y: row ? .925 : .540, fontSize: 5.5, boxHeight: 7 } };
}

/** Trace the 24-port right-side layout or the 48-port full-width layout without moving the model's service connectors. */
function front7150(device, count) {
  const origin = count === 24 ? .487 : .093;
  const serviceX = count === 24 ? .445 : .047;
  const ports = [];
  for (let index = 0; index < count; index++) {
    const x = origin + Math.floor(index / 12) * .199 + Math.floor(index % 12 / 2) * .032;
    ports.push(paired7150Socket(device, index + 1, x, index % 2, .027, String(index + 1)));
  }
  for (let index = 0; index < 2; index++) {
    ports.push(paired7150Socket(device, count + index + 1, .896, index, .030, `C${index + 1}`));
  }
  for (let index = 0; index < 4; index++) {
    ports.push(paired7150Socket(device, count + index + 3, .938 + Math.floor(index / 2) * .035,
      index % 2, .029, `X${index + 1}`));
  }
  if (count === 24) ports.push({ ...socket(device, count + 7, .399, .675, .031, .28, "CONSOLE"),
    descriptionAnchor: { x: .391, y: .95, fontSize: 5.5, boxHeight: 7 } });
  ports.push({ ...socket(device, count + 8, serviceX - .015, .195, .023, .10, "USB-C"),
    descriptionAnchor: { x: serviceX - .015, y: -.045, fontSize: 5.5, boxHeight: 7 } },
  { ...socket(device, count + 9, serviceX, .475, .032, .275, "MGMT"),
    descriptionAnchor: { x: serviceX, y: .95, fontSize: 5.5, boxHeight: 7 } });
  return { ports, components: [
    { ...part("usb", serviceX - .016, .730, .032, .13), role: "storage" },
    { ...part("button", serviceX - .083 + (count === 48 ? .060 : 0), .840, .007, .04, undefined, "reset"), role: "reset" },
    { ...part("button", serviceX + .010, .200, .010, .07), role: "mode" },
    ...indicators7150(origin, count),
  ] };
}

/** Place the five mode indicators and the six system indicators shown in the model's LED guide. */
function indicators7150(origin, count) {
  const modes = ["STAT", "SPD", "ID", "USB", "PoE"];
  const system = ["SYST", "M/S", "UPDATE", "DIAG", "CLOUD", "PWR"];
  return [
    ...modes.map((role, index) => ({ ...part("led", origin - .017 + index * .016, .160, .005, .030),
      role: `mode-${role}`, ...(count === 24 && role === "PoE" ? { active: false } : {}) })),
    ...system.map((role, index) => ({ ...part("led", origin + .068 + index % 3 * .016,
      .075 + Math.floor(index / 3) * .070, .005, .030), role: `system-${role}`,
      ...(role === "CLOUD" ? { active: false } : {}) })),
  ];
}

/** Draw two fixed left exhausts and the right AC inlet, adding rear serial only on the 48P chassis. */
function rear7150(device, count) {
  return { ports: count === 48 ? [{ ...socket(device, count + 7, .438, .675, .032, .285, "CONSOLE"),
    descriptionAnchor: { x: .438, y: .95, fontSize: 5.5, boxHeight: 7 } }] : [],
    components: [
      part("fan", .026, .080, .088, .84, undefined, "fixed"),
      part("fan", .129, .080, .088, .84, undefined, "fixed"),
      part("power", .915, .145, .075, .60, "AC"),
      part("screw", .008, .805, .016, .13), part("screw", .976, .805, .016, .13),
      ...(count === 48 ? [part("screw", .474, .635, .016, .13)] : []),
    ] };
}
