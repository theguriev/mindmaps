import { LOGO_DATA_URL } from '../assets/logo'
import { cn } from '../lib/utils'

/**
 * The product mark.
 *
 * It is a raster with its own gradient rather than a lucide glyph, so it is
 * deliberately not tinted by `currentColor` — the colours are the brand's, not
 * the theme's. Everything else in the UI is a lucide icon.
 */
export function Logo ({
  className,
  alt = 'Mind maps'
}: {
  className?: string
  /** Empty when a heading beside it already names the product. */
  alt?: string
}) {
  return (
    <img
      src={LOGO_DATA_URL}
      alt={alt}
      aria-hidden={alt === '' ? true : undefined}
      className={cn('size-8 shrink-0 select-none', className)}
      draggable={false}
    />
  )
}
