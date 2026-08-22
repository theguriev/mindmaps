import type { ReactNode } from 'react'
import { cn } from '../lib/utils'

/**
 * A floating group of controls over the canvas.
 *
 * The editor has no chrome of its own: the map owns the whole surface and the
 * controls sit on top of it in islands like this one, which is what keeps an
 * embed from spending a fixed strip of somebody's page on a title bar. The
 * canvas is interactive underneath, so an island claims pointer events only
 * for itself — its container is free to be `pointer-events-none`.
 */
export function Island ({
  className,
  children
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'pointer-events-auto flex items-center rounded-2xl border bg-background p-1 shadow-lg select-none',
        className
      )}
    >
      {children}
    </div>
  )
}
