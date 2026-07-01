# Mind maps — React + custom canvas reconciler

A mind-map editor built in **React 19 + TypeScript** that renders the entire
map on an HTML **`<canvas>`** via a **custom `react-reconciler`** (no SVG for
the map). Ported from an earlier Vue 2 implementation.

## How it works

```
React components (scene JSX)
        │  <group> <box> <bezier> <triangle> <markdown> <plus> …
        ▼
custom react-reconciler  (src/renderer/hostConfig.ts, reconciler.ts)
        │  mutates a SceneNode tree
        ▼
paint.ts  → Canvas 2D          hitTest.ts → pointer routing
```

- **`src/renderer/`** — the custom renderer:
  - `hostConfig.ts` / `reconciler.ts` — a synchronous (LegacyRoot) mutation-mode
    `react-reconciler@0.33` host config whose "instances" are plain scene-graph
    nodes. It is authored against the actual 0.33 runtime (whose
    `commitUpdate`/`createContainer`/priority hooks differ from the lagging
    `@types/react-reconciler`), so it is typed per-parameter rather than via the
    `HostConfig<…>` generic.
  - `Canvas.tsx` — React DOM component that hosts the `<canvas>`, mounts the
    scene root, repaints on commit/resize (devicePixelRatio-aware), and routes
    pointer/click/dblclick/wheel events to scene elements via hit-testing.
  - `paint.ts` — walks the scene tree and paints it (groups apply transforms).
  - `hitTest.ts` — top-most-first hit-testing with `DOMMatrix` transforms.
  - `svgExport.ts` — serializes the same scene tree to SVG (for export).
- **`src/markdown/`** — a from-scratch markdown → canvas text renderer
  (headings, bold/italic/strike/code, links, lists, blockquotes, code blocks,
  hr). Node text is `nowrap`, so there is no soft wrapping.
- **`src/mindmap/`** — the domain model (`useAdjacency`, `list`, `paths`,
  geometry, clock-index).
- **`src/routes/`** — [TanStack Router](https://tanstack.com/router) file-based
  routes (browser history, code-collocated): `__root.tsx`, `index.tsx` (`/`,
  Home) and `map.$id.tsx` (`/map/$id`, the editor). Each route's component lives
  in its route file; the Vite plugin generates `src/routeTree.gen.ts` and
  auto-code-splits each route (the editor loads as its own chunk).
- **`src/components/`** — the React UI. The map is drawn on the canvas; a DOM
  `<textarea>` overlay appears only while editing a node.
- **`src/ui/`** — small dependency-free UI primitives.

## Requirements

- Node ≥ 22.12 (see `.nvmrc` — pinned to 24)
- pnpm ≥ 10 (enable via corepack: `corepack enable pnpm`)

## Develop

```bash
pnpm install
pnpm dev         # vite dev server
pnpm build       # tsc + vite build  → dist/
pnpm preview     # serve the production build
pnpm typecheck
```

## Persistence

Maps are stored in `localStorage` under `map-*` keys as adjacency `content`
entries (root id `0`).

## Known simplifications

- **Node resize** uses a single bottom-right handle and resizes about the node
  centre, instead of per-quadrant anchoring. Functionally equivalent; the
  anchor corner differs.

## Verification

The domain/markdown/geometry logic has pure-unit coverage, and the whole
codebase was put through an adversarial multi-agent review (reconciler
correctness, canvas paint/hit-test, markdown layout, React integration);
confirmed findings were fixed.
