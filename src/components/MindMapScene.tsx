import type { MindNode, NodeId, PathEdge } from '@/mindmap/types'
import type { PointerPayload } from '@/renderer/types'
import { collapsedCounts } from '@/mindmap/list'
import { EdgeScene } from './EdgeScene'
import { NodeScene } from './NodeScene'

/**
 * The full mind-map scene rendered into the canvas: a viewport group holding
 * the branches (behind) and the nodes (in front).
 */
export function MindMapScene ({
  list,
  paths,
  scale,
  offsetX,
  offsetY,
  hoveredId,
  selectedIds,
  marquee,
  metaPressing,
  onColor,
  onDragStart,
  onEdit,
  onAdd,
  onRemove,
  onToggleCollapsed
}: {
  list: Map<NodeId, MindNode>
  paths: Map<string, PathEdge>
  scale: number
  offsetX: number
  offsetY: number
  hoveredId: string | null
  selectedIds: Set<NodeId>
  marquee: { x: number; y: number; w: number; h: number } | null
  metaPressing: boolean
  onColor: (edge: PathEdge, e: PointerPayload) => void
  onDragStart: (node: MindNode, e: PointerPayload) => void
  onEdit: (node: MindNode) => void
  onAdd: (node: MindNode) => void
  onRemove: (id: NodeId) => void
  onToggleCollapsed: (node: MindNode) => void
}) {
  // Folded branches: their descendants (and the edges into them) are not drawn.
  const counts = collapsedCounts(list)
  // Junction axis per node: the end tangent of the edge arriving at it. Every
  // edge leaving a node cuts its start notch along this shared axis, so the
  // siblings' cut-outs coincide and the parent's tip nests into one clean V.
  const junctionDir = new Map<NodeId, { x: number; y: number }>()
  for (const edge of paths.values()) {
    let dx = edge.x4 - edge.x3
    let dy = edge.y4 - edge.y3
    if (Math.hypot(dx, dy) < 0.01) {
      dx = edge.x4 - edge.x
      dy = edge.y4 - edge.y
    }
    junctionDir.set(edge.toID, { x: dx, y: dy })
  }
  return (
    <group x={offsetX} y={offsetY} scale={scale}>
      {Array.from(paths.values())
        .filter((edge) => list.get(edge.toID)?.hidden !== true)
        .map((edge) => (
          <EdgeScene
            key={edge.id}
            edge={edge}
            junction={junctionDir.get(edge.fromID)}
            onColor={onColor}
          />
        ))}
      {Array.from(list.values())
        .filter((node) => !node.hidden)
        .map((node) => (
          <NodeScene
            key={String(node.id)}
            node={node}
            hovered={hoveredId === String(node.id)}
            selected={selectedIds.has(node.id)}
            metaPressing={metaPressing}
            collapsedCount={counts.get(node.id)}
            onDragStart={onDragStart}
            onEdit={onEdit}
            onAdd={onAdd}
            onRemove={onRemove}
            onToggleCollapsed={onToggleCollapsed}
          />
        ))}
      {marquee && (
        <box
          x={marquee.x}
          y={marquee.y}
          width={marquee.w}
          height={marquee.h}
          fill="rgba(64, 158, 255, 0.08)"
          stroke="#409eff"
          strokeWidth={1}
        />
      )}
    </group>
  )
}
