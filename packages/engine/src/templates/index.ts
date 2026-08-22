/**
 * Template registry + centering helper (port of `useTemplates`).
 */
import type { MapDoc, MapSummary, NodeId, RawNode } from '../mindmap/types'
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

/**
 * The empty starting point.
 *
 * Named rather than reached by index: "the first built-in" is an accident of
 * the array's order, and the WordPress admin bar's "+ New" creates exactly
 * this one without asking.
 */
export function blankTemplate (): TemplateDoc {
  return blank
}

/** Names a built-in, so the picker can offer one without carrying it. */
export type BuiltinTemplate = 'blank' | 'markdown' | 'emojis'

/**
 * One entry in the "New" picker.
 *
 * A choice is a name, not a document: the built-ins are already in the bundle,
 * and a starred map's content is fetched when somebody picks it rather than
 * for every row of a list nobody may pick from. Which is the same reason the
 * list itself stopped shipping content — see `MapSummary`.
 */
export interface TemplateChoice {
  /** Set for a built-in; `id` is set instead for a map the viewer starred. */
  key?: BuiltinTemplate
  id?: NodeId
  title: string
  description?: string
}

const BUILTIN_BY_KEY: Record<BuiltinTemplate, TemplateDoc> = {
  blank,
  markdown,
  emojis
}

/** The template a `TemplateChoice.key` names. */
export function builtinTemplate (key: BuiltinTemplate): TemplateDoc {
  return BUILTIN_BY_KEY[key]
}

/** Turns a map the viewer starred into something `prepareTemplate` accepts. */
export function templateFromDoc (doc: MapDoc): TemplateDoc {
  const { id: _id, date: _date, modified: _modified, ...rest } = doc
  void _id
  void _date
  void _modified
  return { ...rest, description: 'Custom template' }
}

/** The built-ins, followed by every map the viewer marked as a template. */
export function listTemplates (customMaps: MapSummary[] = []): TemplateChoice[] {
  const builtin: TemplateChoice[] = (Object.keys(BUILTIN_BY_KEY) as BuiltinTemplate[]).map(
    (key) => ({
      key,
      title: BUILTIN_BY_KEY[key].title,
      description: BUILTIN_BY_KEY[key].description
    })
  )

  const custom: TemplateChoice[] = customMaps
    .filter((el) => (el.meta?.template ?? '0')[0] === '1')
    .map((el) => ({ id: el.id, title: el.title, description: 'Custom template' }))

  return [...builtin, ...custom]
}
