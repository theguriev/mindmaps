import { useRef, useState, type RefObject } from 'react'
import { isWheelRight, isWheelUp } from '@/utils/wheel'

export interface ViewportOptions {
  maxZoom?: number
  zoomStep?: number
  minZoom?: number
}

/**
 * Pan/zoom viewport state. Zoom on ctrl+wheel (anchored at the cursor) and
 * scroll-pan on meta+wheel — the exact arithmetic is ported from the Vue
 * `useZoomWheel` / `usePanScroll` composables.
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

  const handleWheel = (e: WheelEvent) => {
    const area = areaRef.current
    if (!area) return
    const rect = area.getBoundingClientRect()
    const cursorX = e.clientX - rect.left
    const cursorY = e.clientY - rect.top

    if (e.ctrlKey) {
      const dir = isWheelUp(e)
      if (dir === 1) increase(cursorX, cursorY)
      else if (dir === -1) decrease(cursorX, cursorY)
      e.preventDefault()
      e.stopPropagation()
      return
    }

    if (!e.ctrlKey && !e.altKey && !e.shiftKey && e.metaKey) {
      const step = 10
      const up = isWheelUp(e)
      const right = isWheelRight(e)
      if (up === 1) setOY(oyRef.current - step)
      else if (up === -1) setOY(oyRef.current + step)
      if (right === 1) setOX(oxRef.current + step)
      else if (right === -1) setOX(oxRef.current - step)
      e.preventDefault()
      e.stopPropagation()
    }
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
    setOffset
  }
}
