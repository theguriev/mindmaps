import type { ReactNode } from 'react'

export function Toolbar ({ left, right }: { left?: ReactNode; right?: ReactNode }) {
  return (
    <div className="relative z-30 flex h-14 items-center justify-between border-b bg-background px-2">
      <div className="flex items-center gap-2">{left}</div>
      <div className="flex items-center gap-1">{right}</div>
    </div>
  )
}
