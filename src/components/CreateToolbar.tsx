import { MousePointer2Icon, PlusIcon } from 'lucide-react'
import type { PointerEvent as ReactPointerEvent } from 'react'

interface CreateToolbarProps {
  onSelectTool: () => void
  onAddRoot: () => void
  reactionEmoji: string
  onReactionDragStart: (emoji: string, e: ReactPointerEvent) => void
}

const Divider = () => <div className="mx-1 h-6 w-px bg-border" />

/** Bottom-centre toolbar: pointer tool, add-root (+), and a draggable reaction. */
export function CreateToolbar ({
  onSelectTool,
  onAddRoot,
  reactionEmoji,
  onReactionDragStart
}: CreateToolbarProps) {
  return (
    <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center rounded-2xl border bg-background p-1.5 shadow-lg select-none">
      <button
        type="button"
        title="Select"
        aria-label="Select"
        onClick={onSelectTool}
        className="flex size-10 items-center justify-center rounded-xl bg-violet-500 text-white shadow-sm transition-colors hover:bg-violet-600 [&_svg]:size-5"
      >
        <MousePointer2Icon className="-scale-x-100" />
      </button>
      <Divider />
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
      <button
        type="button"
        title="Drag onto a node to react"
        aria-label="Reaction"
        onPointerDown={(e) => onReactionDragStart(reactionEmoji, e)}
        className="flex size-10 cursor-grab items-center justify-center rounded-xl text-2xl transition-colors hover:bg-muted active:cursor-grabbing"
      >
        <span className="pointer-events-none leading-none">{reactionEmoji}</span>
      </button>
    </div>
  )
}
