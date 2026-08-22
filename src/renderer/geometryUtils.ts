/** Small geometry helpers shared by hit-testing and painting. */
import type { BezierProps } from './types'

/** Unit direction of (dx,dy); falls back to (fx,fy) when degenerate (e.g. a
 *  straight edge whose control point collapses onto the endpoint). */
function unitDir (
  dx: number,
  dy: number,
  fx: number,
  fy: number
): [number, number] {
  if (Math.hypot(dx, dy) < 0.01) {
    dx = fx
    dy = fy
  }
  const len = Math.hypot(dx, dy) || 1
  return [dx / len, dy / len]
}

/**
 * Triangle sharpening the end of a stroked bezier into a tangent-aligned
 * point: [baseX1, baseY1, apexX, apexY, baseX2, baseY2]. The base spans the
 * stroke's butt end, nudged half a pixel back into the stroke so the fill and
 * the stroke merge without an antialiasing hairline.
 */
export function bezierTip (p: BezierProps): number[] {
  const hw = (p.strokeWidth ?? 1) / 2
  const t = p.tipLength ?? 0
  const [ux, uy] = unitDir(p.x2 - p.cx2, p.y2 - p.cy2, p.x2 - p.x1, p.y2 - p.y1)
  const bx = p.x2 - ux * 0.5
  const by = p.y2 - uy * 0.5
  return [
    bx - uy * hw,
    by + ux * hw,
    p.x2 + ux * t,
    p.y2 + uy * t,
    bx + uy * hw,
    by - ux * hw
  ]
}

/**
 * The wedge cut out of the start of a stroked bezier — the notch a parent
 * branch's tip nests into. A closed polygon [x0, y0, x1, y1, ...]: the V's
 * apex, then the two slant lines extended past the stroke edges and squared
 * off behind the butt, so butt corners of strokes leaving the junction at an
 * angle to the notch axis are swallowed too. The cut is aligned to
 * notchDirX/Y (the junction axis) when given, else the start tangent.
 */
export function bezierNotch (p: BezierProps): number[] {
  const w = p.strokeWidth ?? 1
  const hw = w / 2 + 1
  const d = p.notchDepth ?? 0
  const [ux, uy] = unitDir(
    p.notchDirX ?? p.cx1 - p.x1,
    p.notchDirY ?? p.cy1 - p.y1,
    p.x2 - p.x1,
    p.y2 - p.y1
  )
  // Apex, and slant corners at the (oversized) stroke edges, 1px behind the
  // butt so no antialiased slivers of the cap survive.
  const axx = p.x1 + ux * d
  const axy = p.y1 + uy * d
  const c1x = p.x1 - ux - uy * hw
  const c1y = p.y1 - uy + ux * hw
  const c2x = p.x1 - ux + uy * hw
  const c2y = p.y1 - uy - ux * hw
  // Extend the slant lines 40% past the stroke edges (keeping their angle
  // exact), then square off one stroke-width behind the butt.
  const e1x = axx + (c1x - axx) * 1.4
  const e1y = axy + (c1y - axy) * 1.4
  const e2x = axx + (c2x - axx) * 1.4
  const e2y = axy + (c2y - axy) * 1.4
  return [
    axx, axy,
    e1x, e1y,
    e1x - ux * w, e1y - uy * w,
    e2x - ux * w, e2y - uy * w,
    e2x, e2y
  ]
}

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
