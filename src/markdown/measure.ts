/**
 * A shared, off-screen 2D context used to measure markdown layouts in React
 * (outside of the paint loop). The same font strings are used at paint time so
 * measurements match what is drawn.
 */
import { layoutMarkdown, type LayoutOptions, type MarkdownLayout } from './layout'

let measureCtx: CanvasRenderingContext2D | null = null

function getMeasureCtx (): CanvasRenderingContext2D {
  if (measureCtx) return measureCtx
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas context unavailable')
  measureCtx = ctx
  return ctx
}

export function measureMarkdown (
  text: string,
  options: LayoutOptions = {}
): MarkdownLayout {
  return layoutMarkdown(getMeasureCtx(), text, options)
}
