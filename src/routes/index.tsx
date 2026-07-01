import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Button, Divider, Empty, Input, Popover } from '@/ui'
import { MapItem } from '@/components/MapItem'
import { Templates } from '@/components/Templates'
import { FooterLogo } from '@/components/FooterLogo'
import { listTemplates, prepareTemplate, type TemplateDoc } from '@/templates'
import { addMap, allMaps, delMaps, saveMap } from '@/api/maps'
import type { MapDoc } from '@/mindmap/types'

export const Route = createFileRoute('/')({
  component: Home
})

function center () {
  const el = document.getElementById('mmb')
  const w = el?.offsetWidth ?? window.innerWidth
  const h = el?.offsetHeight ?? window.innerHeight
  return { w, h, centerX: w / 2, centerY: h / 2 }
}

function Home () {
  const navigate = useNavigate()
  const [maps, setMaps] = useState<MapDoc[]>([])
  const [filterText, setFilterText] = useState('')

  const reload = () => setMaps(allMaps())
  useEffect(reload, [])

  const filteredMaps = maps.filter(
    (el) =>
      (el.title ?? '')
        .toLocaleLowerCase()
        .indexOf(filterText.toLocaleLowerCase()) > -1
  )

  const templates = listTemplates(maps)

  const go = (map: MapDoc) =>
    navigate({ to: '/map/$id', params: { id: String(map.id) } })

  const remove = (map: MapDoc, done: () => void) => {
    delMaps([map.id])
    reload()
    done()
  }

  const star = (map: MapDoc, done: () => void) => {
    saveMap(map.id, { ...map, meta: { template: '1' } })
    reload()
    done()
  }

  const unstar = (map: MapDoc, done: () => void) => {
    saveMap(map.id, { ...map, meta: { template: '0' } })
    reload()
    done()
  }

  const chooseTemplate = (template: TemplateDoc) => {
    const { centerX, centerY } = center()
    const doc = addMap(prepareTemplate(template, { centerX, centerY }, maps.length + 1))
    go(doc)
  }

  return (
    <div className="home">
      <div className="content">
        <div className="flex items-center">
          <span style={{ fontSize: 48, marginRight: 12 }}>🧠</span>
          <h1>Mind maps</h1>
        </div>
        <Divider />
        <div className="flex">
          <Input
            value={filterText}
            onChange={setFilterText}
            placeholder="Find a map..."
          />
          <Popover
            content={<Templates templates={templates} onChoose={chooseTemplate} />}
          >
            <Button variant="primary" className="ml2">
              New
            </Button>
          </Popover>
        </div>
        <Divider />
        {maps.length > 0 ? (
          <div className="maps">
            {filteredMaps.map((map) => (
              <MapItem
                key={String(map.id)}
                map={map}
                onGo={go}
                onRemove={remove}
                onStar={star}
                onUnstar={unstar}
              />
            ))}
          </div>
        ) : (
          <Empty description="No maps yet — create one!" />
        )}
      </div>
      <FooterLogo />
    </div>
  )
}
