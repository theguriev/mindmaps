/**
 * Shared node geometry: the measured markdown layout a node draws with and the
 * world-space box it occupies. Used by the scene (drawing), the marquee and
 * zoom-to-fit (selection/bounds) and drag-to-reparent (drop targeting), so all
 * of them agree on where a node visually is.
 */
import type { MindNode } from '@/mindmap/types'
import { measureMarkdown } from '@/markdown/measure'
import type { MarkdownLayout } from '@/markdown/layout'

export const ROOT_PLACEHOLDER = '🖱Double click to edit'
export const NODE_PLACEHOLDER = '🖱Double click to edit that'
export const STICKY_PLACEHOLDER = 'Sticky note'

export const ROOT_PAD_X = 16
export const ROOT_PAD_Y = 8
export const GAP = 8
export const STICKY_PAD = 16
export const STICKY_FONT =
  "'Bradley Hand', 'Chalkboard SE', 'Comic Sans MS', 'Comic Neue', cursive"

/** Text placement relative to the node point, mirroring Node.vue's CSS. */
export function nodeTextOffset (
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

/** The measured layout a node draws with (placeholder text when empty). */
export function nodeLayoutFor (
  node: MindNode
): { layout: MarkdownLayout; isPlaceholder: boolean } {
  const isPlaceholder = node.name === ''
  if (node.sticky) {
    return {
      layout: measureMarkdown(isPlaceholder ? STICKY_PLACEHOLDER : node.name, {
        align: 'left',
        fontFamily: STICKY_FONT
      }),
      isPlaceholder
    }
  }
  const isRoot = node.component === 'root'
  const align: 'left' | 'right' = isRoot ? 'left' : node.isRightSide ? 'left' : 'right'
  const text = isPlaceholder
    ? isRoot
      ? ROOT_PLACEHOLDER
      : NODE_PLACEHOLDER
    : node.name
  return { layout: measureMarkdown(text, { align }), isPlaceholder }
}

export interface NodeRect {
  x: number
  y: number
  w: number
  h: number
}

/** World-space box the node visually occupies (text box / root box / sticky). */
export function nodeBounds (node: MindNode): NodeRect {
  if (node.sticky) {
    return { x: node.x, y: node.y, w: node.width, h: node.height }
  }
  const { layout } = nodeLayoutFor(node)
  if (node.component === 'root') {
    const w = layout.width + ROOT_PAD_X * 2
    const h = layout.height + ROOT_PAD_Y * 2
    return { x: node.x - w / 2, y: node.y - h / 2, w, h }
  }
  const { x, y } = nodeTextOffset(node, layout.width, layout.height)
  return { x: node.x + x, y: node.y + y, w: layout.width, h: layout.height }
}
