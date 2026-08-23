import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import {
  MapList,
  builtinTemplate,
  listTemplates,
  prepareTemplate,
  templateFromDoc,
  type MapSummary,
  type TemplateChoice,
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
  const maps = Route.useLoaderData() as MapSummary[]

  // Re-run the route loader after a mutation instead of holding a second copy
  // of the list in component state.
  const reload = () => router.invalidate()

  const templates = listTemplates(maps)

  const go = (map: { id: MapSummary['id'] }) =>
    navigate({ to: '/map/$id', params: { id: String(map.id) } })

  const remove = async (map: MapSummary, done: () => void) => {
    await store.remove([String(map.id)])
    await reload()
    done()
  }

  const setTemplateFlag = async (map: MapSummary, template: boolean, done: () => void) => {
    await store.setTemplate(String(map.id), template)
    await reload()
    done()
  }

  // A choice names a template; only the one that was picked is fetched.
  const resolveTemplate = async (choice: TemplateChoice): Promise<TemplateDoc | null> => {
    if (choice.key !== undefined) return builtinTemplate(choice.key)
    const doc = await store.get(String(choice.id))
    return doc === null ? null : templateFromDoc(doc)
  }

  const chooseTemplate = async (choice: TemplateChoice) => {
    const template = await resolveTemplate(choice)
    if (template === null) return
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
      onStar={(m, done) => setTemplateFlag(m, true, done)}
      onUnstar={(m, done) => setTemplateFlag(m, false, done)}
      onChooseTemplate={chooseTemplate}
    />
  )
}
