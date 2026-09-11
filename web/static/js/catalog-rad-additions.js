/** Manufacturer content for the original plastic ETX-203AX configuration, publicly mirrored by ITFOR. */
export const radAdditionSource = "https://www.itfor.co.jp/it-infra/telecom-carrier/rad/RAD_PDF/ETX-203AX.pdf";

/** Define an explicit source-labelled group without assigning optional optics. */
function group(zone, type, speed, labels) { return { zone, type, speed, labels, count: labels.length, prefix: "", poe: false }; }

/** Raw new catalog row; the shared catalog owns registration and inventory construction. */
export const radAdditionProfiles = [{
  vendor: "RAD", model: "ETX-203AX", sku: "ETX-203AX/GE/2SFP/2SFP2UTP", category: "Router", units: 1,
  color: "#eef1ee", inventoryRevision: 1, preserveInstalledPorts: true, fidelity: "verified", layout: "rad-additions",
  source: radAdditionSource,
  note: "Original plastic ETX-203AX/GE/2SFP/2SFP2UTP: network SFP1/2, user copper3/4 and SFP5/6, 1Gbps GE license, separate10/100 MNG-ETH and RJ45 CONTROL. Universal supply used on AC, no optics. One unit on a schematic19-inch rack shelf; RM-33-2 compatibility is documented, but exact kit geometry is not claimed.",
  groups: [group("access", "RJ45_1G", 1000, ["3", "4"]), group("uplink", "SFP_1G", 1000, ["1", "2", "5", "6"]),
    group("management", "RJ45_1G", 100, ["MNG-ETH"]), group("management", "Console", 0, ["CONTROL"])],
}];
