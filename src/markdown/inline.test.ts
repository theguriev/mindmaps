import { describe, expect, it } from 'vitest'
import { parseInline } from './inline'

describe('parseInline', () => {
  it('parses bold / italic / code / strikethrough / links', () => {
    const runs = parseInline('a **b** _c_ `d` ~~e~~ [x](http://y)')
    expect(runs.some((r) => r.style.bold && r.text === 'b')).toBe(true)
    expect(runs.some((r) => r.style.italic && r.text === 'c')).toBe(true)
    expect(runs.some((r) => r.style.code && r.text === 'd')).toBe(true)
    expect(runs.some((r) => r.style.strike && r.text === 'e')).toBe(true)
    expect(
      runs.some((r) => r.style.link && r.text === 'x' && r.href === 'http://y')
    ).toBe(true)
  })

  it('keeps plain text and preserves order', () => {
    const runs = parseInline('hello world')
    expect(runs.map((r) => r.text).join('')).toBe('hello world')
  })

  it('handles nested emphasis without infinite recursion', () => {
    const runs = parseInline('**bold _and italic_**')
    expect(runs.some((r) => r.style.bold && r.style.italic)).toBe(true)
  })

  it('returns nothing for an empty string', () => {
    expect(parseInline('')).toEqual([])
  })
})
