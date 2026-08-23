import { NetworkIcon } from 'lucide-react'
import {
  PREVIEW_DOT_WIDTH,
  PREVIEW_EDGE_WIDTH,
  PREVIEW_PADDING,
  PREVIEW_ROOT_WIDTH,
  PREVIEW_SPAN,
  previewPaths,
  type MapPreview
} from '../mindmap/preview'
import { cn } from '../lib/utils'

/**
 * A map's shape, at the size of a list row's tile.
 *
 * The drawing is three paths — branches, nodes, roots — rather than an element
 * per node, so a full list is a few hundred elements instead of tens of
 * thousands. It is all `currentColor`: the stored branch colours are picked
 * against the canvas's white background and a row is not that, and eight hues
 * in hairlines this thin read as confetti rather than as information. Taking
 * the colour from the row means the tile also dims and lifts with it for free.
 *
 * Falls back to the generic mark whenever there is no preview to draw — a map
 * with no nodes yet, or one whose preview did not survive the trip. A row must
 * never be worth less than its thumbnail.
 */
export function MapThumb ({
  preview,
  className
}: {
  preview: MapPreview | null | undefined
  className?: string
}) {
  const tile = cn(
    'flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground',
    className
  )

  if (preview === null || preview === undefined) {
    return (
      <div className={tile} aria-hidden="true">
        <NetworkIcon className="size-5" />
      </div>
    )
  }

  const { edges, dots, roots } = previewPaths(preview)
  const pad = PREVIEW_PADDING
  const side = PREVIEW_SPAN + 2 * pad

  return (
    <div className={tile} aria-hidden="true">
      <svg
        className="size-8"
        // A fixed square box rather than one cut to this map's extent, with the
        // drawing centred in it. Letting the box shrink would scale the marks
        // with it: every row would draw its dots at a different size, and a map
        // of one node — no extent at all — would fill its tile with a single
        // blob. The projection already normalizes the long side to the span, so
        // one box fits every map and the whole list shares a scale.
        viewBox={`${-pad} ${-pad} ${side} ${side}`}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <g
          transform={`translate(${(PREVIEW_SPAN - preview.width) / 2} ${(PREVIEW_SPAN - preview.height) / 2})`}
        >
          <path d={edges} strokeWidth={PREVIEW_EDGE_WIDTH} opacity={0.55} />
          <path d={dots} strokeWidth={PREVIEW_DOT_WIDTH} opacity={0.85} />
          <path d={roots} strokeWidth={PREVIEW_ROOT_WIDTH} />
        </g>
      </svg>
    </div>
  )
}
