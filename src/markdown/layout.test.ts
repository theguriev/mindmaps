import { describe, expect, it } from 'vitest'
import { layoutMarkdown } from './layout'

// Minimal measuring context: width proportional to text length.
const ctx = {
  font: '',
  measureText: (s: string) => ({ width: s.length * 7 })
} as unknown as CanvasRenderingContext2D

describe('layoutMarkdown', () => {
  it('lays out headings and paragraphs with finite geometry', () => {
    const layout = layoutMarkdown(ctx, '# Hello\nworld **bold**')
    expect(layout.width).toBeGreaterThan(0)
    expect(layout.height).toBeGreaterThan(0)
    expect(layout.runs.length).toBeGreaterThanOrEqual(2)
    expect(
      layout.runs.every(
        (r) => Number.isFinite(r.x) && Number.isFinite(r.y) && Number.isFinite(r.width)
      )
    ).toBe(true)
  })

  it('right-aligns lines shorter than the widest', () => {
    const layout = layoutMarkdown(ctx, 'short\nmuch longer line', { align: 'right' })
    expect(layout.runs[0].x).toBeGreaterThan(0)
  })

  it('never overlaps a wide list marker with its body', () => {
    const layout = layoutMarkdown(ctx, '10. ten')
    const marker = layout.runs[0]
    const body = layout.runs[1]
    expect(body.x).toBeGreaterThanOrEqual(marker.x + marker.width)
  })

  it('does not crash on empty text', () => {
    expect(() => layoutMarkdown(ctx, '')).not.toThrow()
  })
})
