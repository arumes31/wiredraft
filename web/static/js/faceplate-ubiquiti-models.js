import { canonicalFaceplateDevice } from "./faceplate-profile.js";

// Normalized illustrations are traced from the linked model's front and rear views.
// Coordinates are for connection planning, not manufacturing or fabrication.
const models = new Map([
  ["UniFi Standard 24", { sku: "USW-24", copper: 24, optical: 2,
    source: "https://dl.ui.com/qsg/USW-24/USW-24_EN.html",
    front: "https://dl.ui.com/qsg/USW-24/image/USW-24_Front_Callouts.png",
    rear: "https://dl.ui.com/qsg/USW-24/image/USW-24_Back_Callout.png" }],
  ["UniFi Standard 48 PoE", { sku: "USW-48-POE", copper: 48, optical: 4,
    source: "https://dl.ui.com/qsg/USW-48-POE/USW-48-POE_EN.html",
    front: "https://dl.ui.com/qsg/USW-48-POE/image/USW-48-POE_Front_callouts.png",
    rear: "https://dl.ui.com/qsg/USW-48-POE/image/USW-48-POE_Back_Callouts.png",
    discrepancies: ["The USW-48-POE supplies PoE on ports 1–32 only. Older topologies may mark all 48 copper ports as PoE capable; existing port IDs and configuration are preserved."] }],
  ["UniFi Pro Max 24 PoE", { sku: "USW-Pro-Max-24-PoE", kind: "pro", copper: 24, optical: 2, fans: 0,
    photo: "58922518-88f6-4c75-89c1-f57ba3d8253a/9a68d63e-39cf-4d14-83ff-79d2c35b1b8c.png",
    discrepancies: ["Older topologies may assign 2.5G to every copper port. Physical ports 1–16 support 1G and 17–24 support 2.5G; existing configuration is preserved."] }],
  ["UniFi Pro Max 48 PoE", { sku: "USW-Pro-Max-48-PoE", kind: "pro", copper: 48, optical: 4, fans: 4,
    photo: "51e22689-9b81-4717-beed-fe2c65c57362/c20ff409-f511-4a04-9bf0-200065216489.png",
    discrepancies: ["Older topologies may assign 2.5G to every copper port. Physical ports 1–32 support 1G and 33–48 support 2.5G; existing configuration is preserved."] }],
  ["UniFi Pro XG 24 PoE", { sku: "USW-Pro-XG-24-PoE", kind: "pro", copper: 24, optical: 2, fans: 5,
    photo: "b6f03374-2a31-428c-86fb-62b49739c924/0d6293b6-de78-4f81-8291-6f671727641c.png",
    discrepancies: ["Older topologies reverse the speed-bank assignment. Physical ports 1–8 support 2.5G and 9–24 support 10G; existing configuration is preserved."] }],
  ["UniFi Pro XG 48 PoE", { sku: "USW-Pro-XG-48-PoE", kind: "pro", copper: 48, optical: 4, fans: 5,
    photo: "b4f97072-47c3-4ea1-96aa-616b94c1ca05/ae621559-57f8-4db2-8c93-eee31330aafc.png",
    discrepancies: ["Older topologies reverse the speed-bank assignment. Physical ports 1–16 support 2.5G and 17–48 support 10G; existing configuration is preserved."] }],
  ["USW-Enterprise-48-PoE", { sku: "USW-Enterprise-48-PoE", kind: "pro", copper: 48, optical: 4, fans: 4, rpsCover: true,
    photo: "81802ee3-ab5d-46f6-b6f7-2abbe2a5968b/8fd2135e-27fc-43ec-8cf5-b2806d2ba696.png",
    discrepancies: ["This model has no dedicated MGMT socket. An extra MGMT endpoint saved by older catalog versions remains routable as unmapped inventory."] }],
  ["UDM-Pro-Max", { sku: "UDM-Pro-Max", kind: "gateway", fans: 0,
    photo: "401190d7-6a49-4c2e-bef1-7fe087d2b6b6/09bad3e9-2d83-4b7c-8940-65174540174c.png",
    discrepancies: ["Older topologies describe the eight 1G non-PoE LAN ports as multigigabit PoE, and the 2.5G WAN port as MGMT. Physical ports 9/10/11 map to saved inventory indices 11/9/10 to retain cable identity."] }],
  ["UniFi Enterprise Campus Aggregation", { sku: "ECS-Aggregation", kind: "aggregation",
    photo: "82c1c564-0e08-4b27-a7b9-95729cca00bd/ca747997-aa78-4021-a85d-da8a11933840.png" }],
  ["UniFi U7 Pro", { sku: "U7-Pro", kind: "access-point", source: "https://techspecs.ui.com/unifi/wifi/u7-pro",
    front: "https://cdn.ecomm.ui.com/products/fa8dd4e4-36c8-4c79-a928-22c7bff2ce29/80c7b3d6-8db3-4978-9c17-fef6c8c7f4a8.png",
    rear: "https://cdn.ecomm.ui.com/products/fa8dd4e4-36c8-4c79-a928-22c7bff2ce29/abca9317-dadb-4218-908a-1885b520da29.png" }],
]);
models.set("USW-Pro-Max-48-PoE", { ...models.get("UniFi Pro Max 48 PoE"), discrepancies: [
  ...models.get("UniFi Pro Max 48 PoE").discrepancies,
  "This model has no dedicated MGMT socket. An extra MGMT endpoint saved by older catalog versions remains routable as unmapped inventory.",
] });
const cache = new Map();

/** Resolve only the Ubiquiti SKUs with individually traced panel evidence. */
export function resolveUbiquitiFaceplate(device) {
  if (device?.faceplate?.vendor !== "Ubiquiti") return null;
  const definition = models.get(device.model);
  if (!definition) return null;
  const canonical = canonicalFaceplateDevice(device);
  if (!canonical) return null;
  if (!cache.has(canonical.catalog)) {
    const faces = definition.kind === "pro" ? proSwitch(canonical.device, definition)
      : definition.kind === "gateway" ? gateway(canonical.device, definition)
        : definition.kind === "aggregation" ? aggregation(canonical.device)
          : definition.kind === "access-point" ? accessPoint(canonical.device) : standardSwitch(canonical.device, definition);
    cache.set(canonical.catalog, hardwareProfile(definition, faces));
  }
  return cache.get(canonical.catalog);
}

/** Create shared connector artwork without embedding a second renderer. */
function part(kind, x, y, width, height, label, variant) {
  return { kind, x, y, width, height, ...(label ? { label } : {}), ...(variant ? { variant } : {}) };
}

/** Match an immutable catalog index so later user renaming does not move the socket. */
function socket(device, index, x, y, width = .027, height = .24) {
  const port = device.ports.find((candidate) => candidate.portIndex === index);
  return { portIndex: port.portIndex, label: port.label, type: port.type, x, y, width, height,
    ...(port.type.startsWith("RJ45") ? { compatibleTypes: ["RJ45_1G", "RJ45_MGIG", "RJ45_10G"] } : {}) };
}

/** Trace the two fanless Standard switches, including their different bank placement. */
function standardSwitch(device, definition) {
  const compact = definition.copper === 24;
  const ports = [];
  for (let index = 0; index < definition.copper; index++) {
    const column = Math.floor(index / 2);
    ports.push(socket(device, index + 1, (compact ? .494 : .097) + column * .0321 + Math.floor(column / 6) * .0067,
      index % 2 === 0 ? .34 : .67));
  }
  for (let index = 0; index < definition.optical; index++) {
    ports.push(socket(device, definition.copper + index + 1, (compact ? .93 : .898) + Math.floor(index / 2) * .036,
      index % 2 === 0 ? .34 : .67, .032, .25));
  }
  const front = {
    ports, components: [part("lcd", .014, .23, .05, .55),
      part("button", .973, .82, .008, .07, undefined, "reset")],
  };
  const frontSlits = compact ? [[.084, .167], [.26, .166], [.433, .167]]
    : [[.09, .176], [.275, .178], [.463, .178], [.65, .178]];
  for (const [x, width] of frontSlits) front.components.push(part("vent", x, .015, width, .035, undefined, "slit"));
  const rear = {
    ports: [], components: [part("power", .856, .29, .071, .54, "AC", "ac")],
    connectionMarker: { x: .32, y: .75, width: .3, height: .15 },
  };
  for (const x of [.04, .22, .40, .58, .76]) rear.components.push(part("vent", x, .015, .167, .035, undefined, "slit"));
  return { front, rear };
}

/** Attach the exact SKU and separately inspected panel evidence to a completed trace. */
function hardwareProfile(definition, faces) {
  const source = definition.source || `https://techspecs.ui.com/unifi/${definition.kind === "gateway" ? "cloud-gateways" : "switching"}/${definition.sku.toLowerCase()}`;
  const image = definition.photo ? `https://cdn.ecomm.ui.com/products/${definition.photo}` : null;
  return {
    id: `ubiquiti-${definition.sku.toLowerCase()}`, fidelity: "model", defaultFace: definition.kind === "access-point" ? "rear" : "front",
    source, sourcePage: definition.photo ? "Annotated front and rear product image" : "Hardware Overview", panelsVerified: true,
    evidence: { models: [definition.sku], front: definition.front || image, rear: definition.rear || image },
    inventoryComplete: true, catalogDiscrepancies: definition.discrepancies || [],
    chassis: { x: .025, y: .06, width: .95, height: .88,
      ...(definition.kind === "access-point" ? { shape: "circle" } : {}) }, faces,
  };
}

/** Place the observed single-row 24-port and paired-row 48-port Pro banks. */
function proSwitch(device, definition) {
  const rows = definition.copper === 24 ? 1 : 2;
  const ports = [];
  for (let index = 0; index < definition.copper; index++) {
    const column = Math.floor(index / rows);
    ports.push(socket(device, index + 1, .101 + column * .0327 + Math.floor(column / 8) * .005,
      rows === 1 ? .64 : index % 2 === 0 ? .34 : .67));
  }
  for (let index = 0; index < definition.optical; index++) {
    ports.push(socket(device, definition.copper + index + 1, .9 + Math.floor(index / rows) * .035,
      rows === 1 ? .68 : index % 2 === 0 ? .34 : .67, .032, .25));
  }
  const components = [part("lcd", .011, .22, .053, .56), part("button", .971, .83, .008, .06, undefined, "reset")];
  if (rows === 1) for (const x of [.082, .257, .432, .607, .782]) components.push(part("vent", x, .04, .168, .035, undefined, "slit"));
  return { front: { ports, components }, rear: proRear(definition) };
}

/** Trace fixed AC and USP power separately from the model's exposed rear fans. */
function proRear(definition) {
  const components = [part("power", .85, .26, .076, .60, "AC", "ac")];
  if (definition.rpsCover) components.push(part("module-bay", .037, .46, .145, .43, "USP CONNECT", "blank"));
  else components.push({ ...part("power", .041, .43, .145, .44, "USP CONNECT", "dc-multipin"), columns: 12 });
  if (definition.fans) {
    for (let index = 0; index < definition.fans; index++) components.push(part("fan", (definition.fans === 5 ? .196 : .301) + index * .105,
      .045, .085, .86));
  } else {
    for (const x of [.044, .223, .402, .581, .76]) components.push(part("vent", x, .04, .171, .035, undefined, "slit"));
  }
  return { ports: [], components, connectionMarker: { x: .29, y: .90, width: .37, height: .085 } };
}

/** Preserve the UDM's saved port indices while drawing its actual LAN/WAN and drive bays. */
function gateway(device, definition) {
  const ports = Array.from({ length: 8 }, (_, index) => socket(device, index + 1,
    .715 + Math.floor(index / 2) * .0357, index % 2 === 0 ? .34 : .67));
  ports.push(socket(device, 9, .935, .34, .032, .25), socket(device, 10, .935, .69, .032, .25),
    socket(device, 11, .895, .67));
  const components = [part("lcd", .011, .22, .053, .56),
    part("module-bay", .081, .14, .245, .72, "HDD 1", "blank"),
    part("module-bay", .327, .14, .247, .72, "HDD 2", "blank"),
    part("button", .969, .85, .008, .06, undefined, "reset")];
  for (const x of [.081, .257, .432, .608, .784]) components.push(part("vent", x, .04, .168, .035, undefined, "slit"));
  return { front: { ports, components }, rear: proRear(definition) };
}

/** Trace the ECS optical banks and its five fan modules followed by two removable PSUs. */
function aggregation(device) {
  const ports = [];
  for (let index = 0; index < 48; index++) ports.push(socket(device, index + 1,
    .087 + Math.floor(index / 2) * .0325, index % 2 === 0 ? .33 : .66, .030, .245));
  for (let index = 0; index < 6; index++) ports.push(socket(device, index + 49,
    .880 + Math.floor(index / 2) * .043, index % 2 === 0 ? .33 : .66, .040, .245));
  const front = { ports, components: [part("lcd", .011, .22, .053, .56),
    part("button", .955, .86, .008, .06, undefined, "reset")] };
  for (const x of [.074, .26, .446, .632, .818]) front.components.push(part("vent", x, .04, .175, .025, undefined, "slit"));
  const rear = { ports: [], components: [], connectionMarker: { x: .29, y: .90, width: .37, height: .085 } };
  for (let index = 0; index < 5; index++) rear.components.push(part("fan", .039 + index * .11, .035, .105, .94));
  rear.components.push(part("psu", .615, .025, .172, .96, "PSU 1", "ac-fan-left"),
    part("psu", .8, .025, .172, .96, "PSU 2", "ac-fan-left"));
  return { front, rear };
}

/** Show the U7's circular cover and its underside PoE inlet and recessed reset control. */
function accessPoint(device) {
  return {
    front: { ports: [], components: [{ ...part("ring", .30, .30, .40, .40), ink: "#609dff" },
      { ...part("text", .38, .39, .24, .22, "U"), ink: "#879296" }] },
    rear: { ports: [socket(device, 1, .68, .74, .075, .085)], components: [
      part("ring", .07, .07, .86, .86), part("button", .30, .76, .025, .025, undefined, "reset"),
      part("handle", .445, .06, .11, .027), part("handle", .07, .435, .027, .10),
      part("handle", .90, .435, .027, .10), part("handle", .46, .885, .08, .032),
    ] },
  };
}
