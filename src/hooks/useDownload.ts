import { useCallback, type RefObject } from 'react'
import type { CanvasHandle } from '@/renderer/Canvas'
import { sceneToSvg } from '@/renderer/svgExport'

function triggerDownload (dataUrl: string, ext: string): void {
  const link = document.createElement('a')
  link.download = `download.${ext}`
  link.href = dataUrl
  link.click()
}

/**
 * Export the current canvas view. PNG/JPEG rasterize the canvas directly; SVG
 * serializes the scene tree (port of `useDownload`, canvas-native).
 */
export function useDownload (
  canvasRef: RefObject<CanvasHandle | null>,
  size: { width: number; height: number },
  background = '#ffffff'
) {
  const savePng = useCallback(() => {
    const url = canvasRef.current?.toDataURL('image/png')
    if (url) triggerDownload(url, 'png')
  }, [canvasRef])

  const saveJpeg = useCallback(() => {
    const url = canvasRef.current?.toDataURL('image/jpeg', 0.95)
    if (url) triggerDownload(url, 'jpg')
  }, [canvasRef])

  const saveSvg = useCallback(() => {
    const handle = canvasRef.current
    if (!handle?.root) return
    const svg = sceneToSvg(handle.root, size.width, size.height, background)
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
    triggerDownload(url, 'svg')
  }, [canvasRef, size.width, size.height, background])

  return { savePng, saveJpeg, saveSvg }
}
