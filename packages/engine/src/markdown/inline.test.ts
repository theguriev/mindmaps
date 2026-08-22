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

  it('resolves reference-style links (case-insensitive) against definitions', () => {
    const defs = new Map([['ref one', 'http://a'], ['1', 'http://b']])
    const full = parseInline("[I'm a ref][Ref One]", defs)
    expect(full.some((r) => r.style.link && r.href === 'http://a')).toBe(true)
    expect(full.map((r) => r.text).join('')).toBe("I'm a ref")

    const numbered = parseInline('[see][1]', defs)
    expect(numbered.some((r) => r.style.link && r.href === 'http://b')).toBe(true)
  })

  it('resolves collapsed and shortcut reference links', () => {
    const defs = new Map([['link text itself', 'mailto:x@y.z']])
    const shortcut = parseInline('use the [link text itself].', defs)
    expect(
      shortcut.some((r) => r.style.link && r.text === 'link text itself' && r.href === 'mailto:x@y.z')
    ).toBe(true)
    // The trailing period stays plain text outside the link.
    expect(shortcut.map((r) => r.text).join('')).toBe('use the link text itself.')

    const collapsed = parseInline('[link text itself][]', defs)
    expect(collapsed.some((r) => r.style.link && r.href === 'mailto:x@y.z')).toBe(true)
  })

  it('leaves an unresolved reference as literal bracketed text', () => {
    const runs = parseInline('[not defined][nope]')
    expect(runs.map((r) => r.text).join('')).toBe('[not defined][nope]')
    expect(runs.every((r) => !r.style.link)).toBe(true)
  })

  it('renders an inline image as an alt-text placeholder, not a broken link', () => {
    const runs = parseInline('![alt text](http://x/y.svg "Title")')
    const text = runs.map((r) => r.text).join('')
    expect(text).toContain('alt text')
    expect(text).not.toContain('!') // the leading ! must be consumed
    expect(text).not.toContain('](') // no raw link syntax leaks through
    // A placeholder is plain text, not a link.
    expect(runs.every((r) => !r.style.link)).toBe(true)
  })

  it('renders a reference-style image when its definition resolves', () => {
    const defs = new Map([['logo', 'http://x/logo.svg']])
    const runs = parseInline('![alt text][logo]', defs)
    const text = runs.map((r) => r.text).join('')
    expect(text).toContain('alt text')
    expect(text).not.toContain('[')
  })

  it('autolinks bare and angle-bracketed URLs, trimming trailing punctuation', () => {
    const bare = parseInline('see http://www.beagl.in.')
    expect(
      bare.some((r) => r.style.link && r.href === 'http://www.beagl.in')
    ).toBe(true)
    // Trailing period is not part of the link.
    expect(bare.map((r) => r.text).join('')).toBe('see http://www.beagl.in.')

    const angle = parseInline('<https://x.y>')
    expect(angle.some((r) => r.style.link && r.href === 'https://x.y')).toBe(true)
  })
})
