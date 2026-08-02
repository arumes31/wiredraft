export const CableMode = Object.freeze({
  IDLE: "IDLE",
  DRAFTING_CABLE: "DRAFTING_CABLE",
  SELECTED_LINK: "SELECTED_LINK",
});

export function cableBezier(source, target) {
  const distance = Math.hypot(target.x - source.x, target.y - source.y);
  const slack = Math.max(55, Math.min(220, distance * 0.34));
  return {
    source,
    target,
    cp1: { x: source.x, y: source.y + slack },
    cp2: { x: target.x, y: target.y - slack },
  };
}

export function pointOnBezier(curve, t) {
  const mt = 1 - t;
  return {
    x: mt ** 3 * curve.source.x + 3 * mt ** 2 * t * curve.cp1.x + 3 * mt * t ** 2 * curve.cp2.x + t ** 3 * curve.target.x,
    y: mt ** 3 * curve.source.y + 3 * mt ** 2 * t * curve.cp1.y + 3 * mt * t ** 2 * curve.cp2.y + t ** 3 * curve.target.y,
  };
}

export function distanceToCurve(point, curve) {
  let minimum = Number.POSITIVE_INFINITY;
  let previous = curve.source;
  for (let index = 1; index <= 32; index += 1) {
    const current = pointOnBezier(curve, index / 32);
    minimum = Math.min(minimum, distanceToSegment(point, previous, current));
    previous = current;
  }
  return minimum;
}

function distanceToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}
