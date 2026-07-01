import { useState, type PointerEvent as ReactPointerEvent } from 'react'
import { PlusIcon, SmilePlusIcon } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover'
import { EmojiPicker } from '@/components/EmojiPicker'

interface CreateToolbarProps {
  onAddRoot: () => void
  onReactionDragStart: (emoji: string, e: ReactPointerEvent) => void
}

const RECENTS_KEY = 'mm-recent-reactions'
const DEFAULT_RECENTS = ['🥰', '👍', '😀', '😂', '❤️', '🎉']

function loadRecents (): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENTS_KEY) ?? 'null')
    return Array.isArray(raw) && raw.length ? raw.slice(0, 6) : DEFAULT_RECENTS
  } catch {
    return DEFAULT_RECENTS
  }
}

const Divider = () => <div className="mx-1 h-6 w-px bg-border" />

/** Bottom-centre toolbar: add-root (+) and a set of draggable emoji reactions
 *  (recently used) plus a picker to choose any emoji. */
export function CreateToolbar ({ onAddRoot, onReactionDragStart }: CreateToolbarProps) {
  const [recents, setRecents] = useState<string[]>(loadRecents)
  const [pickerOpen, setPickerOpen] = useState(false)

  const promote = (emoji: string) => {
    setRecents((prev) => {
      const next = [emoji, ...prev.filter((e) => e !== emoji)].slice(0, 6)
      try {
        localStorage.setItem(RECENTS_KEY, JSON.stringify(next))
      } catch {
        // ignore persistence failures
      }
      return next
    })
  }

  // Drag a reaction from the toolbar onto a node (and remember it as recent).
  const startDrag = (emoji: string, e: ReactPointerEvent) => {
    promote(emoji)
    onReactionDragStart(emoji, e)
  }

  return (
    <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center rounded-2xl border bg-background p-1.5 shadow-lg select-none">
      <button
        type="button"
        title="Add root node"
        aria-label="Add root node"
        onClick={onAddRoot}
        className="flex h-10 items-center justify-center rounded-full border px-6 text-foreground/80 transition-colors hover:bg-muted [&_svg]:size-5"
      >
        <PlusIcon />
      </button>
      <Divider />
      <div className="flex items-center gap-0.5">
        {recents.map((emoji, i) => (
          <button
            key={`${emoji}-${i}`}
            type="button"
            title="Drag onto a node to react"
            aria-label={`React ${emoji}`}
            onPointerDown={(e) => startDrag(emoji, e)}
            className="flex size-10 cursor-grab items-center justify-center rounded-xl text-2xl leading-none transition-colors hover:bg-muted active:cursor-grabbing"
          >
            <span className="pointer-events-none">{emoji}</span>
          </button>
        ))}
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              title="Choose an emoji"
              aria-label="Choose an emoji"
              className="flex size-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted [&_svg]:size-5"
            >
              <SmilePlusIcon />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" side="top" className="w-auto p-2">
            <EmojiPicker
              onPick={(emoji) => {
                promote(emoji)
                setPickerOpen(false)
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}
