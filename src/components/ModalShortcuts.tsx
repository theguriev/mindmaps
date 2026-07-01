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
          <DialogTitle>Keyboard shortcuts ⌃⇧?</DialogTitle>
        </DialogHeader>

        <div className="text-sm">
          <Section title="Global" />
          <Row label="Save" keys={['⌘', 'S']} />
          <Row label="Export PNG" keys={['⌘', '⇧', 'E']} />
          <Row label="Exit editing" keys={['Esc']} />
          <Row label="Keyboard shortcuts" keys={['⌃', '⇧', '?']} />

          <Section title="Zoom & Pan" />
          <Row label="Zoom in / out" keys={['+', '−']} />
          <Row label="Zoom to 100%" keys={['⇧', '0']} />
          <Row label="Zoom to fit" keys={['⇧', '1']} />
          <Row label="Zoom" keys={['⌘', 'Scroll']} />
          <Row label="Pan" keys={['Scroll']} />
          <Row label="Pan horizontally" keys={['⇧', 'Scroll']} />
          <Row label="Pan (hold)" keys={['Space', 'Drag']} />
          <Row label="Pan" keys={['Drag empty area']} />

          <Section title="Branch controls" />
          <Row label="Add child" keys={['Click', '⊕']} />
          <Row label="Remove branch" keys={['⌘', 'Click', '⊕']} />

          <Section title="Text formatting" />
          <Row label="Bold" keys={['⌘', 'B']} />
          <Row label="Italic" keys={['⌘', 'I']} />
          <Row label="Strikethrough" keys={['⌘', '⇧', 'X']} />
          <Row label="Code" keys={['⌘', '⇧', 'C']} />
          <Row label="Link" keys={['⌘', '⇧', 'U']} />
          <Row label="Ordered list" keys={['⌘', '⇧', '7']} />
          <Row label="Bulleted list" keys={['⌘', '⇧', '8']} />
          <Row label="Blockquote" keys={['⌘', '⇧', '9']} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
