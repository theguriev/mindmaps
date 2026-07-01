import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

function Row ({ label, keys }: { label: string; keys: string[] }) {
  return (
    <>
      <div className="flex items-center justify-between">
        <div>{label}</div>
        <div className="flex gap-1">
          {keys.map((k, i) => (
            <Badge key={i} variant="secondary" className="font-mono">
              {k}
            </Badge>
          ))}
        </div>
      </div>
      <Separator className="my-3" />
    </>
  )
}

function Section ({ title }: { title: string }) {
  return (
    <>
      <h3 className="mt-6 font-semibold first:mt-0">{title}</h3>
      <Separator className="my-3" />
    </>
  )
}

export function ModalShortcuts ({
  visible,
  onClose
}: {
  visible: boolean
  onClose: () => void
}) {
  return (
    <Dialog open={visible} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts ^⌥H</DialogTitle>
        </DialogHeader>

        <div className="text-sm">
          <Section title="Global" />
          <Row label="Save" keys={['^', 'S']} />
          <Row label="Close editing" keys={['⌥', 'Enter']} />
          <Row label="Keyboard shortcuts" keys={['^', '⌥', 'H']} />

          <Section title="Zoom" />
          <Row label="Zoom in" keys={['^', 'Wheel up']} />
          <Row label="Zoom out" keys={['^', 'Wheel down']} />

          <Section title="Branch controls" />
          <Row label="Remove branch" keys={['⌘', 'Click ( on plus button )']} />

          <Section title="Pan" />
          <Row label="Pan up" keys={['⌘', 'Wheel up']} />
          <Row label="Pan down" keys={['⌘', 'Wheel down']} />
          <Row label="Pan left" keys={['⌘', 'Wheel left']} />
          <Row label="Pan right" keys={['⌘', 'Wheel right']} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
