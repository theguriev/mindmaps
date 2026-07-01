import { describe, expect, it } from 'vitest'
import { branch, children, prepareList, preparePaths } from './list'
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
