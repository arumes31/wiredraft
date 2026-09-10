import { canonicalFaceplateDevice } from "./faceplate-profile.js";

const definitions = {
  "CRS317-1G-16S+RM": { build: crs317, guide: "crs317-1g-16s-plus-rm", product: "crs317_1g_16s_rm", photos: [1324, 2055] },
  "CRS326-24G-2S+RM": { build: crs326, guide: "crs326-24g-2s-plus-rm", product: "CRS326-24G-2SplusRM", photos: [1301, 1941],
    drawing: "CRS_CSS326-24G-2S_dimensions_230943.pdf" },
  "CRS328-24P-4S+RM": { build: crs328, guide: "crs328-24p-4s-plus-rm", product: "crs328_24p_4s_rm", photos: [1493, 1494],
    drawing: "CRS32824P4S_dimensions_230947.pdf", provisionalRear: true },
  "CRS354-48G-4S+2Q+RM": { build: crs354, guide: "crs354-48g-4s-plus-2q-plus-rm", product: "crs354_48g_4splus2qplusrm", photos: [1901, 1900] },
  "CRS518-16XS-2XQ-RM": { build: crs518, guide: "crs518-16xs-2xq-rm", product: "crs518_16xs_2xq", photos: [2196, 2197] },
};
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
      panelFidelity: { front: "model", rear: provisional ? "schematic" : "model" },
      source: `https://manual.mikrotik.com/hardware/${definition.guide}/`,
      sourcePage: `Hardware guide and official product panel photographs ${definition.photos.join(" / ")}`,
      evidence: [
        `https://mikrotik.com/product/${definition.product}`,
        ...definition.photos.map((id) => `https://cdn.mikrotik.com/web-assets/rb_images/${id}_hi_res.png`),
        ...(definition.drawing ? [`https://cdn.mikrotik.com/web-assets/product_files/${definition.drawing}`] : []),
      ],
      note: provisional ? "Front coordinates follow the model dimension drawing. The single rear AC input is documented, but its position awaits a rear illustration."
        : "Model-specific connector order, panel locations and service components traced from official photographs; normalized drawing proportions are not manufacturing dimensions.",
      limitations: provisional ? ["Rear AC position is provisional; side cooling grilles are not rear-panel fans."] : ["Only the front and rear projections are represented; side and top details are omitted."],
      catalogDiscrepancies: discrepancies(device.model),
      chassis: { x: 0, y: .04, width: 1, height: .92 }, faces,
    });
  }
  return profiles.get(device.model);
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
  return panels([part("text", .035, .06, .18, .10, "CRS354-48G-4S+2Q+"), part("led", .962, .16, .006, .04)], slots,
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
