import { useLayoutEffect, useState, type RefObject } from 'react'

/**
 * Tracks the pixel size of an element (or the window when no ref is given).
 * Uses ResizeObserver for element refs and the resize event for the window.
 */
export function useOnResize (
  ref?: RefObject<HTMLElement | null>
): { width: number; height: number } {
  const [size, setSize] = useState({ width: 0, height: 0 })

  useLayoutEffect(() => {
    if (ref?.current) {
      const el = ref.current
      const update = () =>
        setSize({ width: el.offsetWidth, height: el.offsetHeight })
      update()
      const ro = new ResizeObserver(update)
      ro.observe(el)
      return () => ro.disconnect()
    }

    const update = () =>
      setSize({ width: window.innerWidth, height: window.innerHeight })
    update()
    window.addEventListener('resize', update, { passive: true })
    return () => window.removeEventListener('resize', update)
  }, [ref])

  return size
}
