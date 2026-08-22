import { useState } from 'react'
import { LoaderCircleIcon, StarIcon, Trash2Icon } from 'lucide-react'
import { MapThumb } from './MapThumb'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'
import { cn } from '../lib/utils'
import { fromNow } from '../utils/relativeTime'
import type { MapSummary } from '../mindmap/types'

/** A map with no title still needs something to click on. */
const UNTITLED = 'Untitled map'

export interface MapItemProps {
  map: MapSummary
  /** A visitor who may not write: the row is drawn without its actions. */
  readOnly?: boolean
  /**
   * Renders the "Updated …" timestamp. Only called for a map that has one, so
   * a host that formats dates itself (the WordPress embed uses the site
   * locale) never has to reimplement the missing-timestamp fallback.
   */
  formatModified?: (modified: string) => string
  onGo: (map: MapSummary) => void
  onRemove: (map: MapSummary, done: () => void) => void
  onStar: (map: MapSummary, done: () => void) => void
  onUnstar: (map: MapSummary, done: () => void) => void
}

/**
 * One row of the map list: thumbnail, title, status, meta line and actions.
 *
 * The title's hit area is stretched over the whole row (`after:inset-0`), so
 * the row-wide hover highlight is honest — everything it covers opens the map
 * — while the accessibility tree still sees a single button. The action
 * buttons are `relative` so they stay on top of that overlay.
 *
 * The actions fade in with the row: at rest the list is titles and dates, and
 * only the row under the cursor offers anything to press. Hover is not the only
 * way in, because a hidden-until-hover control is unreachable otherwise — the
 * keyboard brings them back through `focus-within`, a touch screen never hides
 * them (`pointer-coarse`), and one already working stays visible even if the
 * cursor wanders off mid-request.
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
  const starLabel = isTemplate ? 'Make it a map' : 'Make it a template'
  const nodes = map.nodes
  const updated =
    map.modified !== undefined && formatModified !== undefined
      ? formatModified(map.modified)
      : fromNow(map.modified)

  return (
    <li
      className={cn(
        'border-b border-border last:border-b-0',
        // The highlight is a rounded pill inset in the row, so the hairlines
        // that separate the rows end up framing it: one along its bottom, and
        // the row above's along its top. Both step aside while a row is hovered
        // or holds focus — the colour goes, not the width, so nothing shifts.
        // A row cannot see the divider its predecessor draws, hence `:has()`.
        'hover:border-transparent focus-within:border-transparent',
        '[&:has(+li:hover)]:border-transparent',
        '[&:has(+li:focus-within)]:border-transparent'
      )}
    >
      <div className="group relative flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-accent focus-within:bg-accent">
        <MapThumb preview={map.preview} />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-w-0 items-center gap-2">
            {/* `block` rather than the button's default `inline-flex`, so the
                title truncates and stays a single text node — the button's
                accessible name is the map's title, nothing else.

                `hover:no-underline` because the hit area is the whole row: the
                link variant's underline would appear with the cursor anywhere
                in it, including over the timestamp and the actions. The row's
                own highlight is the hover affordance, and it covers the same
                ground the click does. */}
            <Button
              variant="link"
              className="block h-auto min-w-0 shrink truncate p-0 text-left text-base font-semibold text-foreground hover:no-underline after:absolute after:inset-0 after:rounded-lg"
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
          <div
            className={cn(
              'relative flex shrink-0 items-center gap-1 transition-opacity',
              'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
              // A coarse pointer has no hover to reveal them with.
              'pointer-coarse:opacity-100',
              // Losing sight of a request already in flight would read as the
              // row having done nothing.
              (loading || starLoading) && 'opacity-100'
            )}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={starLoading}
                  // The name must not depend on the tooltip being open.
                  aria-label={starLabel}
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setStarLoading(true)
                    ;(isTemplate ? onUnstar : onStar)(map, () => setStarLoading(false))
                  }}
                >
                  {starLoading ? (
                    <LoaderCircleIcon className="animate-spin" />
                  ) : (
                    <StarIcon className={isTemplate ? 'fill-current' : ''} />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{starLabel}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={loading}
                  aria-label="Remove map"
                  className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => {
                    setLoading(true)
                    onRemove(map, () => setLoading(false))
                  }}
                >
                  {loading ? <LoaderCircleIcon className="animate-spin" /> : <Trash2Icon />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Remove map</TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
    </li>
  )
}
