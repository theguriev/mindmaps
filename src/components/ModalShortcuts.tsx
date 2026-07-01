import { Modal, Divider, Tag } from '@/ui'

function Row ({ label, keys }: { label: string; keys: string[] }) {
  return (
    <>
      <div className="flex justify-between">
        <div className="left">{label}</div>
        <div className="right">
          {keys.map((k, i) => (
            <Tag key={i}>{k}</Tag>
          ))}
        </div>
      </div>
      <Divider />
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
    <Modal visible={visible} title="Keyboard shortcuts ^⌥H" onClose={onClose}>
      <h3 style={{ fontWeight: 600 }}>Global</h3>
      <Divider />
      <Row label="Save" keys={['^', 'S']} />
      <Row label="Close editing" keys={['⌥', 'Enter']} />
      <Row label="Keyboard shortcuts" keys={['^', '⌥', 'H']} />

      <h3 style={{ fontWeight: 600, marginTop: 24 }}>Zoom</h3>
      <Divider />
      <Row label="Zoom in" keys={['^', 'Wheel up']} />
      <Row label="Zoom out" keys={['^', 'Wheel down']} />

      <h3 style={{ fontWeight: 600, marginTop: 24 }}>Branch controls</h3>
      <Divider />
      <Row label="Remove branch" keys={['⌘', 'Click ( on plus button )']} />

      <h3 style={{ fontWeight: 600, marginTop: 24 }}>Pan</h3>
      <Divider />
      <Row label="Pan up" keys={['⌘', 'Wheel up']} />
      <Row label="Pan down" keys={['⌘', 'Wheel down']} />
      <Row label="Pan left" keys={['⌘', 'Wheel left']} />
      <Row label="Pan right" keys={['⌘', 'Wheel right']} />
    </Modal>
  )
}
