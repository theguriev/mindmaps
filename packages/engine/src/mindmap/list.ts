/**
 * Derives the enriched node list and the edge list from a raw adjacency map.
 * Mirrors `prepareList` / `preparePaths` from the Vue `useAdjacency` composable.
 */
import type { Adjacency, MindNode, NodeId, PathEdge, RawNode } from './types'
import { createEdge, isRightSide, isUpSide } from './geometry'

export function children (arr: RawNode[], parent: NodeId | undefined): RawNode[] {
  return arr.filter((el) => el.parent === parent)
}

/** Depth-first descendants of `parent`, in pre-order. O(n) via a parent index. */
export function branch<T extends { id: NodeId; parent?: NodeId }> (
  arr: T[],
  parent: NodeId
): T[] {
  const byParent = new Map<NodeId, T[]>()
  for (const el of arr) {
    if (el.parent === undefined) continue
    const bucket = byParent.get(el.parent)
    if (bucket) bucket.push(el)
    else byParent.set(el.parent, [el])
  }
  const out: T[] = []
  const walk = (p: NodeId) => {
    const kids = byParent.get(p)
    if (!kids) return
    for (const k of kids) {
      out.push(k)
      walk(k.id)
    }
  }
  walk(parent)
  return out
}

export function prepareList (adjacency: Adjacency): Map<NodeId, MindNode> {
  // Single pass to know which ids have children (avoids an O(n) scan per node).
  const hasChildren = new Set<NodeId>()
  for (const value of adjacency.values()) {
    if (value.parent !== undefined) hasChildren.add(value.parent)
  }

  // A node is hidden when any ancestor is collapsed. Iterative memoized walk;
  // a `seen` set guards against corrupt (cyclic) parent data.
  const hiddenCache = new Map<NodeId, boolean>()
  const isHidden = (id: NodeId): boolean => {
    const cached = hiddenCache.get(id)
    if (cached !== undefined) return cached
    const path: NodeId[] = []
    const seen = new Set<NodeId>()
    let cur: NodeId = id
    let hidden = false
    for (;;) {
      const known = hiddenCache.get(cur)
      if (known !== undefined) {
        hidden = known
        break
      }
      if (seen.has(cur)) break
      seen.add(cur)
      path.push(cur)
      const parentId = adjacency.get(cur)?.parent
      const parent = parentId !== undefined ? adjacency.get(parentId) : undefined
      if (parentId === undefined || parent === undefined) break
      if (parent.collapsed === true) {
        hidden = true
        break
      }
      cur = parentId
    }
    // Every node on the walked path links to the answer through non-collapsed
    // parents, so they all share it.
    for (const p of path) hiddenCache.set(p, hidden)
    return hidden
  }

  const result = new Map<NodeId, MindNode>()
  for (const [key, value] of adjacency.entries()) {
    const id: NodeId = value.id ?? key
    const from = value.parent !== undefined ? adjacency.get(value.parent) : undefined

    result.set(key, {
      ...value,
      id,
      // Any parentless node is a root (the map can hold several separate trees).
      component: value.parent === undefined ? 'root' : 'node',
      editing: value.editing === true,
      width: value.width || (value.sticky ? 200 : 140),
      height: value.height || (value.sticky ? 130 : 32),
      isRightSide: from ? isRightSide(from, value) : false,
      isUpSide: from ? isUpSide(from, value) : false,
      isHaveChildren: hasChildren.has(id),
      collapsed: value.collapsed === true,
      hidden: isHidden(key)
    })
  }

  return result
}

/** Hidden-descendant count per *collapsed, visible* node (for the fold badge). */
export function collapsedCounts (list: Map<NodeId, MindNode>): Map<NodeId, number> {
  const byParent = new Map<NodeId, MindNode[]>()
  for (const n of list.values()) {
    if (n.parent === undefined) continue
    const bucket = byParent.get(n.parent)
    if (bucket) bucket.push(n)
    else byParent.set(n.parent, [n])
  }
  const count = (id: NodeId): number => {
    const kids = byParent.get(id)
    if (!kids) return 0
    let total = 0
    for (const k of kids) total += 1 + count(k.id)
    return total
  }
  const result = new Map<NodeId, number>()
  for (const n of list.values()) {
    if (n.collapsed && !n.hidden) result.set(n.id, count(n.id))
  }
  return result
}

/** Whether `id`'s branch may move under `target`: no self-parenting and no
 *  cycles (the target must not sit inside the moved branch). */
export function canReparent<T extends { id: NodeId; parent?: NodeId }> (
  nodes: T[],
  id: NodeId,
  target: NodeId
): boolean {
  if (id === target) return false
  return !branch(nodes, id).some((n) => n.id === target)
}

export function preparePaths (list: Map<NodeId, MindNode>): Map<string, PathEdge> {
  const result = new Map<string, PathEdge>()
  for (const [id, value] of list.entries()) {
    if (value.parent === undefined) continue
    const from = list.get(value.parent)
    if (!from) continue
    const edge = createEdge(id, value, from)
    result.set(edge.id, edge)
  }
  return result
}
