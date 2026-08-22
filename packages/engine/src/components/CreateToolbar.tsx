import { useState, type PointerEvent as ReactPointerEvent } from 'react'
import { PlusIcon, SmilePlusIcon, StickyNoteIcon } from 'lucide-react'
import { Button } from './ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from './ui/popover'
import { Separator } from './ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from './ui/tooltip'
import { EmojiPicker } from './EmojiPicker'

interface CreateToolbarProps {
  onAddRoot: () => void
  onAddSticky: () => void
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

/** The bar sizes itself from its buttons, so the rule cannot inherit a height
 *  from the row and needs an explicit one. */
const Divider = () => (
  <Separator
    orientation="vertical"
    className="mx-1 data-[orientation=vertical]:h-6"
  />
)

/** Bottom-centre toolbar: everything that puts something new on the canvas —
 *  add-root (+), a sticky note, and a set of draggable emoji reactions
 *  (recently used) plus a picker to choose any emoji. */
export function CreateToolbar ({
  onAddRoot,
  onAddSticky,
  onReactionDragStart
}: CreateToolbarProps) {
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
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="lg"
            // The name must not depend on the tooltip being open.
            aria-label="Add root node"
            onClick={onAddRoot}
            className="rounded-full border text-foreground/80 hover:bg-muted hover:text-foreground/80 has-[>svg]:px-6"
          >
            <PlusIcon className="size-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Add root node</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Add sticky note"
            onClick={onAddSticky}
            className="ml-1 size-10 rounded-xl text-foreground/80 hover:bg-muted hover:text-foreground/80"
          >
            <StickyNoteIcon className="size-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Add sticky note</TooltipContent>
      </Tooltip>
      <Divider />
      <div className="flex items-center gap-0.5">
        {recents.map((emoji, i) => (
          <Tooltip key={`${emoji}-${i}`}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`React ${emoji}`}
                // A reaction is dropped by dragging, so the gesture starts on
                // pointer-down rather than on click.
                onPointerDown={(e) => startDrag(emoji, e)}
                className="size-10 cursor-grab rounded-xl text-2xl leading-none hover:bg-muted active:cursor-grabbing"
              >
                <span className="pointer-events-none">{emoji}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Drag onto a node to react</TooltipContent>
          </Tooltip>
        ))}
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Choose an emoji"
                  className="size-10 rounded-xl text-muted-foreground hover:bg-muted hover:text-muted-foreground"
                >
                  <SmilePlusIcon className="size-5" />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent>Choose an emoji</TooltipContent>
          </Tooltip>
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
