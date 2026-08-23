import { describe, expect, it } from 'vitest'
import { nodeLabel, previewSvg, toChoices } from './block'

const doc = (id: string, title: string) => ({
  id,
  title,
  content: [
    ['r', { name: 'Root', x: 0, y: 0 }],
    ['c', { name: 'Child', x: 100, y: 0, parent: 'r' }]
  ]
})

describe('toChoices', () => {
  it('names and draws every map the endpoint returned', () => {
    const choices = toChoices([doc('1', 'Plan'), doc('2', 'Notes')])

    expect(choices.map((choice) => [choice.id, choice.title, choice.nodes])).toEqual([
      ['1', 'Plan', 2],
      ['2', 'Notes', 2]
    ])
    expect(choices[0].preview).not.toBeNull()
  })

  it('reads a summary as happily as a whole document', () => {
    // The endpoint sends documents today and summaries after the wire changes;
    // the picker must not care which arrived.
    const choices = toChoices([
      { id: '7', title: 'Lean', nodes: 42, preview: { width: 255, height: 0, points: [0, 0], parents: [-1] } }
    ])

    expect(choices).toEqual([
      { id: '7', title: 'Lean', nodes: 42, preview: { width: 255, height: 0, points: [0, 0], parents: [-1] } }
    ])
  })

  it('gives an untitled map something to be picked by', () => {
    expect(toChoices([doc('1', '')])[0].title).toBe('Untitled map')
  })

  it('skips what is not a map, and survives what is not a list', () => {
    expect(toChoices([doc('1', 'Plan'), null, { title: 'no id' }])).toHaveLength(1)
    expect(toChoices(null)).toEqual([])
    expect(toChoices({ maps: [] })).toEqual([])
  })
})

describe('previewSvg', () => {
  it('draws the map as three paths', () => {
    const [choice] = toChoices([doc('1', 'Plan')])
    const svg = previewSvg(choice.preview, 96)

    expect(svg).toContain('width="96"')
    expect(svg.match(/<path/g)).toHaveLength(3)
    // Marked decorative: the title beside it is what names the map.
    expect(svg).toContain('aria-hidden="true"')
  })

  it('draws an empty frame for a map with no shape, rather than nothing at all', () => {
    const svg = previewSvg(null, 96)

    expect(svg).toContain('<svg')
    expect(svg).not.toContain('<path')
  })
})

describe('nodeLabel', () => {
  it('counts in words the reader would use', () => {
    expect(nodeLabel(0)).toBe('0 nodes')
    expect(nodeLabel(1)).toBe('1 node')
    expect(nodeLabel(25)).toBe('25 nodes')
  })
})
