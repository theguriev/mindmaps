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
}
