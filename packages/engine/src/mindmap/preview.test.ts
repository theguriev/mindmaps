import { describe, expect, it } from 'vitest'
import {
  PREVIEW_MAX_POINTS,
  PREVIEW_SPAN,
  mapPreview,
  previewPaths
} from './preview'
import type { NodeId, RawNode } from './types'

type Entry = [NodeId, RawNode]

function node (name: string, x: number, y: number, parent?: NodeId): RawNode {
  return parent === undefined ? { name, x, y } : { name, x, y, parent }
}

describe('mapPreview', () => {
  it('has nothing to draw for an empty map', () => {
    expect(mapPreview([])).toBeNull()
  })

  it('normalizes into the span, keeping the map\'s proportions', () => {
    // 200 wide, 100 tall: the long side fills the span and the short one gets
    // half of it, so the thumbnail is not stretched into a square.
    const content: Entry[] = [
      ['a', node('a', 100, 50)],
      ['b', node('b', 300, 50, 'a')],
      ['c', node('c', 300, 150, 'a')]
    ]

    const preview = mapPreview(content)

    // 127 rather than 128: the scale is 255/200, which no double holds
    // exactly, so `100 * scale` lands at 127.49999999999999. Stated as the
    // literal it is, because the PHP mirror has to produce this same number
    // and would not from a formula written a different way.
    expect(preview).toEqual({
      width: PREVIEW_SPAN,
      height: 127,
      points: [0, 0, PREVIEW_SPAN, 0, PREVIEW_SPAN, 127],
      parents: [-1, 0, 0]
    })
  })

  it('places a lone node at the origin instead of dividing by no span', () => {
    expect(mapPreview([['a', node('a', 7, 9)]])).toEqual({
      width: 0,
      height: 0,
      points: [0, 0],
      parents: [-1]
    })
  })

  it('emits every parent before its children', () => {
    // Stored in an order that puts a child first, which is legal.
    const content: Entry[] = [
      ['leaf', node('leaf', 200, 0, 'mid')],
      ['mid', node('mid', 100, 0, 'root')],
      ['root', node('root', 0, 0)]
    ]

    const preview = mapPreview(content)

    expect(preview?.parents).toEqual([-1, 0, 1])
    // Which is the invariant a renderer relies on, stated directly.
    preview?.parents.forEach((parent, index) => expect(parent).toBeLessThan(index))
  })

  it('keeps `0` and `\'0\'` apart, the way the adjacency does', () => {
    const content: Entry[] = [
      [0, { name: 'number', x: 0, y: 0 }],
      ['0', { name: 'string', x: 100, y: 0 }],
      ['child', node('child', 200, 0, 0)]
    ]

    // The child hangs off the numeric `0`, which is point 0 — not off the
    // string `'0'`, which is a second root.
    expect(mapPreview(content)?.parents).toEqual([-1, -1, 0])
  })

  it('treats a dangling parent as a root rather than dropping the node', () => {
    const content: Entry[] = [
      ['a', node('a', 0, 0)],
      ['b', node('b', 100, 0, 'gone')]
    ]

    expect(mapPreview(content)?.parents).toEqual([-1, -1])
  })

  it('draws a cycle\'s nodes even though it can reach none of them from a root', () => {
    const content: Entry[] = [
      ['a', node('a', 0, 0, 'b')],
      ['b', node('b', 100, 0, 'a')]
    ]

    const preview = mapPreview(content)

    expect(preview?.points).toEqual([0, 0, PREVIEW_SPAN, 0])
    expect(preview?.parents).toEqual([-1, 0])
  })

  it('emits a node once when two entries claim one id', () => {
    // The stored form dedupes on the entry key, so this is reachable.
    const content: Entry[] = [
      ['a', { name: 'first', x: 0, y: 0 }],
      ['b', { id: 'a', name: 'impostor', x: 100, y: 0 }],
      ['c', node('c', 200, 0, 'a')]
    ]

    const preview = mapPreview(content)

    expect(preview?.parents).toHaveLength(3)
    expect(preview?.parents.filter((parent) => parent === 0)).toHaveLength(1)
  })

  it('drops a node it cannot place without taking the branch under it', () => {
    const content: Entry[] = [
      ['a', node('a', 0, 0)],
      ['b', { name: 'b', x: Number.NaN, y: 0, parent: 'a' }],
      ['c', node('c', 100, 0, 'b')]
    ]

    // `b` has no position and cannot be drawn. `c` does, so it is drawn — the
    // orphan sweep picks it up as a root, which costs the branch its line and
    // not its node.
    expect(mapPreview(content)?.parents).toEqual([-1, -1])
    expect(mapPreview(content)?.points).toEqual([0, 0, PREVIEW_SPAN, 0])
  })

  it('stops at the cap, and never leaves a parent index past the end', () => {
    const content: Entry[] = Array.from({ length: PREVIEW_MAX_POINTS + 50 }, (_, i) => [
      `n${i}`,
      node(`n${i}`, i * 10, i % 7, i === 0 ? undefined : `n${i - 1}`)
    ])

    const preview = mapPreview(content)

    expect(preview?.parents).toHaveLength(PREVIEW_MAX_POINTS)
    expect(preview?.points).toHaveLength(PREVIEW_MAX_POINTS * 2)
    preview?.parents.forEach((parent, index) => expect(parent).toBeLessThan(index))
  })
})

describe('previewPaths', () => {
  it('draws a branch, its node and the root it hangs from', () => {
    const preview = mapPreview([
      ['a', node('a', 0, 0)],
      ['b', node('b', 100, 0, 'a')]
    ])

    expect(previewPaths(preview!)).toEqual({
      edges: `M0 0L${PREVIEW_SPAN} 0`,
      dots: `M${PREVIEW_SPAN} 0h0`,
      roots: 'M0 0h0'
    })
  })

  it('says nothing about a map of one node beyond where it is', () => {
    const preview = mapPreview([['a', node('a', 5, 5)]])

    expect(previewPaths(preview!)).toEqual({
      edges: '',
      dots: '',
      roots: 'M0 0h0'
    })
  })
})
