import { useEffect, useMemo, useRef, useState } from 'react'
import {
  FileQuestionMarkIcon,
  LoaderCircleIcon,
  TriangleAlertIcon
} from 'lucide-react'
import {
  Button,
  MapList,
  listTemplates,
  prepareTemplate,
  type MapDoc,
  type TemplateDoc
} from '@mindmaps/engine'
// Subpath import: the editor is the heavy half of the engine, and importing it
// from its own entry keeps that boundary visible even though this bundle ends
// up as a single file (WordPress enqueues one script).
import { MindMapEditor } from '@mindmaps/engine/editor'
import { createWpStore, type MapStore } from '@mindmaps/storage'
import {
  editingAllowed,
  intlLocale,
  mapIdFromUrl,
  mapUrl,
  type BootConfig
} from './boot'
import { describeStoreError } from './errors'

/** Where an async load is, so loading and failure are always drawn. */
type Loaded<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'failed'; error: unknown }

/**
 * A finished request, tagged with the request it answered.
 *
 * Each load is identified by a key (the map id plus a retry counter). Storing
 * the key alongside the result is what lets the components below show "loading"
 * for a request still in flight without resetting state from inside the effect,
 * and it drops the answer to a request nobody is waiting for any more.
 */
type Answer<T> = { key: string; value: Loaded<T> }

function answerFor<T> (answer: Answer<T> | null, key: string): Loaded<T> {
  return answer?.key === key ? answer.value : { status: 'loading' }
}

function Spinner ({ label }: { label: string }) {
  return (
    <div
      className="flex h-full min-h-40 flex-col items-center justify-center gap-3 p-8 text-muted-foreground"
      role="status"
    >
      <LoaderCircleIcon className="size-6 animate-spin" aria-hidden="true" />
      <span className="text-sm">{label}</span>
    </div>
  )
}

function Failure ({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const notice = describeStoreError(error)
  return (
    <div
      className="flex h-full min-h-40 flex-col items-center justify-center gap-3 p-8 text-center"
      role="alert"
    >
      <TriangleAlertIcon className="size-8 text-destructive" aria-hidden="true" />
      <div className="max-w-md font-medium">{notice.title}</div>
      {notice.detail && (
        <div className="max-w-md text-xs text-muted-foreground">{notice.detail}</div>
      )}
      {notice.retryable && (
        <Button variant="outline" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}

/** Sits below the editor's toolbar, out of the way of its own controls. */
function ReadOnlyBadge () {
  return (
    <div className="absolute top-16 left-3 z-40 rounded-md border bg-background/95 px-2 py-1 text-xs text-muted-foreground shadow-sm">
      Read-only
    </div>
  )
}

function MapView ({
  store,
  id,
  canEdit,
  onBack
}: {
  store: MapStore
  id: string
  canEdit: boolean
  onBack?: () => void
}) {
  const [answer, setAnswer] = useState<Answer<MapDoc | null> | null>(null)
  const [attempt, setAttempt] = useState(0)
  const key = `${id}#${attempt}`

  useEffect(() => {
    let live = true
    store.get(id).then(
      (doc) => {
        if (live) setAnswer({ key, value: { status: 'ready', data: doc } })
      },
      (error: unknown) => {
        if (live) setAnswer({ key, value: { status: 'failed', error } })
      }
    )
    return () => {
      live = false
    }
  }, [store, id, key])

  const state = answerFor(answer, key)

  if (state.status === 'loading') return <Spinner label="Loading mind map…" />
  if (state.status === 'failed') {
    return <Failure error={state.error} onRetry={() => setAttempt((n) => n + 1)} />
  }
  if (state.data === null) {
    return (
      <div className="flex h-full min-h-40 flex-col items-center justify-center gap-3 p-8 text-center">
        <FileQuestionMarkIcon
          className="size-8 text-muted-foreground"
          aria-hidden="true"
        />
        <div className="font-medium">This mind map is not available.</div>
        {onBack && (
          <Button variant="outline" onClick={onBack}>
            Back to maps
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="absolute inset-0">
      <MindMapEditor
        // Key by id so switching maps fully remounts the editor (re-seeds state).
        key={id}
        doc={state.data}
        // `readOnly` makes the editor itself inert — every mutating gesture,
        // shortcut and affordance, not just the save button — so a visitor
        // without `edit_post` cannot reach the store at all. The REST
        // capability checks remain the actual boundary.
        readOnly={!canEdit}
        onSave={async (next) => {
          await store.save(id, next)
        }}
        onBack={onBack}
        className="absolute inset-0"
      />
      {!canEdit && <ReadOnlyBadge />}
    </div>
  )
}

function MapsScreen ({
  store,
  canEdit,
  locale,
  startNew,
  onOpen
}: {
  store: MapStore
  canEdit: boolean
  locale?: string
  startNew?: boolean
  onOpen: (id: string) => void
}) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [answer, setAnswer] = useState<Answer<MapDoc[]> | null>(null)
  const [attempt, setAttempt] = useState(0)
  // A failed mutation must not vanish: the list's own controls hand back a
  // callback rather than a promise, so a rejection here has nowhere else to go.
  const [actionError, setActionError] = useState<unknown>(null)
  const key = `list#${attempt}`

  useEffect(() => {
    let live = true
    store.list().then(
      (maps) => {
        if (live) setAnswer({ key, value: { status: 'ready', data: maps } })
      },
      (error: unknown) => {
        if (live) setAnswer({ key, value: { status: 'failed', error } })
      }
    )
    return () => {
      live = false
    }
  }, [store, key])

  // There is no route loader to invalidate here, so a mutation re-runs the
  // effect instead of keeping a second copy of the list in component state.
  const reload = () => setAttempt((n) => n + 1)

  const state = answerFor(answer, key)

  if (state.status === 'loading') return <Spinner label="Loading mind maps…" />
  if (state.status === 'failed') {
    return <Failure error={state.error} onRetry={reload} />
  }

  const maps = state.data
  const templates = listTemplates(maps)

  const go = (map: MapDoc) => onOpen(String(map.id))

  /**
   * Runs a mutation, surfacing its failure instead of dropping the rejection.
   *
   * The list is re-read either way. A mutation that failed is exactly when the
   * list on screen is least trustworthy — somebody else may have deleted or
   * renamed the map this one tripped over — so refreshing it is part of
   * reporting the failure, not part of the success path.
   */
  const act = async (work: () => Promise<void>, done?: () => void) => {
    setActionError(null)
    try {
      await work()
    } catch (error) {
      setActionError(error)
    } finally {
      reload()
      done?.()
    }
  }

  const remove = (map: MapDoc, done: () => void) =>
    act(async () => {
      await store.remove([String(map.id)])
    }, done)

  const setTemplateFlag = (map: MapDoc, template: string, done: () => void) =>
    act(async () => {
      await store.save(String(map.id), { ...map, meta: { template } })
    }, done)

  const chooseTemplate = (template: TemplateDoc) =>
    act(async () => {
      // A new map is centred on the box the embed occupies, which is what the
      // editor will show a moment later.
      const el = rootRef.current
      const w = el?.offsetWidth ?? 960
      const h = el?.offsetHeight ?? 600
      const doc = await store.create(
        prepareTemplate(template, { centerX: w / 2, centerY: h / 2 }, maps.length + 1)
      )
      onOpen(String(doc.id))
    })

  return (
    <MapList
      ref={rootRef}
      maps={maps}
      templates={templates}
      // A visitor without `edit_posts` gets a list with no write affordances at
      // all: every mutation behind them would 403 at the REST boundary.
      readOnly={!canEdit}
      // Arriving from the admin bar's "+ New → Mind Map".
      startNew={startNew}
      // The embed sits on somebody's site, where an absolute date in the site's
      // own locale reads better than "8 minutes ago".
      formatModified={(modified) => new Date(modified).toLocaleString(locale)}
      notice={
        actionError !== null && (
          <div
            className="mt-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
            role="alert"
          >
            {describeStoreError(actionError).title}
          </div>
        )
      }
      onGo={go}
      onRemove={remove}
      onStar={(m, done) => setTemplateFlag(m, '1', done)}
      onUnstar={(m, done) => setTemplateFlag(m, '0', done)}
      onChooseTemplate={chooseTemplate}
    />
  )
}

/**
 * The embed's two states, and which of them the URL is allowed to name.
 *
 * A mount inside somebody else's post owns no URL — that address belongs to the
 * post — so the open map is component state, seeded from `data-map-id`. The
 * admin screen is the opposite: it *is* the page, so it passes `mapParam` and
 * the open map lives in that query parameter, exactly as `post.php?post=1`
 * names a post. Reloading, sharing the link and the browser's back button then
 * all land where the address says.
 *
 * `canEdit` arrives per mount too (`main.tsx` resolves it from the mount
 * point's `data-can-edit`): one page can carry a map the visitor owns next to
 * somebody else's, so a page-wide answer would be wrong for one of them.
 */
export function App ({
  boot,
  mapId,
  canEdit,
  mapParam,
  startNew
}: {
  boot: BootConfig
  mapId?: string
  canEdit?: boolean
  mapParam?: string
  startNew?: boolean
}) {
  const store = useMemo(
    () => createWpStore({ root: boot.root, nonce: boot.nonce }),
    [boot.root, boot.nonce]
  )
  const mayEdit = canEdit ?? editingAllowed(boot)
  const locale = intlLocale(boot)

  const [openId, setOpenId] = useState<string | undefined>(mapId)

  // Routed mounts always have a list to go back to; a pinned embed does not.
  const routed = mapParam !== undefined
  const pinned = !routed && mapId !== undefined

  // The address bar and the open map are one thing seen twice: `show` writes
  // the map into the URL, and Back/Forward write it back into state.
  const show = (next: string | undefined) => {
    setOpenId(next)
    if (!routed) return
    window.history.pushState(
      { mindMaps: next ?? null },
      '',
      mapUrl(window.location.href, mapParam, next)
    )
  }

  useEffect(() => {
    if (!routed) return
    const onPopState = () => {
      setOpenId(mapIdFromUrl(window.location.href, mapParam))
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [routed, mapParam])

  if (openId !== undefined) {
    return (
      <MapView
        store={store}
        id={openId}
        canEdit={mayEdit}
        onBack={pinned ? undefined : () => show(undefined)}
      />
    )
  }

  return (
    // `show`, not `setOpenId`: opening a map from the list has to move the URL
    // too when this mount owns it.
    <MapsScreen
      store={store}
      canEdit={mayEdit}
      locale={locale}
      startNew={startNew}
      onOpen={show}
    />
  )
}
