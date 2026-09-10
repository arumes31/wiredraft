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
