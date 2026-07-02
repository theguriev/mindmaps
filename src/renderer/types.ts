/**
 * Scene-graph node types for the custom canvas reconciler.
 *
 * Every host element the reconciler knows about is described here. React
 * components produce a tree of these elements; the reconciler commits them into
 * a mutable `SceneNode` tree, and `paint` / `hitTest` walk that tree.
 */
import type { MarkdownLayout } from '@/markdown/layout'

export interface PointerPayload {
  /** Screen-space (CSS px, relative to the canvas) coordinates. */
  screenX: number
  screenY: number
  /** World-space coordinates (after undoing the viewport transform). */
  worldX: number
  worldY: number
  originalEvent: PointerEvent | MouseEvent
}

export type PointerHandler = (e: PointerPayload) => void

/** Handlers/metadata common to every interactive element. */
export interface InteractiveProps {
  onPointerDown?: PointerHandler
  onPointerUp?: PointerHandler
  onClick?: PointerHandler
  onDoubleClick?: PointerHandler
  /** CSS cursor to apply while hovering this element. */
  cursor?: string
  /** When false the element is transparent to hit-testing. */
  interactive?: boolean
  /** Opaque id surfaced back to the host on hover/hit (e.g. a node id). */
  hitId?: string
}

export interface GroupProps extends InteractiveProps {
  /** Translation applied before scale. */
  x?: number
  y?: number
  scale?: number
  scaleX?: number
  scaleY?: number
  opacity?: number
  children?: unknown
}

export interface BoxProps extends InteractiveProps {
  x?: number
  y?: number
  width: number
  height: number
  radius?: number
  fill?: string
  stroke?: string
  strokeWidth?: number
  /** Draw a soft drop shadow under the box (e.g. sticky notes). */
  shadow?: boolean
  /** Draw nothing but still take part in hit-testing (invisible hit area). */
  hitOnly?: boolean
}

export interface DiscProps extends InteractiveProps {
  x?: number
  y?: number
  radius: number
  fill?: string
  stroke?: string
  strokeWidth?: number
}

export interface BezierProps extends InteractiveProps {
  x1: number
  y1: number
  cx1: number
  cy1: number
  cx2: number
  cy2: number
  x2: number
  y2: number
  stroke?: string
  strokeWidth?: number
  /** Render as a dashed line. */
  dash?: boolean
  /** Extra world-space radius added to the stroke for easier clicking. */
  hitPadding?: number
}

/** Filled isosceles triangle used for branch arrow-heads. */
export interface TriangleProps extends InteractiveProps {
  x?: number
  y?: number
  /** Full height of the triangle base. */
  size: number
  /** true → apex points right, false → apex points left. */
  pointRight: boolean
  /** 0 → plain triangle; >0 cuts a V into the base, making a chevron/arrowhead. */
  notch?: number
  /** Rotation in radians (applied around x/y), e.g. to align with a curve. */
  rotation?: number
  fill?: string
  stroke?: string
  strokeWidth?: number
}

export interface MarkdownProps extends InteractiveProps {
  x?: number
  y?: number
  /** Pre-computed layout (measured in React with a shared measuring ctx). */
  layout: MarkdownLayout
  opacity?: number
}

export interface PlusIconProps extends InteractiveProps {
  x?: number
  y?: number
  radius?: number
  color?: string
  /** true → render an "×" (remove affordance) instead of "+". */
  cross?: boolean
  visible?: boolean
}

export interface PictureProps extends InteractiveProps {
  x?: number
  y?: number
  width: number
  height: number
  image: CanvasImageSource
}

export interface ElementPropsMap {
  group: GroupProps
  box: BoxProps
  disc: DiscProps
  bezier: BezierProps
  triangle: TriangleProps
  markdown: MarkdownProps
  plus: PlusIconProps
  picture: PictureProps
}

export type ElementType = keyof ElementPropsMap
export type AnyProps = ElementPropsMap[ElementType] & { children?: unknown }

export interface SceneNode {
  type: ElementType | 'ROOT'
  props: AnyProps
  children: SceneNode[]
  parent: SceneNode | null
}

export interface Container {
  root: SceneNode
  /** Called after every commit so the host can schedule a repaint. */
  onCommit: () => void
}
