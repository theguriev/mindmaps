import { useState } from 'react'
import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import {
  Button,
  Input,
  MapItem,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Separator,
  Templates,
  listTemplates,
  prepareTemplate,
  type MapDoc,
  type TemplateDoc
} from '@mindmaps/engine'
import { store } from '../store'

export const Route = createFileRoute('/')({
  loader: () => store.list(),
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
  const router = useRouter()
  const maps = Route.useLoaderData() as MapDoc[]
  const [filterText, setFilterText] = useState('')

  // Re-run the route loader after a mutation instead of holding a second copy
  // of the list in component state.
  const reload = () => router.invalidate()

  const needle = filterText.toLocaleLowerCase()
  const filteredMaps = maps.filter((el) =>
    (el.title ?? '').toLocaleLowerCase().includes(needle)
  )

  const templates = listTemplates(maps)

  const go = (map: MapDoc) =>
    navigate({ to: '/map/$id', params: { id: String(map.id) } })

  const remove = async (map: MapDoc, done: () => void) => {
    await store.remove([String(map.id)])
    await reload()
    done()
  }

  const setTemplateFlag = async (map: MapDoc, template: string, done: () => void) => {
    await store.save(String(map.id), { ...map, meta: { template } })
    await reload()
    done()
  }

  const chooseTemplate = async (template: TemplateDoc) => {
    const { centerX, centerY } = center()
    const doc = await store.create(
      prepareTemplate(template, { centerX, centerY }, maps.length + 1)
    )
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
                onStar={(m, done) => setTemplateFlag(m, '1', done)}
                onUnstar={(m, done) => setTemplateFlag(m, '0', done)}
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
    </div>
  )
}
