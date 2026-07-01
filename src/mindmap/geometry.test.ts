import { describe, expect, it } from 'vitest'
import { createEdge, getNewPosition, isRightSide, isUpSide } from './geometry'

describe('geometry', () => {
  it('computes side relative to the parent', () => {
    expect(isRightSide({ x: 0 }, { x: 10 })).toBe(true)
    expect(isRightSide({ x: 10 }, { x: 0 })).toBe(false)
    expect(isUpSide({ y: 10 }, { y: 0 })).toBe(true)
  })

  it('builds a smooth edge with offset control points and defaults', () => {
    const edge = createEdge(
      'child',
      { id: 'child', name: '', x: 100, y: 50, parent: 0, stroke: '#f00' },
      { name: 'r', x: 0, y: 0 }
    )
    expect(edge).toMatchObject({
      id: 'child-child',
      x: 0,
      y: 0,
      x4: 100,
      y4: 50,
      stroke: '#f00',
      strokeWidth: 6,
      lineStyle: 'solid',
      lineShape: 'smooth'
    })
    // Smooth → control points are offset from the endpoints.
    expect(edge.x2).not.toBe(edge.x)
  })

  it('collapses control points to a straight line for straight edges', () => {
    const edge = createEdge(
      'c',
      { id: 'c', name: '', x: 100, y: 50, parent: 0, lineShape: 'straight' },
      { name: 'r', x: 0, y: 0 }
    )
    expect(edge.lineShape).toBe('straight')
    expect([edge.x2, edge.y2]).toEqual([edge.x, edge.y])
    expect([edge.x3, edge.y3]).toEqual([edge.x4, edge.y4])
  })

  it('honours per-node weight and style', () => {
    const edge = createEdge(
      'c',
      { id: 'c', name: '', x: 1, y: 1, parent: 0, strokeWidth: 10, lineStyle: 'dashed' },
      { name: 'r', x: 0, y: 0 }
    )
    expect(edge.strokeWidth).toBe(10)
    expect(edge.lineStyle).toBe('dashed')
  })

  it('produces finite radial placement', () => {
    const pos = getNewPosition(3)
    expect(Number.isFinite(pos.x) && Number.isFinite(pos.y)).toBe(true)
  })

  it('flags edges into sticky notes (dashed tether, no arrow-heads)', () => {
    const sticky = createEdge(
      'note',
      { id: 'note', name: '', x: 40, y: 150, parent: 0, sticky: true },
      { name: 'r', x: 0, y: 0 }
    )
    expect(sticky.sticky).toBe(true)
    const normal = createEdge(
      'c',
      { id: 'c', name: '', x: 40, y: 10, parent: 0 },
      { name: 'r', x: 0, y: 0 }
    )
    expect(normal.sticky).toBe(false)
  })
})
