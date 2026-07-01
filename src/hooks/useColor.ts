import { useState } from 'react'
import type { PathEdge } from '@/mindmap/types'

export interface ColorState {
  visible: PathEdge | null
  x: number
  y: number
}

/** State for the radial branch-colour picker (port of `useColor`). */
export function useColor () {
  const [state, setState] = useState<ColorState>({ visible: null, x: 0, y: 0 })

  const pathClick = (path: PathEdge, clientX: number, clientY: number) => {
    setState({ visible: path, x: clientX, y: clientY })
  }

  const close = () => {
    setState((prev) => (prev.visible === null ? prev : { ...prev, visible: null }))
  }

  return { color: state, pathClick, close }
}
