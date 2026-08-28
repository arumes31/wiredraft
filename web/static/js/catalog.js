import { fortinetProfiles } from "./catalog-fortinet.js";
import { edgeCatalogProfiles } from "./catalog-edge.js";
import { expandedCatalogProfiles } from "./catalog-expanded.js";
import { portLayoutMetadata, resolvePhysicalPortGroups } from "./catalog-port-layouts.js";

// The built-in catalog is an offline front-panel schematic library. Profiles are
// data, not renderer branches, so new SKUs can be added without changing Canvas.
const profiles = [
  ...fortinetProfiles,
  ...edgeCatalogProfiles,
  ...expandedCatalogProfiles,

  p("Cisco", "Catalyst C9200L-24T-4G", "Switch", 1, "#263b4b", [r(24, "RJ45_1G", 1000, false), u(4, "SFP_1G", 1000, "SFP"), m(1)]),
  p("Cisco", "Catalyst C9200L-24P-4X", "Switch", 1, "#263b4b", [r(24, "RJ45_1G", 1000, true), u(4, "SFP_PLUS_10G", 10000, "SFP+"), m(1)]),
  p("Cisco", "Catalyst C9200L-48T-4G", "Switch", 1, "#263b4b", [r(48, "RJ45_1G", 1000, false), u(4, "SFP_1G", 1000, "SFP"), m(1)]),
  p("Cisco", "Catalyst C9200L-48P-4X", "Switch", 1, "#263b4b", [r(48, "RJ45_1G", 1000, true), u(4, "SFP_PLUS_10G", 10000, "SFP+"), m(1)]),
  p("Cisco", "Catalyst C9300L-24T-4G", "Switch", 1, "#263b4b", [r(24, "RJ45_1G", 1000, false), u(4, "SFP_1G", 1000, "SFP"), m(1)]),
  p("Cisco", "Catalyst C9300L-48P-4X", "Switch", 1, "#263b4b", [r(48, "RJ45_1G", 1000, true), u(4, "SFP_PLUS_10G", 10000, "SFP+"), m(1)]),
  p("Cisco", "Catalyst C9300X-24Y", "Switch", 1, "#263b4b", [u(24, "SFP28_25G", 25000, "SFP28"), u(8, "QSFP28_100G", 100000, "QSFP"), m(1)]),
  p("Cisco", "Nexus 93180YC-FX3", "Switch", 1, "#263b4b", [u(48, "SFP28_25G", 25000, "SFP28"), u(6, "QSFP28_100G", 100000, "QSFP"), m(1)]),
  p("Cisco", "Nexus 9336C-FX2", "Switch", 1, "#263b4b", [u(36, "QSFP28_100G", 100000, "QSFP"), m(1)]),
  p("Cisco", "Meraki MS120-24P", "Switch", 1, "#263b4b", [r(24, "RJ45_1G", 1000, true), u(4, "SFP_1G", 1000, "SFP"), m(1)]),
  p("Cisco", "Meraki MS225-48FP", "Switch", 1, "#263b4b", [r(48, "RJ45_1G", 1000, true), u(4, "SFP_PLUS_10G", 10000, "SFP+"), m(1)]),

  p("HPE Aruba", "CX 6100 24G 4SFP+", "Switch", 1, "#27383a", [r(24, "RJ45_1G", 1000, false), u(4, "SFP_PLUS_10G", 10000, "SFP+"), m(1)]),
  p("HPE Aruba", "CX 6100 48G 4SFP+", "Switch", 1, "#27383a", [r(48, "RJ45_1G", 1000, false), u(4, "SFP_PLUS_10G", 10000, "SFP+"), m(1)]),
  p("HPE Aruba", "CX 6200F 24G 4SFP+", "Switch", 1, "#27383a", [r(24, "RJ45_1G", 1000, true), u(4, "SFP_PLUS_10G", 10000, "SFP+"), m(1)]),
  p("HPE Aruba", "CX 6200F 48G 4SFP+", "Switch", 1, "#27383a", [r(48, "RJ45_1G", 1000, true), u(4, "SFP_PLUS_10G", 10000, "SFP+"), m(1)]),
  p("HPE Aruba", "CX 6300M 24-port Smart Rate", "Switch", 1, "#27383a", [r(24, "RJ45_10G", 10000, true), u(4, "SFP56_50G", 50000, "SFP56"), m(1)]),
  p("HPE Aruba", "CX 6300M 48G", "Switch", 1, "#27383a", [r(48, "RJ45_1G", 1000, true), u(4, "SFP56_50G", 50000, "SFP56"), m(1)]),
  p("HPE Aruba", "CX 8325-48Y8C", "Switch", 1, "#27383a", [u(48, "SFP28_25G", 25000, "SFP28"), u(8, "QSFP28_100G", 100000, "QSFP"), m(1)]),

  p("Juniper", "EX2300-24T", "Switch", 1, "#243b31", [r(24, "RJ45_1G", 1000, false), u(4, "SFP_PLUS_10G", 10000, "SFP+"), m(1)]),
  p("Juniper", "EX2300-48P", "Switch", 1, "#243b31", [r(48, "RJ45_1G", 1000, true), u(4, "SFP_PLUS_10G", 10000, "SFP+"), m(1)]),
  p("Juniper", "EX3400-24P", "Switch", 1, "#243b31", [r(24, "RJ45_1G", 1000, true), u(4, "SFP_PLUS_10G", 10000, "SFP+"), u(2, "QSFP28_100G", 40000, "QSFP+"), m(1)]),
  p("Juniper", "EX4400-48P", "Switch", 1, "#243b31", [r(48, "RJ45_1G", 1000, true), u(4, "SFP28_25G", 25000, "SFP28"), m(1)]),
  p("Juniper", "EX4650-48Y", "Switch", 1, "#243b31", [u(48, "SFP28_25G", 25000, "SFP28"), u(8, "QSFP28_100G", 100000, "QSFP"), m(1)]),

  p("Ubiquiti", "UniFi Standard 24", "Switch", 1, "#879296", [r(24, "RJ45_1G", 1000, false), u(2, "SFP_1G", 1000, "SFP")]),
  p("Ubiquiti", "UniFi Standard 48 PoE", "Switch", 1, "#879296", [r(48, "RJ45_1G", 1000, true), u(4, "SFP_1G", 1000, "SFP")]),
  p("Ubiquiti", "UniFi Pro Max 24 PoE", "Switch", 1, "#879296", [r(24, "RJ45_10G", 2500, true), u(2, "SFP_PLUS_10G", 10000, "SFP+")]),
  p("Ubiquiti", "UniFi Pro Max 48 PoE", "Switch", 1, "#879296", [r(48, "RJ45_10G", 2500, true), u(4, "SFP_PLUS_10G", 10000, "SFP+")]),
  p("Ubiquiti", "UniFi Pro XG 24 PoE", "Switch", 1, "#879296", [r(16, "RJ45_10G", 10000, true, "10G"), r(8, "RJ45_10G", 2500, true, "2.5G"), u(2, "SFP28_25G", 25000, "SFP28")]),
  p("Ubiquiti", "UniFi Pro XG 48 PoE", "Switch", 1, "#879296", [r(32, "RJ45_10G", 10000, true, "10G"), r(16, "RJ45_10G", 2500, true, "2.5G"), u(4, "SFP28_25G", 25000, "SFP28")]),
  p("Ubiquiti", "UniFi Enterprise Campus Aggregation", "Switch", 1, "#879296", [u(48, "SFP28_25G", 25000, "SFP28"), u(6, "QSFP28_100G", 100000, "QSFP")]),

  p("MikroTik", "CRS326-24G-2S+RM", "Switch", 1, "#e1e4e1", [r(24, "RJ45_1G", 1000, false), u(2, "SFP_PLUS_10G", 10000, "SFP+"), m(1)]),
  p("MikroTik", "CRS328-24P-4S+RM", "Switch", 1, "#e1e4e1", [r(24, "RJ45_1G", 1000, true), u(4, "SFP_PLUS_10G", 10000, "SFP+"), m(1)]),
  p("MikroTik", "CRS354-48G-4S+2Q+RM", "Switch", 1, "#e1e4e1", [r(48, "RJ45_1G", 1000, false), u(4, "SFP_PLUS_10G", 10000, "SFP+"), u(2, "QSFP28_100G", 40000, "QSFP+"), m(1)]),
  p("MikroTik", "CRS317-1G-16S+RM", "Switch", 1, "#e1e4e1", [r(1, "RJ45_1G", 1000, false), u(16, "SFP_PLUS_10G", 10000, "SFP+"), m(1)]),
  p("MikroTik", "CRS518-16XS-2XQ-RM", "Switch", 1, "#e1e4e1", [u(16, "SFP28_25G", 25000, "SFP28"), u(2, "QSFP28_100G", 100000, "QSFP"), m(1)]),

  p("Dell", "PowerSwitch N3248TE-ON", "Switch", 1, "#1d3d50", [r(48, "RJ45_1G", 1000, false), u(6, "QSFP28_100G", 100000, "QSFP"), m(1)]),
  p("Dell", "PowerSwitch S4148F-ON", "Switch", 1, "#1d3d50", [u(48, "SFP_PLUS_10G", 10000, "SFP+"), u(6, "QSFP28_100G", 100000, "QSFP"), m(1)]),
  p("Dell", "PowerSwitch S5248F-ON", "Switch", 1, "#1d3d50", [u(48, "SFP28_25G", 25000, "SFP28"), u(6, "QSFP28_100G", 100000, "QSFP"), m(1)]),

  p("NETGEAR", "M4300-28G", "Switch", 1, "#30284a", [r(24, "RJ45_1G", 1000, false), u(4, "SFP_PLUS_10G", 10000, "SFP+"), m(1)]),
  p("NETGEAR", "M4300-52G", "Switch", 1, "#30284a", [r(48, "RJ45_1G", 1000, false), u(4, "SFP_PLUS_10G", 10000, "SFP+"), m(1)]),
  p("NETGEAR", "M4250-26G4F-PoE+", "Switch", 1, "#30284a", [r(24, "RJ45_1G", 1000, true), u(4, "SFP_1G", 1000, "SFP"), m(1)]),

  p("TP-Link Omada", "SG3428X", "Switch", 1, "#24442d", [r(24, "RJ45_1G", 1000, false), u(4, "SFP_PLUS_10G", 10000, "SFP+"), m(1)]),
  p("TP-Link Omada", "SG3452XP", "Switch", 1, "#24442d", [r(48, "RJ45_1G", 1000, true), u(4, "SFP_PLUS_10G", 10000, "SFP+"), m(1)]),
  p("TP-Link Omada", "SX6632YF", "Switch", 1, "#24442d", [u(24, "SFP28_25G", 25000, "SFP28"), u(8, "QSFP28_100G", 100000, "QSFP"), m(1)]),

  p("Arista", "7050SX3-48YC8", "Switch", 1, "#21363f", [u(48, "SFP28_25G", 25000, "SFP28"), u(8, "QSFP28_100G", 100000, "QSFP"), m(1)]),
  p("Arista", "7060CX2-32S", "Switch", 1, "#21363f", [u(32, "QSFP28_100G", 100000, "QSFP"), u(2, "SFP_PLUS_10G", 10000, "SFP+"), m(1)]),
  p("Arista", "720XP-48ZC2", "Switch", 1, "#21363f", [r(48, "RJ45_10G", 5000, true, "MGE"), u(2, "QSFP28_100G", 100000, "QSFP"), m(1)]),

  p("Extreme", "5320-24P-8XE", "Switch", 1, "#392644", [r(24, "RJ45_1G", 1000, true), u(8, "SFP_PLUS_10G", 10000, "SFP+"), m(1)]),
  p("Extreme", "5520-48W", "Switch", 1, "#392644", [r(48, "RJ45_10G", 2500, true, "MGE"), u(4, "SFP28_25G", 25000, "SFP28"), m(1)]),
  p("Extreme", "VSP 7400-48Y-8C", "Switch", 1, "#392644", [u(48, "SFP28_25G", 25000, "SFP28"), u(8, "QSFP28_100G", 100000, "QSFP"), m(1)]),

  p("Ruckus", "ICX 7150-24P", "Switch", 1, "#4b3520", [r(24, "RJ45_1G", 1000, true), u(4, "SFP_PLUS_10G", 10000, "SFP+"), m(1)]),
  p("Ruckus", "ICX 7150-48P", "Switch", 1, "#4b3520", [r(48, "RJ45_1G", 1000, true), u(4, "SFP_PLUS_10G", 10000, "SFP+"), m(1)]),
  p("Ruckus", "ICX 7550-48ZP", "Switch", 1, "#4b3520", [r(48, "RJ45_10G", 2500, true, "MGE"), u(8, "SFP28_25G", 25000, "SFP28"), m(1)]),

  p("Palo Alto", "PA-440 / PA-450", "Firewall", 1, "#304047", [r(8, "RJ45_1G", 1000, false, "ETH"), m(2)]),
  p("Palo Alto", "PA-1410 / PA-1420", "Firewall", 1, "#304047", [r(12, "RJ45_1G", 1000, false, "ETH"), u(4, "SFP_PLUS_10G", 10000, "SFP+"), m(2)]),
  p("Sophos", "XGS 126 / 136", "Firewall", 1, "#21466a", [r(10, "RJ45_1G", 1000, false, "GE"), u(2, "SFP_1G", 1000, "SFP"), m(2)]),
  p("Sophos", "XGS 2100 / 2300", "Firewall", 1, "#21466a", [r(8, "RJ45_1G", 1000, false, "GE"), u(2, "SFP_PLUS_10G", 10000, "SFP+"), m(2)]),
  p("Check Point", "Quantum 6200 / 6600", "Firewall", 1, "#442839", [r(8, "RJ45_1G", 1000, false, "GE"), u(4, "SFP_PLUS_10G", 10000, "SFP+"), m(2)]),
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

export function upgradeInstalledPhysicalPorts(topology) {
  let changed = false;
  for (const device of topology?.devices || []) {
    const profile = hardwareCatalog.find((candidate) =>
      candidate.vendor === device.faceplate?.vendor && candidate.model === device.model);
    if (!profile) continue;
    const expected = instantiateProfile(profile, device.name, { x: device.positionX, y: device.positionY }).ports;
    if (expected.length === device.ports.length) {
      for (let index = 0; index < expected.length; index += 1) {
        const current = device.ports[index];
        if (isGeneratedPortLabel(current.label) && current.label !== expected[index].label) {
          current.label = expected[index].label;
          changed = true;
        }
        if (profile.portLayout?.fidelity === "exact" &&
          (current.faceplateX !== expected[index].faceplateX || current.faceplateY !== expected[index].faceplateY)) {
          current.faceplateX = expected[index].faceplateX;
          current.faceplateY = expected[index].faceplateY;
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

export function registerProfiles(input) {
  if (!Array.isArray(input)) throw new Error("Catalog import must be an array of profiles");
  for (const profile of input) {
    const isValid = profile && typeof profile.vendor === "string" && typeof profile.model === "string" &&
      ["Switch", "Firewall", "Router", "PatchPanel", "Server", "Modem", "AccessPoint"].includes(profile.category) &&
      (profile.family === undefined || (typeof profile.family === "string" && profile.family.trim().length >= 1 && profile.family.trim().length <= 60)) &&
      Number.isInteger(profile.units) && profile.units >= 1 && profile.units <= 12 && /^#[0-9a-f]{6}$/i.test(profile.color) &&
      Array.isArray(profile.groups) && profile.groups.every((group) => Number.isInteger(group.count) && group.count > 0 &&
        ["access", "uplink", "management"].includes(group.zone) &&
        ["RJ45_1G", "RJ45_MGIG", "RJ45_10G", "DSL_RJ11", "COAX_F", "SFP_1G", "SFP_PLUS_10G", "SFP28_25G", "SFP56_50G", "QSFP_PLUS_40G", "QSFP28_100G", "QSFP56_200G", "QSFP_DD_400G", "CFP_100G", "CFP2_100G", "CFP4_100G", "OSFP_800G", "FIBER_LC", "FIBER_SC", "FIBER_MPO", "USB_MICRO_CONSOLE", "USB_C_CONSOLE", "Stack", "Console", "Power"].includes(group.type) &&
        Number.isFinite(group.speed) && group.speed >= 0 && group.speed <= 800000 &&
        (group.labels === undefined || (Array.isArray(group.labels) && group.labels.length === group.count && group.labels.every((label) => typeof label === "string" && label.trim()))));
    if (!isValid) throw new Error(`Invalid hardware profile: ${profile?.vendor || "unknown"} ${profile?.model || "model"}`);
    profile.family = String(profile.family || defaultCatalogFamily(profile.category)).trim();
    profile.layout ||= profile.vendor.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    profile.portLayout ||= portLayoutMetadata(profile);
    hardwareCatalog.push(profile);
  }
  hardwareCatalog.sort((left, right) => left.vendor.localeCompare(right.vendor) || left.model.localeCompare(right.model));
  return input.length;
}

export function instantiateProfile(profile, name, position) {
  const groups = resolvePhysicalPortGroups(profile);
  const accessGroups = groups.filter((group) => group.zone === "access");
  const uplinkGroups = groups.filter((group) => group.zone === "uplink");
  const managementGroups = groups.filter((group) => group.zone === "management");
  const ports = [
    ...layoutGroups(accessGroups, .29, .79),
    ...layoutGroups(uplinkGroups, .83, .955),
    ...layoutGroups(managementGroups, .18, .275),
  ].map((port, index) => {
    const passive = profile.category === "PatchPanel" || ["Console", "Power", "USB_MICRO_CONSOLE", "USB_C_CONSOLE", "Stack"].includes(port.type);
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

function layoutGroups(groups, x1, x2) {
  const total = groups.reduce((sum, group) => sum + group.count, 0);
  if (!total) return [];
  const rows = total > 16 ? 2 : 1;
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
        y: group.positions?.[index]?.y ?? (rows === 1 ? .55 : .4 + row * .3),
      });
      globalIndex += 1;
    }
  }
  return result;
}

function p(vendor, model, category, units, color, groups) {
  const profile = { vendor, model, category, units, color, groups, layout: vendor.toLowerCase().replace(/[^a-z0-9]+/g, "-") };
  Object.assign(profile, { portLayout: portLayoutMetadata(profile) });
  return profile;
}
function r(count, type, speed, poe, prefix = "") { return { zone: "access", count, type, speed, poe, prefix }; }
function u(count, type, speed, prefix = "") { return { zone: "uplink", count, type, speed, poe: false, prefix }; }
function m(count) { return { zone: "management", count, type: "Console", speed: 0, poe: false, prefix: "CONSOLE" }; }

function isGeneratedPortLabel(label) {
  return /^(?:\d+|(?:GE|PORT|SFP\+?|SFP28|SFP56|QSFP\+?|QSFP28|QSFP56|QSFP-DD|MGMT|CONSOLE|SHARED|ETH|10GE|MGIG|2\.5GE|5GE)\d+)$/i.test(String(label || ""));
}
