import { resolveFaceplateTemplate } from "./faceplate.js";
import { resolveModelFaceplate } from "./faceplate-models.js";
import { faceplateConnectorSize, portDescriptionPlacement } from "./termination.js";

const modelSlotIndexes = new WeakMap();

/** Keep unmounted round and square AP sockets readable without changing rack occupancy. */
export function faceplateDisplaySize(device, { mounted = false, width = 690 } = {}) {
  const height = Math.max(100, (device.faceplate?.unitsU || 1) * 100);
  const shape = !mounted && device.category === "AccessPoint" ? resolveModelFaceplate(device)?.chassis.shape : null;
  return { width, height: shape === "square" || shape === "circle" ? Math.max(height, width / 2) : height };
}

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
function modelSlot(profile, port, legacyLayout) {
  if (!modelSlotIndexes.has(profile)) {
    const byIndex = new Map();
    const byLabel = new Map();
    for (const [face, panel] of Object.entries(profile.faces)) {
      for (const slot of panel.ports) {
        const located = { ...slot, face };
        if (!byLabel.has(slot.label)) byLabel.set(slot.label, []);
        if (!byIndex.has(slot.portIndex)) byIndex.set(slot.portIndex, []);
        byIndex.get(slot.portIndex).push(located);
        byLabel.get(slot.label).push(located);
      }
    }
    modelSlotIndexes.set(profile, { byIndex, byLabel });
  }
  const { byIndex, byLabel } = modelSlotIndexes.get(profile);
  const sameType = (slot) => !slot.type || slot.type === port.type || slot.compatibleTypes?.includes(port.type);
  if (legacyLayout) return byIndex.get(legacyLayout.portIndexMap?.[port.portIndex])?.find(sameType);
  if (Number.isInteger(port.portIndex) && port.portIndex > 0) return byIndex.get(port.portIndex)?.find(sameType);
  return byLabel.get(port.label)?.find(sameType);
}

/** Reserve horizontal label space once per scene so dense sockets cannot obscure adjacent names. */
function fitPortDescriptions(ports, bounds, chassis) {
  const rows = new Map();
  for (const port of ports) {
    const label = portDescriptionPlacement(port, bounds);
    const defaultFontSize = label.fontSize;
    // Some service columns reserve caption space beyond their adjacent storage/display hardware.
    if (port.descriptionAnchor) Object.assign(label, port.descriptionAnchor, { side: "anchored" });
    label.fontSize = Number.isFinite(label.fontSize) ? Math.max(5.5, Math.min(8, label.fontSize))
      : defaultFontSize;
    label.boxHeight = Number.isFinite(label.boxHeight)
      ? Math.max(7, label.fontSize + 1.5, Math.min(11, label.boxHeight)) : 11;
    label.boxMaxWidth = Math.max(4, Math.min(label.x - chassis.x, chassis.x + chassis.width - label.x) * 2 - 2);
    port.labelPlacement = label;
    const row = Math.floor(label.y / 11);
    if (!rows.has(row)) rows.set(row, []);
    rows.get(row).push(label);
  }
  for (const [row, labels] of rows) {
    const neighbors = [...labels, ...(rows.get(row + 1) || [])].sort((a, b) => a.x - b.x);
    for (let index = 1; index < neighbors.length; index++) {
      const left = neighbors[index - 1]; const right = neighbors[index];
      if (Math.abs(left.y - right.y) >= (left.boxHeight + right.boxHeight) / 2 || right.x - left.x < 1) continue;
      const available = Math.max(4, right.x - left.x - 2);
      left.boxMaxWidth = Math.min(left.boxMaxWidth, available);
      right.boxMaxWidth = Math.min(right.boxMaxWidth, available);
    }
  }
  for (const port of ports) {
    port.labelPlacement.maxWidth = Math.max(1, Math.min(port.labelPlacement.maxWidth, port.labelPlacement.boxMaxWidth - 6));
  }
}

/** Build the shared physical scene for drawing, picking, routing and export. */
export function buildFaceplateScene(device, bounds, { face } = {}) {
  const profile = resolveModelFaceplate(device);
  const template = resolveFaceplateTemplate(device);
  const selectedFace = profile && (face === "front" || face === "rear") ? face : profile?.defaultFace || "front";
  const chassis = profile ? worldRectangle(profile.chassis, bounds) : { ...bounds };
  if (profile) {
    // Keep application identity outside the traced hardware, including top-edge vents and labels.
    const titleHeight = Math.min(16, chassis.height * .2);
    chassis.y += titleHeight;
    chassis.height -= titleHeight;
    if (["circle", "square"].includes(chassis.shape)) {
      const diameter = Math.min(chassis.width, chassis.height);
      chassis.x += (chassis.width - diameter) / 2;
      chassis.y += (chassis.height - diameter) / 2;
      chassis.width = diameter;
      chassis.height = diameter;
    }
  }
  const components = profile ? profile.faces[selectedFace].components.map((component) => worldRectangle(component, chassis)) : [];
  if (profile) {
    components.push({ kind: "text", x: bounds.x + 24, y: bounds.y + 1,
      width: bounds.width - 110, height: 12, fontSize: 8, ink: "#dce8e9", label: device.name || device.model, applicationOverlay: true });
    components.push({ kind: "text", x: bounds.x + bounds.width - 68, y: bounds.y + 2,
      width: 48, height: 10, fontSize: 7, ink: "#dce8e9", label: selectedFace.toUpperCase(), applicationOverlay: true });
  }
  const ports = [];
  const hidden = [];
  const unmappedPorts = [];
  const claimedSlots = new Set();
  const inventoryRevision = device.faceplate?.inventoryRevision || 0;
  // Revision maps never infer identities from renamed labels or a coincidental port count.
  const legacyLayout = profile && inventoryRevision !== (profile.inventoryRevision || 0)
    ? profile.legacyLayouts?.find((layout) => layout.inventoryRevision === inventoryRevision) || {}
    : null;
  for (const [index, port] of (device.ports || []).entries()) {
    let slot = profile ? modelSlot(profile, port, legacyLayout) : null;
    if (slot && claimedSlots.has(slot)) slot = null;
    if (slot) claimedSlots.add(slot);
    if (profile?.fidelity === "model" && !slot) {
      // Old or customized inventories remain routable without adding fictitious physical sockets.
      unmappedPorts.push(port);
      hidden.push(port);
      continue;
    }
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
    }), physicalFace, connectorKind: slot.connectorKind,
    ...(slot.descriptionAnchor ? { descriptionAnchor: {
      x: chassis.x + slot.descriptionAnchor.x * chassis.width,
      y: chassis.y + slot.descriptionAnchor.y * chassis.height,
      ...(slot.descriptionAnchor.fontSize !== undefined ? { fontSize: slot.descriptionAnchor.fontSize } : {}),
      ...(slot.descriptionAnchor.boxHeight !== undefined ? { boxHeight: slot.descriptionAnchor.boxHeight } : {}),
    } } : {}),
    displayLabel: slot.physicalLabel && port.label === (legacyLayout?.portLabels?.[port.portIndex] ?? slot.label)
      ? slot.physicalLabel : port.label });
  }
  if (profile) fitPortDescriptions(ports, chassis, chassis);
  // Keep connection markers outside the physical panel, including fully populated rear faces.
  const portal = hidden.length ? {
    x: bounds.x + bounds.width - 225, y: bounds.y + 1, width: 150, height: 12,
    label: unmappedPorts.length ? (unmappedPorts.length === hidden.length ? "UNMAPPED INVENTORY" : "OTHER CONNECTIONS")
    : `${selectedFace === "front" ? "REAR" : "FRONT"} CONNECTIONS` } : null;
  if (portal) components.at(-2).width = Math.max(0, portal.x - components.at(-2).x - 8);
  const hiddenPorts = hidden.map((port, index) => ({
    ...portBox(port, device, portal.x + 8 + (index + 1) * (portal.width - 16) / (hidden.length + 1),
      portal.y + portal.height / 2, { width: 4, height: 4 }),
    portal: true,
  }));
  return { profile, template, face: selectedFace, chassis, components, ports, hiddenPorts, unmappedPorts, portal };
}
