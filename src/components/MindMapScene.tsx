import type { MindNode, NodeId, PathEdge } from '@/mindmap/types'
import type { PointerPayload } from '@/renderer/types'
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
  metaPressing,
  onColor,
  onDragStart,
  onEdit,
  onAdd,
  onRemove
}: {
  list: Map<NodeId, MindNode>
  paths: Map<string, PathEdge>
  scale: number
  offsetX: number
  offsetY: number
  hoveredId: string | null
  metaPressing: boolean
  onColor: (edge: PathEdge, e: PointerPayload) => void
  onDragStart: (node: MindNode, e: PointerPayload) => void
  onEdit: (node: MindNode) => void
  onAdd: (node: MindNode) => void
  onRemove: (id: NodeId) => void
}) {
  return (
    <group x={offsetX} y={offsetY} scale={scale}>
      {Array.from(paths.values()).map((edge) => (
        <EdgeScene key={edge.id} edge={edge} onColor={onColor} />
      ))}
      {Array.from(list.values()).map((node) => (
        <NodeScene
          key={String(node.id)}
          node={node}
          hovered={hoveredId === String(node.id)}
          metaPressing={metaPressing}
          onDragStart={onDragStart}
          onEdit={onEdit}
          onAdd={onAdd}
          onRemove={onRemove}
        />
      ))}
    </group>
  )
}
