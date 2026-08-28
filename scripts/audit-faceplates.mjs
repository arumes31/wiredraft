import { hardwareCatalog } from "../web/static/js/catalog.js";
import { resolveFaceplateTemplate } from "../web/static/js/faceplate.js";
import { resolvePhysicalPortGroups } from "../web/static/js/catalog-port-layouts.js";
import { connectorSize } from "../web/static/js/termination.js";

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
  console.table(profiles.map(({ source, ...profile }) => profile));
  if (problems.length) console.table(problems);
}

if (problems.length) process.exitCode = 1;

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
