import { routeSegments } from "./cabling.js";

const BADGE_ROUTE_INSET = 26;
const BADGE_LINE_OFFSET = 9;
const MIN_LABEL_RUN = 34;

export function linkEndpointBadges(topology, link, route) {
  const endpoints = endpointIndex(topology);
  const source = endpoints.ports.get(link?.sourcePortId);
  const target = endpoints.ports.get(link?.targetPortId);
  if (!source || !target || !route) return [];
  return [
    {
      id: `${link.id}:source`,
      linkId: link.id,
      endpoint: "source",
      text: `➔ ${compactEndpoint(target, endpoints.racks)}`,
      fullText: `${target.device.name}:${target.port.label}`,
      ...routeEndPlacement(route, "source"),
    },
    {
      id: `${link.id}:target`,
      linkId: link.id,
      endpoint: "target",
      text: `⇠ ${compactEndpoint(source, endpoints.racks)}`,
      fullText: `${source.device.name}:${source.port.label}`,
      ...routeEndPlacement(route, "target"),
    },
  ];
}

export function layoutEndpointBadges(badges, options = {}) {
  const charWidth = Number(options.charWidth) || 4.1;
  const height = Number(options.height) || 10;
  const padding = Number(options.padding) || 5;
  const placed = [];
  return badges.map((badge) => {
    const width = Math.max(26, badge.text.length * charWidth + padding * 2);
    const candidates = [0, -height, height, -height * 2, height * 2].map((shift) => ({
      x: badge.x,
      y: badge.y + shift,
      rect: { x: badge.x - width / 2, y: badge.y + shift - height / 2, width, height },
    }));
    const chosen = candidates.find((candidate) => placed.every((rect) => !rectanglesOverlap(candidate.rect, rect))) || candidates[0];
    placed.push(chosen.rect);
    return { ...badge, ...chosen, width, height };
  });
}

function endpointIndex(topology) {
  const devices = topology?.devices || [];
  return {
    racks: new Map((topology?.racks || []).map((rack) => [rack.id, rack])),
    ports: new Map(devices.flatMap((device) => (device.ports || []).map((port) => [port.id, { device, port }]))),
  };
}

function compactEndpoint(endpoint, racks) {
  const rack = racks.get(endpoint.device.rackId);
  const rackName = String(rack?.name || endpoint.device.location?.rack || "").trim();
  const rackCode = rackName.replace(/^RACK\s+/i, "").replace(/\s+/g, " ");
  const owner = rackCode || String(endpoint.device.name || "DEVICE").trim();
  return `${owner}:${endpoint.port.label}`;
}

function routeEndPlacement(route, endpoint) {
  const sourceSide = endpoint === "source";
  const original = routeSegments(route);
  const candidates = sourceSide ? original.slice(0, 3) : original.slice(-3).reverse();
  const segment = candidates.find((candidate) => horizontal(candidate) && segmentLength(candidate) >= MIN_LABEL_RUN) ||
    candidates.find((candidate) => segmentLength(candidate) >= MIN_LABEL_RUN) || candidates[0];
  if (!segment) return { x: 0, y: 0, orientation: "horizontal" };
  const near = sourceSide ? segment.source : segment.target;
  const far = sourceSide ? segment.target : segment.source;
  const length = Math.max(1, segmentLength(segment));
  const ratio = Math.min(.5, BADGE_ROUTE_INSET / length);
  const anchor = { x: near.x + (far.x - near.x) * ratio, y: near.y + (far.y - near.y) * ratio };
  if (horizontal(segment)) {
    return { x: anchor.x, y: anchor.y + (sourceSide ? -BADGE_LINE_OFFSET : BADGE_LINE_OFFSET), orientation: "horizontal" };
  }
  return { x: anchor.x + (sourceSide ? BADGE_LINE_OFFSET : -BADGE_LINE_OFFSET), y: anchor.y, orientation: "vertical" };
}

function horizontal(segment) {
  return Math.abs(segment.source.y - segment.target.y) < .001;
}

function segmentLength(segment) {
  return Math.hypot(segment.target.x - segment.source.x, segment.target.y - segment.source.y);
}

function rectanglesOverlap(left, right) {
  return left.x < right.x + right.width && left.x + left.width > right.x &&
    left.y < right.y + right.height && left.y + left.height > right.y;
}
