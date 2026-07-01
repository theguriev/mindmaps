/**
 * Paints a pre-computed MarkdownLayout onto a Canvas 2D context at the origin
 * (callers translate the context first). Runs are drawn with a middle baseline
 * so mixed font sizes on a line stay vertically centred.
 */
import type { MarkdownLayout } from './layout'

export function drawMarkdownLayout (
  ctx: CanvasRenderingContext2D,
  layout: MarkdownLayout,
  opacity = 1
): void {
  ctx.save()
  ctx.globalAlpha *= opacity

  // Decorations sit behind the text (code-bg is unshifted to the front already).
  for (const d of layout.decorations) {
    ctx.fillStyle = d.color
    if (d.kind === 'code-bg') {
      roundRect(ctx, d.x, d.y, d.width, d.height, 3)
      ctx.fill()
    } else if (d.kind === 'quote-bar') {
      ctx.fillRect(d.x, d.y, d.width, d.height)
    } else if (d.kind === 'hr') {
      ctx.fillRect(d.x, d.y, d.width, d.height)
    }
  }

  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'

  for (const run of layout.runs) {
    const baseline = run.y + run.lineHeight / 2

    if (run.codeBg) {
      ctx.fillStyle = 'rgba(27,31,35,0.05)'
      roundRect(
        ctx,
        run.x,
        run.y + (run.lineHeight - run.fontSize * 1.25) / 2,
        run.width,
        run.fontSize * 1.25,
        3
      )
      ctx.fill()
    }

    ctx.font = run.font
    ctx.fillStyle = run.color
    ctx.fillText(run.text, run.x + (run.codeBg ? 3 : 0), baseline)

    if (run.underline) {
      ctx.strokeStyle = run.color
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(run.x, baseline + run.fontSize * 0.42)
      ctx.lineTo(run.x + run.width, baseline + run.fontSize * 0.42)
      ctx.stroke()
    }
    if (run.strike) {
      ctx.strokeStyle = run.color
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(run.x, baseline)
      ctx.lineTo(run.x + run.width, baseline)
      ctx.stroke()
    }
  }

  ctx.restore()
}

export function roundRect (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}
