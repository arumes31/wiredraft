const FORTINET_PORT_SOURCES = Object.freeze({
  "FortiGate 40F": "https://docs.fortinet.com/document/fortigate/7.6.0/hardware-acceleration/965349/fortigate-40f-fast-path-architecture",
  "FortiGate 60F": "https://docs.fortinet.com/document/fortigate/7.6.2/hardware-acceleration/758378/fortigate-60f-and-61f-fast-path-architecture",
  "FortiGate 70F": "https://docs.fortinet.com/document/fortigate/7.0.15/hardware-acceleration/749156/fortigate-70f-and-71f-fast-path-architecture",
  "FortiGate 70G": "https://docs.fortinet.com/document/fortigate/7.4.9/hardware-acceleration/218161/fortigate-70g-and-71g-fast-path-architecture",
  "FortiGate 80F": "https://docs.fortinet.com/document/fortigate/7.2.11/hardware-acceleration/300792/fortigate-80f-81f-and-80f-bypass-fast-path-architecture",
  "FortiGate 100F": "https://docs.fortinet.com/document/fortigate/7.6.6/hardware-acceleration/47902/fortigate-100f-and-101f-fast-path-architecture",
  "FortiGate 200E": "https://docs.fortinet.com/document/fortigate/6.2.17/hardware-acceleration/854455/fortigate-200e-and-201e-fast-path-architecture",
  "FortiGate 200F": "https://docs.fortinet.com/document/fortigate/7.0.10/hardware-acceleration/336140/fortigate-200f-and-201f-fast-path-architecture",
  "FortiGate 400F": "https://docs.fortinet.com/document/fortigate/7.2.5/hardware-acceleration/785717/fortigate-400f-and-401f-fast-path-architecture",
  "FortiGate 600F": "https://docs.fortinet.com/document/fortigate/7.4.7/hardware-acceleration/589036/fortigate-600f-and-601f-fast-path-architecture",
  "FortiGate 6000F": "https://docs.fortinet.com/document/fortigate/7.4.9/fortigate-6000-administration-guide/343054/front-panel-interfaces",
});

const exactFortiGateLayouts = new Map([
  ["FortiGate 40F", zones(["WAN", "A", "1", "2", "3"], [], ["CONSOLE"])],
  ["FortiGate 60F", zones(["1", "2", "3", "4", "5", "A", "B", "DMZ", "WAN1", "WAN2"], [], ["CONSOLE"])],
  ["FortiGate 70F", zones(["1", "2", "3", "4", "5", "A", "B", "DMZ", "WAN1", "WAN2"], [], ["CONSOLE"])],
  ["FortiGate 70G", zones(["1", "2", "3", "4", "5", "6", "A", "B", "WAN1", "WAN2"], [], ["CONSOLE"])],
  ["FortiGate 80F", zones(["1", "2", "3", "4", "5", "6", "A", "B", "WAN1", "WAN2"], ["SFP1", "SFP2"], ["CONSOLE"])],
  ["FortiGate 100F", zones(["DMZ", "MGMT", "WAN1", "WAN2", "HA1", "HA2", ...range(1, 12)], [...range(13, 20), "X1", "X2"], ["CONSOLE"])],
  ["FortiGate 200E", zones(["MGMT", "HA", "WAN1", "WAN2", ...range(1, 14)], range(15, 18), ["CONSOLE"])],
  ["FortiGate 200F", zones(["HA", "MGMT", ...range(1, 16)], [...range(17, 24), "X1", "X2", "X3", "X4"], ["CONSOLE"])],
  ["FortiGate 400F", zones(["HA", "MGMT", ...range(1, 16)], [...range(17, 24), "X1", "X2", "X3", "X4", "X5", "X6", "X7", "X8"], ["CONSOLE"])],
  ["FortiGate 600F", zones(["HA", "MGMT", ...range(1, 16)], [...range(17, 24), "X1", "X2", "X3", "X4", "X5", "X6", "X7", "X8"], ["CONSOLE"])],
  ["FortiGate 6000F", zones([], [...range(1, 28)], ["HA1", "HA2", "MGMT1", "MGMT2", "MGMT3", "CONSOLE1", "CONSOLE2"])],
]);

const FORTISWITCH_1024E_QSG = "https://docs.fortinet.com/document/fortiswitch/hardware/fortiswitch-t1024e-1024e-quickstart-guide";

const exactFortiSwitchLayouts = new Map([
  ["FortiSwitch 1024E", {
    source: FORTISWITCH_1024E_QSG,
    groups: new Map([
      ["SFP_PLUS_10G:PORT", portGrid(24, .36, .72, .4, .7)],
      ["QSFP28_100G:QSFP28", portGrid(2, .78, .78, .4, .7)],
      ["RJ45_1G:MGMT", [{ x: .84, y: .55 }]],
      ["Console:CONSOLE", [{ x: .235, y: .7 }]],
    ]),
  }],
]);

export function resolvePhysicalPortGroups(profile) {
  const groups = profile.groups.map((group) => ({
    ...group,
    labels: group.labels ? [...group.labels] : undefined,
    positions: group.positions?.map((position) => ({ ...position })),
  }));
  const familyName = fortinetFamilyName(profile.model);
  const exact = profile.vendor === "Fortinet" ? exactFortiGateLayouts.get(familyName) : null;
  if (exact) {
    applyZoneLabels(groups, exact);
    return groups;
  }
  if (profile.vendor === "Fortinet" && profile.model.startsWith("FortiSwitch")) {
    applySequentialDataLabels(groups);
    applyExactFortiSwitchLayout(groups, exactFortiSwitchLayouts.get(profile.model));
    return groups;
  }
  if (profile.vendor === "Fortinet" && profile.model.startsWith("FortiGate")) {
    applySequentialDataLabels(groups);
    return groups;
  }
  if (profile.vendor === "Palo Alto") {
    let ethernet = 1;
    for (const group of groups) {
      if (group.zone === "access" || group.zone === "uplink") {
        group.labels = Array.from({ length: group.count }, () => `ethernet1/${ethernet++}`);
      } else {
        group.labels = managementLabels(group);
      }
    }
    return groups;
  }
  if (profile.vendor === "Sophos") {
    let port = 1;
    for (const group of groups) {
      group.labels = group.zone === "management" ? managementLabels(group, ["MGMT", "COM"]) :
        Array.from({ length: group.count }, () => `Port${port++}`);
    }
    return groups;
  }
  if (profile.vendor === "Check Point") {
    let port = 1;
    for (const group of groups) {
      group.labels = group.zone === "management" ? managementLabels(group, ["Mgmt", "Sync"]) :
        Array.from({ length: group.count }, () => String(port++));
    }
    return groups;
  }
  if (profile.category === "Switch") {
    applySequentialDataLabels(groups);
    return groups;
  }
  for (const group of groups) group.labels ||= defaultLabels(group);
  return groups;
}

export function portLayoutMetadata(profile) {
  const familyName = fortinetFamilyName(profile.model);
  const exactSource = FORTINET_PORT_SOURCES[familyName] || exactFortiSwitchLayouts.get(profile.model)?.source;
  return {
    fidelity: exactSource ? "exact" : profile.fidelity || "family",
    source: exactSource || profile.source || "vendor front-panel family documentation",
  };
}

function applyExactFortiSwitchLayout(groups, layout) {
  if (!layout) return;
  for (const group of groups) {
    const positions = layout.groups.get(`${group.type}:${group.prefix || ""}`);
    if (positions?.length === group.count) group.positions = positions.map((position) => ({ ...position }));
  }
}

function fortinetFamilyName(model) {
  const aliases = [
    [/(40F)/, "FortiGate 40F"], [/(60F|61F)/, "FortiGate 60F"], [/(70F|71F)/, "FortiGate 70F"],
    [/(70G|71G)/, "FortiGate 70G"],
    [/(80F|81F)/, "FortiGate 80F"], [/(100F|101F)/, "FortiGate 100F"], [/(200E|201E)/, "FortiGate 200E"],
    [/(200F|201F)/, "FortiGate 200F"], [/(400F|401F)/, "FortiGate 400F"], [/(600F|601F)/, "FortiGate 600F"],
    [/(6000F|6001F|6300F|6301F|6500F|6501F)/, "FortiGate 6000F"],
  ];
  if (!model.startsWith("FortiGate ") || model.startsWith("FortiGate Rugged")) return model;
  return aliases.find(([pattern]) => pattern.test(model))?.[1] || model;
}

function applyZoneLabels(groups, labelsByZone) {
  for (const zone of ["access", "uplink", "management"]) {
    let offset = 0;
    for (const group of groups.filter((candidate) => candidate.zone === zone)) {
      const labels = labelsByZone[zone].slice(offset, offset + group.count);
      group.labels = labels.length === group.count ? labels : defaultLabels(group);
      offset += group.count;
    }
  }
}

function applySequentialDataLabels(groups) {
  let port = 1;
  for (const group of groups) {
    if (group.type === "Stack") {
      group.labels = defaultLabels(group);
    } else if (group.zone === "management" || /^MGMT$/i.test(group.prefix || "")) {
      group.labels = managementLabels(group);
    } else {
      group.labels = Array.from({ length: group.count }, () => String(port++));
    }
  }
}

function managementLabels(group, preferred = []) {
  if (preferred.length >= group.count) return preferred.slice(0, group.count);
  const prefix = /^CONSOLE$/i.test(group.prefix || "") ? "CONSOLE" : "MGMT";
  return Array.from({ length: group.count }, (_, index) => group.count === 1 ? prefix : `${prefix}${index + 1}`);
}

function defaultLabels(group) {
  const prefix = group.prefix || "";
  return Array.from({ length: group.count }, (_, index) => `${prefix}${index + 1}`);
}

function zones(access, uplink, management) {
  return { access: access.map(String), uplink: uplink.map(String), management: management.map(String) };
}

function range(first, last) {
  return Array.from({ length: last - first + 1 }, (_, index) => String(first + index));
}

function portGrid(count, x1, x2, topY, bottomY) {
  const rows = count > 1 ? 2 : 1;
  const columns = Math.ceil(count / rows);
  return Array.from({ length: count }, (_, index) => ({
    x: columns === 1 ? (x1 + x2) / 2 : x1 + (x2 - x1) * Math.floor(index / rows) / (columns - 1),
    y: rows === 1 ? (topY + bottomY) / 2 : index % rows === 0 ? topY : bottomY,
  }));
}
