import { useState } from 'react'
import { Button, Divider } from '@/ui'
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
    <div className="map-item">
      <div className="row">
        <div className="flex flex-column">
          <Button variant="link" className="title-btn" onClick={() => onGo(map)}>
            {map.title}
          </Button>
          <span className="updated" title={map.modified}>
            Updated {fromNow(map.modified)}
          </span>
        </div>
        <div className="actions">
          {isTemplate ? (
            <Button
              loading={starLoading}
              title="Make it map"
              onClick={() => {
                setStarLoading(true)
                onUnstar(map, () => setStarLoading(false))
              }}
            >
              ★ Unstar
            </Button>
          ) : (
            <Button
              loading={starLoading}
              title="Make it template"
              onClick={() => {
                setStarLoading(true)
                onStar(map, () => setStarLoading(false))
              }}
            >
              ☆ Star
            </Button>
          )}
          <Button
            variant="danger"
            ghost
            loading={loading}
            title="Remove map"
            onClick={() => {
              setLoading(true)
              onRemove(map, () => setLoading(false))
            }}
          >
            Remove
          </Button>
        </div>
      </div>
      <Divider />
    </div>
  )
}
