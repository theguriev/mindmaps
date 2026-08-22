/**
 * Map document validation and normalization — pure, backend-independent.
 *
 * Every store runs untrusted input (localStorage entries written by an older
 * build, a REST response, an imported file) through `parseMapDoc` before it
 * reaches the engine, so a corrupt document degrades to `null` instead of
 * crashing the editor. The WordPress plugin mirrors these rules in PHP
 * (`services/wordpress/plugin/mind-maps/src/document.php`) — keep the two in
 * sync when the schema changes.
 */
import { PREVIEW_MAX_POINTS, mapPreview } from '@mindmaps/engine/preview'
import type { MapDoc, MapPreview, MapSummary, NodeId, RawNode } from '@mindmaps/engine'

/** Schema version stamped on every document this build writes. */
export const DOC_VERSION = 1

function isNodeId (value: unknown): value is NodeId {
  return typeof value === 'string' || typeof value === 'number'
}

function parseNode (value: unknown): RawNode | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as Record<string, unknown>
  if (typeof raw.name !== 'string') return null
  if (!Number.isFinite(raw.x) || !Number.isFinite(raw.y)) return null

  const node: RawNode = {
    name: raw.name,
    x: raw.x as number,
    y: raw.y as number
  }
  if (isNodeId(raw.id)) node.id = raw.id
  if (isNodeId(raw.parent)) node.parent = raw.parent
  if (typeof raw.stroke === 'string') node.stroke = raw.stroke
  if (Number.isFinite(raw.strokeWidth)) node.strokeWidth = raw.strokeWidth as number
  if (raw.lineStyle === 'solid' || raw.lineStyle === 'dashed') node.lineStyle = raw.lineStyle
  if (raw.lineShape === 'straight' || raw.lineShape === 'smooth') node.lineShape = raw.lineShape
  if (Number.isFinite(raw.width)) node.width = raw.width as number
  if (Number.isFinite(raw.height)) node.height = raw.height as number
  if (raw.sticky === true) node.sticky = true
  if (raw.collapsed === true) node.collapsed = true
  if (typeof raw.reaction === 'string') node.reaction = raw.reaction
  return node
}

/** Validate a document's content entries, dropping anything malformed and any
 *  parent pointer that would dangle or close a cycle. */
export function parseContent (value: unknown): Array<[NodeId, RawNode]> | null {
  if (!Array.isArray(value)) return null
  const entries: Array<[NodeId, RawNode]> = []
  const seen = new Set<NodeId>()
  for (const entry of value) {
    if (!Array.isArray(entry) || entry.length !== 2) return null
    const [key, rawNode] = entry as [unknown, unknown]
    if (!isNodeId(key) || seen.has(key)) return null
    const node = parseNode(rawNode)
    if (!node) return null
    seen.add(key)
    entries.push([key, node])
  }

  // Drop parents that point outside the document, then reject cycles: the
  // engine walks parent chains (hidden-state derivation, branch moves).
  const ids = new Set(entries.map(([key, node]) => node.id ?? key))
  const parentOf = new Map<NodeId, NodeId | undefined>()
  for (const [key, node] of entries) {
    const id = node.id ?? key
    if (node.parent !== undefined && !ids.has(node.parent)) delete node.parent
    parentOf.set(id, node.parent)
  }
  for (const id of ids) {
    const walked = new Set<NodeId>()
    let cur: NodeId | undefined = id
    while (cur !== undefined) {
      if (walked.has(cur)) return null
      walked.add(cur)
      cur = parentOf.get(cur)
    }
  }
  return entries
}

/**
 * Validate and normalize an unknown value into a `MapDoc`, or return null.
 * `fallbackId` is used when the payload carries none (some legacy localStorage
 * entries were written without one).
 */
export function parseMapDoc (value: unknown, fallbackId?: string): MapDoc | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as Record<string, unknown>

  const id = isNodeId(raw.id) ? String(raw.id) : fallbackId
  if (id === undefined || id === '') return null

  const content = parseContent(raw.content ?? [])
  if (!content) return null

  const doc: MapDoc = {
    id,
    title: typeof raw.title === 'string' ? raw.title : '',
    content,
    version: DOC_VERSION
  }
  if (typeof raw.modified === 'string') doc.modified = raw.modified
  if (typeof raw.date === 'string') doc.date = raw.date
  if (typeof raw.meta === 'object' && raw.meta !== null) {
    const meta = raw.meta as Record<string, unknown>
    if (typeof meta.template === 'string') doc.meta = { template: meta.template }
  }
  return doc
}

/**
 * Validate an unknown value into a `MapPreview`, or return null.
 *
 * The trust boundary for a drawing: a renderer walks `parents` as indices into
 * `points` with no guards, on the projection's promise that a parent is always
 * emitted before its child. Nothing off the wire gets to make that promise, so
 * it is checked here — and a preview that fails costs its map a thumbnail, not
 * its row.
 */
export function parsePreview (value: unknown): MapPreview | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as Record<string, unknown>

  const { width, height, points, parents } = raw
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null
  if (!Array.isArray(points) || !Array.isArray(parents)) return null
  if (parents.length === 0 || parents.length > PREVIEW_MAX_POINTS) return null
  if (points.length !== parents.length * 2) return null
  if (!points.every((point) => Number.isFinite(point))) return null

  for (let i = 0; i < parents.length; i++) {
    const parent: unknown = parents[i]
    // `< i` is the invariant, and it makes `-1` the only legal value at 0.
    if (!Number.isInteger(parent) || (parent as number) < -1 || (parent as number) >= i) {
      return null
    }
  }

  return {
    width: width as number,
    height: height as number,
    points: points as number[],
    parents: parents as number[]
  }
}

/**
 * Validate and normalize an unknown value into a `MapSummary`, or return null.
 *
 * A backend that sends a summary is believed; one that still sends whole
 * documents has its content projected here instead. That branch is what lets
 * a new client talk to an old server — and what let the thumbnail ship before
 * the wire changed shape.
 */
export function parseMapSummary (value: unknown, fallbackId?: string): MapSummary | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as Record<string, unknown>

  const id = isNodeId(raw.id) ? String(raw.id) : fallbackId
  if (id === undefined || id === '') return null

  // Only parsed when the payload gives us no better answer — projecting a
  // hundred documents is the cost this type exists to stop paying.
  const derived = raw.preview === undefined || raw.nodes === undefined
    ? parseContent(raw.content ?? [])
    : null

  const summary: MapSummary = {
    id,
    title: typeof raw.title === 'string' ? raw.title : '',
    nodes:
      Number.isInteger(raw.nodes) && (raw.nodes as number) >= 0
        ? (raw.nodes as number)
        : (derived?.length ?? 0),
    preview: parsePreview(raw.preview) ?? (derived === null ? null : mapPreview(derived))
  }
  if (typeof raw.modified === 'string') summary.modified = raw.modified
  if (typeof raw.date === 'string') summary.date = raw.date
  if (typeof raw.meta === 'object' && raw.meta !== null) {
    const meta = raw.meta as Record<string, unknown>
    if (typeof meta.template === 'string') summary.meta = { template: meta.template }
  }
  return summary
}

/** The wire form a store persists: normalized, version-stamped, id-free where
 *  the backend owns the id. */
export function toWire (doc: MapDoc): Record<string, unknown> {
  return {
    id: doc.id,
    title: doc.title,
    content: doc.content,
    modified: doc.modified,
    meta: doc.meta,
    version: DOC_VERSION
  }
}
