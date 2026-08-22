import type {} from '../renderer/jsx'
import {
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent
} from 'react'
import { Canvas, type CanvasHandle } from '../renderer/Canvas'
import type { PointerPayload, SceneNode } from '../renderer/types'
import { useAdjacency } from '../mindmap/useAdjacency'
import { useViewport } from '../hooks/useViewport'
import { useColor } from '../hooks/useColor'
import { useDownload } from '../hooks/useDownload'
import { useOnResize } from '../hooks/useOnResize'
import { useEvent } from '../hooks/useEvent'
import { clockIndex } from '../mindmap/clockIndex'
import { branch } from '../mindmap/list'
import { getNewPosition } from '../mindmap/geometry'
import {
  CLIPBOARD_MIME,
  clipBounds,
  collectBranches,
  outlineText,
  outlineToNodes,
  parseClipboard,
  parseOutline,
  remapForPaste
} from '../mindmap/clipboard'
import { guid } from '../utils/guid'
import type {
  Adjacency,
  MapDoc,
  MindNode,
  NodeId,
  PathEdge
} from '../mindmap/types'
import {
  ArrowLeftIcon,
  ChevronsDownUpIcon,
  CommandIcon,
  CopyIcon,
  DownloadIcon,
  LoaderCircleIcon,
  MaximizeIcon,
  PlusIcon,
  Redo2Icon,
  SaveIcon,
  SearchIcon,
  StickyNoteIcon,
  TriangleAlertIcon,
  Undo2Icon,
  ZoomInIcon,
  ZoomOutIcon
} from 'lucide-react'
import { Button } from '../components/ui/button'
import { Separator } from '../components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '../components/ui/dropdown-menu'
import { MindMapScene } from '../components/MindMapScene'
import { editorOverlayAnchor } from '../components/NodeScene'
import { nodeBounds } from '../components/nodeGeometry'
import { TextEditorOverlay } from '../components/TextEditorOverlay'
import { EdgeEditor } from '../components/EdgeEditor'
import { Toolbar } from '../components/Toolbar'
import { CanvasControls } from '../components/CanvasControls'
import { CreateToolbar } from '../components/CreateToolbar'
import { CommandMenu, type MenuCommand } from '../components/CommandMenu'
import { NodeSearch } from '../components/NodeSearch'

const ADD_OFFSET = new Map<number, number>([
  [11, 0],
  [9, 7],
  [-9, 2],
  [-11, 5]
])

interface DragState {
  ids: NodeId[]
  /** Every id inside the dragged branches — excluded from drop targeting. */
  branchIds: Set<NodeId>
  lastX: number
  lastY: number
  /** Accumulated world-space movement — drop targeting arms only after a real
   *  drag, so a jittery selection click can never reparent. */
  moved: number
}

/** World px of accumulated movement before a drag starts drop-targeting. */
const REPARENT_THRESHOLD = 4
interface PanState {
  startClientX: number
  startClientY: number
  baseX: number
  baseY: number
}
interface ResizeState {
  id: NodeId
  startW: number
  startH: number
  startClientX: number
  startClientY: number
  signX: number
  signY: number
}
interface MarqueeState {
  startX: number
  startY: number
  moved: boolean
  additive: boolean
  base: Set<NodeId>
}

/** Selection "roots": selected ids none of whose ancestors are also selected —
 *  so moving/deleting each branch never double-processes a shared node. */
function selectionRoots (
  list: Map<NodeId, MindNode>,
  selected: Set<NodeId>
): NodeId[] {
  const roots: NodeId[] = []
  for (const id of selected) {
    let p = list.get(id)?.parent
    let ancestorSelected = false
    while (p !== undefined) {
      if (selected.has(p)) {
        ancestorSelected = true
        break
      }
      p = list.get(p)?.parent
    }
    if (!ancestorSelected) roots.push(id)
  }
  return roots
}

/** Ids of visible nodes whose drawn box intersects a world-space rectangle. */
function nodesInRect (
  list: Map<NodeId, MindNode>,
  x: number,
  y: number,
  w: number,
  h: number
): NodeId[] {
  const ids: NodeId[] = []
  for (const n of list.values()) {
    if (n.hidden) continue
    const b = nodeBounds(n)
    if (b.x <= x + w && b.x + b.w >= x && b.y <= y + h && b.y + b.h >= y) {
      ids.push(n.id)
    }
  }
  return ids
}

/** Topmost visible node whose drawn box contains a world-space point,
 *  excluding `exclude`d ids and sticky notes (they can't take children by
 *  drop). "Topmost" = last in list order, matching paint order. */
function dropTargetAt (
  list: Map<NodeId, MindNode>,
  x: number,
  y: number,
  exclude: Set<NodeId>
): NodeId | null {
  let target: NodeId | null = null
  for (const n of list.values()) {
    if (n.hidden || n.sticky || exclude.has(n.id)) continue
    const b = nodeBounds(n)
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) target = n.id
  }
  return target
}

/** Move the selection with the arrow keys: ←parent, →first child, ↑/↓ siblings. */
function navigateSelection (
  list: Map<NodeId, MindNode>,
  selectedId: NodeId,
  key: string
): NodeId | null {
  const node = list.get(selectedId)
  if (!node) return null
  const nodes = Array.from(list.values()).filter((n) => !n.hidden)
  if (key === 'ArrowLeft') return node.parent ?? null
  if (key === 'ArrowRight') {
    const child = nodes.find((n) => n.parent === selectedId)
    return child ? child.id : null
  }
  const siblings = nodes.filter((n) => n.parent === node.parent)
  const idx = siblings.findIndex((n) => n.id === selectedId)
  if (key === 'ArrowUp') return idx > 0 ? siblings[idx - 1].id : null
  if (key === 'ArrowDown') return idx < siblings.length - 1 ? siblings[idx + 1].id : null
  return null
}

export interface MindMapEditorProps {
  /** The document to edit. The host loads it from wherever it lives
   *  (localStorage, the WordPress REST API, a file) and hands it over here. */
  doc: MapDoc
  /** Persist the edited document. May be async — the toolbar reflects the
   *  in-flight and failed states, so a network backend needs no extra UI. */
  onSave: (doc: MapDoc) => void | Promise<void>
  /** Back affordance. Omitted (e.g. embedded in a WordPress page) → no button
   *  and no "Back to maps" command. */
  onBack?: () => void
  /** Present the map without letting the viewer change it: no creation, edit,
   *  delete, move, resize, paste, reaction or branch-style affordances, and no
   *  save. Navigation stays fully available — pan, zoom, select, search, copy,
   *  export, and folding (which is local only, since nothing is persisted). */
  readOnly?: boolean
  /** Host-specific entries appended to the ⌘K palette. */
  extraCommands?: MenuCommand[]
  /** Class for the editor's root element. Defaults to filling its offset
   *  parent, which is what a full-page host wants; embeds pass their own. */
  className?: string
}

type SaveState = 'idle' | 'saving' | 'error'

/**
 * The whole mind-map editing experience — canvas scene, text overlay, toolbars,
 * palettes and every gesture/shortcut — with no opinion about storage: it edits
 * the `doc` it is given and reports changes through `onSave`.
 */
export function MindMapEditor ({
  doc,
  onSave,
  onBack,
  readOnly = false,
  extraCommands,
  className = 'absolute inset-0'
}: MindMapEditorProps) {
  // Opt out of the React Compiler: this component bridges into the custom canvas
  // reconciler by passing the scene (<MindMapScene/>) as `children` to <Canvas/>,
  // which renders them in a *separate* reconciler root via an effect. The
  // compiler can't reason about that bridge and its memoization drops the scene
  // (blank canvas). Manual memo isn't needed here anyway.
  'use no memo'
  const contentRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<CanvasHandle | null>(null)
  const { width, height } = useOnResize(contentRef)

  const [saveState, setSaveState] = useState<SaveState>('idle')

  const initial = new Map(doc.content ?? [])
  const {
    adjacency,
    list,
    paths,
    add,
    addRoot,
    addSticky,
    remove,
    removeMany,
    update,
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
    canUndo,
    canRedo
  } = useAdjacency(initial)

  const viewport = useViewport(contentRef)
  const { color, pathClick, close: closeColor } = useColor()
  const { savePng, saveJpeg, saveSvg } = useDownload(canvasRef, { width, height })

  const [commandOpen, setCommandOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [metaPressing, setMetaPressing] = useState(false)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [spacePan, setSpacePan] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<NodeId>>(new Set())
  // Prospective new parent while a branch drag hovers over another node.
  const [dropTargetId, setDropTargetId] = useState<NodeId | null>(null)
  const [marquee, setMarquee] = useState<
    { x: number; y: number; w: number; h: number } | null
  >(null)
  // A reaction emoji being dragged from the bottom toolbar onto a node.
  const [reactionDrag, setReactionDrag] = useState<
    { emoji: string; x: number; y: number } | null
  >(null)

  // Hidden nodes (inside folded branches — e.g. re-folded by undo/redo) are
  // inert: they may linger in the raw selection state, but every consumer works
  // off this visible view, so keyboard/clipboard/drag can never touch them.
  const visibleSelectedIds = (() => {
    let dirty = false
    for (const id of selectedIds) {
      if (list.get(id)?.hidden) {
        dirty = true
        break
      }
    }
    if (!dirty) return selectedIds
    return new Set(Array.from(selectedIds).filter((id) => !list.get(id)?.hidden))
  })()

  // The "active" node — target for Tab / Enter / arrow keys when several are
  // selected. Sets preserve insertion order, so it's the last one added.
  const activeId =
    visibleSelectedIds.size > 0
      ? Array.from(visibleSelectedIds)[visibleSelectedIds.size - 1]
      : null

  const dragRef = useRef<DragState | null>(null)
  const panRef = useRef<PanState | null>(null)
  const resizeRef = useRef<ResizeState | null>(null)
  const marqueeRef = useRef<MarqueeState | null>(null)
  // A whole drag/resize collapses to one undo step: `moveSnapRef` holds the
  // pre-gesture state, pushed on the first movement and cleared on mouse-up.
  const moveSnapRef = useRef<Adjacency | null>(null)
  // A typing session is one undo step too, but snapshotted *lazily* on the first
  // keystroke (so it captures the current geometry even if the node was resized
  // mid-edit). `true` = the session's snapshot has already been taken.
  const editDirtyRef = useRef(false)

  const recordMove = () => {
    if (moveSnapRef.current) {
      pushSnapshot(moveSnapRef.current)
      moveSnapRef.current = null
    }
  }

  // A hidden node can't be edited — if its branch just got re-folded (undo),
  // the overlay must not float over empty canvas.
  const editingNode =
    Array.from(list.values()).find((n) => n.editing && !n.hidden) ?? null

  const closeEditingIfAny = () => {
    editDirtyRef.current = false
    if (editingNode) setEditing(null)
  }

  // ---- Scene interaction handlers ----
  const onColor = (edge: PathEdge, e: PointerPayload) => {
    if (readOnly) return
    // Stop this click from reaching the window-level close handler below.
    e.originalEvent.stopPropagation()
    pathClick(edge, e.originalEvent.clientX, e.originalEvent.clientY)
  }

  const onDragStart = (node: MindNode, e: PointerPayload) => {
    closeEditingIfAny()
    // Read-only still selects (for copy / zoom-to-node), it just never drags.
    if (readOnly) {
      setSelectedIds(
        e.originalEvent.shiftKey
          ? (prev) => {
              const next = new Set(prev)
              if (next.has(node.id)) next.delete(node.id)
              else next.add(node.id)
              return next
            }
          : new Set([node.id])
      )
      return
    }
    // Shift-click toggles a node in/out of the selection (no drag).
    if (e.originalEvent.shiftKey) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        if (next.has(node.id)) next.delete(node.id)
        else next.add(node.id)
        return next
      })
      return
    }
    // Plain press: if the node isn't part of the selection, select just it.
    // Then drag whatever is selected (each branch moves together).
    let sel = visibleSelectedIds
    if (!visibleSelectedIds.has(node.id)) {
      sel = new Set([node.id])
      setSelectedIds(sel)
    }
    moveSnapRef.current = adjacency
    const roots = selectionRoots(list, sel)
    const nodes = Array.from(list.values())
    const branchIds = new Set<NodeId>(roots)
    for (const r of roots) {
      for (const n of branch(nodes, r)) branchIds.add(n.id)
    }
    dragRef.current = {
      ids: roots,
      branchIds,
      lastX: e.worldX,
      lastY: e.worldY,
      moved: 0
    }
  }

  const onEdit = (node: MindNode) => {
    if (readOnly) return
    editDirtyRef.current = false
    setEditing(node.id)
  }

  const onAdd = (node: MindNode) => {
    if (readOnly) return
    if (node.component === 'root') {
      add(node.id, 0)
    } else {
      add(node.id, ADD_OFFSET.get(clockIndex(node)) ?? 0)
    }
  }

  const onRemove = (nodeId: NodeId) => {
    if (readOnly) return
    remove(nodeId)
  }

  // Jump to a search hit: unfold whatever hides it, select it and centre on it.
  const jumpToNode = (nodeId: NodeId) => {
    reveal(nodeId)
    setSelectedIds(new Set([nodeId]))
    const n = list.get(nodeId)
    if (n) viewport.centerOn(n.x, n.y)
  }

  // Clone the selected branches (fresh ids, +24/+24, same parents) and select
  // the clones. One undo step.
  const duplicateSelection = () => {
    if (readOnly) return
    const roots = selectionRoots(list, visibleSelectedIds)
    if (roots.length === 0) return
    const clip = collectBranches(adjacency, roots)
    const { nodes, roots: newRoots } = remapForPaste(clip, {
      makeId: guid,
      dx: 24,
      dy: 24,
      rootParent: 'keep'
    })
    insertNodes(nodes)
    setSelectedIds(new Set(newRoots))
  }

  // Fold/unfold a branch; folding drops the now-hidden descendants from the
  // selection (so keyboard actions can't target invisible nodes) and closes
  // the text editor if it was open on one of them.
  const onToggleCollapsed = (node: MindNode) => {
    if (!node.collapsed) {
      const hiddenIds = new Set(
        branch(Array.from(list.values()), node.id).map((n) => n.id)
      )
      if (editingNode && hiddenIds.has(editingNode.id)) closeEditingIfAny()
      setSelectedIds((prev) => {
        const next = new Set(Array.from(prev).filter((i) => !hiddenIds.has(i)))
        return next.size === prev.size ? prev : next
      })
    }
    toggleCollapsed(node.id)
  }

  // Attach a sticky note to the active node (or the root) and edit it right away.
  const onAddSticky = () => {
    if (readOnly) return
    const newId = addSticky(activeId ?? 0)
    setSelectedIds(new Set([newId]))
    setEditing(newId)
    // The `addSticky` already recorded a step; fold the initial typing into it.
    editDirtyRef.current = true
  }

  // Add a fresh, parentless root node at the centre of the current view.
  const onAddRoot = () => {
    if (readOnly) return
    const cx = (width / 2 - viewport.offsetX) / viewport.scale
    const cy = (height / 2 - viewport.offsetY) / viewport.scale
    const roots = Array.from(list.values()).filter((n) => n.parent === undefined).length
    const newId = addRoot(cx + roots * 24, cy + roots * 24)
    setSelectedIds(new Set([newId]))
    setEditing(newId)
    editDirtyRef.current = true
  }

  // Start dragging a reaction from the toolbar; it drops onto the hovered node.
  const onReactionDragStart = (emoji: string, e: ReactPointerEvent) => {
    e.preventDefault()
    closeEditingIfAny()
    setReactionDrag({ emoji, x: e.clientX, y: e.clientY })
  }

  const onBackgroundPointerDown = (e: PointerPayload) => {
    closeEditingIfAny()
    // Space held → pan the canvas (Figma). Otherwise drag a selection marquee.
    if (spacePan) {
      panRef.current = {
        startClientX: e.originalEvent.clientX,
        startClientY: e.originalEvent.clientY,
        baseX: viewport.oxRef.current,
        baseY: viewport.oyRef.current
      }
      return
    }
    marqueeRef.current = {
      startX: e.worldX,
      startY: e.worldY,
      moved: false,
      additive: e.originalEvent.shiftKey,
      base: e.originalEvent.shiftKey ? new Set(visibleSelectedIds) : new Set()
    }
  }

  const onCanvasPointerMove = (_e: PointerPayload, hit: SceneNode | null) => {
    const nextId = (hit?.props.hitId as string | undefined) ?? null
    setHoveredId((prev) => (prev === nextId ? prev : nextId))
  }

  // ---- Global drag / pan / resize movement ----
  useEvent<MouseEvent & globalThis.MouseEvent>('mousemove', (event) => {
    if (reactionDrag) {
      setReactionDrag((rd) => (rd ? { ...rd, x: event.clientX, y: event.clientY } : null))
      return
    }
    if (dragRef.current) {
      const handle = canvasRef.current
      if (!handle) return
      const world = handle.screenToWorld(event.clientX, event.clientY)
      const drag = dragRef.current
      const dx = world.x - drag.lastX
      const dy = world.y - drag.lastY
      if (dx !== 0 || dy !== 0) {
        recordMove()
        moveBranchesBy(drag.ids, dx, dy)
        drag.lastX = world.x
        drag.lastY = world.y
        drag.moved += Math.abs(dx) + Math.abs(dy)
      }
      // After a real drag (not click jitter), hovering another node's box makes
      // it the drop target: releasing there reparents the dragged branches
      // under it (highlighted in the scene).
      const target =
        drag.moved > REPARENT_THRESHOLD
          ? dropTargetAt(list, world.x, world.y, drag.branchIds)
          : null
      setDropTargetId((prev) => (prev === target ? prev : target))
      return
    }
    if (marqueeRef.current) {
      const handle = canvasRef.current
      if (!handle) return
      const m = marqueeRef.current
      const world = handle.screenToWorld(event.clientX, event.clientY)
      m.moved = true
      const x = Math.min(m.startX, world.x)
      const y = Math.min(m.startY, world.y)
      const w = Math.abs(world.x - m.startX)
      const h = Math.abs(world.y - m.startY)
      setMarquee({ x, y, w, h })
      const inside = nodesInRect(list, x, y, w, h)
      const next = new Set(m.base)
      for (const id of inside) next.add(id)
      setSelectedIds(next)
      return
    }
    if (panRef.current) {
      const p = panRef.current
      viewport.setOffset(
        p.baseX + (event.clientX - p.startClientX),
        p.baseY + (event.clientY - p.startClientY)
      )
      return
    }
    if (resizeRef.current) {
      const r = resizeRef.current
      const node = list.get(r.id)
      if (!node) return
      const scale = viewport.scaleRef.current
      const width2 = Math.max(50, r.startW + (r.signX * (event.clientX - r.startClientX)) / scale)
      const height2 = Math.max(32, r.startH + (r.signY * (event.clientY - r.startClientY)) / scale)
      recordMove()
      update({ ...node, width: width2, height: height2 })
    }
  })

  const endInteractions = () => {
    // Dropping a dragged branch onto a highlighted node reparents it there.
    // Part of the drag gesture, so it shares the drag's single undo step —
    // recordMove() guarantees that step exists even if no movement recorded.
    if (dragRef.current && dropTargetId != null) {
      recordMove()
      reparentRoots(dragRef.current.ids, dropTargetId)
    }
    if (dropTargetId != null) setDropTargetId(null)
    dragRef.current = null
    panRef.current = null
    resizeRef.current = null
    moveSnapRef.current = null
    if (marqueeRef.current) {
      // A background click that never dragged clears the selection.
      if (!marqueeRef.current.moved && !marqueeRef.current.additive) {
        setSelectedIds(new Set())
      }
      marqueeRef.current = null
      setMarquee(null)
    }
    // Drop a dragged reaction onto whatever node is under the cursor.
    if (reactionDrag) {
      if (hoveredId != null) {
        const target = Array.from(list.values()).find((n) => String(n.id) === hoveredId)
        if (target) setReaction(target.id, reactionDrag.emoji)
      }
      setReactionDrag(null)
    }
  }

  useEvent('mouseup', endInteractions)
  useEvent('mouseleave', endInteractions)

  // ---- Clipboard: copy / cut / paste branches ----
  const isEditableTarget = (t: EventTarget | null) => {
    const el = t as HTMLElement | null
    if (!el || !el.tagName) return false
    return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable
  }

  const viewCenter = () => ({
    x: (width / 2 - viewport.offsetX) / viewport.scale,
    y: (height / 2 - viewport.offsetY) / viewport.scale
  })

  // Serialize the selection into the clipboard: a full-fidelity JSON payload
  // plus a plain-text indented outline. Returns the copied roots.
  const copySelection = (event: ClipboardEvent): NodeId[] => {
    if (editingNode || isEditableTarget(event.target)) return []
    const roots = selectionRoots(list, visibleSelectedIds)
    if (roots.length === 0 || !event.clipboardData) return []
    const clip = collectBranches(adjacency, roots)
    event.clipboardData.setData(CLIPBOARD_MIME, JSON.stringify(clip))
    event.clipboardData.setData('text/plain', outlineText(clip))
    event.preventDefault()
    return roots
  }

  useEvent<ClipboardEvent>('copy', copySelection)

  useEvent<ClipboardEvent>('cut', (event) => {
    if (readOnly) return
    const copied = copySelection(event)
    if (copied.length === 0) return
    // Like Delete: drop the primary root first so it can't mask its (deletable)
    // descendants — ⌘A + ⌘X must cut everything except the root itself.
    const deletable = new Set(visibleSelectedIds)
    deletable.delete(0)
    const roots = selectionRoots(list, deletable)
    if (roots.length > 0) {
      removeMany(roots)
      setSelectedIds(new Set())
    }
  })

  useEvent<ClipboardEvent>('paste', (event) => {
    if (readOnly || editingNode || isEditableTarget(event.target)) return
    const cd = event.clipboardData
    if (!cd) return
    const target = activeId != null ? list.get(activeId) : undefined
    const asChildOf = target && !target.hidden ? target : undefined
    // Where a branch pasted under `asChildOf` should land: the same radial
    // slot a newly added child would get.
    const childOrigin = () => {
      const index = Array.from(list.values()).filter(
        (n) => n.parent === asChildOf!.id
      ).length
      const pos = getNewPosition(index)
      return { x: asChildOf!.x + pos.x, y: asChildOf!.y + pos.y }
    }

    const clip = parseClipboard(cd.getData(CLIPBOARD_MIME) || 'null')
    if (clip) {
      event.preventDefault()
      const first = clip.nodes.find((n) => n.id === clip.roots[0])
      if (!first) return
      let dx: number
      let dy: number
      if (asChildOf) {
        const origin = childOrigin()
        dx = origin.x - first.x
        dy = origin.y - first.y
      } else {
        const c = viewCenter()
        const b = clipBounds(clip)
        dx = c.x - (b.minX + b.maxX) / 2
        dy = c.y - (b.minY + b.maxY) / 2
      }
      const { nodes, roots } = remapForPaste(clip, {
        makeId: guid,
        dx,
        dy,
        rootParent: asChildOf?.id
      })
      insertNodes(nodes)
      setSelectedIds(new Set(roots))
      return
    }

    // Plain text: parse as an indented outline → new branch / trees.
    const text = cd.getData('text/plain')
    if (!text.trim()) return
    const rows = parseOutline(text)
    if (rows.length === 0) return
    event.preventDefault()
    const origin = asChildOf ? childOrigin() : viewCenter()
    const { nodes, roots } = outlineToNodes(rows, guid, origin, asChildOf?.id)
    insertNodes(nodes)
    setSelectedIds(new Set(roots))
  })

  // Close the colour wheel on any click that isn't the one that opened it
  // (branch clicks stopPropagation) or a colour pick (wheel stopsPropagation).
  useEvent('click', () => {
    if (color.visible) closeColor()
  })

  const onStartResize = (
    node: MindNode,
    e: MouseEvent,
    dir: { signX: number; signY: number }
  ) => {
    moveSnapRef.current = adjacency
    resizeRef.current = {
      id: node.id,
      startW: node.width,
      startH: node.height,
      startClientX: e.clientX,
      startClientY: e.clientY,
      signX: dir.signX,
      signY: dir.signY
    }
  }

  // ---- Save ----
  // The map's title mirrors its root node's text. `onSave` may be async (a
  // REST backend); the toolbar shows the in-flight/failed state so a slow or
  // rejected save is never silent.
  const save = () => {
    if (readOnly) return
    const root = adjacency.get(0)
    const next: MapDoc = {
      ...doc,
      title: root?.name ?? doc.title,
      content: Array.from(adjacency.entries()),
      modified: new Date().toISOString()
    }
    let result: void | Promise<void>
    try {
      result = onSave(next)
    } catch (error) {
      setSaveState('error')
      console.error('[mind-maps] save failed', error)
      return
    }
    if (!(result instanceof Promise)) {
      setSaveState('idle')
      return
    }
    setSaveState('saving')
    result.then(
      () => setSaveState('idle'),
      (error: unknown) => {
        setSaveState('error')
        console.error('[mind-maps] save failed', error)
      }
    )
  }

  // World-space bounding box of all visible nodes (for zoom-to-fit).
  const contentBounds = () => {
    const nodes = Array.from(list.values()).filter((n) => !n.hidden)
    if (nodes.length === 0) return null
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const n of nodes) {
      const b = nodeBounds(n)
      minX = Math.min(minX, b.x)
      minY = Math.min(minY, b.y)
      maxX = Math.max(maxX, b.x + b.w)
      maxY = Math.max(maxY, b.y + b.h)
    }
    return { minX, minY, maxX, maxY }
  }

  // ---- Keyboard (Figma-style) ----
  useEvent<KeyboardEvent>('keydown', (event) => {
    if (event.metaKey) setMetaPressing(true)
    const editing = editingNode !== null

    // Keys typed into other DOM inputs (the ⌘K / ⌘F dialogs) must never reach
    // the map shortcuts — Backspace there would delete the selection. The
    // node textarea keeps its dedicated `editing` handling below.
    if (!editing && isEditableTarget(event.target)) return

    // Space (held) → Figma-style pan mode (drag anywhere to pan).
    if (event.code === 'Space' && !editing) {
      const el = event.target as HTMLElement | null
      const tag = el?.tagName
      if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'BUTTON' && !el?.isContentEditable) {
        setSpacePan(true)
        event.preventDefault()
        return
      }
    }

    // ⌘S — save
    if (event.metaKey && !event.shiftKey && event.code === 'KeyS') {
      event.preventDefault()
      save()
      return
    }
    // ⌘⇧E — export (PNG)
    if (event.metaKey && event.shiftKey && event.code === 'KeyE') {
      event.preventDefault()
      savePng()
      return
    }
    // ⌘Z / ⌘⇧Z — undo / redo (the textarea keeps its native undo while editing)
    if (event.metaKey && event.code === 'KeyZ' && !editing && !readOnly) {
      event.preventDefault()
      if (event.shiftKey) redo()
      else undo()
      return
    }
    // ⌘A — select every visible node
    if (event.metaKey && event.code === 'KeyA' && !editing) {
      event.preventDefault()
      setSelectedIds(
        new Set(
          Array.from(list.values())
            .filter((n) => !n.hidden)
            .map((n) => n.id)
        )
      )
      return
    }
    // ⌘. — fold / unfold the active node's branch
    if (event.metaKey && event.code === 'Period' && !editing) {
      event.preventDefault()
      const n = activeId != null ? list.get(activeId) : null
      if (n) onToggleCollapsed(n)
      return
    }
    // ⌘D — duplicate the selected branches next to the originals
    if (event.metaKey && !event.shiftKey && event.code === 'KeyD' && !editing && !readOnly) {
      event.preventDefault()
      duplicateSelection()
      return
    }
    // ⌘K — command menu
    if (event.metaKey && event.code === 'KeyK') {
      event.preventDefault()
      setCommandOpen((open) => !open)
      return
    }
    // ⌘F — find a node (replaces the browser's find-in-page here)
    if (event.metaKey && !event.shiftKey && event.code === 'KeyF') {
      event.preventDefault()
      closeEditingIfAny()
      setSearchOpen(true)
      return
    }
    // Esc — exit editing, else clear the selection
    if (event.code === 'Escape') {
      if (editing) closeEditingIfAny()
      else setSelectedIds(new Set())
      return
    }
    // Node operations — act on the active node, not while typing, no ⌘/Ctrl/Alt.
    // The mutating ones (delete, add) are additionally gated on `readOnly`;
    // arrow navigation below stays available to a viewer.
    if (!editing && !event.metaKey && !event.ctrlKey && !event.altKey) {
      // Delete / Backspace — remove every selected node (never the root).
      // Drop the root first so it can't mask its (deletable) descendants.
      if (!readOnly && (event.code === 'Delete' || event.code === 'Backspace')) {
        const deletable = new Set(visibleSelectedIds)
        deletable.delete(0)
        const roots = selectionRoots(list, deletable)
        if (roots.length > 0) {
          event.preventDefault()
          removeMany(roots)
          setSelectedIds(new Set())
        }
        return
      }
      // Tab — add a child to the active node and start editing it.
      if (!readOnly && event.code === 'Tab') {
        event.preventDefault()
        if (activeId != null) {
          const n = list.get(activeId)
          if (n) {
            const offset = n.component === 'root' ? 0 : (ADD_OFFSET.get(clockIndex(n)) ?? 0)
            const newId = add(activeId, offset)
            setSelectedIds(new Set([newId]))
            setEditing(newId)
            // The `add` already recorded a step; fold the initial typing into it.
            editDirtyRef.current = true
          }
        }
        return
      }
      // Enter — add a sibling (a child of the active node's parent) and edit it.
      if (!readOnly && event.code === 'Enter' && !event.shiftKey) {
        event.preventDefault()
        if (activeId != null) {
          const n = list.get(activeId)
          if (n) {
            const parentId = n.parent
            let newId: NodeId
            if (parentId !== undefined) {
              const parent = list.get(parentId)
              const offset =
                parent && parent.component !== 'root'
                  ? (ADD_OFFSET.get(clockIndex(parent)) ?? 0)
                  : 0
              newId = add(parentId, offset)
            } else {
              // Root has no parent — Enter adds a child instead.
              newId = add(n.id, 0)
            }
            setSelectedIds(new Set([newId]))
            setEditing(newId)
            // The `add` already recorded a step; fold the initial typing into it.
            editDirtyRef.current = true
          }
        }
        return
      }
      // Arrows — move the (single) active selection through the tree.
      if (event.key.startsWith('Arrow') && activeId != null) {
        event.preventDefault()
        const next = navigateSelection(list, activeId, event.key)
        if (next != null) setSelectedIds(new Set([next]))
        return
      }
    }

    // Navigation — only when not typing and without ⌘/Ctrl/Alt (so ⌘± page zoom
    // still works and typing +/-/0/1 in the editor is unaffected).
    if (!editing && !event.metaKey && !event.ctrlKey && !event.altKey) {
      if (event.key === '+' || event.key === '=') {
        event.preventDefault()
        viewport.zoomIn()
      } else if (event.key === '-' || event.key === '_') {
        event.preventDefault()
        viewport.zoomOut()
      } else if (event.shiftKey && event.code === 'Digit0') {
        event.preventDefault()
        viewport.zoomTo100()
      } else if (event.shiftKey && event.code === 'Digit1') {
        event.preventDefault()
        viewport.zoomToFit(contentBounds())
      }
    }
  })
  useEvent<KeyboardEvent>('keyup', (event) => {
    if (!event.metaKey) setMetaPressing(false)
    if (event.code === 'Space') setSpacePan(false)
  })

  const rootNode = adjacency.get(0)

  // A read-only embed lists only what a viewer can actually do.
  const editCommands: MenuCommand[] = readOnly
    ? []
    : [
        { group: 'Create', label: 'Add root node', icon: PlusIcon, run: onAddRoot },
        { group: 'Create', label: 'Add sticky note', icon: StickyNoteIcon, run: onAddSticky },
        {
          group: 'Edit',
          label: 'Duplicate branch',
          shortcut: '⌘D',
          icon: CopyIcon,
          run: duplicateSelection
        },
        { group: 'Edit', label: 'Undo', shortcut: '⌘Z', icon: Undo2Icon, run: undo },
        { group: 'Edit', label: 'Redo', shortcut: '⌘⇧Z', icon: Redo2Icon, run: redo },
        { group: 'File', label: 'Save', shortcut: '⌘S', icon: SaveIcon, run: save }
      ]

  const commands: MenuCommand[] = [
    ...editCommands,
    { group: 'View', label: 'Zoom in', shortcut: '+', icon: ZoomInIcon, run: viewport.zoomIn },
    { group: 'View', label: 'Zoom out', shortcut: '−', icon: ZoomOutIcon, run: viewport.zoomOut },
    { group: 'View', label: 'Zoom to 100%', shortcut: '⇧0', run: viewport.zoomTo100 },
    { group: 'View', label: 'Zoom to fit', shortcut: '⇧1', icon: MaximizeIcon, run: () => viewport.zoomToFit(contentBounds()) },
    {
      group: 'Edit',
      label: 'Collapse / expand branch',
      shortcut: '⌘.',
      icon: ChevronsDownUpIcon,
      run: () => {
        const n = activeId != null ? list.get(activeId) : null
        if (n) onToggleCollapsed(n)
      }
    },
    { group: 'File', label: 'Export PNG', shortcut: '⌘⇧E', icon: DownloadIcon, run: savePng },
    { group: 'File', label: 'Export JPEG', icon: DownloadIcon, run: saveJpeg },
    { group: 'File', label: 'Export SVG', icon: DownloadIcon, run: saveSvg },
    { group: 'Go', label: 'Find node…', shortcut: '⌘F', icon: SearchIcon, run: () => setSearchOpen(true) },
    ...(onBack
      ? [{ group: 'Go', label: 'Back to maps', icon: ArrowLeftIcon, run: onBack }]
      : []),
    ...(extraCommands ?? [])
  ]

  const SaveIndicator =
    saveState === 'saving'
      ? LoaderCircleIcon
      : saveState === 'error'
        ? TriangleAlertIcon
        : SaveIcon

  return (
    <div className={className}>
      <CommandMenu open={commandOpen} onOpenChange={setCommandOpen} commands={commands} />
      <NodeSearch open={searchOpen} onOpenChange={setSearchOpen} list={list} onJump={jumpToNode} />
      <Toolbar
        left={
          <>
            {onBack && (
              <>
                <Button variant="ghost" size="icon" title="Back" onClick={onBack}>
                  <ArrowLeftIcon />
                </Button>
                <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-7" />
              </>
            )}
            {rootNode && (
              <h1 className="truncate text-lg font-semibold">{rootNode.name}</h1>
            )}
          </>
        }
        right={
          <>
            {!readOnly && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Add sticky note"
                  onClick={onAddSticky}
                >
                  <StickyNoteIcon />
                </Button>
                <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-7" />
              </>
            )}
            {!readOnly && (
            <Button
              variant="ghost"
              size="icon"
              title={
                saveState === 'error'
                  ? 'Save failed — click to retry  ⌘S'
                  : saveState === 'saving'
                    ? 'Saving…'
                    : 'Save  ⌘S'
              }
              onClick={save}
            >
              <SaveIndicator
                className={
                  saveState === 'saving'
                    ? 'animate-spin'
                    : saveState === 'error'
                      ? 'text-destructive'
                      : undefined
                }
              />
            </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" title="Export  ⌘⇧E">
                  <DownloadIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={saveJpeg}>JPEG</DropdownMenuItem>
                <DropdownMenuItem onClick={savePng}>
                  PNG <span className="ml-auto text-muted-foreground">⌘⇧E</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={saveSvg}>SVG</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="icon"
              title="Command menu  ⌘K"
              onClick={() => setCommandOpen(true)}
            >
              <CommandIcon />
            </Button>
          </>
        }
      />
      <div
        className="absolute inset-x-0 bottom-0 top-14 overflow-hidden bg-background"
        ref={contentRef}
      >
        <Canvas
          ref={canvasRef}
          className="block"
          width={width}
          height={height}
          worldTransform={{ scale: viewport.scale, x: viewport.offsetX, y: viewport.offsetY }}
          panMode={spacePan}
          onBackgroundPointerDown={onBackgroundPointerDown}
          onPointerMove={onCanvasPointerMove}
          onWheel={viewport.handleWheel}
        >
          <MindMapScene
            list={list}
            paths={paths}
            scale={viewport.scale}
            offsetX={viewport.offsetX}
            offsetY={viewport.offsetY}
            hoveredId={hoveredId}
            selectedIds={visibleSelectedIds}
            dropTargetId={dropTargetId}
            marquee={marquee}
            metaPressing={metaPressing}
            readOnly={readOnly}
            onColor={onColor}
            onDragStart={onDragStart}
            onEdit={onEdit}
            onAdd={onAdd}
            onRemove={onRemove}
            onToggleCollapsed={onToggleCollapsed}
          />
        </Canvas>
        {editingNode && (
          <TextEditorOverlay
            node={editingNode}
            left={editorOverlayAnchor(editingNode).x * viewport.scale + viewport.offsetX}
            top={editorOverlayAnchor(editingNode).y * viewport.scale + viewport.offsetY}
            anchorX={editorOverlayAnchor(editingNode).anchorX}
            anchorY={editorOverlayAnchor(editingNode).anchorY}
            scale={viewport.scale}
            onInput={(value) => {
              // Snapshot the pre-typing state once, at the first keystroke.
              if (!editDirtyRef.current) {
                pushSnapshot(adjacency)
                editDirtyRef.current = true
              }
              update({ ...editingNode, name: value })
            }}
            onStartResize={onStartResize}
          />
        )}
        <CanvasControls
          scale={viewport.scale}
          onZoomOut={viewport.zoomOut}
          onZoomIn={viewport.zoomIn}
          onZoom100={viewport.zoomTo100}
          onZoomFit={() => viewport.zoomToFit(contentBounds())}
          onUndo={undo}
          onRedo={redo}
          canUndo={!readOnly && canUndo}
          canRedo={!readOnly && canRedo}
        />
        {!readOnly && (
          <CreateToolbar
            onAddRoot={onAddRoot}
            onReactionDragStart={onReactionDragStart}
          />
        )}
        {reactionDrag && (
          <div
            className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 text-2xl leading-none"
            style={{ left: reactionDrag.x, top: reactionDrag.y }}
          >
            {reactionDrag.emoji}
          </div>
        )}
      </div>
      {color.visible && (
        <EdgeEditor
          x={color.x}
          y={color.y}
          current={(() => {
            const n = list.get(color.visible!.fromID)
            return {
              stroke: n?.stroke,
              strokeWidth: n?.strokeWidth,
              lineStyle: n?.lineStyle,
              lineShape: n?.lineShape
            }
          })()}
          onPick={(patch) => updateBranch(color.visible!.fromID, patch)}
        />
      )}
    </div>
  )
}
