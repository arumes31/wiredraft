import { canonicalFaceplateDevice } from "./faceplate-profile.js";

const definitions = {
  CCR1072: { build: ccr1072, guide: "ccr1072-1g-8s-plus", product: "CCR1072-1G-8Splus", photos: [1055, 1056],
    sku: "CCR1072-1G-8S+",
    configuration: "CCR1072-1G-8S+ with two hot-swap AC supplies, four fixed rear fans and the front LCD, as pictured in the manufacturer's product gallery." },
  CCR2004: { build: ccr2004, guide: "ccr2004-1g-12s-plus-2xs", product: "ccr2004_1g_12s_2xs", photos: [1937, 1936],
    sku: "CCR2004-1G-12S+2XS",
    configuration: "CCR2004-1G-12S+2XS with two fixed AC inputs, two rear fans and the external rear heatsink, as pictured by the manufacturer. This is the full SKU already identified in the catalog's CCR2004 source." },
  CCR2116: { build: ccr2116, guide: "ccr2116-12g-4s-plus", product: "ccr2116_12g_4splus", photos: [2625, 2116],
    sku: "CCR2116-12G-4S+",
    configuration: "CCR2116-12G-4S+ with two fixed AC inputs and four rear fans; the current manufacturer front photograph includes a storage USB-A socket. This is the full SKU already identified in the catalog's CCR2116 source." },
  CCR2216: { build: ccr2216, guide: "ccr2216-1g-12xs-2xq", product: "ccr2216_1g_12xs_2xq", photos: [2123, 2124],
    sku: "CCR2216-1G-12XS-2XQ", drawing: "CCR2216_DIMENSION_220238.pdf",
    configuration: "CCR2216-1G-12XS-2XQ with two installed AC supplies and four removable fan trays, as pictured by the manufacturer. This is the full SKU already identified in the catalog's CCR2216 source." },
  "CRS317-1G-16S+RM": { build: crs317, guide: "crs317-1g-16s-plus-rm", product: "crs317_1g_16s_rm", photos: [1324, 2055] },
  "CRS326-24G-2S+RM": { build: crs326, guide: "crs326-24g-2s-plus-rm", product: "CRS326-24G-2SplusRM", photos: [1301, 1941],
    drawing: "CRS_CSS326-24G-2S_dimensions_230943.pdf" },
  "CRS328-24P-4S+RM": { build: crs328, guide: "crs328-24p-4s-plus-rm", product: "crs328_24p_4s_rm", photos: [1493, 1494],
    drawing: "CRS32824P4S_dimensions_230947.pdf", provisionalRear: true },
  "CRS354-48G-4S+2Q+RM": { build: crs354, guide: "crs354-48g-4s-plus-2q-plus-rm", product: "crs354_48g_4splus2qplusrm", photos: [1901, 1900] },
  "CRS518-16XS-2XQ-RM": { build: crs518, guide: "crs518-16xs-2xq-rm", product: "crs518_16xs_2xq", photos: [2196, 2197] },
  CRS305: { build: crs305, guide: "crs305-1g-4s-plus-in", product: "crs305_1g_4s_in", photos: [1661, 1660],
    sku: "CRS305-1G-4S+IN", drawing: "05-1G-4SINproductoutlineanddimensiondrawings_250823.pdf",
    chassis: { x: .22, y: .04, width: .56, height: .92 },
    configuration: "CRS305-1G-4S+IN passive desktop chassis with two rear DC jacks. The reset button and status LEDs are on the side, outside these projections. ETH/BOOT accepts PoE input; it does not supply PoE output." },
  CRS309: { build: crs309, guide: "crs309-1g-8s-plus-in", product: "crs309_1g_8s_in", photos: [1730, 1731],
    sku: "CRS309-1G-8S+IN", inventoryRevision: 1,
    chassis: { x: .16, y: .04, width: .68, height: .92 },
    configuration: "CRS309-1G-8S+IN passive desktop chassis, without the optional rack ears, with rear DC input and external heatsink. Its front RS232 console is DB9. ETH/BOOT accepts PoE input, not output.",
    discrepancies: ["Revision 1 appends the omitted DB9 serial endpoint at index 10. All nine previous endpoints retain their indices and saved settings."],
    legacyLayouts: [{ inventoryRevision: 0, portIndexMap: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9 } }] },
};
for (const [model, sku] of [["CRS317", "CRS317-1G-16S+RM"], ["CRS354", "CRS354-48G-4S+2Q+RM"], ["CRS518", "CRS518-16XS-2XQ-RM"]]) {
  definitions[model] = { ...definitions[sku], sku,
    configuration: `Selected ${sku}, the full SKU already named by this catalog entry. Its own photographed panels are reused with the short entry's canonical inventory indices.` };
}
const profiles = new Map();

/** Resolve only explicitly traced MikroTik SKUs, retaining canonical port identities. */
export function resolveMikroTikFaceplate(device) {
  if (device?.faceplate?.vendor !== "MikroTik" || !Object.hasOwn(definitions, device.model)) return null;
  const canonical = canonicalFaceplateDevice(device);
  if (!canonical) return null;
  if (!profiles.has(device.model)) {
    const definition = definitions[device.model];
    const faces = definition.build(canonical.device.ports);
    const provisional = Boolean(definition.provisionalRear);
    profiles.set(device.model, {
      id: `mikrotik-${device.model.toLowerCase()}`, defaultFace: "front", fidelity: provisional ? "family" : "model",
      ...(definition.sku ? { sku: definition.sku, inventoryComplete: true } : {}),
      ...(definition.inventoryRevision ? { inventoryRevision: definition.inventoryRevision, legacyLayouts: definition.legacyLayouts } : {}),
      panelFidelity: { front: "model", rear: provisional ? "schematic" : "model" },
      source: `https://manual.mikrotik.com/hardware/${definition.guide}/`,
      sourcePage: `Hardware guide and official product panel photographs ${definition.photos.join(" / ")}`,
      evidence: definition.sku ? { models: [device.model, definition.sku], scope: "model", reviewed: "2026-09-10",
        front: `https://cdn.mikrotik.com/web-assets/rb_images/${definition.photos[0]}_hi_res.png`,
        rear: `https://cdn.mikrotik.com/web-assets/rb_images/${definition.photos[1]}_hi_res.png`,
        supplemental: definition.drawing ? `https://cdn.mikrotik.com/web-assets/product_files/${definition.drawing}`
          : `https://mikrotik.com/product/${definition.product}`,
        configuration: definition.configuration } : [
        `https://mikrotik.com/product/${definition.product}`,
        ...definition.photos.map((id) => `https://cdn.mikrotik.com/web-assets/rb_images/${id}_hi_res.png`),
        ...(definition.drawing ? [`https://cdn.mikrotik.com/web-assets/product_files/${definition.drawing}`] : []),
      ],
      note: definition.configuration || (provisional ? "Front coordinates follow the model dimension drawing. The single rear AC input is documented, but its position awaits a rear illustration."
        : "Model-specific connector order, panel locations and service components traced from official photographs; normalized drawing proportions are not manufacturing dimensions."),
      limitations: provisional ? ["Rear AC position is provisional; side cooling grilles are not rear-panel fans."] : ["Only the front and rear projections are represented; side and top details are omitted."],
      catalogDiscrepancies: [...discrepancies(definition.sku || device.model), ...(definition.discrepancies || [])],
      chassis: definition.chassis || { x: 0, y: .04, width: 1, height: .92 }, faces,
    });
  }
  return profiles.get(device.model);
}

/** Trace the CCR1072's eight low optical cages, horizontal service sockets, LCD and fixed rear fan row. */
function ccr1072(ports) {
  const slots = ports.filter((port) => port.type === "SFP_PLUS_10G").map((port, index) =>
    socket(port, .052 + index * .053 + Math.floor(index / 2) * .018, .72, .036, .24, String(index + 1)));
  slots.push(socket(ports.find((port) => port.type === "RJ45_1G"), .549, .68, .035, .27, "ETH/BOOT"),
    { ...socket(ports.find((port) => port.type === "Console"), .614, .68, .035, .27, "CONSOLE"),
      descriptionAnchor: { x: .614, y: .42 } });
  return panels([part("vent", .03, .06, .61, .20, undefined, "chevron"),
    part("usb", .574, .51, .014, .29), part("usb-micro", .662, .84, .025, .07),
    part("lcd", .729, .16, .098, .65),
    part("module-bay", .862, .80, .12, .045, undefined, "populated"),
    part("module-bay", .610, .86, .024, .035, undefined, "populated"),
    part("button", .699, .72, .01, .07, undefined, "reset"), ...status(.645, ["USR", "FAULT", "PWR2", "PWR1"], .29),
    part("text", .842, .20, .14, .10, "CCR1072-1G-8S+")], slots,
  [part("psu", .005, .035, .145, .93, "AC1", "ac-inlet-right"),
    part("psu", .153, .035, .145, .93, "AC2", "ac-inlet-right"),
    ...[.465, .56, .665, .76].map((x) => part("fan", x, .075, .087, .82, undefined, "fixed"))]);
}

/** Trace the CRS305's five connector face and two rear barrel inputs without moving its side controls onto the front. */
function crs305(ports) {
  const positions = [.115, .30, .48, .66, .84];
  const ordered = [ports.find((port) => port.type === "RJ45_1G"), ...ports.filter((port) => port.type === "SFP_PLUS_10G")];
  const slots = ordered.map((port, index) => ({
    ...socket(port, positions[index], .50, .13, index ? .40 : .53, index ? String(index) : "ETH/BOOT"),
    descriptionAnchor: { x: positions[index], y: .88 },
  }));
  return panels([], slots, [part("screw", .103, .405, .027, .14),
    part("power", .205, .325, .065, .35, "DC1", "dc-barrel"),
    part("power", .530, .325, .065, .35, "DC2", "dc-barrel"),
    part("vent", .300, .20, .20, .57, undefined, "mesh"),
    part("vent", .625, .20, .245, .57, undefined, "mesh"),
    part("handle", .917, .18, .045, .65), part("screw", .925, .43, .026, .15)]);
}

/** Trace the CRS309's optical row, Ethernet and DB9 serial with its passive rear heatsink. */
function crs309(ports) {
  const slots = ports.filter((port) => port.type === "SFP_PLUS_10G").map((port, index) =>
    socket(port, .095 + index * .074, .70, .056, .29, String(index + 1)));
  slots.push(socket(ports.find((port) => port.type === "RJ45_1G"), .715, .67, .064, .35, "ETH/BOOT"),
    { ...socket(ports.find((port) => port.type === "Console"), .820, .68, .105, .31, "CONSOLE"), connectorKind: "db9" });
  return panels([part("vent", .029, .065, .72, .16, undefined, "mesh"),
    part("vent", .754, .34, .16, .095, undefined, "mesh"),
    part("button", .900, .72, .014, .08, undefined, "reset"),
    ...status(.924, ["USR", "PWR"], .57), part("text", .773, .05, .205, .11, "CRS309-1G-8S+IN")], slots,
  [part("handle", .029, .45, .12, .17),
    part("power", .218, .47, .040, .28, "12–57V DC", "dc-barrel"),
    part("vent", .330, .015, .61, .97, undefined, "fins"),
    part("screw", .953, .71, .029, .19),
    part("screw", .074, .06, .021, .14), part("screw", .957, .06, .021, .14)]);
}

/** Trace the CCR2216's two left QSFPs, six SFP pairs and service stack, with its independently photographed rear modules. */
function ccr2216(ports) {
  const slots = paired(ports.filter((port) => port.type === "SFP28_25G"), .175, .0485, 6, 0, .035, [.72, .36]);
  slots.push(...ports.filter((port) => port.type === "QSFP28_100G").map((port, index) =>
    socket(port, .053 + index * .058, .72, .044, .24, String(index + 1))),
  socket(ports.find((port) => port.type === "Console"), .481, .36, .034, .26, "CONSOLE"),
  socket(ports.find((port) => port.type === "RJ45_1G"), .481, .72, .034, .26, "MGMT"));
  const rear = [part("psu", .008, .035, .147, .93, "AC1", "ac-inlet-right"),
    part("psu", .157, .035, .147, .93, "AC2", "ac-inlet-right")];
  for (let index = 0; index < 4; index++) {
    const x = .357 + index * .157;
    rear.push(part("module-bay", x, .035, .14, .93, undefined, "populated"),
      part("fan", x + .039, .105, .091, .78, undefined, "fixed"),
      part("handle", x + .019, .12, .015, .70));
  }
  return panels([part("vent", .005, .015, .98, .13, undefined, "chevron"),
    part("button", .511, .76, .011, .08, undefined, "reset"), ...status(.528),
    part("text", .80, .22, .18, .13, "CCR2216-1G-12XS-2XQ")], slots, rear);
}

/** Trace the selected CCR2004's left SFP28 stack, single SFP+ row and rear heatsink between two fans. */
function ccr2004(ports) {
  const slots = ports.filter((port) => port.type === "SFP_PLUS_10G").map((port, index) =>
    socket(port, .095 + index * .045, .72, .034, .23, `SFP+${index + 1}`));
  slots.push(...paired(ports.filter((port) => port.type === "SFP28_25G"), .047, .04, 1, 0, .034, [.72, .38]),
    socket(ports.find((port) => port.type === "Console"), .646, .38, .034, .25, "CONSOLE"),
    socket(ports.find((port) => port.type === "RJ45_1G"), .646, .72, .034, .25, "MGMT/BOOT"));
  const front = [part("vent", .023, .035, .645, .10, undefined, "louver"), ...status(.692),
    part("button", .675, .76, .011, .08, undefined, "reset"),
    part("text", .78, .15, .19, .10, "CCR2004-1G-12S+2XS")];
  return panels(front, slots, [part("power", .030, .28, .075, .45, "AC1"),
    part("power", .211, .28, .075, .45, "AC2"),
    part("fan", .340, .055, .089, .86, undefined, "fixed"),
    part("vent", .458, .030, .365, .94, undefined, "fins"),
    part("fan", .828, .055, .089, .86, undefined, "fixed")]);
}

/** Trace the selected CCR2116's four left SFPs, three copper banks and its distinct fixed-power rear panel. */
function ccr2116(ports) {
  const slots = ports.filter((port) => port.type === "RJ45_1G" && port.portIndex <= 12).map((port, index) =>
    socket(port, .119 + index * .0378 + Math.floor(index / 4) * .011, .72, .035, .25, String(index + 1)));
  slots.push(...paired(ports.filter((port) => port.type === "SFP_PLUS_10G"), .035, .034, 2, 0, .030, [.72, .36]),
    socket(ports.find((port) => port.portIndex === 18), .603, .36, .034, .26, "CONSOLE"),
    socket(ports.find((port) => port.portIndex === 17), .603, .72, .034, .26, "ETH/BOOT"));
  const front = [part("vent", .094, .035, .482, .12, undefined, "chevron"),
    part("usb", .629, .515, .016, .34),
    part("button", .653, .740, .011, .08, undefined, "reset"),
    part("button", .676, .740, .011, .08, undefined, "reset"), ...status(.699),
    part("text", .815, .15, .160, .10, "CCR2116-12G-4S+")];
  return panels(front, slots, [part("power", .025, .26, .072, .48, "AC1"),
    part("power", .222, .26, .072, .48, "AC2"),
    part("ring", .112, .075, .093, .84), part("vent", .129, .24, .059, .49, undefined, "mesh"),
    ...[.46, .55, .64, .73].map((x) => part("fan", x, .06, .087, .87, undefined, "fixed"))]);
}

/** Record printed-label and management-speed differences without editing saved inventory. */
function discrepancies(model) {
  const notes = ["The catalog uses one continuous sequence across connector families; the chassis numbers SFP/QSFP banks independently. Saved labels and port identities are preserved."];
  if (model === "CRS354-48G-4S+2Q+RM" || model === "CRS518-16XS-2XQ-RM") {
    notes.push("The management socket is physically 10/100 Ethernet. New instances use a 100 Mbps speed; saved speed settings are retained, and RJ45_1G remains the connector category.");
  }
  return notes;
}

/** Construct one reusable normalized piece of physical hardware artwork. */
function part(kind, x, y, width, height, label, variant) {
  return { kind, x, y, width, height, ...(label ? { label } : {}), ...(variant ? { variant } : {}),
    ...(kind === "text" ? { fontSize: 6 } : {}) };
}

/** Place an inventory port at a measured panel location without renumbering it. */
function socket(port, x, y, width = .03, height = .24, physicalLabel) {
  return { portIndex: port.portIndex, type: port.type, label: port.label, x, y, width, height,
    ...(physicalLabel ? { physicalLabel } : {}) };
}

/** Trace repeated paired sockets with odd ports below even ports and measured bank gaps. */
function paired(ports, x, step, groupColumns, gap, width = .029, y = [.73, .40]) {
  return ports.map((port, index) => {
    const column = Math.floor(index / 2);
    return socket(port, x + column * step + Math.floor(column / groupColumns) * gap, y[index % 2], width, .25,
      /^(?:SFP|QSFP)/.test(port.type) ? String(index + 1) : undefined);
  });
}

/** Draw the small four-LED status cluster used beside CRS service sockets. */
function status(x, labels = ["USR", "FAULT", "PWR2", "PWR1"], y = .31) {
  return labels.flatMap((label, index) => [part("led", x, y + index * .13, .007, .045),
    part("text", x + .011, y + index * .13 - .013, .06, .075, label)]);
}

/** Package a panel and reserve a clear routing marker on the connector-free reverse side. */
function panels(frontComponents, ports, rearComponents, marker = { x: .39, y: .84, width: .23, height: .12 }) {
  return { front: { components: frontComponents, ports }, rear: { components: rearComponents, ports: [], connectionMarker: marker } };
}

/** Trace CRS317's single SFP row, right service stack, dual AC, fans and rear heatsink. */
function crs317(ports) {
  const optical = ports.filter((port) => port.type === "SFP_PLUS_10G");
  const slots = optical.map((port, index) => socket(port, .045 + index * .033 + Math.floor(index / 4) * .017, .73, .030, .22, String(index + 1)));
  slots.push(socket(ports.find((port) => port.type === "Console"), .634, .39),
    socket(ports.find((port) => port.type === "RJ45_1G"), .634, .75));
  const front = [part("text", .81, .16, .17, .13, "CRS317-1G-16S+"), ...status(.674)];
  for (let bank = 0; bank < 4; bank++) front.push(part("vent", .025 + bank * .149, .15, .135, .22, undefined, "louver"));
  return panels(front, slots, [part("power", .047, .30, .066, .38, "AC1"), part("power", .20, .30, .066, .38, "AC2"),
    part("fan", .325, .08, .085, .77), part("fan", .417, .08, .085, .77),
    part("vent", .52, .06, .36, .88, undefined, "fins")], { x: .035, y: .82, width: .24, height: .13 });
}

/** Trace CRS326's three copper banks, low SFP pair, left console and passive DC rear. */
function crs326(ports) {
  const slots = paired(ports.filter((port) => port.type === "RJ45_1G"), .10, .0322, 4, .014);
  slots.push(...ports.filter((port) => port.type === "SFP_PLUS_10G").map((port, index) => socket(port, .54 + index * .048, .75, .034, .20, `SFP${index + 1}`)),
    socket(ports.find((port) => port.type === "Console"), .055, .72, .029, .25));
  return panels([part("text", .79, .13, .18, .13, "CRS326-24G-2S+"),
    part("led", .041, .87, .006, .035), part("led", .057, .87, .006, .035)], slots,
  [part("module-bay", .045, .34, .085, .35), part("vent", .16, .29, .1, .36, undefined, "perforated"),
    part("vent", .29, .18, .11, .56, undefined, "perforated"), part("vent", .44, .29, .21, .36, undefined, "perforated"),
    part("vent", .73, .29, .12, .36, undefined, "perforated"), part("handle", .864, .43, .055, .15),
    part("power", .939, .35, .038, .31, undefined, "dc-barrel"), part("text", .878, .70, .11, .08, "10–30V DC")]);
}

/** Trace the CRS328 PoE front from its dimension drawing while retaining the rear evidence gap. */
function crs328(ports) {
  const slots = paired(ports.filter((port) => port.type === "RJ45_1G"), .158, .033, 4, .027);
  slots.push(...paired(ports.filter((port) => port.type === "SFP_PLUS_10G"), .642, .032, 2, 0, .029),
    socket(ports.find((port) => port.type === "Console"), .724, .74));
  return panels([part("text", .83, .17, .15, .12, "CRS328-24P-4S+"),
    part("led", .752, .73, .007, .05), part("led", .774, .73, .007, .05)], slots,
  [part("power", .095, .30, .067, .40, "AC")]);
}

/** Trace CRS354's four copper banks and optical/service stacks, with three rear fans. */
function crs354(ports) {
  const slots = paired(ports.filter((port) => port.type === "RJ45_1G" && port.label !== "MGMT"), .039, .0309, 6, .017);
  slots.push(...paired(ports.filter((port) => port.type === "SFP_PLUS_10G"), .836, .033, 2, 0, .029),
    ...paired(ports.filter((port) => port.type === "QSFP_PLUS_40G"), .913, .035, 1, 0, .043),
    socket(ports.find((port) => port.type === "Console"), .962, .40, .032),
    socket(ports.find((port) => port.label === "MGMT"), .962, .73, .032));
  return panels([part("led", .962, .16, .006, .04)], slots,
  [part("fan", .025, .09, .087, .75), part("fan", .12, .09, .087, .75), part("power", .226, .28, .075, .44, "AC1"),
    part("power", .776, .28, .075, .44, "AC2"), part("fan", .874, .09, .087, .75),
    part("vent", .443, .16, .018, .61, undefined, "perforated"), part("vent", .58, .16, .018, .61, undefined, "perforated")]);
}

/** Trace CRS518's left QSFP pair, SFP28 columns, service stack and removable rear modules. */
function crs518(ports) {
  const slots = paired(ports.filter((port) => port.type === "SFP28_25G"), .186, .0485, 8, 0, .035, [.70, .35]);
  slots.push(...ports.filter((port) => port.type === "QSFP28_100G").map((port, index) => socket(port, .064 + index * .059, .70, .044, .24, String(index + 1))),
    socket(ports.find((port) => port.type === "Console"), .583, .35, .033),
    socket(ports.find((port) => port.type === "RJ45_1G"), .583, .70, .033));
  const rear = [part("psu", .01, .055, .142, .76, "PSU1"), part("psu", .157, .055, .142, .76, "PSU2")];
  for (let index = 0; index < 4; index++) {
    const x = .36 + index * .155;
    rear.push(part("module-bay", x, .045, .147, .78, undefined, "populated"),
      part("fan", x + .047, .11, .091, .66), part("handle", x + .008, .15, .026, .54));
  }
  return panels([part("vent", .005, .015, .98, .13, undefined, "chevron"), part("usb", .628, .44, .016, .32),
    part("button", .61, .64, .011, .08), ...status(.652, ["USR", "FAULT", "PWR2", "PWR1"], .27),
    part("text", .87, .25, .11, .12, "CRS518-16XS-2XQ")], slots, rear,
  { x: .04, y: .855, width: .23, height: .125 });
}
