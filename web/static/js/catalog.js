import { fortinetProfiles } from "./catalog-fortinet.js";
import { edgeCatalogProfiles } from "./catalog-edge.js";
import { expandedCatalogProfiles } from "./catalog-expanded.js";
import { lenovoStorageProfiles } from "./catalog-lenovo-storage.js";
import { lenovoServerProfiles } from "./catalog-lenovo-servers.js";
import { accessAdditionProfiles } from "./catalog-access-additions.js";
import { rackAccessoryProfiles } from "./catalog-rack-accessories.js";
import { radAdditionProfiles } from "./catalog-rad-additions.js";
import { eatonAdditionProfiles } from "./catalog-eaton-additions.js";
import { portLayoutMetadata, resolvePhysicalPortGroups } from "./catalog-port-layouts.js";

// The built-in catalog is an offline front-panel schematic library. Profiles are
// data, not renderer branches, so new SKUs can be added without changing Canvas.
const profiles = [
  ...fortinetProfiles,
  ...edgeCatalogProfiles,
  ...expandedCatalogProfiles,
  ...lenovoStorageProfiles,
  ...lenovoServerProfiles,
  ...accessAdditionProfiles,
  ...rackAccessoryProfiles,
  ...radAdditionProfiles,
  ...eatonAdditionProfiles,

  p("Cisco", "Catalyst C9200L-24T-4G", "Switch", 1, "#263b4b", [r(24, "RJ45_1G", 1000, false), u(4, "SFP_1G", 1000, "SFP"), m(1), { ...m(1), type: "USB_MINI_CONSOLE", labels: ["USB CONSOLE"] }, { ...m(1), type: "RJ45_1G", speed: 1000, prefix: "MGMT", labels: ["MGMT"] }], { inventoryRevision: 1 }),
  p("Cisco", "Catalyst C9200L-24P-4X", "Switch", 1, "#263b4b", [r(24, "RJ45_1G", 1000, true), u(4, "SFP_PLUS_10G", 10000, "SFP+"), m(1), { ...m(1), type: "USB_MINI_CONSOLE", labels: ["USB CONSOLE"] }, { ...m(1), type: "RJ45_1G", speed: 1000, prefix: "MGMT", labels: ["MGMT"] }], { inventoryRevision: 1 }),
  p("Cisco", "Catalyst C9200L-48T-4G", "Switch", 1, "#263b4b", [r(48, "RJ45_1G", 1000, false), u(4, "SFP_1G", 1000, "SFP"), m(1), { ...m(1), type: "USB_MINI_CONSOLE", labels: ["USB CONSOLE"] }, { ...m(1), type: "RJ45_1G", speed: 1000, prefix: "MGMT", labels: ["MGMT"] }], { inventoryRevision: 1 }),
  p("Cisco", "Catalyst C9200L-48P-4X", "Switch", 1, "#263b4b", [r(48, "RJ45_1G", 1000, true), u(4, "SFP_PLUS_10G", 10000, "SFP+"), m(1), { ...m(1), type: "USB_MINI_CONSOLE", labels: ["USB CONSOLE"] }, { ...m(1), type: "RJ45_1G", speed: 1000, prefix: "MGMT", labels: ["MGMT"] }], { inventoryRevision: 1 }),
  p("Cisco", "Catalyst C9300L-24T-4G", "Switch", 1, "#263b4b", [r(24, "RJ45_1G", 1000, false), u(4, "SFP_1G", 1000, "SFP"), m(1), { ...m(1), type: "USB_MINI_CONSOLE", labels: ["USB CONSOLE"] }, { ...m(1), type: "RJ45_1G", speed: 1000, prefix: "MGMT", labels: ["MGMT"] }], { inventoryRevision: 1 }),
  p("Cisco", "Catalyst C9300L-48P-4X", "Switch", 1, "#263b4b", [r(48, "RJ45_1G", 1000, true), u(4, "SFP_PLUS_10G", 10000, "SFP+"), m(1), { ...m(1), type: "USB_MINI_CONSOLE", labels: ["USB CONSOLE"] }, { ...m(1), type: "RJ45_1G", speed: 1000, prefix: "MGMT", labels: ["MGMT"] }], { inventoryRevision: 1 }),
  p("Cisco", "Catalyst C9300X-24Y", "Switch", 1, "#263b4b", [u(24, "SFP28_25G", 25000, "SFP28"), { ...u(8, "SFP28_25G", 25000, "UPLINK"), labels: ["1", "2", "3", "4", "5", "6", "7", "8"] }, m(1), { ...m(1), type: "USB_MINI_CONSOLE", labels: ["USB CONSOLE"] }, { ...m(1), type: "RJ45_1G", speed: 1000, labels: ["MGMT"] }, { ...m(2), type: "Stack", prefix: "STACK", labels: ["STACK 1", "STACK 2"] }], { inventoryRevision: 1 }),
  p("Cisco", "Nexus 93180YC-FX3", "Switch", 1, "#263b4b", [u(48, "SFP28_25G", 25000, "SFP28"), u(6, "QSFP28_100G", 100000, "QSFP"), m(1), { ...m(1), type: "RJ45_1G", speed: 1000, prefix: "MGMT", labels: ["MGMT"] }], { inventoryRevision: 1 }),
  p("Cisco", "Nexus 9336C-FX2", "Switch", 1, "#263b4b", [u(36, "QSFP28_100G", 100000, "QSFP"), m(1), { ...m(1), type: "RJ45_1G", speed: 1000, prefix: "MGMT", labels: ["MGMT RJ45"] }, { ...m(1), type: "SFP_1G", speed: 1000, prefix: "MGMT", labels: ["MGMT SFP"] }], { inventoryRevision: 1 }),
  p("Cisco", "Meraki MS120-24P", "Switch", 1, "#263b4b", [r(24, "RJ45_1G", 1000, true), u(4, "SFP_1G", 1000, "SFP"), { ...m(1), type: "RJ45_1G", speed: 1000, prefix: "MGMT", labels: ["MGMT"] }], { inventoryRevision: 1 }),
  p("Cisco", "Meraki MS225-48FP", "Switch", 1, "#263b4b", [r(48, "RJ45_1G", 1000, true), u(4, "SFP_PLUS_10G", 10000, "SFP+"), { ...u(2, "Stack", 40000, "STACK"), labels: ["STACK 1", "STACK 2"] }, { ...m(1), type: "RJ45_1G", speed: 1000, prefix: "MGMT", labels: ["MGMT"] }], { inventoryRevision: 1 }),

  p("HPE Aruba", "CX 6100 24G 4SFP+", "Switch", 1, "#27383a", [r(24, "RJ45_1G", 1000, false), u(4, "SFP_PLUS_10G", 10000, "SFP+"), { ...m(1), type: "USB_C_CONSOLE" }], { inventoryRevision: 1 }),
  p("HPE Aruba", "CX 6100 48G 4SFP+", "Switch", 1, "#27383a", [r(48, "RJ45_1G", 1000, false), u(4, "SFP_PLUS_10G", 10000, "SFP+"), { ...m(1), type: "USB_C_CONSOLE" }], { inventoryRevision: 1 }),
  p("HPE Aruba", "CX 6200F 24G 4SFP+", "Switch", 1, "#27383a", [r(24, "RJ45_1G", 1000, true), u(4, "SFP_PLUS_10G", 10000, "SFP+"), { ...m(1), type: "USB_C_CONSOLE" }, { ...m(1), type: "RJ45_1G", speed: 1000, prefix: "MGMT", labels: ["MGMT"] }], { inventoryRevision: 1 }),
  p("HPE Aruba", "CX 6200F 48G 4SFP+", "Switch", 1, "#27383a", [r(48, "RJ45_1G", 1000, true), u(4, "SFP_PLUS_10G", 10000, "SFP+"), { ...m(1), type: "USB_C_CONSOLE" }, { ...m(1), type: "RJ45_1G", speed: 1000, prefix: "MGMT", labels: ["MGMT"] }], { inventoryRevision: 1 }),
  { ...p("HPE Aruba", "CX 6300M 24-port Smart Rate", "Switch", 1, "#27383a", [r(24, "RJ45_10G", 10000, true), u(2, "SFP56_50G", 50000, "SFP56"), u(2, "SFP28_25G", 25000, "SFP28"), m(1), { ...m(1), type: "USB_C_CONSOLE", labels: ["USB CONSOLE"] }, { ...m(1), type: "RJ45_1G", speed: 1000, prefix: "MGMT", labels: ["MGMT"] }], { inventoryRevision: 1 }), preserveInstalledPorts: true, source: "https://arubanetworking.hpe.com/techdocs/hardware/switches/6300/IGSG/igsg_6300.pdf", note: "Selected R8S89A 24x10G Class 6 PoE, two 50G/two 25G uplinks, RJ45/USB-C consoles and OOB; two JL087A 1050W AC and two JL669B fan trays." },
  p("HPE Aruba", "CX 6300M 48G", "Switch", 1, "#27383a", [r(48, "RJ45_1G", 1000, true), u(4, "SFP56_50G", 50000, "SFP56"), { ...m(1), type: "USB_C_CONSOLE" }, { ...m(1), type: "RJ45_1G", speed: 1000, prefix: "MGMT", labels: ["MGMT"] }], { inventoryRevision: 1 }),
  p("HPE Aruba", "CX 8325-48Y8C", "Switch", 1, "#27383a", [u(48, "SFP28_25G", 25000, "SFP28"), u(8, "QSFP28_100G", 100000, "QSFP"), m(1), { ...m(1), type: "RJ45_1G", speed: 1000, prefix: "MGMT", labels: ["MGMT"] }, { ...m(1), type: "USB_MICRO_CONSOLE", labels: ["USB CONSOLE"] }], { inventoryRevision: 1 }),

  p("Juniper", "EX2300-24T", "Switch", 1, "#243b31", [r(24, "RJ45_1G", 1000, false), u(4, "SFP_PLUS_10G", 10000, "SFP+"), m(1), { ...m(1), type: "USB_MINI_CONSOLE", labels: ["USB CONSOLE"] }, { ...m(1), type: "RJ45_1G", speed: 1000, prefix: "MGMT", labels: ["MGMT"] }], { inventoryRevision: 1 }),
  p("Juniper", "EX2300-48P", "Switch", 1, "#243b31", [r(48, "RJ45_1G", 1000, true), u(4, "SFP_PLUS_10G", 10000, "SFP+"), m(1), { ...m(1), type: "USB_MINI_CONSOLE", labels: ["USB CONSOLE"] }, { ...m(1), type: "RJ45_1G", speed: 1000, prefix: "MGMT", labels: ["MGMT"] }], { inventoryRevision: 1 }),
  p("Juniper", "EX3400-24P", "Switch", 1, "#243b31", [r(24, "RJ45_1G", 1000, true), u(4, "SFP_PLUS_10G", 10000, "SFP+"), u(2, "QSFP_PLUS_40G", 40000, "QSFP+"), m(1), { ...m(1), type: "USB_MINI_CONSOLE", labels: ["USB CONSOLE"] }, { ...m(1), type: "RJ45_1G", speed: 1000, prefix: "MGMT", labels: ["MGMT"] }], { inventoryRevision: 1 }),
  p("Juniper", "EX4400-48P", "Switch", 1, "#243b31", [r(48, "RJ45_1G", 1000, true), u(4, "SFP28_25G", 25000, "SFP28"), m(1), u(2, "QSFP28_100G", 100000, "QSFP"), { ...m(1), type: "USB_C_CONSOLE", labels: ["USB CONSOLE"] }, { ...m(1), type: "RJ45_1G", speed: 1000, prefix: "MGMT", labels: ["MGMT"] }], { inventoryRevision: 1 }),
  p("Juniper", "EX4650-48Y", "Switch", 1, "#243b31", [u(48, "SFP28_25G", 25000, "SFP28"), u(8, "QSFP28_100G", 100000, "QSFP"), m(1), { ...m(1), type: "RJ45_1G", speed: 1000, prefix: "MGMT", labels: ["MGMT"] }], { inventoryRevision: 1 }),

  p("Ubiquiti", "UniFi Standard 24", "Switch", 1, "#879296", [r(24, "RJ45_1G", 1000, false), u(2, "SFP_1G", 1000, "SFP")]),
  p("Ubiquiti", "UniFi Standard 48 PoE", "Switch", 1, "#879296", [r(32, "RJ45_1G", 1000, true), r(16, "RJ45_1G", 1000, false), u(4, "SFP_1G", 1000, "SFP")]),
  p("Ubiquiti", "UniFi Pro Max 24 PoE", "Switch", 1, "#879296", [r(16, "RJ45_1G", 1000, true), r(8, "RJ45_MGIG", 2500, true), u(2, "SFP_PLUS_10G", 10000, "SFP+")]),
  p("Ubiquiti", "UniFi Pro Max 48 PoE", "Switch", 1, "#879296", [r(32, "RJ45_1G", 1000, true), r(16, "RJ45_MGIG", 2500, true), u(4, "SFP_PLUS_10G", 10000, "SFP+")]),
  p("Ubiquiti", "UniFi Pro XG 24 PoE", "Switch", 1, "#879296", [r(8, "RJ45_MGIG", 2500, true, "2.5G"), r(16, "RJ45_10G", 10000, true, "10G"), u(2, "SFP28_25G", 25000, "SFP28")]),
  p("Ubiquiti", "UniFi Pro XG 48 PoE", "Switch", 1, "#879296", [r(16, "RJ45_MGIG", 2500, true, "2.5G"), r(32, "RJ45_10G", 10000, true, "10G"), u(4, "SFP28_25G", 25000, "SFP28")]),
  p("Ubiquiti", "UniFi Enterprise Campus Aggregation", "Switch", 1, "#879296", [u(48, "SFP28_25G", 25000, "SFP28"), u(6, "QSFP28_100G", 100000, "QSFP")]),

  p("MikroTik", "CRS326-24G-2S+RM", "Switch", 1, "#e1e4e1", [r(24, "RJ45_1G", 1000, false), u(2, "SFP_PLUS_10G", 10000, "SFP+"), m(1)]),
  p("MikroTik", "CRS328-24P-4S+RM", "Switch", 1, "#e1e4e1", [r(24, "RJ45_1G", 1000, true), u(4, "SFP_PLUS_10G", 10000, "SFP+"), m(1)]),
  p("MikroTik", "CRS354-48G-4S+2Q+RM", "Switch", 1, "#e1e4e1", [r(48, "RJ45_1G", 1000, false), u(4, "SFP_PLUS_10G", 10000, "SFP+"), u(2, "QSFP_PLUS_40G", 40000, "QSFP+"), { zone: "management", count: 1, type: "RJ45_1G", speed: 100, poe: false, prefix: "MGMT" }, m(1)]),
  p("MikroTik", "CRS317-1G-16S+RM", "Switch", 1, "#e1e4e1", [r(1, "RJ45_1G", 1000, false), u(16, "SFP_PLUS_10G", 10000, "SFP+"), m(1)]),
  p("MikroTik", "CRS518-16XS-2XQ-RM", "Switch", 1, "#e1e4e1", [u(16, "SFP28_25G", 25000, "SFP28"), u(2, "QSFP28_100G", 100000, "QSFP"), { zone: "management", count: 1, type: "RJ45_1G", speed: 100, poe: false, prefix: "MGMT" }, m(1)]),

  p("Dell", "PowerSwitch N3248TE-ON", "Switch", 1, "#1d3d50", [r(48, "RJ45_1G", 1000, false), u(4, "SFP_PLUS_10G", 10000, "SFP+"), u(2, "QSFP28_100G", 100000, "QSFP"), m(1),
    { ...m(1), type: "RJ45_1G", speed: 1000, prefix: "MGMT", labels: ["MGMT"] },
    { ...m(1), type: "USB_MICRO_CONSOLE", labels: ["MICRO-USB"] }], { inventoryRevision: 1 }),
  p("Dell", "PowerSwitch S4148F-ON", "Switch", 1, "#1d3d50", [u(24, "SFP_PLUS_10G", 10000),
    { ...u(2, "QSFP28_100G", 100000), labels: ["25", "26"] }, { ...u(2, "QSFP_PLUS_40G", 40000), labels: ["27", "28"] },
    { ...u(2, "QSFP28_100G", 100000), labels: ["29", "30"] },
    { ...u(24, "SFP_PLUS_10G", 10000), labels: Array.from({ length: 24 }, (_, index) => String(index + 31)) }, m(1),
    { ...m(1), type: "RJ45_1G", speed: 1000, prefix: "MGMT", labels: ["MGMT"] },
    { ...m(1), type: "USB_MICRO_CONSOLE", labels: ["MICRO-USB"] }], { inventoryRevision: 1 }),
  p("Dell", "PowerSwitch S5248F-ON", "Switch", 1, "#1d3d50", [u(48, "SFP28_25G", 25000, "SFP28"),
    { ...u(2, "QSFP_DD_200G", 200000, "QSFP-DD"), labels: ["49/50", "51/52"] },
    { ...u(4, "QSFP28_100G", 100000, "QSFP"), labels: ["53", "54", "55", "56"] }, m(1),
    { ...m(1), type: "RJ45_1G", speed: 1000, prefix: "MGMT", labels: ["MGMT"] },
    { ...m(1), type: "USB_MICRO_CONSOLE", labels: ["MICRO-USB"] }], { inventoryRevision: 1 }),

  p("NETGEAR", "M4300-28G", "Switch", 1, "#30284a", [r(24, "RJ45_1G", 1000, false), u(2, "RJ45_10G", 10000, "10G"), u(2, "SFP_PLUS_10G", 10000, "SFP+"), m(1),
    { zone: "management", count: 1, type: "RJ45_1G", speed: 1000, poe: false, prefix: "OOB" },
    { zone: "management", count: 1, type: "USB_MINI_CONSOLE", speed: 0, poe: false, prefix: "USB", labels: ["MINI-USB"] }]),
  p("NETGEAR", "M4300-52G", "Switch", 1, "#30284a", [r(48, "RJ45_1G", 1000, false), u(2, "RJ45_10G", 10000, "10G"), u(2, "SFP_PLUS_10G", 10000, "SFP+"), m(1),
    { zone: "management", count: 1, type: "RJ45_1G", speed: 1000, poe: false, prefix: "OOB" },
    { zone: "management", count: 1, type: "USB_MINI_CONSOLE", speed: 0, poe: false, prefix: "USB", labels: ["MINI-USB"] }]),
  { ...p("NETGEAR", "M4250-26G4F-PoE+", "Switch", 1, "#30284a", [r(24, "RJ45_1G", 1000, true), r(2, "RJ45_1G", 1000, false), u(4, "SFP_1G", 1000, "SFP"), m(1),
    { zone: "management", count: 1, type: "RJ45_1G", speed: 1000, poe: false, prefix: "OOB" },
    { zone: "management", count: 1, type: "USB_C_CONSOLE", speed: 0, poe: false, prefix: "USB", labels: ["USB-C"] }]), inventoryRevision: 1 },

  p("TP-Link Omada", "SG3428X", "Switch", 1, "#24442d", [r(24, "RJ45_1G", 1000, false), u(4, "SFP_PLUS_10G", 10000, "SFP+"), m(1),
    { zone: "management", count: 1, type: "USB_C_CONSOLE", speed: 0, poe: false, prefix: "USB", labels: ["USB-C"] }]),
  p("TP-Link Omada", "SG3452XP", "Switch", 1, "#24442d", [r(48, "RJ45_1G", 1000, true), u(4, "SFP_PLUS_10G", 10000, "SFP+"), m(1),
    { zone: "management", count: 1, type: "USB_MICRO_CONSOLE", speed: 0, poe: false, prefix: "USB", labels: ["MICRO-USB"] }]),
  p("TP-Link Omada", "SX6632YF", "Switch", 1, "#24442d", [u(26, "SFP_PLUS_10G", 10000, "SFP+"), u(6, "SFP28_25G", 25000, "SFP28"), m(1),
    { zone: "management", count: 1, type: "RJ45_1G", speed: 1000, poe: false, prefix: "MGMT" },
    { zone: "management", count: 1, type: "USB_C_CONSOLE", speed: 0, poe: false, prefix: "USB", labels: ["USB-C"] }]),

  p("Arista", "7050SX3-48YC8", "Switch", 1, "#21363f", [u(48, "SFP28_25G", 25000, "SFP28"), u(8, "QSFP28_100G", 100000, "QSFP"), m(1), { ...m(1), type: "RJ45_1G", speed: 1000, prefix: "MGMT", labels: ["MGMT"] }], { inventoryRevision: 1 }),
  p("Arista", "7060CX2-32S", "Switch", 1, "#21363f", [u(32, "QSFP28_100G", 100000, "QSFP"), u(2, "SFP_PLUS_10G", 10000, "SFP+"), m(1), { ...m(1), type: "RJ45_1G", speed: 1000, prefix: "MGMT", labels: ["MGMT"] }], { inventoryRevision: 1 }),
  p("Arista", "720XP-48ZC2", "Switch", 1, "#21363f", [r(40, "RJ45_MGIG", 2500, true, "MGE"), r(8, "RJ45_MGIG", 5000, true, "MGE"), u(4, "SFP28_25G", 25000, "SFP28"), u(2, "QSFP28_100G", 100000, "QSFP"), m(1), { ...m(1), type: "RJ45_1G", speed: 1000, prefix: "MGMT", labels: ["MGMT"] }], { inventoryRevision: 1 }),

  p("Extreme", "5320-24P-8XE", "Switch", 1, "#392644", [r(24, "RJ45_1G", 1000, true), u(6, "SFP_PLUS_10G", 10000, "SFP+"),
    { ...u(2, "SFP_PLUS_10G", 10000, "UNIVERSAL"), labels: ["U1", "U2"] }, m(1),
    { ...m(1), type: "USB_MICRO_CONSOLE", labels: ["USB CONSOLE"] }], { inventoryRevision: 1 }),
  p("Extreme", "5520-48W", "Switch", 1, "#392644", [r(48, "RJ45_1G", 1000, true),
    { ...u(4, "SFP28_25G", 25000, "VIM"), labels: ["VIM1", "VIM2", "VIM3", "VIM4"] },
    { ...u(2, "QSFP_PLUS_40G", 40000, "UNIVERSAL"), labels: ["U1", "U2"] }, m(1),
    { ...m(1), type: "USB_MICRO_CONSOLE", labels: ["USB CONSOLE"] },
    { ...m(1), type: "RJ45_1G", speed: 1000, labels: ["MGMT"] }], { inventoryRevision: 1 }),
  p("Extreme", "VSP 7400-48Y-8C", "Switch", 1, "#392644", [u(48, "SFP28_25G", 25000, "SFP28"), u(8, "QSFP28_100G", 100000, "QSFP"), m(1),
    { ...m(1), type: "RJ45_1G", speed: 1000, labels: ["MGMT"] }], { inventoryRevision: 1 }),

  p("Ruckus", "ICX 7150-24P", "Switch", 1, "#4b3520", [r(24, "RJ45_1G", 1000, true),
    { ...u(2, "RJ45_1G", 1000, "UPLINK"), labels: ["C1", "C2"] },
    { ...u(4, "SFP_PLUS_10G", 10000, "SFP+"), labels: ["X1", "X2", "X3", "X4"] }, m(1),
    { ...m(1), type: "USB_C_CONSOLE", labels: ["USB-C"] },
    { ...m(1), type: "RJ45_1G", speed: 1000, labels: ["MGMT"] }], { inventoryRevision: 1 }),
  p("Ruckus", "ICX 7150-48P", "Switch", 1, "#4b3520", [r(48, "RJ45_1G", 1000, true),
    { ...u(2, "RJ45_1G", 1000, "UPLINK"), labels: ["C1", "C2"] },
    { ...u(4, "SFP_PLUS_10G", 10000, "SFP+"), labels: ["X1", "X2", "X3", "X4"] }, m(1),
    { ...m(1), type: "USB_C_CONSOLE", labels: ["USB-C"] },
    { ...m(1), type: "RJ45_1G", speed: 1000, labels: ["MGMT"] }], { inventoryRevision: 1 }),
  p("Ruckus", "ICX 7550-48ZP", "Switch", 1, "#4b3520", [r(36, "RJ45_MGIG", 2500, true, "MGE"), r(12, "RJ45_10G", 10000, true, "10G"),
    { ...u(1, "QSFP28_100G", 100000, "QSFP"), labels: ["3/1"] },
    { ...u(2, "QSFP28_100G", 100000, "QSFP"), labels: ["2/1", "2/2"] }, m(1),
    { ...m(1), type: "USB_C_CONSOLE", labels: ["USB-C"] },
    { ...m(1), type: "RJ45_1G", speed: 1000, labels: ["MGMT"] }], { inventoryRevision: 1 }),

  p("Palo Alto", "PA-440 / PA-450", "Firewall", 1, "#304047", [
    { ...r(8, "RJ45_1G", 1000, false, "ETH"), labels: Array.from({ length: 8 }, (_, index) => `ethernet1/${index + 1}`) },
    { zone: "management", count: 1, type: "RJ45_1G", speed: 1000, poe: false, prefix: "MGT", labels: ["MGT"] },
    { zone: "management", count: 1, type: "USB_MICRO_CONSOLE", speed: 0, poe: false, prefix: "CONSOLE", labels: ["MICRO-USB"] },
    { ...m(1), labels: ["CONSOLE"] },
  ], { inventoryRevision: 1 }),
  p("Palo Alto", "PA-1410 / PA-1420", "Firewall", 1, "#304047", [r(8, "RJ45_1G", 1000, false, "ETH"),
    r(4, "RJ45_MGIG", 5000, true, "ETH"), u(6, "SFP_1G", 1000, "SFP"), u(4, "SFP_PLUS_10G", 10000, "SFP+"),
    { ...m(1), type: "SFP_PLUS_10G", speed: 10000, prefix: "HSCI", labels: ["HSCI"] },
    { ...m(3), type: "RJ45_1G", speed: 1000, prefix: "MGMT", labels: ["HA1-A", "HA1-B", "MGT"] },
    { ...m(1), labels: ["CONSOLE"] }, { ...m(1), type: "USB_MICRO_CONSOLE", labels: ["MICRO-USB"] }], { inventoryRevision: 1 }),
  p("Sophos", "XGS 126 / 136", "Firewall", 1, "#21466a", [
    { ...r(10, "RJ45_1G", 1000, false, "GE"), labels: Array.from({ length: 10 }, (_, index) => String(index + 1)) },
    { ...r(2, "RJ45_1G", 1000, true, "GE"), labels: ["11", "12"] },
    { ...u(2, "SFP_1G", 1000, "SFP"), labels: ["F1", "F2"] },
    { zone: "management", count: 1, type: "Console", speed: 0, poe: false, prefix: "COM", labels: ["COM"] },
    { zone: "management", count: 1, type: "USB_MICRO_CONSOLE", speed: 0, poe: false, prefix: "COM", labels: ["MICRO-USB"] },
  ], { inventoryRevision: 1 }),
  p("Sophos", "XGS 2100 / 2300", "Firewall", 1, "#21466a", [
    { ...r(8, "RJ45_1G", 1000, false, "GE"), labels: Array.from({ length: 8 }, (_, index) => String(index + 1)) },
    { ...u(2, "SFP_1G", 1000, "SFP"), labels: ["F1", "F2"] },
    { zone: "management", count: 1, type: "RJ45_1G", speed: 1000, poe: false, prefix: "MGMT", labels: ["MGMT"] },
    { zone: "management", count: 1, type: "Console", speed: 0, poe: false, prefix: "COM", labels: ["COM"] },
    { zone: "management", count: 1, type: "USB_MICRO_CONSOLE", speed: 0, poe: false, prefix: "COM", labels: ["MICRO-USB"] },
  ], { inventoryRevision: 1 }),
  p("Check Point", "Quantum 6200 / 6600", "Firewall", 1, "#442839", [
    { ...r(8, "RJ45_1G", 1000, false, "GE"), labels: Array.from({ length: 8 }, (_, index) => String(index + 1)) },
    { ...m(1), type: "RJ45_1G", speed: 1000, prefix: "MGMT", labels: ["MGMT"] },
    { ...m(1), type: "RJ45_1G", speed: 1000, prefix: "SYNC", labels: ["SYNC"] },
    { ...m(1), labels: ["CONSOLE"] },
    { ...m(1), type: "USB_C_CONSOLE", labels: ["USB-C"] },
    { ...m(1), type: "RJ45_1G", speed: 1000, prefix: "LOM", labels: ["LOM"] },
  ], { inventoryRevision: 1 }),
];

for (const profile of profiles) {
  profile.family ||= defaultCatalogFamily(profile.category);
  profile.portLayout ||= portLayoutMetadata(profile);
}
export const hardwareCatalog = profiles.sort((left, right) => left.vendor.localeCompare(right.vendor) || left.model.localeCompare(right.model));

const isDedicatedPatchPanelProfile = (profile) =>
  profile.vendor === "Generic Patch" && profile.category === "PatchPanel";

const catalogFamilyLabels = Object.freeze({
  "Access Points": "ACCESS POINTS",
  "Carrier Handoffs": "CARRIER HANDOFFS",
  "Modems & ONTs": "MODEMS & ONTS",
  "Cellular Routers": "LTE / 5G ROUTERS",
  Switches: "SWITCHES",
  Firewalls: "FIREWALLS",
  Routers: "ROUTERS",
  "Servers & Infrastructure": "SERVERS & INFRASTRUCTURE",
});

const catalogFamilyOrder = Object.freeze([
  "Access Points", "Carrier Handoffs", "Modems & ONTs", "Cellular Routers",
  "Switches", "Firewalls", "Routers", "Servers & Infrastructure",
]);

export function catalogFamilies() {
  const profiles = installableProfiles();
  return [
    { id: "all", label: "ALL NETWORK DEVICES", count: profiles.length },
    ...catalogFamilyOrder.filter((family) => profiles.some((profile) => profile.family === family)).map((family) => ({
      id: family,
      label: catalogFamilyLabels[family] || family.toUpperCase(),
      count: profiles.filter((profile) => profile.family === family).length,
    })),
  ];
}

export function catalogVendors(family = "all") {
  return [...new Set(installableProfiles(family).map((profile) => profile.vendor))];
}

export function modelsForVendor(vendor, family = "all") {
  return installableProfiles(family).filter((profile) => profile.vendor === vendor);
}

export function patchPanelProfiles() {
  return hardwareCatalog.filter(isDedicatedPatchPanelProfile);
}

function installableProfiles(family = "all") {
  return hardwareCatalog.filter((profile) => !isDedicatedPatchPanelProfile(profile) && (family === "all" || profile.family === family));
}

function defaultCatalogFamily(category) {
  return {
    AccessPoint: "Access Points",
    Modem: "Modems & ONTs",
    Router: "Routers",
    Switch: "Switches",
    Firewall: "Firewalls",
    Server: "Servers & Infrastructure",
    PatchPanel: "Servers & Infrastructure",
  }[category] || "Servers & Infrastructure";
}

/** Refresh catalog geometry and safely extend known older physical-port inventories. */
export function upgradeInstalledPhysicalPorts(topology) {
  let changed = false;
  for (const device of topology?.devices || []) {
    const profile = hardwareCatalog.find((candidate) =>
      candidate.vendor === device.faceplate?.vendor && candidate.model === device.model);
    if (!profile || (device.faceplate.inventoryRevision || 0) !== (profile.inventoryRevision || 0)) continue;
    // A verified drawing can reuse an already-correct inventory without rewriting saved configuration.
    if (profile.preserveInstalledPorts === true) continue;
    const expected = instantiateProfile(profile, device.name, { x: device.positionX, y: device.positionY }).ports;
    if (upgradeFortiGateSharedPorts(device, expected)) {
      changed = true;
      continue;
    }
    if (expected.length === device.ports.length) {
      const expectedByIndex = new Map(expected.map((port) => [port.portIndex, port]));
      const uniquePorts = new Map();
      for (const port of device.ports) uniquePorts.set(port.portIndex, uniquePorts.has(port.portIndex) ? null : port);
      for (const [portIndex, current] of uniquePorts) {
        const template = expectedByIndex.get(portIndex);
        if (!current || !template) continue;
        const generated = isGeneratedPortLabel(current.label);
        if (generated && current.label !== template.label) {
          current.label = template.label;
          changed = true;
        }
        if (profile.portLayout?.fidelity === "exact" && generated &&
          (current.type !== template.type || current.speedMbps !== template.speedMbps ||
            current.isPoe !== template.isPoe || current.group !== template.group)) {
          current.type = template.type;
          current.speedMbps = template.speedMbps;
          current.isPoe = template.isPoe;
          current.group = template.group;
          changed = true;
        }
        if (profile.portLayout?.fidelity === "exact" &&
          (current.faceplateX !== template.faceplateX || current.faceplateY !== template.faceplateY)) {
          current.faceplateX = template.faceplateX;
          current.faceplateY = template.faceplateY;
          changed = true;
        }
      }
      continue;
    }
    const canRebuildExactPanel = profile.portLayout?.fidelity === "exact" &&
      device.ports.length < expected.length && device.ports.every((port) => isGeneratedPortLabel(port.label));
    if (!canRebuildExactPanel) continue;
    const unmatched = [...device.ports];
    device.ports = expected.map((template, index) => {
      const matchIndex = unmatched.findIndex((port) => port.type === template.type);
      if (matchIndex < 0) {
        return { ...template, id: crypto.randomUUID(), deviceId: device.id, portIndex: index + 1 };
      }
      const [existing] = unmatched.splice(matchIndex, 1);
      return {
        ...existing,
        label: template.label,
        group: template.group,
        faceplateX: template.faceplateX,
        faceplateY: template.faceplateY,
        portIndex: index + 1,
      };
    });
    device.faceplate.totalPorts = device.ports.length;
    changed = true;
  }
  if (changed) topology.linkGroups ||= [];
  return changed;
}

/** Append the four missing 100F copper sockets without renumbering or replacing old ports. */
function upgradeFortiGateSharedPorts(device, expected) {
  if (!/^FortiGate 10[01]F$/.test(device.model) || device.ports.length !== 29 || expected.length !== 33) return false;
  if (!device.ports.every((port, index) => port.type === expected[index].type && port.portIndex === index + 1)) return false;
  for (let index = 0; index < device.ports.length; index++) {
    device.ports[index].faceplateX = expected[index].faceplateX;
    device.ports[index].faceplateY = expected[index].faceplateY;
  }
  device.ports.push(...expected.slice(29).map((port) => ({ ...port, id: crypto.randomUUID(), deviceId: device.id })));
  device.faceplate.totalPorts = device.ports.length;
  return true;
}

/** Validate imported hardware definitions before exposing them in the local catalog. */
export function registerProfiles(input) {
  if (!Array.isArray(input)) throw new Error("Catalog import must be an array of profiles");
  for (const profile of input) {
    const isValid = profile && typeof profile.vendor === "string" && typeof profile.model === "string" &&
      ["Switch", "Firewall", "Router", "PatchPanel", "Server", "Modem", "AccessPoint"].includes(profile.category) &&
      (profile.family === undefined || (typeof profile.family === "string" && profile.family.trim().length >= 1 && profile.family.trim().length <= 60)) &&
      Number.isInteger(profile.units) && profile.units >= 1 && profile.units <= 12 && /^#[0-9a-f]{6}$/i.test(profile.color) &&
      (profile.inventoryRevision === undefined || (Number.isInteger(profile.inventoryRevision) && profile.inventoryRevision >= 0 && profile.inventoryRevision <= 0xffffffff)) &&
      (profile.preserveInstalledPorts === undefined || typeof profile.preserveInstalledPorts === "boolean") &&
      Array.isArray(profile.groups) && profile.groups.every((group) => Number.isInteger(group.count) && group.count > 0 &&
        ["access", "uplink", "management"].includes(group.zone) &&
        ["RJ45_1G", "RJ45_MGIG", "RJ45_10G", "DSL_RJ11", "POTS_RJ11", "COAX_F", "SFP_1G", "SFP_PLUS_10G", "SFP28_25G", "SFP56_50G", "QSFP_PLUS_40G", "QSFP28_100G", "QSFP56_200G", "QSFP_DD_200G", "QSFP_DD_400G", "CFP_100G", "CFP2_100G", "CFP4_100G", "OSFP_800G", "FIBER_LC", "FIBER_SC", "FIBER_MPO", "SAS_MINI_HD_12G", "SAS_MINI_6G", "FC_SFP_16G", "USB_MINI_CONSOLE", "USB_MICRO_CONSOLE", "USB_C_CONSOLE", "Stack", "Console", "Power"].includes(group.type) &&
        Number.isFinite(group.speed) && group.speed >= 0 && group.speed <= 800000 &&
        (group.labels === undefined || (Array.isArray(group.labels) && group.labels.length === group.count && group.labels.every((label) => typeof label === "string" && label.trim()))) &&
        (group.positions === undefined || (Array.isArray(group.positions) && group.positions.length === group.count &&
          group.positions.every((position) => Number.isFinite(position?.x) && position.x >= .02 && position.x <= .98 &&
            Number.isFinite(position?.y) && position.y >= .05 && position.y <= .95))));
    if (!isValid) throw new Error(`Invalid hardware profile: ${profile?.vendor || "unknown"} ${profile?.model || "model"}`);
    profile.family = String(profile.family || defaultCatalogFamily(profile.category)).trim();
    profile.layout ||= profile.vendor.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    profile.portLayout ||= portLayoutMetadata(profile);
    hardwareCatalog.push(profile);
  }
  hardwareCatalog.sort((left, right) => left.vendor.localeCompare(right.vendor) || left.model.localeCompare(right.model));
  return input.length;
}

/** Instantiate catalog groups while preserving stable inventory indices for added shared media. */
export function instantiateProfile(profile, name, position) {
  const groups = resolvePhysicalPortGroups(profile);
  const accessGroups = groups.filter((group) => group.zone === "access" && !group.inventoryAppend);
  const appendedGroups = groups.filter((group) => group.inventoryAppend);
  const uplinkGroups = groups.filter((group) => group.zone === "uplink");
  const managementGroups = groups.filter((group) => group.zone === "management");
  const managementCount = managementGroups.reduce((sum, group) => sum + group.count, 0);
  const denseManagement = managementCount > 2;
  const ports = [
    ...layoutGroups([...accessGroups, ...uplinkGroups], denseManagement ? .34 : .29, .955),
    ...layoutGroups(managementGroups, denseManagement ? .22 : .18, denseManagement ? .31 : .275, 2),
    ...layoutGroups(appendedGroups, .86, .94),
  ].map((port, index) => {
    const passive = profile.category === "PatchPanel" || ["Console", "Power", "POTS_RJ11", "USB_MINI_CONSOLE", "USB_MICRO_CONSOLE", "USB_C_CONSOLE", "Stack", "SAS_MINI_HD_12G", "SAS_MINI_6G", "FC_SFP_16G"].includes(port.type);
    return {
      id: "", deviceId: "", portIndex: index + 1, label: port.label, type: port.type,
      mode: passive ? "Unconfigured" : "Access", nativeVlan: passive ? 0 : 1,
      allowedVlans: [], speedMbps: port.speed, isPoe: port.poe, status: "down", group: port.group,
      faceplateX: port.x, faceplateY: port.y,
    };
  });
  return {
    id: "", name: name || profile.model, category: profile.category, model: profile.model,
    positionX: position.x, positionY: position.y,
    faceplate: {
      unitsU: profile.units, totalPorts: ports.length, rows: 2, portSpacingX: 23, portSpacingY: 29,
      vendorColor: profile.color, hasSfpSlots: groups.some((group) => group.type.includes("SFP") || group.type.includes("QSFP")),
      vendor: profile.vendor, layout: profile.layout,
      inventoryRevision: profile.inventoryRevision || 0,
    },
    ports,
  };
}

const staticServerMedia = {
  "1g-rj45": { type: "RJ45_1G", speed: 1000, group: "1G BASE-T" },
  "2.5g-rj45": { type: "RJ45_MGIG", speed: 2500, group: "2.5G BASE-T" },
  "10g-rj45": { type: "RJ45_10G", speed: 10000, group: "10G BASE-T" },
  "10g-sfp": { type: "SFP_PLUS_10G", speed: 10000, group: "10G SFP+" },
  "25g-sfp": { type: "SFP28_25G", speed: 25000, group: "25G SFP28" },
  "100g-qsfp": { type: "QSFP28_100G", speed: 100000, group: "100G QSFP28" },
};

export function instantiateStaticServer(input, position) {
  const nicCount = Number(input.nicCount);
  const units = Number(input.units);
  const media = staticServerMedia[input.media];
  if (!Number.isInteger(nicCount) || nicCount < 1 || nicCount > 16) {
    throw new Error("Server NIC count must be between 1 and 16");
  }
  if (!Number.isInteger(units) || units < 1 || units > 4) {
    throw new Error("Server rack height must be between 1U and 4U");
  }
  if (!media) throw new Error("Select a supported server NIC medium");

  const groups = [{
    zone: "access", count: nicCount, type: media.type, speed: media.speed,
    poe: false, prefix: "NIC", group: media.group,
  }];
  if (input.includeBMC) {
    groups.push({
      zone: "management", count: 1, type: "RJ45_1G", speed: 1000,
      poe: false, prefix: "BMC", group: "OUT-OF-BAND",
    });
  }
  return instantiateProfile({
    vendor: "Static", model: String(input.model || "Generic rack server"),
    category: "Server", units, color: String(input.color || "#30383b"),
    layout: "static-server", groups,
  }, String(input.name || "SERVER"), position);
}

function layoutGroups(groups, x1, x2, maxColumns = 16) {
  const total = groups.reduce((sum, group) => sum + group.count, 0);
  if (!total) return [];
  const rows = Math.min(3, Math.ceil(total / maxColumns));
  const columns = Math.ceil(total / rows);
  const result = [];
  let globalIndex = 0;
  for (const group of groups) {
    for (let index = 0; index < group.count; index += 1) {
      const row = globalIndex % rows;
      const column = Math.floor(globalIndex / rows);
      result.push({
        label: group.labels?.[index] || `${group.prefix || ""}${index + 1}`,
        type: group.type,
        speed: group.speed,
        poe: group.poe,
        group: group.prefix || group.zone,
        x: group.positions?.[index]?.x ?? (columns === 1 ? (x1 + x2) / 2 : x1 + (x2 - x1) * column / (columns - 1)),
        y: group.positions?.[index]?.y ?? (rows === 1 ? .55 : .25 + row * .6 / (rows - 1)),
      });
      globalIndex += 1;
    }
  }
  return result;
}

/** Build a catalog definition with a persistent revision for its port-index namespace. */
function p(vendor, model, category, units, color, groups, extra = {}) {
  const profile = { vendor, model, category, units, color, groups, inventoryRevision: extra.inventoryRevision || 0,
    layout: vendor.toLowerCase().replace(/[^a-z0-9]+/g, "-") };
  Object.assign(profile, { portLayout: portLayoutMetadata(profile) });
  return profile;
}
function r(count, type, speed, poe, prefix = "") { return { zone: "access", count, type, speed, poe, prefix }; }
function u(count, type, speed, prefix = "") { return { zone: "uplink", count, type, speed, poe: false, prefix }; }
function m(count) { return { zone: "management", count, type: "Console", speed: 0, poe: false, prefix: "CONSOLE" }; }

function isGeneratedPortLabel(label) {
  return /^(?:\d+|(?:GE|PORT|SFP\+?|SFP28|SFP56|QSFP\+?|QSFP28|QSFP56|QSFP-DD|MGMT|CONSOLE|SHARED|ETH|10GE|MGIG|2\.5GE|5GE)(?:\d+)?)$/i.test(String(label || ""));
}
