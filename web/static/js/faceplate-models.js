import { resolvePhysicalPortGroups } from "./catalog-port-layouts.js";
import { resolveLenovoServerFaceplate } from "./faceplate-lenovo-servers-models.js";
import { resolveLenovoStorageFaceplate } from "./faceplate-lenovo-storage-models.js";
import { resolveAccessAdditionFaceplate } from "./faceplate-access-additions-models.js";
import { resolveRackAccessoryFaceplate } from "./faceplate-rack-accessories-models.js";
import { resolveRadAdditionFaceplate } from "./faceplate-rad-additions-models.js";
import { resolveEatonAdditionFaceplate } from "./faceplate-eaton-additions-models.js";
import { resolveFortinetFaceplate } from "./faceplate-fortinet-models.js";
import { resolveFortinetFinalFaceplate } from "./faceplate-fortinet-final-models.js";
import { resolveFortinetBladeFaceplate } from "./faceplate-fortinet-blade-models.js";
import { resolveFortinetChassisAliasFaceplate } from "./faceplate-fortinet-chassis-alias-models.js";
import { resolveEnterpriseFaceplate } from "./faceplate-enterprise-models.js";
import { resolveEquipmentFaceplate } from "./faceplate-equipment-models.js";
import { resolveUbiquitiFaceplate } from "./faceplate-ubiquiti-models.js";
import { resolveUbiquitiLegacyFaceplate } from "./faceplate-ubiquiti-legacy-models.js";
import { resolveArubaFaceplate } from "./faceplate-aruba-models.js";
import { resolveAccessPointFaceplate } from "./faceplate-access-point-models.js";

// Coordinates are normalized drawings traced from the cited panel illustrations,
// not manufacturing measurements. Only explicitly listed hardware variants match.
const GUIDES = {
  desktop: "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/fd70142f-ff2f-11e9-8977-00505692583a/FG-FWF-40F-60F-Series-QSG.pdf",
  "70F": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/19f0e644-700b-11ed-8e6d-fa163e15d75b/FG-70F-Series-QSG.pdf",
  "70G": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/729241d1-cdfc-11ef-91d4-7a9b9721b752/FG-70G-71G-QSG.pdf",
  "80F": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/13f24f18-1d87-11ec-8c53-00505692583a/FG-80F-Series-QSG.pdf",
  "100F": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/42d64717-83f1-11e9-81a4-00505692583a/FG-100F-QSG.pdf",
  "200F": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/89694abf-1ef2-11eb-96b9-00505692583a/FG-200F-Series-QSG.pdf",
  "400F": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/d6bb2d09-86df-11ed-8e6d-fa163e15d75b/FG-400F-QSG.pdf",
  "600F": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/518f6a17-f647-11ec-bb32-fa163e15d75b/FG-600F-Series-QSG.pdf",
  "124F": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/67241563-25de-11eb-96b9-00505692583a/FortiSwitch-124F-Series-QSG.pdf",
};

const models = new Map();
addFortiGate(["40F"], "desktop", 5, 5, 0, 0);
addFortiGate(["60F", "61F"], "desktop", 7, 10, 0, 0);
addFortiGate(["70F", "71F"], "70F", 5, 10, 0, 0);
addFortiGate(["70G", "71G"], "70G", "4–5", 10, 0, 0);
addFortiGate(["80F", "81F"], "80F", 5, 10, 2, 0);
addFortiGate(["100F", "101F"], "100F", 5, 18, 8, 2);
addFortiGate(["200F", "201F"], "200F", 6, 18, 8, 4);
addFortiGate(["400F", "401F"], "400F", "6–7", 18, 8, 8);
addFortiGate(["600F", "601F"], "600F", "6–7", 18, 8, 4, 4);
for (const suffix of ["", "-POE", "-FPOE"]) addFortiSwitch124(suffix);

/** Resolve exact model artwork first, then sourced family or configurable catalog panels. */
export function resolveModelFaceplate(device) {
  const eatonAddition = resolveEatonAdditionFaceplate(device);
  if (eatonAddition) return eatonAddition;
  const radAddition = resolveRadAdditionFaceplate(device);
  if (radAddition) return radAddition;
  const rackAccessory = resolveRackAccessoryFaceplate(device);
  if (rackAccessory) return rackAccessory;
  const accessAddition = resolveAccessAdditionFaceplate(device);
  if (accessAddition) return accessAddition;
  const lenovoStorage = resolveLenovoStorageFaceplate(device);
  if (lenovoStorage) return lenovoStorage;
  const lenovoServer = resolveLenovoServerFaceplate(device);
  if (lenovoServer) return lenovoServer;
  const fortinetBlade = resolveFortinetBladeFaceplate(device);
  if (fortinetBlade) return fortinetBlade;
  const fortinetChassisAlias = resolveFortinetChassisAliasFaceplate(device);
  if (fortinetChassisAlias) return fortinetChassisAlias;
  const fortinetFinal = resolveFortinetFinalFaceplate(device);
  if (fortinetFinal) return fortinetFinal;
  if (device?.faceplate?.vendor === "Fortinet" && models.has(device.model)) return models.get(device.model);
  return resolveAccessPointFaceplate(device) || resolveFortinetFaceplate(device) || resolveArubaFaceplate(device) || resolveEnterpriseFaceplate(device) ||
    resolveUbiquitiLegacyFaceplate(device) || resolveUbiquitiFaceplate(device) || resolveEquipmentFaceplate(device);
}

/** Build a normalized physical element from a reusable component kind. */
function component(kind, x, y, width, height, label, variant) {
  return { kind, x, y, width, height, ...(label ? { label } : {}), ...(variant ? { variant } : {}),
    ...(kind === "text" ? { fontSize: 6 } : {}) };
}

/** Stack labeled status indicators without duplicating LED drawing instructions. */
function statusLEDs(labels, x, y, step = .12, labelsRight = false, labelWidth = .065) {
  return labels.flatMap((label, index) => [
    component("led", x, y + index * step, .008, .055),
    component("text", labelsRight ? x + .012 : x - labelWidth - .006, y + index * step - .03,
      labelsRight ? .038 : labelWidth, .115, label),
  ]);
}

/** Preserve canonical inventory order while reusing researched catalog socket geometry. */
function fortiGatePorts(model, copper, sfp, sfpp, sfp28, desktop) {
  const groups = [{ zone: "access", count: copper, type: "RJ45_1G", prefix: "GE" }];
  for (const [count, type, prefix] of [[sfp, "SFP_1G", "SFP"], [sfpp, "SFP_PLUS_10G", "SFP+"], [sfp28, "SFP28_25G", "SFP28"]]) {
    if (count) groups.push({ zone: "uplink", count, type, prefix });
  }
  groups.push({ zone: "management", count: 1, type: "Console", prefix: "CONSOLE" });
  const resolved = resolvePhysicalPortGroups({ vendor: "Fortinet", model, groups });
  let portIndex = 0;
  return resolved.flatMap((group) => group.labels.map((label, index) => ({
    label, type: group.type, portIndex: ++portIndex, ...group.positions[index],
    width: desktop ? .052 : .029, height: .24,
  })));
}

/** Add only QSG-listed FortiGate SKUs, sharing components across identical chassis. */
function addFortiGate(skus, guide, page, copper, sfp, sfpp, sfp28 = 0) {
  const desktop = copper <= 10;
  for (const sku of skus) {
    const model = `FortiGate ${sku}`;
    const base = skus[0];
    const ports = fortiGatePorts(model, copper, sfp, sfpp, sfp28, desktop);
    models.set(model, {
      id: `fortinet-${sku.toLowerCase()}`, defaultFace: desktop ? "rear" : "front", fidelity: "model",
      source: GUIDES[guide], sourcePage: `PDF ${page}`,
      chassis: desktop ? { x: .175, y: .08, width: .65, height: .84 } : { x: 0, y: .04, width: 1, height: .92 },
      faces: desktop ? desktopFaces(model, base, ports) : rackFaces(model, base, ports),
    });
  }
}

/** Compose desktop indicators separately from the connector-bearing rear panel. */
function desktopFaces(model, base, ports) {
  const front = [component("text", .04, .16, .35, .14, model)];
  const labels = base === "80F" ? ["STATUS", "HA", "POWER"] : ["PWR", "STATUS", "HA"];
  const dataPorts = ports.filter((port) => port.type !== "Console");
  if (base === "80F") {
    front.push(...statusLEDs(labels, .285, .48, .1));
    ["1", "2", "3", "4", "5", "6", "A", "B", "WAN1", "WAN2", "SFP1", "SFP2"].forEach((label, index) => {
      const x = .36 + Math.floor(index / 2) * .043;
      front.push(component("led", x, index % 2 ? .72 : .53, .009, .055),
        component("text", x - .014, index % 2 ? .80 : .34, .043, .13, label));
    });
  } else {
    labels.forEach((label, index) => front.push(component("led", .35 + index * .08, .7, .009, .055),
      component("text", .319 + index * .08, .51, .072, .14, label)));
    const order = base === "40F" ? ["1", "2", "3", "A", "WAN"] :
      base === "70G" ? ["1", "2", "3", "4", "5", "6", "A", "B", "WAN1", "WAN2"] :
        ["1", "2", "3", "4", "5", "A", "B", "DMZ", "WAN1", "WAN2"];
    order.forEach((label, index) => {
      const x = (base === "40F" ? .72 : .6) + index * .034;
      front.push(component("led", x, .54, .009, .055), component("led", x, .69, .009, .055),
        component("text", x - .014, .34, .039, .14, label));
    });
  }
  const rear = [component("text", .025, .07, .11, .12, "REAR")];
  if (base === "80F") {
    // The 80F pairs rear SFP/WAN sockets and has two external-DC connectors.
    for (const port of ports) {
      if (port.type === "Console") { port.x = .15; port.y = .36; }
      else if (port.label === "SFP1" || port.label === "SFP2") port.x = .25;
      else if (port.label === "WAN1" || port.label === "WAN2") port.x = .38;
      else port.x = .54 + (Math.floor(dataPorts.filter((item) => !/SFP|WAN/.test(item.label)).findIndex((item) => item === port) / 2)) * .078;
    }
    rear.push(component("usb", .124, .65, .05, .15, "USB", "a"),
      component("power", .835, .38, .03, .42, "DC1", "dc-keyed2"), component("power", .897, .38, .03, .42, "DC2", "dc-keyed2"));
    front.push(component("led", .94, .65, .013, .06, undefined, "button"), component("text", .85, .78, .13, .15, "BLE/RESET"));
  } else {
    rear.push(component("vent", .27, .08, .63, .14, undefined, "slots"));
    if (base === "40F") rear.push(component("vent", .3, .42, .27, .3, undefined, "slots"));
    if (base === "70G") {
      const console = ports.find((port) => port.type === "Console");
      console.x = .2;
      console.y = .37;
      rear.push(component("power", .118, .38, .028, .39, "DC12V", "dc-keyed2"),
        component("usb", .17, .65, .06, .17, "USB", "a"),
        component("module-bay", .057, .41, .035, .42, "SIGNED", "blank"));
      front.push(component("led", .085, .64, .013, .06, undefined, "button"),
        component("text", .035, .76, .13, .15, "BLE/RESET"),
        component("led", .18, .64, .009, .055), component("text", .158, .76, .052, .15, "BLE"),
        component("led", .275, .64, .009, .055), component("text", .215, .76, .12, .15, "SIGNED FW"));
    } else {
      rear.push(component("power", .064, .35, .032, .43, "DC12V", "dc-keyed2"),
        component("usb", .113, .38, .025, .36, "USB", "a"));
    }
  }
  return { front: { components: front, ports: [] }, rear: { components: rear, ports } };
}

/** Compose documented rack front service controls and model-specific rear hardware. */
function rackFaces(model, base, ports) {
  const statusX = base === "100F" ? .19 : base === "600F" ? .05 : .105;
  const front = [component("text", .025, .12, .19, .14, model),
    ...statusLEDs(["STATUS", "ALARM", "HA", "POWER"], statusX, .4, .12, false, base === "600F" ? .038 : .065)];
  if (base === "400F") {
    front.push(component("usb", .142, .70, .03, .16, "USB", "a"));
  } else {
    const usbX = base === "100F" ? .231 : base === "200F" ? .137 : .067;
    front.push(component("usb", usbX, .48, .015, .27, "USB", "a"));
    if (base === "600F") front.push(component("usb", .088, .48, .015, .27, "USB", "a"));
  }
  if (base === "200F") front.push(component("vent", .655, .2, .035, .65, undefined, "slots"));
  if (base === "400F") front.push(component("vent", .237, .2, .012, .62, undefined, "slots"),
    component("vent", .565, .2, .033, .62, undefined, "slots"), component("vent", .91, .2, .063, .62, undefined, "slots"));
  if (base === "600F") front.push(component("vent", .493, .24, .05, .57, undefined, "perforated"),
    component("vent", .837, .24, .05, .57, undefined, "perforated"));
  const rear = [];
  if (base === "100F" || base === "200F") {
    rear.push(component("power", .098, .3, .073, .5, "PSU2", "ac"), component("power", .836, .3, .073, .5, "PSU1", "ac"));
    if (base === "100F") rear.push(component("vent", .395, .15, .19, .7, undefined, "perforated"));
    else for (const x of [.24, .35, .53]) rear.push(component("fan", x, .16, .085, .72, undefined, "fixed"));
  } else {
    rear.push(component("psu", .695, .07, .13, .86, "PSU2", "ac"), component("psu", .844, .07, .13, .86, "PSU1", "ac"));
    if (base === "400F") {
      rear.push(component("vent", .155, .17, .1, .66, undefined, "perforated"), component("vent", .30, .17, .34, .66, undefined, "perforated"));
    } else {
      rear.push(component("module-bay", .025, .14, .185, .34, "SSD2", "blank"),
        component("module-bay", .025, .50, .185, .34, "SSD1", "blank"),
        component("vent", .22, .14, .43, .7, "FAN1–5", "mesh"));
    }
  }
  return { front: { components: front, ports }, rear: { components: rear, ports: [] } };
}

/** Describe all three 124F models; PoE versions have distinct rear cooling hardware. */
function addFortiSwitch124(suffix) {
  const model = `FortiSwitch 124F${suffix}`;
  const ports = [];
  for (let index = 0; index < 24; index++) {
    ports.push({ label: String(index + 1), type: "RJ45_1G", portIndex: index + 1,
      x: .25 + Math.floor(index / 2) * .043 + (index >= 12 ? .025 : 0), y: index % 2 ? .68 : .38, width: .035, height: .24 });
  }
  for (let index = 0; index < 4; index++) {
    ports.push({ label: String(index + 25), type: "SFP_PLUS_10G", portIndex: index + 25,
      x: index < 2 ? .865 : .945, y: index % 2 ? .68 : .38, width: .042, height: .24 });
  }
  ports.push({ label: "CONSOLE", type: "Console", portIndex: 29, x: .135, y: .43, width: .037, height: .25 });
  const front = [component("text", .025, 0, .18, .12, model), component("usb", .115, .65, .04, .15, "USB", "a"),
    ...statusLEDs(suffix ? ["POWER", "ALARM", "POE MAX"] : ["POWER", "ALARM"], .18, .37, .12, true)];
  const rear = [component("power", suffix ? .615 : .83, .27, .09, .53, "AC", "ac")];
  if (suffix) rear.push(component("fan", .75, .12, .088, .76, undefined, "fixed"), component("fan", .855, .12, .088, .76, undefined, "fixed"));
  models.set(model, {
    id: `fortinet-124f${suffix.toLowerCase()}`, defaultFace: "front", fidelity: "model", source: GUIDES["124F"],
    sourcePage: `PDF ${suffix === "-POE" ? "6–7" : suffix === "-FPOE" ? "8–9" : "4–5"}`,
    chassis: { x: 0, y: .04, width: 1, height: .92 },
    faces: { front: { components: front, ports }, rear: { components: rear, ports: [] } },
  });
}
