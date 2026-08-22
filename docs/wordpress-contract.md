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

Two rules exist only because PHP can get them wrong:

- `content` and every entry in it must be a JSON **array**. A JSON object is
  rejected, matching `Array.isArray` — so request bodies and stored meta are
  decoded with `json_decode( …, false )`, because associative decoding turns
  `{"0":[…],"1":[…]}` into something `array_is_list()` cannot tell from a list.
- A document may hold at most `MindMaps\Document\MAX_NODES` (10 000) entries;
  anything larger is rejected before any per-node or graph work.

## REST API

Namespace `mindmaps/v1`, i.e. `\<site\>/wp-json/mindmaps/v1/…`.

| Method | Route | Body | Response |
| --- | --- | --- | --- |
| GET | `/maps` | — | `MapDoc[]` (newest first, capped at 100) |
| POST | `/maps` | `MapDoc` without a meaningful `id` | `MapDoc` |
| GET | `/maps/<id>` | — | `MapDoc` |
| PUT | `/maps/<id>` | `MapDoc` | `MapDoc` |
| DELETE | `/maps/<id>` | — | `{ "deleted": true, "id": "<id>" }` |

`PUT` is a full replace and there is no `PATCH`: the route registers `PUT`
alone, so a partial body cannot be mistaken for a whole document.

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

A new map is created as `publish` when its creator has `publish_posts` and as
`draft` otherwise. Contributors have `edit_posts` but not `publish_posts`, and
under `map_meta_cap` a *published* post's `edit_post`/`delete_post` resolve to
`edit_published_posts`/`delete_published_posts` — so a published map would be
one its own creator could never save or delete.

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

`mapId` is the first map the page embeds in document order — from a
`mind-maps/map` block's `id` attribute or from a `[mind_map id]` shortcode,
whichever comes first — because the payload is printed before either renders.

`canEdit: false` maps to the engine's `<MindMapEditor readOnly>`, which removes
every mutating affordance and shortcut (creation, editing, delete, move, resize,
paste, reactions, branch styling, save) while leaving pan/zoom, selection,
search, folding and export available. The plugin must not rely on that alone —
the REST capability checks are the actual boundary.

The app mounts into an element carrying `data-mind-maps-root`. Several
instances may exist on one page, so each mount states its own case in full and
never inherits from `window.mindMapsBoot`:

| Attribute | Value |
| --- | --- |
| `data-map-id` | **Always emitted.** The map's id, or the **empty string** meaning "no map — show the list" |
| `data-can-edit` | `"1"` or `"0"`, resolved per mount from the viewer's `edit_post` on that map (or `edit_posts` for a list mount) |
| `data-map-param` | Present **only on a mount that owns its page's URL** — the admin screen, where it is `map`. Names the query parameter the open map lives in |

A mount naming a `data-map-param` is a *routed* mount: opening a map rewrites
that parameter, so the address identifies the map the way `post.php?post=1`
identifies a post, and a reload, a shared link or the browser's Back button all
land where the address says. Such a mount always offers its way back to the
list. A shortcode or block emits no `data-map-param` — the address belongs to
the post it sits in — and keeps the open map in component state.

The admin screen also renders its canvas edge to edge, so its mount carries no
inline `min-height` (an inline height outranks any stylesheet and would keep
the container from shrinking with the viewport). Shortcode and block mounts
keep theirs.

The empty string is load-bearing: an *absent* `data-map-id` used to fall back to
`boot.mapId`, so `[mind_map]` followed by `[mind_map id="42"]` rendered map 42
twice instead of a list and a map. `boot.mapId` / `boot.canEdit` remain the
page-wide defaults for a mount created outside the plugin's renderer.

## Shortcode / block

`[mind_map id="42" height="600"]` renders a mount point. The block
(`mind-maps/map`) does the same through `render_callback`, so both paths share
one renderer.
