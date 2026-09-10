import { canonicalFaceplateDevice } from "./faceplate-profile.js";

const GUIDES = {
  compact: "https://static.tp-link.com/2020/202006/20200611/71065058727_TL-SG2008P%28UN%291.0_IG.pdf",
  smart: "https://static.tp-link.com/upload/manual/2023/202310/20231017/7106510303_TL-SG2218%28UN%29_IG.pdf",
  access: "https://static.tp-link.com/upload/manual/2024/202411/20241101/7106511506_Omada%20L2%2B%20Managed%20Switch_IG.pdf",
  plus: "https://static.tp-link.com/upload/manual/2025/202512/20251211/7100002449_Omada%20Access%20Plus%26Pro%20Switch%20Multi-model_IG.pdf",
  campus: "https://static.tp-link.com/upload/manual/2025/202509/20250904/7100001291_SG6428X%28UN%291.20_IG.pdf",
};
const productEvidence = {
  "SG2428P": {
    "product": "https://www.omadanetworks.com/us/business-networking/omada-switch-access/sg2428p/",
    "photos": [
      "https://static.tp-link.com/upload/image-line/SG2428P_UN_5.40_overview_01_large_20260512034036u.jpg",
      "https://static.tp-link.com/upload/image-line/SG2428P_UN_5.40_overview_02_large_20260512034050e.jpg"
    ]
  },
  "SG3452": {
    "product": "https://www.tp-link.com/us/business-networking/omada-switch-access/sg3452/v1.20/",
    "photos": [
      "https://static.tp-link.com/upload/image-line/SG3452_UN_1.20_01_large_20240415203315h.jpg",
      "https://static.tp-link.com/upload/image-line/SG3452_UN_1.20_02_large_20240415203341x.jpg"
    ]
  },
  "SG3452XP": {
    "product": "https://www.omadanetworks.com/us/business-networking/omada-switch-access-plus/sg3452xp/",
    "photos": [
      "https://static.tp-link.com/upload/image-line/SG3452XP_UN_2.30_overview_01_large_20251210084045h.jpg",
      "https://static.tp-link.com/upload/image-line/SG3452XP_UN_2.30_overview_02_large_20251210084100o.jpg"
    ]
  },
  "SG3210": {
    "product": "https://www.tp-link.com/us/business-networking/omada-switch-access/sg3210/v3.20/",
    "photos": [
      "https://static.tp-link.com/upload/image-line/SG3210_UN_3.2_01_large_20240204114650o.jpg",
      "https://static.tp-link.com/upload/image-line/SG3210_UN_3.2_02_large_20240204114718m.jpg"
    ]
  },
  "SG3428": {
    "product": "https://www.tp-link.com/us/business-networking/omada-switch-access/sg3428/v2.40/",
    "photos": [
      "https://static.tp-link.com/upload/image-line/SG3428_UN_2.40_overview_01_large_20260202031258v.jpg",
      "https://static.tp-link.com/upload/image-line/SG3428_UN_2.40_overview_02_large_20260202031307u.jpg"
    ]
  },
  "SG3428X": {
    "product": "https://www.omadanetworks.com/us/business-networking/omada-switch-access-plus/sg3428x/",
    "photos": [
      "https://static.tp-link.com/upload/image-line/SG3428X_UN_1.40_overview_01_large_20251201022852p.jpg",
      "https://static.tp-link.com/upload/image-line/SG3428X_UN_1.40_overview_02_large_20251201023031k.jpg"
    ]
  }
};
productEvidence.SG2008P = {
  product: "https://www.tp-link.com/us/business-networking/omada-switch-smart/sg2008p/v3.20/",
  photos: ["https://static.tp-link.com/upload/image-line/01_large_20240204032836b.jpg",
    "https://static.tp-link.com/upload/image-line/02_large_20240204032902s.jpg"],
};
productEvidence.SG2210MP = {
  product: "https://www.tp-link.com/us/business-networking/omada-switch-access/tl-sg2210mp/v1/",
  photos: ["https://static.tp-link.com/TL-SG2210MP(UN)1.0-01_large_1594869369356x.jpg",
    "https://static.tp-link.com/TL-SG2210MP(UN)1.0-03_large_1594869395045p.jpg"],
};
const definitions = {
  SG2008P: { build: sg2008p, revision: "V3.20", guide: "compact", page: "Connection drawing, page 1; V3.20 front/rear photographs", width: .49 },
  SG2210MP: { build: accessSwitch, revision: "TL-SG2210MP V1", guide: "smart", page: "Figure 1-2; V1 front/rear photographs", width: .67,
    copper: { x: .45, step: .051, rows: 1, bank: 8, gap: 0, width: .044 },
    optical: { x: .862, step: .061, rows: 1, width: .05 }, ac: .615, ground: .705, lock: .12, controls: "poe8" },
  SG2428P: { build: accessSwitch, revision: "V5.40", guide: "smart", page: "Figure 1-4; V5.40 front/rear photographs",
    copper: { x: .412, step: .0327, rows: 2, bank: 4, gap: .016, width: .030 },
    optical: { x: .865, step: .033, rows: 1, width: .031 }, ac: .618, ground: .946, lock: .04, controls: "poe24" },
  SG3210: { build: accessSwitch, revision: "V3.20", guide: "access", page: "SG3210 front figure, page 2; V3.20 front/rear photographs", width: .67,
    copper: { x: .43, step: .0503, rows: 1, bank: 8, gap: 0, width: .044 },
    optical: { x: .855, step: .072, rows: 1, width: .052 }, ac: .81, ground: .729, lock: .135,
    console: .327, usb: .379, usbKind: "usb-micro", controls: "compact" },
  SG3428: { build: accessSwitch, revision: "V2.40", guide: "access", page: "SG3428 front figure, page 3; V2.40 front/rear photographs",
    copper: { x: .384, step: .0327, rows: 2, bank: 4, gap: .017, width: .030 },
    optical: { x: .822, step: .033, rows: 1, width: .032 }, ac: .824, ground: .76, lock: .04,
    console: .31, usb: .347, usbKind: "usb-c", controls: "matrix" },
  SG3428X: { build: accessSwitch, revision: "V1.40", guide: "plus", page: "SG3428X front figure, page 1; V1.40 front/rear photographs",
    copper: { x: .384, step: .0327, rows: 2, bank: 4, gap: .017, width: .030 },
    optical: { x: .822, step: .033, rows: 1, width: .032 }, ac: .824, ground: .76, lock: .04,
    console: .31, usb: .347, usbKind: "usb-c", controls: "matrix" },
  SG3452: { build: accessSwitch, revision: "V1.20", guide: "access", page: "SG3452 front figure, page 4; V1.20 front/rear photographs",
    copper: { x: .118, step: .032, rows: 2, bank: 8, gap: .01, width: .030 },
    optical: { x: .925, step: .034, rows: 2, width: .032 }, ac: .885, ground: .046, lock: .091,
    console: .073, usb: .037, usbKind: "usb-micro", controls: "dense", rearGrille: true },
  SG3452XP: { build: accessSwitch, revision: "V2.30", guide: "plus", page: "SG3452XP front figure, page 2; V2.30 front/rear photographs",
    copper: { x: .124, step: .032, rows: 2, bank: 8, gap: .012, width: .030 },
    optical: { x: .93, step: .033, rows: 2, width: .032 }, ac: .854, ground: .741, lock: .18,
    console: .039, usb: .071, usbKind: "usb-micro", controls: "dense-poe" },
  SX6632YF: { build: sx6632yf, revision: "2025 hardware guide", guide: "campus", page: "SX6632YF front page 2, port table page 6 and rear page 7" },
};
const cache = new Map();

/** Resolve nine individually evidenced Omada models without changing saved catalog inventory. */
export function resolveOmadaFaceplate(device) {
  if (device?.faceplate?.vendor !== "TP-Link Omada" || !Object.hasOwn(definitions, device.model)) return null;
  const canonical = canonicalFaceplateDevice(device);
  if (!canonical) return null;
  if (!cache.has(device.model)) {
    const definition = definitions[device.model];
    const evidence = productEvidence[device.model];
    const width = definition.width || 1;
    cache.set(device.model, {
      id: `omada-${device.model.toLowerCase()}`, defaultFace: device.model === "SG2008P" ? "rear" : "front",
      fidelity: "model", panelFidelity: { front: "model", rear: "model" },
      source: GUIDES[definition.guide], sourcePage: definition.page,
      evidence: evidence ? [evidence.product, ...evidence.photos] : [GUIDES.campus],
      hardwareRevision: definition.revision,
      note: `Panel coordinates follow ${definition.revision}; connector banks and service hardware are individually traced. Other revisions may differ.`,
      limitations: [`The catalog omits hardware revision; this drawing represents ${definition.revision}.`,
        "Side and top details are outside the front/rear projection. Additional service connectors absent from inventory are artwork only."],
      catalogDiscrepancies: discrepancies(device.model),
      chassis: { x: (1 - width) / 2, y: .04, width, height: .92 },
      faces: definition.build(canonical.device.ports, definition),
    });
  }
  return cache.get(device.model);
}

/** Preserve logical port types while explaining independently verified physical connector differences. */
function discrepancies(model) {
  if (model === "SX6632YF") return [
    "The manufacturer specifies ports 1–26 as SFP+ and 27–32 as SFP28, with no QSFP cages. New instances use these verified types; old inventories retain their 24 SFP28/8 QSFP28 types while mapping to the correct SFP-size cages.",
    "New instances include the previously omitted management Ethernet and Type-C console; two USB 3.0 storage connectors remain nonconnectable artwork.",
  ];
  if (model === "SG3210") return ["The physical console connector is micro-USB. New instances use USB_MICRO_CONSOLE; old USB_C_CONSOLE endpoints keep their IDs and map to the same physical socket."];
  if (model === "SG3428X" || model === "SG3452XP") return ["New instances include the second physical USB console connector that earlier catalog entries omitted. Existing inventory indices are preserved."];
  if (model === "SG2210MP") return ["The chassis prints SFP1/SFP2; catalog labels 9/10 are retained in saved inventory."];
  return [];
}

/** Construct one normalized piece of reusable artwork without assigning a connectable inventory identity. */
function part(kind, x, y, width, height, label, variant) {
  return { kind, x, y, width, height, ...(label ? { label } : {}), ...(variant ? { variant } : {}),
    ...(kind === "text" ? { fontSize: 6 } : {}) };
}

/** Bind a canonical inventory port to one traced socket center and optional physical label or connector. */
function socket(port, x, y, width, height = .27, connectorKind, physicalLabel) {
  return { portIndex: port.portIndex, type: port.type, label: port.label, x, y, width, height,
    ...(connectorKind ? { connectorKind } : {}), ...(physicalLabel ? { physicalLabel } : {}) };
}

/** Place measured repeated banks with odd ports above even ports, or a single horizontal row. */
function bank(ports, { x, step, rows, bank: columnsPerBank = ports.length, gap = 0, width }, physicalLabels = []) {
  return ports.map((port, index) => {
    const column = Math.floor(index / rows);
    return socket(port, x + column * step + Math.floor(column / columnsPerBank) * gap,
      rows === 1 ? .72 : [.36, .72][index % 2], width, rows === 1 && port.type.startsWith("SFP") ? .23 : .27,
      undefined, physicalLabels[index]);
  });
}

/** Draw a documented LED matrix independently from the actual link-state socket indicators. */
function ledMatrix(x, y, columns, rows, step = .014, rowStep = .13) {
  const parts = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) parts.push(part("led", x + column * step, y + row * rowStep, .0045, .035));
  }
  return parts;
}

/** Trace the compact SG2008P with its indicator-only front and descending rear port numbers. */
function sg2008p(ports) {
  return {
    front: { ports: [], connectionMarker: { x: .02, y: .80, width: .26, height: .14 },
      components: [part("text", .025, .17, .21, .11, "SG2008P"), ...ledMatrix(.275, .30, 1, 4, .02, .11),
        ...ledMatrix(.465, .38, 8, 2, .046, .20), part("button", .87, .67, .016, .10)] },
    rear: { ports: ports.map((port, index) => socket(port, .72 - index * .064, .56, .055, .29)),
      components: [part("power", .07, .34, .055, .38, undefined, "dc-barrel"), part("text", .038, .14, .13, .08, "53.5V DC")] },
  };
}

/** Trace front connector banks and each model's photographed rear AC, lock and grounding positions. */
function accessSwitch(ports, definition) {
  const front = controls(definition, ports.length);
  const slots = [...bank(ports.filter((port) => port.type === "RJ45_1G"), definition.copper),
    ...bank(ports.filter((port) => port.type.startsWith("SFP")), definition.optical,
      definition.controls === "poe8" ? ["SFP1", "SFP2"] : [])];
  if (definition.console !== undefined) {
    slots.push(socket(ports.find((port) => port.type === "Console"), definition.console, .72, .032));
    const usb = ports.find((port) => port.type.startsWith("USB_"));
    slots.push({ ...socket(usb, definition.usb, .80, .020, .09, definition.usbKind),
      ...(definition.usbKind === "usb-micro" ? { compatibleTypes: ["USB_C_CONSOLE"] } : {}) });
  }
  const rear = [part("power", definition.ac, .28, .065, .43),
    part("button", definition.ground, .48, .012, .095), part("module-bay", definition.lock, .45, .009, .18),
    part("text", definition.ac - .018, .74, .10, .075, "100–240V AC")];
  if (definition.rearGrille) rear.push(part("vent", .14, .12, .69, .68, undefined, "perforated"));
  return { front: { ports: slots, components: front },
    rear: { ports: [], components: rear, connectionMarker: { x: .30, y: .84, width: .23, height: .13 } } };
}

/** Trace distinct compact, PoE and dense-switch indicator/control fields outside their connector banks. */
function controls(definition, portCount) {
  if (definition.controls === "poe8") return [part("text", .025, .13, .14, .10, "SG2210MP"),
    ...ledMatrix(.14, .42, 7, 2, .024, .25), part("button", .327, .72, .016, .10), part("button", .377, .72, .012, .08)];
  if (definition.controls === "poe24") return [part("text", .02, .13, .10, .10, "SG2428P"),
    ...ledMatrix(.102, .36, 15, 2, .0105, .25), part("button", .30, .70, .012, .09), part("button", .333, .70, .012, .09)];
  if (definition.controls === "compact") return [part("text", .025, .13, .15, .10, "SG3210"), ...ledMatrix(.13, .37, 6, 2, .019, .25)];
  if (definition.controls === "matrix") return [...ledMatrix(.044, .51, 15, 2, .011, .12)];
  const parts = [...ledMatrix(.105, .12, Math.min(24, Math.floor(portCount / 2)), 1, .033, .1),
    ...ledMatrix(.018, .40, 1, 2, .01, .12)];
  if (definition.controls === "dense-poe") parts.push(part("button", .088, .74, .008, .075));
  return parts;
}

/** Trace SX6632YF's SFP-only front and four rear fan trays beside one populated and one empty PSU bay. */
function sx6632yf(ports) {
  const optical = ports.filter((port) => port.portIndex <= 32);
  const slots = optical.map((port, index) => ({ ...socket(port, .265 + Math.floor(index / 2) * .044,
    index % 2 === 0 ? .38 : .73, .033, .24, "sfp"), compatibleTypes: [index < 24 ? "SFP28_25G" : "QSFP28_100G"] }));
  slots.push(socket(ports.find((port) => port.type === "Console"), .074, .73, .033));
  slots.push(socket(ports.find((port) => port.type === "RJ45_1G"), .074, .38, .033),
    socket(ports.find((port) => port.type === "USB_C_CONSOLE"), .1205, .8175, .021, .085, "usb-c"));
  const front = [part("usb", .15, .52, .014, .30), part("usb", .178, .52, .014, .30),
    part("vent", .143, .015, .84, .115, undefined, "louver"), ...ledMatrix(.018, .45, 2, 3, .012, .13),
    part("button", .041, .755, .01, .075)];
  const rear = [part("button", .073, .44, .012, .10), part("module-bay", .954, .49, .009, .18),
    part("module-bay", .54, .06, .205, .73, "PSU2"), part("psu", .753, .06, .172, .73, "PSU1")];
  for (let index = 0; index < 4; index++) {
    const x = .145 + index * .099;
    rear.push(part("module-bay", x, .055, .093, .74, undefined, "populated"), part("fan", x + .005, .09, .083, .59),
      part("handle", x + .018, .67, .058, .09), part("led", x + .07, .70, .006, .035));
  }
  return { front: { components: front, ports: slots }, rear: { components: rear, ports: [],
    connectionMarker: { x: .03, y: .85, width: .24, height: .13 } } };
}
