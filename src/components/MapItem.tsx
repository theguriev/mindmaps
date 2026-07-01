import { useState } from 'react'
import { Loader2Icon, StarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { fromNow } from '@/utils/relativeTime'
import type { MapDoc } from '@/mindmap/types'

export function MapItem ({
  map,
  onGo,
  onRemove,
  onStar,
  onUnstar
}: {
  map: MapDoc
  onGo: (map: MapDoc) => void
  onRemove: (map: MapDoc, done: () => void) => void
  onStar: (map: MapDoc, done: () => void) => void
  onUnstar: (map: MapDoc, done: () => void) => void
}) {
  const [loading, setLoading] = useState(false)
  const [starLoading, setStarLoading] = useState(false)
  const isTemplate = (map.meta?.template ?? '0')[0] === '1'

  return (
    <div className="flex flex-col">
      <div className="flex items-start justify-between">
        <div className="flex flex-col items-start">
          <Button
            variant="link"
            className="h-auto p-0 text-xl"
            onClick={() => onGo(map)}
          >
            {map.title}
          </Button>
          <span className="text-xs text-muted-foreground" title={map.modified}>
            Updated {fromNow(map.modified)}
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={starLoading}
            title={isTemplate ? 'Make it a map' : 'Make it a template'}
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
            {isTemplate ? 'Unstar' : 'Star'}
          </Button>
          <Button
            variant="ghost"
            disabled={loading}
            title="Remove map"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => {
              setLoading(true)
              onRemove(map, () => setLoading(false))
            }}
          >
            {loading && <Loader2Icon className="animate-spin" />}
            Remove
          </Button>
        </div>
      </div>
      <Separator className="my-4" />
    </div>
  )
}
