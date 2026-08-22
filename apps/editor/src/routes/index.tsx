import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import {
  MapList,
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

  // Re-run the route loader after a mutation instead of holding a second copy
  // of the list in component state.
  const reload = () => router.invalidate()

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
    <MapList
      maps={maps}
      templates={templates}
      onGo={go}
      onRemove={remove}
      onStar={(m, done) => setTemplateFlag(m, '1', done)}
      onUnstar={(m, done) => setTemplateFlag(m, '0', done)}
      onChooseTemplate={chooseTemplate}
    />
  )
}
