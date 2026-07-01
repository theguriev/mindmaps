/**
 * Pure geometry for branch sides, new-node placement and bezier control points.
 * Ported from `useAdjacency.js` in the Vue app.
 */
import type { NodeId, PathEdge, RawNode } from './types'

export function isUpSide (from: { y: number }, to: { y: number }): boolean {
  return from.y > to.y
}

export function isRightSide (from: { x: number }, to: { x: number }): boolean {
  return from.x < to.x
}

interface ControlPoints {
  x2: number
  y2: number
  x3: number
  y3: number
}

export function pathsCalculations (
  isRight: boolean,
  from: { x: number; y: number },
  to: { x: number; y: number }
): ControlPoints {
  const offset = 30
  const xDistance = to.x - from.x
  const xHalf = xDistance / 2

  if (isRight === true) {
    return {
      x2: from.x + xHalf + offset,
      y2: from.y,
      x3: from.x + xHalf - offset,
      y3: to.y
    }
  }

  return {
    x2: from.x + xHalf - offset,
    y2: from.y,
    x3: from.x + xHalf + offset,
    y3: to.y
  }
}

export function createEdge (
  id: NodeId,
  to: RawNode & { id: NodeId },
  from: RawNode
): PathEdge {
  const newId = `${id}-${to.id}`
  const right = isRightSide(from, to)
  const points23 = pathsCalculations(right, from, to)

  return {
    id: newId,
    fromID: id,
    toID: to.id,
    x: from.x,
    y: from.y,
    x2: points23.x2,
    y2: points23.y2,
    x3: points23.x3,
    y3: points23.y3,
    x4: to.x,
    y4: to.y,
    isRightSide: right,
    strokeWidth: 6,
    stroke: to.stroke || 'black'
  }
}

export function getNewPosition (
  index = 1,
  pieces = 9,
  distance = 200
): { x: number; y: number } {
  let offset = 0
  if (index >= pieces) {
    offset = Math.floor(index / pieces) * 0.03
  }
  const pi = ((2 * Math.PI) / pieces + offset) * (index - 2)
  return {
    x: +Math.cos(pi).toFixed(2) * distance,
    y: +Math.sin(pi).toFixed(2) * distance
  }
}
