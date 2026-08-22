# WordPress backend contract

The contract between the PHP plugin (`services/wordpress`), the embedded
front-end (`apps/wordpress`) and the REST store (`packages/storage/src/wp.ts`).
Change it in all three places at once, or not at all.

## Data model

A map is a custom post type; its document lives in post meta as JSON.

| Thing | Value |
| --- | --- |
| Post type | `mind_map` (not public, `show_in_rest` false — the plugin owns its REST surface) |
| Post title | the map title, mirrored from the root node's text |
| Meta key | `_mindmap_content` — JSON string of the `content` entries |
| Meta key | `_mindmap_version` — integer schema version (currently `1`) |
| Meta key | `_mindmap_template` — `"1"` when the map is starred as a template, else `"0"` |

`content` is the engine's adjacency serialization: an array of
`[nodeId, node]` pairs, where node is
`{ name, x, y, parent?, stroke?, strokeWidth?, lineStyle?, lineShape?, width?, height?, sticky?, collapsed?, reaction? }`.
The authoritative validation rules live in
`packages/storage/src/document.ts` (TypeScript) and
`services/wordpress/plugin/mind-maps/src/document.php` (PHP) — the PHP side is
the security boundary and must reject what the TS side rejects: non-finite
coordinates, duplicate ids, dangling parents (dropped), and parent cycles.

## REST API

Namespace `mindmaps/v1`, i.e. `\<site\>/wp-json/mindmaps/v1/…`.

| Method | Route | Body | Response |
| --- | --- | --- | --- |
| GET | `/maps` | — | `MapDoc[]` (newest first, capped at 100) |
| POST | `/maps` | `MapDoc` without a meaningful `id` | `MapDoc` |
| GET | `/maps/<id>` | — | `MapDoc` |
| PUT | `/maps/<id>` | `MapDoc` | `MapDoc` |
| DELETE | `/maps/<id>` | — | `{ "deleted": true, "id": "<id>" }` |

`MapDoc` on the wire:

```json
{
  "id": "42",
  "title": "Product plan",
  "content": [["0", { "name": "Root", "x": 0, "y": 0 }]],
  "modified": "2026-08-22T10:00:00+00:00",
  "meta": { "template": "0" },
  "version": 1
}
```

`id` is the WordPress post ID rendered as a string.

### Authentication

Cookie authentication plus the standard REST nonce: the plugin prints
`wp_create_nonce('wp_rest')` into the page and the client sends it as
`X-WP-Nonce`. Every route's `permission_callback` checks a capability — never
`__return_true`.

| Route | Capability |
| --- | --- |
| GET `/maps`, GET `/maps/<id>` | `read` + the map must be readable by the user (own map, or `edit_others_posts`) |
| POST `/maps` | `edit_posts` |
| PUT/DELETE `/maps/<id>` | `edit_post` / `delete_post` for that post |

### Errors

`WP_Error` with an HTTP status and a stable code the client can branch on:

| Code | Status | When |
| --- | --- | --- |
| `mindmap_invalid_document` | 400 | the payload is not a valid document |
| `mindmap_forbidden` | 403 | the user may not touch this map |
| `mindmap_not_found` | 404 | no such map (or not a `mind_map` post) |

## Boot payload

The plugin prints a JSON blob for the mounted front-end:

```js
window.mindMapsBoot = {
  root: 'https://site.test/wp-json/mindmaps/v1',
  nonce: 'a1b2c3d4e5',
  mapId: '42',        // absent → the app shows the map list
  canEdit: true,      // false → read-only embed
  locale: 'en_US'
}
```

The app mounts into an element carrying `data-mind-maps-root`; several
instances may exist on one page and each one reads its own `data-map-id`
attribute, falling back to `window.mindMapsBoot.mapId`.

## Shortcode / block

`[mind_map id="42" height="600"]` renders a mount point. The block
(`mind-maps/map`) does the same through `render_callback`, so both paths share
one renderer.
