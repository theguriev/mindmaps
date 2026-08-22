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

// Stub metrics: every character is 7px wide regardless of font, so the
// expected geometry below is exact. BASE line height is round(16 * 1.5) = 24.
describe('layoutMarkdown soft wrap (maxWidth)', () => {
  it('wraps a paragraph at word boundaries and grows the height', () => {
    const plain = layoutMarkdown(ctx, 'aaa bbb ccc ddd')
    const layout = layoutMarkdown(ctx, 'aaa bbb ccc ddd', { maxWidth: 60 })
    expect(plain.height).toBe(24)
    expect(layout.runs.map((r) => r.text)).toEqual(['aaa bbb', 'ccc ddd'])
    // The space at the break is dropped: both lines are 7 chars * 7px.
    expect(layout.runs.map((r) => r.width)).toEqual([49, 49])
    expect(layout.runs.map((r) => r.y)).toEqual([0, 24])
    expect(layout.height).toBe(48)
    expect(layout.width).toBe(49)
    expect(layout.width).toBeLessThanOrEqual(60)
    // Continuation lines of a paragraph start at x = 0.
    expect(layout.runs[1].x).toBe(0)
  })

  it('wraps a heading and stacks lines at the heading line height', () => {
    const layout = layoutMarkdown(ctx, '# aaa bbb', { maxWidth: 30 })
    expect(layout.runs.map((r) => r.text)).toEqual(['aaa', 'bbb'])
    // H1: 32px font, line height round(32 * 1.25) = 40, on both lines.
    expect(layout.runs.every((r) => r.fontSize === 32 && r.lineHeight === 40)).toBe(true)
    expect(layout.height).toBe(80)
  })

  it('hang-indents wrapped list-item lines past the marker', () => {
    const layout = layoutMarkdown(ctx, '- alpha beta gamma', { maxWidth: 90 })
    const [marker, first, cont] = layout.runs
    expect(marker.text).toBe('• ')
    expect(first.text).toBe('alpha beta')
    expect(cont.text).toBe('gamma')
    // Continuation starts at the body start X: never under the marker.
    expect(cont.x).toBe(first.x)
    expect(cont.x).toBeGreaterThanOrEqual(marker.x + marker.width)
    expect(cont.y).toBe(24)
    expect(layout.height).toBe(48)
  })

  it('draws a quote bar next to every wrapped blockquote line', () => {
    const layout = layoutMarkdown(ctx, '> aaa bbb ccc ddd', { maxWidth: 80 })
    const bars = layout.decorations.filter((d) => d.kind === 'quote-bar')
    expect(bars.map((b) => b.y)).toEqual([0, 24])
    expect(bars.every((b) => b.x === 0 && b.height === 24)).toBe(true)
    // Both lines keep the quote indent.
    expect(layout.runs.map((r) => r.x)).toEqual([16, 16])
    expect(layout.runs.map((r) => r.text)).toEqual(['aaa bbb', 'ccc ddd'])
  })

  it('keeps the right-align quote indent reserved on wrapped lines', () => {
    const layout = layoutMarkdown(ctx, '> aaa bbb', { align: 'right', maxWidth: 40 })
    const bars = layout.decorations.filter((d) => d.kind === 'quote-bar')
    expect(bars.length).toBe(2)
    // Each bar sits after its line's text inside the reserved right indent.
    for (const [i, bar] of bars.entries()) {
      const run = layout.runs[i]
      expect(bar.x).toBeGreaterThanOrEqual(run.x + run.width)
    }
  })

  it('keeps the bold font on both pieces of a run split across lines', () => {
    const layout = layoutMarkdown(ctx, '**aaa bbb** ccc', { maxWidth: 30 })
    expect(layout.runs.map((r) => r.text)).toEqual(['aaa', 'bbb', 'ccc'])
    const [a, b, c] = layout.runs
    expect(a.font).toContain('700')
    expect(b.font).toBe(a.font)
    expect(c.font).not.toContain('700')
    expect(a.y).not.toBe(b.y)
    expect(layout.height).toBe(72)
  })

  it('puts a single overlong token on its own overflowing line', () => {
    const layout = layoutMarkdown(ctx, 'aa supercalifragilistic bb', { maxWidth: 50 })
    expect(layout.runs.map((r) => r.text)).toEqual(['aa', 'supercalifragilistic', 'bb'])
    const long = layout.runs[1]
    // 20 chars * 7px = 140: wider than maxWidth, alone on its line.
    expect(long.width).toBe(140)
    expect(layout.runs.filter((r) => r.y === long.y)).toEqual([long])
    expect(layout.width).toBe(140)
  })

  it('treats an inline-code run as one unbreakable token', () => {
    const layout = layoutMarkdown(ctx, '`aaa bbb` ccc', { maxWidth: 30 })
    const code = layout.runs.find((r) => r.codeBg)!
    expect(code.text).toBe('aaa bbb')
    // The chip overflows whole; the following word wraps to the next line.
    const ccc = layout.runs.find((r) => r.text === 'ccc')!
    expect(ccc.y).toBe(code.y + 24)
  })

  it('never wraps code blocks', () => {
    const src = '```\nconst averyverylongidentifier = 1\n```'
    const layout = layoutMarkdown(ctx, src, { maxWidth: 50 })
    expect(layout.runs.length).toBe(1)
    expect(layout.runs[0].text).toBe('const averyverylongidentifier = 1')
    expect(layout.width).toBeGreaterThan(50)
  })

  it('never wraps tables', () => {
    const layout = layoutMarkdown(ctx, 'AAAA BBBB | C\n--- | ---\nx | y', { maxWidth: 40 })
    expect(layout.runs.some((r) => r.text === 'AAAA BBBB')).toBe(true)
    expect(layout.width).toBeGreaterThan(40)
  })

  it('is identical to the nowrap layout when maxWidth is unset or <= 0', () => {
    const doc = '# Head\naaa bbb ccc ddd eee fff\n> quote\n- item\n\n---'
    const base = layoutMarkdown(ctx, doc)
    expect(layoutMarkdown(ctx, doc, { maxWidth: 0 })).toEqual(base)
    expect(layoutMarkdown(ctx, doc, { maxWidth: -10 })).toEqual(base)
    // The nowrap geometry facts the older tests encode still hold: one visual
    // line per block (40 + 24 + 24 + 24 + 10 + 20 high) and the width of the
    // widest (23-char) line.
    expect(base.height).toBe(142)
    expect(base.width).toBe(161)
    expect(base.runs.some((r) => r.text === 'aaa bbb ccc ddd eee fff')).toBe(true)
  })
})
