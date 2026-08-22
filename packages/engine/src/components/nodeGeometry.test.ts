import { describe, expect, it } from 'vitest'
import {
  DEFAULT_WRAP_WIDTH,
  EDITOR_MIN_H,
  EDITOR_MIN_W,
  ROOT_PAD_X,
  STICKY_PAD,
  editorToolbarSide,
  wrapWidthFor
} from './nodeGeometry'
import type { MindNode } from '../mindmap/types'

function node (over: Partial<MindNode> = {}): MindNode {
  return {
    id: 'n',
    name: 'text',
    x: 0,
    y: 0,
    width: 140,
    height: 32,
    editing: false,
    component: 'node',
    isRightSide: true,
    isUpSide: false,
    isHaveChildren: false,
    collapsed: false,
    hidden: false,
    ...over
  }
}

describe('the edit overlay floors', () => {
  it('leave room for the toolbar-free box the textarea renders', () => {
    expect(EDITOR_MIN_W).toBeLessThan(DEFAULT_WRAP_WIDTH)
    expect(EDITOR_MIN_H).toBeGreaterThan(0)
  })

  it('are exactly where a resized width stops being honoured', () => {
    // The resize drag clamps to EDITOR_MIN_W, so a node dragged as narrow as
    // it goes must keep that width: one pixel lower and `wrapWidthFor` reads
    // it as "never resized" and the node jumps out to the default column.
    expect(wrapWidthFor(node({ width: EDITOR_MIN_W }))).toBe(EDITOR_MIN_W)
    expect(wrapWidthFor(node({ width: EDITOR_MIN_W - 1 }))).toBe(DEFAULT_WRAP_WIDTH)
  })

  it('leave the never-resized default alone', () => {
    // 140 is what `prepareList` gives a fresh node.
    expect(wrapWidthFor(node({ width: 140 }))).toBe(DEFAULT_WRAP_WIDTH)
  })
})

describe('wrapWidthFor', () => {
  it('takes the root padding off both sides', () => {
    expect(wrapWidthFor(node({ component: 'root', width: 400 }))).toBe(
      400 - ROOT_PAD_X * 2
    )
  })

  it('wraps a sticky note inside its own padding, at any width', () => {
    expect(wrapWidthFor(node({ sticky: true, width: 200 }))).toBe(
      200 - STICKY_PAD * 2
    )
    // Sticky notes are sized freely, so a narrow one still gets a column.
    expect(wrapWidthFor(node({ sticky: true, width: 100 }))).toBe(80)
  })
})

describe('editorToolbarSide', () => {
  it('puts the bar above the textarea by default', () => {
    expect(editorToolbarSide('top')).toBe('top')
    expect(editorToolbarSide('center')).toBe('top')
  })

  it('flips it below when the overlay hangs upwards from its anchor', () => {
    // `anchorY: 'bottom'` (a right-side, up-side branch node) grows the box
    // away from the node upwards — a bar above it would float off the top.
    expect(editorToolbarSide('bottom')).toBe('bottom')
  })
})
