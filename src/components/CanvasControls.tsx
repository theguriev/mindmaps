import {
  MinusIcon,
  PlusIcon,
  MaximizeIcon,
  Undo2Icon,
  Redo2Icon,
  type LucideIcon
} from 'lucide-react'

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
  onClick,
  disabled
}: {
  icon: LucideIcon
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="flex size-9 items-center justify-center rounded-xl text-foreground/80 transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-35 [&_svg]:size-[18px]"
    >
      <Icon />
    </button>
  )
}

const Divider = () => <div className="mx-0.5 h-5 w-px bg-border" />

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
        <CtrlButton icon={MinusIcon} label="Zoom out  −" onClick={onZoomOut} />
        <Divider />
        <button
          type="button"
          title="Zoom to 100%  ⇧0"
          aria-label="Zoom to 100%"
          onClick={onZoom100}
          className="flex h-9 min-w-[3.25rem] items-center justify-center rounded-xl px-1 text-xs font-medium text-foreground/80 tabular-nums transition-colors hover:bg-muted"
        >
          {Math.round(scale * 100)}%
        </button>
        <Divider />
        <CtrlButton icon={PlusIcon} label="Zoom in  +" onClick={onZoomIn} />
        <Divider />
        <CtrlButton icon={MaximizeIcon} label="Zoom to fit  ⇧1" onClick={onZoomFit} />
      </div>
      <div className="flex items-center rounded-2xl border bg-background p-1 shadow-lg">
        <CtrlButton icon={Undo2Icon} label="Undo  ⌘Z" onClick={onUndo} disabled={!canUndo} />
        <Divider />
        <CtrlButton icon={Redo2Icon} label="Redo  ⌘⇧Z" onClick={onRedo} disabled={!canRedo} />
      </div>
    </div>
  )
}
