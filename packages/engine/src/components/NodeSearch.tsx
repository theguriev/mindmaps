import type { MindNode, NodeId } from '../mindmap/types'
import {
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList
} from './ui/command'

/** One-line plain-text preview of a node's markdown source (for search rows). */
export function plainTextOf (name: string): string {
  return name
    .replace(/```/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1') // inline links / images → label
    .replace(/!?\[([^\]]*)\]\[[^\]]*\]/g, '$1') // reference links → label
    .replace(/^\s*\[[^\]]+\]:\s*\S.*$/gm, '') // link definitions render nothing
    .replace(/[#>*_~`|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

interface NodeSearchProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  list: Map<NodeId, MindNode>
  onJump: (id: NodeId) => void
}

/** Item values are `id::text` — the id prefix keeps values unique for
 *  duplicate node texts, and the filter matches only the text after the first
 *  `::`, so queries never hit id characters (a v4 UUID would otherwise match
 *  "4", "cafe", …). Ids are uuids/numbers and never contain a colon. */
function matchNode (value: string, search: string): number {
  const text = value.slice(value.indexOf('::') + 2)
  return text.toLowerCase().includes(search.toLowerCase().trim()) ? 1 : 0
}

/** ⌘F palette: fuzzy-find a node by its text (folded branches included) and
 *  jump to it. */
export function NodeSearch ({ open, onOpenChange, list, onJump }: NodeSearchProps) {
  const rows: Array<{ id: NodeId; text: string; parent: string }> = []
  for (const node of list.values()) {
    const text = plainTextOf(node.name)
    if (!text) continue
    const parent =
      node.parent !== undefined ? plainTextOf(list.get(node.parent)?.name ?? '') : ''
    rows.push({ id: node.id, text, parent })
  }
  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Find node"
      description="Search the map by node text"
      filter={matchNode}
    >
      <CommandInput placeholder="Find a node…" />
      <CommandList>
        <CommandEmpty>No matching nodes.</CommandEmpty>
        {rows.map((row) => (
          <CommandItem
            key={String(row.id)}
            value={`${String(row.id)}::${row.text}`}
            onSelect={() => {
              onOpenChange(false)
              onJump(row.id)
            }}
          >
            <span className="truncate">{row.text}</span>
            {row.parent && (
              <span className="ml-auto max-w-[40%] truncate text-xs text-muted-foreground">
                {row.parent}
              </span>
            )}
          </CommandItem>
        ))}
      </CommandList>
    </CommandDialog>
  )
}
