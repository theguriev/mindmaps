/**
 * Branch serialization for copy / cut / paste and duplicate.
 *
 * The clipboard carries two representations: a JSON payload under a custom
 * MIME type (full fidelity, same-browser paste) and a plain-text indented
 * outline (lossy, but readable anywhere — and parsed back when pasting plain
 * text, so an indented list from any editor becomes a branch).
 */
import type { NodeId, RawNode } from './types'
import { branch } from './list'

export const CLIPBOARD_MIME = 'application/x-mind-maps'

export interface BranchClipboard {
  type: 'mind-maps/branches'
  version: 1
  /** Copied selection roots, in selection order. Roots keep their original
   *  `parent` in `nodes` — paste decides what to do with it. */
  roots: NodeId[]
  nodes: Array<RawNode & { id: NodeId }>
}

function withIds (map: Map<NodeId, RawNode>): Array<RawNode & { id: NodeId }> {
  return Array.from(map.entries(), ([key, value]) => ({
    ...value,
    id: value.id ?? key
  }))
}

/** Drop transient / derived fields so the payload holds only persisted state. */
function sanitize (n: RawNode & { id: NodeId }): RawNode & { id: NodeId } {
  const copy = { ...n }
  delete copy.editing
  delete copy.component
  delete copy.isRightSide
  delete copy.isUpSide
  delete copy.isHaveChildren
  return copy
}

/** Serialize `rootIds` (assumed disjoint selection roots) with their branches. */
export function collectBranches (
  adjacency: Map<NodeId, RawNode>,
  rootIds: NodeId[]
): BranchClipboard {
  const all = withIds(adjacency)
  const seen = new Set<NodeId>()
  const nodes: Array<RawNode & { id: NodeId }> = []
  const roots: NodeId[] = []
  for (const rootId of rootIds) {
    if (seen.has(rootId)) continue
    const root = all.find((n) => n.id === rootId)
    if (!root) continue
    roots.push(rootId)
    for (const n of [root, ...branch(all, rootId)]) {
      if (seen.has(n.id)) continue
      seen.add(n.id)
      nodes.push(sanitize(n))
    }
  }
  return { type: 'mind-maps/branches', version: 1, roots, nodes }
}

/** One line per node, two-space indent per depth — the text/plain fallback. */
export function outlineText (clip: BranchClipboard): string {
  const inClip = new Map(clip.nodes.map((n) => [n.id, n]))
  const byParent = new Map<NodeId, Array<RawNode & { id: NodeId }>>()
  for (const n of clip.nodes) {
    if (n.parent === undefined || !inClip.has(n.parent)) continue
    const bucket = byParent.get(n.parent)
    if (bucket) bucket.push(n)
    else byParent.set(n.parent, [n])
  }
  const lines: string[] = []
  const emit = (node: RawNode & { id: NodeId }, depth: number) => {
    const text = node.name.replace(/\s+/g, ' ').trim() || '—'
    lines.push('  '.repeat(depth) + text)
    for (const child of byParent.get(node.id) ?? []) emit(child, depth + 1)
  }
  for (const rootId of clip.roots) {
    const root = inClip.get(rootId)
    if (root) emit(root, 0)
  }
  return lines.join('\n')
}

/** Copy an optional field when its runtime type is what the model expects. */
function pick (
  out: RawNode & { id: NodeId },
  n: Record<string, unknown>
): void {
  if (typeof n.stroke === 'string') out.stroke = n.stroke
  if (typeof n.strokeWidth === 'number' && Number.isFinite(n.strokeWidth)) {
    out.strokeWidth = n.strokeWidth
  }
  if (n.lineStyle === 'solid' || n.lineStyle === 'dashed') out.lineStyle = n.lineStyle
  if (n.lineShape === 'straight' || n.lineShape === 'smooth') out.lineShape = n.lineShape
  if (typeof n.width === 'number' && Number.isFinite(n.width)) out.width = n.width
  if (typeof n.height === 'number' && Number.isFinite(n.height)) out.height = n.height
  if (n.sticky === true) out.sticky = true
  if (n.collapsed === true) out.collapsed = true
  if (typeof n.reaction === 'string') out.reaction = n.reaction
}

/** Parse pasted JSON into a payload, or null when it isn't (a valid) one.
 *  The clipboard is an open ingress (any page can write the custom MIME type),
 *  so this validates hard: finite coordinates, unique ids, a whitelist of
 *  optional fields, and an acyclic parent forest — a cycle would send the
 *  editor's parent-chain walks into infinite recursion. */
export function parseClipboard (json: string): BranchClipboard | null {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    return null
  }
  if (typeof data !== 'object' || data === null) return null
  const clip = data as BranchClipboard
  if (clip.type !== 'mind-maps/branches' || clip.version !== 1) return null
  if (!Array.isArray(clip.roots) || !Array.isArray(clip.nodes)) return null
  if (clip.roots.length === 0) return null

  const ids = new Set<NodeId>()
  const nodes: Array<RawNode & { id: NodeId }> = []
  for (const n of clip.nodes) {
    if (typeof n !== 'object' || n === null) return null
    if (typeof n.id !== 'string' && typeof n.id !== 'number') return null
    if (typeof n.name !== 'string') return null
    if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) return null
    if (ids.has(n.id)) return null
    ids.add(n.id)
    const out: RawNode & { id: NodeId } = { id: n.id, name: n.name, x: n.x, y: n.y }
    if (n.parent !== undefined) {
      if (typeof n.parent !== 'string' && typeof n.parent !== 'number') return null
      out.parent = n.parent
    }
    pick(out, n as unknown as Record<string, unknown>)
    nodes.push(out)
  }

  const rootSet = new Set(clip.roots)
  for (const rootId of clip.roots) {
    if (!ids.has(rootId)) return null
  }
  // Non-root nodes must attach to something inside the payload.
  for (const n of nodes) {
    if (rootSet.has(n.id)) continue
    if (n.parent === undefined || !ids.has(n.parent)) return null
  }
  // The parent graph must be a forest — reject any cycle.
  const parentOf = new Map<NodeId, NodeId | undefined>(
    nodes.map((n) => [n.id, n.parent])
  )
  for (const n of nodes) {
    const seen = new Set<NodeId>()
    let cur: NodeId | undefined = n.id
    while (cur !== undefined) {
      if (seen.has(cur)) return null
      seen.add(cur)
      cur = parentOf.get(cur)
    }
  }

  return { type: 'mind-maps/branches', version: 1, roots: [...clip.roots], nodes }
}

export interface PasteResult {
  nodes: Array<RawNode & { id: NodeId }>
  roots: NodeId[]
}

/** Rebuild a payload with fresh ids, translated by (dx, dy). `rootParent`:
 *  'keep' leaves the roots' original parents (duplicate-in-place), a NodeId
 *  reparents them there (paste as children), undefined makes them parentless
 *  (paste as new trees). */
export function remapForPaste (
  clip: BranchClipboard,
  opts: {
    makeId: () => NodeId
    dx: number
    dy: number
    rootParent?: NodeId | 'keep'
  }
): PasteResult {
  const idMap = new Map<NodeId, NodeId>()
  for (const n of clip.nodes) idMap.set(n.id, opts.makeId())
  const rootSet = new Set(clip.roots)
  const nodes = clip.nodes.map((n) => {
    const copy: RawNode & { id: NodeId } = {
      ...n,
      id: idMap.get(n.id)!,
      x: n.x + opts.dx,
      y: n.y + opts.dy
    }
    if (rootSet.has(n.id)) {
      if (opts.rootParent === undefined) delete copy.parent
      else if (opts.rootParent !== 'keep') copy.parent = opts.rootParent
    } else {
      copy.parent = idMap.get(n.parent!)!
    }
    return copy
  })
  return { nodes, roots: clip.roots.map((id) => idMap.get(id)!) }
}

/** World-space bounding box of a payload's node points. */
export function clipBounds (clip: BranchClipboard): {
  minX: number
  minY: number
  maxX: number
  maxY: number
} {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const n of clip.nodes) {
    minX = Math.min(minX, n.x)
    minY = Math.min(minY, n.y)
    maxX = Math.max(maxX, n.x)
    maxY = Math.max(maxY, n.y)
  }
  return { minX, minY, maxX, maxY }
}

/** Parse plain text as an indented outline: two spaces (or one tab) per level,
 *  list markers stripped, depth jumps clamped so every child attaches. */
export function parseOutline (
  text: string
): Array<{ name: string; depth: number }> {
  const rows: Array<{ name: string; depth: number }> = []
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    const m = /^([\t ]*)(.*)$/.exec(line)!
    const depth = Math.floor(m[1].replace(/\t/g, '  ').length / 2)
    const name = m[2]
      .replace(/^[-*+]\s+/, '')
      .replace(/^\d+\.\s+/, '')
      .trim()
    if (!name) continue
    rows.push({ name, depth })
  }
  let prev = -1
  for (const row of rows) {
    if (row.depth > prev + 1) row.depth = prev + 1
    prev = row.depth
  }
  return rows
}

/** Turn outline rows into insertable nodes: a simple cascade layout (children
 *  step right, every row steps down), roots attached to `parent` when given. */
export function outlineToNodes (
  rows: Array<{ name: string; depth: number }>,
  makeId: () => NodeId,
  origin: { x: number; y: number },
  parent?: NodeId
): PasteResult {
  const nodes: Array<RawNode & { id: NodeId }> = []
  const roots: NodeId[] = []
  // Last node seen at each depth — the parent for the next deeper row.
  const stack: NodeId[] = []
  rows.forEach((row, index) => {
    const id = makeId()
    const node: RawNode & { id: NodeId } = {
      id,
      name: row.name,
      x: origin.x + row.depth * 200,
      y: origin.y + index * 48
    }
    if (row.depth === 0) {
      if (parent !== undefined) node.parent = parent
      roots.push(id)
    } else {
      node.parent = stack[row.depth - 1]
    }
    stack[row.depth] = id
    stack.length = row.depth + 1
    nodes.push(node)
  })
  return { nodes, roots }
}
