import { pointOnRoute } from "./cabling.js";

const LABEL_GAP = 5;

export function cableLabelVisibility(topology, hoveredLinkID, showAll = false) {
  const groups = topology?.linkGroups || [];
  const links = topology?.links || [];
  if (showAll) {
    const groupedLinkIDs = new Set(groups.flatMap((group) => group.linkIds));
    return {
      groupIDs: new Set(groups.map((group) => group.id)),
      linkIDs: new Set(links.filter((link) => !groupedLinkIDs.has(link.id)).map((link) => link.id)),
    };
  }
  if (!hoveredLinkID) return { groupIDs: new Set(), linkIDs: new Set() };
  const group = groups.find((candidate) => candidate.linkIds.includes(hoveredLinkID));
  return group
    ? { groupIDs: new Set([group.id]), linkIDs: new Set() }
    : { groupIDs: new Set(), linkIDs: new Set([hoveredLinkID]) };
}

export function placeCableLabels(items, obstacles = []) {
  const placed = [];
  for (const item of items) {
    const preferred = item.candidates?.length ? item.candidates : radialCandidates(item.anchor);
    let position = findPosition(item, preferred, placed, obstacles);
    if (!position) position = findPosition(item, preferred, placed, []);
    if (!position) position = fallbackPosition(item, placed);
    const rect = centeredRect(position, item.width, item.height);
    placed.push({ ...item, x: position.x, y: position.y, rect });
  }
  return placed;
}

export function curveLabelCandidates(curve) {
  const candidates = [];
  const samples = [.5, .4, .6, .32, .68, .24, .76];
  const offsets = [0, 20, -20, 38, -38, 58, -58];
  for (const t of samples) {
    const point = pointOnRoute(curve, t);
    const before = pointOnRoute(curve, Math.max(0, t - .015));
    const after = pointOnRoute(curve, Math.min(1, t + .015));
    const dx = after.x - before.x;
    const dy = after.y - before.y;
    const length = Math.hypot(dx, dy) || 1;
    const normal = { x: -dy / length, y: dx / length };
    for (const offset of offsets) candidates.push({ x: point.x + normal.x * offset, y: point.y + normal.y * offset });
  }
  return candidates;
}

export function radialCandidates(anchor) {
  const candidates = [{ ...anchor }];
  for (const radius of [24, 42, 64, 88, 116, 150]) {
    for (const [x, y] of [[0, -1], [0, 1], [1, 0], [-1, 0], [1, -1], [-1, -1], [1, 1], [-1, 1]]) {
      candidates.push({ x: anchor.x + x * radius, y: anchor.y + y * radius });
    }
  }
  return candidates;
}

export function rectanglesOverlap(left, right, gap = 0) {
  return left.x < right.x + right.width + gap && left.x + left.width + gap > right.x &&
    left.y < right.y + right.height + gap && left.y + left.height + gap > right.y;
}

// pointerBubblePlacement keeps a hover bubble near the pointer while leaving
// the pointer itself outside the panel. The caller can draw the returned tail
// as a speech-bubble pointer without introducing a separate hit target.
export function pointerBubblePlacement(pointer, size, viewport, gap = 16, margin = 8) {
  const placeRight = pointer.x + gap + size.width <= viewport.width - margin;
  const placeBelow = pointer.y + gap + size.height <= viewport.height - margin;
  const x = placeRight ? pointer.x + gap : pointer.x - gap - size.width;
  const y = placeBelow ? pointer.y + gap : pointer.y - gap - size.height;
  const clampedX = Math.max(margin, Math.min(x, viewport.width - size.width - margin));
  const clampedY = Math.max(margin, Math.min(y, viewport.height - size.height - margin));
  const tailX = placeRight ? clampedX : clampedX + size.width;
  const tailY = Math.max(clampedY + 8, Math.min(pointer.y, clampedY + size.height - 8));
  return {
    x: clampedX,
    y: clampedY,
    width: size.width,
    height: size.height,
    tail: {
      point: { ...pointer },
      first: { x: tailX, y: tailY - 5 },
      second: { x: tailX, y: tailY + 5 },
    },
  };
}

function findPosition(item, candidates, placed, obstacles) {
  for (const candidate of candidates) {
    const rect = centeredRect(candidate, item.width, item.height);
    if (placed.some((label) => rectanglesOverlap(rect, label.rect, LABEL_GAP))) continue;
    if (obstacles.some((obstacle) => rectanglesOverlap(rect, obstacle, 3))) continue;
    return candidate;
  }
  return null;
}

function fallbackPosition(item, placed) {
  let step = 0;
  while (step < 10000) {
    const direction = step % 2 === 0 ? 1 : -1;
    const row = Math.ceil(step / 2);
    const candidate = { x: item.anchor.x, y: item.anchor.y + direction * row * (item.height + LABEL_GAP) };
    const rect = centeredRect(candidate, item.width, item.height);
    if (!placed.some((label) => rectanglesOverlap(rect, label.rect, LABEL_GAP))) return candidate;
    step += 1;
  }
  throw new Error("Unable to place cable label");
}

function centeredRect(point, width, height) {
  return { x: point.x - width / 2, y: point.y - height / 2, width, height };
}
