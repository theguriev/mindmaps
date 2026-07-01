/**
 * React port of the Vue `useAdjacency` composable. Holds the raw adjacency map
 * (with undo/redo history) and derives `list` and `paths`.
 *
 * History model: atomic edits (add / remove / updateBranch) record a step
 * automatically. Continuous gestures (drag → updatePosition, typing/resize →
 * update) do NOT auto-record — the caller snapshots once per gesture via
 * `pushSnapshot`. Editing-flag toggles (`setEditing`) never record.
 *
 * Memoization is left to the React Compiler — no manual useMemo/useCallback.
 */
import { useState } from 'react'
import type { Adjacency, MindNode, NodeId, RawNode } from './types'
import { branch, children, prepareList, preparePaths } from './list'
import { getNewPosition } from './geometry'

const HISTORY_CAP = 100

interface History {
  present: Adjacency
  past: Adjacency[]
  future: Adjacency[]
}

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
  const [hist, setHist] = useState<History>({
    present: initial,
    past: [],
    future: []
  })
  const adjacency = hist.present

  const list = prepareList(adjacency)
  const paths = preparePaths(list)

  // Apply an updater. `record` pushes the current state onto the undo stack.
  const apply = (updater: (a: Adjacency) => Adjacency, record: boolean) => {
    setHist((h) => {
      const next = updater(h.present)
      if (next === h.present) return h
      if (!record) return { ...h, present: next }
      return {
        present: next,
        past: [...h.past, h.present].slice(-HISTORY_CAP),
        future: []
      }
    })
  }

  const add = (parentID: NodeId, offsetIndex: number): NodeId => {
    const id = guid()
    apply((prev) => {
      const parent = prev.get(parentID)
      if (!parent) return prev
      const index = children(Array.from(prev.values()), parentID).length
      const newPosition = getNewPosition(index + offsetIndex)
      const next = new Map(prev)
      next.set(id, {
        name: '',
        x: parent.x + newPosition.x,
        y: parent.y + newPosition.y,
        parent: parentID,
        stroke: parent.stroke,
        strokeWidth: parent.strokeWidth,
        lineStyle: parent.lineStyle,
        lineShape: parent.lineShape
      })
      return next
    }, true)
    return id
  }

  const remove = (id: NodeId) => {
    apply((prev) => {
      const nodes = withIds(prev)
      const old = nodes.find((n) => n.id === id)
      if (!old) return prev
      const next = new Map(prev)
      for (const el of [...branch(nodes, id), old]) next.delete(el.id)
      return next
    }, true)
  }

  const update = (node: RawNode & { id: NodeId }) => {
    apply((prev) => {
      const next = new Map(prev)
      next.set(node.id, node)
      return next
    }, false)
  }

  const updatePosition = (node: MindNode) => {
    apply((prev) => {
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
    }, false)
  }

  const updateBranch = (id: NodeId, newData: Partial<RawNode>) => {
    apply((prev) => {
      const nodes = withIds(prev)
      const old = nodes.find((n) => n.id === id)
      if (!old) return prev
      const next = new Map(prev)
      for (const el of [...branch(nodes, id), old]) {
        next.set(el.id, { ...el, ...newData })
      }
      return next
    }, true)
  }

  const setEditing = (editID: NodeId | null) => {
    apply((prev) => {
      const next = new Map<NodeId, RawNode>()
      for (const [key, value] of prev.entries()) {
        next.set(key, { ...value, editing: key === editID })
      }
      return next
    }, false)
  }

  // Record a pre-gesture snapshot once (drag/resize/typing start), so the whole
  // gesture collapses into a single undo step.
  const pushSnapshot = (snapshot: Adjacency) => {
    setHist((h) => ({
      present: h.present,
      past: [...h.past, snapshot].slice(-HISTORY_CAP),
      future: []
    }))
  }

  const undo = () => {
    setHist((h) => {
      if (!h.past.length) return h
      return {
        present: h.past[h.past.length - 1],
        past: h.past.slice(0, -1),
        future: [h.present, ...h.future].slice(0, HISTORY_CAP)
      }
    })
  }

  const redo = () => {
    setHist((h) => {
      if (!h.future.length) return h
      return {
        present: h.future[0],
        past: [...h.past, h.present].slice(-HISTORY_CAP),
        future: h.future.slice(1)
      }
    })
  }

  return {
    adjacency,
    list,
    paths,
    add,
    remove,
    update,
    updatePosition,
    updateBranch,
    setEditing,
    pushSnapshot,
    undo,
    redo,
    canUndo: hist.past.length > 0,
    canRedo: hist.future.length > 0
  }
}
