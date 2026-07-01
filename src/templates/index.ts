/**
 * Template registry + centering helper (port of `useTemplates`).
 */
import type { MapDoc, NodeId, RawNode } from '@/mindmap/types'
import blankRaw from './blank'
import markdownRaw from './markdown'
import emojisRaw from './emojis'

export interface TemplateDoc {
  id?: NodeId
  title: string
  description?: string
  content: Array<[NodeId, RawNode]>
  date?: string
  modified?: string
  meta?: { template?: string }
}

const blank = blankRaw as unknown as TemplateDoc
const markdown = markdownRaw as unknown as TemplateDoc
const emojis = emojisRaw as unknown as TemplateDoc

const BUILTIN: TemplateDoc[] = [blank, markdown, emojis]

export interface Center {
  centerX: number
  centerY: number
}

/**
 * Centers a template's content on the given point and substitutes {index}.
 * Returns a fresh document ready to be persisted.
 */
export function prepareTemplate (
  template: TemplateDoc,
  { centerX, centerY }: Center,
  index: number
): Omit<MapDoc, 'id'> {
  const root = { ...template.content[0][1] }
  const offsetX = centerX - root.x
  const offsetY = centerY - root.y

  const content: Array<[NodeId, RawNode]> = template.content.map(
    ([id, node]) => [id, { ...node, x: node.x + offsetX, y: node.y + offsetY }]
  )
  const name = (content[0][1].name || '').replace('{index}', String(index))
  content[0][1] = { ...content[0][1], name }

  // Preserve remaining template fields (meta/description) like the Vue original's
  // `{ ...template, title }`, so custom templates stay templates.
  const { id: _id, date: _date, modified: _modified, ...rest } = template
  void _id
  void _date
  void _modified
  return { ...rest, title: name, content }
}

export function listTemplates (customMaps: MapDoc[] = []): TemplateDoc[] {
  const custom = customMaps
    .filter((el) => (el.meta?.template ?? '0')[0] === '1')
    .map((el) => ({ ...el, description: 'Custom template' }))

  return [...BUILTIN, ...custom].map((el) => {
    const { id: _id, date: _date, modified: _modified, ...rest } = el as TemplateDoc
    void _id
    void _date
    void _modified
    return rest as TemplateDoc
  })
}
