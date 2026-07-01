import {
  MinusIcon,
  PlusIcon,
  Undo2Icon,
  Redo2Icon,
  type LucideIcon
} from 'lucide-react'

interface CanvasControlsProps {
  onZoomOut: () => void
  onZoomIn: () => void
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

/** Floating bottom-right controls: zoom (− / +) and history (undo / redo). */
export function CanvasControls ({
  onZoomOut,
  onZoomIn,
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
        <CtrlButton icon={PlusIcon} label="Zoom in  +" onClick={onZoomIn} />
      </div>
      <div className="flex items-center rounded-2xl border bg-background p-1 shadow-lg">
        <CtrlButton icon={Undo2Icon} label="Undo  ⌘Z" onClick={onUndo} disabled={!canUndo} />
        <Divider />
        <CtrlButton icon={Redo2Icon} label="Redo  ⌘⇧Z" onClick={onRedo} disabled={!canRedo} />
      </div>
    </div>
  )
}
