import type { PathEdge } from '@/mindmap/types'
import type { PointerPayload } from '@/renderer/types'

/** Scene subtree for one branch: just the bezier curve (clickable to recolour).
 *  Arrow-heads are drawn in a separate pass (see EdgeArrow) so they always sit
 *  on top of every branch. */
export function EdgeScene ({
  edge,
  onColor
}: {
  edge: PathEdge
  onColor: (edge: PathEdge, e: PointerPayload) => void
}) {
  return (
    <bezier
      x1={edge.x}
      y1={edge.y}
      cx1={edge.x2}
      cy1={edge.y2}
      cx2={edge.x3}
      cy2={edge.y3}
      x2={edge.x4}
      y2={edge.y4}
      stroke={edge.stroke}
      strokeWidth={edge.strokeWidth}
      dash={edge.lineStyle === 'dashed'}
      hitPadding={5}
      cursor="pointer"
      // Consume the press so an edge click doesn't fall through to the
      // background (which would start a marquee and clear the selection).
      onPointerDown={() => {}}
      onClick={(e) => onColor(edge, e)}
    />
  )
}

/**
 * The arrow-head where a branch meets its node: a solid chevron aligned to the
 * branch's tangent, with a thin white seam behind it so it reads as one branch
 * overlapping the next (rather than a hollow triangle at the joint).
 */
export function EdgeArrow ({ edge }: { edge: PathEdge }) {
  if (edge.sticky) return null
  // Tangent at the child end (fall back to the chord for straight edges).
  let dx = edge.x4 - edge.x3
  let dy = edge.y4 - edge.y3
  if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) {
    dx = edge.x4 - edge.x
    dy = edge.y4 - edge.y
  }
  const angle = Math.atan2(dy, dx)
  const size = edge.strokeWidth * 1.5
  const seam = Math.max(2, edge.strokeWidth * 0.35)
  return (
    <>
      {/* white seam sits just behind the arrow, along the branch */}
      <triangle
        x={edge.x4 - Math.cos(angle) * seam}
        y={edge.y4 - Math.sin(angle) * seam}
        size={size}
        pointRight
        rotation={angle}
        notch={0.5}
        fill="#ffffff"
      />
      <triangle
        x={edge.x4}
        y={edge.y4}
        size={size}
        pointRight
        rotation={angle}
        notch={0.5}
        fill={edge.stroke}
      />
    </>
  )
}
