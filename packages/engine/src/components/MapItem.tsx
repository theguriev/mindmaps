import { useState } from 'react'
import { Loader2Icon, NetworkIcon, StarIcon, Trash2Icon } from 'lucide-react'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { fromNow } from '../utils/relativeTime'
import type { MapDoc } from '../mindmap/types'

/** A map with no title still needs something to click on. */
const UNTITLED = 'Untitled map'

export interface MapItemProps {
  map: MapDoc
  /** A visitor who may not write: the row is drawn without its actions. */
  readOnly?: boolean
  /**
   * Renders the "Updated …" timestamp. Only called for a map that has one, so
   * a host that formats dates itself (the WordPress embed uses the site
   * locale) never has to reimplement the missing-timestamp fallback.
   */
  formatModified?: (modified: string) => string
  onGo: (map: MapDoc) => void
  onRemove: (map: MapDoc, done: () => void) => void
  onStar: (map: MapDoc, done: () => void) => void
  onUnstar: (map: MapDoc, done: () => void) => void
}

/**
 * One row of the map list: icon tile, title, status, meta line and actions.
 *
 * The title's hit area is stretched over the whole row (`after:inset-0`), so
 * the row-wide hover highlight is honest — everything it covers opens the map
 * — while the accessibility tree still sees a single button. The action
 * buttons are `relative` so they stay on top of that overlay.
 *
 * The actions are always visible rather than revealed on hover: a hidden-until
 * -hover control is unreachable on a touch screen, and this row carries a
 * destructive one. They are muted at rest instead, so they read as secondary
 * to the title without disappearing.
 */
export function MapItem ({
  map,
  readOnly = false,
  formatModified,
  onGo,
  onRemove,
  onStar,
  onUnstar
}: MapItemProps) {
  const [loading, setLoading] = useState(false)
  const [starLoading, setStarLoading] = useState(false)
  const isTemplate = (map.meta?.template ?? '0')[0] === '1'
  const nodes = map.content.length
  const updated =
    map.modified !== undefined && formatModified !== undefined
      ? formatModified(map.modified)
      : fromNow(map.modified)

  return (
    <li className="border-b border-border last:border-b-0">
      <div className="relative flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-accent focus-within:bg-accent">
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
          aria-hidden="true"
        >
          <NetworkIcon className="size-5" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-w-0 items-center gap-2">
            {/* `block` rather than the button's default `inline-flex`, so the
                title truncates and stays a single text node — the button's
                accessible name is the map's title, nothing else. */}
            <Button
              variant="link"
              className="block h-auto min-w-0 shrink truncate p-0 text-left text-base font-semibold text-foreground after:absolute after:inset-0 after:rounded-lg"
              onClick={() => onGo(map)}
            >
              {map.title || UNTITLED}
            </Button>
            {isTemplate && (
              <Badge variant="outline" className="gap-1.5 text-muted-foreground">
                <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                Template
              </Badge>
            )}
          </div>
          <span className="truncate text-xs text-muted-foreground" title={map.modified}>
            {nodes} {nodes === 1 ? 'node' : 'nodes'} · Updated {updated}
          </span>
        </div>
        {!readOnly && (
          <div className="relative flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              disabled={starLoading}
              aria-label={isTemplate ? 'Make it a map' : 'Make it a template'}
              title={isTemplate ? 'Make it a map' : 'Make it a template'}
              className="text-muted-foreground hover:text-foreground"
              onClick={() => {
                setStarLoading(true)
                ;(isTemplate ? onUnstar : onStar)(map, () => setStarLoading(false))
              }}
            >
              {starLoading ? (
                <Loader2Icon className="animate-spin" />
              ) : (
                <StarIcon className={isTemplate ? 'fill-current' : ''} />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              disabled={loading}
              aria-label="Remove map"
              title="Remove map"
              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              onClick={() => {
                setLoading(true)
                onRemove(map, () => setLoading(false))
              }}
            >
              {loading ? <Loader2Icon className="animate-spin" /> : <Trash2Icon />}
            </Button>
          </div>
        )}
      </div>
    </li>
  )
}
