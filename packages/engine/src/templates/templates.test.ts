import { describe, expect, it } from 'vitest'
import { prepareTemplate, type TemplateDoc } from './index'

const tpl: TemplateDoc = {
  title: 'T {index}',
  description: 'desc',
  meta: { template: '1' },
  content: [
    [0, { name: 'Root {index}', x: 10, y: 20 }],
    ['a', { name: 'child', x: 30, y: 40, parent: 0 }]
  ]
}

describe('prepareTemplate', () => {
  it('centres the root and shifts the branch by the same offset', () => {
    const out = prepareTemplate(tpl, { centerX: 500, centerY: 500 }, 3)
    expect([out.content[0][1].x, out.content[0][1].y]).toEqual([500, 500])
    expect([out.content[1][1].x, out.content[1][1].y]).toEqual([520, 520])
  })

  it('substitutes {index} into the title', () => {
    const out = prepareTemplate(tpl, { centerX: 0, centerY: 0 }, 3)
    expect(out.title).toBe('Root 3')
    expect(out.title).not.toContain('{index}')
  })

  it('preserves meta and description (custom templates stay templates)', () => {
    const out = prepareTemplate(tpl, { centerX: 0, centerY: 0 }, 1)
    expect(out.meta?.template).toBe('1')
    expect((out as TemplateDoc).description).toBe('desc')
  })
})
