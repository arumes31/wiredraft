import { hardwareCatalog, instantiateProfile } from "../web/static/js/catalog.js";
import { resolveFaceplateTemplate } from "../web/static/js/faceplate.js";
import { resolvePhysicalPortGroups } from "../web/static/js/catalog-port-layouts.js";
import { connectorSize } from "../web/static/js/termination.js";
import { buildFaceplateScene } from "../web/static/js/faceplate-scene.js";
import { hardwareContainsSocket } from "./faceplate-audit-geometry.mjs";

const profiles = hardwareCatalog.map((profile) => {
  const groups = resolvePhysicalPortGroups(profile);
  const template = resolveFaceplateTemplate({
    model: profile.model,
    category: profile.category,
    faceplate: { vendor: profile.vendor, unitsU: profile.units },
  });
  const portCount = groups.reduce((sum, group) => sum + group.count, 0);
  const positionedPorts = groups.reduce((sum, group) => sum + (group.positions?.length || 0), 0);
  const overlaps = overlappingConnectorPairs(profile, groups);
  return {
    vendor: profile.vendor,
    model: profile.model,
    category: profile.category,
    template: template.id,
    labels: profile.portLayout.labelFidelity,
    positions: profile.portLayout.positionFidelity,
    sourceScope: profile.portLayout.sourceScope,
    portCount,
    positionedPorts,
    overlaps,
    source: profile.portLayout.source,
    ...auditPhysicalPanels(profile),
  };
});

const countBy = (field) => Object.fromEntries(
  [...new Set(profiles.map((profile) => profile[field]))]
    .sort()
    .map((value) => [value, profiles.filter((profile) => profile[field] === value).length]),
);

const problems = profiles.flatMap((profile) => {
  const messages = [];
  if (!profile.source) messages.push("missing evidence source");
  messages.push(...profile.panelProblems);
  if (process.argv.includes("--require-model-specific") && !/^(?:Generic|Static$)/.test(profile.vendor) && profile.panelFidelity !== "model") {
    messages.push("named hardware still requires a verified model-specific layout");
  }
  if (profile.positions === "exact" && profile.positionedPorts !== profile.portCount) {
    messages.push(`exact geometry covers ${profile.positionedPorts}/${profile.portCount} ports`);
  }
  if (profile.positions === "exact" && profile.overlaps.length) {
    messages.push(`exact geometry overlaps: ${profile.overlaps.join(", ")}`);
  }
  if ((profile.labels === "exact" || profile.positions === "exact") && profile.sourceScope !== "model") {
    messages.push("exact fidelity is not backed by model-scoped evidence");
  }
  return messages.map((message) => ({ vendor: profile.vendor, model: profile.model, message }));
});

const report = {
  generatedFrom: "web/static/js/catalog.js",
  total: profiles.length,
  labels: countBy("labels"),
  positions: countBy("positions"),
  sourceScopes: countBy("sourceScope"),
  panelFidelity: countBy("panelFidelity"),
  pendingModelLayouts: profiles.filter((profile) => !/^(?:Generic|Static$)/.test(profile.vendor) && profile.panelFidelity !== "model")
    .map(({ vendor, model, panelFidelity, panelSource }) => ({ vendor, model, fidelity: panelFidelity, source: panelSource })),
  catalogDiscrepancies: profiles.filter((profile) => profile.catalogDiscrepancies.length)
    .map(({ vendor, model, catalogDiscrepancies }) => ({ vendor, model, notes: catalogDiscrepancies })),
  problems,
  profiles,
};

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`Faceplate evidence audit: ${report.total} profiles`);
  console.log(`Labels: ${formatCounts(report.labels)}`);
  console.log(`Positions: ${formatCounts(report.positions)}`);
  console.log(`Source scope: ${formatCounts(report.sourceScopes)}`);
  console.log(`Hardware panels: ${formatCounts(report.panelFidelity)}`);
  console.log(`Named models still awaiting verified model-specific layouts: ${report.pendingModelLayouts.length}`);
  console.table(profiles.map(({ source, ...profile }) => profile));
  if (problems.length) console.table(problems);
}

if (problems.length) process.exitCode = 1;

/** Audit actual front/rear render geometry for every catalog entry, not only exact port maps. */
function auditPhysicalPanels(profile) {
  const device = instantiateProfile(profile, profile.model, { x: 0, y: 0 });
  device.ports.forEach((port, index) => { port.id = String(index); });
  const bounds = { x: 0, y: 0, width: 690, height: Math.max(1, profile.units) * 100 };
  const front = buildFaceplateScene(device, bounds, { face: "front" });
  const rear = buildFaceplateScene(device, bounds, { face: "rear" });
  const panelProblems = [];
  const model = front.profile;
  if (!model) panelProblems.push("missing front/rear hardware scene");
  else {
    if (!["model", "family", "schematic"].includes(model.fidelity)) panelProblems.push("missing panel evidence classification");
    if (!model.source) panelProblems.push("missing hardware reference");
    const ids = [...front.ports, ...rear.ports].map(({ port }) => port.id);
    if (ids.length !== device.ports.length || new Set(ids).size !== device.ports.length) panelProblems.push("panel inventory is duplicated or incomplete");
    for (const scene of [front, rear]) {
      for (const item of scene.components) {
        if (![item.x, item.y, item.width, item.height].every(Number.isFinite) || item.width <= 0 || item.height <= 0) {
          panelProblems.push(`${scene.face} ${item.kind}: invalid component rectangle`);
        } else if (!item.applicationOverlay && (item.x < scene.chassis.x - 1e-6 || item.y < scene.chassis.y - 1e-6 ||
          item.x + item.width > scene.chassis.x + scene.chassis.width + 1e-6 || item.y + item.height > scene.chassis.y + scene.chassis.height + 1e-6)) {
          panelProblems.push(`${scene.face} ${item.kind}: component outside chassis`);
        }
      }
      for (const [index, box] of scene.ports.entries()) {
        if (![box.x, box.y, box.width, box.height].every(Number.isFinite) || box.width <= 0 || box.height <= 0 ||
          box.x < scene.chassis.x - 1e-6 || box.y < scene.chassis.y - 1e-6 ||
          box.x + box.width > scene.chassis.x + scene.chassis.width + 1e-6 ||
          box.y + box.height > scene.chassis.y + scene.chassis.height + 1e-6) panelProblems.push(`${scene.face} ${box.port.label}: socket outside chassis`);
        for (const other of scene.ports.slice(index + 1)) {
          if (rectanglesOverlap(box, other)) panelProblems.push(`${scene.face}: sockets ${box.port.label}/${other.port.label} overlap`);
        }
        for (const item of scene.components.filter((component) => !["text", "led", "ring"].includes(component.kind))) {
          if (hardwareContainsSocket(item, box)) continue;
          if (rectanglesOverlap(box, item)) panelProblems.push(`${scene.face} ${box.port.label}: overlaps ${item.kind}`);
        }
        if (scene.portal && rectanglesOverlap(box, scene.portal)) panelProblems.push(`${scene.face} ${box.port.label}: connection marker covers socket`);
      }
    }
  }
  return { panelFidelity: model?.fidelity || "missing", panelSource: model?.source || "",
    defaultPanel: model?.defaultFace || "front", frontPorts: front.ports.length, rearPorts: rear.ports.length,
    panelProblems, inventoryComplete: model?.inventoryComplete ?? null,
    missingPorts: model?.missingPorts || [], catalogDiscrepancies: model?.catalogDiscrepancies || [] };
}

/** Detect positive-area intersections while allowing touching edges. */
function rectanglesOverlap(a, b) {
  return a.x < b.x + b.width - 1e-6 && a.x + a.width > b.x + 1e-6 &&
    a.y < b.y + b.height - 1e-6 && a.y + a.height > b.y + 1e-6;
}

function formatCounts(counts) {
  return Object.entries(counts).map(([name, count]) => `${name}=${count}`).join(", ");
}

function overlappingConnectorPairs(profile, groups) {
  const width = 690;
  const height = Math.max(1, profile.units) * 80;
  const boxes = groups.flatMap((group) => {
    const base = connectorSize(group.type);
    const scale = group.count >= 48 ? .78 : group.count >= 32 ? .88 : 1;
    return (group.positions || []).map((position, index) => ({
      label: group.labels?.[index] || `${group.prefix || ""}${index + 1}`,
      x: position.x * width - base.width * scale / 2,
      y: position.y * height - base.height * scale / 2,
      width: base.width * scale,
      height: base.height * scale,
    }));
  });
  const overlaps = [];
  for (let left = 0; left < boxes.length; left += 1) {
    for (let right = left + 1; right < boxes.length; right += 1) {
      if (intersects(boxes[left], boxes[right])) overlaps.push(`${boxes[left].label}/${boxes[right].label}`);
    }
  }
  return overlaps;
}

function intersects(left, right) {
  return left.x < right.x + right.width && left.x + left.width > right.x &&
    left.y < right.y + right.height && left.y + left.height > right.y;
}
