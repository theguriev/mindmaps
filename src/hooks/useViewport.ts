import { useRef, useState, type RefObject } from 'react'
import { isWheelUp } from '@/utils/wheel'

export interface ViewportOptions {
  maxZoom?: number
  zoomStep?: number
  minZoom?: number
}

export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/**
 * Pan/zoom viewport state with Figma-style navigation:
 * - ⌘/Ctrl + wheel (or trackpad pinch) → zoom anchored at the cursor
 * - plain wheel → pan; Shift + wheel → horizontal pan
 * - keyboard zoom helpers (zoomIn/Out/To100/ToFit) anchored at the viewport centre
 */
export function useViewport (
  areaRef: RefObject<HTMLElement | null>,
  options: ViewportOptions = {}
) {
  const { maxZoom = 10, zoomStep = 0.05, minZoom = 0.25 } = options

  const [scale, setScaleState] = useState(1)
  const [offsetX, setOffsetXState] = useState(0)
  const [offsetY, setOffsetYState] = useState(0)

  const scaleRef = useRef(1)
  const oxRef = useRef(0)
  const oyRef = useRef(0)

  const setScale = (v: number) => {
    scaleRef.current = v
    setScaleState(v)
  }
  const setOX = (v: number) => {
    oxRef.current = v
    setOffsetXState(v)
  }
  const setOY = (v: number) => {
    oyRef.current = v
    setOffsetYState(v)
  }

  const clamp = (s: number) => Math.max(minZoom, Math.min(maxZoom, s))

  // Zoom to `target` scale while keeping the screen point (sx, sy) fixed.
  const zoomToScale = (target: number, sx: number, sy: number) => {
    const s = scaleRef.current
    const next = clamp(target)
    if (next === s) return
    const worldX = (sx - oxRef.current) / s
    const worldY = (sy - oyRef.current) / s
    setOX(sx - worldX * next)
    setOY(sy - worldY * next)
    setScale(next)
  }

  const increase = (cursorX: number, cursorY: number) => {
    const s = scaleRef.current
    const newScale = s + s * zoomStep
    if (maxZoom > newScale) {
      setOX(cursorX * zoomStep * -1 + oxRef.current * (zoomStep + 1))
      setOY(cursorY * zoomStep * -1 + oyRef.current * (zoomStep + 1))
      setScale(newScale)
    }
  }

  const decrease = (cursorX: number, cursorY: number) => {
    const s = scaleRef.current
    const newScale = s - s * zoomStep
    if (minZoom < newScale) {
      setOX(cursorX - cursorX * (1 - zoomStep) + oxRef.current * (1 - zoomStep))
      setOY(cursorY - cursorY * (1 - zoomStep) + oyRef.current * (1 - zoomStep))
      setScale(s - s * zoomStep)
    }
  }

  const centre = () => {
    const rect = areaRef.current?.getBoundingClientRect()
    return { x: (rect?.width ?? 0) / 2, y: (rect?.height ?? 0) / 2 }
  }

  const zoomIn = () => {
    const c = centre()
    zoomToScale(scaleRef.current * 1.2, c.x, c.y)
  }
  const zoomOut = () => {
    const c = centre()
    zoomToScale(scaleRef.current / 1.2, c.x, c.y)
  }
  const zoomTo100 = () => {
    const c = centre()
    zoomToScale(1, c.x, c.y)
  }

  const zoomToFit = (bounds: Bounds | null) => {
    const rect = areaRef.current?.getBoundingClientRect()
    if (!rect || !bounds) return
    const pad = 80
    const bw = Math.max(1, bounds.maxX - bounds.minX)
    const bh = Math.max(1, bounds.maxY - bounds.minY)
    const s = clamp(
      Math.min((rect.width - pad * 2) / bw, (rect.height - pad * 2) / bh)
    )
    const worldCx = (bounds.minX + bounds.maxX) / 2
    const worldCy = (bounds.minY + bounds.maxY) / 2
    setScale(s)
    setOX(rect.width / 2 - worldCx * s)
    setOY(rect.height / 2 - worldCy * s)
  }

  const handleWheel = (e: WheelEvent) => {
    const area = areaRef.current
    if (!area) return
    const rect = area.getBoundingClientRect()

    // ⌘/Ctrl + wheel (and trackpad pinch, which reports ctrlKey) → zoom at cursor.
    if (e.metaKey || e.ctrlKey) {
      const cursorX = e.clientX - rect.left
      const cursorY = e.clientY - rect.top
      const dir = isWheelUp(e)
      if (dir === 1) increase(cursorX, cursorY)
      else if (dir === -1) decrease(cursorX, cursorY)
      e.preventDefault()
      e.stopPropagation()
      return
    }

    // Plain wheel → pan (Figma). Shift maps vertical wheel to horizontal pan.
    if (e.shiftKey) {
      setOX(oxRef.current - (e.deltaX || e.deltaY))
    } else {
      setOX(oxRef.current - e.deltaX)
      setOY(oyRef.current - e.deltaY)
    }
    e.preventDefault()
    e.stopPropagation()
  }

  const panBy = (dx: number, dy: number) => {
    setOX(oxRef.current + dx)
    setOY(oyRef.current + dy)
  }

  const setOffset = (x: number, y: number) => {
    setOX(x)
    setOY(y)
  }

  return {
    scale,
    offsetX,
    offsetY,
    scaleRef,
    oxRef,
    oyRef,
    handleWheel,
    panBy,
    setOffset,
    zoomIn,
    zoomOut,
    zoomTo100,
    zoomToFit
  }
}
