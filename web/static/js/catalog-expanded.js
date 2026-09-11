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
  ...many("Cisco", ["Catalyst 9200 family", "Catalyst 9300 family"], "Switch", 1, "#263b4b", [r(48, 1000, true), u(4), con(), { ...con("USB_MINI_CONSOLE", "USB CONSOLE"), labels: ["USB CONSOLE"] }, mgmt()], { inventoryRevision: 1, preserveInstalledPorts: true, note: "Selected C9200L-48P-4X / C9300L-48P-4X respectively; fixed uplinks, one default AC supply, spare PSU and optional StackWise adapter bays covered." }),
  profile("Cisco", "Catalyst 9400 family", "Switch", 6, "#263b4b", [u(48), u(4, "SFP28_25G", 25000, "SFP28"), u(4, "QSFP28_100G", 100000, "QSFP28"), mgmt(), con(), { ...con("USB_MINI_CONSOLE", "USB CONSOLE"), labels: ["USB CONSOLE"] }],
    { inventoryRevision: 1, preserveInstalledPorts: true, note: "Selected C9404R with C9400-LC-48XS slot1, C9400X-SUP-2 slot2, two C9400-PWR-3200AC and C9404-FAN; other slots covered." }),
  profile("Cisco", "Catalyst 9600 family", "Switch", 8, "#263b4b", [u(48, "SFP28_25G", 25000, "SFP28"), mgmt(), g("management", 1, "SFP_PLUS_10G", 10000, "SFP MGMT", false, ["SFP MGMT"]), con(), { ...con("USB_MINI_CONSOLE", "USB CONSOLE"), labels: ["USB CONSOLE"] }],
    { inventoryRevision: 1, preserveInstalledPorts: true, note: "Selected C9606R with C9600-LC-48YL slot1, C9600-SUP-1 slot3, two C9600-PWR-2KWAC and C9606-FAN; other slots covered." }),
  profile("Cisco", "Catalyst 9500 family", "Switch", 1, "#263b4b", [u(48, "SFP28_25G", 25000, "SFP28"), u(4, "QSFP28_100G", 100000, "QSFP28"), con(), { ...con("USB_MINI_CONSOLE", "USB CONSOLE"), labels: ["USB CONSOLE"] }, mgmt()], { inventoryRevision: 1, preserveInstalledPorts: true, note: "Selected C9500-48Y4C, one C9K-PWR-650WAC-R in PSU0, PSU1 and optional SATA SSD covered; two C9K-T1-FANTRAY units." }),
  profile("Cisco", "Nexus 3000 family", "Switch", 1, "#263b4b", [u(48), u(4, "QSFP_PLUS_40G", 40000, "QSFP+"), { ...mgmt(2), labels: ["MGMT0", "MGMT1"] }, con()], { inventoryRevision: 1, preserveInstalledPorts: true, note: "Selected N3K-C3064PQ-10GX, two N2200-PAC-400W and one N3K-C3064-FAN; port-side exhaust. 48 SFP+, four QSFP+, two management and RJ45 console; no breakout endpoints." }),
  profile("Cisco", "Nexus 5000 family", "Switch", 1, "#263b4b", [u(32), { ...mgmt(), labels: ["MGMT0"] }, con()], { inventoryRevision: 1, preserveInstalledPorts: true, note: "Selected N5K-C5548UP-FA, two N55-PAC-750W and two N5548P-FAN modules; port-side exhaust, GEM bay covered. 32 unified cages in 10G Ethernet mode. Disabled L1/L2 sockets remain decorative." }),
  profile("Cisco", "Nexus 7000 family", "Switch", 14, "#263b4b", [u(48, "SFP_PLUS_10G", 10000, "SFP+"), {...mgmt(), labels:["MGMT"]}, con()], {inventoryRevision:1, preserveInstalledPorts:true}),
  profile("Cisco", "Nexus 9000 family", "Switch", 1, "#263b4b", [u(48, "SFP28_25G", 25000, "SFP28"), u(6, "QSFP28_100G", 100000, "QSFP"), con(), {...mgmt(), labels:["MGMT"]}], {inventoryRevision:1, preserveInstalledPorts:true}),
  profile("Cisco","Meraki MS120","Switch",1,"#263b4b",[r(48,1000,true),u(4,"SFP_1G",1000,"SFP"),{...mgmt(),labels:["MGMT"]}],{inventoryRevision:1,preserveInstalledPorts:true}),
  profile("Cisco","Meraki MS210","Switch",1,"#263b4b",[r(48,1000,true),u(4,"SFP_1G",1000,"SFP"),{...u(2,"Stack",40000,"STACK"),labels:["STACK 1","STACK 2"]},{...mgmt(),labels:["MGMT"]}],{inventoryRevision:1,preserveInstalledPorts:true}),
  profile("Cisco","Meraki MS225","Switch",1,"#263b4b",[r(48,1000,true),u(4,"SFP_PLUS_10G",10000,"SFP+"),{...u(2,"Stack",40000,"STACK"),labels:["STACK 1","STACK 2"]},{...mgmt(),labels:["MGMT"]}],{inventoryRevision:1,preserveInstalledPorts:true}),
profile("Cisco", "Meraki MS250", "Switch", 1, "#263b4b", [r(48,1000,true),u(4),{...u(2,"Stack",40000,"STACK"),labels:["STACK 1","STACK 2"]},{...mgmt(),labels:["MGMT"]}], {inventoryRevision:1,preserveInstalledPorts:true}),
profile("Cisco", "Meraki MS350", "Switch", 1, "#263b4b", [r(48,1000,true),u(4),{...u(2,"Stack",40000,"STACK"),labels:["STACK 1","STACK 2"]},{...mgmt(),labels:["MGMT"]}], {inventoryRevision:1,preserveInstalledPorts:true}),
profile("Cisco", "Meraki MS390", "Switch", 1, "#263b4b", [r(48,1000,true),{...u(8),labels:["1","2","3","4","5","6","7","8"]},{...u(2,"Stack",120000,"STACK"),labels:["STACK 1","STACK 2"]},{...mgmt(),labels:["MGMT"]}], {inventoryRevision:1,preserveInstalledPorts:true}),
  profile("Cisco", "Meraki MS410", "Switch", 1, "#263b4b", [u(32,"SFP_1G",1000,"SFP"),u(4),{...u(2,"Stack",40000,"STACK"),labels:["STACK 1","STACK 2"]},{...mgmt(),labels:["MGMT"]}], {inventoryRevision:1,preserveInstalledPorts:true}),
  profile("Cisco", "Meraki MS425", "Switch", 1, "#263b4b", [u(32),u(2,"QSFP_PLUS_40G",40000,"QSFP+"),{...mgmt(),labels:["MGMT"]}], {inventoryRevision:1,preserveInstalledPorts:true}),
  profile("Cisco", "Meraki MS450", "Switch", 1, "#263b4b", [u(12,"QSFP_PLUS_40G",40000,"QSFP+"),u(2,"QSFP28_100G",100000,"QSFP28"),{...u(2,"Stack",100000,"STACK"),labels:["STACK 1","STACK 2"]},{...mgmt(),labels:["MGMT"]}], {inventoryRevision:1,preserveInstalledPorts:true}),
  profile("Cisco", "ASA 5506-X", "Firewall", 1, "#263b4b", [r(8), mgmt(), con("USB_MINI_CONSOLE"), con("Console", "RJ45-CONSOLE")], { ...verified("https://www.cisco.com/c/en/us/td/docs/security/asa/hw/maintenance/5506xguide/b_Install_Guide_5506/b_Install_Guide_5506_chapter_01.html"), inventoryRevision: 1 }),
  ...many("Cisco", ["ASA 5508-X", "ASA 5516-X"], "Firewall", 1, "#263b4b", [r(8), mgmt(), con("USB_MINI_CONSOLE"), con("Console", "RJ45-CONSOLE")], { ...verified("https://www.cisco.com/c/en/us/td/docs/security/asa/hw/maintenance/5508xguide/b_install_guide_5508/b_install_guide_5508_chapter_0100.html"), inventoryRevision: 1 }),
  ...many("Cisco", ["ASA 5525-X", "ASA 5545-X", "ASA 5555-X"], "Firewall", 1, "#263b4b", [r(8), mgmt(), con()], { ...verified("https://www.cisco.com/c/en/us/td/docs/security/asa/hw/maintenance/5500xguide/5500xhw/asa_overview.html"), inventoryRevision: 1 }),
  profile("Cisco", "Secure Firewall 1010", "Firewall", 1, "#263b4b", [r(6), g("access", 2, "RJ45_1G", 1000, "", true, ["7", "8"]), mgmt(), con("USB_MINI_CONSOLE"), con("Console", "RJ45-CONSOLE")], { ...verified("https://www.cisco.com/c/en/us/td/docs/security/firepower/1010/hw/guide/hw-install-1010/overview.html"), inventoryRevision: 1 }),
  ...many("Cisco", ["Secure Firewall 1120", "Secure Firewall 1140"], "Firewall", 1, "#263b4b", [r(8), u(4, "SFP_1G", 1000, "SFP"), mgmt(), con("USB_MINI_CONSOLE"), con("Console", "RJ45-CONSOLE")], { ...verified("https://www.cisco.com/c/en/us/td/docs/security/firepower/1100/hw/guide/hw-install-1100/overview.html"), inventoryRevision: 1 }),
  ...many("Cisco", ["Secure Firewall 2110", "Secure Firewall 2120"], "Firewall", 1, "#263b4b", [r(12), u(4, "SFP_1G", 1000, "SFP"), mgmt(), con()], { ...verified("https://www.cisco.com/c/en/us/td/docs/security/firepower/2100/hw/guide/b_install_guide_2100/overview.html"), inventoryRevision: 1 }),
  ...many("Cisco", ["Secure Firewall 2130", "Secure Firewall 2140"], "Firewall", 1, "#263b4b", [r(12), u(4), mgmt(), con()], { ...verified("https://www.cisco.com/c/en/us/td/docs/security/firepower/2100/hw/guide/b_install_guide_2100/overview.html"), inventoryRevision: 1 }),
  ...many("Cisco", ["Secure Firewall 4110", "Secure Firewall 4120", "Secure Firewall 4140", "Secure Firewall 4150"], "Firewall", 1, "#263b4b", [u(8), g("management", 1, "SFP_1G", 1000, "MGMT"), con()], { ...verified("https://www.cisco.com/c/en/us/td/docs/security/firepower/4100/hw/guide/b_install_guide_4100/overview.html"), inventoryRevision: 1 }),
  profile("Cisco", "Secure Firewall 9300", "Firewall", 3, "#263b4b", [
  {...u(8),labels:["1/1","1/2","1/3","1/4","1/5","1/6","1/7","1/8"]},
  {...u(8,"QSFP28_100G",100000,"QSFP28"),labels:["2/1","2/2","2/3","2/4","3/1","3/2","3/3","3/4"]},
  g("management",1,"SFP_1G",1000,"MGMT",false,["MGMT"]),
  {...con(),labels:["CONSOLE"]}
],{inventoryRevision:1,preserveInstalledPorts:true}),
  profile("Cisco", "ISR 1100 family", "Router", 1, "#263b4b", [r(8), g("uplink", 2, "RJ45_1G", 1000, "WAN", false, ["GE0/0/1", "GE0/0/0 CU"]), u(1, "SFP_1G", 1000, "GE0/0/0 SFP"), con(), { ...con("USB_MICRO_CONSOLE", "USB CONSOLE"), labels: ["USB CONSOLE"] }], { inventoryRevision: 1, preserveInstalledPorts: true, note: "Selected C1111X-8P with external PWR-66W-AC-V2; no PoE/LTE/WLAN/DSL options. GE0/0/0 copper/SFP are alternate media." }),
  profile("Cisco", "ISR 4300 family", "Router", 1, "#263b4b", [r(2), u(2, "SFP_1G", 1000, "SFP"), mgmt(), con(), { ...con("Console", "AUX"), labels: ["AUX"] }, { ...con("USB_MINI_CONSOLE", "USB CONSOLE"), labels: ["USB CONSOLE"] }], { inventoryRevision: 1, preserveInstalledPorts: true, note: "Selected ISR4331/K9, PWR-4330-AC, two NIM and one SM-X bay covered; no optional PoE/voice/storage. GE0/0/0 copper and SFP share one interface." }),
  profile("Cisco", "ISR 4400 family", "Router", 1, "#263b4b", [r(4), u(4, "SFP_1G", 1000, "SFP"), mgmt(), con(), { ...con("Console", "AUX"), labels: ["AUX"] }, { ...con("USB_MINI_CONSOLE", "USB CONSOLE"), labels: ["USB CONSOLE"] }], { inventoryRevision: 1, preserveInstalledPorts: true, note: "Selected ISR4431/K9 with two PWR-4430-AC supplies and three NIM covers; no optional PoE/voice/storage. Four copper/SFP WAN pairs share interfaces." }),

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
profile("HPE Aruba", "CX 6400 family", "Switch", 7, "#27383a", [u(48, "SFP28_25G", 25000, "SFP28"), mgmt(), con("USB_C_CONSOLE", "USB CONSOLE"), con()], {
  ...verified("https://arubanetworking.hpe.com/techdocs/hardware/switches/6400/IGSG/Aruba_6400_IGSG.pdf"), inventoryRevision: 1, preserveInstalledPorts: true,
  note: "Selected R0X26A6405 with R0X44A48SFP28 in slot3, R0X31A MM in slot1, two R0X36A3000W supplies/C20 adapters and two R0X32A four-fan trays; other slots covered and PSU bezel installed." }),
profile("HPE Aruba", "CX 8400 family", "Switch", 8, "#27383a", [u(32), u(8, "QSFP_PLUS_40G", 40000, "QSFP+"), mgmt(), con("USB_MICRO_CONSOLE", "USB CONSOLE"), con()], {
  ...verified("https://arubanetworking.hpe.com/techdocs/hardware/switches/8400/IGSG/Aruba%208400_IGSG_en_us.pdf"), inventoryRevision: 1, preserveInstalledPorts: true,
  note: "Selected JL376A8400 bundle: JL363A32SFP+ slot1, JL365A8QSFP+ slot7, JL368A MM slot5, three JL372A2700W supplies, two JL367A fabrics and18fans; unused slots covered, front bezel installed." }),
  profile("HPE Aruba", "CX 10000 family", "Switch", 1, "#27383a", [u(48, "SFP28_25G", 25000, "SFP28"), u(6, "QSFP28_100G", 100000, "QSFP28"), mgmt(), con("USB_C_CONSOLE", "USB CONSOLE"), con()], {
    ...verified("https://arubanetworking.hpe.com/techdocs/hardware/switches/10000/igsg_10000.pdf"), inventoryRevision: 1, preserveInstalledPorts: true,
    note: "Selected R8P13A 1U48Y6C Front-to-Back bundle: front OOB/RJ45 serial, rear USB-C serial, two R8R51A 800W AC supplies and six R8R53A fan trays." }),
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
  profile("HPE", "ProLiant DL580", "Server", 4, "#33393b", [r(4, 1000, false, "NIC"), mgmt(1, "iLO"), con("Console", "SERIAL")], {
    ...verified("https://support.hpe.com/hpesc/public/api/document/a00021850enw"), inventoryRevision: 1, preserveInstalledPorts: true,
    note: "Selected Gen10 869854-B21 4U, upper-left 8SFF SATA cage, 665240-B21 four-port 1Gb FlexibleLOM, dedicated iLO and DB9 serial; sixteen covered PCIe positions and four 865414-B21 800W Platinum AC supplies." }),
  profile("HPE", "ProLiant ML30", "Server", 5, "#33393b", [r(4, 1000, false, "NIC"), mgmt(1, "iLO"), con("Console", "Serial")], { inventoryRevision: 1, preserveInstalledPorts: true }),
  profile("HPE", "ProLiant ML110", "Server", 6, "#33393b", [r(2, 1000, false, "NIC"), mgmt(1, "iLO")], { inventoryRevision: 1, preserveInstalledPorts: true }),
  profile("HPE", "ProLiant ML350", "Server", 5, "#33393b", [r(4, 1000, false, "NIC"), mgmt(1, "iLO")], { inventoryRevision: 1, preserveInstalledPorts: true }),
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

  profile("NETGEAR", "M4250 family", "Switch", 1, "#30284a", [r(40, 1000, true),
    { ...u(8), labels: labels(41, 8) }, { ...mgmt(), labels: ["OOB"] }, con(), con("USB_C_CONSOLE", "USB-C")],
    { inventoryRevision: 1, preserveInstalledPorts: true, source: "https://www.downloads.netgear.com/files/GDC/M4250/M4250_HIG_EN.pdf", note: "Selected M4250-40G8XF-PoE+ GSM4248PX, 40 PoE+ copper/8 SFP+, one integrated AC supply; front replicated LEDs and rear network ports." }),
  profile("NETGEAR", "M4300 family", "Switch", 1, "#30284a", [r(48, 1000, true),
    { ...u(2, "RJ45_10G", 10000, "10G"), labels: labels(49, 2) }, { ...u(2), labels: labels(51, 2) },
    { ...mgmt(), labels: ["OOB"] }, con(), con("USB_MINI_CONSOLE", "USB-MINI")],
    { inventoryRevision: 1, preserveInstalledPorts: true, source: "https://www.downloads.netgear.com/files/GDC/M4300/M4300_HIG_EN.pdf", note: "Selected M4300-52G-PoE+ GSM4352PA with APS550W in PSU1, PSU2 empty, four fixed rear fans and RPS interface." }),
  profile("NETGEAR", "M4350 family", "Switch", 1, "#30284a", [r(48, 1000, true),
    { ...u(4), labels: labels(49, 4) }, { ...mgmt(), labels: ["OOB"] }, con("USB_C_CONSOLE", "USB-C")],
    { inventoryRevision: 1, preserveInstalledPorts: true, source: "https://www.downloads.netgear.com/files/GDC/M4350/M4350_HIG_EN.pdf", note: "Selected M4350-48G4XF GSM4352 with internal PSU, four fixed fans and two empty optional APS bays; 48 PoE+/4 SFP+, rear OOB and front USB-C console." }),
  profile("NETGEAR", "M4500 family", "Switch", 1, "#30284a", [
    { ...u(48, "SFP28_25G", 25000, "SFP28"), labels: labels(1, 48) },
    { ...u(8, "QSFP28_100G", 100000, "QSFP28"), labels: labels(49, 8) }, { ...mgmt(), labels: ["MGMT"] }, con()],
    { inventoryRevision: 1, preserveInstalledPorts: true, source: "https://www.downloads.netgear.com/files/GDC/M4500/M4500_HIG_EN.pdf", note: "Selected M4500-48XF8C XSM4556, 48 SFP28 configured at 25G and 8 QSFP28 at 100G, two AC PSUs and six fan trays. Manufacturer default SFP28 speed is 10G." }),
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
  profile("Arista", "7010 family", "Switch", 1, "#21363f", [r(48), { ...u(4), labels: labels(49, 4) }, mgmt(), con()],
    { inventoryRevision: 1, preserveInstalledPorts: true, source: "https://www.arista.com/assets/data/pdf/qsg/qsg-books/QS_7010_1RU.pdf", note: "Selected DCS-7010T-48-F, 48 non-PoE 1G copper and 4 SFP+ 10G, dual integrated AC supplies and one reversible fan module with front-to-rear airflow." }),
  profile("Arista", "7020 family", "Switch", 1, "#21363f", [r(48), { ...u(6), labels: labels(49, 6) }, mgmt(), con()],
    { inventoryRevision: 1, preserveInstalledPorts: true, source: "https://www.arista.com/assets/data/pdf/qsg/qsg-books/QS_7020_1RU_Gen3.pdf", note: "Selected DCS-7020TR-48-F, 48 non-PoE 1G copper and 6 central SFP+ 10G, two PWR-500AC supplies and four fan trays with front-to-rear airflow." }),
  profile("Arista", "7050 family", "Switch", 1, "#21363f", [u(48, "SFP28_25G", 25000, "SFP28"), { ...u(8, "QSFP28_100G", 100000, "QSFP28"), labels: labels(49, 8) }, con(), mgmt()],
    { inventoryRevision: 1, preserveInstalledPorts: true, source: "https://www.arista.com/assets/data/pdf/qsg/qsg-books/QS_7050_1RU_Gen3.pdf", note: "Selected DCS-7050SX3-48YC8-F, 48 SFP28 25G and 8 QSFP28 100G, two PWR-511-AC supplies and two dual-fan trays, front-to-rear airflow; external grounding adapter absent." }),
  profile("Arista", "7060 family", "Switch", 1, "#21363f", [u(32, "QSFP28_100G", 100000, "QSFP28"), { ...u(2), labels: labels(33, 2) }, con(), mgmt()],
    { inventoryRevision: 1, preserveInstalledPorts: true, source: "https://www.arista.com/assets/data/pdf/qsg/qsg-books/QS_7060_1RU_Gen3.pdf", note: "Selected DCS-7060CX2-32S-F, 32 QSFP28 100G and 2 SFP+ 10G, two PWR-500AC supplies and four fan trays with front-to-rear airflow." }),
  profile("Arista", "7260 family", "Switch", 2, "#21363f", [u(64, "QSFP28_100G", 100000, "QSFP28"), { ...u(2), labels: labels(65, 2) }, mgmt(), con()],
    { inventoryRevision: 1, preserveInstalledPorts: true, source: "https://www.arista.com/assets/data/pdf/Datasheets/7260X3_Datasheet.pdf", note: "Selected DCS-7260CX3-64-F, 2U, 64 QSFP28 100G and 2 SFP+ 10G, two PWR-745AC-F supplies and four FAN-7002-F trays, front-to-rear airflow; no breakout endpoints or external ground extender." }),
  profile("Arista", "7280 family", "Switch", 1, "#21363f", [u(48, "SFP28_25G", 25000, "SFP28"), { ...u(8, "QSFP28_100G", 100000, "QSFP28"), labels: labels(49, 8) }, mgmt(), con()],
    { inventoryRevision: 1, preserveInstalledPorts: true, source: "https://www.arista.com/assets/data/pdf/qsg/qsg-books/QS_7280R3.pdf", note: "Selected DCS-7280SR3-48YC8-F, 1U, 48 SFP28 25G and 8 QSFP28 100G, two PWR-511-AC-RED supplies and two FAN-7011M-F modules, front-to-rear airflow; external ground extender absent." }),
  profile("Arista", "7300 family", "Switch", 8, "#21363f", [u(48, "SFP28_25G", 25000, "SFP28"), { ...u(4, "QSFP28_100G", 100000, "QSFP28"), labels: labels(49, 4) }, { ...mgmt(), count: 2, labels: ["MGMT1", "MGMT2"] }, con()],
    { inventoryRevision: 1, preserveInstalledPorts: true, source: "https://www.arista.com/assets/data/pdf/qsg/qsg-books/QS_7300_Modular.pdf", note: "Selected DCS-7304X3-BND-F, 8U, 7300-SUP slot1, 7300X3-48YC4-LC slot3, two PWR-3KT-AC-BLUE, four7304X3-FM-F fabrics with eightFAN-7002H-F; other supervisor/line/PSU slots covered; front-to-rear airflow." }),
  profile("Arista", "7500 family", "Switch", 7, "#21363f", [u(36, "QSFP28_100G", 100000, "QSFP28"), { ...mgmt(), count: 2, labels: ["MGMT1", "MGMT2"] }, con()],
    { inventoryRevision: 1, preserveInstalledPorts: true, source: "https://www.arista.com/assets/data/pdf/qsg/qsg-books/QS_7500N_Modular.pdf", note: "Selected DCS-7504R3-BND, 7U, 7500-SUP2 slot1, 7500R3-36CQ-LC slot3, four PWR-3KT-AC-RED, six7504R3-FM integrated fan/fabric modules; other supervisor/line slots covered; optional clock input and SSD absent." }),
  profile("Arista", "7800 family", "Switch", 10, "#21363f", [u(36, "QSFP_DD_400G", 400000, "QSFP-DD"), { ...mgmt(), labels: ["MGMT1"] }, g("management", 1, "SFP_1G", 1000, "MGMT", false, ["MGMT2"]), con()], { inventoryRevision: 1, preserveInstalledPorts: true, note: "Selected DCS-7804R3-BND with SUP1A in slot1, 36D line card in slot3, six AC supplies in PSU3–8 and six R3 fabric modules; other supervisor/line/PSU bays covered." }),

  profile("Juniper", "EX2300 family", "Switch", 1, "#243b31", [r(48, 1000, true), u(4), mgmt(), con(), con("USB_MINI_CONSOLE", "USB CONSOLE"), { ...g("access", 1, "Power", 0, "AC IN", false, ["AC IN"]), inventoryAppend: true }], { inventoryRevision: 1, preserveInstalledPorts: true, source: "https://www.juniper.net/documentation/us/en/hardware/ex2300/ex2300.pdf", note: "Selected EX2300-48P with supplied rack brackets, fixed AC supply, two fixed rear fans, four empty 10G SFP+ cages and Mini-USB/RJ45 consoles. No dedicated VC sockets or removable PSU." }),
  profile("Juniper", "EX3400 family", "Switch", 1, "#243b31", [r(48, 1000, true), u(4), stack(2, "VC"), mgmt(), con(), con("USB_MINI_CONSOLE", "USB CONSOLE"), { ...g("access", 1, "Power", 0, "AC IN", false, ["AC IN"]), inventoryAppend: true }], { inventoryRevision: 1, preserveInstalledPorts: true, source: "https://www.juniper.net/documentation/us/en/hardware/ex3400/ex3400.pdf", note: "Selected EX3400-48P factory JPSU-920-AC-AFO in PSU0, PSU1 covered, two AFO fan modules and supplied rack brackets. Four empty 10G SFP+ cages and two 40G QSFP+ VCPs. The selected single-supply configuration differs from the redundant-PSU configuration required in the EU and other listed markets." }),
  profile("Juniper","EX4100 family","Switch",1,"#243b31",[r(48,1000,true),u(4),u(4,"SFP28_25G",25000,"VC"),mgmt(),con("USB_C_CONSOLE"),con("Console","RJ45 CONSOLE"),{...g("access",1,"Power",0,"AC IN",false,["AC IN"]),inventoryAppend:true}],{inventoryRevision:1,preserveInstalledPorts:true,source:"https://www.juniper.net/documentation/us/en/hardware/ex4100/ex4100.pdf",note:"Selected EX4100-48P: four10G SFP+ uplinks, four25G SFP28 VCPs, one JPSU-920-AC-AFO inPSU0 andPSU1 covered, two supplied AIR OUT fan modules and rack ears; front USB-C console, rear MGMT/RJ45 console/USB-A storage. Empty optical cages."}),
  profile("Juniper","EX4300 family","Switch",1,"#243b31",[r(48,1000,true),u(4),stack(4,"VC"),mgmt(),con(),con("USB_MINI_CONSOLE","USB CONSOLE"),{...g("access",2,"Power",0,"AC IN",false,["PSU0","PSU1"]),inventoryAppend:true}],{inventoryRevision:1,preserveInstalledPorts:true,source:"https://www.juniper.net/documentation/us/en/hardware/ex4300/ex4300.pdf",note:"Selected EX4300-48P with installed EX-UM-4X4SFP uplink module, factory JPSU-1100-AC-AFO-A inPSU0 plus identical optionalPSU1, two EX4300-FAN AIR OUT modules, supplied rack ears. Four rear40G QSFP+ VCPs; Mini-USB front and RJ45 rear consoles, rear MGMT and USB-A storage. High-temperature C16 inputs/C15 cords, no optics installed."}),
  profile("Juniper","EX4400 family","Switch",1,"#243b31",[r(48,1000,true),u(4,"SFP28_25G",25000),u(2,"QSFP28_100G",100000,"VCP"),mgmt(),con("USB_C_CONSOLE"),con("Console","RJ45 CONSOLE"),{...g("access",1,"Power",0,"AC IN",false,["PSU0"]),inventoryAppend:true}],{inventoryRevision:1,preserveInstalledPorts:true,source:"https://www.juniper.net/documentation/us/en/hardware/ex4400/ex4400.pdf",note:"Selected EX4400-48P with installed optional EX4400-EM-4Y four25G module, two fixed100G QSFP28 cages (each defaults to two logical50G VCPs;100G network mode configurable), no optics or synthesized breakout endpoints; one factory JPSU-1600-C-AC-AFO inPSU0, PSU1 covered, two orange AIR OUT fans and supplied EX-RMK brackets. Front USB-C console; rear RJ45 console/MGMT and ancillary USB-A storage; C16 inlet accepting C15 cord."}),
  profile("Juniper","EX4600 family","Switch",1,"#243b31",[u(24),u(4,"QSFP_PLUS_40G",40000),mgmt(),g("management",1,"SFP_1G",1000,"C1",false,["C1"]),con(),{...g("access",2,"Power",0,"AC IN",false,["PSU0","PSU1"]),inventoryAppend:true}],{inventoryRevision:1,preserveInstalledPorts:true,source:"https://www.juniper.net/documentation/us/en/hardware/ex4600/ex4600.pdf",note:"Selected EX4600-40F-AFO base chassis:24 fixed SFP+ and4 fixed QSFP+ cages, two QFX5100-EM-BLNK expansion covers, no optics or expansion cards; two factory JPSU-650W-AC-AFO supplies, five QFX5100-FAN-AFO modules and supplied four-post19in rack kit. Rear C0 RJ45/C1 SFP management, RJ45 console, ancillary USB-A storage. No Virtual Chassis role assumed."}),
  profile("Juniper", "EX9200 family", "Switch", 5, "#59615f", [u(32, "SFP_PLUS_10G", 10000), mgmt(), con(), g("management", 1, "Console", 0, "AUX", false, ["AUX"]), {...g("access", 2, "Power", 0, "AC IN", false, ["PEM0", "PEM1"]), inventoryAppend: true}], {inventoryRevision: 1, preserveInstalledPorts: true, source: "https://www.juniper.net/documentation/us/en/hardware/ex9204/ex9204.pdf", note: "Selected EX9204-AC-BND2: EX9204-BASE3B-AC with one EX9200-32XS installed in line-card slot1, one SF2/RE2 in SF0, two 2520W low-line100-120V AC supplies in PEM0/1, supplied fan tray and filter; LC2 and multifunction LC0/SF1 plus PEM2/3 covered. Native5U; old1U inventory/allocation unchanged. RE2 AUX and console are separate RS232 RJ45 sockets; USB storage, alarm contacts, SF2 clock and two external SFP cages with unverified operational support remain ancillary. No PoE, optics or Virtual Chassis."}),
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
  ...[["SRX5400",5],["SRX5600",8],["SRX5800",16]].map(([model,units]) => profile("Juniper",model,"Firewall",units,"#243b31",[
  {...u(12,"QSFP_PLUS_40G",40000,"IOC4"), labels: Array.from({length:12},(_,i)=>`${Math.floor(i/6)}/${i%6}`)},
  g("uplink",2,"SFP_PLUS_10G",10000,"CLUSTER",false,["HA0","HA1"]),
  {...mgmt(),labels:["MGMT"]},{...con(),labels:["CON"]},g("management",1,"Console",0,"AUX",false,["AUX"]),
  {...g("access",model==="SRX5800"?8:4,"Power",0,"AC IN",false,model==="SRX5800"?["PEM0 AC1","PEM0 AC2","PEM1 AC1","PEM1 AC2","PEM2 AC1","PEM2 AC2","PEM3 AC1","PEM3 AC2"]:["PEM0","PEM1","PEM2","PEM3"]),inventoryAppend:true},
],{fidelity:"exact",inventoryRevision:1,preserveInstalledPorts:true,source:`https://www.juniper.net/documentation/us/en/hardware/${model.toLowerCase()}/${model.toLowerCase()}.pdf`,note:`Selected ${model} AC chassis with one SRX5K-IOC4-MRAT at twelve40G ports (no breakout), one SRX5K-SPC3 with separate HA0/HA1 SFP+10G cluster-control sockets, ${model==="SRX5400"?"one":"two"} SRX5K-SCB3 and one SRX5K-RE3-128G in SCB0. ${model==="SRX5800"?"Four SRX5800-PWR-4100-AC dual-feed high-capacity supplies in PEM0-3; two high-capacity12-fan trays and high-capacity filter tray. IOC in slot5, SPC in slot0, SCB2/6 and other card slots covered.":"Four2050W high-line AC supplies in PEM0-3 and high-capacity side-cooling fan tray/filter. IOC in slot1 and SPC in slot2 on5400; IOC in slot0 and SPC in slot1 on5600; remaining card slots covered."} Spare Routing Engine slot covered; disabled SCB3 SFP cages, external clock, USB storage and alarms ancillary. Original rack units/three-port inventory unchanged; only compatible MGMT0 and CONSOLE map. No optics or redundant host subsystem asserted.`})),
  profile("Juniper","QFX5100 family","Switch",1,"#243b31",[u(48),u(6,"QSFP_PLUS_40G",40000),mgmt(),g("management",1,"SFP_1G",1000,"C1",false,["C1"]),con(),{...g("access",2,"Power",0,"AC IN",false,["PSU0","PSU1"]),inventoryAppend:true}],{inventoryRevision:1,preserveInstalledPorts:true,source:"https://www.juniper.net/documentation/us/en/hardware/qfx5100/qfx5100.pdf",note:"Selected original QFX5100-48S-AFO with48SFP+ and6QSFP+ cages, two factory JPSU-650W-AC-AFO supplies, five QFX5100-FAN-AFO modules and supplied four-post rack kit. Original management panel has C0 RJ45 and C1 SFP; later3AFO dual-SFP revision excluded. No optics, breakout interfaces or configured Virtual Chassis role. USB-A storage ancillary."}),
  profile("Juniper","QFX5110 family","Switch",1,"#243b31",[u(48),u(4,"QSFP28_100G",100000),mgmt(),g("management",2,"SFP_1G",1000,"C",false,["C0 FIBER","C1"]),con(),{...g("access",2,"Power",0,"AC IN",false,["PSU0","PSU1"]),inventoryAppend:true}],{inventoryRevision:1,preserveInstalledPorts:true,source:"https://www.juniper.net/documentation/us/en/hardware/qfx5110/qfx5110.pdf",note:"Selected QFX5110-48S-AFO with48SFP+ and4QSFP28 cages, two factory JPSU-650W-AC-AFO supplies, five QFX5110-48S-FANAFO modules and selected JNP-4PST-RMK-1U-E four-post rack kit. Rear C0 RJ45/fiber combo management (copper priority), separate C1 SFP and RJ45 console. Front grandmaster clock RJ45 and10MHz/PPS SMB timing connectors plus rear USB-A storage are distinct ancillary hardware. No optics/breakout endpoints."}),
profile("Juniper","QFX5120 family","Switch",1,"#59615f",[u(48,"SFP28_25G",25000),u(8,"QSFP28_100G",100000),g("management",2,"RJ45_1G",1000,"C",false,["C0","C1"]),con(),{...g("access",2,"Power",0,"AC IN",false,["PSU0","PSU1"]),inventoryAppend:true}],{inventoryRevision:1,preserveInstalledPorts:true,source:"https://www.juniper.net/documentation/us/en/hardware/qfx5120/qfx5120.pdf",note:"Selected QFX5120-48Y-AFO2:48SFP28 cages explicitly configured25G in twelve quads (factory default10G),8QSFP28-100G cages, two factory JPSU-650W-AC-AO supplies, five QFX5110-FANAFO fans, supplied JNP-4PST-RMK-1U-E rack kit. Rear C0/C1 RJ45 management and RJ45 console; USB-A storage ancillary. No optics, breakouts or configured Virtual Chassis."}),
profile("Juniper","QFX5130 family","Switch",1,"#59615f",[u(32,"QSFP_DD_400G",400000),u(2,"SFP_PLUS_10G",10000),g("management",1,"RJ45_10G",10000,"MGMT",false,["MGMT"]),con(),{...g("access",2,"Power",0,"AC IN",false,["PSU0","PSU1"]),inventoryAppend:true}],{inventoryRevision:1,preserveInstalledPorts:true,source:"https://www.juniper.net/documentation/us/en/hardware/qfx5130/qfx5130.pdf",note:"Selected original QFX5130-32CD-AFO (not QFX5130E):32QSFP-DD400G cages plus two dedicated10G SFP+ cages, front100/1000/10000RJ45 management and console, two factory JPSU-1600W-1UACAFO supplies and six QFX5220-32CD-FANAO fans per official HCT/ordering table. Supplied QFX5K-4PST-RMK-E rack kit. USB-A storage and10MHz/PPS timing outputs ancillary. No optics or breakouts. Cooling chapter names fans differently; source discrepancy disclosed in model evidence."}),
profile("Juniper","QFX5200 family","Switch",1,"#59615f",[u(32,"QSFP28_100G",100000),mgmt(),g("management",2,"SFP_1G",1000,"C",false,["C0 FIBER","C1"]),con(),{...g("access",2,"Power",0,"AC IN",false,["PSU0","PSU1"]),inventoryAppend:true}],{inventoryRevision:1,preserveInstalledPorts:true,source:"https://www.juniper.net/documentation/us/en/hardware/qfx5200/qfx5200.pdf",note:"Selected QFX5200-32C-AFO2 (standard Junos, not32C-L) with32QSFP28-100G cages, two factory JPSU-850W-AC-AFO supplies, five QFX5200-32C-FANAFO fans and supplied JNP-4PST-RMK-1U-E kit. Rear C0 copper/fiber combo (copper priority), C1SFP and RJ45 console. Front grandmaster RJ45 plusPPS/10MHz timing, rearUSB storage ancillary. No optics, breakouts or configured Virtual Chassis."}),
profile("Juniper","QFX5210 family","Switch",2,"#59615f",[u(64,"QSFP28_100G",100000),u(2,"SFP_PLUS_10G",10000),mgmt(),con(),{...g("access",2,"Power",0,"AC IN",false,["PSU0","PSU1"]),inventoryAppend:true}],{inventoryRevision:1,preserveInstalledPorts:true,source:"https://www.juniper.net/documentation/us/en/hardware/qfx5210/qfx5210.pdf",note:"Selected QFX5210-64C-AFO,64QSFP28-100G plus two dedicated10G SFP+ cages, front1G RJ45 management and console, two factory JPSU-1100W-AC-AFO supplies and four QFX5210-FANAFO fans, supplied QFX5210-4PST-RMK four-post kit. USB storage ancillary. No optics or breakouts. Guide rear legend's4PSUs conflicts with2drawn/parts table; actual2selected. Cooling chapter's64C fan infix differs from ordering/HCT SKU."}),
profile("Juniper","QFX5220 family","Switch",1,"#59615f",[u(32,"QSFP_DD_400G",400000),u(2,"SFP_PLUS_10G",10000),g("management",1,"RJ45_10G",10000,"MGMT",false,["MGMT"]),con(),{...g("access",2,"Power",0,"AC IN",false,["PSU0","PSU1"]),inventoryAppend:true}],{inventoryRevision:1,preserveInstalledPorts:true,source:"https://www.juniper.net/documentation/us/en/hardware/qfx5220/qfx5220.pdf",note:"Selected QFX5220-32CD-AFO with32QSFP-DD400G and two dedicated10G SFP+ cages, front100/1000/10000RJ45 management and console, two factory JPSU-1600W-1UACAFO supplies, six QFX5220-32CD-FANAO fans and supplied QFX5K-4PST-RMK-E kit. Front grandmaster RJ45, four10MHz/PPS input/outputSMB jacks andUSB storage ancillary. No optics or breakouts;128C/5230excluded."}),
  profile("Juniper", "QFX10000 family", "Switch", 13, "#59615f", [u(30, "QSFP28_100G", 100000), mgmt(), g("management", 1, "SFP_1G", 1000, "MGMT FIBER", false, ["MGMT FIBER"]), con(), {...g("access", 6, "Power", 0, "AC IN", false, ["PSU0 INP1", "PSU0 INP2", "PSU1 INP1", "PSU1 INP2", "PSU2 INP1", "PSU2 INP2"]), inventoryAppend: true}], {inventoryRevision: 1, preserveInstalledPorts: true, source: "https://www.juniper.net/documentation/us/en/hardware/qfx10008/qfx10008.pdf", note: "Selected QFX10008-BASE with one QFX10000-30C in slot0 at native100G, one QFX10000-RE in CB0, five QFX10008-SF, two QFX10008-FAN trays with11 internal fans each and two controllers, three QFX10000-PWR-AC2700W dual-input supplies in PSU0-2; CB1, LC1-7 and PSU3-5 covered. Native13U; old2U unchanged. Front EMI door opened for service view. RCB four reserved SFP+ cages, timing jacks and USB storage ancillary; optional SSD absent and covered. No optics/breakout. Six power endpoints represent two separate inputs per installed PSU."}),

  profile("Ubiquiti", "EdgeMAX legacy family", "Router", 1, "#879296", [g("access", 10, "RJ45_1G", 1000, "eth", false, labels(0, 10).map(n => `eth${n}`)), u(2, "SFP_1G", 1000, "SFP"), con(), g("management", 1, "Power", 0, "DC")], { inventoryRevision: 1, preserveInstalledPorts: true, note: "Selected ER-12 desktop with supplied 24V adapter, without optional rack kit." }),
  profile("Ubiquiti", "EdgeRouter legacy family", "Router", 1, "#879296", [g("access", 8, "RJ45_1G", 1000, "eth", false, labels(0, 8).map(n => `eth${n}`)), con(), g("management", 1, "Power", 0, "AC")], { inventoryRevision: 1, preserveInstalledPorts: true, note: "Selected ER-8 rack unit pictured in the EdgeRouter datasheet, with fixed 60W supply and C6 inlet for its C5 cord." }),
  profile("Ubiquiti", "EdgeSwitch legacy family", "Router", 1, "#879296", [r(16, 1000, true), u(2, "SFP_1G", 1000, "SFP"), con(), g("management", 1, "Power", 0, "AC")], { inventoryRevision: 1, preserveInstalledPorts: true, note: "Selected ES-16-150W with supplied rack brackets and fixed 150W supply." }),
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
  profile("Palo Alto", "PA-3400 family", "Firewall", 1, "#304047", [r(12, 10000), u(10), u(4, "SFP28_25G", 25000, "SFP28"), g("management", 1, "SFP_PLUS_10G", 10000, "HSCI", false, ["HSCI"]), g("management", 2, "RJ45_1G", 1000, "HA1", false, ["HA1-A", "HA1-B"]), { ...mgmt(), labels: ["MGT"] }, con(), { ...con("USB_MICRO_CONSOLE", "USB CONSOLE"), labels: ["USB CONSOLE"] }], { inventoryRevision: 1, preserveInstalledPorts: true, note: "Selected PA-3410 with two 450W AC supplies and covered system SSD; no inserted transceivers. PA-3430/3440 QSFP28 sockets are excluded." }),
  profile("Palo Alto", "PA-5200 family", "Firewall", 3, "#304047", [r(4,10000), u(16), u(4,"QSFP_PLUS_40G",40000,"QSFP+"), g("uplink",1,"QSFP_PLUS_40G",40000,"HSCI",false,["HSCI"]), g("management",2,"SFP_PLUS_10G",10000,"AUX",false,["AUX-1","AUX-2"]), g("management",2,"RJ45_1G",1000,"HA1",false,["HA1-A","HA1-B"]), con(), mgmt()], {inventoryRevision:1,preserveInstalledPorts:true,source:"https://docs.paloaltonetworks.com/hardware/pa-5200-hardware-reference/pa-5200-series-firewall-overview/pa-5200-front-panel",note:"Selected PA-5220 3U: four10G copper, sixteen10G SFP+, four40G QSFP+ plus40G HSCI, two10G AUX, twoHA1, console and MGT. Dual1100W AC supplies, two four-fan trays, two system SSDs/two log HDDs, two intake filters; no inserted optics."}),
  profile("Palo Alto","PA-5400 family","Firewall",2,"#304047",[r(8,10000),u(12),u(4,"SFP28_25G",25000),g("uplink",4,"QSFP28_100G",100000,"QSFP",false,["ethernet1/41","ethernet1/42","ethernet1/43","ethernet1/44"]),g("uplink",1,"QSFP_PLUS_40G",40000,"HSCI",false,["HSCI"]),g("management",2,"SFP_PLUS_10G",10000,"HA1",false,["HA1-A","HA1-B"]),g("management",1,"SFP_PLUS_10G",10000,"MGT",false,["MGT"]),con(),g("management",1,"USB_MICRO_CONSOLE",0,"CONSOLE",false,["USB CONSOLE"])],{inventoryRevision:1,preserveInstalledPorts:true,source:"https://docs.paloaltonetworks.com/hardware/pa-5400-hardware-reference/pa-5400-series-firewall-overview/pa-5400-series-front-and-back-panel-descriptions/pa-5400-series-front-panel",note:"Selected PA-5410 fixed2U, two PAN-PWR-1200W-AC supplies, three dual-rotor fan assemblies, covered SSD module. Four physical100G cages41-44; breakout25-40 not instantiated. Optical HA/MGT, RJ45/MicroUSB consoles, no inserted optics."}),
  profile("Palo Alto","PA-7000 family","Firewall",9,"#a2a9ab",[r(12),u(8,"SFP_1G",1000),u(4),g("uplink",2,"QSFP_PLUS_40G",40000,"HSCI",false,["HSCI-A","HSCI-B"]),g("management",3,"RJ45_1G",1000,"MGMT",false,["HA1-A","HA1-B","MGT"]),con(),{...g("access",4,"Power",0,"AC",false,["AC1","AC2","AC3","AC4"]),inventoryAppend:true}],{inventoryRevision:1,preserveInstalledPorts:true,source:"https://docs.paloaltonetworks.com/hardware/pa-7000-hardware-reference/pa-7000-series-firewall-overview/pa-7050-front-and-back-panel-descriptions/pa-7050-front-panel-ac",note:"Selected PA-7050 9U historical first-generation configuration:20GXM-NPC slot1,SMCv1 slot4,LPC with four1TB AMCs slot8, five blank slots, two original fan trays and four2500W AC supplies. No air duct, SMC-B, LFC or100G NPC. Saved inventories and rack allocations remain unchanged."}),
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
profile("Extreme","X440-G2","Switch",1,"#392644",[r(48,1000,true),u(4),mgmt(),con()],
  {inventoryRevision:1,preserveInstalledPorts:true}),
profile("Extreme","X450-G2","Switch",1,"#392644",[r(48,1000,true),u(4),
  g("uplink",2,"Stack",21000,"STACK",false,["STACK1","STACK2"]),mgmt(),con()],
  {inventoryRevision:1,preserveInstalledPorts:true}),
profile("Extreme","X460-G2","Switch",1,"#392644",[r(48,1000,true),u(4),mgmt(),con()],
  {inventoryRevision:1,preserveInstalledPorts:true}),
  profile("Extreme", "X465", "Switch", 1, "#392644", [r(24,5000,true),r(24,1000,true),u(4,"SFP28_25G",25000),g("uplink",2,"Stack",40000,"STACK"),mgmt(),con(),g("management",1,"USB_MICRO_CONSOLE",0,"CONSOLE",false,["USB-MICRO"])], {inventoryRevision:1,preserveInstalledPorts:true}),
  profile("Extreme", "X590", "Switch", 1, "#392644", [g("access",24,"RJ45_10G",10000,""),{...u(1,"QSFP_PLUS_40G",40000,"QSFP+"),labels:["25"]},{...u(2,"QSFP28_100G",100000,"QSFP28"),labels:["29","33"]},mgmt(),con()], {inventoryRevision:1,preserveInstalledPorts:true}),
  profile("Extreme", "X690", "Switch", 1, "#392644", [g("access",48,"RJ45_10G",10000,""),{...u(2,"QSFP_PLUS_40G",40000,"QSFP+"),labels:["49","53"]},{...u(4,"QSFP28_100G",100000,"QSFP28"),labels:["57","61","65","69"]},mgmt(),con()], {inventoryRevision:1,preserveInstalledPorts:true}),
  profile("Extreme", "X695", "Switch", 1, "#392644", [u(48,"SFP28_25G",25000,"SFP28"), {...u(8,"QSFP28_100G",100000,"QSFP28"), labels:["49","50","51","55","56","60","61","62"]}, mgmt(), con()], {inventoryRevision:1,preserveInstalledPorts:true}),
profile("Extreme", "X870", "Switch", 1, "#392644", [{...u(32,"QSFP28_100G",100000,"QSFP28"), labels:Array.from({length:32},(_,i)=>String(1+i*4))}, mgmt(), con(), g("management",1,"USB_MICRO_CONSOLE",0,"CONSOLE",false,["USB-MICRO"])], {inventoryRevision:1,preserveInstalledPorts:true}),
  profile("Ruckus", "ICX 7150 family", "Switch", 1, "#4b3520", [r(48, 1000, true), g("uplink", 2, "RJ45_1G", 1000, "C", false, ["C1", "C2"]), u(4, "SFP_PLUS_10G", 10000, "X"), con(), con("USB_C_CONSOLE", "USB-C"), mgmt()], { inventoryRevision: 1, preserveInstalledPorts: true, note: "Selected ICX7150-48P-4X10GR, matching the separately verified exact SKU." }),
  profile("Ruckus", "ICX 7250 family", "Switch", 1, "#4b3520", [r(48), u(8), mgmt(), con("USB_MINI_CONSOLE")], { inventoryRevision: 1, preserveInstalledPorts: true, note: "Selected non-PoE ICX7250-48 with sequential two-port and eight-port 10G licenses; fixed AC input, two fixed fan grilles and covered EPS connector. No EPS4000 installed." }),
  profile("Ruckus", "ICX 7450 family", "Switch", 1, "#4b3520", [r(48, 1000, true), u(4),
    u(2, "QSFP_PLUS_40G", 40000, "QSFP"), mgmt(), con("USB_MINI_CONSOLE")],
    { inventoryRevision: 1, preserveInstalledPorts: true }),
  profile("Ruckus", "ICX 7550 family", "Switch", 1, "#4b3520", [r(36, 2500, true), g("access", 12, "RJ45_10G", 10000, "", true),
    u(3, "QSFP28_100G", 100000, "QSFP"), con(), g("management", 1, "USB_C_CONSOLE", 0, "CONSOLE", false, ["USB-C"]), mgmt()],
    { inventoryRevision: 1, preserveInstalledPorts: true }),
  profile("Ruckus", "ICX 7650 family", "Switch", 1, "#4b3520", [r(24,1000,true),r(24,10000,true),u(4),u(2,"QSFP_PLUS_40G",40000,"QSFP40"),u(2,"QSFP28_100G",100000,"QSFP100"),mgmt(),con(),g("management",1,"USB_C_CONSOLE",0,"CONSOLE",false,["USB-C"])], {inventoryRevision:1,preserveInstalledPorts:true}),
  profile("Ruckus", "ICX 7850 family", "Switch", 1, "#4b3520", [g("access",48,"SFP28_25G",25000,"",false),u(8,"QSFP28_100G",100000,"QSFP"),mgmt(),con(),g("management",1,"USB_C_CONSOLE",0,"CONSOLE",false,["USB-C"])], {inventoryRevision:1,preserveInstalledPorts:true}),
  profile("Ruckus", "ICX 8200 family", "Switch", 1, "#4b3520", [r(48,1000,true),u(4,"SFP28_25G",25000,"SFP28"),mgmt(),con(),g("management",1,"USB_C_CONSOLE",0,"CONSOLE",false,["USB-C"])], {inventoryRevision:1,preserveInstalledPorts:true}),

  // Facilities, console/OOB, wireless control and storage endpoints.
  profile("APC", "Smart-UPS Network family", "Server", 2, "#31383a", [mgmt(1, "NMC"), g("management", 1, "Power", 0, "AC"), con("Console", "SERIAL"), con("USB_MICRO_CONSOLE", "NMC CLI")],
    { inventoryRevision: 1, preserveInstalledPorts: true, source: "https://www.se.com/us/en/download/document/SPD_MMIS-8HUQTU_EN/", note: "Selected SMT1500RMI2U 230V four-outlet UPS with installed AP9641 NMC3; power outputs and environmental I/O are ancillary artwork." }),
  ...many("CyberPower", ["Smart App UPS family"], "Server", 2, "#31383a", [g("management", 1, "RJ45_1G", 100, "RMCARD"), g("management", 1, "Power", 0, "AC"), g("management", 1, "Console", 0, "CARD CLI")], { inventoryRevision: 1, preserveInstalledPorts: true }),
  ...many("Eaton", ["Network UPS family"], "Server", 2, "#31383a", [g("management", 1, "RJ45_1G", 1000, "NETWORK"), g("management", 1, "Power", 0, "AC"), g("management", 1, "Console", 0, "RS232"), g("management", 1, "USB_MICRO_CONSOLE", 0, "CARD CLI")], { inventoryRevision: 1, preserveInstalledPorts: true }),
  ...many("Vertiv", ["Liebert UPS family"], "Server", 2, "#31383a", [g("management", 1, "RJ45_1G", 100, "UNITY"), g("management", 1, "Power", 0, "AC"), g("management", 1, "Console", 0, "CLI")], { inventoryRevision: 1, preserveInstalledPorts: true }),
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
  profile("Cisco", "Catalyst 9800-L WLC", "Router", 1, "#263b4b", [r(4, 2500), u(2), g("management", 2, "RJ45_1G", 1000, "MGMT", false, ["SP", "RP"]), con(), { ...con("USB_MICRO_CONSOLE", "USB CONSOLE"), labels: ["USB CONSOLE"] }], { inventoryRevision: 1, preserveInstalledPorts: true, note: "Selected C9800-L-F-K9 fiber model with external C9800-AC-110W; four 2.5G copper, two 10G SFP+, SP/RP and RJ45/Micro-B consoles." }),
  profile("HPE Aruba", "Mobility Controller family", "Router", 1, "#27383a", [r(4), u(4, "SFP_1G", 1000, "SFP"), u(2), mgmt(), con("USB_MICRO_CONSOLE", "USB CONSOLE"), con()], {
    ...verified("https://arubanetworking.hpe.com/techdocs/hardware/controllers/7205/ig/7205-IG-EN.pdf"), inventoryRevision: 1, preserveInstalledPorts: true,
    note: "Selected JW735A 7205-RW: four dual-media 1G interfaces, two 10G SFP+, front management/RJ45/Micro-USB serial, preinstalled 7205-MCC-1 CPU and one fixed 180W AC supply." }),
  profile("Fortinet", "FortiWLC family", "Router", 1, "#dfe2df", [
    {...r(4), labels: ["1", "2", "3", "4"]},
    {zone: "uplink", count: 4, type: "SFP_1G", speed: 1000, prefix: "SFP", labels: ["5", "6", "7", "8"]},
    {...u(2), labels: ["9", "10"]},
    {...con(), labels: ["CONSOLE"]},
  ], {inventoryRevision: 1, preserveInstalledPorts: true}),
  ...many("Synology", ["RackStation family"], "Server", 2, "#343b3d", [r(4, 1000, false, "LAN")], { inventoryRevision: 1, preserveInstalledPorts: true }),
  ...many("QNAP", ["Rackmount NAS family"], "Server", 2, "#343b3d", [r(2, 2500, false, "LAN")], { inventoryRevision: 1, preserveInstalledPorts: true }),
  ...many("NetApp", ["FAS family"], "Server", 4, "#343b3d", [u(8, "SFP28_25G", 25000, "DATA"), mgmt(2),
    { ...u(4, "SFP28_25G", 25000, "HA"), zone: "access", inventoryAppend: true },
    { ...u(4, "QSFP28_100G", 100000, "CLUSTER"), zone: "access", inventoryAppend: true },
    { zone: "access", count: 2, type: "Console", speed: 0, prefix: "CONSOLE", inventoryAppend: true },
    { zone: "access", count: 2, type: "USB_MICRO_CONSOLE", speed: 0, prefix: "USB", inventoryAppend: true }
  ], { inventoryRevision: 1, preserveInstalledPorts: true }),
  ...many("Dell", ["PowerStore family"], "Server", 2, "#343b3d", [u(8, "SFP28_25G", 25000, "DATA"), mgmt(2), { ...r(2, 1000, false, "SERVICE"), inventoryAppend: true }, { ...u(4, "QSFP28_100G", 100000, "EXP"), zone: "access", inventoryAppend: true }], { inventoryRevision: 1, preserveInstalledPorts: true }),
  ...many("Dell", ["PowerVault family"], "Server", 2, "#343b3d", [u(8, "SFP28_25G", 25000, "DATA"), mgmt(2), { zone: "management", count: 2, type: "USB_MICRO_CONSOLE", speed: 0, prefix: "CLI" }], { inventoryRevision: 1, preserveInstalledPorts: true }),

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
