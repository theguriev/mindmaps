import { describe, expect, it } from 'vitest'
import { SCOPES, scopeCss } from './scopeCss'

const scope = `:where(${SCOPES.join(',')})`

describe('scopeCss', () => {
  it('confines a utility both ways: inside the embed, and as the embed', () => {
    // The second half is the portal roots — `PopoverContent` puts utilities on
    // the very element carrying `[data-slot="popover-content"]`, which a
    // descendant combinator never matches.
    expect(scopeCss('.flex{display:flex!important}')).toBe(
      `${scope} .flex,.flex${scope}{display:flex!important}`
    )
  })

  it('attaches the scope to the first compound, not the last', () => {
    expect(scopeCss('.a .b{color:red}')).toBe(`${scope} .a .b,.a${scope} .b{color:red}`)
  })

  it('handles a selector list, and commas inside :is() are not list commas', () => {
    const out = scopeCss('.a,.b{x:1}')
    expect(out.startsWith(`${scope} .a,.a${scope},${scope} .b,.b${scope}{`)).toBe(true)

    expect(scopeCss(':is(.a,.b) .c{x:1}')).toBe(
      `${scope} :is(.a,.b) .c,:is(.a,.b)${scope} .c{x:1}`
    )
  })

  it('leaves alone what is already the embed\'s', () => {
    const already = `${scope} .foo{x:1}`
    expect(scopeCss(already)).toBe(already)
    expect(scopeCss(".mind-maps-app .x{y:1}")).toBe('.mind-maps-app .x{y:1}')
  })

  it('does not touch the token blocks, which have to reach what reads them', () => {
    expect(scopeCss(':root{--a:1}')).toBe(':root{--a:1}')
    expect(scopeCss('*,:before,:after{--tw-x:1}')).toBe('*,:before,:after{--tw-x:1}')
  })

  it('descends into at-rules', () => {
    expect(scopeCss('@media (width>=40rem){.sm\\:flex{display:flex}}')).toBe(
      `@media (width>=40rem){${scope} .sm\\:flex,.sm\\:flex${scope}{display:flex}}`
    )
  })

  it('leaves keyframe steps alone — they are not selectors', () => {
    expect(scopeCss('@keyframes spin{from{transform:rotate(0)}to{transform:rotate(1turn)}}')).toBe(
      '@keyframes spin{from{transform:rotate(0)}to{transform:rotate(1turn)}}'
    )
    expect(scopeCss('@keyframes x{0%{opacity:0}100%{opacity:1}}')).toBe(
      '@keyframes x{0%{opacity:0}100%{opacity:1}}'
    )
  })

  it('adds nothing to specificity, so utilities still settle by order', () => {
    // `:where()` is the whole reason this is safe to do wholesale.
    expect(scopeCss('.p-4{padding:1rem}')).toContain(':where(')
  })
})
