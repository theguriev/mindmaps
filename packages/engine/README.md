# @mindmaps/engine

The mind-map editor itself — canvas renderer, domain model, markdown text
renderer and the `<MindMapEditor/>` component — with no opinion about where maps
are stored.

```tsx
import { MindMapEditor } from '@mindmaps/engine/editor'
import '@mindmaps/engine/styles.css'

<MindMapEditor
  doc={doc}                       // loaded by the host, e.g. via @mindmaps/storage
  onSave={(next) => store.save(next.id, next)}   // may be async
  onBack={() => history.back()}   // omit to hide the back affordance
/>
```

The host owns loading and persistence; the editor owns everything between. A
`Promise` returned from `onSave` drives the toolbar's saving/failed states, so a
network backend needs no extra UI.

## Layout

| Directory | What lives there |
| --- | --- |
| `src/renderer/` | The custom `react-reconciler` host config, the canvas painter, hit-testing and the SVG exporter. |
| `src/markdown/` | Markdown → canvas text: block/inline parsing, measurement, soft wrapping, painting. |
| `src/mindmap/` | The domain: adjacency map, undo/redo, collapse, clipboard, geometry. |
| `src/components/` | The scene components and the DOM chrome (toolbars, palettes, overlays). |
| `src/editor/` | `MindMapEditor` — the whole experience wired together. |
| `src/templates/` | Built-in starter maps. |

## Conventions that matter

- **Imports inside this package are relative.** A `@/…` alias belongs to an app;
  each host maps it to its own `src`, so an alias here would resolve to the
  host's files. When the shadcn CLI adds a component (`components.json` is kept
  for that), rewrite its `@/…` imports to relative paths.
- **The package is marked `sideEffects: ["*.css"]`** so hosts can tree-shake and
  keep route-level code splitting. Import the editor from
  `@mindmaps/engine/editor` to keep it out of a host's entry chunk.
- **Canvas JSX elements** (`<group>`, `<box>`, `<bezier>`, …) are declared in
  `src/renderer/jsx.ts` as a module augmentation, not an ambient `.d.ts` — the
  latter is invisible across package boundaries. Anything that type-checks
  against these elements must reach that module (`src/index.ts` and the editor
  both pull it in with `import type {} from '…/renderer/jsx'`).
- **Tailwind** cannot auto-detect sources inside `node_modules`, so
  `src/styles.css` registers this package with `@source './'`. Hosts add their
  own sources the same way.

## Tests

`pnpm --filter @mindmaps/engine test` — pure unit coverage for the domain,
markdown layout, geometry and clipboard logic. The canvas itself is exercised by
the apps, not by unit tests.
