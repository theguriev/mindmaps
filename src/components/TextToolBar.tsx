/**
 * Markdown formatting toolbar shown above the editing textarea. Buttons call
 * the provided actions; keyboard shortcuts mirror the original (⌘B, ⌘I, …).
 */
import {
  BoldIcon,
  CodeIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  QuoteIcon,
  StrikethroughIcon,
  type LucideIcon
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { useEvent } from '@/hooks/useEvent'

export interface ToolbarActions {
  bold: () => void
  italic: () => void
  strikethrough: () => void
  code: () => void
  link: () => void
  orderedList: () => void
  bulletedList: () => void
  blockquote: () => void
}

export function TextToolBar ({ actions }: { actions: ToolbarActions }) {
  useEvent<KeyboardEvent>('keydown', (event) => {
    const dict: Array<[boolean, () => void]> = [
      [event.metaKey && event.code === 'KeyB', actions.bold],
      [event.metaKey && event.code === 'KeyI', actions.italic],
      [event.metaKey && event.shiftKey && event.code === 'KeyX', actions.strikethrough],
      [event.metaKey && event.shiftKey && event.code === 'KeyC', actions.code],
      [event.metaKey && event.shiftKey && event.code === 'KeyU', actions.link],
      [event.metaKey && event.shiftKey && event.code === 'Digit7', actions.orderedList],
      [event.metaKey && event.shiftKey && event.code === 'Digit8', actions.bulletedList],
      [event.metaKey && event.shiftKey && event.code === 'Digit9', actions.blockquote]
    ]
    const match = dict.find(([cond]) => cond)
    if (match) {
      event.preventDefault()
      match[1]()
    }
  })

  const items: Array<{ icon: LucideIcon; label: string; keys: string; run: () => void }> = [
    { icon: BoldIcon, label: 'Bold', keys: '⌘ B', run: actions.bold },
    { icon: ItalicIcon, label: 'Italic', keys: '⌘ I', run: actions.italic },
    { icon: StrikethroughIcon, label: 'Strikethrough', keys: '⌘ ⇧ X', run: actions.strikethrough },
    { icon: CodeIcon, label: 'Code', keys: '⌘ ⇧ C', run: actions.code },
    { icon: LinkIcon, label: 'Link', keys: '⌘ ⇧ U', run: actions.link },
    { icon: ListOrderedIcon, label: 'Ordered list', keys: '⌘ ⇧ 7', run: actions.orderedList },
    { icon: ListIcon, label: 'Bulleted list', keys: '⌘ ⇧ 8', run: actions.bulletedList },
    { icon: QuoteIcon, label: 'Blockquote', keys: '⌘ ⇧ 9', run: actions.blockquote }
  ]

  return (
    <div className="absolute top-1 left-1 z-10 flex rounded-md bg-background p-0.5">
      {items.map(({ icon: Icon, label, keys, run }) => (
        <Tooltip key={label}>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 opacity-60 hover:opacity-100"
              onClick={run}
            >
              <Icon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {label} — <b>{keys}</b>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  )
}
