/**
 * React DOM component that hosts a <canvas> and drives the custom scene
 * reconciler: it mounts scene children into a scene root, repaints on commit /
 * resize (with devicePixelRatio scaling), and routes pointer events to scene
 * element handlers via hit-testing.
 */
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type ReactNode
} from 'react'
import { createSceneRoot, type SceneRoot } from './reconciler'
import { paintScene } from './paint'
import { hitTest } from './hitTest'
import type { GroupProps, InteractiveProps, PointerPayload, SceneNode } from './types'

export interface WorldTransform {
  scale: number
  x: number
  y: number
}

export interface CanvasHandle {
  canvas: HTMLCanvasElement | null
  root: SceneNode | null
  screenToWorld: (clientX: number, clientY: number) => { x: number; y: number }
  toDataURL: (type?: string, quality?: number) => string
  repaint: () => void
}

export interface CanvasProps {
  width: number
  height: number
  background?: string
  worldTransform?: WorldTransform
  children?: ReactNode
  className?: string
  style?: CSSProperties
  onBackgroundPointerDown?: (e: PointerPayload) => void
  onPointerMove?: (e: PointerPayload, hit: SceneNode | null) => void
  onWheel?: (e: WheelEvent) => void
}

const IDENTITY: WorldTransform = { scale: 1, x: 0, y: 0 }

export const Canvas = forwardRef<CanvasHandle, CanvasProps>(function Canvas (
  props,
  ref
) {
  const {
    width,
    height,
    background = '#ffffff',
    worldTransform = IDENTITY,
    children,
    className,
    style,
    onBackgroundPointerDown,
    onPointerMove,
    onWheel
  } = props

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const sceneRef = useRef<SceneRoot | null>(null)
  const rafRef = useRef<number | null>(null)
  const dirtyRef = useRef(false)

  // Latest values captured for imperative handlers (avoid stale closures).
  const sizeRef = useRef({ width, height, background })
  sizeRef.current = { width, height, background }
  const transformRef = useRef(worldTransform)
  transformRef.current = worldTransform

  const paint = () => {
    const canvas = canvasRef.current
    const scene = sceneRef.current
    if (!canvas || !scene) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const { width: w, height: h, background: bg } = sizeRef.current
    // Self-heal the backing store if the CSS size or devicePixelRatio changed
    // (e.g. the window moved to a display with a different DPR).
    const needW = Math.max(1, Math.round(w * dpr))
    const needH = Math.max(1, Math.round(h * dpr))
    if (canvas.width !== needW || canvas.height !== needH) {
      canvas.width = needW
      canvas.height = needH
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    paintScene(ctx, scene.getRoot(), w, h, bg)
  }

  const scheduleRepaint = () => {
    dirtyRef.current = true
    if (rafRef.current !== null) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      if (dirtyRef.current) {
        dirtyRef.current = false
        paint()
      }
    })
  }

  // Create the scene root once.
  useLayoutEffect(() => {
    sceneRef.current = createSceneRoot(scheduleRepaint)
    return () => {
      sceneRef.current?.unmount()
      sceneRef.current = null
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-render scene children into the scene root.
  useEffect(() => {
    sceneRef.current?.render(<>{children}</>)
    scheduleRepaint()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [children])

  // Resize + DPR handling.
  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.max(1, Math.round(width * dpr))
    canvas.height = Math.max(1, Math.round(height * dpr))
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    scheduleRepaint()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height])

  // Repaint when devicePixelRatio changes (paint() self-heals the backing store).
  useEffect(() => {
    let mql: MediaQueryList
    const onChange = () => {
      scheduleRepaint()
      subscribe()
    }
    const subscribe = () => {
      mql = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
      mql.addEventListener('change', onChange, { once: true })
    }
    subscribe()
    return () => mql?.removeEventListener('change', onChange)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const makePayload = (clientX: number, clientY: number, ev: PointerEvent | MouseEvent): PointerPayload => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const screenX = clientX - rect.left
    const screenY = clientY - rect.top
    const t = transformRef.current
    return {
      screenX,
      screenY,
      worldX: (screenX - t.x) / t.scale,
      worldY: (screenY - t.y) / t.scale,
      originalEvent: ev
    }
  }

  useImperativeHandle(
    ref,
    (): CanvasHandle => ({
      canvas: canvasRef.current,
      root: sceneRef.current?.getRoot() ?? null,
      screenToWorld: (clientX, clientY) => {
        const canvas = canvasRef.current
        if (!canvas) return { x: clientX, y: clientY }
        const rect = canvas.getBoundingClientRect()
        const t = transformRef.current
        return {
          x: (clientX - rect.left - t.x) / t.scale,
          y: (clientY - rect.top - t.y) / t.scale
        }
      },
      toDataURL: (type, quality) =>
        canvasRef.current?.toDataURL(type, quality) ?? '',
      repaint: scheduleRepaint
    })
  )

  // Native listeners: pointerdown / click / dblclick / mousemove / wheel.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dispatch = (
      handlerKey: 'onPointerDown' | 'onPointerUp' | 'onClick' | 'onDoubleClick',
      clientX: number,
      clientY: number,
      ev: PointerEvent | MouseEvent
    ): boolean => {
      const scene = sceneRef.current
      if (!scene) return false
      const rect = canvas.getBoundingClientRect()
      const hit = hitTest(scene.getRoot(), clientX - rect.left, clientY - rect.top)
      if (hit) {
        const fn = (hit.node.props as InteractiveProps)[handlerKey]
        if (typeof fn === 'function') {
          fn(makePayload(clientX, clientY, ev))
          return true
        }
      }
      return false
    }

    // Track the pointer-down position so a pan/drag that ends over an element
    // does not fire that element's click.
    let downX = 0
    let downY = 0
    const CLICK_THRESHOLD = 4

    const onDown = (ev: PointerEvent) => {
      downX = ev.clientX
      downY = ev.clientY
      // Only elements that actually handle pointer-down suppress background pan.
      // Edges (click-only) let the pan through, matching the original app.
      const handled = dispatch('onPointerDown', ev.clientX, ev.clientY, ev)
      if (!handled) onBackgroundPointerDown?.(makePayload(ev.clientX, ev.clientY, ev))
    }
    const onClickEv = (ev: MouseEvent) => {
      if (Math.hypot(ev.clientX - downX, ev.clientY - downY) > CLICK_THRESHOLD) return
      dispatch('onClick', ev.clientX, ev.clientY, ev)
    }
    const onDbl = (ev: MouseEvent) =>
      dispatch('onDoubleClick', ev.clientX, ev.clientY, ev)

    const onMove = (ev: PointerEvent) => {
      const scene = sceneRef.current
      if (!scene) return
      const rect = canvas.getBoundingClientRect()
      const hit = hitTest(scene.getRoot(), ev.clientX - rect.left, ev.clientY - rect.top)
      const cursor = (hit?.node.props as GroupProps | undefined)?.cursor
      canvas.style.cursor = cursor ?? 'default'
      onPointerMove?.(makePayload(ev.clientX, ev.clientY, ev), hit?.node ?? null)
    }

    const onWheelEv = (ev: WheelEvent) => onWheel?.(ev)

    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('click', onClickEv)
    canvas.addEventListener('dblclick', onDbl)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('wheel', onWheelEv, { passive: false })
    return () => {
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('click', onClickEv)
      canvas.removeEventListener('dblclick', onDbl)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('wheel', onWheelEv)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onBackgroundPointerDown, onPointerMove, onWheel])

  return (
    <canvas ref={canvasRef} className={className} style={style} />
  )
})
