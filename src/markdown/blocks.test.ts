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
})
