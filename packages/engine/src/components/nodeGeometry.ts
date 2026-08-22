/**
 * Shared node geometry: the measured markdown layout a node draws with and the
 * world-space box it occupies. Used by the scene (drawing), the marquee and
 * zoom-to-fit (selection/bounds) and drag-to-reparent (drop targeting), so all
 * of them agree on where a node visually is.
 */
import type { MindNode } from '../mindmap/types'
import { measureMarkdown } from '../markdown/measure'
import type { MarkdownLayout } from '../markdown/layout'

export const ROOT_PLACEHOLDER = '🖱Double click to edit'
export const NODE_PLACEHOLDER = '🖱Double click to edit that'
export const STICKY_PLACEHOLDER = 'Sticky note'

export const ROOT_PAD_X = 16
export const ROOT_PAD_Y = 8
export const GAP = 8
export const STICKY_PAD = 16
export const STICKY_FONT =
  "'Bradley Hand', 'Chalkboard SE', 'Comic Sans MS', 'Comic Neue', cursive"

/** Node markdown soft-wraps at this width unless the node was deliberately
 *  resized (then its own width wins). */
export const DEFAULT_WRAP_WIDTH = 480
/** The edit overlay's textarea never renders narrower than its 300px CSS
 *  floor, so persisted widths below it were never visible to the user (the
 *  140px default that editing writes back included) — treat them as
 *  "never resized" instead of as sub-300px wrap columns. */
const EXPLICIT_MIN_W = 300
const MIN_WRAP_WIDTH = 80

/** The width a node's markdown wraps at. */
export function wrapWidthFor (node: MindNode): number {
  if (node.sticky) return Math.max(MIN_WRAP_WIDTH, node.width - STICKY_PAD * 2)
  const base = node.width >= EXPLICIT_MIN_W ? node.width : DEFAULT_WRAP_WIDTH
  if (node.component === 'root') {
    return Math.max(MIN_WRAP_WIDTH, base - ROOT_PAD_X * 2)
  }
  return Math.max(MIN_WRAP_WIDTH, base)
}

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
  const maxWidth = wrapWidthFor(node)
  if (node.sticky) {
    return {
      layout: measureMarkdown(isPlaceholder ? STICKY_PLACEHOLDER : node.name, {
        align: 'left',
        fontFamily: STICKY_FONT,
        maxWidth
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
  return { layout: measureMarkdown(text, { align, maxWidth }), isPlaceholder }
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
