import { describe, expect, it } from 'vitest'
import { clockIndex, clockIndexWithChildren } from './clockIndex'

describe('clockIndex', () => {
  it('encodes quadrants', () => {
    expect(clockIndex({ isRightSide: true, isUpSide: true })).toBe(11)
    expect(clockIndex({ isRightSide: false, isUpSide: true })).toBe(9)
    expect(clockIndex({ isRightSide: true, isUpSide: false })).toBe(-9)
    expect(clockIndex({ isRightSide: false, isUpSide: false })).toBe(-11)
  })

  it('maps root and child-bearing quadrants', () => {
    expect(clockIndexWithChildren({ component: 'root' })).toBe(-9)
    expect(
      clockIndexWithChildren({ isRightSide: true, isUpSide: true, isHaveChildren: true })
    ).toBe(9)
  })
})
