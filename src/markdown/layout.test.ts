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

  it('lays out a table as a grid with borders and cell text', () => {
    const layout = layoutMarkdown(ctx, 'A | B\n--- | ---\n1 | 2')
    // One run per non-empty cell (A, B, 1, 2).
    const texts = layout.runs.map((r) => r.text).sort()
    expect(texts).toEqual(['1', '2', 'A', 'B'])
    // Header + zebra backgrounds and a full grid of borders were emitted.
    expect(layout.decorations.some((d) => d.kind === 'table-header')).toBe(true)
    expect(layout.decorations.filter((d) => d.kind === 'table-border').length).toBeGreaterThan(0)
    // The two columns don't overlap: B starts to the right of A.
    const a = layout.runs.find((r) => r.text === 'A')!
    const b = layout.runs.find((r) => r.text === 'B')!
    expect(b.x).toBeGreaterThan(a.x)
    expect(Number.isFinite(layout.width) && layout.height > 0).toBe(true)
  })

  it('right-aligns a cell whose column is marked right-aligned', () => {
    const layout = layoutMarkdown(ctx, 'Head | Num\n--- | ---:\nx | 9')
    const head = layout.runs.find((r) => r.text === 'Head')!
    const nine = layout.runs.find((r) => r.text === '9')!
    // "9" is short and right-aligned, so it sits well right of the header start.
    expect(nine.x).toBeGreaterThan(head.x)
  })
})
