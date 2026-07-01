import type { PathEdge } from '@/mindmap/types'
import type { PointerPayload } from '@/renderer/types'

/** Scene subtree for one branch: bezier curve + arrow-heads at both ends. */
export function EdgeScene ({
  edge,
  onColor
}: {
  edge: PathEdge
  onColor: (edge: PathEdge, e: PointerPayload) => void
}) {
  return (
    <group>
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
        onClick={(e) => onColor(edge, e)}
      />
      <triangle
        x={edge.x4}
        y={edge.y4}
        size={edge.strokeWidth}
        pointRight={edge.isRightSide}
        fill={edge.stroke}
      />
      <triangle
        x={edge.x}
        y={edge.y}
        size={edge.strokeWidth + 1}
        pointRight={!edge.isRightSide}
        fill={edge.stroke}
        stroke="#ffffff"
        strokeWidth={1}
      />
    </group>
  )
}
