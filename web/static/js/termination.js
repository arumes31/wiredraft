import { pointOnBezier, routeSegments } from "./cabling.js";

export function connectorKind(type = "") {
  if (type === "OSFP_800G") return "osfp";
  if (type.startsWith("CFP")) return "cfp";
  if (type.startsWith("QSFP")) return "qsfp";
  if (type.startsWith("SFP")) return "sfp";
  if (type === "FIBER_LC") return "lc";
  if (type === "FIBER_SC") return "sc";
  if (type === "FIBER_MPO") return "mpo";
  if (type === "USB_MICRO_CONSOLE") return "usb-micro";
  if (type === "USB_C_CONSOLE") return "usb-c";
  if (type === "Stack") return "stack";
  if (type === "DSL_RJ11") return "dsl";
  if (type === "Console") return "console";
  if (type === "Power") return "power";
  return "rj45";
}

export function connectorSize(type = "") {
  const kind = connectorKind(type);
  if (kind === "osfp") return { width: 25, height: 16 };
  if (kind === "cfp") return { width: type === "CFP_100G" ? 30 : type === "CFP2_100G" ? 25 : 21, height: 16 };
  if (kind === "qsfp") return { width: 21, height: 15 };
  if (kind === "sfp") return { width: 17, height: 12 };
  if (kind === "lc") return { width: 16, height: 12 };
  if (kind === "sc") return { width: 15, height: 15 };
  if (kind === "mpo") return { width: 20, height: 11 };
  if (kind === "usb-micro") return { width: 14, height: 7 };
  if (kind === "usb-c") return { width: 15, height: 7 };
  if (kind === "stack") return { width: 22, height: 16 };
  if (kind === "dsl") return { width: 14, height: 11 };
  if (kind === "console") return { width: 16, height: 12 };
  if (kind === "power") return { width: 18, height: 16 };
  return { width: 18, height: 14 };
}

export function portLinkLEDColor(status) {
  return status === "up" ? "#42d98b" : "#2d393b";
}

// Returns the original cable curve from just outside the device faceplate to
// the port. Redrawing this exact subcurve above the device keeps the cable
// continuous while preventing the faceplate from hiding its final section.
export function endpointCurveSegment(curve, side, bounds, padding = 6) {
  const padded = {
    x: bounds.x - padding,
    y: bounds.y - padding,
    width: bounds.width + padding * 2,
    height: bounds.height + padding * 2,
  };
  const isSource = side === "source";
  let insideT = isSource ? 0 : 1;
  let outsideT = null;
  const steps = 160;

  for (let index = 1; index <= steps; index += 1) {
    const t = isSource ? index / steps : 1 - index / steps;
    if (!containsPoint(padded, pointOnBezier(curve, t))) {
      outsideT = t;
      break;
    }
    insideT = t;
  }

  if (outsideT === null) outsideT = isSource ? .25 : .75;
  else {
    for (let iteration = 0; iteration < 12; iteration += 1) {
      const middle = (insideT + outsideT) / 2;
      if (containsPoint(padded, pointOnBezier(curve, middle))) insideT = middle;
      else outsideT = middle;
    }
  }

  const [left, right] = splitBezier(curve, outsideT);
  return isSource ? left : right;
}

export function endpointRouteSegment(route, side, bounds, padding = 6) {
  const segments = routeSegments(route);
  const curve = side === "source" ? segments[0] : segments.at(-1);
  return curve ? endpointCurveSegment(curve, side, bounds, padding) : null;
}

export function portDescriptionPlacement(portBox, deviceBounds) {
  const topHalf = portBox.centerY <= deviceBounds.y + deviceBounds.height / 2;
  const label = String(portBox.port?.label || "");
  return {
    x: portBox.centerX,
    y: topHalf ? portBox.y - 8 : portBox.y + portBox.height + 9,
    side: topHalf ? "above" : "below",
    fontSize: label.length > 10 ? 5.5 : label.length > 6 ? 6.5 : 8,
    maxWidth: label.length > 6 ? 38 : 30,
  };
}

function containsPoint(bounds, point) {
  return point.x >= bounds.x && point.x <= bounds.x + bounds.width &&
    point.y >= bounds.y && point.y <= bounds.y + bounds.height;
}

function splitBezier(curve, t) {
  const p01 = lerpPoint(curve.source, curve.cp1, t);
  const p12 = lerpPoint(curve.cp1, curve.cp2, t);
  const p23 = lerpPoint(curve.cp2, curve.target, t);
  const p012 = lerpPoint(p01, p12, t);
  const p123 = lerpPoint(p12, p23, t);
  const split = lerpPoint(p012, p123, t);
  return [
    { source: curve.source, cp1: p01, cp2: p012, target: split },
    { source: split, cp1: p123, cp2: p23, target: curve.target },
  ];
}

function lerpPoint(start, end, t) {
  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
  };
}
