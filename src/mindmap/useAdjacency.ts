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
import { branch, canReparent, children, prepareList, preparePaths } from './list'
import { getNewPosition } from './geometry'
import { guid } from '@/utils/guid'

const HISTORY_CAP = 100

interface History {
  present: Adjacency
  past: Adjacency[]
  future: Adjacency[]
}

/** Raw nodes with their id filled in — enough for branch/position math without
 *  a full (O(n)) `prepareList` enrichment pass on every mutation. */
function withIds (map: Adjacency): Array<RawNode & { id: NodeId }> {
  return Array.from(map.entries(), ([key, value]) => ({
    ...value,
    id: value.id ?? key
  }))
}

/** Clear `collapsed` on `id` and every ancestor (mutates `next` in place), so
 *  a node inserted or moved under `id` ends up visible. Cycle-guarded. */
function unfoldChain (next: Adjacency, id: NodeId | undefined): void {
  const seen = new Set<NodeId>()
  let cur = id
  while (cur !== undefined && !seen.has(cur)) {
    seen.add(cur)
    const node = next.get(cur)
    if (!node) break
    if (node.collapsed) next.set(cur, { ...node, collapsed: undefined })
    cur = node.parent
  }
}

/** `editing` is transient UI state — a snapshot stored in the undo/redo stacks
 *  must not carry it, or undo would silently re-open the text editor (which in
 *  turn disables the ⌘Z/⌘⇧Z shortcuts). Returns the same map when nothing set. */
function withoutEditing (map: Adjacency): Adjacency {
  let dirty = false
  const next = new Map<NodeId, RawNode>()
  for (const [key, value] of map) {
    if (value.editing) {
      next.set(key, { ...value, editing: false })
      dirty = true
    } else {
      next.set(key, value)
    }
  }
  return dirty ? next : map
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
        past: [...h.past, withoutEditing(h.present)].slice(-HISTORY_CAP),
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
      // Adding to a folded branch unfolds it (and every folded ancestor) —
      // the new child must be visible.
      unfoldChain(next, parentID)
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

  // Add a new, parentless root node at (x, y) — starts a separate tree.
  const addRoot = (x: number, y: number): NodeId => {
    const id = guid()
    apply((prev) => {
      const next = new Map(prev)
      next.set(id, { name: '', x, y })
      return next
    }, true)
    return id
  }

  // Add a sticky note tethered to `parentID` — a yellow card offset below the
  // parent, connected by a thin dashed grey line (no arrow-heads).
  const addSticky = (parentID: NodeId): NodeId => {
    const id = guid()
    apply((prev) => {
      const parent = prev.get(parentID)
      if (!parent) return prev
      const next = new Map(prev)
      next.set(id, {
        name: '',
        x: parent.x - 20,
        y: parent.y + 150,
        parent: parentID,
        sticky: true,
        stroke: '#c0c0c0',
        strokeWidth: 1.5,
        lineStyle: 'dashed',
        lineShape: 'straight',
        width: 200,
        height: 130
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

  // Remove several nodes (each with its branch) in a single undo step.
  const removeMany = (ids: NodeId[]) => {
    apply((prev) => {
      const nodes = withIds(prev)
      const next = new Map(prev)
      for (const id of ids) {
        const old = nodes.find((n) => n.id === id)
        if (!old) continue
        for (const el of [...branch(nodes, id), old]) next.delete(el.id)
      }
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

  // Shift several branches (roots + descendants) by the same delta. `ids` must
  // be selection *roots* (no id an ancestor of another) so nothing moves twice.
  // Gesture edit — history is snapshotted once by the caller.
  const moveBranchesBy = (ids: NodeId[], dx: number, dy: number) => {
    apply((prev) => {
      const nodes = withIds(prev)
      const next = new Map(prev)
      const moved = new Set<NodeId>()
      for (const id of ids) {
        const root = nodes.find((n) => n.id === id)
        if (!root) continue
        for (const el of [...branch(nodes, id), root]) {
          if (moved.has(el.id)) continue
          moved.add(el.id)
          const cur = next.get(el.id)
          if (cur) next.set(el.id, { ...cur, x: cur.x + dx, y: cur.y + dy })
        }
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

  // Fold / unfold a branch. Folding hides every descendant (derived in
  // `prepareList`); a leaf has nothing to fold. Records one step.
  const toggleCollapsed = (id: NodeId) => {
    apply((prev) => {
      const cur = prev.get(id)
      if (!cur) return prev
      if (!cur.collapsed) {
        const hasKids = Array.from(prev.values()).some((n) => n.parent === id)
        if (!hasKids) return prev
      }
      const next = new Map(prev)
      next.set(id, { ...cur, collapsed: cur.collapsed ? undefined : true })
      return next
    }, true)
  }

  // Unfold every collapsed ancestor of `id` so the node becomes visible
  // (e.g. jumping to a search hit inside a folded branch). Records one step
  // only when something actually unfolds.
  const reveal = (id: NodeId) => {
    apply((prev) => {
      let next: Adjacency | null = null
      let p = prev.get(id)?.parent
      const seen = new Set<NodeId>()
      while (p !== undefined && !seen.has(p)) {
        seen.add(p)
        const ancestor = (next ?? prev).get(p)
        if (!ancestor) break
        if (ancestor.collapsed) {
          if (!next) next = new Map(prev)
          next.set(p, { ...ancestor, collapsed: undefined })
        }
        p = ancestor.parent
      }
      return next ?? prev
    }, true)
  }

  // Move branches (selection roots) under a new parent, keeping their world
  // positions — only the edge reroutes. Skips self/cycle/sticky-target cases.
  // Gesture edit: the drag that ends in the drop has already snapshotted.
  const reparentRoots = (ids: NodeId[], newParent: NodeId) => {
    apply((prev) => {
      const target = prev.get(newParent)
      if (!target || target.sticky) return prev
      const nodes = withIds(prev)
      let next: Adjacency | null = null
      for (const id of ids) {
        const node = prev.get(id)
        if (!node || node.parent === newParent) continue
        if (!canReparent(nodes, id, newParent)) continue
        if (!next) next = new Map(prev)
        next.set(id, { ...node, parent: newParent })
      }
      // Dropping into a folded branch unfolds it (ancestors included) — the
      // moved nodes must stay visible.
      if (next) unfoldChain(next, newParent)
      return next ?? prev
    }, false)
  }

  // Insert pre-built nodes (paste / duplicate) as one undo step. The caller is
  // responsible for fresh ids and valid parent references. Folded nodes that
  // receive new children unfold, so the insertion is visible.
  const insertNodes = (nodes: Array<RawNode & { id: NodeId }>) => {
    if (nodes.length === 0) return
    apply((prev) => {
      const next = new Map(prev)
      for (const n of nodes) next.set(n.id, { ...n })
      for (const n of nodes) unfoldChain(next, n.parent)
      return next
    }, true)
  }

  // Set (or, when re-applied, clear) an emoji reaction on a node. Records once.
  const setReaction = (id: NodeId, reaction: string) => {
    apply((prev) => {
      const cur = prev.get(id)
      if (!cur) return prev
      const next = new Map(prev)
      next.set(id, { ...cur, reaction: cur.reaction === reaction ? undefined : reaction })
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
      past: [...h.past, withoutEditing(snapshot)].slice(-HISTORY_CAP),
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
    addRoot,
    addSticky,
    remove,
    removeMany,
    update,
    updatePosition,
    updateBranch,
    moveBranchesBy,
    toggleCollapsed,
    reveal,
    reparentRoots,
    insertNodes,
    setReaction,
    setEditing,
    pushSnapshot,
    undo,
    redo,
    canUndo: hist.past.length > 0,
    canRedo: hist.future.length > 0
  }
}
