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
/** Floor of the edit overlay's box, in node px. One number for the resize
 *  clamp, the textarea's own size and the "was this ever resized?" test below:
 *  while the CSS floor and the drag clamp were separate, dragging a node
 *  narrower kept shrinking `width` under a box that had stopped moving, and
 *  the node snapped out to `DEFAULT_WRAP_WIDTH` the moment the editor closed. */
export const EDITOR_MIN_W = 300
export const EDITOR_MIN_H = 74
/** However much padding a node subtracts, its text still gets a column. */
const MIN_WRAP_WIDTH = 80

/**
 * Which side of the editing textarea the markdown toolbar sits on. It is
 * always outside the textarea's box — a bar painted over the text is what made
 * the first lines of a long node invisible — and above it by default, except
 * when the overlay hangs upwards from its anchor (`anchorY === 'bottom'`),
 * where "above" would put the bar off the top of the node.
 */
export function editorToolbarSide (
  anchorY: 'top' | 'bottom' | 'center'
): 'top' | 'bottom' {
  return anchorY === 'bottom' ? 'bottom' : 'top'
}

/** The width a node's markdown wraps at. */
export function wrapWidthFor (node: MindNode): number {
  if (node.sticky) return Math.max(MIN_WRAP_WIDTH, node.width - STICKY_PAD * 2)
  // A width under the editor's floor was never visible to the user (the 140px
  // default that editing writes back included), so it is not a wrap column
  // anyone chose — treat it as "never resized".
  const base = node.width >= EDITOR_MIN_W ? node.width : DEFAULT_WRAP_WIDTH
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
