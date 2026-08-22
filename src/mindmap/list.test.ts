import { describe, expect, it } from 'vitest'
import {
  branch,
  canReparent,
  children,
  collapsedCounts,
  prepareList,
  preparePaths
} from './list'
import type { Adjacency, NodeId, RawNode } from './types'

function sample (): Adjacency {
  return new Map<NodeId, RawNode>([
    [0, { name: 'root', x: 0, y: 0 }],
    ['a', { name: 'A', x: 100, y: -50, parent: 0, stroke: '#00f' }],
    ['b', { name: 'B', x: 200, y: -80, parent: 'a' }]
  ])
}

describe('prepareList', () => {
  it('enriches nodes with derived fields', () => {
    const list = prepareList(sample())
    expect(list.get(0)?.component).toBe('root')
    expect(list.get('a')?.component).toBe('node')
    expect(list.get(0)?.isHaveChildren).toBe(true)
    expect(list.get('b')?.isHaveChildren).toBe(false)
    expect(list.get('a')?.isRightSide).toBe(true)
    expect(list.get('a')?.isUpSide).toBe(true)
    expect(list.get(0)?.width).toBe(140)
    expect(list.get(0)?.height).toBe(32)
  })

  it('treats every parentless node as a root (multiple trees)', () => {
    const adj: Adjacency = new Map<NodeId, RawNode>([
      [0, { name: 'root', x: 0, y: 0 }],
      ['r2', { name: 'second root', x: 400, y: 0 }],
      ['c', { name: 'child', x: 500, y: 0, parent: 'r2' }]
    ])
    const list = prepareList(adj)
    expect(list.get(0)?.component).toBe('root')
    expect(list.get('r2')?.component).toBe('root')
    expect(list.get('c')?.component).toBe('node')
    // Only the child produces an edge; the two roots have none.
    expect(preparePaths(list).size).toBe(1)
  })

  it('gives sticky notes a larger default size', () => {
    const adj: Adjacency = new Map<NodeId, RawNode>([
      [0, { name: 'root', x: 0, y: 0 }],
      ['s', { name: 'note', x: 0, y: 150, parent: 0, sticky: true }]
    ])
    const list = prepareList(adj)
    expect(list.get('s')?.width).toBe(200)
    expect(list.get('s')?.height).toBe(130)
  })
})

describe('collapse', () => {
  function collapsedSample (): Adjacency {
    return new Map<NodeId, RawNode>([
      [0, { name: 'root', x: 0, y: 0 }],
      ['a', { name: 'A', x: 100, y: 0, parent: 0, collapsed: true }],
      ['b', { name: 'B', x: 200, y: 0, parent: 'a' }],
      ['c', { name: 'C', x: 300, y: 0, parent: 'b' }],
      ['d', { name: 'D', x: 100, y: 100, parent: 0 }]
    ])
  }

  it('hides every descendant of a collapsed node, but not the node itself', () => {
    const list = prepareList(collapsedSample())
    expect(list.get('a')?.collapsed).toBe(true)
    expect(list.get('a')?.hidden).toBe(false)
    expect(list.get('b')?.hidden).toBe(true)
    expect(list.get('c')?.hidden).toBe(true)
    expect(list.get(0)?.hidden).toBe(false)
    expect(list.get('d')?.hidden).toBe(false)
  })

  it('counts hidden descendants per collapsed visible node', () => {
    const counts = collapsedCounts(prepareList(collapsedSample()))
    expect(counts.get('a')).toBe(2)
    expect(counts.has(0)).toBe(false)
    expect(counts.has('d')).toBe(false)
  })

  it('skips collapsed nodes that are themselves hidden', () => {
    const adj = collapsedSample()
    adj.set('b', { ...adj.get('b')!, collapsed: true })
    const counts = collapsedCounts(prepareList(adj))
    expect(counts.has('b')).toBe(false)
    expect(counts.get('a')).toBe(2)
  })
})

describe('canReparent', () => {
  it('rejects self and descendants, allows everything else', () => {
    const nodes = Array.from(prepareList(sample()).values())
    expect(canReparent(nodes, 'a', 'a')).toBe(false)
    expect(canReparent(nodes, 'a', 'b')).toBe(false)
    expect(canReparent(nodes, 'b', 0)).toBe(true)
    expect(canReparent(nodes, 0, 'b')).toBe(false)
    expect(canReparent(nodes, 'b', 'a')).toBe(true)
  })
})

describe('preparePaths', () => {
  it('creates one edge per non-root node', () => {
    const paths = preparePaths(prepareList(sample()))
    expect(paths.size).toBe(2)
  })
})

describe('branch / children', () => {
  it('returns the full sub-tree in pre-order', () => {
    const list = prepareList(sample())
    const sub = branch(Array.from(list.values()), 0)
    expect(sub.map((n) => n.id)).toEqual(['a', 'b'])
  })

  it('lists direct children only', () => {
    const list = prepareList(sample())
    expect(children(Array.from(list.values()), 0).map((n) => n.id ?? '?')).toEqual([
      'a'
    ])
  })
})
