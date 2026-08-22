import {
  MinusIcon,
  PlusIcon,
  MaximizeIcon,
  Undo2Icon,
  Redo2Icon,
  type LucideIcon
} from 'lucide-react'
import { Button } from './ui/button'
import { Separator } from './ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from './ui/tooltip'

interface CanvasControlsProps {
  scale: number
  onZoomOut: () => void
  onZoomIn: () => void
  onZoom100: () => void
  onZoomFit: () => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
}

function CtrlButton ({
  icon: Icon,
  label,
  keys,
  onClick,
  disabled
}: {
  icon: LucideIcon
  label: string
  keys: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          // The name must not depend on the tooltip being open.
          aria-label={label}
          onClick={onClick}
          disabled={disabled}
          className="rounded-xl text-foreground/80 hover:bg-muted hover:text-foreground/80 disabled:opacity-35"
        >
          <Icon className="size-[18px]" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {label} — <b>{keys}</b>
      </TooltipContent>
    </Tooltip>
  )
}

/** The bar sizes itself from its buttons, so the rule cannot inherit a height
 *  from the row and needs an explicit one. */
const Divider = () => (
  <Separator
    orientation="vertical"
    className="mx-0.5 data-[orientation=vertical]:h-5"
  />
)

/** Floating bottom-right controls: zoom (− / % / + / fit) and history. */
export function CanvasControls ({
  scale,
  onZoomOut,
  onZoomIn,
  onZoom100,
  onZoomFit,
  onUndo,
  onRedo,
  canUndo,
  canRedo
}: CanvasControlsProps) {
  return (
    <div className="absolute right-4 bottom-4 z-10 flex items-center gap-3 select-none">
      <div className="flex items-center rounded-2xl border bg-background p-1 shadow-lg">
        <CtrlButton icon={MinusIcon} label="Zoom out" keys="−" onClick={onZoomOut} />
        <Divider />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              aria-label="Zoom to 100%"
              onClick={onZoom100}
              className="h-9 min-w-[3.25rem] rounded-xl px-1 text-xs text-foreground/80 tabular-nums hover:bg-muted hover:text-foreground/80"
            >
              {Math.round(scale * 100)}%
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Zoom to 100% — <b>⇧0</b>
          </TooltipContent>
        </Tooltip>
        <Divider />
        <CtrlButton icon={PlusIcon} label="Zoom in" keys="+" onClick={onZoomIn} />
        <Divider />
        <CtrlButton icon={MaximizeIcon} label="Zoom to fit" keys="⇧1" onClick={onZoomFit} />
      </div>
      <div className="flex items-center rounded-2xl border bg-background p-1 shadow-lg">
        <CtrlButton
          icon={Undo2Icon}
          label="Undo"
          keys="⌘Z"
          onClick={onUndo}
          disabled={!canUndo}
        />
        <Divider />
        <CtrlButton
          icon={Redo2Icon}
          label="Redo"
          keys="⌘⇧Z"
          onClick={onRedo}
          disabled={!canRedo}
        />
      </div>
    </div>
  )
}
