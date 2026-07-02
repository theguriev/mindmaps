/**
 * Serializes the scene-graph to an SVG string. Reuses the same scene tree the
 * canvas paints, so exported SVGs match what is on screen. Used for "Download →
 * SVG".
 */
import type {
  BezierProps,
  BoxProps,
  DiscProps,
  GroupProps,
  MarkdownProps,
  PlusIconProps,
  SceneNode,
  TriangleProps
} from './types'
import type { MarkdownLayout } from '@/markdown/layout'

function esc (s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function n (v: number): string {
  return Number.isFinite(v) ? String(Math.round(v * 100) / 100) : '0'
}

export function sceneToSvg (
  root: SceneNode,
  width: number,
  height: number,
  background = '#ffffff'
): string {
  const body = root.children.map(nodeToSvg).join('')
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${n(width)}" height="${n(height)}" ` +
    `viewBox="0 0 ${n(width)} ${n(height)}">` +
    `<rect x="0" y="0" width="${n(width)}" height="${n(height)}" fill="${background}"/>` +
    body +
    '</svg>'
  )
}

function nodeToSvg (node: SceneNode): string {
  switch (node.type) {
    case 'group':
      return groupToSvg(node)
    case 'box':
      return boxToSvg(node.props as BoxProps)
    case 'disc':
      return discToSvg(node.props as DiscProps)
    case 'bezier':
      return bezierToSvg(node.props as BezierProps)
    case 'triangle':
      return triangleToSvg(node.props as TriangleProps)
    case 'plus':
      return plusToSvg(node.props as PlusIconProps)
    case 'markdown':
      return markdownToSvg(node.props as MarkdownProps)
    default:
      return ''
  }
}

function groupToSvg (node: SceneNode): string {
  const p = node.props as GroupProps
  const transforms: string[] = []
  if (p.x || p.y) transforms.push(`translate(${n(p.x ?? 0)}, ${n(p.y ?? 0)})`)
  const sx = p.scaleX ?? p.scale ?? 1
  const sy = p.scaleY ?? p.scale ?? 1
  if (sx !== 1 || sy !== 1) transforms.push(`scale(${n(sx)}, ${n(sy)})`)
  const t = transforms.length ? ` transform="${transforms.join(' ')}"` : ''
  const opacity = p.opacity !== undefined ? ` opacity="${p.opacity}"` : ''
  return `<g${t}${opacity}>${node.children.map(nodeToSvg).join('')}</g>`
}

function boxToSvg (p: BoxProps): string {
  if (p.hitOnly || (!p.fill && !p.stroke)) return ''
  const fill = p.fill ? `fill="${p.fill}"` : 'fill="none"'
  const stroke = p.stroke
    ? ` stroke="${p.stroke}" stroke-width="${p.strokeWidth ?? 1}"`
    : ''
  const rx = p.radius ? ` rx="${n(p.radius)}"` : ''
  return `<rect x="${n(p.x ?? 0)}" y="${n(p.y ?? 0)}" width="${n(p.width)}" height="${n(p.height)}"${rx} ${fill}${stroke}/>`
}

function discToSvg (p: DiscProps): string {
  const fill = p.fill ? `fill="${p.fill}"` : 'fill="none"'
  const stroke = p.stroke
    ? ` stroke="${p.stroke}" stroke-width="${p.strokeWidth ?? 1}"`
    : ''
  return `<circle cx="${n(p.x ?? 0)}" cy="${n(p.y ?? 0)}" r="${n(p.radius)}" ${fill}${stroke}/>`
}

function bezierToSvg (p: BezierProps): string {
  const w = p.strokeWidth ?? 1
  const d = `M ${n(p.x1)} ${n(p.y1)} C ${n(p.cx1)} ${n(p.cy1)} ${n(p.cx2)} ${n(p.cy2)} ${n(p.x2)} ${n(p.y2)}`
  const dash = p.dash ? ` stroke-dasharray="${n(w * 1.6)} ${n(w * 1.6)}"` : ''
  return `<path d="${d}" fill="none" stroke="${p.stroke ?? '#000'}" stroke-width="${w}" stroke-linecap="${p.dash ? 'butt' : 'round'}"${dash}/>`
}

function triangleToSvg (p: TriangleProps): string {
  const half = p.size / 2
  const tip = p.pointRight ? half : -half
  const notch = p.notch ? ` L ${n(tip * p.notch)} 0` : ''
  const d = `M 0 ${n(-half)} L ${n(tip)} 0 L 0 ${n(half)}${notch} Z`
  const fill = p.fill ? `fill="${p.fill}"` : 'fill="none"'
  const stroke = p.stroke ? ` stroke="${p.stroke}"` : ''
  const rot = p.rotation ? ` rotate(${n((p.rotation * 180) / Math.PI)})` : ''
  return `<path d="${d}"${stroke} ${fill} transform="translate(${n(p.x ?? 0)}, ${n(p.y ?? 0)})${rot}"/>`
}

function plusToSvg (p: PlusIconProps): string {
  if (p.visible === false) return ''
  const r = p.radius ?? 10
  const color = p.color ?? '#000'
  const bar = r * 0.6
  const bars = p.cross
    ? `<path d="M ${n(-bar * 0.7)} ${n(-bar * 0.7)} L ${n(bar * 0.7)} ${n(bar * 0.7)} M ${n(bar * 0.7)} ${n(-bar * 0.7)} L ${n(-bar * 0.7)} ${n(bar * 0.7)}" stroke="#000" stroke-width="2"/>`
    : `<path d="M ${n(-bar)} 0 L ${n(bar)} 0 M 0 ${n(-bar)} L 0 ${n(bar)}" stroke="#000" stroke-width="2"/>`
  return (
    `<g transform="translate(${n(p.x ?? 0)}, ${n(p.y ?? 0)})">` +
    `<circle cx="0" cy="0" r="${n(r)}" fill="#fff" stroke="${color}"/>` +
    bars +
    '</g>'
  )
}

function markdownToSvg (p: MarkdownProps): string {
  const layout: MarkdownLayout = p.layout
  const parts: string[] = []
  for (const d of layout.decorations) {
    parts.push(
      `<rect x="${n(d.x)}" y="${n(d.y)}" width="${n(d.width)}" height="${n(d.height)}" fill="${d.color}"/>`
    )
  }
  for (const run of layout.runs) {
    const baseline = run.y + run.lineHeight / 2
    const deco = run.underline
      ? ' text-decoration="underline"'
      : run.strike
        ? ' text-decoration="line-through"'
        : ''
    parts.push(
      `<text x="${n(run.x)}" y="${n(baseline)}" dominant-baseline="middle" ` +
        `style="font: ${esc(run.font)}" fill="${run.color}"${deco}>${esc(run.text)}</text>`
    )
  }
  const opacity = p.opacity !== undefined && p.opacity !== 1 ? ` opacity="${p.opacity}"` : ''
  return `<g transform="translate(${n(p.x ?? 0)}, ${n(p.y ?? 0)})"${opacity}>${parts.join('')}</g>`
}
