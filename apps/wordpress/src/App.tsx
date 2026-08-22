import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  FileQuestionMarkIcon,
  LoaderCircleIcon,
  TriangleAlertIcon
} from 'lucide-react'
import {
  Button,
  MapList,
  blankTemplate,
  builtinTemplate,
  listTemplates,
  prepareTemplate,
  templateFromDoc,
  type MapDoc,
  type MapSummary,
  type MenuCommand,
  type TemplateChoice
} from '@mindmaps/engine'
// Subpath import: the editor is the heavy half of the engine, and importing it
// from its own entry keeps that boundary visible even though this bundle ends
// up as a single file (WordPress enqueues one script).
import { MindMapEditor } from '@mindmaps/engine/editor'
import { createWpStore, type MapStore } from '@mindmaps/storage'
import {
  NEW_QUERY_PARAM,
  editingAllowed,
  intlLocale,
  mapIdFromUrl,
  mapUrl,
  withoutParam,
  type BootConfig
} from './boot'
import { describeStoreError } from './errors'
import { commandName, commandStore, registerCommands } from './commands'

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

/** The one free corner: the editor's own islands hold the other three. */
function ReadOnlyBadge () {
  return (
    <div className="absolute bottom-4 left-4 z-20 rounded-2xl border bg-background px-3 py-1.5 text-xs text-muted-foreground shadow-lg select-none">
      Read-only
    </div>
  )
}

/**
 * Hands the editor's commands to WordPress's palette, where there is one.
 *
 * Returns the props to spread onto the editor: `onCommands` in the admin,
 * nothing on the front end — and "nothing" is what leaves the editor's own ⌘K
 * palette in place, which is the only palette a shortcode embed has.
 *
 * The registration is keyed on which commands exist, not on the array the
 * editor hands over: that is rebuilt every render, and re-registering forty
 * commands per keystroke to change nothing is not a trade worth making. What
 * the palette actually calls goes through the ref, so a command registered
 * once still runs the current version of itself.
 */
function useWordPressCommands (): { onCommands?: (commands: MenuCommand[]) => void } {
  const store = useMemo(() => commandStore(), [])
  const latest = useRef<MenuCommand[]>([])
  const [names, setNames] = useState<string[]>([])

  const onCommands = useCallback((commands: MenuCommand[]) => {
    latest.current = commands
    const next = commands.map(commandName)
    setNames((prev) =>
      prev.length === next.length && prev.every((name, i) => name === next[i]) ? prev : next
    )
  }, [])

  useEffect(() => {
    if (store === null || names.length === 0) return
    return registerCommands(store, names, () => latest.current)
  }, [store, names])

  return store === null ? {} : { onCommands }
}

function MapView ({
  store,
  id,
  canEdit,
  controls,
  onBack
}: {
  store: MapStore
  id: string
  canEdit: boolean
  controls: boolean
  onBack?: () => void
}) {
  const wordPressCommands = useWordPressCommands()
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
        // An embed asked to show the map and nothing else has no zoom control,
        // so it has to arrive framed on the whole thing rather than at 100% on
        // wherever the root sits.
        controls={controls}
        fitOnMount={!controls}
        {...wordPressCommands}
        className="absolute inset-0"
      />
      {/* Nothing to say on an embed with no controls: there is nothing there
          to edit with, so "read-only" is answering a question nobody asked. */}
      {!canEdit && controls && <ReadOnlyBadge />}
    </div>
  )
}

function MapsScreen ({
  store,
  canEdit,
  locale,
  onOpen
}: {
  store: MapStore
  canEdit: boolean
  locale?: string
  onOpen: (id: string) => void
}) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [answer, setAnswer] = useState<Answer<MapSummary[]> | null>(null)
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

  const go = (map: MapSummary) => onOpen(String(map.id))

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

  const remove = (map: MapSummary, done: () => void) =>
    act(async () => {
      await store.remove([String(map.id)])
    }, done)

  const setTemplateFlag = (map: MapSummary, template: boolean, done: () => void) =>
    act(async () => {
      await store.setTemplate(String(map.id), template)
    }, done)

  const chooseTemplate = (choice: TemplateChoice) =>
    act(async () => {
      // A choice names a template rather than carrying one, so the content of
      // a starred map is fetched here — when somebody picks it — and not for
      // every row of a list nobody may pick from.
      const template =
        choice.key !== undefined
          ? builtinTemplate(choice.key)
          : await store.get(String(choice.id)).then((doc) => (doc === null ? null : templateFromDoc(doc)))
      if (template === null) return

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
      onStar={(m, done) => setTemplateFlag(m, true, done)}
      onUnstar={(m, done) => setTemplateFlag(m, false, done)}
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
  startNew,
  controls = true,
  container
}: {
  boot: BootConfig
  mapId?: string
  canEdit?: boolean
  mapParam?: string
  startNew?: boolean
  /** `false` on an embed that wants the map and nothing over it. */
  controls?: boolean
  /** The mount box, so a map created on arrival is centred in it. */
  container?: HTMLElement | null
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

  // ---- "+ New → Mind Map" ----
  // The admin bar asked for a map, so make one and open it. The write is still
  // a REST call with its nonce — the link that got us here is a plain GET, and
  // a GET a browser may prefetch must not create anything by itself.
  const [createAttempt, setCreateAttempt] = useState(0)
  // Once per attempt: React's development double-mount would otherwise create
  // two maps, and so would anything else that re-runs this effect.
  const createdForRef = useRef(-1)
  const [creating, setCreating] = useState(startNew === true && mayEdit)
  const [createError, setCreateError] = useState<unknown>(null)

  useEffect(() => {
    if (startNew !== true || !mayEdit) return
    if (createdForRef.current === createAttempt) return
    createdForRef.current = createAttempt

    let live = true
    // Named and placed the way the picker would have done it: the list decides
    // the `{index}` in the template's title, and the mount box decides where
    // the root node sits.
    const box = container?.getBoundingClientRect()
    const centre = {
      centerX: (box?.width ?? 960) / 2,
      centerY: (box?.height ?? 600) / 2
    }
    store
      .list()
      .then((maps) =>
        store.create(prepareTemplate(blankTemplate(), centre, maps.length + 1))
      )
      .then(
        (doc) => {
          if (!live) return
          setCreating(false)
          setOpenId(String(doc.id))
          // `replace`, not `push`: the address that created this map must not
          // stay in history, or Back — and a reload — would create another.
          if (routed) {
            window.history.replaceState(
              { mindMaps: String(doc.id) },
              '',
              // The marker goes too: it is spent, and a reload that kept it
              // would create a second map.
              withoutParam(
                mapUrl(window.location.href, mapParam, String(doc.id)),
                NEW_QUERY_PARAM
              )
            )
          }
        },
        (error: unknown) => {
          if (!live) return
          setCreating(false)
          setCreateError(error)
        }
      )
    return () => {
      live = false
    }
  }, [startNew, mayEdit, store, routed, mapParam, createAttempt, container])

  if (creating) return <Spinner label="Creating a mind map…" />
  if (createError !== null) {
    return (
      <Failure
        error={createError}
        onRetry={() => {
          setCreateError(null)
          setCreating(true)
          // Bumping the attempt is what re-runs the effect; clearing the flag
          // alone would leave the spinner turning forever.
          setCreateAttempt((n) => n + 1)
        }}
      />
    )
  }

  if (openId !== undefined) {
    return (
      <MapView
        store={store}
        id={openId}
        canEdit={mayEdit}
        controls={controls}
        onBack={pinned ? undefined : () => show(undefined)}
      />
    )
  }

  return (
    // `show`, not `setOpenId`: opening a map from the list has to move the URL
    // too when this mount owns it.
    <MapsScreen store={store} canEdit={mayEdit} locale={locale} onOpen={show} />
  )
}
