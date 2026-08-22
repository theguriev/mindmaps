# @mindmaps/wordpress-app

The front-end half of the WordPress integration: the script and stylesheet the
plugin in `services/wordpress` enqueues on any page that renders a map.

It is **not** a single-page app. There is no `index.html` in the build output
and no router — the URL belongs to the WordPress post. The build produces two
files at fixed names plus a manifest:

```
dist/index.js       one IIFE bundle (React and @mindmaps/engine included)
dist/index.css      one stylesheet
dist/block.js       the block editor's registration — no React of its own
dist/manifest.json  Vite's manifest, for the plugin's asset versioning
```

Nothing is hashed and nothing is code-split, because `wp_enqueue_script` and
`wp_enqueue_style` want a path they can hard-code. React is bundled rather than
mapped onto WordPress's own `wp-element`: the engine needs React 19, and the
copy WordPress ships is older.

## How it is embedded

The plugin prints a boot payload and one or more mount points
(`docs/wordpress-contract.md` is the authority; this is the front-end's half):

```html
<script>
  window.mindMapsBoot = {
    root: 'https://site.test/wp-json/mindmaps/v1',
    nonce: 'a1b2c3d4e5',
    mapId: '42',        // absent → the app shows the map list
    canEdit: true,      // false → read-only embed
    locale: 'en_US'
  }
</script>

<div
  data-mind-maps-root
  data-map-id="42"
  data-can-edit="1"
  style="height:600px"
></div>
```

On load the bundle finds **every** `[data-mind-maps-root]` on the page and
mounts a React root into each one — two shortcodes in one post get two
independent editors. Finding no mount point is normal (the script may be
enqueued on a page without a map) and does nothing.

Each mount decides for itself, from its own attributes, because one post can
carry two embeds of different maps:

| Attribute | Value | Meaning |
| --- | --- | --- |
| `data-map-id` | `"42"` | show map 42 |
| | `""` | show the list — **not** the payload's `mapId` |
| | absent | fall back to the payload's `mapId` (older plugin) |
| `data-can-edit` | `"1"` | this visitor may write *this* map |
| | `"0"` (or anything else) | read-only |
| | absent | fall back to the payload's `canEdit` (older plugin) |

The empty `data-map-id` matters: `[mind_map]` on a page that also carries
`[mind_map id="42"]` has to reach the list, and a page-wide fallback would
render map 42 twice instead. `data-can-edit` matters for the same reason — the
payload's `canEdit` was computed for one map, and the mount next to it may show
another.

Mounting is idempotent: a container is flagged once mounted, so running the
script twice cannot produce two roots on one element. If the payload is missing
or malformed the app renders the reason inside the container instead of leaving
an empty box — that message is aimed at whoever maintains the site, and points
at the PHP rather than at JavaScript.

The mount container is given the class `mind-maps-app`, which is what every
rule in `src/index.css` hangs off.

## The two states

- **With a map id** — loads the document through `createWpStore` and renders
  `<MindMapEditor/>`. `onBack` is wired only when the visitor arrived from the
  list; a map pinned by the shortcode has nothing to go back to.
- **Without one** — the map list: filter, templates, open. State lives in the
  component, since there is no router to hold it.

Both states draw their loading and failure cases. A store failure is rendered
from the plugin's stable error `code`/`status` (`mindmap_forbidden`,
`mindmap_not_found`, …) rather than from message text, so a translated plugin
still produces the right sentence, and a retry button appears only where
retrying could work.

## Read-only embeds

`data-can-edit="0"` — or `canEdit: false` in the payload behind it, or a
payload with no nonce, which WordPress would reject on every write anyway —
puts that embed in read-only mode. The decision is made once per mount, in
`resolveCanEdit()`, and it removes the writes rather than the buttons:

- the list renders rows without the star/remove controls, and without the
  "New" affordance — not the same rows with dead buttons;
- the editor is handed an `onSave` that never touches the store. The island's
  save button and ⌘S both land in that same handler, so there is no shortcut
  around a hidden control;
- a badge says the embed is read-only, and says so more loudly once a save has
  been attempted and dropped.

The canvas itself stays interactive — the engine has no read-only mode, so a
read-only visitor can still drag nodes around locally. Nothing they do is
persisted, and nothing they do can reach the REST API.

## The block in the inserter

`src/block.ts` is the editor half of the `mind-maps/map` block — the reason it
appears in the inserter at all. The plugin registers and renders the block in
PHP, so a post that already contains one has always worked; but a block with no
client registration has no `edit`, and the editor will not offer what it cannot
draw.

It is built separately (`vite.block.config.ts` → `dist/block.js`, a few KB) and
shares nothing with `index.js`:

- It is written against **WordPress' React**, reached through `window.wp`. That
  is not a style choice — two Reacts cannot render each other's elements, the
  same wall the command palette hits with icons. Hence no JSX and no `react`
  import anywhere in that file.
- What it *does* share is `@mindmaps/engine/preview` and
  `@mindmaps/storage/document`, which are pure functions over stored
  coordinates and belong to neither React. Those subpath exports exist so a
  second bundle can take the projection without taking the engine.

An author picks a map and sees a **still** of it: its shape, its title and its
node count. The front end mounts the real thing, but a live, pannable, editable
canvas inside the post editor would be two editors fighting over the same drag.
`parseMapSummary` reads the picker's rows, so the block understands both shapes
`GET /maps` can return — a summary, or the whole document it still sends.

## One command palette, not two

The admin answers ⌘K with WordPress' own "Search commands and settings", and
the editor used to answer it as well. Which of the two you got depended on
where the focus happened to be, and neither knew about the other's actions.

So in the admin the editor stands down: `onCommands` hands its command list
over, which suppresses its own palette and leaves the shortcut alone, and
`src/commands.ts` registers the list into the `core/commands` store — where the
map's actions sit beside "Go to: Posts" as `Mind map: Undo (⌘Z)` and the rest.
They are registered while a map is open and taken back when it closes.

They are registered against the palette's **context**, which is what lists them
without anything being typed. WordPress builds the "Suggestions" it shows on an
empty query out of the commands whose `context` matches the current one, and
leaves everything else — the forty-odd site-wide "Go to: …" entries — behind
the search. So ⌘K over a map opens on what you can do to the map:

```
SUGGESTIONS
  Mind map: Add root node
  Mind map: Add sticky note
  Mind map: Duplicate branch (⌘D)
  …
```

Two more details are not incidental:

- The palette calls through a ref rather than the closure registration saw. The
  editor rebuilds its commands on every render, and `undo` from three renders
  ago undoes the wrong thing; registering is keyed on which commands exist, so
  it happens when the set changes rather than on every keystroke.
- Icons are dropped. They are components from this bundle's React, and the
  palette renders them with WordPress' — a different copy, which does not
  recognise the other's elements.

None of this happens on the front end: `wp-commands` is not loaded there, so
`commandStore()` finds nothing, the editor keeps its own ⌘K palette, and a
shortcode embed is unaffected.

## CSS in somebody else's page

The engine's stylesheet is written for the standalone editor, where owning
`html`/`body` and resetting every element on the page is correct. This
stylesheet is enqueued into somebody else's page, so it does not import the
engine's — its first line is `@import 'tailwindcss'`, which brings Tailwind's
**Preflight**: a document-wide reset of `*`, headings, lists, links, tables and
form controls that would restyle the whole post.

`src/index.css` assembles Tailwind by hand instead — `tailwindcss/theme.css`
plus `tailwindcss/utilities.css`, no `base` — copies the engine's design tokens
(there is nowhere else to import them from; `styles.test.ts` fails if the copy
drifts), and puts back only the resets the engine's markup relies on, scoped to
the mount container. They stay in the `base` layer, exactly where Preflight
sat, so the utilities still win over them and unlayered theme CSS still wins
over the utilities.

Radix renders popovers, dropdowns, tooltips and the ⌘K palette into a portal on
`body`, outside the container, so the scope covers their `data-slot` roots too
— that is also where they pick up the embed's typography and a z-index above
the ones themes like to use.

`styles.test.ts` compiles `src/index.css` with Tailwind's own compiler and
fails on any rule that could match an element outside the embed, which is the
check that keeps this from regressing the next time an import looks harmless.

## Developing

```sh
pnpm --filter @mindmaps/wordpress-app dev         # harness on :5173
pnpm --filter @mindmaps/wordpress-app type-check
pnpm --filter @mindmaps/wordpress-app test
pnpm --filter @mindmaps/wordpress-app lint
pnpm --filter @mindmaps/wordpress-app build
```

`pnpm dev` serves `index.html`, a harness that stands in for a WordPress page:
it sets `window.mindMapsBoot`, renders a pinned-map embed, the same map
read-only and a list embed (whose empty `data-map-id` has to beat the payload's
pinned one), and wraps them in deliberately different theme styling so any CSS
that escapes the container is visible. `index.html` is a dev-only entry — the
production build takes `src/main.tsx` directly and never emits it.

The harness points `root` at the relative `/wp-json/mindmaps/v1`, which Vite's
dev server proxies to `http://localhost:8888` (the wp-env default). So:

```sh
pnpm wp:start                                     # from the repo root
pnpm --filter @mindmaps/wordpress-app dev
```

Reads work against that once the plugin is active. Writes need a real nonce:
open a page on the local site, copy the `nonce` out of its printed
`mindMapsBoot`, and paste it into the harness — cookie authentication is
already carried by the proxy. Without WordPress running, the harness is still
useful: it exercises the failure UI, which is exactly what a visitor sees when
the REST call fails.

Tests cover the pure logic only — boot payload parsing, the per-mount map id
and permission, the error copy, and the stylesheet's isolation. The editor
draws into a real canvas, so rendering it is not something jsdom can check;
that belongs in the plugin's own browser tests.
