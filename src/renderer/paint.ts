/**
 * Paints the scene-graph tree onto a Canvas 2D context. Group transforms are
 * applied via save/translate/scale/restore; leaf elements draw their shape.
 */
import type {
  BezierProps,
  BoxProps,
  DiscProps,
  GroupProps,
  MarkdownProps,
  PictureProps,
  PlusIconProps,
  SceneNode,
  TriangleProps
} from './types'
import { drawMarkdownLayout, roundRect } from '@/markdown/draw'

export function paintScene (
  ctx: CanvasRenderingContext2D,
  root: SceneNode,
  width: number,
  height: number,
  background = '#ffffff'
): void {
  ctx.save()
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = background
  ctx.fillRect(0, 0, width, height)
  for (const child of root.children) paintNode(ctx, child)
  ctx.restore()
}

function paintNode (ctx: CanvasRenderingContext2D, node: SceneNode): void {
  switch (node.type) {
    case 'group':
      paintGroup(ctx, node)
      break
    case 'box':
      paintBox(ctx, node.props as BoxProps)
      break
    case 'disc':
      paintDisc(ctx, node.props as DiscProps)
      break
    case 'bezier':
      paintBezier(ctx, node.props as BezierProps)
      break
    case 'triangle':
      paintTriangle(ctx, node.props as TriangleProps)
      break
    case 'markdown':
      paintMarkdown(ctx, node.props as MarkdownProps)
      break
    case 'plus':
      paintPlus(ctx, node.props as PlusIconProps)
      break
    case 'picture':
      paintPicture(ctx, node.props as PictureProps)
      break
  }
}

function paintGroup (ctx: CanvasRenderingContext2D, node: SceneNode): void {
  const p = node.props as GroupProps
  ctx.save()
  if (p.x || p.y) ctx.translate(p.x ?? 0, p.y ?? 0)
  const sx = p.scaleX ?? p.scale ?? 1
  const sy = p.scaleY ?? p.scale ?? 1
  if (sx !== 1 || sy !== 1) ctx.scale(sx, sy)
  if (p.opacity !== undefined) ctx.globalAlpha *= p.opacity
  for (const child of node.children) paintNode(ctx, child)
  ctx.restore()
}

function paintBox (ctx: CanvasRenderingContext2D, p: BoxProps): void {
  if (p.hitOnly) return
  const x = p.x ?? 0
  const y = p.y ?? 0
  roundRect(ctx, x, y, p.width, p.height, p.radius ?? 0)
  if (p.fill) {
    ctx.fillStyle = p.fill
    ctx.fill()
  }
  if (p.stroke) {
    ctx.strokeStyle = p.stroke
    ctx.lineWidth = p.strokeWidth ?? 1
    ctx.stroke()
  }
}

function paintDisc (ctx: CanvasRenderingContext2D, p: DiscProps): void {
  ctx.beginPath()
  ctx.arc(p.x ?? 0, p.y ?? 0, p.radius, 0, Math.PI * 2)
  if (p.fill) {
    ctx.fillStyle = p.fill
    ctx.fill()
  }
  if (p.stroke) {
    ctx.strokeStyle = p.stroke
    ctx.lineWidth = p.strokeWidth ?? 1
    ctx.stroke()
  }
}

function paintBezier (ctx: CanvasRenderingContext2D, p: BezierProps): void {
  const width = p.strokeWidth ?? 1
  ctx.beginPath()
  ctx.moveTo(p.x1, p.y1)
  ctx.bezierCurveTo(p.cx1, p.cy1, p.cx2, p.cy2, p.x2, p.y2)
  ctx.strokeStyle = p.stroke ?? '#000'
  ctx.lineWidth = width
  ctx.lineCap = p.dash ? 'butt' : 'round'
  ctx.setLineDash(p.dash ? [width * 1.6, width * 1.6] : [])
  ctx.stroke()
  ctx.setLineDash([])
}

function paintTriangle (ctx: CanvasRenderingContext2D, p: TriangleProps): void {
  const half = p.size / 2
  const tip = p.pointRight ? half : -half
  ctx.save()
  ctx.translate(p.x ?? 0, p.y ?? 0)
  ctx.beginPath()
  ctx.moveTo(0, -half)
  ctx.lineTo(tip, 0)
  ctx.lineTo(0, half)
  ctx.closePath()
  if (p.fill) {
    ctx.fillStyle = p.fill
    ctx.fill()
  }
  if (p.stroke) {
    ctx.strokeStyle = p.stroke
    ctx.lineWidth = p.strokeWidth ?? 1
    ctx.stroke()
  }
  ctx.restore()
}

function paintMarkdown (ctx: CanvasRenderingContext2D, p: MarkdownProps): void {
  ctx.save()
  ctx.translate(p.x ?? 0, p.y ?? 0)
  drawMarkdownLayout(ctx, p.layout, p.opacity ?? 1)
  ctx.restore()
}

function paintPlus (ctx: CanvasRenderingContext2D, p: PlusIconProps): void {
  if (p.visible === false) return
  const x = p.x ?? 0
  const y = p.y ?? 0
  const r = p.radius ?? 10
  const color = p.color ?? '#000'
  ctx.save()
  ctx.translate(x, y)
  // Circle with white fill + coloured border.
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.stroke()
  // Plus / cross bars.
  ctx.strokeStyle = '#000000'
  ctx.lineWidth = 2
  const bar = r * 0.6
  ctx.beginPath()
  if (p.cross) {
    ctx.moveTo(-bar * 0.7, -bar * 0.7)
    ctx.lineTo(bar * 0.7, bar * 0.7)
    ctx.moveTo(bar * 0.7, -bar * 0.7)
    ctx.lineTo(-bar * 0.7, bar * 0.7)
  } else {
    ctx.moveTo(-bar, 0)
    ctx.lineTo(bar, 0)
    ctx.moveTo(0, -bar)
    ctx.lineTo(0, bar)
  }
  ctx.stroke()
  ctx.restore()
}

function paintPicture (ctx: CanvasRenderingContext2D, p: PictureProps): void {
  ctx.drawImage(p.image, p.x ?? 0, p.y ?? 0, p.width, p.height)
}
