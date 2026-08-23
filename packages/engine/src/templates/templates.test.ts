import { describe, expect, it } from 'vitest'
import { builtinTemplate, listTemplates, prepareTemplate, type TemplateDoc } from './index'

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

describe('the built-ins', () => {
  const keys = listTemplates().map((choice) => choice.key!)

  it('offers the blank one first', () => {
    // The admin bar's "+ New → Mind Map" creates this one without asking, and
    // starting from nothing is the common case.
    expect(keys[0]).toBe('blank')
  })

  it('are all resolvable, titled and described', () => {
    for (const key of keys) {
      const template = builtinTemplate(key)
      expect(template, key).toBeTruthy()
      expect(template.title, key).not.toBe('')
      expect(template.description, key).toBeTruthy()
    }
  })

  it('each start from one root that carries the {index}', () => {
    for (const key of keys) {
      const content = builtinTemplate(key).content
      const roots = content.filter(([, node]) => node.parent === undefined)
      expect(roots, key).toHaveLength(1)
      expect(content[0][1].name, key).toContain('{index}')
    }
  })

  it('hang every other node off a node that exists', () => {
    // A dangling parent is dropped on the way to storage, which would quietly
    // detach a branch of a template nobody thought to open first.
    for (const key of keys) {
      const content = builtinTemplate(key).content
      const ids = new Set(content.map(([id, node]) => node.id ?? id))
      for (const [, node] of content) {
        if (node.parent === undefined) continue
        expect(ids.has(node.parent), `${key}: ${String(node.parent)}`).toBe(true)
      }
    }
  })

  it('survive being prepared, which is the only way they are ever used', () => {
    for (const key of keys) {
      const out = prepareTemplate(builtinTemplate(key), { centerX: 500, centerY: 400 }, 2)
      expect([out.content[0][1].x, out.content[0][1].y], key).toEqual([500, 400])
      expect(out.title, key).not.toContain('{index}')
      expect(out.content.every(([, node]) => Number.isFinite(node.x) && Number.isFinite(node.y))).toBe(true)
    }
  })
})
