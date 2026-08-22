import type { PathEdge } from '../mindmap/types'
import type { PointerPayload } from '../renderer/types'

/** Length of a branch's sharpened tip and depth of the notch cut into a child
 *  branch's start, as a multiple of stroke width. Keeping the two equal keeps
 *  their slants parallel, so the seam between them reads as a uniform gap. */
const POINT = 0.75

/** Along-tangent width of the seam: how far a child branch's start is pulled
 *  back from the parent point, letting the background show between the
 *  parent's tip and the child's notch. */
function seamFor (width: number): number {
  return Math.max(2, width * 0.35)
}

/**
 * Scene subtree for one branch: the bezier curve (clickable to recolour). The
 * junction with the parent branch is shaped, not painted over: this branch's
 * end is sharpened into a tangent-aligned point (tipLength), and its start is
 * pulled back and gets a V-notch cut into it (notchDepth) that the parent
 * branch's point nests inside — one arrow slotting into the next, with the
 * background showing through as the seam.
 */
export function EdgeScene ({
  edge,
  junction,
  onColor
}: {
  edge: PathEdge
  /** End tangent of the edge into this edge's start node (the junction axis).
   *  All siblings get the same axis, so their notch cut-outs coincide —
   *  otherwise one sibling's stroke covers another's notch. */
  junction?: { x: number; y: number }
  onColor: (edge: PathEdge, e: PointerPayload) => void
}) {
  const point = edge.sticky ? 0 : edge.strokeWidth * POINT
  // Own start tangent; straight edges collapse their control points onto the
  // endpoints, so fall back to the chord.
  let tx = edge.x2 - edge.x
  let ty = edge.y2 - edge.y
  if (Math.hypot(tx, ty) < 0.01) {
    tx = edge.x4 - edge.x
    ty = edge.y4 - edge.y
  }
  // Prefer the shared junction axis, unless this edge heads back against it
  // (a child dragged to the opposite side of its parent).
  if (junction && junction.x * tx + junction.y * ty > 0) {
    tx = junction.x
    ty = junction.y
  }
  const len = Math.hypot(tx, ty) || 1
  const gap = edge.sticky ? 0 : seamFor(edge.strokeWidth)
  const x1 = edge.x + (tx / len) * gap
  const y1 = edge.y + (ty / len) * gap
  // Keep straight edges' control points collapsed onto the (moved) start, so
  // downstream tangent math falls back to the chord instead of pointing at
  // the stale original start.
  const straight = edge.lineShape === 'straight'
  return (
    <bezier
      x1={x1}
      y1={y1}
      cx1={straight ? x1 : edge.x2}
      cy1={straight ? y1 : edge.y2}
      cx2={edge.x3}
      cy2={edge.y3}
      x2={edge.x4}
      y2={edge.y4}
      stroke={edge.stroke}
      strokeWidth={edge.strokeWidth}
      dash={edge.lineStyle === 'dashed'}
      tipLength={point}
      notchDepth={point}
      notchDirX={tx}
      notchDirY={ty}
      hitPadding={5}
      cursor="pointer"
      // Consume the press so an edge click doesn't fall through to the
      // background (which would start a marquee and clear the selection).
      onPointerDown={() => {}}
      onClick={(e) => onColor(edge, e)}
    />
  )
}
