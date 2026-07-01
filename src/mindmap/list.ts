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

  const result = new Map<NodeId, MindNode>()
  for (const [key, value] of adjacency.entries()) {
    const id: NodeId = value.id ?? key
    const from = value.parent !== undefined ? adjacency.get(value.parent) : undefined

    result.set(key, {
      ...value,
      id,
      component: id === 0 ? 'root' : 'node',
      editing: value.editing === true,
      width: value.width || 140,
      height: value.height || 32,
      isRightSide: from ? isRightSide(from, value) : false,
      isUpSide: from ? isUpSide(from, value) : false,
      isHaveChildren: hasChildren.has(id)
    })
  }

  return result
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
