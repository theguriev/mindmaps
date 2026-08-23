/**
 * The thumbnail projection: a map reduced to the only thing legible at 40px.
 *
 * A row in the map list wants a picture of the map, not the map. At that size
 * a node box is under a pixel tall and its text is nothing at all, so the
 * projection keeps points and the lines between them and throws the rest away
 * — which is also, conveniently, everything the stored form is sure to have.
 * `width` and `height` are optional on a stored node and usually absent; they
 * are measured from the text at render time, so anything that needs real boxes
 * needs a canvas, and this needs none.
 *
 * The other half of the point is what the projection costs. Node ids are the
 * single heaviest thing in a stored map — a uuid is written three times over,
 * as the entry key, as `id`, and again as each child's `parent` — and a
 * picture never needs to name anything. Emitting nodes in breadth-first order
 * lets a parent be an index into the points already emitted, so identity costs
 * one small integer. That is what makes it cheap enough to send for every map
 * in a list at once.
 *
 * Breadth-first is load-bearing rather than tidy: a node's parent is always
 * emitted before the node, so `parents[i] < i` holds everywhere, truncating at
 * the cap can never leave a parent index dangling, and a renderer is a forward
 * loop with no guards.
 */
import type { MapPreview, NodeId, RawNode } from './types'

export type { MapPreview }

/**
 * The square the points are normalized into. A preview is scale-free: it says
 * where the nodes are relative to each other, and the tile it lands in decides
 * how big that is.
 */
export const PREVIEW_SPAN = 255

/**
 * Points past this are dropped. Two hundred marks in a 40px tile is already a
 * texture rather than a shape, and the cap is what bounds a list's payload for
 * a map that has no bound of its own.
 */
export const PREVIEW_MAX_POINTS = 200

/** Rounds the way PHP's `floor($v + 0.5)` does, which is where the mirror of
 *  this function lives. Every input here is non-negative, so the two agree on
 *  every value — `Math.round` and PHP's `round()` do not. */
function round (value: number): number {
  return Math.floor(value + 0.5)
}

/**
 * The preview of a stored `content` list, or `null` for a map with nothing to
 * draw. Never throws: a malformed document costs its thumbnail, not its row.
 */
export function mapPreview (content: Array<[NodeId, RawNode]>): MapPreview | null {
  if (content.length === 0) return null

  // A node's own `id` wins over its entry key, which is what the editor reads.
  // The stored form dedupes on the key, so two entries can claim one id; the
  // first is the one anything can point at, and the second is unreachable —
  // the same node the canvas draws detached.
  const indexOf = new Map<NodeId, number>()
  content.forEach(([key, node], index) => {
    const id = node.id ?? key
    if (!indexOf.has(id)) indexOf.set(id, index)
  })

  const childrenOf = new Map<NodeId, number[]>()
  const roots: number[] = []
  content.forEach(([, node], index) => {
    const parent = node.parent
    // A parent that is missing, or is the node itself, makes a root — the
    // document may be older than the rule that drops dangling pointers.
    if (parent === undefined || indexOf.get(parent) === undefined || indexOf.get(parent) === index) {
      roots.push(index)
      return
    }
    const bucket = childrenOf.get(parent)
    if (bucket === undefined) childrenOf.set(parent, [index])
    else bucket.push(index)
  })

  const xs: number[] = []
  const ys: number[] = []
  const parents: number[] = []
  const seen = new Set<number>()
  const queue: Array<[entry: number, parentPoint: number]> = roots.map((entry) => [entry, -1])

  let head = 0
  // Entries a walk from the roots never reaches — a cycle has no root — are
  // seeded afterwards, so a broken document loses its edges rather than its
  // nodes. `orphan` only ever moves forward, which keeps the sweep linear.
  let orphan = 0

  while (xs.length < PREVIEW_MAX_POINTS) {
    if (head >= queue.length) {
      while (orphan < content.length && seen.has(orphan)) orphan++
      if (orphan >= content.length) break
      queue.push([orphan, -1])
    }

    const [entry, parentPoint] = queue[head++]
    if (seen.has(entry)) continue
    seen.add(entry)

    const [key, node] = content[entry]
    // A node with no usable position cannot be placed, and neither can the
    // branch hanging off it: leaving them out beats inventing coordinates.
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) continue

    const point = xs.length
    xs.push(node.x)
    ys.push(node.y)
    parents.push(parentPoint)

    for (const child of childrenOf.get(node.id ?? key) ?? []) queue.push([child, point])
  }

  if (xs.length === 0) return null

  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const spanX = maxX - minX
  const spanY = maxY - minY
  // One scale for both axes, so a map keeps its proportions. A single node —
  // or a row of them — has no span to divide by and collapses to the origin,
  // which the tile's padding renders as a dot rather than as nothing.
  const span = Math.max(spanX, spanY)
  const scale = span > 0 ? PREVIEW_SPAN / span : 0

  const points: number[] = []
  for (let i = 0; i < xs.length; i++) {
    points.push(round((xs[i] - minX) * scale), round((ys[i] - minY) * scale))
  }

  return {
    width: round(spanX * scale),
    height: round(spanY * scale),
    points,
    parents
  }
}

/** Stroke widths, in the preview's own units. At a 40px tile one unit is about
 *  a sixth of a pixel, so these are what makes the drawing visible at all. */
export const PREVIEW_EDGE_WIDTH = 7
export const PREVIEW_DOT_WIDTH = 16
export const PREVIEW_ROOT_WIDTH = 28

/** Room for the widest mark to sit on the edge of the box without clipping. */
export const PREVIEW_PADDING = PREVIEW_ROOT_WIDTH / 2 + 2

/**
 * The three `d` strings a preview draws as: the branches, the nodes, and the
 * roots on top of them. Three paths rather than one element per node, because
 * a hundred-row list would otherwise be twenty thousand elements.
 *
 * A dot is a zero-length subpath, which a round line cap renders as a disc of
 * the stroke width.
 */
export function previewPaths (preview: MapPreview): {
  edges: string
  dots: string
  roots: string
} {
  const { points, parents } = preview
  const edges: string[] = []
  const dots: string[] = []
  const roots: string[] = []

  for (let i = 0; i < parents.length; i++) {
    const x = points[2 * i]
    const y = points[2 * i + 1]
    const parent = parents[i]
    if (parent >= 0) {
      edges.push(`M${points[2 * parent]} ${points[2 * parent + 1]}L${x} ${y}`)
      dots.push(`M${x} ${y}h0`)
    } else {
      roots.push(`M${x} ${y}h0`)
    }
  }

  return { edges: edges.join(''), dots: dots.join(''), roots: roots.join('') }
}
