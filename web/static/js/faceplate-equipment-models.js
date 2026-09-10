import { canonicalFaceplateDevice, layoutPanelPorts } from "./faceplate-profile.js";
import { resolveMikroTikFaceplate } from "./faceplate-mikrotik-models.js";
import { resolveOmadaFaceplate } from "./faceplate-omada-models.js";
import { resolveNetgearFaceplate } from "./faceplate-netgear-models.js";
import { resolveAccessPointFaceplate } from "./faceplate-access-point-models.js";
import { resolveDellServerFaceplate } from "./faceplate-dell-server-models.js";
import { resolveHPEServerFaceplate } from "./faceplate-hpe-server-models.js";
import { resolveTeltonikaFaceplate } from "./faceplate-teltonika-models.js";
import { resolveAdtranFaceplate } from "./faceplate-adtran-models.js";

// Panel roles follow the cited hardware guides. Family and configurable layouts
// preserve the catalog's representative inventory rather than asserting SKU dimensions.
const SOURCES = {
  ubiquiti: "https://dl.ui.com/qsg/USW-Pro-24-POE/USW-Pro-24-POE_EN.html",
  uci: "https://dl.ui.com/qig/uci/",
  mikrotik: "https://manual.mikrotik.com/docs/hardware/",
  crs317: "https://manual.mikrotik.com/hardware/crs317-1g-16s-plus-rm/",
  netgear: "https://www.downloads.netgear.com/files/GDC/M4300/M4300_HIG_EN.pdf",
  m4250: "https://www.downloads.netgear.com/files/GDC/M4250/M4250_HIG_EN.pdf",
  gs108: "https://www.downloads.netgear.com/files/GDC/GS108Tv3/GS108Tv3_GS110TPv3_HIG_EN.pdf",
  omada: "https://static.tp-link.com/upload/manual/2025/202512/20251211/7100002449_Omada%20Access%20Plus%26Pro%20Switch%20Multi-model_IG.pdf",
  sg2008: "https://static.tp-link.com/2020/202006/20200611/71065058727_TL-SG2008P%28UN%291.0_IG.pdf",
  dell: "https://i.dell.com/sites/csdocuments/product_docs/en/poweredge-r650-technical-guide.pdf",
  hpe: "https://support.hpe.com/hpesc/public/docDisplay?docId=a00115362en_us&page=GUID-A907F1AD-6041-4CD5-9C29-47DF3AC366A9.html",
  synology: "https://global.download.synology.com/download/Document/Hardware/HIG/RackStation/16-year/RS816/enu/Syno_HIG_RS816_enu.pdf",
  qnap: "https://download.qnap.com/TechnicalDocument/Storage/SMB%20NAS/ts-x32pxu/ts-x32pxu-ug-02-en.pdf",
  netapp: "https://docs.netapp.com/us-en/ontap-systems/fas9000/maintain-overview.html",
  powerstore: "https://www.dell.com/support/manuals/en-us/powerstore-emp-partner/pwrstr-hwg/base-enclosure-rear-view?guid=guid-03cae741-b143-4e08-9fa3-f000d74b0863&lang=en-us",
  powervault: "https://www.dell.com/support/manuals/en-us/powervault-me5012/me5_series_om/storage-system-hardware",
  apc: "https://www.se.com/us/en/download/document/SPD_MMIS-8HUQTU_EN/",
  cyberpower: "https://www.cyberpowersystems.com/products/ups/smart-app-sinewave/",
  eaton: "https://www.eaton.com/us/en-us/catalog/backup-power-ups-surge-it-power-distribution/eaton-5px-ups.html",
  vertiv: "https://www.vertiv.com/en-us/products-catalog/critical-power/uninterruptible-power-supplies-ups/liebert-gxt5-ups/",
  opengear: "https://resources.opengear.com/om/manuals/25.11.1/Content/Operations_Manager_User_Guide.pdf",
  lantronix: "https://www.lantronix.com/wp-content/uploads/pdf/SLC_UG.pdf",
  raritan: "https://www.raritan.com/products/kvm-serial/serial-console-servers/serial-over-ip-console-server",
  teltonika: "https://wiki.teltonika-networks.com/view/QSG_RUTX50",
  adtran: "https://www.adtran.com/-/media/adtran/resources/data-sheets/pdfs/fsp-150-ge-104-e.pdf",
  arubaAP: "https://www.arubanetworks.com/techdocs/hardware/aps/ap630/ig/AP-630_Install_Guide_EN.pdf",
  ciscoAP: "https://www.cisco.com/c/en/us/td/docs/wireless/access_point/cw916x/cw9166/install-guide/b-hig-cw9166i/hardware-features.html",
  unifiAP: "https://techspecs.ui.com/unifi/wifi/u7-pro",
  generic: "Built-in configurable schematic",
};
const vendors = new Set(["Ubiquiti", "MikroTik", "NETGEAR", "TP-Link Omada", "HPE", "Synology", "QNAP", "NetApp",
  "APC", "CyberPower", "Eaton", "Vertiv", "Opengear", "Lantronix", "Raritan", "Teltonika Networks", "ADTRAN",
  "Generic Edge", "Generic Facility", "Generic KVM", "Generic Lab", "Generic Patch"]);
const cachedProfiles = new Map();
const networkGuides = {
  "CRS317": SOURCES.crs317,
  "CRS317-1G-16S+RM": SOURCES.crs317,
  "CRS326-24G-2S+RM": "https://manual.mikrotik.com/hardware/crs326-24g-2s-plus-rm/",
  "CRS328": "https://manual.mikrotik.com/hardware/crs328-24p-4s-plus-rm/",
  "CRS328-24P-4S+RM": "https://manual.mikrotik.com/hardware/crs328-24p-4s-plus-rm/",
  "CRS354": "https://manual.mikrotik.com/hardware/crs354-48g-4s-plus-2q-plus-rm/",
  "CRS354-48G-4S+2Q+RM": "https://manual.mikrotik.com/hardware/crs354-48g-4s-plus-2q-plus-rm/",
  "CRS518": "https://manual.mikrotik.com/hardware/crs518-16xs-2xq-rm/",
  "CRS518-16XS-2XQ-RM": "https://manual.mikrotik.com/hardware/crs518-16xs-2xq-rm/",
  "CCR2116": "https://manual.mikrotik.com/hardware/ccr2116-12g-4s-plus/",
  "UniFi Pro Max 24 PoE": "https://techspecs.ui.com/unifi/switching/usw-pro-max-24-poe",
  "UniFi Pro Max 48 PoE": "https://techspecs.ui.com/unifi/switching/usw-pro-max-48-poe",
  "USW-Pro-Max-48-PoE": "https://techspecs.ui.com/unifi/switching/usw-pro-max-48-poe",
  "USW-Enterprise-48-PoE": "https://techspecs.ui.com/unifi/switching/usw-enterprise-48-poe",
  "UDM-Pro-Max": "https://techspecs.ui.com/unifi/cloud-gateways/udm-pro-max",
};
const networkDiscrepancies = {
  "UniFi Pro Max 24 PoE": ["Catalog copper ports all use 2.5G speed and RJ45_10G type; the manufacturer lists 16 × 1G and 8 × 2.5G. Existing port types and IDs are preserved."],
  "UniFi Pro Max 48 PoE": ["Catalog copper ports all use 2.5G speed and RJ45_10G type; the manufacturer lists 32 × 1G and 16 × 2.5G. Existing port types and IDs are preserved."],
  "USW-Pro-Max-48-PoE": ["Catalog lists 48 × 2.5G plus a dedicated MGMT port; the manufacturer lists 32 × 1G, 16 × 2.5G and no dedicated MGMT socket. Existing inventory is preserved."],
  "USW-Enterprise-48-PoE": ["The catalog adds a dedicated MGMT socket to the documented 48 copper and 4 optical interfaces. Existing inventory is preserved."],
  "UDM-Pro-Max": ["The catalog uses 8 multigigabit access ports and a 1G MGMT socket; the manufacturer lists 8 × 1G LAN and a 2.5G WAN socket. Existing inventory is preserved."],
};

/** Resolve known equipment panels, or an explicitly configured Static server's current inventory. */
export function resolveEquipmentFaceplate(device) {
  const adtran = resolveAdtranFaceplate(device);
  if (adtran) return adtran;
  const hpeServer = resolveHPEServerFaceplate(device);
  if (hpeServer) return hpeServer;
  const teltonika = resolveTeltonikaFaceplate(device);
  if (teltonika) return teltonika;
  const dellServer = resolveDellServerFaceplate(device);
  if (dellServer) return dellServer;
  const accessPoint = resolveAccessPointFaceplate(device);
  if (accessPoint) return accessPoint;
  const netgear = resolveNetgearFaceplate(device);
  if (netgear) return netgear;
  const omada = resolveOmadaFaceplate(device);
  if (omada) return omada;
  const mikrotik = resolveMikroTikFaceplate(device);
  if (mikrotik) return mikrotik;
  if (device?.faceplate?.vendor === "Static" && device.category === "Server" && Array.isArray(device.ports)) {
    return serverProfile({ catalog: { vendor: "Static", model: device.model, category: "Server" }, device });
  }
  const canonical = canonicalFaceplateDevice(device);
  if (!canonical) return null;
  const { catalog } = canonical;
  if (!vendors.has(catalog.vendor) && !(catalog.vendor === "Dell" && catalog.category === "Server") &&
    !(["Cisco", "HPE Aruba"].includes(catalog.vendor) && catalog.category === "AccessPoint")) return null;
  if (!cachedProfiles.has(catalog)) cachedProfiles.set(catalog, equipmentProfile(canonical));
  return cachedProfiles.get(catalog);
}

/** Dispatch explicit catalog categories to their physical panel conventions. */
function equipmentProfile(canonical) {
  const { catalog } = canonical;
  if (catalog.category === "PatchPanel") return passiveProfile(canonical);
  if (catalog.category === "AccessPoint") return accessPointProfile(canonical);
  if (["APC", "CyberPower", "Eaton", "Vertiv"].includes(catalog.vendor)) return upsProfile(canonical);
  if (catalog.category === "Server") return serverProfile(canonical);
  if (["Opengear", "Lantronix", "Raritan", "Generic KVM"].includes(catalog.vendor)) return consoleProfile(canonical);
  if (catalog.model === "UniFi Cable Internet") return cableInternetProfile(canonical);
  if (["Generic Edge", "Teltonika Networks", "ADTRAN"].includes(catalog.vendor)) return edgeProfile(canonical);
  return switchProfile(canonical);
}

/** Create a normalized reusable physical component with optional visible caption. */
function component(kind, x, y, width, height, label, variant) {
  return { kind, x, y, width, height, ...(label ? { label } : {}), ...(variant ? { variant } : {}),
    ...(kind === "text" ? { fontSize: 6 } : {}) };
}

/** Pair physical artwork with independently connectable typed inventory slots. */
function panel(components, ports = []) {
  return { components, ports };
}

/** Describe a panel's evidence and approximation without changing inventory properties. */
function profile(canonical, faces, { source, sourcePage, fidelity = "family", defaultFace = "front", width = 1, note, catalogDiscrepancies = [] }) {
  return {
    id: `equipment-${canonical.catalog.vendor}-${canonical.catalog.model}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    defaultFace, fidelity, source, sourcePage, note, limitations: [note], catalogDiscrepancies,
    chassis: { x: (1 - width) / 2, y: .04, width, height: .92 }, faces,
  };
}

/** Separate management sockets from data without treating a console server's serial bank as management. */
function isManagement(port) {
  return /^(?:management|MGMT|CONSOLE|iDRAC|iLO|BMC|NMC|RMCARD|NETWORK|UNITY)$/i.test(port.group || "") ||
    /^(?:MGMT|iDRAC|iLO|BMC)(?:\d+)?$/i.test(port.label || "");
}

/** Add a restrained power/status strip outside the connector field. */
function indicators(x = .04, y = .39, labels = ["PWR", "SYS", "LINK"]) {
  return labels.flatMap((label, index) => [
    component("led", x, y + index * .13, .009, .055),
    component("text", x + .018, y + index * .13 - .018, .075, .09, label),
  ]);
}

/** Use a labeled configuration region rather than inventing a modular part population. */
function serviceArea(label, x, y, width, height) {
  return [component("module-bay", x, y, width, height),
    component("text", x + width * .06, y + height * .35, width * .88, height * .28, label)];
}

/** Fit data and management banks into disjoint regions with canonical stable indices. */
function networkPorts(ports, { dataX = .25, rows = 2, width = .70, height = .46, y = .28 } = {}) {
  return [
    ...layoutPanelPorts(ports.filter((port) => !isManagement(port)), { x: dataX, y, width, height },
      { rows, portWidth: .038, portHeight: .23 }),
    ...layoutPanelPorts(ports.filter(isManagement), { x: .145, y: .31, width: .07, height: .4 },
      { rows: 2, portWidth: .033, portHeight: .19 }),
  ];
}

/** Render network front banks and rear service geometry with documented AV-panel reversal. */
function switchProfile(canonical) {
  const { catalog, device } = canonical;
  const { vendor, model } = catalog;
  const compact = /^(?:GS108T|GS110T|SG2008P|CRS305|CRS309|CRS310|CRS504)$/.test(model);
  const reversed = vendor === "NETGEAR" && model.startsWith("M4250");
  const legacy = /legacy family/.test(model) || model === "UDM-Pro-Max";
  let source = SOURCES.mikrotik;
  if (vendor === "Ubiquiti") source = SOURCES.ubiquiti;
  if (vendor === "NETGEAR") source = reversed ? SOURCES.m4250 : model === "GS108T" ? SOURCES.gs108 : catalog.source || SOURCES.netgear;
  if (vendor === "TP-Link Omada") source = model === "SG2008P" ? SOURCES.sg2008 : SOURCES.omada;
  if (vendor === "MikroTik" && /\/product\/|\/product_files\//.test(catalog.source || "")) source = catalog.source;
  source = networkGuides[model] || source;
  const data = networkPorts(device.ports, { rows: device.ports.length <= 12 ? 1 : 2 });
  const controls = vendor === "Ubiquiti" && !legacy
    ? serviceArea("DISPLAY", .035, .32, .085, .39) : indicators(.035);
  const active = panel([...controls, component("text", .26, .13, .67, .09, "NETWORK INTERFACES")], data);
  if (model === "UDM-Pro-Max") {
    active.components = [...serviceArea("DISPLAY", .035, .32, .085, .39),
      ...serviceArea("STORAGE CONFIGURATION", .27, .29, .24, .40),
      component("text", .57, .18, .37, .10, "NETWORK INTERFACES")];
    active.ports = networkPorts(device.ports, { dataX: .57, width: .38, rows: 2 });
  }
  const service = panel([
    ...serviceArea(compact ? "POWER / SERVICE" : "POWER CONFIGURATION", .06, .27, .25, .40),
    component("vent", .38, .29, .49, .36, undefined, vendor === "MikroTik" ? "slots" : "perforated"),
  ]);
  if (model === "GS108T" || model === "SG2008P") {
    service.components = [component("power", .79, .38, .055, .26, undefined, "dc-barrel"),
      component("text", .72, .20, .2, .1, "DC INPUT"), component("vent", .12, .33, .48, .28)];
  }
  if (model === "CRS317-1G-16S+RM") {
    source = SOURCES.crs317;
    service.components = [component("power", .09, .3, .06, .37, "AC1"), component("power", .19, .3, .06, .37, "AC2"),
      component("fan", .67, .23, .10, .49), component("fan", .80, .23, .10, .49),
      component("vent", .32, .34, .27, .27)];
  }
  const faces = reversed ? { front: panel([...indicators(.07),
    component("text", .26, .27, .62, .13, "FRONT PORT STATUS"),
    ...device.ports.slice(0, 48).map((port, index) => component("led", .27 + Math.floor(index / 2) * .025,
      .49 + (index % 2) * .15, .009, .06))]), rear: active } : { front: active, rear: service };
  return profile(canonical, faces, { source, sourcePage: reversed ? "Hardware overview: front status LEDs and rear ports" : "Hardware overview: connector panel and power panel",
    defaultFace: reversed ? "rear" : "front", width: compact ? .66 : 1, fidelity: legacy ? "schematic" : "family",
    note: legacy ? "Representative catalog inventory; legacy family and gateway configuration are not a verified SKU drawing."
      : "Family panel arrangement with the existing catalog connector population; exact suffix, revision and optional power hardware may differ.",
    catalogDiscrepancies: networkDiscrepancies[model] || [] });
}

/** Show configurable server/storage fronts and rear I/O without asserting disk, PSU or fan counts. */
function serverProfile(canonical) {
  const { catalog, device } = canonical;
  const units = Math.max(1, Number(device.faceplate.unitsU) || 1);
  const storage = ["Synology", "QNAP", "NetApp"].includes(catalog.vendor) || /PowerStore|PowerVault/.test(catalog.model);
  const sources = { HPE: SOURCES.hpe, Dell: SOURCES.dell, Synology: SOURCES.synology, QNAP: SOURCES.qnap, NetApp: SOURCES.netapp };
  const source = /PowerStore/.test(catalog.model) ? SOURCES.powerstore : /PowerVault/.test(catalog.model) ? SOURCES.powervault
    : sources[catalog.vendor] || SOURCES.generic;
  const front = panel([...indicators(.035, .3),
    ...serviceArea(storage ? "DRIVE / MEDIA CONFIGURATION" : "DRIVE / FRONT I/O CONFIGURATION", .17, .22, .74, .46)]);
  const rear = panel([
    component("text", .14, .20, .13, .09, "MANAGEMENT"),
    component("text", .34, .39, .40, .08, storage ? "STORAGE I/O" : "NETWORK ADAPTERS"),
    ...serviceArea(storage ? "CONTROLLER CONFIGURATION" : "EXPANSION CONFIGURATION", .33, .16, .43, .19),
    ...serviceArea("POWER / COOLING", .81, .23, .15, .47),
  ], [
    ...layoutPanelPorts(device.ports.filter(isManagement), { x: .15, y: .39, width: .10, height: .29 }, { rows: 2, portWidth: .035, portHeight: .24 / units }),
    ...layoutPanelPorts(device.ports.filter((port) => !isManagement(port)), { x: .32, y: .50, width: .45, height: .25 },
      { rows: device.ports.length > 10 ? 2 : 1, portWidth: .038, portHeight: .24 / units }),
  ]);
  return profile(canonical, { front, rear }, { source, sourcePage: catalog.vendor === "Static" ? "User-configured server inventory" : "Hardware overview: configurable front bays and rear I/O",
    fidelity: "schematic", defaultFace: "rear", width: /ProLiant ML/.test(catalog.model) ? .58 : 1,
    note: "Configurable schematic. Network sockets follow this inventory; drive, expansion, PSU and fan populations require the exact installed configuration.",
    catalogDiscrepancies: catalog.model === "PowerEdge R650" ? ["The catalog reserves 2U; the cited R650 chassis is 1U. Existing rack allocation is preserved."] : [] });
}

/** Distinguish UPS status and battery access from rear network cards and electrical inventory. */
function upsProfile(canonical) {
  const { catalog, device } = canonical;
  const units = Math.max(1, Number(device.faceplate.unitsU) || 1);
  const source = { APC: SOURCES.apc, CyberPower: SOURCES.cyberpower, Eaton: SOURCES.eaton, Vertiv: SOURCES.vertiv }[catalog.vendor];
  const power = device.ports.filter((port) => port.type === "Power");
  const front = panel([...serviceArea("STATUS DISPLAY", .08, .23, .24, .28),
    ...serviceArea("BATTERY SERVICE", .39, .22, .51, .45), ...indicators(.08, .57, ["PWR", "BATT"])]);
  const rear = panel([
    component("text", .05, .17, .17, .10, "AC CONNECTION"),
    component("text", .26, .17, .19, .10, "NETWORK CARD"),
    ...serviceArea("OUTLET / BATTERY CONFIGURATION", .51, .28, .42, .41),
  ], [...layoutPanelPorts(power, { x: .07, y: .35, width: .13, height: .32 }, { rows: 1, portWidth: .04, portHeight: .30 / units }),
    ...layoutPanelPorts(device.ports.filter((port) => port.type !== "Power"), { x: .27, y: .37, width: .16, height: .25 },
      { rows: 1, portWidth: .035, portHeight: .24 / units })]);
  return profile(canonical, { front, rear }, { source, sourcePage: "UPS family hardware: front status and rear connections", fidelity: "schematic", defaultFace: "rear",
    note: "UPS family schematic; outlet groups, battery connectors and network-card options depend on the installed model." });
}

/** Keep serial/KVM banks separate from Ethernet management and preserve the documented access side. */
function consoleProfile(canonical) {
  const { catalog, device } = canonical;
  const frontPorts = catalog.vendor === "Opengear";
  const kvm = catalog.vendor === "Generic KVM";
  const source = { Opengear: SOURCES.opengear, Lantronix: SOURCES.lantronix, Raritan: SOURCES.raritan }[catalog.vendor] || SOURCES.generic;
  const active = panel([
    component("text", .13, .13, .62, .1, kvm ? "KVM CHANNELS" : "SERIAL DEVICE PORTS"),
    component("text", .81, .13, .15, .1, "MANAGEMENT"), ...indicators(.025),
  ], [...layoutPanelPorts(device.ports.filter((port) => !isManagement(port)), { x: .13, y: .28, width: .64, height: .46 },
    { rows: 2, portWidth: .030, portHeight: .18 }),
  ...layoutPanelPorts(device.ports.filter(isManagement), { x: .82, y: .29, width: .12, height: .43 },
    { rows: 2, portWidth: .035, portHeight: .18 })]);
  const other = panel([...indicators(.055),
    ...serviceArea(frontPorts ? "POWER / SERVICE CONFIGURATION" : "LOCAL CONTROL / STATUS", .23, .25, .64, .43)]);
  return profile(canonical, frontPorts ? { front: active, rear: other } : { front: other, rear: active }, {
    source, sourcePage: frontPorts ? "OM hardware overview: front serial and network interfaces" : "Hardware overview: rear serial ports and front local controls",
    fidelity: "schematic", defaultFace: frontPorts ? "front" : "rear",
    note: "Representative serial/KVM channel inventory. Local console, power supplies and module population vary by exact model." });
}

/** Draw passive inventory once on the front; rear terminations remain nonconnectable artwork. */
function passiveProfile(canonical) {
  const { catalog, device } = canonical;
  const power = catalog.vendor === "Generic Facility";
  const optical = device.ports.some((port) => /LC|SC|MPO|CFP|OSFP/.test(port.type));
  const rows = device.ports.length > 48 ? 4 : device.ports.length > 24 ? 2 : 1;
  const front = panel([
    component("text", .09, .13, .79, .08, power ? "OUTLET BANK / MANAGEMENT" : optical ? "OPTICAL ADAPTER FIELD" : "COPPER PATCH FIELD"),
  ], layoutPanelPorts(device.ports, { x: .07, y: .28, width: .86, height: .46 },
    { rows, portWidth: power ? .037 : .03, portHeight: .23 }));
  const rear = panel([
    ...serviceArea(power ? "POWER FEED / MOUNTING" : optical ? "FIBER TERMINATION / SLACK STORAGE" : "PUNCHDOWN / CABLE TERMINATION", .10, .21, .80, .29),
    component("handle", .14, .59, .29, .08), component("handle", .57, .59, .29, .08),
  ]);
  return profile(canonical, { front, rear }, { source: SOURCES.generic, sourcePage: "Inventory-defined front connectors and illustrative rear termination area",
    fidelity: "schematic", note: "Generic configurable panel. Front/rear physical views do not change link source-side or patch-through semantics." });
}

/** Draw AP cover and connector-side projections with PoE inventory on the service face. */
function accessPointProfile(canonical) {
  const { catalog, device } = canonical;
  const generic = catalog.vendor === "Generic Edge";
  const source = { Ubiquiti: SOURCES.unifiAP, Cisco: SOURCES.ciscoAP, "HPE Aruba": SOURCES.arubaAP }[catalog.vendor] || SOURCES.generic;
  const front = panel([
    component("text", .18, .28, .64, .13, "WIRELESS ACCESS POINT"),
    component("led", .475, .54, .028, .10), component("text", .32, .66, .36, .10, "STATUS"),
  ]);
  const rear = panel([
    component("text", .17, .15, .66, .11, catalog.vendor === "Cisco" ? "CONNECTOR EDGE" : "MOUNT / CONNECTOR SIDE"),
    component("handle", .37, .31, .26, .09),
  ], layoutPanelPorts(device.ports, { x: .20, y: .53, width: .60, height: .23 }, { rows: 1, portWidth: .09, portHeight: .22 }));
  if (catalog.vendor === "HPE Aruba") rear.components.push(component("usb", .12, .32, .10, .11),
    component("usb-micro", .77, .32, .07, .10), component("power", .77, .16, .06, .12, undefined, "dc-barrel"));
  return profile(canonical, { front, rear }, { source, sourcePage: "Hardware overview: front indicators and connector-side view", fidelity: generic ? "schematic" : "family",
    defaultFace: "rear", width: .65, note: "Flattened AP cover and service-side projection; rear denotes the connector-bearing side, including the Cisco connector edge. Mounting accessories are illustrative." });
}

/** Preserve the UCI's split front Ethernet and rear DOCSIS interfaces from the installation guide. */
function cableInternetProfile(canonical) {
  const { device } = canonical;
  const front = panel([...serviceArea("DISPLAY", .046, .30, .063, .42),
    component("text", .15, .24, .1, .10, "2.5 GbE")],
  layoutPanelPorts(device.ports.filter((port) => port.type !== "COAX_F"), { x: .16, y: .43, width: .06, height: .27 },
    { rows: 1, portWidth: .035, portHeight: .24 }));
  const rear = panel([component("text", .43, .22, .14, .10, "COAX"), component("power", .84, .34, .065, .33, "AC")],
    layoutPanelPorts(device.ports.filter((port) => port.type === "COAX_F"), { x: .47, y: .4, width: .06, height: .29 },
      { rows: 1, portWidth: .038, portHeight: .26 }));
  for (const face of [front, rear]) face.connectionMarker = { x: .35, y: .81, width: .23, height: .14 };
  return profile(canonical, { front, rear }, { source: SOURCES.uci, sourcePage: "Hardware overview: front 2.5 GbE, rear coax and AC inlet", fidelity: "model",
    note: "UCI panel roles and connector positions follow the official installation illustrations; normalized proportions are a drawing, not manufacturing dimensions." });
}

/** Separate handoff/WAN media from local Ethernet and project generic edge devices truthfully. */
function edgeProfile(canonical) {
  const { catalog, device } = canonical;
  const teltonika = catalog.vendor === "Teltonika Networks";
  const handoff = /handoff/i.test(catalog.model) || catalog.vendor === "ADTRAN";
  const source = teltonika ? SOURCES.teltonika : catalog.vendor === "ADTRAN" ? SOURCES.adtran : SOURCES.generic;
  const wan = device.ports.filter((port) => /^(?:WAN|NNI|PON|CABLE|DSL)/i.test(port.label) || ["COAX_F", "DSL_RJ11"].includes(port.type));
  const local = device.ports.filter((port) => !wan.includes(port) && !isManagement(port));
  const active = panel([
    component("text", .17, .18, .48, .10, handoff ? "USER NETWORK INTERFACES" : "LAN"),
    component("text", .73, .18, .19, .10, handoff ? "NETWORK HANDOFF" : "WAN / LINE"),
    ...indicators(.025),
  ], [...layoutPanelPorts(local, { x: .18, y: .36, width: .45, height: .33 }, { rows: 1, portWidth: .065, portHeight: .24 }),
    ...layoutPanelPorts(wan, { x: .73, y: .36, width: .19, height: .33 }, { rows: 1, portWidth: .06, portHeight: .24 }),
    ...layoutPanelPorts(device.ports.filter(isManagement), { x: .64, y: .4, width: .075, height: .25 }, { rows: 1, portWidth: .05, portHeight: .20 })]);
  const other = panel([...indicators(.1, .32),
    ...serviceArea(teltonika ? "SIM / RADIO CONNECTIONS" : "STATUS / SERVICE", .31, .25, .55, .39)]);
  if (teltonika) {
    active.components = active.components.filter((item) => item.kind !== "led" && !["PWR", "SYS", "LINK"].includes(item.label));
    active.components.push(...serviceArea("DC / I/O", .025, .34, .10, .31));
    other.components.push(component("usb", .76, .67, .065, .12));
  }
  const frontPorts = teltonika || handoff;
  return profile(canonical, frontPorts ? { front: active, rear: other } : { front: other, rear: active }, {
    source, sourcePage: teltonika ? "Quick start: front Ethernet / four-pin power and rear radio services" : "Connector roles: network handoff, local Ethernet and management",
    fidelity: catalog.vendor === "Generic Edge" ? "schematic" : "family", defaultFace: frontPorts ? "front" : "rear", width: .66,
    note: teltonika ? "RUTX50 panel-role projection. DC/I/O is a four-pin terminal block shown as a service area; radio connectors are outside the cable inventory."
      : "Inventory-defined edge schematic with distinct local and provider media; exact enclosure and service accessories vary by hardware." });
}
