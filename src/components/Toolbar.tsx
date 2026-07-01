import type { ReactNode } from 'react'

export function Toolbar ({ left, right }: { left?: ReactNode; right?: ReactNode }) {
  return (
    <div id="toolbar">
      <div className="left">{left}</div>
      <div className="right">{right}</div>
    </div>
  )
}
