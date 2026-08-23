/** Domain model types for the mind map. */

export type NodeId = string | number

export type LineStyle = 'solid' | 'dashed'
export type LineShape = 'straight' | 'smooth'

/** A raw stored node (as persisted in localStorage `content` entries). */
export interface RawNode {
  id?: NodeId
  name: string
  x: number
  y: number
  parent?: NodeId
  /** Branch appearance (applied to the edge coming into this node). */
  stroke?: string
  strokeWidth?: number
  lineStyle?: LineStyle
  lineShape?: LineShape
  width?: number
  height?: number
  editing?: boolean
  /** A free-floating yellow sticky note tethered to its parent by a dashed line. */
  sticky?: boolean
  /** An emoji reaction badge shown at the node's top-right corner. */
  reaction?: string
  /** Folded branch: the node stays visible, all its descendants are hidden. */
  collapsed?: boolean
  component?: 'root' | 'node'
  isRightSide?: boolean
  isUpSide?: boolean
  isHaveChildren?: boolean
}

/** An enriched node produced by `prepareList` (all derived fields filled). */
export interface MindNode extends RawNode {
  id: NodeId
  width: number
  height: number
  editing: boolean
  component: 'root' | 'node'
  isRightSide: boolean
  isUpSide: boolean
  isHaveChildren: boolean
  collapsed: boolean
  /** True when any ancestor is collapsed — the node is not drawn or hit. */
  hidden: boolean
}

export interface PathEdge {
  id: string
  fromID: NodeId
  toID: NodeId
  x: number
  y: number
  x2: number
  y2: number
  x3: number
  y3: number
  x4: number
  y4: number
  isRightSide: boolean
  strokeWidth: number
  stroke: string
  lineStyle: LineStyle
  lineShape: LineShape
  /** Edge into a sticky note: dashed tether, no arrow-heads. */
  sticky: boolean
}

export type Adjacency = Map<NodeId, RawNode>

/**
 * A map reduced to points and the lines between them — see `mapPreview()` in
 * `./preview` for how one is built and why it is shaped like this.
 */
export interface MapPreview {
  /** Extent of the points; one of the two is always `PREVIEW_SPAN`. */
  width: number
  height: number
  /** Flat `x, y` pairs — `points[2 * i]` and `points[2 * i + 1]`. */
  points: number[]
  /** `parents[i]` is the index of `i`'s parent, or `-1`. Always `< i`. */
  parents: number[]
}

/** A persisted map document. */
export interface MapDoc {
  id: NodeId
  title: string
  content: Array<[NodeId, RawNode]>
  modified?: string
  date?: string
  meta?: { template?: string }
  /** Schema version of `content`. Absent on documents written before
   *  versioning existed; stores stamp the current version on read. */
  version?: number
}

/**
 * A map as a list row: everything about it except the map.
 *
 * Listing and opening want different things, and conflating them made the
 * cheap operation pay for the expensive one — a screen showing a hundred
 * titles downloaded a hundred whole documents to render them. A summary
 * carries what a row draws and nothing else, so `content` is a thing you ask
 * for when you open a map. Its own type, rather than a `MapDoc` with holes in
 * it, so anything that reaches for content it was never given is a compile
 * error and not an empty map saved over a full one.
 */
export interface MapSummary {
  id: NodeId
  title: string
  /** The map's node count. Whole, even when the preview was capped. */
  nodes: number
  /** The map's shape, or null for one with nothing to draw. */
  preview: MapPreview | null
  modified?: string
  date?: string
  meta?: { template?: string }
}
