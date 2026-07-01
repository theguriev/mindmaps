/**
 * React port of the Vue `useAdjacency` composable. Holds the raw adjacency map
 * as state; derives `list` and `paths`; exposes the same mutation surface
 * (add / remove / update / updateBranch / updatePosition).
 *
 * Memoization is left to the React Compiler — no manual useMemo/useCallback.
 */
import { useState } from 'react'
import type { Adjacency, MindNode, NodeId, RawNode } from './types'
import { branch, children, prepareList, preparePaths } from './list'
import { getNewPosition } from './geometry'

function guid (): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/** Raw nodes with their id filled in — enough for branch/position math without
 *  a full (O(n)) `prepareList` enrichment pass on every mutation. */
function withIds (map: Adjacency): Array<RawNode & { id: NodeId }> {
  return Array.from(map.entries(), ([key, value]) => ({
    ...value,
    id: value.id ?? key
  }))
}

export function useAdjacency (initial: Adjacency) {
  const [adjacency, setAdjacency] = useState<Adjacency>(initial)

  const list = prepareList(adjacency)
  const paths = preparePaths(list)

  const add = (parentID: NodeId, offsetIndex: number) => {
    setAdjacency((prev) => {
      const parent = prev.get(parentID)
      if (!parent) return prev
      const index = children(Array.from(prev.values()), parentID).length
      const newPosition = getNewPosition(index + offsetIndex)
      const next = new Map(prev)
      next.set(guid(), {
        name: '',
        x: parent.x + newPosition.x,
        y: parent.y + newPosition.y,
        parent: parentID,
        stroke: parent.stroke
      })
      return next
    })
  }

  const remove = (id: NodeId) => {
    setAdjacency((prev) => {
      const nodes = withIds(prev)
      const old = nodes.find((n) => n.id === id)
      if (!old) return prev
      const next = new Map(prev)
      for (const el of [...branch(nodes, id), old]) next.delete(el.id)
      return next
    })
  }

  const update = (node: RawNode & { id: NodeId }) => {
    setAdjacency((prev) => {
      const next = new Map(prev)
      next.set(node.id, node)
      return next
    })
  }

  const updatePosition = (node: MindNode) => {
    setAdjacency((prev) => {
      const nodes = withIds(prev)
      const old = nodes.find((n) => n.id === node.id)
      if (!old) return prev
      const offsetX = old.x - node.x
      const offsetY = old.y - node.y
      const next = new Map(prev)
      for (const el of [...branch(nodes, node.id), old]) {
        next.set(el.id, { ...el, x: el.x - offsetX, y: el.y - offsetY })
      }
      return next
    })
  }

  const updateBranch = (id: NodeId, newData: Partial<RawNode>) => {
    setAdjacency((prev) => {
      const nodes = withIds(prev)
      const old = nodes.find((n) => n.id === id)
      if (!old) return prev
      const next = new Map(prev)
      for (const el of [...branch(nodes, id), old]) {
        next.set(el.id, { ...el, ...newData })
      }
      return next
    })
  }

  const setEditing = (editID: NodeId | null) => {
    setAdjacency((prev) => {
      const next = new Map<NodeId, RawNode>()
      for (const [key, value] of prev.entries()) {
        next.set(key, { ...value, editing: key === editID })
      }
      return next
    })
  }

  return {
    adjacency,
    setAdjacency,
    list,
    paths,
    add,
    remove,
    update,
    updatePosition,
    updateBranch,
    setEditing
  }
}
