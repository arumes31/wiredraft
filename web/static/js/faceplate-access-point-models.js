import { canonicalFaceplateDevice } from "./faceplate-profile.js";

const ap635Guide = "https://arubanetworking.hpe.com/techdocs/hardware/aps/ap630/ig/AP-630_Install_Guide_EN.pdf";
let ap635Profile;

/** Resolve only access-point models whose front and underside drawings have been individually inspected. */
export function resolveAccessPointFaceplate(device) {
  if (device?.faceplate?.vendor !== "HPE Aruba" || device.model !== "AP-635") return null;
  if (!ap635Profile) {
    const canonical = canonicalFaceplateDevice(device);
    if (!canonical) return null;
    ap635Profile = {
      id: "aruba-ap-635", sku: "AP-635", defaultFace: "rear", fidelity: "model",
      panelFidelity: { front: "model", rear: "model" },
      source: ap635Guide, sourcePage: "Front printed page 4 (PDF 6); back printed page 7 (PDF 9)",
      evidence: { models: ["AP-635"], front: `${ap635Guide}#page=6`, rear: `${ap635Guide}#page=9` },
      note: "The AP-635 cover and underside follow Figures 1 and 3 of the May 2025 installation guide.",
      limitations: [
        "Rear means the mounting underside. Ethernet and DC sockets occupy its lower-right diagonal edge; connector art remains upright in this projection.",
        "Curved perimeter heatsink ribs are represented by straight fin segments. The cover's decorative swirl and optional mounting kits are omitted.",
      ],
      catalogDiscrepancies: [
        "New catalog instances append the Micro-B serial console. Existing E0/E1 inventory indices are retained. The USB host connector and DC power jack remain nonconnectable artwork.",
      ],
      chassis: { x: .04, y: .04, width: .92, height: .92, shape: "square" },
      faces: ap635Panels(canonical.device.ports),
    };
  }
  return ap635Profile;
}

/** Create one normalized, nonconnectable access-point shell detail. */
function part(kind, x, y, width, height, label, variant) {
  return { kind, x, y, width, height, ...(label ? { label } : {}), ...(variant ? { variant } : {}) };
}

/** Attach a stable canonical inventory endpoint to an observed underside socket. */
function socket(port, x, y, width, height, connectorKind) {
  return { portIndex: port.portIndex, type: port.type, label: port.label, x, y, width, height, connectorKind };
}

/** Trace the AP-635's four cover indicators, mounting rail, recessed USB and diagonal Ethernet/DC cluster. */
function ap635Panels(ports) {
  const front = [part("text", .30, .47, .40, .065, "HPE Aruba")];
  for (const [index, label] of ["SYS", "2GHz", "5GHz", "6GHz"].entries()) {
    front.push(part("led", .421 + index * .042, .872 + index * .014, .012, .012),
      part("text", .407 + index * .042, .937, .041, .018, label));
  }
  return {
    front: { ports: [], components: front },
    rear: { ports: [socket(ports[0], .713, .839, .062, .067, "rj45"),
      socket(ports[1], .791, .762, .062, .067, "rj45"), socket(ports[2], .50, .148, .047, .025, "usb-micro")],
    components: [
      part("usb", .486, .035, .029, .07), part("button", .493, .24, .013, .013, undefined, "reset"),
      part("power", .847, .656, .052, .052, undefined, "dc-barrel"),
      part("vent", .940, .24, .027, .01, undefined, "slit"),
      part("handle", .16, .455, .68, .10), part("module-bay", .36, .60, .28, .16, undefined, "populated"),
      part("vent", .15, .025, .29, .13, undefined, "fins"), part("vent", .58, .025, .25, .13, undefined, "fins"),
      part("vent", .025, .19, .125, .55), part("vent", .85, .28, .12, .30),
      part("vent", .17, .845, .39, .13, undefined, "louver"),
    ] },
  };
}
