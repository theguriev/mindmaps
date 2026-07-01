/** Small geometry helpers shared by hit-testing. */

export function cubicPoint (
  t: number,
  p0: number,
  p1: number,
  p2: number,
  p3: number
): number {
  const mt = 1 - t
  return (
    mt * mt * mt * p0 +
    3 * mt * mt * t * p1 +
    3 * mt * t * t * p2 +
    t * t * t * p3
  )
}

/** Minimum distance from (px,py) to a cubic bezier, sampled at `steps` points. */
export function distanceToCubic (
  px: number,
  py: number,
  x1: number,
  y1: number,
  cx1: number,
  cy1: number,
  cx2: number,
  cy2: number,
  x2: number,
  y2: number,
  steps = 24
): number {
  let min = Infinity
  let prevX = x1
  let prevY = y1
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const x = cubicPoint(t, x1, cx1, cx2, x2)
    const y = cubicPoint(t, y1, cy1, cy2, y2)
    const d = distanceToSegment(px, py, prevX, prevY, x, y)
    if (d < min) min = d
    prevX = x
    prevY = y
  }
  return min
}

export function distanceToSegment (
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const dx = bx - ax
  const dy = by - ay
  const lenSq = dx * dx + dy * dy
  let t = lenSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  const cx = ax + t * dx
  const cy = ay + t * dy
  return Math.hypot(px - cx, py - cy)
}

export function pointInTriangle (
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number
): boolean {
  const d1 = sign(px, py, ax, ay, bx, by)
  const d2 = sign(px, py, bx, by, cx, cy)
  const d3 = sign(px, py, cx, cy, ax, ay)
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0
  return !(hasNeg && hasPos)
}

function sign (
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  return (px - bx) * (ay - by) - (ax - bx) * (py - by)
}
