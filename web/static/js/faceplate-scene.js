import { resolveFaceplateTemplate } from "./faceplate.js";
import { resolveModelFaceplate } from "./faceplate-models.js";
import { faceplateConnectorSize } from "./termination.js";

/** Convert a normalized model rectangle into world coordinates. */
function worldRectangle(rect, bounds) {
  return {
    ...rect,
    x: bounds.x + rect.x * bounds.width,
    y: bounds.y + rect.y * bounds.height,
    width: rect.width * bounds.width,
    height: rect.height * bounds.height,
  };
}

/** Preserve the established layout for imported and schematic devices. */
function legacyPortBox(port, index, device, bounds) {
  const rows = Math.max(1, Math.min(4, device.faceplate?.rows || 1));
  const columns = Math.ceil((device.ports || []).length / rows);
  const scaleX = bounds.width / 690;
  const available = 475 * scaleX;
  const stepX = columns > 1 ? Math.min(31 * scaleX, available / (columns - 1)) : 0;
  const baseX = bounds.x + 170 * scaleX + Math.max(0, (available - stepX * Math.max(0, columns - 1)) / 2);
  const stepY = rows === 1 ? 0 : 29;
  const positioned = Number.isFinite(port.faceplateX) && Number.isFinite(port.faceplateY)
    && port.faceplateX > 0 && port.faceplateY > 0;
  const centerX = positioned ? bounds.x + port.faceplateX * bounds.width : baseX + Math.floor(index / rows) * stepX;
  const centerY = positioned ? bounds.y + port.faceplateY * bounds.height
    : bounds.y + bounds.height / 2 - stepY * (rows - 1) / 2 + (index % rows) * stepY;
  return portBox(port, device, centerX, centerY, faceplateConnectorSize(port, device));
}

/** Keep socket bounds and cable attachment points derived from one center. */
function portBox(port, device, centerX, centerY, size) {
  return { port, device, x: centerX - size.width / 2, y: centerY - size.height / 2,
    width: size.width, height: size.height, centerX, centerY };
}

/** Resolve a physical slot while allowing users to rename the port label. */
function modelSlot(profile, port) {
  const slots = Object.entries(profile.faces).flatMap(([face, panel]) =>
    panel.ports.map((slot) => ({ ...slot, face })));
  const sameType = (slot) => !slot.type || slot.type === port.type;
  return slots.find((slot) => Number.isInteger(port.portIndex) && slot.portIndex === port.portIndex && sameType(slot))
    || slots.find((slot) => slot.label === port.label && sameType(slot));
}

/** Build the shared physical scene for drawing, picking, routing and export. */
export function buildFaceplateScene(device, bounds, { face } = {}) {
  const profile = resolveModelFaceplate(device);
  const template = resolveFaceplateTemplate(device);
  const selectedFace = profile && (face === "front" || face === "rear") ? face : profile?.defaultFace || "front";
  const chassis = profile ? worldRectangle(profile.chassis, bounds) : { ...bounds };
  const components = profile ? profile.faces[selectedFace].components.map((component) => worldRectangle(component, chassis)) : [];
  if (profile) {
    components.push({ kind: "text", x: chassis.x + 24, y: chassis.y + 3,
      width: chassis.width - 110, height: 12, fontSize: 9, label: device.name || device.model });
    components.push({ kind: "text", x: chassis.x + chassis.width - 68, y: chassis.y + 4,
      width: 48, height: 10, fontSize: 7, label: selectedFace.toUpperCase() });
  }
  const ports = [];
  const hidden = [];
  for (const [index, port] of (device.ports || []).entries()) {
    const slot = profile ? modelSlot(profile, port) : null;
    const physicalFace = slot?.face || profile?.defaultFace || "front";
    if (profile && physicalFace !== selectedFace) {
      hidden.push(port);
      continue;
    }
    if (!slot) {
      ports.push(legacyPortBox(port, index, device, profile ? chassis : bounds));
      continue;
    }
    const size = faceplateConnectorSize(port, device);
    ports.push({ ...portBox(port, device, chassis.x + slot.x * chassis.width, chassis.y + slot.y * chassis.height, {
      width: slot.width ? slot.width * chassis.width : size.width,
      height: slot.height ? slot.height * chassis.height : size.height,
    }), physicalFace });
  }
  const portal = hidden.length ? { x: chassis.x + chassis.width / 2 - 63, y: chassis.y + chassis.height - 17,
    width: 126, height: 13, label: `${selectedFace === "front" ? "REAR" : "FRONT"} CONNECTIONS` } : null;
  const hiddenPorts = hidden.map((port, index) => ({
    ...portBox(port, device, portal.x + 8 + (index + 1) * (portal.width - 16) / (hidden.length + 1),
      portal.y + portal.height / 2, { width: 4, height: 4 }),
    portal: true,
  }));
  return { profile, template, face: selectedFace, chassis, components, ports, hiddenPorts, portal };
}
