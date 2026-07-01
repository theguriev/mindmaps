import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Canvas, type CanvasHandle } from '@/renderer/Canvas'
import type { PointerPayload, SceneNode } from '@/renderer/types'
import { useAdjacency } from '@/mindmap/useAdjacency'
import { useViewport } from '@/hooks/useViewport'
import { useColor } from '@/hooks/useColor'
import { useDownload } from '@/hooks/useDownload'
import { useOnResize } from '@/hooks/useOnResize'
import { useEvent } from '@/hooks/useEvent'
import { clockIndex } from '@/mindmap/clockIndex'
import { getMap, saveMap } from '@/api/maps'
import type { Adjacency, MindNode, NodeId, PathEdge } from '@/mindmap/types'
import { ArrowLeftIcon, DownloadIcon, KeyboardIcon, SaveIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { MindMapScene } from '@/components/MindMapScene'
import { TextEditorOverlay } from '@/components/TextEditorOverlay'
import { EdgeEditor } from '@/components/EdgeEditor'
import { ModalShortcuts } from '@/components/ModalShortcuts'
import { Toolbar } from '@/components/Toolbar'
import { FooterLogo } from '@/components/FooterLogo'

export const Route = createFileRoute('/map/$id')({
  component: MapRoute
})

function MapRoute () {
  const { id } = Route.useParams()
  // Key by id so switching maps fully remounts the editor (re-seeds state).
  return <Editor key={id} id={id} />
}

const ADD_OFFSET = new Map<number, number>([
  [11, 0],
  [9, 7],
  [-9, 2],
  [-11, 5]
])

interface DragState {
  node: MindNode
  offsetX: number
  offsetY: number
}
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
}

/** Move the selection with the arrow keys: ←parent, →first child, ↑/↓ siblings. */
function navigateSelection (
  list: Map<NodeId, MindNode>,
  selectedId: NodeId,
  key: string
): NodeId | null {
  const node = list.get(selectedId)
  if (!node) return null
  const nodes = Array.from(list.values())
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

function Editor ({ id }: { id: string }) {
  // Opt out of the React Compiler: this component bridges into the custom canvas
  // reconciler by passing the scene (<MindMapScene/>) as `children` to <Canvas/>,
  // which renders them in a *separate* reconciler root via an effect. The
  // compiler can't reason about that bridge and its memoization drops the scene
  // (blank canvas). Manual memo isn't needed here anyway.
  'use no memo'
  const navigate = useNavigate()
  const doc = getMap(id)

  const contentRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<CanvasHandle | null>(null)
  const { width, height } = useOnResize(contentRef)

  const initial = new Map(doc?.content ?? [])
  const {
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
    redo
  } = useAdjacency(initial)

  const viewport = useViewport(contentRef)
  const { color, pathClick, close: closeColor } = useColor()
  const { savePng, saveJpeg, saveSvg } = useDownload(canvasRef, { width, height })

  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [metaPressing, setMetaPressing] = useState(false)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [spacePan, setSpacePan] = useState(false)
  const [selectedId, setSelectedId] = useState<NodeId | null>(null)

  const dragRef = useRef<DragState | null>(null)
  const panRef = useRef<PanState | null>(null)
  const resizeRef = useRef<ResizeState | null>(null)
  // Pre-gesture snapshots so a whole drag/resize/edit collapses to one undo
  // step. `moveSnapRef` covers drag & resize (cleared on mouse-up); `editSnapRef`
  // covers a typing session (cleared when editing closes).
  const moveSnapRef = useRef<Adjacency | null>(null)
  const editSnapRef = useRef<Adjacency | null>(null)

  const recordMove = () => {
    if (moveSnapRef.current) {
      pushSnapshot(moveSnapRef.current)
      moveSnapRef.current = null
    }
  }
  const recordEdit = () => {
    if (editSnapRef.current) {
      pushSnapshot(editSnapRef.current)
      editSnapRef.current = null
    }
  }

  const editingNode = Array.from(list.values()).find((n) => n.editing) ?? null

  useEffect(() => {
    if (!doc) navigate({ to: '/' })
  }, [doc, navigate])

  const closeEditingIfAny = () => {
    editSnapRef.current = null
    if (editingNode) setEditing(null)
  }

  // ---- Scene interaction handlers ----
  const onColor = (edge: PathEdge, e: PointerPayload) => {
    // Stop this click from reaching the window-level close handler below.
    e.originalEvent.stopPropagation()
    pathClick(edge, e.originalEvent.clientX, e.originalEvent.clientY)
  }

  const onDragStart = (node: MindNode, e: PointerPayload) => {
    closeEditingIfAny()
    setSelectedId(node.id)
    moveSnapRef.current = adjacency
    dragRef.current = {
      node,
      offsetX: e.worldX - node.x,
      offsetY: e.worldY - node.y
    }
  }

  const onSelect = (node: MindNode) => setSelectedId(node.id)

  const onEdit = (node: MindNode) => {
    editSnapRef.current = adjacency
    setEditing(node.id)
  }

  const onAdd = (node: MindNode) => {
    if (node.component === 'root') {
      add(node.id, 0)
    } else {
      add(node.id, ADD_OFFSET.get(clockIndex(node)) ?? 0)
    }
  }

  const onRemove = (nodeId: NodeId) => remove(nodeId)

  const onBackgroundPointerDown = (e: PointerPayload) => {
    closeEditingIfAny()
    setSelectedId(null)
    panRef.current = {
      startClientX: e.originalEvent.clientX,
      startClientY: e.originalEvent.clientY,
      baseX: viewport.oxRef.current,
      baseY: viewport.oyRef.current
    }
  }

  const onCanvasPointerMove = (_e: PointerPayload, hit: SceneNode | null) => {
    const nextId = (hit?.props.hitId as string | undefined) ?? null
    setHoveredId((prev) => (prev === nextId ? prev : nextId))
  }

  // ---- Global drag / pan / resize movement ----
  useEvent<MouseEvent & globalThis.MouseEvent>('mousemove', (event) => {
    if (dragRef.current) {
      const handle = canvasRef.current
      if (!handle) return
      const world = handle.screenToWorld(event.clientX, event.clientY)
      const { node, offsetX, offsetY } = dragRef.current
      recordMove()
      updatePosition({ ...node, x: world.x - offsetX, y: world.y - offsetY })
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
      const width2 = Math.max(50, r.startW + (event.clientX - r.startClientX) / scale)
      const height2 = Math.max(32, r.startH + (event.clientY - r.startClientY) / scale)
      recordMove()
      update({ ...node, width: width2, height: height2 })
    }
  })

  const endInteractions = () => {
    dragRef.current = null
    panRef.current = null
    resizeRef.current = null
    moveSnapRef.current = null
  }

  useEvent('mouseup', endInteractions)
  useEvent('mouseleave', endInteractions)

  // Close the colour wheel on any click that isn't the one that opened it
  // (branch clicks stopPropagation) or a colour pick (wheel stopsPropagation).
  useEvent('click', () => {
    if (color.visible) closeColor()
  })

  const onStartResize = (node: MindNode, e: MouseEvent) => {
    moveSnapRef.current = adjacency
    resizeRef.current = {
      id: node.id,
      startW: node.width,
      startH: node.height,
      startClientX: e.clientX,
      startClientY: e.clientY
    }
  }

  // ---- Save ----
  const save = () => {
    if (!doc) return
    const root = adjacency.get(0)
    saveMap(id, {
      ...doc,
      id,
      title: root?.name ?? doc.title,
      content: Array.from(adjacency.entries()),
      modified: new Date().toISOString()
    })
  }

  // World-space bounding box of all nodes (for zoom-to-fit).
  const contentBounds = () => {
    const nodes = Array.from(list.values())
    if (nodes.length === 0) return null
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const n of nodes) {
      minX = Math.min(minX, n.x)
      minY = Math.min(minY, n.y)
      maxX = Math.max(maxX, n.x)
      maxY = Math.max(maxY, n.y)
    }
    return { minX, minY, maxX, maxY }
  }

  // ---- Keyboard (Figma-style) ----
  useEvent<KeyboardEvent>('keydown', (event) => {
    if (event.metaKey) setMetaPressing(true)
    const editing = editingNode !== null

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
    if (event.metaKey && event.code === 'KeyZ' && !editing) {
      event.preventDefault()
      if (event.shiftKey) redo()
      else undo()
      return
    }
    // ⌃⇧? — keyboard shortcuts panel
    if (event.ctrlKey && event.shiftKey && event.code === 'Slash') {
      event.preventDefault()
      setShortcutsOpen(true)
      return
    }
    // Esc — exit editing
    if (event.code === 'Escape') {
      if (editing) closeEditingIfAny()
      return
    }
    // Node operations — require a selection, not while typing, no ⌘/Ctrl/Alt.
    if (!editing && !event.metaKey && !event.ctrlKey && !event.altKey) {
      // Delete / Backspace — remove the selected node (never the root).
      if (event.code === 'Delete' || event.code === 'Backspace') {
        if (selectedId != null && selectedId !== 0) {
          event.preventDefault()
          remove(selectedId)
          setSelectedId(null)
        }
        return
      }
      // Tab — add a child to the selection and start editing it.
      if (event.code === 'Tab') {
        event.preventDefault()
        if (selectedId != null) {
          const n = list.get(selectedId)
          if (n) {
            const offset = n.component === 'root' ? 0 : (ADD_OFFSET.get(clockIndex(n)) ?? 0)
            const newId = add(selectedId, offset)
            setSelectedId(newId)
            setEditing(newId)
          }
        }
        return
      }
      // Enter — add a sibling (a child of the selection's parent) and edit it.
      if (event.code === 'Enter' && !event.shiftKey) {
        event.preventDefault()
        if (selectedId != null) {
          const n = list.get(selectedId)
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
            setSelectedId(newId)
            setEditing(newId)
          }
        }
        return
      }
      // Arrows — move the selection through the tree.
      if (event.key.startsWith('Arrow') && selectedId != null) {
        event.preventDefault()
        const next = navigateSelection(list, selectedId, event.key)
        if (next != null) setSelectedId(next)
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

  return (
    <div className="absolute inset-0">
      <ModalShortcuts visible={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <Toolbar
        left={
          <>
            <Button
              variant="ghost"
              size="icon"
              title="Back"
              onClick={() => navigate({ to: '/' })}
            >
              <ArrowLeftIcon />
            </Button>
            <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-7" />
            {rootNode && (
              <h1 className="truncate text-lg font-semibold">{rootNode.name}</h1>
            )}
          </>
        }
        right={
          <>
            <Button variant="ghost" size="icon" title="Save  ⌘S" onClick={save}>
              <SaveIcon />
            </Button>
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
              title="Keyboard shortcuts  ⌃⇧?"
              onClick={() => setShortcutsOpen(true)}
            >
              <KeyboardIcon />
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
            selectedId={selectedId}
            metaPressing={metaPressing}
            onColor={onColor}
            onDragStart={onDragStart}
            onEdit={onEdit}
            onAdd={onAdd}
            onRemove={onRemove}
            onSelect={onSelect}
          />
        </Canvas>
        {editingNode && (
          <TextEditorOverlay
            node={editingNode}
            left={editingNode.x * viewport.scale + viewport.offsetX}
            top={editingNode.y * viewport.scale + viewport.offsetY}
            scale={viewport.scale}
            onInput={(value) => {
              recordEdit()
              update({ ...editingNode, name: value })
            }}
            onStartResize={onStartResize}
          />
        )}
        <FooterLogo />
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
