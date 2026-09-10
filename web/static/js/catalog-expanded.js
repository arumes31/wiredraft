// Broad offline catalog coverage for ideas 041-073. These profiles model the
// physical connector population of a representative member of each named
// family. Exact SKU drawings can still be imported and override positions.

const sources = Object.freeze({
  Cisco: "https://www.cisco.com/c/en/us/products/switches/index.html",
  "HPE Aruba": "https://www.hpe.com/us/en/networking/hpe-aruba-networking-cx-switch-series.html",
  HPE: "https://www.hpe.com/us/en/compute/proliant-rack-servers.html",
  Dell: "https://www.dell.com/en-us/shop/ipovw/networking-products",
  NETGEAR: "https://www.netgear.com/business/wired/switches/fully-managed/",
  "TP-Link Omada": "https://www.omadanetworks.com/business-networking/omada-switch-l3-l2-managed/",
  Arista: "https://www.arista.com/en/products/platforms",
  Juniper: "https://www.juniper.net/us/en/products.html",
  Ubiquiti: "https://techspecs.ui.com/",
  MikroTik: "https://mikrotik.com/products/group/ethernet-routers",
  "Palo Alto": "https://www.paloaltonetworks.com/network-security/next-generation-firewall",
  Sophos: "https://www.sophos.com/en-us/products/next-gen-firewall/tech-specs",
  "Check Point": "https://www.checkpoint.com/quantum/next-generation-firewall/",
  Extreme: "https://www.extremenetworks.com/products/switches",
  Ruckus: "https://www.ruckusnetworks.com/products/ethernet-switches/",
});

const g = (zone, count, type, speed, prefix, poe = false, labels) => ({ zone, count, type, speed, prefix, poe, labels });
const r = (count, speed = 1000, poe = false, prefix = "") => g("access", count, speed > 1000 ? "RJ45_MGIG" : "RJ45_1G", speed, prefix, poe);
const t = (count, prefix = "10G") => g("access", count, "RJ45_10G", 10000, prefix);
const u = (count, type = "SFP_PLUS_10G", speed = 10000, prefix = "SFP+") => g("uplink", count, type, speed, prefix);
const mgmt = (count = 1, prefix = "MGMT") => g("management", count, "RJ45_1G", 1000, prefix);
const con = (type = "Console", prefix = "CONSOLE") => g("management", 1, type, 0, prefix);
const stack = (count = 2, prefix = "STACK") => g("uplink", count, "Stack", 40000, prefix);
const labels = (first, count) => Array.from({ length: count }, (_, index) => String(first + index));
const verified = (source) => ({
  fidelity: "exact",
  source,
  note: "Source-verified connector inventory; physical positions remain schematic.",
});
const representative = (source, chassis) => ({
  source,
  note: `Representative ${chassis} connector layout; choose a full hardware suffix for exact patch work.`,
});

function profile(vendor, model, category, units, color, groups, extra = {}) {
  return {
    vendor, model, category, units, color, groups,
    inventoryRevision: extra.inventoryRevision || 0,
    ...(extra.preserveInstalledPorts === true ? { preserveInstalledPorts: true } : {}),
    layout: extra.layout || vendor.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    fidelity: extra.fidelity || "family",
    source: extra.source || sources[vendor] || "built-in generic physical profile",
    note: extra.note || "Family-equivalent connector layout; verify the exact SKU before physical patch work.",
  };
}

const many = (vendor, models, category, units, color, groups, extra) =>
  models.map((model) => profile(vendor, model, category, units, color, typeof groups === "function" ? groups(model) : groups, extra));

const profiles = [
  // Cisco Catalyst, Nexus, Meraki, ASA, Secure Firewall/FTD and ISR.
  ...many("Cisco", ["Catalyst 9200 family", "Catalyst 9300 family"], "Switch", 1, "#263b4b", [r(48, 1000, true), u(4), mgmt(), con("USB_C_CONSOLE"), stack()]),
  ...many("Cisco", ["Catalyst 9400 family", "Catalyst 9600 family"], "Switch", 6, "#263b4b", [u(48, "SFP28_25G", 25000, "SFP28"), u(8, "QSFP28_100G", 100000, "QSFP28"), mgmt(2), con("USB_C_CONSOLE")]),
  ...many("Cisco", ["Catalyst 9500 family"], "Switch", 1, "#263b4b", [u(48, "SFP28_25G", 25000, "SFP28"), u(4, "QSFP28_100G", 100000, "QSFP28"), mgmt(), con("USB_C_CONSOLE"), stack()]),
  ...many("Cisco", ["Nexus 3000 family", "Nexus 5000 family", "Nexus 7000 family", "Nexus 9000 family"], "Switch", 2, "#263b4b", [u(48, "SFP28_25G", 25000, "SFP28"), u(6, "QSFP28_100G", 100000, "QSFP28"), mgmt(), con()]),
  ...many("Cisco", ["Meraki MS120", "Meraki MS210", "Meraki MS225", "Meraki MS250", "Meraki MS350", "Meraki MS390", "Meraki MS410", "Meraki MS425", "Meraki MS450"], "Switch", 1, "#263b4b", [r(48, 1000, true), u(4), mgmt()]),
  profile("Cisco", "ASA 5506-X", "Firewall", 1, "#263b4b", [r(8), mgmt(), con("USB_MINI_CONSOLE"), con("Console", "RJ45-CONSOLE")], { ...verified("https://www.cisco.com/c/en/us/td/docs/security/asa/hw/maintenance/5506xguide/b_Install_Guide_5506/b_Install_Guide_5506_chapter_01.html"), inventoryRevision: 1 }),
  ...many("Cisco", ["ASA 5508-X", "ASA 5516-X"], "Firewall", 1, "#263b4b", [r(8), mgmt(), con("USB_MINI_CONSOLE"), con("Console", "RJ45-CONSOLE")], { ...verified("https://www.cisco.com/c/en/us/td/docs/security/asa/hw/maintenance/5508xguide/b_install_guide_5508/b_install_guide_5508_chapter_0100.html"), inventoryRevision: 1 }),
  ...many("Cisco", ["ASA 5525-X", "ASA 5545-X", "ASA 5555-X"], "Firewall", 1, "#263b4b", [r(8), mgmt(), con()], { ...verified("https://www.cisco.com/c/en/us/td/docs/security/asa/hw/maintenance/5500xguide/5500xhw/asa_overview.html"), inventoryRevision: 1 }),
  profile("Cisco", "Secure Firewall 1010", "Firewall", 1, "#263b4b", [r(6), g("access", 2, "RJ45_1G", 1000, "", true, ["7", "8"]), mgmt(), con("USB_MINI_CONSOLE"), con("Console", "RJ45-CONSOLE")], { ...verified("https://www.cisco.com/c/en/us/td/docs/security/firepower/1010/hw/guide/hw-install-1010/overview.html"), inventoryRevision: 1 }),
  ...many("Cisco", ["Secure Firewall 1120", "Secure Firewall 1140"], "Firewall", 1, "#263b4b", [r(8), u(4, "SFP_1G", 1000, "SFP"), mgmt(), con("USB_MINI_CONSOLE"), con("Console", "RJ45-CONSOLE")], { ...verified("https://www.cisco.com/c/en/us/td/docs/security/firepower/1100/hw/guide/hw-install-1100/overview.html"), inventoryRevision: 1 }),
  ...many("Cisco", ["Secure Firewall 2110", "Secure Firewall 2120"], "Firewall", 1, "#263b4b", [r(12), u(4, "SFP_1G", 1000, "SFP"), mgmt(), con()], { ...verified("https://www.cisco.com/c/en/us/td/docs/security/firepower/2100/hw/guide/b_install_guide_2100/overview.html"), inventoryRevision: 1 }),
  ...many("Cisco", ["Secure Firewall 2130", "Secure Firewall 2140"], "Firewall", 1, "#263b4b", [r(12), u(4), mgmt(), con()], { ...verified("https://www.cisco.com/c/en/us/td/docs/security/firepower/2100/hw/guide/b_install_guide_2100/overview.html"), inventoryRevision: 1 }),
  ...many("Cisco", ["Secure Firewall 4110", "Secure Firewall 4120", "Secure Firewall 4140", "Secure Firewall 4150"], "Firewall", 1, "#263b4b", [u(8), g("management", 1, "SFP_1G", 1000, "MGMT"), con()], { ...verified("https://www.cisco.com/c/en/us/td/docs/security/firepower/4100/hw/guide/b_install_guide_4100/overview.html"), inventoryRevision: 1 }),
  profile("Cisco", "Secure Firewall 9300", "Firewall", 3, "#263b4b", [u(24, "SFP28_25G", 25000, "SFP28"), u(8, "QSFP28_100G", 100000, "QSFP28"), mgmt(2), con()]),
  ...many("Cisco", ["ISR 1100 family", "ISR 4300 family", "ISR 4400 family"], "Router", 2, "#263b4b", [r(8), u(4), mgmt(), con("USB_C_CONSOLE")]),

  // Aruba/HPE and Dell switching/server families.
  profile("HPE Aruba", "CX 6000 family", "Switch", 1, "#27383a", [r(48, 1000, true), u(4, "SFP_1G", 1000, "SFP"), con("USB_C_CONSOLE")], {
    ...verified("https://arubanetworking.hpe.com/techdocs/hardware/switches/6100/IGSG/igsg_6000-6100.pdf"), inventoryRevision: 1, preserveInstalledPorts: true,
    note: "Selected R8N85A 48G Class 4 PoE 370W, four 1G SFP and USB-C console; one fixed AC supply, no OOB or dedicated VSF sockets." }),
  profile("HPE Aruba", "CX 6100 family", "Switch", 1, "#27383a", [r(48, 1000, true), u(4), con("USB_C_CONSOLE")], {
    ...verified("https://arubanetworking.hpe.com/techdocs/hardware/switches/6100/IGSG/igsg_6000-6100.pdf"), inventoryRevision: 1, preserveInstalledPorts: true,
    note: "Selected JL675A 48G Class 4 PoE 370W, four 10G SFP+ and USB-C console; one fixed AC supply, no OOB or dedicated VSF sockets." }),
  profile("HPE Aruba", "CX 6200 family", "Switch", 1, "#27383a", [r(48, 1000, true), u(4), mgmt(), con("USB_C_CONSOLE")], {
    ...verified("https://arubanetworking.hpe.com/techdocs/Switches/Aruba_6200/5200-6885/index.html"), inventoryRevision: 1, preserveInstalledPorts: true,
    note: "Selected JL727A 48G Class 4 PoE 370W, four 10G SFP+, OOB management and USB-C console; one fixed AC supply and three fixed rear fans." }),
  profile("HPE Aruba", "CX 6300 family", "Switch", 1, "#27383a", [r(48, 1000, true), u(4, "SFP56_50G", 50000, "SFP56"), mgmt(), con("USB_C_CONSOLE")], {
    ...verified("https://arubanetworking.hpe.com/techdocs/hardware/switches/6300/IGSG/igsg_6300.pdf"), inventoryRevision: 1, preserveInstalledPorts: true,
    note: "Selected JL661A 48G Class 4 PoE, four 50G SFP56, OOB management and USB-C console; two JL086A 680W AC supplies and two JL669B fan trays installed." }),
  ...many("HPE Aruba", ["CX 6400 family", "CX 8400 family", "CX 10000 family"], "Switch", 4, "#27383a", [u(48, "SFP28_25G", 25000, "SFP28"), u(8, "QSFP_DD_400G", 400000, "QSFP-DD"), mgmt(2), con("USB_C_CONSOLE")]),
  profile("HPE Aruba", "CX 8320 family", "Switch", 1, "#27383a", [u(48), u(6, "QSFP_PLUS_40G", 40000, "QSFP+"), mgmt(), con()], {
    ...verified("https://arubanetworking.hpe.com/techdocs/hardware/switches/8320/IGSG/Aruba_8320_IGSG_en_us.pdf"), inventoryRevision: 1, preserveInstalledPorts: true,
    note: "Selected JL479A: 48x10G SFP+, six40G QSFP+, front OOB/RJ45 console, dual JL480A400W AC and five JL481A front-to-back fan trays." }),
  profile("HPE Aruba", "CX 8325 family", "Switch", 1, "#27383a", [u(48, "SFP28_25G", 25000, "SFP28"), u(8, "QSFP28_100G", 100000, "QSFP28"), mgmt(), con("USB_MICRO_CONSOLE", "USB CONSOLE"), con()], {
    ...verified("https://arubanetworking.hpe.com/techdocs/hardware/switches/8325/IGSG/Aruba_8325_IGSG_en_us.pdf"), inventoryRevision: 1, preserveInstalledPorts: true,
    note: "Selected JL624A48Y8C front-to-back bundle: front OOB, Micro-USB/RJ45 serial consoles, dual JL632A650W AC and six JL628A fans." }),
  profile("HPE Aruba", "CX 8360 family", "Switch", 1, "#27383a", [u(48, "SFP28_25G", 25000, "SFP28"), u(6, "QSFP28_100G", 100000, "QSFP28"), mgmt(), con("USB_C_CONSOLE", "USB CONSOLE"), con()], {
    ...verified("https://arubanetworking.hpe.com/techdocs/hardware/switches/8360/IGSG/Aruba_8360_IGSG.pdf"), inventoryRevision: 1, preserveInstalledPorts: true,
    note: "Selected JL704C48Y6Cv2 front-to-back bundle: front OOB/USB-C, rear RJ45 serial console, dual JL601A850W AC and five JL714A fan trays." }),
  profile("HPE", "ProLiant DL20", "Server", 1, "#33393b", [r(4, 1000, false, "NIC"), mgmt(1, "iLO"), con("Console", "SERIAL")], {
    ...verified("https://www.hpe.com/us/en/collaterals/collateral.a50007009enw.html"), inventoryRevision: 1, preserveInstalledPorts: true,
    note: "Selected Gen11 P65392-B21 4SFF direct SATA, four embedded 1Gb NICs, P65407-B21 dedicated iLO and DB9 serial kit, two 865438-B21 800W supplies requiring 200–240V AC; media, boot device and expansion cards absent." }),
  profile("HPE", "ProLiant DL160", "Server", 1, "#33393b", [r(2, 1000, false, "NIC"), mgmt(1, "iLO")], {
    ...verified("https://www.hpe.com/us/en/collaterals/collateral.a00021860enw.html"), inventoryRevision: 1, preserveInstalledPorts: true,
    note: "Selected Gen10 878973-B21 8SFF SATA SmartCarriers, one CPU and primary x16/x8 riser, two embedded 1Gb NICs and iLO, two 865438-B21 800W supplies requiring 200–240V AC with 866442-B21; optional Media Module, serial and cards absent." }),
  profile("HPE", "ProLiant DL180", "Server", 2, "#33393b", [r(2, 1000, false, "NIC"), mgmt(1, "iLO")], {
    ...verified("https://www.hpe.com/us/en/collaterals/collateral.a00021862enw.html"), inventoryRevision: 1, preserveInstalledPorts: true,
    note: "Selected Gen10 879517-B21 right 8SFF SATA SmartCarriers, one CPU and 878484-B21 primary riser, two embedded 1Gb NICs and iLO, two 865438-B21 800W supplies requiring 200–240V AC with 866442-B21; other bays and optional adapters covered." }),
  profile("HPE", "ProLiant DL560", "Server", 2, "#33393b", [r(4, 1000, false, "NIC"), mgmt(1, "iLO"), con("Console", "SERIAL")], {
    ...verified("https://support.hpe.com/hpesc/public/api/document/a00008181enw"), inventoryRevision: 1, preserveInstalledPorts: true,
    note: "Selected Gen10 841730-B21, right 8SFF SATA cage, 665240-B21 four-port 1Gb FlexibleLOM, dedicated iLO and DB9 serial; eight covered PCIe positions and two 865414-B21 800W Platinum AC supplies." }),
  ...many("HPE", ["ProLiant DL580", "ProLiant ML30", "ProLiant ML110", "ProLiant ML350"], "Server", 2, "#33393b", [t(4, "NIC"), mgmt(1, "iLO")]),
  profile("HPE", "ProLiant DL325", "Server", 1, "#33393b", [t(2, "NIC"), mgmt(1, "iLO")], {
    ...verified("https://www.hpe.com/us/en/collaterals/collateral.a50004297enw.html"), inventoryRevision: 1,
    note: "Selected Gen11 P54199-B21 8SFF direct SATA configuration, P10097-B21 dual 10Gb BASE-T in OCP slot 21, rear iLO and two 800W supplies; optional media, serial and boot device absent." }),
  profile("HPE", "ProLiant DL345", "Server", 2, "#33393b", [t(2, "NIC"), mgmt(1, "iLO")], {
    ...verified("https://www.hpe.com/us/en/collaterals/collateral.a50004298enw.html"), inventoryRevision: 1,
    note: "Selected Gen11 P54205-B21 right 8SFF direct SATA configuration, P10097-B21 dual 10Gb BASE-T in OCP slot 21, rear iLO and two 800W supplies; other drive boxes and expansion positions covered." }),
  profile("HPE", "ProLiant DL385", "Server", 2, "#33393b", [t(2, "NIC"), mgmt(1, "iLO")], {
    ...verified("https://www.hpe.com/us/en/collaterals/collateral.a50004300enw.html"), inventoryRevision: 1,
    note: "Selected Gen11 P53921-B21 right 8SFF direct SATA configuration, one CPU, P10097-B21 dual 10Gb BASE-T in OCP slot 22, rear iLO and two 800W supplies; secondary riser and optional rear drives covered." }),
  profile("HPE", "ProLiant DL360", "Server", 1, "#33393b", [t(2, "NIC"), mgmt(1, "iLO")], {
    ...verified("https://www.hpe.com/us/en/collaterals/collateral.a50004306enw.html"), inventoryRevision: 1,
    note: "Selected Gen11 P52499-B21 8SFF SATA configuration, P10097-B21 dual 10Gb BASE-T in OCP slot 15, rear iLO and two 800W supplies; front USB-A maintenance ports are ancillary artwork." }),
  profile("HPE", "ProLiant DL380", "Server", 2, "#33393b", [t(2, "NIC"), mgmt(1, "iLO")], {
    ...verified("https://www.hpe.com/us/en/collaterals/collateral.a50004307enw.html"), inventoryRevision: 1,
    note: "Selected Gen11 P52534-B21 right 8SFF SATA configuration, P10097-B21 dual 10Gb BASE-T in OCP slot 15, rear iLO and two 800W supplies; other drive boxes and expansion positions covered." }),
  profile("Dell", "PowerSwitch S3048", "Switch", 1, "#1d3d50", [r(48), g("uplink", 4, "SFP_PLUS_10G", 10000, "", false, labels(49, 4)), mgmt(), con()], {
    ...verified("https://dl.dell.com/content/manual29602505-dell-powerswitch-s3048-on-installation-guide-february-2024.pdf?language=en-us"), inventoryRevision: 1,
    note: "Selected S3048-ON with 48 copper 1GbE ports, four 10G SFP+ cages, front management/serial console and optional second AC supply installed." }),
  profile("Dell", "PowerSwitch S4048", "Switch", 1, "#1d3d50", [g("access", 48, "SFP_PLUS_10G", 10000, "", false, labels(1, 48)), g("uplink", 6, "QSFP_PLUS_40G", 40000, "", false, labels(49, 6)), mgmt(), con(), con("USB_MICRO_CONSOLE", "MICRO-USB")], {
    ...verified("https://dl.dell.com/content/manual30473339-dell-powerswitch-s4048-on-installation-guide-february-2024.pdf?language=en-us"), inventoryRevision: 1,
    note: "Selected S4048-ON with 48 10G SFP+ cages, six 40G QSFP+ cages, both serial console connectors and optional second AC supply installed." }),
  profile("Dell", "PowerSwitch S5048", "Switch", 1, "#1d3d50", [g("access", 48, "SFP28_25G", 25000, "", false, labels(1, 48)), g("uplink", 6, "QSFP28_100G", 100000, "", false, labels(49, 6)), mgmt(), con(), con("USB_MICRO_CONSOLE", "MICRO-USB")], {
    ...verified("https://dl.dell.com/content/manual29957947-dell-powerswitch-s5048f-on-installation-guide-june-2023.pdf?language=en-us"), inventoryRevision: 1,
    note: "Selected S5048F-ON with 48 SFP28 cages, six separate QSFP28 cages, rear management and dual console sockets, four fans and two AC supplies." }),
  profile("Dell", "PowerSwitch S5248", "Switch", 1, "#1d3d50", [g("access", 48, "SFP28_25G", 25000, "", false, labels(1, 48)),
    g("uplink", 2, "QSFP_DD_200G", 200000, "", false, ["49/50", "51/52"]), g("uplink", 4, "QSFP28_100G", 100000, "", false, labels(53, 4)), mgmt(), con(), con("USB_MICRO_CONSOLE", "MICRO-USB")], {
    ...verified("https://dl.dell.com/content/manual38150967-dell-powerswitch-s5200f-on-series-installation-guide-july-2023.pdf?language=en-us"), inventoryRevision: 1,
    note: "Selected S5248F-ON with 48 SFP28, two physical 200G DD cages, four 100G QSFP28, rear management and dual console sockets, four radial fans and two AC supplies." }),
  profile("Dell", "PowerSwitch Z9264", "Switch", 2, "#1d3d50", [g("access", 64, "QSFP28_100G", 100000, "", false, labels(1, 64)),
    g("uplink", 2, "SFP_PLUS_10G", 10000, "", false, labels(65, 2)), mgmt(), con(), con("USB_MICRO_CONSOLE", "MICRO-USB")], {
    ...verified("https://dl.dell.com/content/manual71606330-dell-emc-powerswitch-z9264f-on-installation-guide-march-2022.pdf?language=en-us"), inventoryRevision: 1,
    note: "Selected 2U Z9264F-ON with 64 QSFP28, two SFP+, all front services, four radial fans and two stacked AC supplies; existing saved 1U allocations remain unchanged." }),
  profile("Dell", "PowerSwitch Z9332", "Switch", 1, "#1d3d50", [g("access", 32, "QSFP_DD_400G", 400000, "", false, labels(1, 32)),
    g("uplink", 2, "SFP_PLUS_10G", 10000, "", false, labels(33, 2)), mgmt(), con()], {
    ...verified("https://dl.dell.com/content/manual52104333-dell-emc-powerswitch-z9332f-on-installation-guide-march-2022.pdf?language=en-us"), inventoryRevision: 1,
    note: "Selected Z9332F-ON with 32 physical 400G DD cages, two SFP+, front management/serial, seven covered fan modules and two highline 200–240VAC supplies; no USB console or DC option." }),
  profile("Dell", "PowerEdge R350", "Server", 1, "#303a3e", [r(2, 1000, false, "NIC"), mgmt(1, "iDRAC"), con(), con("USB_MICRO_CONSOLE", "iDRAC-DIRECT")], {
    ...verified("https://i.dell.com/sites/csdocuments/Product_Docs/en/Dell-EMC-PowerEdge-R350-Spec-sheet.pdf"), inventoryRevision: 1,
    note: "1U, two fixed 1GbE LOM, iDRAC, rear DB9 serial and front micro-USB direct management; optional add-in NICs are not installed." }),
  profile("Dell", "PowerEdge R450", "Server", 1, "#303a3e", [r(2, 1000, false, "NIC"), mgmt(1, "iDRAC"), con("USB_MICRO_CONSOLE", "iDRAC-DIRECT")], {
    ...verified("https://i.dell.com/sites/csdocuments/product_docs/en/dell-emc-poweredge-r450-technical-guide.pdf"), inventoryRevision: 1,
    note: "1U with fixed dual 1GbE LOM, dedicated iDRAC and front micro-USB; OCP and optional serial absent in selected configuration." }),
  profile("Dell", "PowerEdge R550", "Server", 2, "#303a3e", [r(2, 1000, false, "NIC"), mgmt(1, "iDRAC"), con("USB_MICRO_CONSOLE", "iDRAC-DIRECT")], {
    ...verified("https://i.dell.com/sites/csdocuments/product_docs/en/dell-emc-poweredge-r550-technical-guide.pdf"), inventoryRevision: 1,
    note: "2U with fixed dual 1GbE LOM, dedicated iDRAC and front micro-USB; OCP and optional serial absent in selected configuration." }),
  profile("Dell", "PowerEdge R650", "Server", 1, "#303a3e", [r(2, 1000, false, "NIC"), mgmt(1, "iDRAC"), con("USB_MICRO_CONSOLE", "iDRAC-DIRECT")], {
    ...verified("https://i.dell.com/sites/csdocuments/product_docs/en/poweredge-r650-technical-guide.pdf"), inventoryRevision: 1,
    note: "1U eight-drive SAS/SATA configuration with dual 1GbE LOM, iDRAC and front micro-USB; no optional add-in NIC or serial." }),
  profile("Dell", "PowerEdge R6525", "Server", 1, "#303a3e", [r(2, 1000, false, "NIC"), mgmt(1, "iDRAC"), con("USB_MICRO_CONSOLE", "iDRAC-DIRECT")], {
    ...verified("https://i.dell.com/sites/csdocuments/product_docs/en/poweredge-r6525-spec-sheet.pdf"), inventoryRevision: 1,
    note: "1U eight-drive configuration with three PCIe covers, dual 1GbE LOM, iDRAC and front micro-USB; OCP omitted." }),
  profile("Dell", "PowerEdge R750", "Server", 2, "#303a3e", [r(2, 1000, false, "NIC"), mgmt(1, "iDRAC"), con("USB_MICRO_CONSOLE", "iDRAC-DIRECT")], {
    ...verified("https://i.dell.com/sites/csdocuments/Product_Docs/en/au/poweredge-r750-technical-guide.pdf"), inventoryRevision: 1,
    note: "2U eight-drive configuration with eight PCIe covers, dual 1GbE LOM, iDRAC and front micro-USB; OCP omitted." }),
  profile("Dell", "PowerEdge R7525", "Server", 2, "#303a3e", [r(2, 1000, false, "NIC"), mgmt(1, "iDRAC"), con("USB_MICRO_CONSOLE", "iDRAC-DIRECT")], {
    ...verified("https://i.dell.com/sites/csdocuments/Product_Docs/en/dell-emc-poweredge-r7525-technical-guide.pdf"), inventoryRevision: 1,
    note: "2U eight-drive configuration with eight PCIe covers, dual 1GbE LOM, iDRAC and front micro-USB; OCP omitted." }),
  profile("Dell", "PowerEdge R6615", "Server", 1, "#303a3e", [r(2, 1000, false, "NIC"), mgmt(1, "iDRAC"), con("USB_MICRO_CONSOLE", "iDRAC-DIRECT")], {
    ...verified("https://www.dell.com/support/manuals/en-us/poweredge-r6615/r6615_ism/nic-port-specifications?guid=guid-b60e54dd-0519-4f84-ab7b-31c5d1d3c929&lang=en-us"), inventoryRevision: 1,
    note: "1U eight-NVMe configuration with optional dual 1GbE LOM installed, iDRAC and front micro-USB; OCP and serial omitted." }),
  profile("Dell", "PowerEdge R7615", "Server", 2, "#303a3e", [r(2, 1000, false, "NIC"), mgmt(1, "iDRAC"), con("USB_MICRO_CONSOLE", "iDRAC-DIRECT")], {
    ...verified("https://www.delltechnologies.com/asset/en-gb/products/servers/technical-support/poweredge-r7615-technical-guide.pdf"), inventoryRevision: 1,
    note: "2U eight-drive configuration with optional dual 1GbE LOM installed, iDRAC and front micro-USB; OCP and serial omitted." }),
  profile("Dell", "PowerEdge R6625", "Server", 1, "#303a3e", [r(2, 1000, false, "NIC"), mgmt(1, "iDRAC"), con("USB_MICRO_CONSOLE", "iDRAC-DIRECT")], {
    ...verified("https://i.dell.com/sites/csdocuments/Product_Docs/en/poweredge-r6625-technical-guide.pdf"), inventoryRevision: 1,
    note: "1U eight-NVMe configuration with optional dual 1GbE LOM installed, iDRAC and front micro-USB; risers, OCP and serial omitted." }),
  profile("Dell", "PowerEdge R7625", "Server", 2, "#303a3e", [r(2, 1000, false, "NIC"), mgmt(1, "iDRAC"), con("USB_MICRO_CONSOLE", "iDRAC-DIRECT")], {
    ...verified("https://www.delltechnologies.com/asset/no-no/products/servers/technical-support/poweredge-r7625-technical-guide.pdf"), inventoryRevision: 1,
    note: "2U eight-drive configuration with optional dual 1GbE LOM installed, iDRAC and front micro-USB; OCP and serial omitted." }),

  ...many("NETGEAR", ["M4250 family", "M4300 family", "M4350 family", "M4500 family"], "Switch", 1, "#30284a", [r(48, 1000, true), u(4), mgmt()]),
  profile("NETGEAR", "GS108T", "Switch", 1, "#30284a", [
    g("access", 8, "RJ45_1G", 1000, "", false, labels(1, 8)),
  ], verified("https://www.netgear.com/uk/business/wired/switches/smart-cloud/gs108tv3/")),
  profile("NETGEAR", "GS110T", "Switch", 1, "#30284a", [
    g("access", 8, "RJ45_1G", 1000, "", false, labels(1, 8)),
    g("uplink", 2, "SFP_1G", 1000, "SFP", false, labels(9, 2)),
  ], verified("https://www.downloads.netgear.com/files/GDC/GS110T/GS110T_HIG_25Oct11.pdf")),
  profile("NETGEAR", "GS724T", "Switch", 1, "#30284a", [
    g("access", 24, "RJ45_1G", 1000, "", false, labels(1, 24)),
    g("uplink", 2, "SFP_1G", 1000, "SFP", false, labels(25, 2)),
  ], verified("https://www.netgear.com/ca-en/business/wired/switches/smart-cloud/gs724t/")),
  profile("NETGEAR", "GS728T", "Switch", 1, "#30284a", [
    g("access", 24, "RJ45_1G", 1000, "", false, labels(1, 24)),
    g("uplink", 4, "SFP_1G", 1000, "SFP", false, labels(25, 4)),
    g("uplink", 2, "SFP_1G", 1000, "COMBO", false, ["23F", "24F"]),
  ], { inventoryRevision: 1, preserveInstalledPorts: true,
    source: "https://www.downloads.netgear.com/files/GDC/GS728TPS/GS7xxTS_TPS_HIG_18Jan2012.pdf",
    note: "Selected GS728TS non-PoE hardware: 24 copper and six SFP apertures, including the shared 23/24 combo pair; existing inventories are preserved." }),
  profile("NETGEAR", "GS748T", "Switch", 1, "#30284a", [
    g("access", 48, "RJ45_1G", 1000, "", false, labels(1, 48)),
    g("uplink", 4, "SFP_1G", 1000, "SFP", false, ["47F", "48F", "49", "50"]),
  ], verified("https://www.netgear.com/business/wired/switches/smart-cloud/gs748tv6/")),
  profile("NETGEAR", "GS752T", "Switch", 1, "#30284a", [
    g("access", 48, "RJ45_1G", 1000, "", false, labels(1, 48)),
    g("uplink", 4, "SFP_1G", 1000, "SFP", false, labels(49, 4)),
    g("uplink", 2, "SFP_1G", 1000, "COMBO", false, ["47F", "48F"]),
  ], { inventoryRevision: 1, preserveInstalledPorts: true,
    source: "https://www.downloads.netgear.com/files/GDC/GS728TPS/GS7xxTS_TPS_HIG_18Jan2012.pdf",
    note: "Selected GS752TS non-PoE hardware: 48 copper and six SFP apertures, including the shared 47/48 combo pair; existing inventories are preserved." }),

  profile("TP-Link Omada", "SG2008P", "Switch", 1, "#24442d", [
    g("access", 4, "RJ45_1G", 1000, "", true, labels(1, 4)),
    g("access", 4, "RJ45_1G", 1000, "", false, labels(5, 4)),
  ], verified("https://www.tp-link.com/us/business-networking/omada-switch-smart/sg2008p/v3.20/")),
  profile("TP-Link Omada", "SG2210MP", "Switch", 1, "#24442d", [
    g("access", 8, "RJ45_1G", 1000, "", true, labels(1, 8)),
    g("uplink", 2, "SFP_1G", 1000, "SFP", false, labels(9, 2)),
  ], verified("https://www.tp-link.com/us/business-networking/omada-switch-access/tl-sg2210mp/v1/")),
  profile("TP-Link Omada", "SG2428P", "Switch", 1, "#24442d", [
    g("access", 24, "RJ45_1G", 1000, "", true, labels(1, 24)),
    g("uplink", 4, "SFP_1G", 1000, "SFP", false, labels(25, 4)),
  ], verified("https://www.tp-link.com/us/business-networking/omada-switch-poe/sg2428p/")),
  profile("TP-Link Omada", "SG3210", "Switch", 1, "#24442d", [
    g("access", 8, "RJ45_1G", 1000, "", false, labels(1, 8)),
    g("uplink", 2, "SFP_1G", 1000, "SFP", false, labels(9, 2)),
    g("management", 1, "Console", 0, "CONSOLE", false, ["CONSOLE"]),
    g("management", 1, "USB_MICRO_CONSOLE", 0, "CONSOLE", false, ["MICRO-USB"]),
  ], verified("https://static.tp-link.com/upload/manual/2024/202411/20241101/7106511506_Omada%20L2%2B%20Managed%20Switch_IG.pdf")),
  profile("TP-Link Omada", "SG3428", "Switch", 1, "#24442d", [
    g("access", 24, "RJ45_1G", 1000, "", false, labels(1, 24)),
    g("uplink", 4, "SFP_1G", 1000, "SFP", false, labels(25, 4)),
    g("management", 1, "Console", 0, "CONSOLE", false, ["CONSOLE"]),
    g("management", 1, "USB_C_CONSOLE", 0, "CONSOLE", false, ["USB-C"]),
  ], verified("https://static.tp-link.com/upload/product-overview/2025/202512/20251204/SG3428%28UN%29%202.40%20datasheet.pdf")),
  profile("TP-Link Omada", "SG3452", "Switch", 1, "#24442d", [
    g("access", 48, "RJ45_1G", 1000, "", false, labels(1, 48)),
    g("uplink", 4, "SFP_1G", 1000, "SFP", false, labels(49, 4)),
    g("management", 1, "Console", 0, "CONSOLE", false, ["CONSOLE"]),
    g("management", 1, "USB_MICRO_CONSOLE", 0, "CONSOLE", false, ["MICRO-USB"]),
  ], verified("https://www.tp-link.com/us/business-networking/omada-switch-access/sg3452/v1.20/")),
  ...many("Arista", ["7010 family", "7020 family", "7050 family", "7060 family", "7260 family", "7280 family", "7300 family", "7500 family", "7800 family"], "Switch", 2, "#21363f", [u(48, "SFP28_25G", 25000, "SFP28"), u(8, "QSFP_DD_400G", 400000, "QSFP-DD"), mgmt(), con()]),

  ...many("Juniper", ["EX2300 family", "EX3400 family", "EX4100 family", "EX4300 family", "EX4400 family", "EX4600 family", "EX9200 family"], "Switch", 1, "#243b31", [r(48, 1000, true), u(8, "SFP28_25G", 25000, "SFP28"), mgmt(), con("USB_C_CONSOLE"), stack(2, "VC")]),
  ...["SRX300", "SRX320"].map((model) => profile("Juniper", model, "Firewall", 1, "#243b31", [
    g("access", 6, "RJ45_1G", 1000, "", false, labels(0, 6).map((label) => `0/${label}`)),
    g("uplink", 2, "SFP_1G", 1000, "SFP", false, ["0/6", "0/7"]),
    g("management", 1, "Console", 0, "CONSOLE", false, ["CONSOLE"]),
    g("management", 1, "USB_MINI_CONSOLE", 0, "CONSOLE", false, ["MINI-USB"]),
  ], verified(`https://www.juniper.net/documentation/us/en/hardware/${model.toLowerCase()}/${model.toLowerCase()}.pdf`))),
  ...["SRX340", "SRX345"].map((model) => profile("Juniper", model, "Firewall", 1, "#243b31", [
    g("access", 8, "RJ45_1G", 1000, "", false, labels(0, 8).map((label) => `0/${label}`)),
    g("uplink", 8, "SFP_1G", 1000, "SFP", false, labels(8, 8).map((label) => `0/${label}`)),
    g("management", 1, "RJ45_1G", 1000, "MGMT", false, ["MGMT"]),
    g("management", 1, "Console", 0, "CONSOLE", false, ["CONSOLE"]),
    g("management", 1, "USB_MINI_CONSOLE", 0, "CONSOLE", false, ["MINI-USB"]),
  ], { ...verified(`https://www.juniper.net/documentation/us/en/hardware/${model.toLowerCase()}/${model.toLowerCase()}.pdf`), inventoryRevision: 1 })),
  profile("Juniper", "SRX380", "Firewall", 1, "#243b31", [
    g("access", 16, "RJ45_1G", 1000, "", true, labels(0, 16).map((label) => `0/${label}`)),
    g("uplink", 4, "SFP_PLUS_10G", 10000, "SFP+", false, labels(16, 4).map((label) => `0/${label}`)),
    g("management", 1, "RJ45_1G", 1000, "MGMT", false, ["MGMT"]),
    g("management", 1, "Console", 0, "CONSOLE", false, ["CONSOLE"]),
    g("management", 1, "USB_MINI_CONSOLE", 0, "CONSOLE", false, ["MINI-USB"]),
  ], verified("https://www.juniper.net/documentation/us/en/hardware/srx380/topics/topic-map/srx380-chassis.html")),
  profile("Juniper", "SRX1500", "Firewall", 1, "#243b31", [
    g("access", 12, "RJ45_1G", 1000, "", false, labels(0, 12).map((label) => `0/${label}`)),
    g("uplink", 4, "SFP_1G", 1000, "SFP", false, labels(12, 4).map((label) => `0/${label}`)),
    g("uplink", 4, "SFP_PLUS_10G", 10000, "SFP+", false, labels(16, 4).map((label) => `0/${label}`)),
    g("management", 1, "SFP_1G", 1000, "HA", false, ["HA"]),
    g("management", 1, "RJ45_1G", 1000, "MGMT", false, ["MGMT"]),
    g("management", 1, "Console", 0, "CONSOLE", false, ["CONSOLE"]),
    g("management", 1, "USB_MINI_CONSOLE", 0, "CONSOLE", false, ["MINI-USB"]),
  ], verified("https://www.juniper.net/documentation/us/en/hardware/srx1500/topics/topic-map/srx1500-chassis.html")),
  ...["SRX4100", "SRX4200"].map((model) => profile("Juniper", model, "Firewall", 1, "#243b31", [
    g("uplink", 2, "SFP_PLUS_10G", 10000, "HA", false, ["CTL", "FAB"]),
    g("uplink", 8, "SFP_PLUS_10G", 10000, "SFP+", false, labels(0, 8)),
    g("management", 1, "RJ45_1G", 1000, "MGMT", false, ["MGMT"]),
    g("management", 1, "Console", 0, "CONSOLE", false, ["CONSOLE"]),
  ], verified(`https://www.juniper.net/documentation/us/en/hardware/${model.toLowerCase()}/topics/topic-map/${model.toLowerCase()}-chassis.html`))),
  profile("Juniper", "SRX4600", "Firewall", 1, "#243b31", [
    g("uplink", 4, "SFP_PLUS_10G", 10000, "HA", false, ["CTL0", "CTL1", "FAB0", "FAB1"]),
    g("uplink", 4, "QSFP28_100G", 100000, "QSFP28", false, labels(0, 4)),
    g("uplink", 8, "SFP_PLUS_10G", 10000, "SFP+", false, labels(0, 8)),
    g("management", 1, "RJ45_1G", 1000, "MGMT", false, ["MGMT"]),
    g("management", 1, "Console", 0, "CONSOLE", false, ["CON"]),
    g("management", 2, "RJ45_1G", 0, "TIMING", false, ["ToD", "BITS"]),
  ], verified("https://www.juniper.net/documentation/us/en/hardware/srx4600/topics/concept/services-gateway-srx4600-chassis-specs.html")),
  ...[["SRX5400", 5], ["SRX5600", 8], ["SRX5800", 16]].map(([model, units]) => profile("Juniper", model, "Firewall", units, "#243b31", [
    g("management", 2, "RJ45_1G", 1000, "MGMT", false, ["MGMT0", "MGMT1"]),
    g("management", 1, "Console", 0, "CONSOLE", false, ["CONSOLE"]),
  ], {
    fidelity: "modular",
    source: `https://www.juniper.net/documentation/us/en/hardware/${model.toLowerCase()}/${model.toLowerCase()}.pdf`,
    note: "Modular SRX chassis with no line cards selected; fixed management connectors are shown.",
  })),
  ...many("Juniper", ["QFX5100 family", "QFX5110 family", "QFX5120 family", "QFX5130 family", "QFX5200 family", "QFX5210 family", "QFX5220 family", "QFX10000 family"], "Switch", 2, "#243b31", [u(48, "SFP28_25G", 25000, "SFP28"), u(8, "QSFP_DD_400G", 400000, "QSFP-DD"), mgmt(), con()]),

  ...many("Ubiquiti", ["EdgeSwitch legacy family", "EdgeRouter legacy family", "EdgeMAX legacy family"], "Router", 1, "#879296", [r(16), u(2), mgmt()]),
  ...many("Ubiquiti", ["UDM-Pro-Max"], "Firewall", 1, "#879296", [r(8),
    g("uplink", 2, "SFP_PLUS_10G", 10000, "SFP+", false, ["10", "11"]),
    g("management", 1, "RJ45_MGIG", 2500, "WAN", false, ["9"])]),
  ...many("Ubiquiti", ["USW-Enterprise-48-PoE"], "Switch", 1, "#879296", [r(48, 2500, true), u(4)]),
  ...many("Ubiquiti", ["USW-Pro-Max-48-PoE"], "Switch", 1, "#879296", [r(32, 1000, true), r(16, 2500, true), u(4)]),
  profile("MikroTik", "CCR1009", "Router", 1, "#e1e4e1", [
    r(7), g("access", 1, "RJ45_1G", 1000, "COMBO-RJ45"),
    u(1, "SFP_1G", 1000, "COMBO-SFP"), u(1, "SFP_PLUS_10G", 10000, "SFP+"), con(),
  ], { fidelity: "exact", source: "https://mikrotik.com/product/CCR1009-7G-1C-1Splus",
    note: "Selected CCR1009-7G-1C-1S+ rack chassis with DB9 console, dual AC inputs and two fans. Copper/SFP combo sockets share one interface; ETH7 accepts PoE input." }),
  profile("MikroTik", "CCR1016", "Router", 1, "#e1e4e1", [r(12), con()],
    { fidelity: "exact", source: "https://cdn.mikrotik.com/web-assets/product_files/ccr1016-12G_210511.pdf",
      note: "Selected CCR1016-12G r2 with twelve Gigabit ports, RJ45 console, USB-A, dual AC inputs and three rear fans." }),
  profile("MikroTik", "CCR1036", "Router", 1, "#e1e4e1", [r(12), u(4, "SFP_1G", 1000, "SFP"), con()],
    { fidelity: "exact", source: "https://cdn.mikrotik.com/web-assets/product_files/CCR1036-12G-4S_210526.pdf",
      note: "Selected CCR1036-12G-4S r2 with four SFP and twelve Gigabit ports, RJ45 console, USB-A, dual AC inputs and three rear fans." }),
  profile("MikroTik", "CCR1072", "Router", 1, "#e1e4e1", [mgmt(), u(8), con()],
    { fidelity: "exact", source: "https://mikrotik.com/product/CCR1072-1G-8Splus",
      note: "Selected CCR1072-1G-8S+ chassis with eight 10G cages, Gigabit Ethernet and RJ45 console, front LCD and two removable AC supplies." }),
  profile("MikroTik", "CCR2004", "Router", 1, "#e1e4e1", [mgmt(), u(12), u(2, "SFP28_25G", 25000, "SFP28"), con()],
    { fidelity: "exact", source: "https://mikrotik.com/product/ccr2004_1g_12s_2xs",
      note: "Selected CCR2004-1G-12S+2XS chassis with twelve 10G SFP+, two 25G SFP28, Gigabit management and RJ45 console; two fixed AC inputs and external rear heatsink." }),
  profile("MikroTik", "CCR2116", "Router", 1, "#e1e4e1", [r(12), mgmt(), u(4), con()],
    { fidelity: "exact", source: "https://mikrotik.com/product/ccr2116_12g_4splus",
      note: "Selected CCR2116-12G-4S+ chassis with twelve switched Gigabit ports, separate Gigabit management, four 10G SFP+ and RJ45 console; dual AC inputs and four rear fans." }),
  profile("MikroTik", "CCR2216", "Router", 1, "#e1e4e1", [mgmt(), u(12, "SFP28_25G", 25000, "SFP28"), u(2, "QSFP28_100G", 100000, "QSFP28"), con()],
    { fidelity: "exact", source: "https://manual.mikrotik.com/hardware/ccr2216-1g-12xs-2xq/",
      note: "Selected CCR2216-1G-12XS-2XQ chassis with twelve 25G SFP28, two 100G QSFP28, Gigabit Ethernet and RJ45 console; both AC supplies and all four fan trays installed." }),
  profile("MikroTik", "CRS305", "Switch", 1, "#e1e4e1", [mgmt(), u(4)],
    { fidelity: "exact", source: "https://mikrotik.com/product/crs305_1g_4s_in",
      note: "Selected CRS305-1G-4S+IN chassis with four 10G cages and Gigabit Ethernet, two DC jacks and passive cooling. Ethernet accepts PoE input without PoE output." }),
  profile("MikroTik", "CRS309", "Switch", 1, "#e1e4e1", [mgmt(), u(8), con()],
    { fidelity: "exact", inventoryRevision: 1, source: "https://mikrotik.com/product/crs309_1g_8s_in",
      note: "Selected CRS309-1G-8S+IN chassis with eight 10G cages, Gigabit Ethernet and DB9 serial console. Revision 1 appends the omitted console; old indices remain unchanged." }),
  profile("MikroTik", "CRS310", "Switch", 1, "#e1e4e1", [mgmt(), u(5, "SFP_1G", 1000, "SFP"), u(4), con()],
    { fidelity: "exact", inventoryRevision: 1, source: "https://mikrotik.com/product/crs310_1g_5s_4s_in",
      note: "Selected CRS310-1G-5S-4S+IN desktop chassis; revision1 appends its omitted RJ45 console at index11 without moving old endpoints." }),
  profile("MikroTik", "CRS312", "Switch", 1, "#e1e4e1", [
    t(8), t(4, "COMBO-RJ45"), u(4, "SFP_PLUS_10G", 10000, "COMBO-SFP"), con(), g("management", 1, "RJ45_1G", 100, "MGMT"),
  ], { fidelity: "exact", inventoryRevision: 1, source: "https://cdn.mikrotik.com/web-assets/product_files/CRS312-4C8XG-RM_220517.pdf",
    note: "Selected CRS312-4C+8XG-RM with eight dedicated copper and four copper/SFP+ combo interfaces, dual AC inputs and four fans. Revision1 appends omitted100Mbps management at index18 without moving old connectors." }),
  profile("MikroTik", "CRS317", "Switch", 1, "#e1e4e1", [mgmt(), u(16), con()],
    { fidelity: "exact", source: "https://mikrotik.com/product/crs317_1g_16s_rm",
      note: "Selected CRS317-1G-16S+RM chassis with sixteen 10G cages, Gigabit management, RJ45 console and two AC inputs; reuses its full SKU's verified panels." }),
  profile("MikroTik", "CRS326", "Switch", 1, "#e1e4e1", [r(24), u(2), con()],
    { fidelity: "exact", source: "https://mikrotik.com/product/crs326_24g_2s_in",
      note: "Selected CRS326-24G-2S+IN desktop chassis with passive cooling and rear DC input; distinct from the RM rack enclosure." }),
  profile("MikroTik", "CRS328", "Switch", 1, "#e1e4e1", [r(24, 1000, true), u(4), con()],
    { fidelity: "exact", source: "https://mikrotik.com/product/crs328_24p_4s_rm",
      note: "Selected CRS328-24P-4S+RM; manufacturer front/specifications and original 2020 ServeTheHome review rear establish the pictured single-AC-input configuration." }),
  profile("MikroTik", "CRS354", "Switch", 1, "#e1e4e1", [r(48), u(4), u(2, "QSFP_PLUS_40G", 40000, "QSFP+"), g("management", 1, "RJ45_1G", 100, "MGMT"), con()],
    { fidelity: "exact", source: "https://mikrotik.com/product/crs354_48g_4splus2qplusrm",
      note: "Selected CRS354-48G-4S+2Q+RM chassis with 48 Gigabit copper ports, four 10G and two 40G cages, 100 Mbps management and RJ45 console; saved settings remain unchanged." }),
  profile("MikroTik", "CRS504", "Switch", 1, "#e1e4e1", [g("management", 1, "RJ45_1G", 100, "MGMT"), u(4, "QSFP28_100G", 100000, "QSFP28"), con()],
    { fidelity: "exact", source: "https://mikrotik.com/product/crs504_4xq_in",
      note: "Selected CRS504-4XQ-IN with two front AC modules, four100G cages, 100Mbps management and console; existing saved link speeds are retained." }),
  profile("MikroTik", "CRS518", "Switch", 1, "#e1e4e1", [g("management", 1, "RJ45_1G", 100, "MGMT"), u(16, "SFP28_25G", 25000, "SFP28"), u(2, "QSFP28_100G", 100000, "QSFP28"), con()],
    { fidelity: "exact", source: "https://mikrotik.com/product/crs518_16xs_2xq",
      note: "Selected CRS518-16XS-2XQ-RM chassis with sixteen 25G cages, two 100G cages, 100 Mbps management and RJ45 console; saved settings remain unchanged." }),

  profile("Palo Alto", "PA-220", "Firewall", 1, "#304047", [
    g("access", 8, "RJ45_1G", 1000, "ETH", false, labels(1, 8).map((label) => `ethernet1/${label}`)),
    g("management", 1, "RJ45_1G", 1000, "MGT", false, ["MGT"]),
    g("management", 1, "Console", 0, "CONSOLE", false, ["CONSOLE"]),
    g("management", 1, "USB_MICRO_CONSOLE", 0, "CONSOLE", false, ["MICRO-USB"]),
  ], verified("https://docs.paloaltonetworks.com/hardware/pa-220-hardware-reference/pa-220-firewall-overview/pa-220-front-panel")),
  ...["PA-440", "PA-450", "PA-460"].map((model) => profile("Palo Alto", model, "Firewall", 1, "#304047", [
    g("access", 8, "RJ45_1G", 1000, "ETH", false, labels(1, 8).map((label) => `ethernet1/${label}`)),
    g("management", 1, "RJ45_1G", 1000, "MGT", false, ["MGT"]),
    g("management", 1, "USB_MICRO_CONSOLE", 0, "CONSOLE", false, ["MICRO-USB"]),
  ], verified("https://docs.paloaltonetworks.com/hardware/pa-400-hardware-reference/pa-400-firewall-overview/pa-400-front-panel"))),
  profile("Palo Alto", "PA-850", "Firewall", 1, "#304047", [
    g("access", 4, "RJ45_1G", 1000, "ETH", false, labels(1, 4).map((label) => `ethernet1/${label}`)),
    g("uplink", 4, "SFP_1G", 1000, "SFP", false, labels(5, 4).map((label) => `ethernet1/${label}`)),
    g("uplink", 4, "SFP_PLUS_10G", 10000, "SFP+", false, labels(9, 4).map((label) => `ethernet1/${label}`)),
    g("management", 2, "RJ45_1G", 1000, "HA", false, ["HA1", "HA2"]),
    g("management", 1, "RJ45_1G", 1000, "MGT", false, ["MGT"]),
    g("management", 1, "Console", 0, "CONSOLE", false, ["CONSOLE"]),
    g("management", 1, "USB_MICRO_CONSOLE", 0, "CONSOLE", false, ["MICRO-USB"]),
  ], verified("https://docs.paloaltonetworks.com/hardware/pa-800-hardware-reference/pa-800-firewall-overview/pa-800-front-panel")),
  profile("Palo Alto", "PA-1400 family", "Firewall", 1, "#304047", [r(8), r(4, 5000, true),
    u(6, "SFP_1G", 1000, "SFP"), u(4), g("management", 1, "SFP_PLUS_10G", 10000, "HSCI", false, ["HSCI"]),
    g("management", 3, "RJ45_1G", 1000, "MGMT", false, ["HA1-A", "HA1-B", "MGT"]),
    con(), { ...con("USB_MICRO_CONSOLE", "MICRO-USB"), labels: ["MICRO-USB"] }], {
    ...verified("https://docs.paloaltonetworks.com/hardware/pa-1400-hardware-reference/pa-1400-series-overview/front-panel-1400-series"),
    inventoryRevision: 1, note: "Selected PA-1410, 1U with two AC supplies: 22 data sockets, HSCI, HA1-A/B, MGT and RJ45/micro-USB consoles. Older ambiguous and surplus inventory remains preserved without invented sockets.",
  }),
  ...many("Palo Alto", ["PA-3400 family", "PA-5200 family", "PA-5400 family", "PA-7000 family"], "Firewall", 2, "#304047", [r(16), u(8, "SFP28_25G", 25000, "SFP28"), mgmt(2), con()]),
  profile("Sophos", "XGS 87", "Firewall", 1, "#21466a", [
    g("access", 4, "RJ45_1G", 1000, "", false, labels(1, 4)),
    g("uplink", 1, "SFP_1G", 1000, "SFP", false, ["F1"]),
    g("management", 1, "Console", 0, "COM", false, ["COM"]),
    g("management", 1, "USB_MICRO_CONSOLE", 0, "COM", false, ["MICRO-USB"]),
  ], verified("https://docs.sophos.com/nsg/hardware/operatinginstructions/xgs/sophos-operating-instructions-xgs-87-87w-107-107w.pdf")),
  profile("Sophos", "XGS 107", "Firewall", 1, "#21466a", [
    g("access", 8, "RJ45_1G", 1000, "", false, labels(1, 8)),
    g("uplink", 1, "SFP_1G", 1000, "SFP", false, ["F1"]),
    g("management", 1, "Console", 0, "COM", false, ["COM"]),
    g("management", 1, "USB_MICRO_CONSOLE", 0, "COM", false, ["MICRO-USB"]),
  ], verified("https://docs.sophos.com/nsg/hardware/operatinginstructions/xgs/sophos-operating-instructions-xgs-87-87w-107-107w.pdf")),
  profile("Sophos", "XGS 116", "Firewall", 1, "#21466a", [
    g("access", 7, "RJ45_1G", 1000, "", false, labels(1, 7)),
    g("access", 1, "RJ45_1G", 1000, "", true, ["8"]),
    g("uplink", 1, "SFP_1G", 1000, "SFP", false, ["F1"]),
    g("management", 1, "Console", 0, "COM", false, ["COM"]),
    g("management", 1, "USB_MICRO_CONSOLE", 0, "COM", false, ["MICRO-USB"]),
  ], verified("https://docs.sophos.com/nsg/hardware/operatinginstructions/xgs/sophos-operating-instructions-xgs-116-116w-126-126w-136-136w.pdf")),
  profile("Sophos", "XGS 126", "Firewall", 1, "#21466a", [
    g("access", 10, "RJ45_1G", 1000, "", false, labels(1, 10)),
    g("access", 2, "RJ45_1G", 1000, "", true, labels(11, 2)),
    g("uplink", 2, "SFP_1G", 1000, "SFP", false, ["F1", "F2"]),
    g("management", 1, "Console", 0, "COM", false, ["COM"]),
    g("management", 1, "USB_MICRO_CONSOLE", 0, "COM", false, ["MICRO-USB"]),
  ], verified("https://docs.sophos.com/nsg/hardware/operatinginstructions/xgs/sophos-operating-instructions-xgs-116-116w-126-126w-136-136w.pdf")),
  profile("Sophos", "XGS 136", "Firewall", 1, "#21466a", [
    g("access", 10, "RJ45_1G", 1000, "", false, labels(1, 10)),
    g("access", 2, "RJ45_MGIG", 2500, "", true, labels(11, 2)),
    g("uplink", 2, "SFP_1G", 1000, "SFP", false, ["F1", "F2"]),
    g("management", 1, "Console", 0, "COM", false, ["COM"]),
    g("management", 1, "USB_MICRO_CONSOLE", 0, "COM", false, ["MICRO-USB"]),
  ], verified("https://docs.sophos.com/nsg/hardware/operatinginstructions/xgs/sophos-operating-instructions-xgs-116-116w-126-126w-136-136w.pdf")),
  ...["XGS 2100", "XGS 2300"].map((model) => profile("Sophos", model, "Firewall", 1, "#21466a", [
    g("access", 8, "RJ45_1G", 1000, "", false, labels(1, 8)),
    g("uplink", 2, "SFP_1G", 1000, "SFP", false, ["F1", "F2"]),
    g("management", 1, "RJ45_1G", 1000, "MGMT", false, ["MGMT"]),
    g("management", 1, "Console", 0, "COM", false, ["COM"]),
    g("management", 1, "USB_MICRO_CONSOLE", 0, "COM", false, ["MICRO-USB"]),
  ], verified("https://docs.sophos.com/nsg/hardware/operatinginstructions/xgs/sophos-operating-instructions-xgs-2100-2300-3100-3300.pdf"))),
  ...["XGS 3100", "XGS 3300"].map((model) => profile("Sophos", model, "Firewall", 1, "#21466a", [
    g("access", 8, "RJ45_1G", 1000, "", false, labels(1, 8)),
    g("uplink", 2, "SFP_PLUS_10G", 10000, "SFP+", false, ["F1", "F2"]),
    g("uplink", 2, "SFP_1G", 1000, "SFP", false, ["F3", "F4"]),
    g("management", 1, "RJ45_1G", 1000, "MGMT", false, ["MGMT"]),
    g("management", 1, "Console", 0, "COM", false, ["COM"]),
    g("management", 1, "USB_MICRO_CONSOLE", 0, "COM", false, ["MICRO-USB"]),
  ], verified("https://docs.sophos.com/nsg/hardware/operatinginstructions/xgs/sophos-operating-instructions-xgs-2100-2300-3100-3300.pdf"))),
  ...["XGS 4300", "XGS 4500"].map((model) => profile("Sophos", model, "Firewall", 1, "#21466a", [
    g("access", 4, "RJ45_1G", 1000, "", false, labels(1, 4)),
    g("access", 4, "RJ45_MGIG", 2500, "", false, labels(5, 4)),
    g("uplink", 4, "SFP_PLUS_10G", 10000, "SFP+", false, ["F1", "F2", "F3", "F4"]),
    g("management", 1, "RJ45_1G", 1000, "MGMT", false, ["MGMT"]),
    g("management", 1, "Console", 0, "COM", false, ["COM"]),
    g("management", 1, "USB_MICRO_CONSOLE", 0, "COM", false, ["MICRO-USB"]),
  ], verified("https://docs.sophos.com/nsg/hardware/operatinginstructions/xgs/sophos-operating-instructions-xgs-4300-4500.pdf"))),
  profile("Check Point", "Quantum 1500", "Firewall", 1, "#442839", [
    g("access", 8, "RJ45_1G", 1000, "LAN", false, labels(1, 8)),
    g("access", 1, "RJ45_1G", 1000, "WAN", false, ["WAN"]),
    g("access", 1, "RJ45_1G", 1000, "DMZ", false, ["DMZ"]),
    g("uplink", 1, "SFP_1G", 1000, "DMZ", false, ["DMZ-SFP"]),
    g("management", 1, "USB_C_CONSOLE", 0, "CONSOLE", false, ["CONSOLE"]),
  ], { ...verified("https://sc1.checkpoint.com/documents/Appliances/GSG_V1/EN/Content/Topics-V1/Back-Panel.htm"),
    preserveInstalledPorts: true,
    note: "Selected Quantum Spark 1590 Wired (V-81), external 12V supply: all twelve original LAN, WAN, DMZ copper/SFP and USB-C console endpoints are on the rear; no wireless or DSL hardware." }),
  profile("Check Point", "Quantum 1600", "Firewall", 1, "#442839", [
    g("access", 16, "RJ45_1G", 1000, "LAN", false, labels(1, 16).map((label) => `LAN${label}`)),
    g("access", 1, "RJ45_1G", 1000, "WAN", false, ["WAN"]),
    g("uplink", 1, "SFP_1G", 1000, "WAN", false, ["WAN-SFP"]),
    g("access", 1, "RJ45_1G", 1000, "DMZ", false, ["DMZ"]),
    g("uplink", 1, "SFP_1G", 1000, "DMZ", false, ["DMZ-SFP"]),
    g("management", 1, "Console", 0, "CONSOLE", false, ["CONSOLE"]),
    g("management", 1, "USB_C_CONSOLE", 0, "CONSOLE", false, ["USB-C"]),
  ], verified("https://www.checkpoint.com/downloads/products/1600-1800-security-gateway-datasheet.pdf")),
  profile("Check Point", "Quantum 1800", "Firewall", 1, "#442839", [
    g("access", 2, "RJ45_MGIG", 2500, "LAN", false, ["LAN1", "LAN2"]),
    g("access", 16, "RJ45_1G", 1000, "LAN", false, labels(3, 16).map((label) => `LAN${label}`)),
    g("access", 2, "RJ45_1G", 1000, "WAN", false, ["WAN1", "WAN2"]),
    g("uplink", 2, "SFP_1G", 1000, "WAN", false, ["WAN1-SFP", "WAN2-SFP"]),
    g("access", 1, "RJ45_10G", 10000, "DMZ", false, ["DMZ"]),
    g("uplink", 1, "SFP_PLUS_10G", 10000, "DMZ", false, ["DMZ-SFP+"]),
    g("management", 1, "RJ45_1G", 1000, "MGMT", false, ["MGMT"]),
    g("management", 1, "Console", 0, "CONSOLE", false, ["CONSOLE"]),
    g("management", 1, "USB_C_CONSOLE", 0, "CONSOLE", false, ["USB-C"]),
  ], { ...verified("https://www.checkpoint.com/downloads/products/1600-1800-security-gateway-datasheet.pdf"), inventoryRevision: 1 }),
  ...["Quantum 3600", "Quantum 3800"].map((model) => profile("Check Point", model, "Firewall", 1, "#442839", [
    g("access", 5, "RJ45_1G", 1000, "", false, labels(1, 5)),
    g("management", 1, "RJ45_1G", 1000, "MGMT", false, ["MGMT"]),
    g("management", 1, "Console", 0, "CONSOLE", false, ["CONSOLE"]),
    g("management", 1, "USB_C_CONSOLE", 0, "CONSOLE", false, ["USB-C"]),
  ], verified(`https://www.checkpoint.com/downloads/products/${model.slice(-4)}-security-gateway-datasheet.pdf`))),
  ...["Quantum 6200", "Quantum 6400", "Quantum 6600", "Quantum 6700", "Quantum 6900", "Quantum 7000"].map((model) => profile("Check Point", model, "Firewall", 1, "#442839", [
    g("access", 8, "RJ45_1G", 1000, "", false, labels(1, 8)),
    g("management", 1, "RJ45_1G", 1000, "MGMT", false, ["MGMT"]),
    g("management", 1, "RJ45_1G", 1000, "SYNC", false, ["SYNC"]),
    g("management", 1, "Console", 0, "CONSOLE", false, ["CONSOLE"]),
    g("management", 1, "USB_C_CONSOLE", 0, "CONSOLE", false, ["USB-C"]),
    g("management", 1, "RJ45_1G", 1000, "LOM", false, ["LOM"]),
  ], { ...verified(`https://www.checkpoint.com/downloads/products/${model.slice(-4)}-security-gateway-datasheet.pdf`), inventoryRevision: 1 })),
  ...["Quantum 16000", "Quantum 26000"].map((model) => profile("Check Point", model, "Firewall", model === "Quantum 16000" ? 2 : 3, "#442839", [
    g("access", 8, "RJ45_1G", 1000, "", false, labels(1, 8)),
    g("management", 1, "RJ45_1G", 1000, "MGMT", false, ["MGMT"]),
    g("management", 1, "RJ45_1G", 1000, "SYNC", false, ["SYNC"]),
    g("management", 1, "Console", 0, "CONSOLE", false, ["CONSOLE"]),
    g("management", 1, "USB_C_CONSOLE", 0, "CONSOLE", false, ["USB-C"]),
    g("management", 1, "RJ45_1G", 1000, "LOM", false, ["LOM"]),
  ], { ...verified(`https://www.checkpoint.com/downloads/products/${model.slice(-5)}-security-gateway-datasheet.pdf`), inventoryRevision: 1 })),
  profile("Check Point", "Quantum 28000", "Firewall", 3, "#442839", [
    g("uplink", 4, "SFP_PLUS_10G", 10000, "SFP+", false, labels(1, 4)),
    g("management", 1, "RJ45_1G", 1000, "MGMT", false, ["MGMT"]),
    g("management", 1, "RJ45_1G", 1000, "SYNC", false, ["SYNC"]),
    g("management", 1, "Console", 0, "CONSOLE", false, ["CONSOLE"]),
    g("management", 1, "USB_C_CONSOLE", 0, "CONSOLE", false, ["USB-C"]),
    g("management", 1, "RJ45_1G", 1000, "LOM", false, ["LOM"]),
  ], { ...verified("https://www.checkpoint.com/downloads/products/28000-security-gateway-datasheet.pdf"), inventoryRevision: 1 }),
  ...many("Extreme", ["X440-G2", "X450-G2", "X460-G2", "X465", "X590", "X690", "X870", "X695"], "Switch", 1, "#392644", [r(48, 2500, true), u(8, "SFP28_25G", 25000, "SFP28"), mgmt(), stack()]),
  ...many("Ruckus", ["ICX 7150 family", "ICX 7250 family", "ICX 7450 family", "ICX 7550 family", "ICX 7650 family", "ICX 7850 family", "ICX 8200 family"], "Switch", 1, "#4b3520", [r(48, 2500, true), u(8, "SFP28_25G", 25000, "SFP28"), mgmt(), stack()]),

  // Facilities, console/OOB, wireless control and storage endpoints.
  ...many("APC", ["Smart-UPS Network family"], "Server", 2, "#31383a", [g("management", 1, "RJ45_1G", 1000, "NMC"), g("management", 1, "Power", 0, "AC")]),
  ...many("CyberPower", ["Smart App UPS family"], "Server", 2, "#31383a", [g("management", 1, "RJ45_1G", 1000, "RMCARD"), g("management", 1, "Power", 0, "AC")]),
  ...many("Eaton", ["Network UPS family"], "Server", 2, "#31383a", [g("management", 1, "RJ45_1G", 1000, "NETWORK"), g("management", 1, "Power", 0, "AC")]),
  ...many("Vertiv", ["Liebert UPS family"], "Server", 2, "#31383a", [g("management", 1, "RJ45_1G", 1000, "UNITY"), g("management", 1, "Power", 0, "AC")]),
  profile("Generic Facility", "Rack PDU 16 outlet", "PatchPanel", 1, "#252b2d", [g("access", 16, "Power", 0, "OUTLET"), mgmt()]),
  profile("Generic KVM", "KVM-over-IP 16 port", "Switch", 1, "#252b2d", [g("access", 16, "Console", 0, "KVM"), mgmt()]),
  profile("Opengear", "Console Manager family", "Switch", 1, "#2f383b", [g("access", 48, "Console", 0, "SERIAL"), mgmt(2), con()], {
    ...verified("https://ftp.opengear.com/download/documentation/quickstart/current/cm8100/QuickStartGuide-CM8100.pdf"), inventoryRevision: 1, preserveInstalledPorts: true,
    note: "Selected CM8148 with 48 front serial ports, dual front 1Gb Ethernet, front local console, two USB hosts and dual rear AC; passive cooling, no 10G or cellular options." }),
  profile("Lantronix", "SLC Console Manager family", "Switch", 1, "#2f383b", [g("access", 48, "Console", 0, "SERIAL"), mgmt(2), con()], {
    ...verified("https://www.lantronix.com/wp-content/uploads/pdf/SLC8000_PB-CoBranded.pdf"), inventoryRevision: 1, preserveInstalledPorts: true,
    note: "Selected SLC8000 SLC80481201S: 48 rear RJ45 serial ports, dual rear copper Ethernet, one front local console and single AC supply; no fiber networking or internal modem." }),
  profile("Raritan", "Dominion Serial family", "Switch", 1, "#2f383b", [
    g("access", 48, "Console", 0, "", false, labels(1, 48)),
    g("management", 2, "RJ45_1G", 1000, "", false, ["LAN1", "LAN2"]),
    g("management", 1, "Console", 0, "", false, ["TERMINAL"]),
    g("management", 1, "USB_MINI_CONSOLE", 0, "", false, ["ADMIN"]),
    g("management", 1, "POTS_RJ11", 0, "", false, ["MODEM"]),
  ], { ...verified("https://www.raritan.com/assets/ram/resources/visio_stencils/raritan-dsx2-n.vss"),
    inventoryRevision: 1, preserveInstalledPorts: true,
    note: "Explicit DSX2-48M with dual 100–240 VAC supplies and internal POTS modem; 48 serial, two Gigabit LAN, local RJ45 and mini-B console. Four USB-A hosts and DVI-D are ancillary artwork. Saved inventories retain their original 50 endpoints and settings." }),
  profile("Cisco", "Catalyst 9800-L WLC", "Router", 1, "#263b4b", [r(4), u(2), mgmt(), con("USB_C_CONSOLE")]),
  profile("HPE Aruba", "Mobility Controller family", "Router", 1, "#27383a", [r(8), u(4), mgmt(), con("USB_C_CONSOLE")]),
  profile("Fortinet", "FortiWLC family", "Router", 1, "#dfe2df", [r(8), u(4), mgmt(), con()]),
  ...many("Synology", ["RackStation family"], "Server", 2, "#343b3d", [t(4, "LAN"), mgmt()]),
  ...many("QNAP", ["Rackmount NAS family"], "Server", 2, "#343b3d", [t(4, "LAN"), mgmt()]),
  ...many("NetApp", ["FAS family"], "Server", 4, "#343b3d", [u(8, "SFP28_25G", 25000, "DATA"), mgmt(2)]),
  ...many("Dell", ["PowerStore family", "PowerVault family"], "Server", 2, "#343b3d", [u(8, "SFP28_25G", 25000, "DATA"), mgmt(2)]),

  // Passive optical and copper panels. Each connector is independently cableable.
  ...["FIBER_LC", "FIBER_SC", "FIBER_MPO"].flatMap((type) => [12, 24, 48, 96].map((count) =>
    profile("Generic Patch", `${type.replace("FIBER_", "")} fiber panel ${count}`, "PatchPanel", count > 48 ? 2 : 1, "#343b3d", [g("access", count, type, 0, type.replace("FIBER_", ""))], { fidelity: "generic", note: "Configurable passive fiber panel." }))),
  ...["Cat5e", "Cat6", "Cat6a"].flatMap((category) => [24, 48].map((count) =>
    profile("Generic Patch", `${category} copper panel ${count}`, "PatchPanel", 1, "#343b3d", [g("access", count, category === "Cat6a" ? "RJ45_10G" : "RJ45_1G", category === "Cat6a" ? 10000 : 1000, "")], { fidelity: "generic", note: "Standard passive copper patch panel." }))),

  // Connector reference plates make all advanced faceplate primitives installable.
  profile("Generic Lab", "CFP optical reference panel", "PatchPanel", 1, "#343b3d", [u(4, "CFP_100G", 100000, "CFP"), u(4, "CFP2_100G", 100000, "CFP2"), u(4, "CFP4_100G", 100000, "CFP4")]),
  profile("Generic Lab", "OSFP 800G reference panel", "PatchPanel", 1, "#343b3d", [u(8, "OSFP_800G", 800000, "OSFP")]),
];

export const expandedCatalogProfiles = Object.freeze(profiles);
