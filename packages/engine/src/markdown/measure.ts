/**
 * A shared, off-screen 2D context used to measure markdown layouts in React
 * (outside of the paint loop). The same font strings are used at paint time so
 * measurements match what is drawn. Results are memoized per
 * (text, align, fontFamily, maxWidth) in a small LRU cache; the cache is
 * cleared when webfonts finish loading, since glyph metrics change then.
 */
import { layoutMarkdown, type LayoutOptions, type MarkdownLayout } from './layout'

let measureCtx: CanvasRenderingContext2D | null = null

function getMeasureCtx (): CanvasRenderingContext2D {
  if (measureCtx) return measureCtx
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas context unavailable')
  measureCtx = ctx
  return ctx
}

// Map iteration order is insertion order, so re-inserting on hit makes the
// first key the least recently used one.
const cache = new Map<string, MarkdownLayout>()
const CACHE_MAX = 300

let fontsListenerAttached = false

/** Measurements go stale when webfonts finish loading; drop them then. */
function ensureFontsListener (): void {
  if (fontsListenerAttached) return
  if (typeof document === 'undefined' || !('fonts' in document)) return
  fontsListenerAttached = true
  document.fonts.addEventListener('loadingdone', () => {
    cache.clear()
  })
}

export function measureMarkdown (
  text: string,
  options: LayoutOptions = {}
): MarkdownLayout {
  ensureFontsListener()
  // NUL-delimited so option values containing spaces cannot collide.
  const key = `${options.align ?? 'left'}\u0000${options.fontFamily ?? ''}\u0000${options.maxWidth ?? ''}\u0000${text}`
  const hit = cache.get(key)
  if (hit) {
    cache.delete(key)
    cache.set(key, hit)
    return hit
  }
  const layout = layoutMarkdown(getMeasureCtx(), text, options)
  cache.set(key, layout)
  if (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  return layout
}
