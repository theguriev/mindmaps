=== Mind Maps ===
Contributors: gurievcreative
Tags: mind map, mindmap, brainstorming, diagram, canvas
Requires at least: 6.3
Tested up to: 7.1
Requires PHP: 8.1
Stable tag: 1.1.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

A fast canvas mind-map editor right in wp-admin. Sketch ideas, style branches, react with emoji — then embed any map in a post or page.

== Description ==

Mind Maps puts a real mind-map editor inside your WordPress admin. No external service, no accounts, no iframes: maps are ordinary WordPress content, stored in your database, protected by WordPress permissions, and embeddable in any post or page with a block or a shortcode.

= Made for thinking =

* **A real canvas editor.** The whole map is drawn on an HTML canvas by a custom React renderer, so dragging, panning and zooming stay smooth even on large maps.
* **Markdown in every node.** Headings, bold and italics, code, links, lists, quotes — even tables.
* **Style it your way.** Color branches, change line styles and shapes, resize nodes, drop sticky notes, and react to any node with emoji.
* **Keyboard first.** A command palette (Ctrl/Cmd+K), find node (Ctrl/Cmd+F), duplicate branch (Ctrl/Cmd+D), and full undo/redo.
* **Templates.** Star any map as a template and start new maps from it.
* **Export.** Download any map as an SVG file.

= Made for WordPress =

* **Your data stays home.** Every map is a `mind_map` post; the document is JSON in post meta. Deactivating or deleting the plugin leaves your maps untouched, and Tools → Export can back them up.
* **Embed anywhere.** Use the Mind Map block or the shortcode below. Visitors get the map read-only: they can pan, zoom, fold branches and export, and nothing they do reaches the server.

    [mind_map id="42" height="600"]

* **Start from anywhere.** + New → Mind Map in the admin bar opens a fresh map.
* **Sensible permissions.** A published map is readable by anyone — that is what makes embedding worth doing. Everything else follows WordPress capabilities: creating needs `edit_posts`, updating or deleting is re-checked on the server for that specific map, and the map list is never public.
* **Its own REST API.** Maps are served through the plugin's `mindmaps/v1` namespace, and every write passes strict document validation. Core's post endpoints are deliberately not exposed.

Worth knowing before you write anything sensitive in a map: a published map is readable by anyone who knows its post id, whether or not it is embedded anywhere. Keep private notes out of published maps, or keep the map as a draft.

= REST API =

Namespace `mindmaps/v1`. Writes are authenticated with cookies plus the standard `X-WP-Nonce` header; reading a published map needs neither.

* `GET /maps` — every map the caller may see, newest first, capped at 100
* `POST /maps` — create a map
* `GET /maps/<id>` — read one map
* `PUT /maps/<id>` — overwrite one map
* `PUT /maps/<id>/template` — star or unstar a map as a template
* `DELETE /maps/<id>` — delete one map

Errors carry a stable code: `mindmap_invalid_document` (400), `mindmap_forbidden` (403), `mindmap_not_found` (404).

== Installation ==

1. Install through Plugins → Add New (search for "Mind Maps"), or upload the ZIP through Plugins → Add New → Upload Plugin.
2. Activate the plugin.
3. Open **Mind Maps** in the admin menu and press **New**.
4. Embed the map anywhere with the Mind Map block or `[mind_map id="…"]`.

== Frequently Asked Questions ==

= Does it need an account or an external service? =

No. The editor runs entirely on your site and the plugin makes no external requests. Maps never leave your database.

= Where is a map stored? =

In a `mind_map` post. The title mirrors the root node's text; the document is JSON in the `_mindmap_content` post meta, alongside `_mindmap_version` and `_mindmap_template`.

= Can visitors edit an embedded map? =

No. A signed-out visitor gets the map read-only: it can be panned, zoomed, folded and exported, and nothing they do reaches the server. The same applies to any signed-in user without `edit_post` on that map. Every write is re-checked on the server regardless of what the front end believed.

= Does it expose the maps through the core REST API? =

No. The post type registers with `show_in_rest` disabled on purpose — core's endpoints would let a client write `_mindmap_content` without going through the plugin's document validation.

= What happens to a corrupted map? =

It degrades to an empty document instead of breaking the screen. Content that fails validation — non-finite coordinates, duplicate node ids, cyclic parent chains — is never returned to the editor.

= What happens to my maps if I delete the plugin? =

They stay. Maps are your content, stored as ordinary `mind_map` posts, and deleting or deactivating the plugin leaves them in the database untouched — reactivating brings all of them back exactly as they were.

If you want them gone, delete them in the Mind Maps screen **before** removing the plugin; once it is gone there is no screen that lists them. To keep a copy, Tools → Export offers "Mind Maps" as an export type.

Note that deleting a *user* does delete their maps, the same way WordPress deletes other content belonging to a removed user.

== Screenshots ==

1. The editor: colored branches, markdown nodes, emoji reactions, undo/redo and zoom — all on one canvas.
2. The Mind Maps screen: every map you can see, searchable, newest first.
3. The command palette: every action one keystroke away.
4. Start a map from anywhere: + New → Mind Map in the admin bar.

== Source Code ==

This plugin ships built JavaScript and CSS. The unminified source, and the tools that build it, are public:

* Repository: https://github.com/theguriev/mindmaps
* Each release is built from the tag of the same version as `Stable tag`.

Where the shipped files come from:

* `assets/index.js` ← `apps/wordpress/src/main.tsx` (with `packages/engine` and `packages/storage`), built by `apps/wordpress/vite.config.ts`
* `assets/block.js` ← `apps/wordpress/src/block.ts`, built by `apps/wordpress/vite.block.config.ts` — a second, separate Vite build
* `assets/index.css` ← `apps/wordpress/src/index.css` (Tailwind)

To build it yourself you need Node 22 or newer and pnpm:

    git clone https://github.com/theguriev/mindmaps
    cd mindmaps
    pnpm install
    pnpm wp:package

That writes `services/wordpress/dist/mind-maps.zip`, which is this plugin.

== Changelog ==

= 1.1.0 =
* First public release: canvas editor with markdown nodes, sticky notes, emoji reactions and SVG export; `mind_map` post type; `mindmaps/v1` REST namespace; Mind Map block and `[mind_map]` shortcode; templates; admin screen.

== Upgrade Notice ==

= 1.1.0 =
First public release.