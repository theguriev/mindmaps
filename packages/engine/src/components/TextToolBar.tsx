/**
 * Markdown formatting toolbar for the editing textarea. Buttons call the
 * provided actions; keyboard shortcuts mirror the original (⌘B, ⌘I, …).
 * It sits outside the textarea's box (above it, or below when the overlay
 * hangs upwards) so it can never paint over the text being edited.
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
import { Button } from './ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from './ui/tooltip'
import { useEvent } from '../hooks/useEvent'

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

// ⌘ on a Mac, Ctrl everywhere else — deliberately not "either one": ⌃B/⌃F are
// macOS's own caret moves inside a textarea, so answering them here would
// break typing on the platform the ⌘ shortcuts already serve.
const IS_MAC =
  typeof navigator !== 'undefined' && /Mac|iP(hone|ad|od)/.test(navigator.platform)
const MOD = IS_MAC ? '⌘' : 'Ctrl'
const SHIFT = IS_MAC ? '⇧' : 'Shift'

export function TextToolBar ({
  actions,
  side = 'top',
  target = null
}: {
  actions: ToolbarActions
  /** Which side of the textarea the bar hangs off. */
  side?: 'top' | 'bottom'
  /** The textarea being edited. The shortcuts are scoped to it, like every
   *  other listener in the editor: bound to `window` they `preventDefault()`
   *  ⌘B/⌘I/… for the whole page, eating the host page's own shortcuts. */
  target?: HTMLTextAreaElement | null
}) {
  useEvent<KeyboardEvent>(
    'keydown',
    (event) => {
      const mod = IS_MAC ? event.metaKey : event.ctrlKey
      const dict: Array<[boolean, () => void]> = [
        [mod && event.code === 'KeyB', actions.bold],
        [mod && event.code === 'KeyI', actions.italic],
        [mod && event.shiftKey && event.code === 'KeyX', actions.strikethrough],
        [mod && event.shiftKey && event.code === 'KeyC', actions.code],
        [mod && event.shiftKey && event.code === 'KeyU', actions.link],
        [mod && event.shiftKey && event.code === 'Digit7', actions.orderedList],
        [mod && event.shiftKey && event.code === 'Digit8', actions.bulletedList],
        [mod && event.shiftKey && event.code === 'Digit9', actions.blockquote]
      ]
      const match = dict.find(([cond]) => cond)
      if (match) {
        event.preventDefault()
        match[1]()
      }
    },
    target
  )

  const items: Array<{ icon: LucideIcon; label: string; keys: string; run: () => void }> = [
    { icon: BoldIcon, label: 'Bold', keys: `${MOD} B`, run: actions.bold },
    { icon: ItalicIcon, label: 'Italic', keys: `${MOD} I`, run: actions.italic },
    { icon: StrikethroughIcon, label: 'Strikethrough', keys: `${MOD} ${SHIFT} X`, run: actions.strikethrough },
    { icon: CodeIcon, label: 'Code', keys: `${MOD} ${SHIFT} C`, run: actions.code },
    { icon: LinkIcon, label: 'Link', keys: `${MOD} ${SHIFT} U`, run: actions.link },
    { icon: ListOrderedIcon, label: 'Ordered list', keys: `${MOD} ${SHIFT} 7`, run: actions.orderedList },
    { icon: ListIcon, label: 'Bulleted list', keys: `${MOD} ${SHIFT} 8`, run: actions.bulletedList },
    { icon: QuoteIcon, label: 'Blockquote', keys: `${MOD} ${SHIFT} 9`, run: actions.blockquote }
  ]

  return (
    <div
      // Anchored to the textarea's edge from the outside: `bottom-full` /
      // `top-full` leave the textarea's own box, and the corner opposite the
      // bar is where the resize grip lives, so the two never share a pixel.
      className={`absolute left-0 z-10 flex rounded-md bg-background p-0.5 ${
        side === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'
      }`}
      role="toolbar"
      aria-label="Markdown formatting"
    >
      {items.map(({ icon: Icon, label, keys, run }) => (
        <Tooltip key={label}>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 opacity-60 hover:opacity-100"
              // The tooltip only names the button while it is open (it sets
              // `aria-describedby`), so without this a screen reader reads
              // eight buttons called "button".
              aria-label={`${label} (${keys})`}
              onClick={run}
            >
              <Icon aria-hidden="true" />
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
