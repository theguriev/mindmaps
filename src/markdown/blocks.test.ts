import { describe, expect, it } from 'vitest'
import { parseBlocks } from './blocks'

describe('parseBlocks', () => {
  it('recognises headings, lists, quotes, code fences and rules', () => {
    const blocks = parseBlocks(
      '# Title\n\n- item1\n- item2\n1. one\n> quote\n```\ncode\n```\n---'
    )
    expect(blocks[0]).toMatchObject({ type: 'heading', level: 1 })
    expect(blocks.some((b) => b.type === 'list-item' && !b.ordered)).toBe(true)
    expect(
      blocks.some((b) => b.type === 'list-item' && b.ordered && b.marker === '1.')
    ).toBe(true)
    expect(blocks.some((b) => b.type === 'blockquote')).toBe(true)
    expect(blocks.some((b) => b.type === 'code' && b.code === 'code')).toBe(true)
    expect(blocks.some((b) => b.type === 'hr')).toBe(true)
  })

  it('treats each source line as its own block (nowrap)', () => {
    const blocks = parseBlocks('line one\nline two')
    expect(blocks.filter((b) => b.type === 'paragraph')).toHaveLength(2)
  })

  it('captures multi-digit ordered markers', () => {
    const blocks = parseBlocks('10. tenth')
    expect(blocks[0]).toMatchObject({ type: 'list-item', marker: '10.' })
  })

  it('parses a GFM table with header, delimiter, alignment and body rows', () => {
    const blocks = parseBlocks(
      'A | B | C\n:--- | :---: | ---:\n1 | 2 | 3\n4 | 5 | 6'
    )
    expect(blocks).toHaveLength(1)
    const t = blocks[0]
    expect(t.type).toBe('table')
    expect(t.aligns).toEqual(['left', 'center', 'right'])
    // header + two body rows, three cells each
    expect(t.rows).toHaveLength(3)
    expect(t.rows?.[0]).toHaveLength(3)
    expect(t.rows?.[0]?.[0]?.[0]?.text).toBe('A')
    expect(t.rows?.[2]?.[2]?.[0]?.text).toBe('6')
  })

  it('supports optional outer pipes in tables', () => {
    const blocks = parseBlocks('| x | y |\n| --- | --- |\n| 1 | 2 |')
    expect(blocks[0].type).toBe('table')
    expect(blocks[0].rows?.[0]).toHaveLength(2)
  })

  it('treats a --- after a blank line as a horizontal rule, not a table', () => {
    const blocks = parseBlocks('some text\n\n---')
    expect(blocks.some((b) => b.type === 'table')).toBe(false)
    expect(blocks.some((b) => b.type === 'hr')).toBe(true)
  })

  it('parses Setext headings (=== → H1, --- → H2)', () => {
    const blocks = parseBlocks('Alt-H1\n======\n\nAlt-H2\n------')
    const h1 = blocks.find((b) => b.type === 'heading' && b.level === 1)
    const h2 = blocks.find((b) => b.type === 'heading' && b.level === 2)
    expect(h1?.runs?.[0]?.text).toBe('Alt-H1')
    expect(h2?.runs?.[0]?.text).toBe('Alt-H2')
    // The underline lines themselves must not leak through as content/hr.
    expect(blocks.some((b) => b.type === 'hr')).toBe(false)
    expect(blocks.some((b) => b.runs.some((r) => r.text.includes('===')))).toBe(false)
  })

  it('consumes link reference definitions and resolves forward references', () => {
    const blocks = parseBlocks('Use [it][ref].\n\n[ref]: http://example.com')
    // The definition line renders nothing (only the paragraph + blank remain).
    expect(blocks.some((b) => b.runs.some((r) => r.text.includes('http://')))).toBe(false)
    const para = blocks.find((b) => b.type === 'paragraph')!
    expect(para.runs.some((r) => r.style.link && r.href === 'http://example.com')).toBe(true)
  })
})
