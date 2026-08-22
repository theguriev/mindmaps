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
