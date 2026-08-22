/**
 * Public API of the mind-map engine.
 *
 * Everything a host application needs to embed the editor: the storage-agnostic
 * `<MindMapEditor/>`, the domain types its documents are made of, the template
 * registry and the few UI pieces a "my maps" screen is built from.
 *
 * Hosts must also import the stylesheet once:
 *   import '@mindmaps/engine/styles.css'
 */

// Registers the canvas host elements (<group>, <box>, …) with React's JSX
// namespace for anything that type-checks against this package.
import type {} from './renderer/jsx'

// ---- The editor ----
// Also available as `@mindmaps/engine/editor`; importing it from there keeps
// the (large) editor out of a host's entry chunk when only the light pieces
// below are needed on the first screen.
export { MindMapEditor } from './editor/MindMapEditor'
export type { MindMapEditorProps } from './editor/MindMapEditor'

// ---- Domain model ----
export type {
  Adjacency,
  LineShape,
  LineStyle,
  MapDoc,
  MapPreview,
  MapSummary,
  MindNode,
  NodeId,
  PathEdge,
  RawNode
} from './mindmap/types'
export { branch, canReparent, children, collapsedCounts, prepareList, preparePaths } from './mindmap/list'
export {
  PREVIEW_MAX_POINTS,
  PREVIEW_SPAN,
  mapPreview,
  previewPaths
} from './mindmap/preview'
export { useAdjacency } from './mindmap/useAdjacency'
export {
  CLIPBOARD_MIME,
  collectBranches,
  outlineText,
  outlineToNodes,
  parseClipboard,
  parseOutline,
  remapForPaste
} from './mindmap/clipboard'
export type { BranchClipboard } from './mindmap/clipboard'

// ---- Templates ----
export { blankTemplate, builtinTemplate, listTemplates, prepareTemplate, templateFromDoc } from './templates'
export type { BuiltinTemplate, Center, TemplateChoice, TemplateDoc } from './templates'

// ---- Rendering primitives (for hosts that draw their own scenes) ----
export { Canvas } from './renderer/Canvas'
export type { CanvasHandle } from './renderer/Canvas'
export { sceneToSvg } from './renderer/svgExport'
export { measureMarkdown } from './markdown/measure'
export type { MarkdownLayout } from './markdown/layout'

// ---- UI pieces for a map-list screen ----
// `MapList` is the whole screen; the pieces below it are exported for a host
// that wants to assemble its own.
export { MapList } from './components/MapList'
export type { MapListProps } from './components/MapList'
export { Logo } from './components/Logo'
export { MapItem } from './components/MapItem'
export type { MapItemProps } from './components/MapItem'
export { MapThumb } from './components/MapThumb'
export { Templates } from './components/Templates'
export { Island } from './components/Island'
export { CommandMenu } from './components/CommandMenu'
export type { MenuCommand } from './components/CommandMenu'
export { Badge } from './components/ui/badge'
export { Button } from './components/ui/button'
export { Input } from './components/ui/input'
export { Separator } from './components/ui/separator'
export { Popover, PopoverContent, PopoverTrigger } from './components/ui/popover'
export { cn } from './lib/utils'
export { guid } from './utils/guid'
