const SOURCES = Object.freeze({
  Fortinet: "https://docs.fortinet.com/product/fortigate/hardware",
  Cisco: "https://www.cisco.com/c/en/us/td/docs/switches/lan/catalyst9200/hardware/install/b-c9200-hig/product_overview.html",
  "HPE Aruba": "https://www.arubanetworks.com/techdocs/hardware/switches/6100/IGSG/igsg_6000-6100.pdf",
  Juniper: "https://www.juniper.net/documentation/us/en/hardware/ex4400/topics/concept/ex4400-models.html",
  Ubiquiti: "https://techspecs.ui.com/unifi/switching/usw-pro-max-24-poe",
  MikroTik: "https://help.mikrotik.com/docs/spaces/UM/pages/17956957/CRS326-24S%202Q%20RM",
  Dell: "https://www.dell.com/support/product-details/en-us/product/networking-s5248f-on/resources/manuals",
  NETGEAR: "https://www.downloads.netgear.com/files/GDC/M4300/M4300_HIG_EN.pdf",
  "TP-Link Omada": "https://static.tp-link.com/upload/manual/2025/202512/20251211/7100002449_Omada%20Access%20Plus%26Pro%20Switch%20Multi-model_IG.pdf",
  Arista: "https://www.arista.com/jp/qsg-7050-series-1ru-gen3/7050-series-1ru-gen3-front-panel",
  Extreme: "https://documentation.extremenetworks.com/5520%20Series%20Installation%20Guide/Universal_Hardware/5520_Series_Installation_Guide/topics/5520_48w_switch_features.shtml",
  Ruckus: "https://support.ruckuswireless.com/documents/1397-ruckus-icx-7150-switch-hardware-installation-guide",
  "Palo Alto": "https://docs.paloaltonetworks.com/hardware/pa-400-hardware-reference/pa-400-firewall-overview/pa-400-front-panel",
  Sophos: "https://docs.sophos.com/nsg/hardware/operatinginstructions/xgs/sophos-operating-instructions-xgs-2100-2300-3100-3300.pdf",
  "Check Point": "https://sc1.checkpoint.com/documents/6000_7000/GSG/EN/Content/Topics/GSG_6000_7000/6000-Appliances-Hardware.htm",
  HPE: "https://www.hpe.com/us/en/compute/proliant-rack-servers.html",
  Lenovo: "https://lenovopress.lenovo.com/",
  IBM: "https://www.ibm.com/docs/en/ts2900tapeautoloader",
  SEH: "https://www.seh-technology.com/fileadmin/user/downloads/deviceserver/documentation/myUTN-80_QIG51.pdf",
  RAD: "https://www.rad.com/product/ethernet-access-devices-routers/etx-203ax-carrier-ethernet/",
  APC: "https://www.apc.com/us/en/product-range/61915-smartups/",
  CyberPower: "https://www.cyberpowersystems.com/products/ups/smart-app-sinewave/",
  Eaton: "https://www.eaton.com/us/en-us/catalog/backup-power-ups-surge-it-power-distribution.html",
  Vertiv: "https://www.vertiv.com/en-us/products-catalog/critical-power/uninterruptible-power-supplies-ups/",
  Opengear: "https://opengear.com/products/om-series-operations-manager/",
  Lantronix: "https://www.lantronix.com/products/lantronix-slc-8000/",
  Raritan: "https://www.raritan.com/products/kvm-serial/serial-console-servers",
  Synology: "https://www.synology.com/en-global/products?product_line=rs_plus",
  QNAP: "https://www.qnap.com/en/product/series/enterprise-nas",
  NetApp: "https://www.netapp.com/data-storage/fas/",
  "Generic Patch": "https://leviton.com/products/commercial/network-solutions/copper-systems/patch-panels",
  "Generic Lab": "https://www.oiforum.com/technical-work/hot-topics/common-electrical-io-cei-112g-2-0/",
  "Generic Facility": "https://www.apc.com/us/en/product-range/61888-rack-pdu/",
  "Generic KVM": "https://www.raritan.com/products/kvm-serial/kvm-over-ip-switches",
  "Generic Edge": "https://www.broadband-forum.org/projects/architecture-and-migration/",
  ADTRAN: "https://www.adtran.com/en/products-and-services/network-termination",
  "Teltonika Networks": "https://teltonika-networks.com/products/routers/rutx50",
});

const STATUS_AREA_X = Object.freeze({
  "fortinet-desktop": .214,
  "fortinet-rack": .218,
  "fortinet-switch": .218,
  "fortinet-compact-switch": .09,
  "fortinet-campus-switch": .135,
  "fortinet-core-switch": .905,
  "fortinet-dense-core-switch": .905,
  "fortinet-rugged-switch": .08,
  "cisco-campus": .218,
  "cisco-datacenter": .218,
  "aruba-campus": .214,
  "aruba-datacenter": .214,
  "ubiquiti-unifi": .218,
});

const templates = Object.freeze({
  "fortinet-desktop": compactStatus(template("fortinet-desktop", "Fortinet", "#e7e8e6", "#c8cdca", "#202426", "#e64135", "slots", "left-io", "desktop"), .214),
  "fortinet-rack": compactStatus(template("fortinet-rack", "Fortinet", "#d8dcda", "#aeb6b4", "#1c2224", "#e64135", "slots", "status-stack", "rack"), .218),
  "fortinet-datacenter": compactStatus(template("fortinet-datacenter", "Fortinet", "#c8cdcb", "#929b99", "#171c1e", "#e64135", "perforated", "status-stack", "datacenter", true), .218),
  "fortinet-blade-carrier": template("fortinet-blade-carrier", "Fortinet", "#252323", "#141414", "#eceeed", "#e64135", "minimal", "none", "modular"),
  "fortinet-modular": template("fortinet-modular", "Fortinet", "#aeb6b4", "#747e7d", "#111719", "#e64135", "mesh", "status-stack", "modular", true),
  "fortinet-switch": template("fortinet-switch", "Fortinet", "#dfe2df", "#b7bfbc", "#192022", "#e64135", "slots", "status-stack", "switch"),
  "fortinet-compact-switch": {
    ...template("fortinet-compact-switch", "Fortinet", "#e7e8e6", "#c8cdca", "#202426", "#e64135", "minimal", "status-stack", "desktop"),
    statusArea: Object.freeze({ kind: "status-stack", x: .09, y: .55, known: true, width: 26, height: 28 }),
  },
  "fortinet-campus-switch": {
    ...template("fortinet-campus-switch", "Fortinet", "#dfe2df", "#b7bfbc", "#192022", "#e64135", "minimal", "status-stack", "switch"),
    statusArea: Object.freeze({ kind: "status-stack", x: .135, y: .55, known: true, width: 26, height: 28 }),
  },
  "fortinet-core-switch": {
    ...template("fortinet-core-switch", "Fortinet", "#d7dbd8", "#aeb6b4", "#171c1e", "#e64135", "perforated", "status-stack", "datacenter"),
    statusArea: Object.freeze({ kind: "status-stack", x: .905, y: .2, known: true, width: 30, height: 28 }),
  },
  "fortinet-dense-core-switch": {
    ...template("fortinet-dense-core-switch", "Fortinet", "#d7dbd8", "#aeb6b4", "#171c1e", "#e64135", "minimal", "status-stack", "datacenter"),
    statusArea: Object.freeze({ kind: "status-stack", x: .89, y: .08, known: true, compact: true, width: 24, height: 10 }),
  },
  "fortinet-rugged": template("fortinet-rugged", "Fortinet", "#4d5352", "#262c2d", "#f0f2ed", "#e64135", "louvers", "sealed", "rugged", true),
  "fortinet-rugged-switch": {
    ...template("fortinet-rugged-switch", "Fortinet", "#d7d9d7", "#929a98", "#171c1e", "#e64135", "minimal", "status-stack", "rugged"),
    statusArea: Object.freeze({ kind: "status-stack", x: .08, y: .08, known: true, compact: true, width: 24, height: 10 }),
  },
  "cisco-campus": template("cisco-campus", "Cisco", "#26343b", "#10191e", "#e7f2f5", "#53bde9", "perforated", "status-stack", "switch"),
  "access-additions-silver": template("access-additions-silver", "", "#c6cccd", "#929799", "#252b2d", "#6c7578", "minimal", "none", "switch"),
  "meraki-access-silver": Object.freeze({
    ...template("meraki-access-silver", "Cisco", "#d5d7d8", "#929799", "#252b2d", "#6c7578", "minimal", "none", "switch"),
    source: "https://documentation.meraki.com/Switching/MS_-_Switches/Product_Information/Overviews_and_Datasheets/MS225_Datasheet",
  }),
  "cisco-datacenter": template("cisco-datacenter", "Cisco", "#1e2b32", "#0c1317", "#e8f3f5", "#53bde9", "mesh", "status-stack", "datacenter", true),
  "aruba-campus": template("aruba-campus", "HPE Aruba", "#313b3d", "#161d1f", "#eef4f1", "#f28c28", "slots", "status-stack", "switch"),
  "aruba-datacenter": template("aruba-datacenter", "HPE Aruba", "#283335", "#11191b", "#edf5f3", "#f28c28", "mesh", "status-stack", "datacenter", true),
  "juniper-ex": template("juniper-ex", "Juniper", "#39413f", "#1a2221", "#f0f4ef", "#7fba46", "perforated", "status-stack", "switch"),
  "ubiquiti-unifi": template("ubiquiti-unifi", "Ubiquiti", "#e8ebe8", "#c8ceca", "#273033", "#73d4ff", "minimal", "lcm", "switch"),
  "ubiquiti-edge": template("ubiquiti-edge", "Ubiquiti", "#303236", "#202428", "#e3e9e9", "#73868b", "minimal", "none", "switch"),
  "paloalto-3400": template("paloalto-3400", "Palo Alto", "#c4c8c7", "#7e888c", "#132229", "#72caff", "minimal", "none", "switch"),
  "juniper-ex-entry": template("juniper-ex-entry", "Juniper", "#c7cbcb", "#969e9f", "#183039", "#76c7a1", "minimal", "none", "switch"),
  "mikrotik-crs": template("mikrotik-crs", "MikroTik", "#d8dcda", "#9fa6a3", "#1b2022", "#596dc8", "slots", "status-stack", "switch"),
  "dell-powerswitch": template("dell-powerswitch", "Dell", "#27363d", "#101a1f", "#e3eef1", "#4aa3d8", "mesh", "status-stack", "datacenter", true),
  "netgear-managed": template("netgear-managed", "NETGEAR", "#292c32", "#111318", "#f0f0f2", "#8e63c7", "perforated", "status-stack", "switch"),
  "tplink-omada": template("tplink-omada", "TP-Link Omada", "#303a38", "#141c1a", "#edf5f0", "#54bd68", "slots", "status-stack", "switch"),
  "arista-datacenter": template("arista-datacenter", "Arista", "#28363b", "#10191d", "#eef5f6", "#48b6d5", "mesh", "status-stack", "datacenter", true),
  "extreme-g2": Object.freeze({...template("extreme-g2", "Extreme", "#756497", "#4f4269", "#f3eff8", "#d9d339", "minimal", "none", "switch"), source: "https://documentation.extremenetworks.com/extremeswitching/downloads/EXOS30_HWInstall.pdf"}),
  "extreme-x695": Object.freeze({...template("extreme-x695", "Extreme", "#30216d", "#20164c", "#f3eff8", "#b8add6", "minimal", "none", "switch"), source: "https://documentation.extremenetworks.com/extremeswitching/downloads/EXOS30_HWInstall.pdf"}),
  "extreme-switch": template("extreme-switch", "Extreme", "#352f3c", "#18131d", "#f1edf4", "#b86fdb", "perforated", "status-stack", "module", true),
  "ruckus-icx": template("ruckus-icx", "Ruckus", "#34312b", "#181713", "#f4f0e8", "#efa044", "slots", "status-stack", "switch"),
  "paloalto-pa": template("paloalto-pa", "Palo Alto", "#303a3e", "#151d20", "#eff4f2", "#f09a32", "minimal", "status-stack", "firewall"),
  "sophos-xgs": template("sophos-xgs", "Sophos", "#31536a", "#142633", "#edf5f7", "#58a8df", "perforated", "status-stack", "firewall", true),
  "checkpoint-quantum": template("checkpoint-quantum", "Check Point", "#41313c", "#20151d", "#f4edf2", "#de6993", "mesh", "status-stack", "module", true),
  "static-server": template("static-server", "Static", "#3c4243", "#191e20", "#e7ecec", "#55d5c5", "mesh", "server", "server", true),
  "generic-patch-panel": template("generic-patch-panel", "Generic Patch", "#343b3d", "#171d1f", "#edf5f3", "#42d9c8", "minimal", "passive", "patch"),
  "generic-switch": template("generic-switch", "Generic", "#344044", "#172124", "#e5eeee", "#57cfc0", "perforated", "status-stack", "switch"),
  "generic-firewall": template("generic-firewall", "Generic", "#3c3e42", "#1b1d21", "#eef0f2", "#ee9e4b", "slots", "status-stack", "firewall"),
  "wireless-ap": template("wireless-ap", "Wireless", "#e5e9e6", "#c6cfca", "#202829", "#4ec9bc", "minimal", "wireless", "ceiling"),
  "carrier-edge": template("carrier-edge", "Carrier", "#303a3d", "#151e21", "#e7f0ef", "#54c8dc", "perforated", "signal", "demarc"),
  "cellular-edge": template("cellular-edge", "Cellular", "#3b4141", "#1a2021", "#eef1ed", "#e3a44d", "louvers", "signal", "rugged"),
  "generic-device": template("generic-device", "Generic", "#3a4143", "#191f21", "#e8eeee", "#69c7bb", "perforated", "status-stack", "device"),
});

function template(id, vendor, surface, surfaceDark, ink, accent, vent, control, form, modules = false) {
  const source = SOURCES[vendor] || "local-template";
  return Object.freeze({
    id, vendor, surface, surfaceDark, ink, accent, vent, control, form, modules,
    source,
    statusArea: statusArea(id, control, source !== "local-template" || id === "static-server"),
  });
}

function compactStatus(base, x) {
  return Object.freeze({
    ...base,
    statusArea: Object.freeze({ kind: base.control, x, y: .08, known: true, compact: true, width: 24, height: 10 }),
  });
}

function statusArea(id, control, known) {
  const dimensions = control === "lcm" ? { width: 39, height: 30 } :
    control === "server" ? { width: 126, height: 66 } : { width: 38, height: 40 };
  return Object.freeze({
    kind: control,
    x: STATUS_AREA_X[id] ?? .219,
    y: .5,
    known,
    ...dimensions,
  });
}

/** Resolve visual materials, limiting source-specific palettes to individually verified catalog models. */
export function resolveFaceplateTemplate(device) {
  const vendor = device.faceplate?.vendor || "";
  const model = device.model || "";
  const category = device.category || "";
  const units = Number(device.faceplate?.unitsU) || 1;

  if ((vendor === "Cisco" && model === "C8200-1N-4T") ||
    (vendor === "HPE Aruba" && ["2530-48G", "2530-24G"].includes(model)) ||
    (vendor === "HPE" && model === "OfficeConnect 1920S 24G 2SFP")) return sourcedTemplate(templates["access-additions-silver"], vendor);

  if (vendor === "Static" || category === "Server") return sourcedTemplate(templates["static-server"], vendor);
  if (category === "PatchPanel") return sourcedTemplate(templates["generic-patch-panel"], vendor);
  if (category === "AccessPoint") return sourcedTemplate(templates["wireless-ap"], vendor);
  if (category === "Modem") return sourcedTemplate(templates["carrier-edge"], vendor);
  if (category === "Router" && /FortiExtender|RUTX|IR1101|\b(?:LTE|5G|Cellular)\b/i.test(model)) {
    return sourcedTemplate(templates["cellular-edge"], vendor);
  }
  if (vendor === "Fortinet") {
    if (["FortiGate 5001E", "FortiGate 5001E1"].includes(model)) return templates["fortinet-blade-carrier"];
    if (/FortiSwitch Rugged/i.test(model)) return templates["fortinet-rugged-switch"];
    if (/Rugged/i.test(model)) return templates["fortinet-rugged"];
    if (/FortiSwitch 108F/i.test(model)) return templates["fortinet-compact-switch"];
    if (/FortiSwitch (?:648F|1048[EG]|2048F|3032[EG])/i.test(model)) return templates["fortinet-dense-core-switch"];
    if (/FortiSwitch (?:624F|T?1024[EF])/i.test(model)) return templates["fortinet-core-switch"];
    if (/FortiSwitch (?:224[DE]|248[DE]|348G|424E|448E|M426E|524D|548D)/i.test(model)) return templates["fortinet-campus-switch"];
    if (/FortiSwitch/i.test(model)) return templates["fortinet-switch"];
    if (/FortiGate\s(?:5001|6000|6001|6300|6301|6500|6501|7000|7000F|7030|7040|7060|7081|7121)/i.test(model)) return templates["fortinet-modular"];
    if (units >= 2 || /FortiGate\s(?:1[018]\d\d|2[0256]\d\d|3\d\d\d|4[248]\d\d)/i.test(model)) return templates["fortinet-datacenter"];
    if (/FortiGate\s(?:30G|31G|40F|50G|51G|60F|61F|70F|71F|70G|71G|80F|81F|90G|91G)/i.test(model)) return templates["fortinet-desktop"];
    return templates["fortinet-rack"];
  }
  if (vendor === "Cisco" && ["Meraki MS120", "Meraki MS210", "Meraki MS225", "Meraki MS120-24P", "Meraki MS225-48FP", "Meraki MS250", "Meraki MS350", "Meraki MS390", "Meraki MS410", "Meraki MS425", "Meraki MS450"].includes(model)) return templates["meraki-access-silver"];
  if (vendor === "Cisco") return /Nexus|9300X/i.test(model) ? templates["cisco-datacenter"] : templates["cisco-campus"];
  if (vendor === "Extreme" && model === "X695") return templates["extreme-x695"];
  if (vendor === "Extreme" && ["X440-G2", "X450-G2", "X460-G2", "X465", "X590", "X690", "X870"].includes(model)) return templates["extreme-g2"];
  if (vendor === "HPE Aruba") return /8325/i.test(model) ? templates["aruba-datacenter"] : templates["aruba-campus"];
  if (vendor === "Ubiquiti" && /^Edge(MAX|Router|Switch) legacy family$/.test(model)) return templates["ubiquiti-edge"];
  if (vendor === "Palo Alto" && ["PA-3400 family", "PA-5200 family", "PA-5400 family", "PA-7000 family"].includes(model)) return templates["paloalto-3400"];
  if (vendor === "Juniper" && ["EX2300 family", "EX3400 family", "EX4100 family", "EX4300 family", "QFX5120 family", "QFX5130 family", "QFX5200 family", "QFX5210 family", "QFX5220 family", "QFX10000 family"].includes(model)) return templates["juniper-ex-entry"];
  const vendorTemplate = {
    Juniper: "juniper-ex", Ubiquiti: "ubiquiti-unifi", MikroTik: "mikrotik-crs",
    Dell: "dell-powerswitch", NETGEAR: "netgear-managed", "TP-Link Omada": "tplink-omada",
    Arista: "arista-datacenter", Extreme: "extreme-switch", Ruckus: "ruckus-icx",
    "Palo Alto": "paloalto-pa", Sophos: "sophos-xgs", "Check Point": "checkpoint-quantum",
  }[vendor];
  if (vendorTemplate) return templates[vendorTemplate];
  if (category === "Switch") return sourcedTemplate(templates["generic-switch"], vendor);
  if (category === "Firewall" || category === "Router") return sourcedTemplate(templates["generic-firewall"], vendor);
  return sourcedTemplate(templates["generic-device"], vendor);
}

function sourcedTemplate(base, vendor) {
  const source = SOURCES[vendor];
  if (!source) return base;
  return { ...base, vendor, source, statusArea: { ...base.statusArea, known: true } };
}

export function faceplateResearchCoverage(profiles) {
  const result = {
    total: profiles.length,
    sourced: 0,
    fallback: 0,
    templates: new Map(),
    labels: { exact: 0, family: 0, generic: 0, modular: 0 },
    positions: { exact: 0, schematic: 0, generic: 0, modular: 0 },
  };
  for (const profile of profiles) {
    const resolved = resolveFaceplateTemplate({
      model: profile.model,
      category: profile.category,
      faceplate: { vendor: profile.vendor, unitsU: profile.units },
    });
    if (resolved.source.startsWith("https://")) result.sourced += 1;
    else result.fallback += 1;
    result.templates.set(resolved.id, (result.templates.get(resolved.id) || 0) + 1);
    const labelFidelity = profile.portLayout?.labelFidelity || "family";
    const positionFidelity = profile.portLayout?.positionFidelity || "schematic";
    result.labels[labelFidelity] = (result.labels[labelFidelity] || 0) + 1;
    result.positions[positionFidelity] = (result.positions[positionFidelity] || 0) + 1;
  }
  return result;
}

export { SOURCES as faceplateResearchSources };
