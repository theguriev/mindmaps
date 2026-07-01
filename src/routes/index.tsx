import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover'
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
    <div>
      <div className="mx-auto mt-6 mb-24 w-[960px] max-w-[calc(100vw-2rem)]">
        <div className="flex items-center">
          <span className="mr-3 text-5xl">🧠</span>
          <h1 className="text-5xl font-bold">Mind maps</h1>
        </div>
        <Separator className="my-4" />
        <div className="flex gap-2">
          <Input
            className="flex-1"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Find a map..."
          />
          <Popover>
            <PopoverTrigger asChild>
              <Button>New</Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-3" align="end">
              <Templates templates={templates} onChoose={chooseTemplate} />
            </PopoverContent>
          </Popover>
        </div>
        <Separator className="my-4" />
        {maps.length > 0 ? (
          <div className="flex flex-col">
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
          <div className="py-10 text-center text-muted-foreground">
            <div className="text-4xl opacity-50">🗂️</div>
            <div>No maps yet — create one!</div>
          </div>
        )}
      </div>
      <FooterLogo />
    </div>
  )
}
