/**
 * Clock-index math (ported verbatim from the Vue app). Encodes the quadrant of
 * a node relative to its parent so branch/resize logic can avoid switch/if
 * ladders.
 *
 * 11 = right-up, 9 = left-up, -9 = right-down, -11 = left-down.
 */
export const RIGHT_SIDE = 1
export const LEFT_SIDE = -1
export const UP_SIDE = 10
export const DOWN_SIDE = -10
export const HAVE_CHILDREN = 100
export const NO_CHILDREN = -100

export interface ClockNode {
  isRightSide?: boolean
  isUpSide?: boolean
  isHaveChildren?: boolean
  component?: 'root' | 'node'
}

export function clockIndex ({ isRightSide, isUpSide }: ClockNode): number {
  const leftRight = isRightSide ? RIGHT_SIDE : LEFT_SIDE
  const upDown = isUpSide ? UP_SIDE : DOWN_SIDE
  return leftRight + upDown
}

export function clockIndexWithChildren ({
  isRightSide,
  isUpSide,
  isHaveChildren,
  component
}: ClockNode): number {
  if (component === 'root') {
    return -9
  }
  const leftRight = isRightSide ? RIGHT_SIDE : LEFT_SIDE
  const upDown = isUpSide ? UP_SIDE : DOWN_SIDE
  const haveNo = isHaveChildren ? HAVE_CHILDREN : NO_CHILDREN
  const clock = new Map<number, number>([
    [109, 11],
    [89, -9],
    [-91, -11],
    [-111, -11],
    [111, 9],
    [91, -11],
    [-89, -9],
    [-109, -9]
  ])
  return clock.get(leftRight + upDown + haveNo) as number
}
