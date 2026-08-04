// Sourced edge and wireless endpoints. These profiles use the same physical
// connector schema as rack equipment, so every WAN, LAN, console, and service
// handoff remains an independently cableable topology endpoint.

const SOURCE = Object.freeze({
  ciscoAP: "https://www.cisco.com/c/en/us/products/collateral/wireless/catalyst-9166-series-access-points/catalyst-9166-series-access-points-ds.html",
  arubaAP: "https://www.hpe.com/us/en/collaterals/collateral.a50002582enw.html",
  fortinetAP: "https://docs.fortinet.com/document/fortiap/7.0.0/secure-wireless-concept-guide/538598/fortiap-wi-fi-6-standard-and-utp-access-points",
  ubiquitiAP: "https://techspecs.ui.com/unifi/wifi/u7-pro",
  adtranNID: "https://www.adtran.com/-/media/adtran/resources/data-sheets/pdfs/fsp-150-ge-104-e.pdf",
  ubiquitiCable: "https://techspecs.ui.com/unifi/integrations/uci",
  fortiExtender: "https://docs.fortinet.com/document/fortiextender/7.2.2/admin-guide-standalone/705422/interface-management",
  teltonikaRUTX50: "https://wiki.teltonika-networks.com/view/RUTX50_Interfaces",
  ciscoIR1101: "https://www.cisco.com/c/en/us/products/collateral/routers/1101-industrial-integrated-services-router/datasheet-c78-741709.html",
  genericEdge: "https://www.broadband-forum.org/projects/architecture-and-migration/",
});

const FAMILIES = Object.freeze({
  accessPoints: "Access Points",
  carrier: "Carrier Handoffs",
  modems: "Modems & ONTs",
  cellular: "Cellular Routers",
});

const group = (zone, type, speed, labels, prefix = "") => ({
  zone, count: labels.length, type, speed, labels, prefix, poe: false,
});

function profile(vendor, model, category, family, color, groups, source, note, extra = {}) {
  return {
    vendor, model, category, family, units: extra.units || 1, color, groups,
    layout: extra.layout || `edge-${family.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    fidelity: extra.fidelity || "exact",
    placement: extra.placement || "edge / shelf",
    source,
    note,
  };
}

const profiles = [
  profile("Generic Edge", "Ceiling access point · 1G PoE", "AccessPoint", FAMILIES.accessPoints, "#e4e7e4", [
    group("access", "RJ45_1G", 1000, ["ETH0"]),
  ], SOURCE.genericEdge, "Generic single-uplink ceiling or wall access point.", { fidelity: "generic", placement: "ceiling / wall" }),
  profile("Generic Edge", "Resilient access point · dual 2.5G", "AccessPoint", FAMILIES.accessPoints, "#dfe5e2", [
    group("access", "RJ45_MGIG", 2500, ["ETH0", "ETH1"]),
  ], SOURCE.genericEdge, "Generic dual-uplink access point for redundant access switching.", { fidelity: "generic", placement: "ceiling / wall" }),
  profile("Cisco", "Catalyst 9166I", "AccessPoint", FAMILIES.accessPoints, "#e5e8e7", [
    group("access", "RJ45_MGIG", 5000, ["2.5/5G PoE"]),
    group("management", "Console", 0, ["CONSOLE"]),
  ], SOURCE.ciscoAP, "Vendor-documented multigigabit uplink and RJ45 management console.", { placement: "ceiling / wall" }),
  profile("HPE Aruba", "AP-635", "AccessPoint", FAMILIES.accessPoints, "#e7e9e5", [
    group("access", "RJ45_MGIG", 2500, ["E0", "E1"]),
  ], SOURCE.arubaAP, "Vendor-documented dual 2.5G Ethernet interfaces.", { placement: "ceiling / wall" }),
  profile("Fortinet", "FortiAP 231F", "AccessPoint", FAMILIES.accessPoints, "#e5e7e4", [
    group("access", "RJ45_1G", 1000, ["ETH0", "ETH1"]),
  ], SOURCE.fortinetAP, "Vendor-documented dual 1G Ethernet uplinks.", { placement: "ceiling / wall" }),
  profile("Ubiquiti", "UniFi U7 Pro", "AccessPoint", FAMILIES.accessPoints, "#ebedeb", [
    group("access", "RJ45_MGIG", 2500, ["2.5 GbE"]),
  ], SOURCE.ubiquitiAP, "Vendor-documented single 2.5 GbE PoE+ uplink.", { placement: "ceiling / wall" }),

  profile("Generic Edge", "Copper Ethernet handoff", "Modem", FAMILIES.carrier, "#27383d", [
    group("uplink", "RJ45_1G", 1000, ["NNI"]),
    group("access", "RJ45_1G", 1000, ["UNI"]),
  ], SOURCE.genericEdge, "Two-port copper carrier demarcation with explicit network and user sides.", { fidelity: "generic" }),
  profile("Generic Edge", "1G fiber Ethernet handoff", "Modem", FAMILIES.carrier, "#26383d", [
    group("uplink", "SFP_1G", 1000, ["NNI"]),
    group("access", "SFP_1G", 1000, ["UNI"]),
  ], SOURCE.genericEdge, "Two-port optical carrier demarcation.", { fidelity: "generic" }),
  profile("Generic Edge", "10G fiber Ethernet handoff", "Modem", FAMILIES.carrier, "#23363d", [
    group("uplink", "SFP_PLUS_10G", 10000, ["NNI"]),
    group("access", "SFP_PLUS_10G", 10000, ["UNI"]),
  ], SOURCE.genericEdge, "Two-port 10G optical carrier demarcation.", { fidelity: "generic" }),
  profile("ADTRAN", "FSP 150-GE104", "Modem", FAMILIES.carrier, "#29383b", [
    group("access", "RJ45_1G", 1000, ["UNI1", "UNI2", "UNI3", "UNI4"]),
    group("uplink", "SFP_1G", 1000, ["NNI1", "NNI2"]),
    group("management", "RJ45_1G", 1000, ["MGMT"]),
  ], SOURCE.adtranNID, "Family-equivalent carrier Ethernet demarcation; verify the exact GE104 variant.", { fidelity: "family" }),

  profile("Generic Edge", "DOCSIS 3.1 cable modem", "Modem", FAMILIES.modems, "#30393c", [
    group("uplink", "COAX_F", 2500, ["CABLE"]),
    group("access", "RJ45_MGIG", 2500, ["LAN"]),
  ], SOURCE.genericEdge, "Generic DOCSIS modem with a real F-type coax service input.", { fidelity: "generic" }),
  profile("Ubiquiti", "UniFi Cable Internet", "Modem", FAMILIES.modems, "#e6e9e7", [
    group("uplink", "COAX_F", 2500, ["DOCSIS"]),
    group("access", "RJ45_MGIG", 2500, ["2.5 GbE"]),
  ], SOURCE.ubiquitiCable, "Vendor-documented DOCSIS 3.1 interface and 2.5 GbE handoff.", { placement: "rack / shelf" }),
  profile("Generic Edge", "VDSL2 modem", "Modem", FAMILIES.modems, "#323b3e", [
    group("uplink", "DSL_RJ11", 300, ["DSL"]),
    group("access", "RJ45_1G", 1000, ["LAN1", "LAN2", "LAN3", "LAN4"]),
  ], SOURCE.genericEdge, "Generic VDSL2 copper modem with four Ethernet ports.", { fidelity: "generic" }),
  profile("Generic Edge", "GPON ONT · 4×GE", "Modem", FAMILIES.modems, "#eef0ed", [
    group("uplink", "FIBER_SC", 2500, ["PON"]),
    group("access", "RJ45_1G", 1000, ["LAN1", "LAN2", "LAN3", "LAN4"]),
  ], SOURCE.genericEdge, "Generic GPON optical network terminal.", { fidelity: "generic" }),
  profile("Generic Edge", "XGS-PON ONT · 10GE", "Modem", FAMILIES.modems, "#ecefeb", [
    group("uplink", "FIBER_SC", 10000, ["PON"]),
    group("access", "RJ45_10G", 10000, ["10GE"]),
  ], SOURCE.genericEdge, "Generic XGS-PON optical network terminal.", { fidelity: "generic" }),

  profile("Generic Edge", "LTE router · 4×LAN", "Router", FAMILIES.cellular, "#363d3e", [
    group("uplink", "RJ45_1G", 1000, ["WAN"]),
    group("access", "RJ45_1G", 1000, ["LAN1", "LAN2", "LAN3", "LAN4"]),
  ], SOURCE.genericEdge, "Generic LTE edge router with wired WAN failover.", { fidelity: "generic", placement: "wall / DIN / shelf" }),
  profile("Generic Edge", "5G router · dual WAN", "Router", FAMILIES.cellular, "#333b3e", [
    group("uplink", "RJ45_1G", 1000, ["WAN1"]),
    group("uplink", "SFP_1G", 1000, ["WAN2"]),
    group("access", "RJ45_1G", 1000, ["LAN1", "LAN2", "LAN3", "LAN4"]),
  ], SOURCE.genericEdge, "Generic 5G router with copper and optical WAN failover.", { fidelity: "generic", placement: "wall / DIN / shelf" }),
  profile("Fortinet", "FortiExtender 511F", "Router", FAMILIES.cellular, "#dfe2df", [
    group("access", "RJ45_1G", 1000, ["LAN1", "LAN2", "LAN3", "LAN4/PoE"]),
    group("uplink", "RJ45_1G", 1000, ["WAN"]),
    group("uplink", "SFP_1G", 1000, ["SFP WAN"]),
  ], SOURCE.fortiExtender, "Vendor-documented four LAN ports, Ethernet WAN, and 1G SFP WAN.", { placement: "wall / shelf" }),
  profile("Teltonika Networks", "RUTX50", "Router", FAMILIES.cellular, "#2d3d40", [
    group("uplink", "RJ45_1G", 1000, ["WAN"]),
    group("access", "RJ45_1G", 1000, ["LAN1", "LAN2", "LAN3", "LAN4"]),
  ], SOURCE.teltonikaRUTX50, "Vendor-documented 1× WAN and 4× LAN Ethernet layout.", { placement: "DIN / shelf" }),
  profile("Cisco", "Catalyst IR1101", "Router", FAMILIES.cellular, "#263b4b", [
    group("access", "RJ45_1G", 100, ["FE1", "FE2", "FE3", "FE4"]),
    group("uplink", "RJ45_1G", 1000, ["GE WAN"]),
    group("uplink", "SFP_1G", 1000, ["SFP WAN"]),
    group("management", "USB_MICRO_CONSOLE", 0, ["CONSOLE"]),
  ], SOURCE.ciscoIR1101, "Base-platform Ethernet and combo WAN interfaces; cellular radio is modular.", { fidelity: "family", placement: "DIN / wall" }),
];

export const edgeCatalogProfiles = Object.freeze(profiles);
export const edgeCatalogSources = SOURCE;
export const edgeCatalogFamilies = FAMILIES;
