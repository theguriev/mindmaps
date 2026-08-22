import { describe, expect, it } from 'vitest'
import {
  collectBranches,
  outlineText,
  outlineToNodes,
  parseClipboard,
  parseOutline,
  remapForPaste
} from './clipboard'
import type { Adjacency, NodeId, RawNode } from './types'

function sample (): Adjacency {
  return new Map<NodeId, RawNode>([
    [0, { name: 'root', x: 0, y: 0 }],
    ['a', { name: 'A', x: 100, y: 0, parent: 0, stroke: '#00f', editing: true }],
    ['b', { name: 'B', x: 200, y: 0, parent: 'a' }],
    ['c', { name: 'C', x: 100, y: 100, parent: 0 }]
  ])
}

describe('collectBranches', () => {
  it('serializes each root with its branch, dropping transient fields', () => {
    const clip = collectBranches(sample(), ['a'])
    expect(clip.roots).toEqual(['a'])
    expect(clip.nodes.map((n) => n.id)).toEqual(['a', 'b'])
    expect(clip.nodes[0].editing).toBeUndefined()
    expect(clip.nodes[0].stroke).toBe('#00f')
    // The root keeps its original parent — paste decides what to do with it.
    expect(clip.nodes[0].parent).toBe(0)
  })

  it('skips unknown ids and never duplicates nodes', () => {
    const clip = collectBranches(sample(), ['a', 'missing', 'a'])
    expect(clip.roots).toEqual(['a'])
    expect(clip.nodes.map((n) => n.id)).toEqual(['a', 'b'])
  })
})

describe('outlineText', () => {
  it('renders an indented outline, flattening multi-line names', () => {
    const clip = collectBranches(sample(), [0])
    expect(outlineText(clip)).toBe('root\n  A\n    B\n  C')
  })
})

describe('parseClipboard', () => {
  it('round-trips a collected payload', () => {
    const clip = collectBranches(sample(), ['a'])
    expect(parseClipboard(JSON.stringify(clip))).toEqual(clip)
  })

  it('rejects garbage, wrong types and dangling parents', () => {
    expect(parseClipboard('not json')).toBeNull()
    expect(parseClipboard('{"type":"other"}')).toBeNull()
    const dangling = {
      type: 'mind-maps/branches',
      version: 1,
      roots: ['a'],
      nodes: [
        { id: 'a', name: 'A', x: 0, y: 0 },
        { id: 'b', name: 'B', x: 0, y: 0, parent: 'zzz' }
      ]
    }
    expect(parseClipboard(JSON.stringify(dangling))).toBeNull()
  })
})

describe('remapForPaste', () => {
  const makeIds = () => {
    let i = 0
    return () => `new-${i++}`
  }

  it('gives fresh ids, translates and rewires internal parents', () => {
    const clip = collectBranches(sample(), ['a'])
    const { nodes, roots } = remapForPaste(clip, {
      makeId: makeIds(),
      dx: 10,
      dy: 20,
      rootParent: 'xyz'
    })
    expect(roots).toEqual(['new-0'])
    expect(nodes[0]).toMatchObject({ id: 'new-0', parent: 'xyz', x: 110, y: 20 })
    expect(nodes[1]).toMatchObject({ id: 'new-1', parent: 'new-0', x: 210, y: 20 })
  })

  it('strips or keeps root parents on demand', () => {
    const clip = collectBranches(sample(), ['a'])
    const stripped = remapForPaste(clip, { makeId: makeIds(), dx: 0, dy: 0 })
    expect(stripped.nodes[0].parent).toBeUndefined()
    const kept = remapForPaste(clip, {
      makeId: makeIds(),
      dx: 0,
      dy: 0,
      rootParent: 'keep'
    })
    expect(kept.nodes[0].parent).toBe(0)
  })
})

describe('outline paste', () => {
  it('parses indentation, strips list markers, clamps depth jumps', () => {
    const rows = parseOutline('Plan\n  - One\n      deep jump\n\ttabbed')
    expect(rows).toEqual([
      { name: 'Plan', depth: 0 },
      { name: 'One', depth: 1 },
      { name: 'deep jump', depth: 2 },
      { name: 'tabbed', depth: 1 }
    ])
  })

  it('builds a tree from rows', () => {
    const ids = (() => {
      let i = 0
      return () => `n${i++}`
    })()
    const { nodes, roots } = outlineToNodes(
      parseOutline('Plan\n  One\n  Two\nOther'),
      ids,
      { x: 0, y: 0 },
      'host'
    )
    expect(roots).toEqual(['n0', 'n3'])
    expect(nodes.find((n) => n.id === 'n1')?.parent).toBe('n0')
    expect(nodes.find((n) => n.id === 'n2')?.parent).toBe('n0')
    expect(nodes.find((n) => n.id === 'n3')?.parent).toBe('host')
  })
})
