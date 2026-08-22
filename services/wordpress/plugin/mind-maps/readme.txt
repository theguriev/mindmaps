=== Mind Maps ===
Contributors: eugenguriev
Tags: mind map, diagram, canvas, block, shortcode
Requires at least: 6.3
Tested up to: 6.7
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
produce an identical mount point.

**Permissions.** Reading a map requires `read` plus ownership (or
`edit_others_posts`). Creating requires `edit_posts`; updating and deleting
require `edit_post` / `delete_post` for that specific map. Nothing is public by
default — an embedded map is only visible to a visitor who may read it.

= REST API =

Namespace `mindmaps/v1`, authenticated with cookies plus the standard
`X-WP-Nonce` header.

* `GET /maps` — every map the caller may see, newest first, capped at 100
* `POST /maps` — create a map
* `GET /maps/<id>` — read one map
* `PUT /maps/<id>` — overwrite one map
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

Only if they may edit that map. The boot payload tells the front end whether
the current viewer has write access, and every write is re-checked server-side.

= Does it expose the maps through the core REST API? =

No. The post type registers with `show_in_rest` disabled on purpose — core's
endpoints would let a client write `_mindmap_content` without going through the
plugin's document validation.

= What happens to a corrupted map? =

It degrades to an empty document instead of breaking the screen. Content that
fails validation — non-finite coordinates, duplicate node ids, cyclic parent
chains — is never returned to the editor.

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
