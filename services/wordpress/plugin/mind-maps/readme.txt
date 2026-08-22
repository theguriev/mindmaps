=== Mind Maps ===
Contributors: gurievcreative
Tags: mind map, diagram, canvas, block, shortcode
Requires at least: 6.3
Tested up to: 7.1
Requires PHP: 8.1
Stable tag: 1.1.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Embed and edit canvas mind maps in WordPress. Maps are a custom post type, served through the plugin's own REST namespace.

== Description ==

Mind Maps brings the canvas mind-map editor into WordPress. Maps are stored as
a private `mind_map` custom post type — the document itself lives in post meta
as JSON — and are read and written through the plugin's own `mindmaps/v1` REST
namespace rather than through core's post endpoints, so every write passes the
plugin's validation.

**Editing.** A top-level "Mind Maps" admin menu mounts the editor for anyone
who can edit posts. Each user sees their own maps; editors and administrators
see everyone's.

**Embedding.** Drop a map into any post or page with the shortcode or the
block:

    [mind_map id="42" height="600"]

The block is called *Mind Map* and renders through the same code path, so both
produce an identical mount point. Both can hand a reader the map on its own,
with no title, buttons or zoom over it — the block has a **Show controls**
toggle, the shortcode takes `controls="0"` — and a map shown that way arrives
already framed on the whole diagram instead of at full size on its middle.

**Permissions.** A **published** map can be read by anyone, signed in or not —
that is what makes embedding one in a post worth doing, since most of the
people reading a post are not signed in. Reading is all that grants: creating a
map requires `edit_posts`, and updating or deleting one requires `edit_post` /
`delete_post` for that specific map, re-checked on the server for every write.

Maps that are **not** published — a contributor's draft, a private or pending
map — stay with their author, and with editors and administrators. The map list
is never public: `GET /maps` refuses a signed-out caller outright, so a
visitor cannot enumerate a site's maps.

Worth knowing before you write anything sensitive in one: a published map is
readable by anyone who knows its post id, whether or not you have embedded it
anywhere. If that is not what you want for a particular map, keep it out of
this plugin.

= REST API =

Namespace `mindmaps/v1`. Writes are authenticated with cookies plus the
standard `X-WP-Nonce` header; reading a published map needs neither.

* `GET /maps` — every map the caller may see, newest first, capped at 100
* `POST /maps` — create a map
* `GET /maps/<id>` — read one map
* `PUT /maps/<id>` — overwrite one map
* `PUT /maps/<id>/template` — mark a map as a template, or stop
* `DELETE /maps/<id>` — delete one map

Errors carry a stable code: `mindmap_invalid_document` (400),
`mindmap_forbidden` (403), `mindmap_not_found` (404).

== Installation ==

1. Upload the `mind-maps` folder to `/wp-content/plugins/`, or install the ZIP
   through Plugins → Add New → Upload Plugin.
2. Activate the plugin through the Plugins screen.
3. Open **Mind Maps** in the admin menu to create your first map.
4. Embed it anywhere with `[mind_map id="…"]` or the Mind Map block.

== Frequently Asked Questions ==

= Where is a map stored? =

In a `mind_map` post. The title mirrors the root node's text; the document is
JSON in the `_mindmap_content` post meta, alongside `_mindmap_version` and
`_mindmap_template`.

= Can visitors edit an embedded map? =

No. A signed-out visitor gets the map read-only: it can be panned, zoomed,
folded and exported, and nothing they do reaches the server. The same applies
to any signed-in user without `edit_post` on that map. The boot payload tells
the front end which of the two it is, and every write is re-checked on the
server regardless of what the front end believed.

= Does it expose the maps through the core REST API? =

No. The post type registers with `show_in_rest` disabled on purpose — core's
endpoints would let a client write `_mindmap_content` without going through the
plugin's document validation.

= What happens to a corrupted map? =

It degrades to an empty document instead of breaking the screen. Content that
fails validation — non-finite coordinates, duplicate node ids, cyclic parent
chains — is never returned to the editor.

= What happens to my maps if I delete the plugin? =

They stay. Maps are your content, stored as ordinary `mind_map` posts, and
deleting or deactivating the plugin leaves them in the database untouched —
reactivating brings all of them back exactly as they were.

If you want them gone, delete them in the Mind Maps screen **before** removing
the plugin; once it is gone there is no screen that lists them. To keep a copy,
Tools → Export offers "Mind Maps" as an export type.

Note that deleting a *user* does delete their maps, the same way WordPress
deletes other content belonging to a removed user.

== Source Code ==

This plugin ships built JavaScript and CSS. The unminified source, and the
tools that build it, are public:

* Repository: https://github.com/theguriev/mindmaps
* Each release is built from the tag of the same version as `Stable tag`.

Where the shipped files come from:

* `assets/index.js` ← `apps/wordpress/src/main.tsx` (with `packages/engine`
  and `packages/storage`), built by `apps/wordpress/vite.config.ts`
* `assets/block.js` ← `apps/wordpress/src/block.ts`, built by
  `apps/wordpress/vite.block.config.ts` — a second, separate Vite build
* `assets/index.css` ← `apps/wordpress/src/index.css` (Tailwind)

To build it yourself you need Node 22 or newer and pnpm:

    git clone https://github.com/theguriev/mindmaps
    cd mindmaps
    pnpm install
    pnpm wp:package

That writes `services/wordpress/dist/mind-maps.zip`, which is this plugin. The
long form, if you would rather see the steps:

    pnpm install
    pnpm build
    pnpm --filter @mindmaps/wordpress run package

== Screenshots ==

1. The Mind Maps admin screen.
2. A map embedded in a page through the block.

== Changelog ==

= 1.1.0 =
* First release: `mind_map` post type, `mindmaps/v1` REST namespace, shortcode,
  block, and admin editor screen.

== Upgrade Notice ==

= 1.1.0 =
First release.
