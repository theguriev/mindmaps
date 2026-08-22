/**
 * Hit-testing over the scene-graph. Walks the tree top-most first, accumulating
 * a transform matrix, and returns the first interactive element whose shape
 * contains the given screen-space point.
 */
import type {
  BezierProps,
  BoxProps,
  DiscProps,
  GroupProps,
  PictureProps,
  PlusIconProps,
  SceneNode,
  TriangleProps
} from './types'
import { distanceToCubic, pointInTriangle } from './geometryUtils'

export interface HitResult {
  node: SceneNode
  localX: number
  localY: number
}

function isEligible (node: SceneNode): boolean {
  const p = node.props as GroupProps
  if (p.interactive === false) return false
  return Boolean(
    p.onPointerDown || p.onPointerUp || p.onClick || p.onDoubleClick || p.cursor
  )
}

export function hitTest (
  root: SceneNode,
  screenX: number,
  screenY: number
): HitResult | null {
  const base = new DOMMatrix()
  for (let i = root.children.length - 1; i >= 0; i--) {
    const hit = visit(root.children[i], base, screenX, screenY)
    if (hit) return hit
  }
  return null
}

function visit (
  node: SceneNode,
  parentMatrix: DOMMatrix,
  screenX: number,
  screenY: number
): HitResult | null {
  if (node.type === 'group') {
    const p = node.props as GroupProps
    let m = parentMatrix
    if (p.x || p.y) m = m.translate(p.x ?? 0, p.y ?? 0)
    const sx = p.scaleX ?? p.scale ?? 1
    const sy = p.scaleY ?? p.scale ?? 1
    if (sx !== 1 || sy !== 1) m = m.scale(sx, sy)
    for (let i = node.children.length - 1; i >= 0; i--) {
      const hit = visit(node.children[i], m, screenX, screenY)
      if (hit) return hit
    }
    return null
  }

  if (!isEligible(node)) return null

  const inv = parentMatrix.inverse()
  const local = inv.transformPoint(new DOMPoint(screenX, screenY))
  if (contains(node, local.x, local.y)) {
    return { node, localX: local.x, localY: local.y }
  }
  return null
}

function contains (node: SceneNode, lx: number, ly: number): boolean {
  switch (node.type) {
    case 'box': {
      const p = node.props as BoxProps
      const x = p.x ?? 0
      const y = p.y ?? 0
      return lx >= x && lx <= x + p.width && ly >= y && ly <= y + p.height
    }
    case 'disc': {
      const p = node.props as DiscProps
      return Math.hypot(lx - (p.x ?? 0), ly - (p.y ?? 0)) <= p.radius
    }
    case 'plus': {
      const p = node.props as PlusIconProps
      if (p.visible === false) return false
      return Math.hypot(lx - (p.x ?? 0), ly - (p.y ?? 0)) <= (p.radius ?? 10)
    }
    case 'triangle': {
      const p = node.props as TriangleProps
      const ox = p.x ?? 0
      const oy = p.y ?? 0
      const half = p.size / 2
      const tip = p.pointRight ? half : -half
      return pointInTriangle(lx, ly, ox, oy - half, ox + tip, oy, ox, oy + half)
    }
    case 'bezier': {
      const p = node.props as BezierProps
      const d = distanceToCubic(
        lx,
        ly,
        p.x1,
        p.y1,
        p.cx1,
        p.cy1,
        p.cx2,
        p.cy2,
        p.x2,
        p.y2
      )
      return d <= (p.strokeWidth ?? 1) / 2 + (p.hitPadding ?? 0)
    }
    case 'picture': {
      const p = node.props as PictureProps
      const x = p.x ?? 0
      const y = p.y ?? 0
      return lx >= x && lx <= x + p.width && ly >= y && ly <= y + p.height
    }
    default:
      return false
  }
}
