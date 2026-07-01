import type { MindNode, NodeId } from '@/mindmap/types'
import type { PointerPayload } from '@/renderer/types'
import { measureMarkdown } from '@/markdown/measure'

const ROOT_PLACEHOLDER = '🖱Double click to edit'
const NODE_PLACEHOLDER = '🖱Double click to edit that'

const ROOT_PAD_X = 16
const ROOT_PAD_Y = 8
const GAP = 8
const SELECT_COLOR = '#409eff'

/** Text placement relative to the node point, mirroring Node.vue's CSS. */
function nodeTextOffset (
  node: MindNode,
  w: number,
  h: number
): { x: number; y: number } {
  if (node.isHaveChildren) {
    return {
      x: node.isRightSide ? -w : 0,
      y: node.isUpSide ? -h - GAP : GAP
    }
  }
  return {
    x: node.isRightSide ? GAP : -w - GAP,
    y: -h / 2
  }
}

export interface NodeSceneProps {
  node: MindNode
  hovered: boolean
  selected: boolean
  metaPressing: boolean
  onDragStart: (node: MindNode, e: PointerPayload) => void
  onEdit: (node: MindNode) => void
  onAdd: (node: MindNode) => void
  onRemove: (id: NodeId) => void
}

export function NodeScene ({
  node,
  hovered,
  selected,
  metaPressing,
  onDragStart,
  onEdit,
  onAdd,
  onRemove
}: NodeSceneProps) {
  const isRoot = node.component === 'root'
  const isPlaceholder = node.name === ''
  const text = isPlaceholder
    ? isRoot
      ? ROOT_PLACEHOLDER
      : NODE_PLACEHOLDER
    : node.name
  const align: 'left' | 'right' = isRoot ? 'left' : node.isRightSide ? 'left' : 'right'

  const layout = measureMarkdown(text, { align })

  // Editing is handled by the DOM textarea overlay.
  if (node.editing) return null

  const opacity = isPlaceholder ? 0.8 : 1

  if (isRoot) {
    const boxW = layout.width + ROOT_PAD_X * 2
    const boxH = layout.height + ROOT_PAD_Y * 2
    return (
      <group x={node.x} y={node.y}>
        {selected && (
          <box
            x={-boxW / 2 - 4}
            y={-boxH / 2 - 4}
            width={boxW + 8}
            height={boxH + 8}
            radius={7}
            stroke={SELECT_COLOR}
            strokeWidth={2}
          />
        )}
        <box
          x={-boxW / 2}
          y={-boxH / 2}
          width={boxW}
          height={boxH}
          radius={4}
          fill="#ffffff"
          stroke="#000000"
          strokeWidth={1}
          cursor="move"
          hitId={String(node.id)}
          onPointerDown={(e) => onDragStart(node, e)}
          onDoubleClick={() => onEdit(node)}
        />
        <markdown
          x={-boxW / 2 + ROOT_PAD_X}
          y={-boxH / 2 + ROOT_PAD_Y}
          layout={layout}
          opacity={opacity}
        />
        {hovered && (
          <plus
            x={0}
            y={boxH / 2 + 2}
            radius={10}
            color="#000000"
            hitId={String(node.id)}
            onPointerDown={() => {}}
            onClick={() => onAdd(node)}
          />
        )}
      </group>
    )
  }

  const { x: tx, y: ty } = nodeTextOffset(node, layout.width, layout.height)
  return (
    <group x={node.x} y={node.y}>
      {selected && (
        <box
          x={tx - 4}
          y={ty - 4}
          width={layout.width + 8}
          height={layout.height + 8}
          radius={7}
          stroke={SELECT_COLOR}
          strokeWidth={2}
        />
      )}
      <box
        x={tx}
        y={ty}
        width={layout.width}
        height={layout.height}
        hitOnly
        cursor="move"
        hitId={String(node.id)}
        onPointerDown={(e) => onDragStart(node, e)}
        onDoubleClick={() => onEdit(node)}
      />
      <markdown x={tx} y={ty} layout={layout} opacity={opacity} />
      {hovered && (
        <plus
          x={0}
          y={0}
          radius={10}
          color="#000000"
          cross={metaPressing}
          hitId={String(node.id)}
          onPointerDown={() => {}}
          onClick={(e) =>
            e.originalEvent.metaKey ? onRemove(node.id) : onAdd(node)
          }
        />
      )}
    </group>
  )
}
