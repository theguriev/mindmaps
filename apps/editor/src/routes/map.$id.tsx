import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import type { MapDoc } from '@mindmaps/engine'
// Subpath import: keeps the editor in this route's own chunk.
import { MindMapEditor } from '@mindmaps/engine/editor'
import { store } from '../store'

export const Route = createFileRoute('/map/$id')({
  // The store is async (localStorage today, a REST backend elsewhere), so the
  // document is loaded before the editor renders instead of during it.
  loader: async ({ params }) => {
    const doc = await store.get(params.id)
    if (!doc) throw redirect({ to: '/' })
    return doc
  },
  component: MapRoute
})

function MapRoute () {
  const { id } = Route.useParams()
  const doc = Route.useLoaderData() as MapDoc
  const navigate = useNavigate()

  return (
    // Key by id so switching maps fully remounts the editor (re-seeds state).
    <MindMapEditor
      key={id}
      doc={doc}
      onSave={async (next) => {
        await store.save(id, next)
      }}
      onBack={() => navigate({ to: '/' })}
    />
  )
}
