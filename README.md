# Mind maps

A mind-map editor that renders the entire map on an HTML **`<canvas>`** through a
custom **`react-reconciler`** (no SVG for the map), packaged as a monorepo so the
same engine runs both as a standalone app and inside a **WordPress plugin** that
uses WordPress as its backend.

```
packages/engine ──┬─→ apps/editor        SPA, maps in localStorage
                  └─→ apps/wordpress ──→ services/wordpress   the plugin
packages/storage ─┘                      (PHP; WordPress is the backend)
```

## Workspaces

| Package | What it is |
| --- | --- |
| `packages/engine` | The editor itself: the canvas reconciler, the domain model, the markdown text renderer and `<MindMapEditor/>` — storage-agnostic, driven by `doc` + `onSave`. |
| `packages/storage` | The `MapStore` contract with two backends: `createLocalStore()` and `createWpStore()`, plus the pure document validation both share. |
| `packages/config` | Shared TypeScript configuration. |
| `apps/editor` | The standalone SPA (TanStack Router, localStorage). |
| `apps/wordpress` | The bundle the plugin embeds: one JS + one CSS file, mounted into `[data-mind-maps-root]`. |
| `services/wordpress` | The WordPress plugin — custom post type, REST API, shortcode/block. Written in plain functions, no classes. |

The wire contract between the last three lives in
[`docs/wordpress-contract.md`](docs/wordpress-contract.md).

## How the engine works

```
React components (scene JSX)
        │  <group> <box> <bezier> <triangle> <markdown> <plus> …
        ▼
custom react-reconciler  (packages/engine/src/renderer/)
        │  mutates a SceneNode tree
        ▼
paint.ts  → Canvas 2D          hitTest.ts → pointer routing
```

- **`renderer/`** — a synchronous (LegacyRoot) mutation-mode `react-reconciler@0.33`
  host config whose "instances" are plain scene-graph nodes; `Canvas.tsx` hosts the
  `<canvas>`, repaints on commit/resize (devicePixelRatio-aware) and routes pointer
  events by hit-testing; `svgExport.ts` serializes the same tree to SVG.
- **`markdown/`** — a from-scratch markdown → canvas text renderer (headings,
  emphasis, code, links, lists, quotes, tables, rules). Text soft-wraps at an opt-in
  `maxWidth`; nodes wrap at 480px, or at their own width once resized.
- **`mindmap/`** — the domain model: adjacency map, undo/redo, collapse, clipboard.
- **`editor/MindMapEditor.tsx`** — the whole editing experience as one component.

## Develop

```bash
pnpm install
pnpm dev            # every app in watch mode (turbo)
pnpm build          # build everything, including the plugin's bundle
pnpm type-check
pnpm lint
pnpm test           # JS unit suites (no PHP toolchain needed)
```

Single workspace: `pnpm --filter @mindmaps/editor dev`.

### WordPress

```bash
pnpm wp:start        # wp-env: WordPress with the plugin mounted (localhost:8879)
pnpm test:php        # the plugin's pure PHP suite — no WordPress, no database
pnpm test:integration  # the REST suite against a real WordPress
pnpm wp:package      # dist/mind-maps.zip, installable in any WordPress
pnpm wp:stop
```

The PHP suites need PHP and Composer on the PATH (`pnpm test` does not).

See [`services/wordpress/README.md`](services/wordpress/README.md) for the details.

## Requirements

- Node ≥ 22.12 (see `.nvmrc` — pinned to 24), pnpm ≥ 10 (`corepack enable pnpm`)
- PHP ≥ 8.1 and Composer for the plugin's tests; Docker for the integration suite

## React Compiler

The [React Compiler](https://react.dev/learn/react-compiler) (stable 1.0)
auto-memoizes components and hooks. The oxc-based `@vitejs/plugin-react` doesn't run
Babel, so the compiler is applied via `@rolldown/plugin-babel` +
`reactCompilerPreset()` in each app's Vite config. React 19 ships the compiler
runtime, so there is no extra runtime dependency.

## Known simplifications

- **Node resize** uses a single bottom-right handle and resizes about the node
  centre, instead of per-quadrant anchoring. A deliberately resized node also wraps
  its drawn markdown at its own width instead of the 480px default.
- **The text overlay is not WYSIWYG**: while typing, the `<textarea>` wraps at its
  own width (min 300px); the canvas re-wraps the committed text at the node's wrap
  width.

## Verification

The domain, markdown, geometry, clipboard and storage logic has pure unit coverage
(`pnpm test`); the plugin's document validation has a PHP suite that needs no
WordPress, and its REST surface has an integration suite against a real WordPress.
The codebase has been through adversarial multi-agent review passes; confirmed
findings were fixed.
