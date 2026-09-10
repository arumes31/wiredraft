const HARDWARE = "https://docs.paloaltonetworks.com/hardware/";
const models = new Map([
  ["PA-220", { guide: "pa-220", widthMM: 205, layout: "220" }],
  ["PA-440", { guide: "pa-400", widthMM: 203, layout: "400" }],
  ["PA-450", { guide: "pa-400", widthMM: 203, layout: "400" }],
  ["PA-460", { guide: "pa-400", widthMM: 203, layout: "400" }],
  ["PA-850", { guide: "pa-800", widthMM: 438, layout: "850" }],
]);

/** Resolve only individually verified Palo Alto models and their canonical inventory. */
export function buildPaloAltoModelFaceplate(device) {
  if (device?.faceplate?.vendor === "Palo Alto" && ["PA-1400 family", "PA-1410 / PA-1420"].includes(device.model)) {
    return rack1410Profile(device);
  }
  const sharedAlias = device?.model === "PA-440 / PA-450";
  const definition = models.get(sharedAlias ? "PA-440" : device?.model);
  if (!definition || device.faceplate?.vendor !== "Palo Alto") return null;
  const { guide, widthMM, layout } = definition;
  const base = `${HARDWARE}${guide}-hardware-reference/${guide}-firewall-overview/`;
  const front = `${base}${guide}-front-panel`;
  const rear = `${base}${guide}-back-panel`;
  const width = widthMM / 438;
  const missingConsole = layout === "400" && !device.ports.some((port) => port.type === "Console");
  return {
    id: `enterprise-palo-alto-${device.model.toLowerCase()}`, family: device.model, fidelity: "model",
    ...(sharedAlias ? { sku: "PA-440 / PA-450 (identical panels)", inventoryComplete: true, inventoryRevision: 1,
      panelFidelity: { front: "model", rear: "model" },
      legacyLayouts: [{ inventoryRevision: 0, portIndexMap: Object.fromEntries(Array.from({ length: 10 }, (_, index) => [index + 1, index + 1])) }],
      limitations: ["This combined entry uses the manufacturer-confirmed identical PA-440 and PA-450 panels, with PA-440 printed on the chassis. Both physical power inputs and their status LEDs are shown; external adapters are outside this view. The rear sheet-metal power-cord retainer is represented by a simplified handle symbol."] } : {}),
    source: front, sourcePage: `${device.model} front and back panel component illustrations`,
    evidence: { models: sharedAlias ? ["PA-440", "PA-450"] : [device.model], scope: "model", reviewed: "2026-09-10", front, rear,
      ...(sharedAlias ? { catalogAlias: device.model, configuration: "Identical PA-440 / PA-450 chassis with both console sockets; PA-440 printed model marking" } : {}),
      ...(layout === "400" ? { sharedChassis: "Manufacturer explicitly states PA-440, PA-450 and PA-460 front and back panels are identical." }
        : layout === "850" ? { sharedChassis: "PA-800 front-panel guide explicitly identifies only model name and port-speed differences; rear illustration is PA-850-specific." } : {}) },
    inventoryNotes: ["The drawing preserves canonical ports; USB storage sockets and grounding hardware are decorative."],
    catalogDiscrepancies: missingConsole ? ["The catalog omits the physical RJ45 CONSOLE port. It is drawn as hardware only; existing port IDs and cables are preserved."]
      : sharedAlias ? ["Older alias inventories omit RJ45 CONSOLE. New devices append it at index 11; all ten historical endpoint identities remain unchanged."] : [],
    defaultFace: "front", chassis: { x: (1 - width) / 2, y: .05, width, height: .9 },
    faces: layout === "850" ? rack850(device) : desktop(sharedAlias ? { ...device, model: "PA-440" } : device, layout, missingConsole),
  };
}

/** Describe a physical component in normalized chassis coordinates. */
function part(kind, x, y, width, height, label, variant) {
  return { kind, x, y, width, height, ...(label ? { label } : {}), ...(variant ? { variant } : {}) };
}

/** Match immutable inventory identity to an explicitly traced socket center. */
function socket(device, label, x, y, width, height = .22) {
  const port = device.ports.find((item) => item.label === label);
  if (!port) throw new Error(`${device.model}: documented socket ${label} is missing from the catalog`);
  return { label, physicalLabel: label.replace(/^ethernet1\//, ""), type: port.type, portIndex: port.portIndex, x, y, width, height };
}

/** Preserve the manufacturer's odd-above-even ordering in each measured network bank. */
function networkBank(device, first, xs, width, ys = [.34, .7]) {
  return xs.flatMap((x, column) => ys.map((y, row) => socket(device, `ethernet1/${first + column * 2 + row}`, x, y, width)));
}

/** Trace the PA-220 and the explicitly identical PA-440/450/460 desktop panels. */
function desktop(device, layout, missingConsole) {
  const old = layout === "220";
  const front = { ports: networkBank(device, 1, old ? [.16, .229, .297, .365] : [.142, .212, .281, .352], .059), components: [] };
  front.ports.push(socket(device, "MGT", old ? .475 : .45, old ? .34 : .7, .066),
    socket(device, "MICRO-USB", old ? .56 : .525, .82, .035, .075));
  if (old || !missingConsole) front.ports.push(socket(device, "CONSOLE", old ? .475 : .598, .7, .066));
  else front.components.push(part("console", .565, .59, .066, .22, "CONSOLE"));
  if (old) {
    front.components.push(part("vent", .016, .065, .096, .87, undefined, "mesh"),
      part("vent", .889, .065, .096, .87, undefined, "mesh"), part("usb", .603, .68, .062, .145),
      part("text", .704, .12, .17, .17, "paloalto"), part("text", .76, .4, .115, .16, device.model));
    for (const [index, label] of ["HA", "STAT", "ALM", "TEMP", "PWR"].entries()) {
      front.components.push(part("led", .723 + index * .034, .78, .016, .09),
        part("text", .709 + index * .034, .90, .043, .07, label));
    }
  } else {
    front.components.push(part("handle", .015, .05, .034, .9), part("handle", .95, .05, .034, .9),
      part("usb", .708, .48, .069, .135), part("usb", .708, .72, .069, .135),
      part("text", .809, .15, .115, .14, "paloalto"), part("text", .822, .33, .10, .14, device.model));
    for (const x of [.856, .88]) for (const y of [.54, .66, .78]) front.components.push(part("led", x - .006, y, .013, .063));
  }
  const rear = { ports: [], components: [], connectionMarker: old
    ? { x: .675, y: .04, width: .30, height: .13 } : { x: .065, y: .81, width: .30, height: .13 } };
  if (old) {
    rear.components.push(part("vent", .054, .12, .54, .77, undefined, "mesh"),
      part("power", .647, .49, .062, .31, "PWR 1", "dc-barrel"),
      part("power", .787, .49, .062, .31, "PWR 2", "dc-barrel"),
      part("button", .888, .38, .047, .23, undefined, "ground"));
  } else {
    rear.components.push(part("handle", .015, .05, .034, .9), part("handle", .95, .05, .034, .9),
      part("handle", .62, .19, .20, .13), part("button", .463, .73, .026, .12, undefined, "ground"),
      part("power", .648, .49, .061, .31, "PWR 1", "dc-barrel"),
      part("power", .78, .49, .061, .31, "PWR 2", "dc-barrel"));
    for (const x of [.717, .849]) rear.components.push({ ...part("led", x, .73, .013, .063), role: "power-status" });
    rear.components.push(part("text", .11, .32, .13, .13, "SERIAL"));
  }
  return { front, rear };
}

/** Trace the PA-850 port banks and service cluster independently from its rear PSUs. */
function rack850(device) {
  const front = { ports: [
    ...networkBank(device, 1, [.138, .169], .028, [.4, .7]),
    ...networkBank(device, 5, [.219, .251], .029, [.4, .7]),
    ...networkBank(device, 9, [.304, .338], .029, [.4, .7]),
    socket(device, "HA1", .393, .4, .031), socket(device, "HA2", .393, .7, .031),
    socket(device, "MGT", .447, .4, .031), socket(device, "CONSOLE", .447, .7, .031),
    socket(device, "MICRO-USB", .52, .83, .02, .065),
  ], components: [part("vent", .016, .07, .077, .85, undefined, "mesh"),
    part("vent", .61, .07, .375, .85, undefined, "mesh"), part("vent", .103, .055, .49, .07, undefined, "slots"),
    part("usb", .48, .49, .013, .29), part("text", .55, .13, .055, .16, "PA-850"),
    part("text", .795, .40, .10, .17, "paloalto"),
  ] };
  for (const x of [.564, .579]) for (const y of [.49, .61, .73]) front.components.push(part("led", x - .003, y, .006, .043));
  const rear = { ports: [], connectionMarker: { x: .305, y: .81, width: .25, height: .13 }, components: [
    part("psu", .035, .07, .106, .85, "PS-1", "ac"), part("psu", .148, .07, .106, .85, "PS-2", "ac"),
    part("button", .421, .2, .022, .17, undefined, "ground"), part("text", .265, .15, .14, .13, "INPUT POWER"),
    part("text", .265, .32, .14, .10, "100–240V AC"),
    part("fan", .619, .09, .084, .81), part("fan", .766, .09, .084, .81), part("fan", .878, .09, .084, .81),
  ] };
  return { front, rear };
}

/** Select PA-1410 explicitly while retaining the two historical aliases' distinct identity namespaces. */
function rack1410Profile(device) {
  const reference = `${HARDWARE}pa-1400-hardware-reference/`;
  const front = `${reference}pa-1400-series-overview/front-panel-1400-series`;
  const rear = `${reference}pa-1400-series-overview/back-panel-1400-series`;
  const family = device.model === "PA-1400 family";
  const retained = family ? [...Array.from({ length: 12 }, (_, index) => index + 1), 17, 18, 19, 20, 21, 22, 27]
    : Array.from({ length: 16 }, (_, index) => index + 1);
  return {
    id: `enterprise-palo-alto-${family ? "1400-family" : "1410-1420"}`, family: device.model,
    sku: "PA-1410 · dual AC power supplies", fidelity: "model", panelFidelity: { front: "model", rear: "model" },
    inventoryComplete: true, inventoryRevision: 1,
    legacyLayouts: [{ inventoryRevision: 0,
      portIndexMap: Object.fromEntries(retained.map((index) => [index, index])),
      portLabels: Object.fromEntries(retained.map((index) => [index, index === 27 ? "CONSOLE" : `ethernet1/${index}`])),
    }],
    source: front, sourcePage: "PA-1400 front/back component illustrations, PA-1410 speed table and physical specifications",
    evidence: { models: ["PA-1410"], selectedModel: "PA-1410", catalogAlias: device.model, scope: "model", reviewed: "2026-09-10",
      front, rear, frontImage: "https://docs.paloaltonetworks.com/content/dam/techdocs/en_US/dita/_graphics/uv/hardware/pa-1400/PA-1420-front.png",
      rearImage: "https://docs.paloaltonetworks.com/content/dam/techdocs/en_US/dita/_graphics/uv/hardware/pa-1400/PA-1420-back.png",
      physical: `${reference}pa-1400-series-specifications/physical-specs-pa-1400-series`,
      power: `${reference}service-pa-1400-series-firewall/replace-power-supply-pa-1400-series/replace-power-supply-ac-pa-1400-series`,
      indicators: `${reference}service-pa-1400-series-firewall/interpret-leds-pa-1400-series`,
      configuration: "PA-1410, 1U, with optional PS1 installed beside the supplied PS2 for dual AC power; port 1 ZTP sticker removed and no inserted transceivers or USB storage. PA-1410 is printed on the chassis.",
      sharedChassis: "The manufacturer names PA-1410 and PA-1420 in the same front illustration and confirms identical back panels. Port-speed tables differ; this selection uses only PA-1410 ratings.",
      dimensionsMM: { width: 434.9, height: 43.2, depth: 361.4 },
    },
    limitations: ["This catalog alias selects PA-1410, not PA-1420 performance. Perforated grilles are simplified; the five fixed rear fans remain behind the grille rather than appearing as exposed rotors. Product/claim labels omit unique serial values. Status lights depict powered standalone operation, not live telemetry."],
    catalogDiscrepancies: [
      family
        ? "Older family records used 2U, 16 copper sockets, eight 25G optical sockets and two undifferentiated MGMT ports. Saved height and settings remain unchanged. Copper 13–16, surplus optical 23/24 and ambiguous MGMT 25/26 stay in unmapped inventory; numbered data 1–12 and 17–22 plus the unique RJ45 CONSOLE 27 retain their physical identities."
        : "Older combined records omitted data 17–22 and all named HA/management sockets, while two Console-typed entries did not identify RJ45 versus micro-USB. Numbered data 1–16 retain their identities; ambiguous old CONSOLE1/2 at 17/18 remain unmapped rather than binding to unrelated optical or service sockets.",
      "New PA-1410 inventory has 1G copper 1–8, 5G PoE copper 9–12, 1G SFP 13–18 and 10G SFP+ 19–22. Known older optical speed/type mismatches keep saved settings while the drawing uses the documented SFP cage. HSCI, HA1-A/B, MGT and both console connectors are separate endpoints; the USB-A storage/bootstrap host is ancillary hardware.",
    ],
    defaultFace: "front", chassis: { x: 0, y: .075, width: 1, height: .85 }, faces: rack1410(device),
  };
}

/** Trace the two separated copper banks, paired optical cages and offset service cluster. */
function rack1410(device) {
  const copper = [...networkBank(device, 1, [.095, .1285, .1615, .194], .0305, [.36, .68]),
    ...networkBank(device, 9, [.2505, .2825], .0305, [.36, .68])];
  const optical = networkBank(device, 13, [.336, .369, .4025, .436, .469], .031, [.314, .669]);
  const ports = [...copper.map((slot) => ({ ...slot, height: .251, connectorKind: "rj45",
    ...(slot.portIndex >= 9 ? { compatibleTypes: ["RJ45_1G"] } : {}) })),
  ...optical.map((slot) => ({ ...slot, connectorKind: "sfp",
    compatibleTypes: slot.portIndex <= 18 ? ["SFP_PLUS_10G", "SFP28_25G"] : ["SFP28_25G"] }))];
  for (const slot of ports) slot.descriptionAnchor = { x: slot.x, y: slot.portIndex % 2 ? .13 : .91, fontSize: 5.5, boxHeight: 7.5 };
  ports.push(socket(device, "HSCI", .669, .69, .034, .235),
    socket(device, "HA1-A", .725, .354, .034, .251), socket(device, "HA1-B", .725, .669, .034, .251),
    socket(device, "MGT", .776, .354, .034, .251), socket(device, "CONSOLE", .776, .669, .034, .251),
    socket(device, "MICRO-USB", .853, .765, .018, .065));
  for (const slot of ports.slice(22)) {
    slot.descriptionAnchor = { x: slot.x, y: [24, 26].includes(slot.portIndex) ? .13 : .91, fontSize: 5.5, boxHeight: 7.5 };
  }
  const components = [
    part("text", .006, .015, .067, .13, "paloalto"), part("text", .007, .825, .058, .115, "PA-1410"),
    part("vent", .006, .23, .067, .47, undefined, "mesh"),
    part("vent", .491, .10, .207, .40, undefined, "mesh"),
    part("vent", .491, .50, .151, .23, undefined, "mesh"),
    part("vent", .914, .11, .075, .62, undefined, "mesh"), part("vent", .95, .73, .039, .18, undefined, "mesh"),
    { ...part("usb", .814, .457, .016, .32), role: "storage-bootstrap-host" },
    ...[.662, .677].map((x) => ({ ...part("led", x - .0015, .49, .003, .023), role: "hsci-link", active: false })),
  ];
  for (const [column, labels] of [["service", "power", "status", "ha", "temperature"], ["alarm", "fans", "ps1", "ps2"]].entries()) {
    for (const [row, label] of labels.entries()) components.push({
      ...part("led", .875 + column * .011, .285 + (row + column) * .10, .0045, .026),
      role: `status-${label}`, active: !["service", "alarm", "ha"].includes(label), color: "#42d98b",
    });
  }
  return { front: { ports, components }, rear: { ports: [], components: [
    { ...part("vent", .015, .05, .613, .90, undefined, "mesh"), role: "fixed-fan-grille", fanCount: 5, fieldReplaceable: false },
    { ...part("screw", .635, .325, .014, .14), role: "ground" },
    ...[.11, .24, .355].map((x, index) => ({ ...part("text", x, .825, .058, .13, ["ASSY REV", "SERIAL", "CLAIM"][index]), fontSize: 5.5 })),
    { ...part("psu", .687, .01, .13, .97, undefined, "pa-1400-ac"), role: "PS2" },
    { ...part("psu", .844, .01, .128, .97, undefined, "pa-1400-ac"), role: "PS1" },
  ] } };
}
