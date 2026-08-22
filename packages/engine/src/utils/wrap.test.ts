import { describe, expect, it } from 'vitest'
import { wrap } from './wrap'

describe('wrap', () => {
  it('adds delimiters around the selection', () => {
    const r = wrap('hello', 0, 5, '**')
    expect(r.str).toBe('**hello**')
    expect(r.start).toBe(2)
    expect(r.end).toBe(7)
  })

  it('removes delimiters when the selection is already wrapped inside', () => {
    const r = wrap('**hello**', 2, 7, '**')
    expect(r.str).toBe('hello')
  })

  it('removes delimiters when the selection sits just outside them', () => {
    const r = wrap('**hello**', 0, 9, '**')
    expect(r.str).toBe('hello')
  })
})
