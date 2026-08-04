export const SERVER_SLOTS_PER_U = 4;

export const ServerCardTypes = Object.freeze([
  card("bmc", "BMC / IPMI", "RJ45_1G", 1000, [1], "BMC", "management"),
  card("rj45-1g", "1G BASE-T NIC", "RJ45_1G", 1000, [1, 2, 4], "LAN"),
  card("rj45-mgig", "Multi-Gig BASE-T NIC", "RJ45_MGIG", 5000, [1, 2, 4], "MGIG"),
  card("rj45-10g", "10G BASE-T NIC", "RJ45_10G", 10000, [1, 2, 4], "10G"),
  card("dsl-rj11", "RJ11 WAN / DSL card", "DSL_RJ11", 1000, [1, 2], "WAN"),
  card("coax-f", "F-type coax modem card", "COAX_F", 2500, [1, 2], "COAX"),
  card("sfp-1g", "1G SFP NIC / HBA", "SFP_1G", 1000, [1, 2, 4], "SFP"),
  card("sfp-plus", "10G SFP+ NIC / HBA", "SFP_PLUS_10G", 10000, [1, 2, 4], "SFP+"),
  card("sfp28", "25G SFP28 NIC / HBA", "SFP28_25G", 25000, [1, 2, 4], "SFP28"),
  card("sfp56", "50G SFP56 NIC", "SFP56_50G", 50000, [1, 2, 4], "SFP56"),
  card("qsfp-plus", "40G QSFP+ NIC", "QSFP_PLUS_40G", 40000, [1, 2], "QSFP+"),
  card("qsfp28", "100G QSFP28 NIC", "QSFP28_100G", 100000, [1, 2], "QSFP28"),
  card("qsfp56", "200G QSFP56 NIC", "QSFP56_200G", 200000, [1, 2], "QSFP56"),
  card("qsfp-dd", "400G QSFP-DD NIC", "QSFP_DD_400G", 400000, [1, 2], "QSFP-DD"),
  card("console", "Serial console card", "Console", 0, [1], "CONSOLE", "service"),
  card("power", "Power supply module", "Power", 0, [1, 2], "PSU", "power"),
]);

const cardTypesByKey = new Map(ServerCardTypes.map((type) => [type.key, type]));

export function serverCardType(key) {
  return cardTypesByKey.get(key) || null;
}

export function serverSlotCapacity(units) {
  const rackUnits = Number(units);
  if (!Number.isInteger(rackUnits) || rackUnits < 1 || rackUnits > 4) {
    throw new Error("Server rack height must be between 1U and 4U");
  }
  return rackUnits * SERVER_SLOTS_PER_U;
}

export function defaultServerCards() {
  return [
    { typeKey: "bmc", label: "BMC", portCount: 1 },
    { typeKey: "sfp28", label: "DATA", portCount: 2 },
    { typeKey: "power", label: "PSU", portCount: 2 },
  ];
}

export function normalizeServerCards(cards, units) {
  const capacity = serverSlotCapacity(units);
  if (!Array.isArray(cards) || !cards.length) throw new Error("Add at least one rear server card");
  if (cards.length > capacity) throw new Error(`${units}U server backs support up to ${capacity} cards`);
  return cards.map((input, index) => {
    const type = serverCardType(input.typeKey);
    if (!type) throw new Error(`Unsupported server card type ${input.typeKey || "unknown"}`);
    const portCount = Number(input.portCount);
    if (!type.portCounts.includes(portCount)) {
      throw new Error(`${type.label} supports ${type.portCounts.join(", ")} physical port${type.portCounts.length === 1 ? "" : " options"}`);
    }
    const label = String(input.label || type.defaultLabel).trim();
    if (!label || label.length > 30) throw new Error("Server card labels must contain 1 to 30 characters");
    return { slot: index + 1, typeKey: type.key, label, portCount, type };
  });
}

export function instantiateGenericServerBack(input, position) {
  const units = Number(input.units);
  const cards = normalizeServerCards(input.cards, units);
  const ports = cards.flatMap((installedCard) => cardPorts(installedCard, units));
  return {
    id: "",
    name: String(input.name || "SERVER"),
    category: "Server",
    model: String(input.model || "Generic server back"),
    positionX: Number(position?.x || 0),
    positionY: Number(position?.y || 0),
    faceplate: {
      unitsU: units,
      totalPorts: ports.length,
      rows: units,
      portSpacingX: 22,
      portSpacingY: 24,
      vendorColor: String(input.color || "#30383b"),
      hasSfpSlots: ports.some((port) => /SFP|QSFP/.test(port.type)),
      vendor: "Generic Server",
      layout: "generic-server-back",
    },
    ports: ports.map((port, index) => ({ ...port, portIndex: index + 1 })),
  };
}

function cardPorts(installedCard, units) {
  const { slot, label, portCount, type } = installedCard;
  const slotIndex = slot - 1;
  const slotRow = Math.floor(slotIndex / SERVER_SLOTS_PER_U);
  const slotColumn = slotIndex % SERVER_SLOTS_PER_U;
  const cardLeft = .43 + slotColumn * .135;
  const cardWidth = .12;
  const cardTop = .13 + slotRow * (.74 / units);
  const cardHeight = .74 / units;
  const rows = portCount > 2 ? 2 : 1;
  const columns = Math.ceil(portCount / rows);
  const group = `S${slot} · ${label}`.slice(0, 40);
  return Array.from({ length: portCount }, (_, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const rowCount = Math.min(columns, portCount - row * columns);
    const x = cardLeft + cardWidth * ((column + 1) / (rowCount + 1));
    const y = cardTop + cardHeight * ((row + 1) / (rows + 1));
    const unconfigured = type.zone === "service" || type.zone === "power";
    return {
      id: "",
      deviceId: "",
      label: portCount === 1 ? label : `${label}${index + 1}`,
      type: type.portType,
      mode: unconfigured ? "Unconfigured" : "Access",
      nativeVlan: unconfigured ? 0 : 1,
      allowedVlans: [],
      speedMbps: type.speedMbps,
      isPoe: false,
      status: "down",
      group,
      faceplateX: Number(x.toFixed(4)),
      faceplateY: Number(y.toFixed(4)),
    };
  });
}

function card(key, label, portType, speedMbps, portCounts, defaultLabel, zone = "data") {
  return Object.freeze({ key, label, portType, speedMbps, portCounts: Object.freeze(portCounts), defaultLabel, zone });
}
