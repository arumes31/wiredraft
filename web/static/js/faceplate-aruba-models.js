import { canonicalFaceplateDevice } from "./faceplate-profile.js";

const guides = {
  "6100": "https://arubanetworking.hpe.com/techdocs/hardware/switches/6100/IGSG/igsg_6000-6100.pdf",
  "6200": "https://arubanetworking.hpe.com/techdocs/Switches/Aruba_6200/5200-6885/index.html",
  "6300": "https://arubanetworking.hpe.com/techdocs/hardware/switches/6300/IGSG/igsg_6300.pdf",
  "8320": "https://arubanetworking.hpe.com/techdocs/hardware/switches/8320/IGSG/Aruba_8320_IGSG_en_us.pdf",
  "8325": "https://arubanetworking.hpe.com/techdocs/hardware/switches/8325/IGSG/Aruba_8325_IGSG_en_us.pdf",
  "8360": "https://arubanetworking.hpe.com/techdocs/hardware/switches/8360/IGSG/Aruba_8360_IGSG.pdf",
};

const models = new Map([
  ["CX 6000 family", { sku: "R8N85A", series: "6100", copper: 48, aliasSeries: "6000" }],
  ["CX 6100 family", { sku: "JL675A", series: "6100", copper: 48, aliasSeries: "6100" }],
  ["CX 6200 family", { sku: "JL727A", series: "6200", copper: 48, aliasSeries: "6200" }],
  ["CX 6300 family", { sku: "JL661A", series: "6300", copper: 48, aliasSeries: "6300" }],
  ["CX 8320 family", { sku: "JL479A", series: "8320", selectedCore: true }],
  ["CX 8325 family", { sku: "JL624A", series: "8325", selectedCore: true }],
  ["CX 8360 family", { sku: "JL704C", series: "8360", selectedCore: true }],
  ["CX 6300M 24-port Smart Rate", { sku: "R8S89A", series: "6300", selectedCore: true }],
  ["CX 6100 24G 4SFP+", { sku: "JL678A", series: "6100", copper: 24 }],
  ["CX 6100 48G 4SFP+", { sku: "JL676A", series: "6100", copper: 48 }],
  ["CX 6200F 24G 4SFP+", { sku: "JL725A", series: "6200", copper: 24 }],
  ["CX 6200F 48G 4SFP+", { sku: "JL727A", series: "6200", copper: 48 }],
  ["CX 6300M 48G", { sku: "JL661A", series: "6300", copper: 48 }],
  ["CX 8325-48Y8C", { sku: "JL624A", series: "8325" }],
]);
const cache = new Map();

/** Resolve only an explicitly traced Aruba chassis and its documented hardware configuration. */
export function resolveArubaFaceplate(device) {
  if (device?.faceplate?.vendor !== "HPE Aruba" || !models.has(device.model)) return null;
  if (!cache.has(device.model)) {
    const definition = models.get(device.model);
    const canonical = canonicalFaceplateDevice(device);
    if (!canonical) return null;
    if (definition.selectedCore) {
      cache.set(device.model, selectedCoreProfile(canonical.device, definition));
      return cache.get(device.model);
    }
    if (definition.aliasSeries) {
      cache.set(device.model, selectedAliasProfile(canonical.device, definition));
      return cache.get(device.model);
    }
    const { sku, series, copper } = definition;
    const originalCount = copper ? copper + 5 : 57;
    const source = guides[series];
    const panelPages = { "6100": [7, 13], "6300": [9, 23], "8325": [10, 22] }[series];
    const front = series === "6200" ? source.replace("index.html", "tov_001.png") : `${source}#page=${panelPages[0]}`;
    const rear = series === "6200" ? source.replace("index.html", "tel_026.png") : `${source}#page=${panelPages[1]}`;
    cache.set(device.model, {
      id: `aruba-${sku.toLowerCase()}`, sku, defaultFace: "front", fidelity: "model",
      panelFidelity: { front: "model", rear: "model" }, inventoryComplete: true,
      source, sourcePage: series === "6200" ? "Front and rear panel illustrations" : `PDF front ${panelPages[0]}; rear ${panelPages[1]}`,
      evidence: { models: [device.model, sku], front, rear }, inventoryRevision: 1,
      legacyLayouts: [{ inventoryRevision: 0,
        portIndexMap: Object.fromEntries(Array.from({ length: originalCount }, (_, index) => [index + 1, index + 1])),
        portLabels: { [originalCount]: "CONSOLE1" } }],
      note: `The ${sku} front and rear are traced from the manufacturer's installation guide.`,
      limitations: [series === "6200" ? `The selected ${sku} is the 370W Class 4 PoE configuration; the catalog title omits its power suffix.`
        : series === "6300" ? "The selected JL661A is the Class 4 PoE chassis with two fan trays (JL669B, four fans) and two JL086A 680W AC power supplies installed. A second fan tray and power supply are optional; the catalog title omits the PoE suffix."
        : series === "8325" ? "The selected JL624A bundle has front-to-back airflow, six JL628A fans and two JL632A 650W AC power supplies; DC bundles use different inlets."
          : `The selected ${sku} is the non-PoE chassis.`,
        "Side ventilation and top details are outside the front/rear projection."],
      catalogDiscrepancies: [series === "8325"
        ? "Older inventories omit OOB Ethernet and the Micro-USB console. New instances include both, with the existing RJ45 console index retained."
        : "The physical console is USB-C. Older Console endpoint types remain unchanged; their socket artwork follows the actual USB-C inlet.",
        ...(["6200", "6300"].includes(series) ? ["Older inventories omit the dedicated OOB Ethernet socket. New instances append it without shifting the original console index."] : [])],
      chassis: { x: .025, y: .04, width: .95, height: .92 },
      faces: series === "8325" ? corePanels(canonical.device.ports)
        : series === "6300" ? finishAccessPanels(modularAccessPanels(canonical.device.ports), definition) : accessPanels(canonical.device.ports, definition),
    });
  }
  return cache.get(device.model);
}

/** Select exact core or Smart Rate hardware while preserving the historical alias's endpoint namespace. */
function selectedCoreProfile(device, { sku, series }) {
  const smart = series === "6300"; const source = guides[series];
  const pages = { "6300": [13, 23], "8320": [6, 16], "8325": [10, 22], "8360": [17, 23] }[series];
  const configs = {
    "6300": "R8S89A: 24x10G Smart Rate Class 6 PoE; ports 25/26 at 50G and 27/28 at 25G; two JL087A 1050W AC supplies and two JL669B Port-to-Power dual-fan trays installed.",
    "8320": "JL479A: 48x10G SFP+ and six 40G QSFP+; two JL480A X371 400W AC supplies and five JL481A X721 Front-to-Back fan trays from the bundle.",
    "8325": "JL624A: 48x25G SFP28 and eight 100G QSFP28; two JL632A 650W AC supplies and six JL628A fans, all Front-to-Back airflow.",
    "8360": "JL704C 48Y6C v2: 48x25G SFP28 and six 100G QSFP28; two JL601A 850W AC supplies and five JL714A fan trays, all Port-to-Power airflow.",
  };
  const portIndexMap = Object.fromEntries(Array.from({ length: smart ? 29 : series === "8325" ? 58 : 54 }, (_, index) => [index + 1, index + 1]));
  if (!smart && series !== "8325") Object.assign(portIndexMap, { 57: 55, 58: 56 });
  return {
    id: `aruba-${sku.toLowerCase()}-selected-core`, sku, family: `Aruba CX ${series}`, defaultFace: "front", fidelity: "model",
    panelFidelity: { front: "model", rear: "model" }, inventoryComplete: true, rearHardwareVerified: true, inventoryRevision: 1,
    source, sourcePage: `PDF front ${pages[0]}; rear ${pages[1]}; ${smart ? "exact R8S89A manufacturer product photographs establish the copper banks" : "individual model and bundle tables"}`,
    evidence: { scope: "model", models: [sku], catalogAlias: device.model, selectedModel: sku, configuration: configs[series],
      front: smart ? "https://assets.ext.hpe.com/is/image/hpedam/s00011603?$zoom$" : `${source}#page=${pages[0]}`,
      rear: `${source}#page=${pages[1]}`,
      ...(smart ? { rearPhoto: "https://assets.ext.hpe.com/is/image/hpedam/s00011617?$zoom$",
        inventory: "https://arubanetworking.hpe.com/techdocs/AOS-CX/10.16/HTML/fundamentals_6300-6400/Content/Chp_IfaceCfg/Iface_cmds/sys-int-grp.htm" } : {}),
      ...(series === "8360" ? { frontPhoto: "https://assets.ext.hpe.com/is/image/hpedam/s00010736?$zoom$",
        rearPhoto: "https://assets.ext.hpe.com/is/image/hpedam/s00010652?$zoom$",
        numberedPhoto: "https://higherlogicdownload.s3.amazonaws.com/HPE/MessageImages/4d2c7a70675d4bed92663e91c29c7c33.png",
        numberedPhotoProvenance: "8360-48Y6C photograph annotated by HPE Airheads community MVP HH-e4c878; the three QSFP caption pairs show 49/50, 51/52 and 53/54 with upper/lower arrows. This is community illustration evidence and may depict the earlier hardware revision; the official JL704C guide and product photographs establish the selected v2 topology and configuration.",
        numberedPhotoDiscussion: "https://airheads.hpe.com/discussion/8365-aox-cx-group-speed-mismatch-and-default-port-speeds-inconsistencies",
        sfpNumbering: "https://arubanetworking.hpe.com/techdocs/Switches/xcvrs/xcvr_guide/Content/GUID-D6281BF1-D9E4-4CAF-93CC-52D3A2295047.html" } : {}) },
    legacyLayouts: [{ inventoryRevision: 0, portIndexMap, portLabels: smart ? { 29: "CONSOLE" } : { 57: "MGMT", 58: "CONSOLE" } }],
    note: `${device.model} selects the documented ${sku} configuration; other series variants are not represented by this panel.`,
    limitations: [configs[series], "Normalized illustrations preserve relative topology, not manufacturing measurements; side/top surfaces are outside the projection.",
      ...(smart ? ["JL087A requires 110–240VAC. The manufacturer store's exact R8S89A photograph establishes three eight-port copper banks; the guide's generic Figure 1 item 8 incorrectly depicts 48 copper sockets.",
        "This selects the 10G R8S89A, not the older 5G JL660A. Two 50G uplinks and two 25G MACsec uplinks are separate physical pairs."] : []),
      ...(series === "8360" ? ["The official rear product photo labels fan trays JL715A despite showing red latches and JL601A port-to-power supplies. The selected configuration follows the guide's matching JL714A fan requirements, not that inconsistent label combination.",
        "QSFP numbering is corroborated by a 48Y6C HPE community photograph of potentially earlier hardware; the current installation PDF and store thumbnail alone do not resolve its tiny printed numbers."] : [])],
    catalogDiscrepancies: smart ? ["Historical Console 29 remains the RJ45 serial endpoint. New devices append USB-C 30 and management 31; old 50G endpoints 27/28 retain saved types/speeds but are physically 25G uplinks."]
      : series === "8325" ? ["Historical USB-C 58 maps explicitly to the physical USB serial role at Micro-USB 58, preserving saved type/settings; new RJ45 console 59 is appended. Management 57 remains stable."]
        : [`Historical data 55/56 have no cages on ${sku} and remain unmapped. Management 57 maps to 55; historical serial 58 maps to 56.`,
          series === "8320" ? "The selected chassis has 10G SFP+/40G QSFP+ and a single RJ45 serial console; old 25G/100G/USB-C types and speeds remain stored unchanged."
            : "The rear RJ45 serial console is new 57; old USB-C remains the front USB-C serial endpoint."],
    chassis: { x: .025, y: .04, width: .95, height: .92 },
    faces: smart ? smartRatePanels(device.ports) : series === "8320" ? core8320Panels(device.ports)
      : series === "8325" ? core8325AliasPanels(device.ports) : core8360Panels(device.ports),
  };
}

/** Place a compact physical caption at an explicitly clear chassis-relative position. */
function caption(slot, y, x = slot.x, fontSize = 5.5) {
  slot.descriptionAnchor = { x, y, fontSize, boxHeight: 7 };
  return slot;
}

/** Trace JL479A's three paired SFP banks and two vertical columns of three QSFP cages. */
function core8320Panels(ports) {
  const frontPorts = ports.slice(0, 48).map((port, index) => {
    const column = Math.floor(index / 2);
    const slot = socket(port, .06 + column * .0315 + Math.floor(column / 8) * .009, index % 2 ? .56 : .23, .029, .21, String(index + 1));
    slot.compatibleTypes = ["SFP28_25G"];
    return caption(slot, index % 2 ? .735 : .395);
  });
  frontPorts.push(...ports.slice(48, 54).map((port, index) => {
    const row = index % 3; const slot = socket(port, .859 + Math.floor(index / 3) * .045, [.16, .49, .81][row], .040, .16, String(index + 49));
    slot.compatibleTypes = ["QSFP28_100G"];
    return caption(slot, [.31, .64, .945][row]);
  }));
  frontPorts.push(caption(socket(ports[54], .955, .28, .030, .22, "MGMT", "rj45-inverted"), .07),
    caption(socket(ports[55], .955, .62, .030, .22, "CONSOLE", "console"), .945));
  frontPorts.at(-1).compatibleTypes = ["USB_C_CONSOLE"];
  const components = [part("vent", .004, .04, .025, .93, undefined, "perforated"),
    part("vent", .982, .04, .014, .80, undefined, "perforated"), part("vent", .03, .87, .76, .10, undefined, "perforated"),
    part("usb", .735, .79, .03, .07), part("button", .121, .815, .004, .04, undefined, "reset"),
    part("module-bay", .15, .97, .07, .025, undefined, "blank"),
    ...[.047, .061, .080, .096, .111].map((x) => part("led", x, .81, .004, .025))];
  const rear = [part("screw", .013, .72, .02, .15), part("psu", .04, .05, .132, .90, undefined, "aruba-8320-ac"),
    ...Array.from({ length: 5 }, (_, i) => part("fan", .19 + i * .133, .05, .13, .90, undefined, "aruba-8320")),
    part("psu", .864, .05, .132, .90, undefined, "aruba-8320-ac")];
  return { front: { ports: frontPorts, components }, rear: { ports: [], components: rear } };
}

/** Bind the JL624A alias's distinct console and management indices to the same physical chassis. */
function core8325AliasPanels(ports) {
  const faces = corePanels([...ports.slice(0, 56), ports[58], ports[56], ports[57]]);
  faces.front.ports.at(-1).compatibleTypes = ["USB_C_CONSOLE"];
  return faces;
}

/** Trace the JL704C two-row 48Y6C front and its independently accessible rear serial console. */
function core8360Panels(ports) {
  const frontPorts = ports.slice(0, 48).map((port, index) => {
    const column = Math.floor(index / 2);
    return caption(socket(port, .032 + column * .032 + Math.floor(column / 8) * .007, index % 2 ? .68 : .34, .027, .205, String(index + 1)), index % 2 ? .86 : .16);
  });
  frontPorts.push(...ports.slice(48, 54).map((port, index) => caption(socket(port,
    .837 + Math.floor(index / 2) * .046, index % 2 ? .68 : .34, .040, .205, String(index + 49)), index % 2 ? .86 : .16)));
  frontPorts.push(caption(socket(ports[54], .971, .49, .030, .21, "MGMT", "rj45-inverted"), .675, .975),
    caption(socket(ports[55], .971, .20, .027, .075, "USB CONSOLE", "usb-c"), .06));
  const front = [part("vent", .013, .015, .75, .085, undefined, "perforated"),
    part("vent", .013, .95, .91, .035, undefined, "perforated"), part("usb", .956, .78, .030, .10),
    part("button", .74, .02, .007, .055),
    ...[.772, .789, .807].map((x) => part("led", x, .035, .004, .025)),
    ...[.954, .967, .980].map((x) => part("led", x, .33, .003, .02)),
    part("module-bay", .945, .965, .045, .025, undefined, "blank")];
  const rear = [part("led", .017, .07, .004, .025), part("led", .035, .07, .004, .025), part("screw", .020, .73, .02, .16),
    part("psu", .065, .05, .167, .90, undefined, "aruba-8360-ac"),
    ...Array.from({ length: 5 }, (_, index) => part("fan", .240 + index * .110, .05, .105, .90, undefined, "aruba-8360")),
    part("psu", .798, .05, .167, .90, undefined, "aruba-8360-ac")];
  return { front: { ports: frontPorts, components: front }, rear: { ports: [caption(socket(ports[56], .029, .35, .030, .23, "CONSOLE", "console-inverted"), .59)], components: rear } };
}

/** Trace exact R8S89A manufacturer photography rather than the guide's generic 48-port illustration. */
function smartRatePanels(ports) {
  const frontPorts = ports.slice(0, 24).map((port, index) => {
    const column = Math.floor(index / 2);
    return caption(socket(port, .307 + column * .034 + Math.floor(column / 4) * .014, index % 2 ? .73 : .40, .029, .235, String(index + 1), index % 2 ? "rj45" : "rj45-inverted"), index % 2 ? .91 : .205);
  });
  frontPorts.push(...ports.slice(24, 28).map((port, index) => {
    const slot = caption(socket(port, .862 + Math.floor(index / 2) * .035, index % 2 ? .735 : .41, .027, .205, String(index + 25)), index % 2 ? .91 : .205);
    if (index >= 2) slot.compatibleTypes = ["SFP56_50G"];
    return slot;
  }));
  frontPorts.push(caption(socket(ports[28], .942, .73, .029, .235, "CONSOLE", "console"), .915),
    caption(socket(ports[29], .980, .245, .025, .075, "USB CONSOLE", "usb-c"), .115, .973),
    caption(socket(ports[30], .942, .40, .029, .235, "MGMT", "rj45-inverted"), .21));
  const front = [part("vent", .020, .015, .685, .12, undefined, "perforated"),
    part("vent", .020, .97, .9, .023, undefined, "perforated"), part("usb", .975, .51, .012, .32),
    part("button", .922, .08, .007, .055), part("button", .807, .105, .004, .035, undefined, "reset"),
    ...[.713, .739, .765, .791, .832, .850].map((x) => part("led", x, .105, .004, .025)),
    part("module-bay", .94, .98, .049, .018, undefined, "blank")];
  const rear = [part("fan", .018, .045, .29, .91, undefined, "aruba-dual-hex"),
    part("fan", .315, .045, .29, .91, undefined, "aruba-dual-hex"),
    part("psu", .62, .045, .18, .91, undefined, "hpe-flexslot-800"),
    part("psu", .81, .045, .18, .91, undefined, "hpe-flexslot-800")];
  return { front: { ports: frontPorts, components: front }, rear: { ports: [], components: rear } };
}

/** Select an explicitly named PoE SKU for each broad alias without rewriting its historical endpoint identities. */
function selectedAliasProfile(device, definition) {
  const { sku, series, aliasSeries } = definition;
  const basic = series === "6100";
  const source = guides[series];
  const ordered = basic ? device.ports : [...device.ports.slice(0, 52), device.ports[53], device.ports[52]];
  const faces = finishAccessPanels(series === "6300" ? modularAccessPanels(ordered) : accessPanels(ordered, definition), definition);
  const configuration = `${sku}: 48G Class 4 PoE, four ${aliasSeries === "6000" ? "1G SFP" : series === "6300" ? "50G SFP56" : "10G SFP+"}; ` +
    (series === "6300" ? "two JL086A 680W AC supplies and two JL669B X751 Port-to-Power fan trays installed (second supply and tray optional)."
      : "370W PoE budget and one fixed internal AC supply.");
  const front = series === "6200" ? source.replace("index.html", "tov_001.png") : `${source}#page=${basic ? 7 : 9}`;
  const rear = series === "6200" ? source.replace("index.html", "tel_026.png") : `${source}#page=${basic ? 13 : 23}`;
  const portIndexMap = Object.fromEntries(Array.from({ length: 52 }, (_, index) => [index + 1, index + 1]));
  portIndexMap[56] = basic ? 53 : 54;
  if (!basic) portIndexMap[55] = 53;
  return {
    id: `aruba-${sku.toLowerCase()}-selected-alias`, sku, family: `Aruba CX ${aliasSeries}`, defaultFace: "front", fidelity: "model",
    panelFidelity: { front: "model", rear: "model" }, rearHardwareVerified: true, inventoryComplete: true, inventoryRevision: 1,
    source, sourcePage: series === "6200" ? "Front Figure 1 model 4; enlarged controls Figure 2; rear Figure 3"
      : basic ? "PDF front 7/model tables 8, controls 9–10, rear 13" : "PDF front 9/model table 11, controls 12–13, rear 23, power 25, fan 54",
    evidence: { scope: "model", models: [sku], catalogAlias: device.model, selectedModel: sku, front, rear, configuration,
      panelDetail: series === "6200" ? source.replace("index.html", "tov_002.png") : `${source}#page=${basic ? 9 : 12}` },
    legacyLayouts: [{ inventoryRevision: 0, portIndexMap, portLabels: { 55: "MGMT", 56: "CONSOLE" } }],
    chassis: { x: .025, y: .04, width: .95, height: .92 }, faces,
    note: `${device.model} explicitly selects ${sku}; its panel does not represent every member of the series.`,
    limitations: [configuration, "The named family alias selects this full SKU, not every chassis, PoE budget or airflow option in the series.",
      ...(series === "6300" ? ["The Figure 2 table misnames the RJ45 management socket as a console; PDF 17 specifies the single USB-C console and PDF 22 identifies the Ethernet management port."] : []),
      "Side ventilation and top details are outside the front/rear projection; normalized illustrations are not manufacturing measurements."],
    catalogDiscrepancies: ["Historical VSF endpoints 53/54 were extra fabricated sockets. VSF uses physical Ethernet uplinks; these saved endpoints remain unmapped.",
      basic ? "Historical OOB management 55 has no physical socket on the selected chassis and remains unmapped; USB-C console 56 maps to new 53."
        : "Historical management 55 maps to new 53 and USB-C console 56 maps to new 54; saved types, settings and custom captions remain unchanged.",
      ...(series !== "6300" ? [`Historical SFP56 endpoints 49–52 retain their saved type and speed; ${sku} hardware is ${aliasSeries === "6000" ? "1G SFP" : "10G SFP+"}.`] : [])],
  };
}

/** Apply verified access-panel controls, clear captions and selected cooling to either catalog naming scheme. */
function finishAccessPanels(faces, { series }) {
  const basic = series === "6100";
  for (const slot of faces.front.ports) {
    if (slot.portIndex >= 49 && slot.portIndex <= 52) slot.compatibleTypes = ["SFP56_50G"];
    if (slot.portIndex <= 52) slot.descriptionAnchor = { x: slot.x, y: slot.portIndex % 2 ? .20 : .925, fontSize: 5.5, boxHeight: 7 };
    else if (slot.type === "USB_C_CONSOLE") {
      slot.y = basic ? .84 : .22;
      if (basic) slot.height = .075;
      slot.descriptionAnchor = { x: basic ? .966 : series === "6300" ? .943 : slot.x,
        y: basic ? .945 : .08, fontSize: 5.5, boxHeight: 7 };
    } else slot.descriptionAnchor = { x: slot.x, y: series === "6300" ? .67 : .635, fontSize: 5.5, boxHeight: 7 };
  }
  const components = faces.front.components;
  if (basic) {
    faces.front.components = components.filter((item) => item.kind !== "button" && item.kind !== "led");
    faces.front.components.push(part("button", .969, .70, .009, .075),
      part("button", .948, .826, .005, .044, undefined, "reset"),
      ...[.24, .37, .49, .61].map((y) => part("led", .934, y, .004, .035)));
    const inlet = faces.rear.components.find((item) => item.kind === "power");
    delete inlet.label;
    inlet.variant = "ac-c14";
    faces.rear.components.push(part("vent", .215, .19, .027, .055, undefined, "slit"));
  } else {
    faces.front.components = components.filter((item) => !["button", "led", "text"].includes(item.kind));
    const indicators = series === "6300" ? [.703, .739, .765, .791, .83, .848] : [.68, .706, .732, .817, .84];
    faces.front.components.push(...indicators.map((x) => part("led", x, .105, .004, .035)),
      part("button", series === "6300" ? .807 : .784, .103, .004, .038, undefined, "reset"),
      part("button", .974, .10, .009, .075));
    if (series === "6200") faces.front.components.find((item) => item.kind === "usb").y = .735;
    else Object.assign(faces.front.components.find((item) => item.kind === "vent"), { width: .68, height: .13 });
    if (series === "6200") faces.rear.components = [
      ...[.03, .125, .32].map((x) => part("fan", x, .10, .09, .80, undefined, "aruba-fixed-radial")),
      part("screw", .48, .23, .014, .11), part("power", .916, .17, .055, .64, undefined, "ac-sideways")];
    else faces.rear.components = [part("fan", .018, .045, .29, .91, undefined, "aruba-dual-hex"),
      part("fan", .315, .045, .29, .91, undefined, "aruba-dual-hex"),
      part("psu", .62, .045, .18, .91, undefined, "hpe-flexslot-800"),
      part("psu", .81, .045, .18, .91, undefined, "hpe-flexslot-800")];
  }
  return faces;
}

/** Create one nonconnectable physical control, cooling element or printed marking. */
function part(kind, x, y, width, height, label, variant) {
  return { kind, x, y, width, height, ...(label ? { label } : {}), ...(variant ? { variant } : {}) };
}

/** Bind canonical and compatible historical port types to the same observed connector. */
function socket(port, x, y, width, height, physicalLabel, connectorKind) {
  return { portIndex: port.portIndex, type: port.type, label: port.label, x, y, width, height, physicalLabel,
    ...(connectorKind ? { connectorKind } : {}),
    ...(port.type === "USB_C_CONSOLE" ? { compatibleTypes: ["Console"] } : {}) };
}

/** Trace the different copper banks, optical side and service strip on 6100 and 6200F models. */
function accessPanels(ports, definition) {
  const { copper, series } = definition;
  const is6100 = series === "6100";
  const start = is6100 ? (copper === 24 ? .54 : .14) : (copper === 24 ? .45 : .03);
  const step = is6100 ? .0325 : .0335;
  const frontPorts = ports.slice(0, copper).map((port, index) => {
    const column = Math.floor(index / 2);
    return socket(port, start + column * step + Math.floor(column / 6) * .009, index % 2 ? .72 : .38, .027, .235, String(index + 1));
  });
  frontPorts.push(...ports.slice(copper, copper + 4).map((port, index) => socket(port,
    (is6100 ? .035 : .868) + Math.floor(index / 2) * .039, index % 2 ? .73 : .38, .026, .205, String(copper + index + 1))));
  frontPorts.push(socket(ports[copper + 4], is6100 ? .977 : .938, is6100 ? .88 : .135, .025, .09, "CONSOLE", "usb-c"));
  if (!is6100) frontPorts.push(socket(ports[copper + 5], .962, .45, .030, .25, "MGMT", "rj45"));
  const front = [part("text", .92, .01, .065, .08, "aruba"),
    part("usb", is6100 ? .951 : .947, is6100 ? .51 : .66, is6100 ? .009 : .032, is6100 ? .26 : .11),
    part("button", is6100 ? .969 : .955, is6100 ? .71 : .10, .007, .06, undefined, "reset"),
    ...[0, 1, 2, 3].map((index) => part("led", is6100 ? .935 : .847, .11 + index * .085, .004, .035))];
  const rear = is6100 ? [part("power", .085, .29, .06, .46, "AC", "ac"),
    part("screw", .045, .51, .015, .10), part("text", .83, .14, .13, .16, definition.sku)]
    : [part("fan", .03, .10, .09, .80), part("fan", .125, .10, .09, .80),
      part("fan", .32, .10, .09, .80), part("screw", .48, .23, .014, .11),
      part("power", .916, .17, .055, .64, "AC", "ac")];
  return { front: { ports: frontPorts, components: front }, rear: { ports: [], components: rear } };
}

/** Trace the 8325's three-row SFP28 blocks, lower QSFP bank and six separate rear fan trays. */
function corePanels(ports) {
  const frontPorts = ports.slice(0, 48).map((port, index) => {
    const column = Math.floor(index / 3);
    const row = index % 3;
    return caption(socket(port, .058 + column * .035 + Math.floor(column / 2) * .007, [.12, .45, .78][row], .029, .15, String(index + 1)), [.275, .605, .95][row]);
  });
  frontPorts.push(...ports.slice(48, 56).map((port, index) => caption(socket(port,
    .714 + Math.floor(index / 2) * .049, index % 2 ? .815 : .56, .043, .15, String(index + 49)), index % 2 ? .945 : .415)));
  frontPorts.push(caption(socket(ports[56], .955, .52, .031, .22, "CONSOLE", "console"), .69, .94),
    caption(socket(ports[57], .955, .26, .031, .22, "MGMT", "rj45-inverted"), .06),
    caption(socket(ports[58], .955, .83, .024, .06, "USB CONSOLE", "usb-micro"), .945, .94));
  const front = [part("vent", .003, .15, .015, .77, undefined, "perforated"),
    part("vent", .984, .15, .013, .69, undefined, "perforated"),
    part("usb", .89, .79, .029, .105), part("button", .023, .73, .008, .07, undefined, "reset"),
    ...[0, 1, 2, 3, 4].map((index) => part("led", .025, .17 + index * .105, .004, .035)),
    ...Array.from({ length: 8 }, (_, index) => part("led", .701 + Math.floor(index / 2) * .049, index % 2 ? .29 : .12, .004, .03))];
  const rear = [part("screw", .009, .77, .018, .15), part("screw", .973, .77, .018, .15),
    part("psu", .029, .05, .13, .90, undefined, "aruba-8325-ac"),
    ...Array.from({ length: 6 }, (_, index) => part("fan", .176 + index * .110, .05, .108, .90, undefined, "aruba-8325")),
    part("psu", .840, .05, .13, .90, undefined, "aruba-8325-ac")];
  return { front: { ports: frontPorts, components: front }, rear: { ports: [], components: rear } };
}

/** Trace JL661A's 48-port PoE panel and the selected two-tray, dual-AC rear configuration. */
function modularAccessPanels(ports) {
  const frontPorts = ports.slice(0, 48).map((port, index) => {
    const column = Math.floor(index / 2);
    return socket(port, .035 + column * .033 + Math.floor(column / 6) * .011,
      index % 2 ? .73 : .40, .027, .235, String(index + 1));
  });
  frontPorts.push(...ports.slice(48, 52).map((port, index) => socket(port,
    .868 + Math.floor(index / 2) * .036, index % 2 ? .74 : .39, .026, .205, String(index + 49))));
  frontPorts.push(socket(ports[52], .952, .13, .025, .09, "CONSOLE", "usb-c"),
    socket(ports[53], .962, .48, .030, .25, "MGMT", "rj45"));
  const front = [part("vent", .015, .015, .81, .06, undefined, "perforated"),
    part("usb", .947, .735, .030, .105), part("button", .975, .13, .007, .06, undefined, "reset"),
    ...Array.from({ length: 6 }, (_, index) => part("led", .69 + index * .025, .16, .004, .035)),
    ...Array.from({ length: 4 }, (_, index) => part("led", .838, .33 + index * .13, .004, .035))];
  const rear = [part("module-bay", .018, .045, .29, .91, "FAN 1", "populated"),
    part("module-bay", .315, .045, .29, .91, "FAN 2", "populated"),
    ...[.035, .175, .33, .47].map((x) => part("fan", x, .12, .105, .74)),
    part("psu", .62, .045, .18, .91, "PS1", "ac-fan-left"),
    part("psu", .81, .045, .18, .91, "PS2", "ac-fan-left")];
  return { front: { ports: frontPorts, components: front }, rear: { ports: [], components: rear } };
}
