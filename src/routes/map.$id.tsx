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
import type { MindNode, NodeId, PathEdge } from '@/mindmap/types'
import { MindMapScene } from '@/components/MindMapScene'
import { TextEditorOverlay } from '@/components/TextEditorOverlay'
import { ColorWheel } from '@/components/ColorWheel'
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

function Editor ({ id }: { id: string }) {
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
    setEditing
  } = useAdjacency(initial)

  const viewport = useViewport(contentRef)
  const { color, pathClick, close: closeColor } = useColor()
  const { savePng, saveJpeg, saveSvg } = useDownload(canvasRef, { width, height })

  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [metaPressing, setMetaPressing] = useState(false)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const dragRef = useRef<DragState | null>(null)
  const panRef = useRef<PanState | null>(null)
  const resizeRef = useRef<ResizeState | null>(null)

  const editingNode = Array.from(list.values()).find((n) => n.editing) ?? null

  useEffect(() => {
    if (!doc) navigate({ to: '/' })
  }, [doc, navigate])

  const closeEditingIfAny = () => {
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
    dragRef.current = {
      node,
      offsetX: e.worldX - node.x,
      offsetY: e.worldY - node.y
    }
  }

  const onEdit = (node: MindNode) => setEditing(node.id)

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
      update({ ...node, width: width2, height: height2 })
    }
  })

  const endInteractions = () => {
    dragRef.current = null
    panRef.current = null
    resizeRef.current = null
  }

  useEvent('mouseup', endInteractions)
  useEvent('mouseleave', endInteractions)

  // Close the colour wheel on any click that isn't the one that opened it
  // (branch clicks stopPropagation) or a colour pick (wheel stopsPropagation).
  useEvent('click', () => {
    if (color.visible) closeColor()
  })

  const onStartResize = (node: MindNode, e: MouseEvent) => {
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

  // ---- Keyboard ----
  useEvent<KeyboardEvent>('keydown', (event) => {
    if (event.metaKey) setMetaPressing(true)

    if (event.ctrlKey && event.altKey && event.code === 'KeyH') {
      setShortcutsOpen(true)
    } else if (event.ctrlKey && event.altKey && event.code === 'KeyJ') {
      saveJpeg()
    } else if (event.ctrlKey && event.altKey && event.code === 'KeyP') {
      savePng()
    } else if (event.ctrlKey && event.altKey && event.code === 'KeyS') {
      saveSvg()
    } else if (event.ctrlKey && event.code === 'KeyS') {
      event.preventDefault()
      save()
    } else if (event.altKey && event.code === 'Enter') {
      closeEditingIfAny()
    }
  })
  useEvent<KeyboardEvent>('keyup', (event) => {
    if (!event.metaKey) setMetaPressing(false)
  })

  const rootNode = adjacency.get(0)

  return (
    <div className="editor">
      <ModalShortcuts visible={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <Toolbar
        left={
          <>
            <button className="bgl-toolbar-button" title="Back" onClick={() => navigate({ to: '/' })}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="M231.536 475.535l7.071-7.07c4.686-4.686 4.686-12.284 0-16.971L60.113 273H436c6.627 0 12-5.373 12-12v-10c0-6.627-5.373-12-12-12H60.113L238.607 60.506c4.686-4.686 4.686-12.284 0-16.971l-7.071-7.07c-4.686-4.686-12.284-4.686-16.97 0L3.515 247.515c-4.686 4.686-4.686 12.284 0 16.971l211.051 211.05c4.686 4.686 12.284 4.686 16.97-.001z" /></svg>
            </button>
            <div style={{ width: 1, height: 30, background: 'var(--border-light)', margin: '0 8px' }} />
            {rootNode && <h1>{rootNode.name}</h1>}
          </>
        }
        right={
          <>
            <button className="bgl-toolbar-button" title="Save ^S" onClick={save}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="M433.941 129.941l-83.882-83.882A48 48 0 0 0 316.118 32H48C21.49 32 0 53.49 0 80v352c0 26.51 21.49 48 48 48h352c26.51 0 48-21.49 48-48V163.882a48 48 0 0 0-14.059-33.941zM288 64v96H96V64h192zm128 368c0 8.822-7.178 16-16 16H48c-8.822 0-16-7.178-16-16V80c0-8.822 7.178-16 16-16h16v104c0 13.255 10.745 24 24 24h208c13.255 0 24-10.745 24-24V64.491a15.888 15.888 0 0 1 7.432 4.195l83.882 83.882A15.895 15.895 0 0 1 416 163.882V432z" /></svg>
            </button>
            <button className="bgl-toolbar-button" title="Download PNG (^⌥P)" onClick={savePng}>PNG</button>
            <button className="bgl-toolbar-button" title="Download JPEG (^⌥J)" onClick={saveJpeg}>JPG</button>
            <button className="bgl-toolbar-button" title="Download SVG (^⌥S)" onClick={saveSvg}>SVG</button>
            <button className="bgl-toolbar-button" title="Keyboard shortcuts ^⌥H" onClick={() => setShortcutsOpen(true)}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><path d="M528 64H48C21.49 64 0 85.49 0 112v288c0 26.51 21.49 48 48 48h480c26.51 0 48-21.49 48-48V112c0-26.51-21.49-48-48-48zm16 336c0 8.823-7.177 16-16 16H48c-8.823 0-16-7.177-16-16V112c0-8.823 7.177-16 16-16h480c8.823 0 16 7.177 16 16v288z" /></svg>
            </button>
          </>
        }
      />
      <div className="content" ref={contentRef}>
        <Canvas
          ref={canvasRef}
          width={width}
          height={height}
          worldTransform={{ scale: viewport.scale, x: viewport.offsetX, y: viewport.offsetY }}
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
            metaPressing={metaPressing}
            onColor={onColor}
            onDragStart={onDragStart}
            onEdit={onEdit}
            onAdd={onAdd}
            onRemove={onRemove}
          />
        </Canvas>
        {editingNode && (
          <TextEditorOverlay
            node={editingNode}
            left={editingNode.x * viewport.scale + viewport.offsetX}
            top={editingNode.y * viewport.scale + viewport.offsetY}
            scale={viewport.scale}
            onInput={(value) => update({ ...editingNode, name: value })}
            onStartResize={onStartResize}
          />
        )}
        <FooterLogo />
      </div>
      {color.visible && (
        <ColorWheel
          x={color.x}
          y={color.y}
          onPick={(stroke) => {
            updateBranch(color.visible!.fromID, { stroke })
            closeColor()
          }}
        />
      )}
    </div>
  )
}
