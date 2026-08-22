import type { MindNode, NodeId } from '@/mindmap/types'
import type { PointerPayload } from '@/renderer/types'
import { measureMarkdown } from '@/markdown/measure'
import {
  ROOT_PAD_X,
  ROOT_PAD_Y,
  STICKY_PAD,
  nodeLayoutFor,
  nodeTextOffset
} from './nodeGeometry'

const SELECT_COLOR = '#409eff'
/** Highlight for the prospective new parent while dragging a branch over it. */
const DROP_COLOR = '#10b981'

const STICKY_FILL = '#faf4b0'

/**
 * Where the editing overlay attaches (world space) and which corner of the
 * overlay anchors there — mirroring `nodeTextOffset`, so the overlay lands
 * exactly where the text draws:
 *  - root: centred on its point;
 *  - sticky: top-left at its point;
 *  - leaf: point sits at the near horizontal edge, vertically centred;
 *  - branch (has children): text box is pushed to a side *and* up/down, so the
 *    point sits at a corner (opposite horizontal edge, top/bottom by up-side).
 */
export function editorOverlayAnchor (node: MindNode): {
  x: number
  y: number
  anchorX: 'left' | 'right' | 'center'
  anchorY: 'top' | 'bottom' | 'center'
} {
  if (node.sticky) {
    return { x: node.x, y: node.y, anchorX: 'left', anchorY: 'top' }
  }
  if (node.component === 'root') {
    return { x: node.x, y: node.y, anchorX: 'center', anchorY: 'center' }
  }
  if (node.isHaveChildren) {
    return {
      x: node.x,
      y: node.y,
      anchorX: node.isRightSide ? 'right' : 'left',
      anchorY: node.isUpSide ? 'bottom' : 'top'
    }
  }
  return {
    x: node.x,
    y: node.y,
    anchorX: node.isRightSide ? 'left' : 'right',
    anchorY: 'center'
  }
}

/** Collapsed-branch badge: a pill with the hidden-descendant count; click unfolds. */
function FoldBadge ({
  x,
  y,
  count,
  hitId,
  onClick
}: {
  x: number
  y: number
  count: number
  hitId: string
  onClick: () => void
}) {
  const layout = measureMarkdown('##### ' + count)
  const w = Math.max(20, layout.width + 10)
  return (
    <group x={x} y={y}>
      <box
        x={-w / 2}
        y={-10}
        width={w}
        height={20}
        radius={10}
        fill="#ffffff"
        stroke="#24292e"
        strokeWidth={1.5}
        cursor="pointer"
        hitId={hitId}
        onPointerDown={() => {}}
        onClick={onClick}
      />
      <markdown x={-layout.width / 2} y={-layout.height / 2} layout={layout} />
    </group>
  )
}

/** Hover affordance for folding an expanded branch: a small "−" disc. */
function FoldButton ({
  x,
  y,
  hitId,
  onClick
}: {
  x: number
  y: number
  hitId: string
  onClick: () => void
}) {
  return (
    <group x={x} y={y}>
      <disc
        radius={8}
        fill="#ffffff"
        stroke="#000000"
        strokeWidth={1.5}
        cursor="pointer"
        hitId={hitId}
        onPointerDown={() => {}}
        onClick={onClick}
      />
      <box x={-4} y={-1} width={8} height={2} fill="#000000" />
    </group>
  )
}

export interface NodeSceneProps {
  node: MindNode
  hovered: boolean
  selected: boolean
  metaPressing: boolean
  /** Hidden-descendant count — present only when the node is collapsed. */
  collapsedCount?: number
  /** The node is the prospective new parent of a branch being dragged over it. */
  dropTarget: boolean
  onDragStart: (node: MindNode, e: PointerPayload) => void
  onEdit: (node: MindNode) => void
  onAdd: (node: MindNode) => void
  onRemove: (id: NodeId) => void
  onToggleCollapsed: (node: MindNode) => void
}

export function NodeScene ({
  node,
  hovered,
  selected,
  metaPressing,
  collapsedCount,
  dropTarget,
  onDragStart,
  onEdit,
  onAdd,
  onRemove,
  onToggleCollapsed
}: NodeSceneProps) {
  const isRoot = node.component === 'root'
  const { layout, isPlaceholder } = nodeLayoutFor(node)

  // Editing is handled by the DOM textarea overlay.
  if (node.editing) return null

  // Optional emoji reaction badge, drawn ~24px at the node's top-right corner.
  const reactionLayout = node.reaction ? measureMarkdown('## ' + node.reaction) : null

  const ringColor = dropTarget ? DROP_COLOR : SELECT_COLOR
  const ring = selected || dropTarget

  // Sticky note: a yellow, handwritten card anchored at its top-left corner
  // (so the dashed tether from its parent meets the card, and the edit overlay
  // lines up with it).
  if (node.sticky) {
    return (
      <group x={node.x} y={node.y}>
        {ring && (
          <box
            x={-4}
            y={-4}
            width={node.width + 8}
            height={node.height + 8}
            radius={12}
            stroke={ringColor}
            strokeWidth={2}
          />
        )}
        <box
          x={0}
          y={0}
          width={node.width}
          height={node.height}
          radius={8}
          fill={STICKY_FILL}
          shadow
          cursor="move"
          hitId={String(node.id)}
          onPointerDown={(e) => onDragStart(node, e)}
          onDoubleClick={() => onEdit(node)}
        />
        <markdown
          x={STICKY_PAD}
          y={STICKY_PAD}
          layout={layout}
          opacity={isPlaceholder ? 0.45 : 1}
        />
        {reactionLayout && (
          <markdown
            x={node.width - reactionLayout.width / 2}
            y={-reactionLayout.height / 2}
            layout={reactionLayout}
          />
        )}
        {node.collapsed && collapsedCount !== undefined && (
          <FoldBadge
            x={node.width / 2}
            y={node.height + 2}
            count={collapsedCount}
            hitId={String(node.id)}
            onClick={() => onToggleCollapsed(node)}
          />
        )}
        {hovered && node.isHaveChildren && !node.collapsed && (
          <FoldButton
            x={node.width / 2}
            y={node.height + 2}
            hitId={String(node.id)}
            onClick={() => onToggleCollapsed(node)}
          />
        )}
      </group>
    )
  }

  const opacity = isPlaceholder ? 0.8 : 1

  if (isRoot) {
    const boxW = layout.width + ROOT_PAD_X * 2
    const boxH = layout.height + ROOT_PAD_Y * 2
    return (
      <group x={node.x} y={node.y}>
        {ring && (
          <box
            x={-boxW / 2 - 4}
            y={-boxH / 2 - 4}
            width={boxW + 8}
            height={boxH + 8}
            radius={7}
            stroke={ringColor}
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
        {reactionLayout && (
          <markdown
            x={boxW / 2 - reactionLayout.width / 2}
            y={-boxH / 2 - reactionLayout.height / 2}
            layout={reactionLayout}
          />
        )}
        {node.collapsed && collapsedCount !== undefined ? (
          <FoldBadge
            x={0}
            y={boxH / 2 + 2}
            count={collapsedCount}
            hitId={String(node.id)}
            onClick={() => onToggleCollapsed(node)}
          />
        ) : (
          hovered && (
            <plus
              x={0}
              y={boxH / 2 + 2}
              radius={10}
              color="#000000"
              hitId={String(node.id)}
              onPointerDown={() => {}}
              onClick={() => onAdd(node)}
            />
          )
        )}
        {hovered && node.isHaveChildren && !node.collapsed && (
          <FoldButton
            x={26}
            y={boxH / 2 + 2}
            hitId={String(node.id)}
            onClick={() => onToggleCollapsed(node)}
          />
        )}
      </group>
    )
  }

  const { x: tx, y: ty } = nodeTextOffset(node, layout.width, layout.height)
  return (
    <group x={node.x} y={node.y}>
      {ring && (
        <box
          x={tx - 4}
          y={ty - 4}
          width={layout.width + 8}
          height={layout.height + 8}
          radius={7}
          stroke={ringColor}
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
      {reactionLayout && (
        <markdown
          x={tx + layout.width - reactionLayout.width / 2}
          y={ty - reactionLayout.height / 2}
          layout={reactionLayout}
        />
      )}
      {node.collapsed && collapsedCount !== undefined ? (
        <FoldBadge
          x={0}
          y={0}
          count={collapsedCount}
          hitId={String(node.id)}
          onClick={() => onToggleCollapsed(node)}
        />
      ) : (
        hovered && (
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
        )
      )}
      {hovered && node.isHaveChildren && !node.collapsed && (
        <FoldButton
          x={node.isRightSide ? 18 : -18}
          y={0}
          hitId={String(node.id)}
          onClick={() => onToggleCollapsed(node)}
        />
      )}
    </group>
  )
}
