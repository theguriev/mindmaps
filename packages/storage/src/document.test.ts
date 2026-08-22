import { describe, expect, it } from 'vitest'
import { DOC_VERSION, parseContent, parseMapDoc, toWire } from './document'

const node = (over: Record<string, unknown> = {}) => ({
  name: 'n',
  x: 0,
  y: 0,
  ...over
})

describe('parseContent', () => {
  it('accepts well-formed entries and keeps known optional fields', () => {
    const content = parseContent([
      [0, node({ name: 'root' })],
      ['a', node({ parent: 0, stroke: '#00f', collapsed: true, width: 200 })]
    ])
    expect(content).not.toBeNull()
    expect(content![1][1]).toMatchObject({
      parent: 0,
      stroke: '#00f',
      collapsed: true,
      width: 200
    })
  })

  it('drops unknown and ill-typed optional fields', () => {
    const content = parseContent([
      [0, node({ editing: true, component: 'root', lineStyle: 'wavy', width: 'wide' })]
    ])
    expect(content![0][1]).toEqual({ name: 'n', x: 0, y: 0 })
  })

  it('rejects malformed entries', () => {
    expect(parseContent('nope')).toBeNull()
    expect(parseContent([['a']])).toBeNull()
    expect(parseContent([['a', { name: 'x' }]])).toBeNull()
    expect(parseContent([['a', node({ x: 'far' })]])).toBeNull()
    expect(parseContent([['a', node()], ['a', node()]])).toBeNull()
  })

  it('rejects non-finite coordinates (JSON 1e999 parses to Infinity)', () => {
    expect(parseContent(JSON.parse('[["a",{"name":"n","x":1e999,"y":0}]]'))).toBeNull()
  })

  it('drops parent pointers that dangle outside the document', () => {
    const content = parseContent([['a', node({ parent: 'ghost' })]])
    expect(content![0][1].parent).toBeUndefined()
  })

  it('rejects cycles — the engine walks parent chains', () => {
    expect(
      parseContent([
        ['a', node({ parent: 'b' })],
        ['b', node({ parent: 'a' })]
      ])
    ).toBeNull()
    expect(parseContent([['a', node({ parent: 'a' })]])).toBeNull()
  })
})

describe('parseMapDoc', () => {
  it('normalizes a document and stamps the schema version', () => {
    const doc = parseMapDoc({
      id: 42,
      title: 'Plan',
      content: [[0, node({ name: 'root' })]],
      modified: '2026-01-01T00:00:00.000Z',
      meta: { template: '1' }
    })
    expect(doc).toMatchObject({
      id: '42',
      title: 'Plan',
      modified: '2026-01-01T00:00:00.000Z',
      meta: { template: '1' },
      version: DOC_VERSION
    })
  })

  it('falls back to the given id and an empty title (legacy entries)', () => {
    const doc = parseMapDoc({ content: [] }, 'legacy-1')
    expect(doc).toMatchObject({ id: 'legacy-1', title: '', content: [] })
  })

  it('returns null without any id, and for corrupt content', () => {
    expect(parseMapDoc({ content: [] })).toBeNull()
    expect(parseMapDoc({ id: 'a', content: 'nope' })).toBeNull()
    expect(parseMapDoc(null)).toBeNull()
    expect(parseMapDoc('string')).toBeNull()
  })
})

describe('toWire', () => {
  it('emits the persisted shape with the current version', () => {
    const wire = toWire({
      id: 'a',
      title: 'T',
      content: [],
      version: 999
    })
    expect(wire).toEqual({
      id: 'a',
      title: 'T',
      content: [],
      modified: undefined,
      meta: undefined,
      version: DOC_VERSION
    })
  })
})
