# Shipping to wordpress.org — release checklist

Produced by an audit of `services/wordpress/plugin/mind-maps/` against the
plugin directory's guidelines and against what a first installer would hit.
Five auditors worked in parallel — directory rules, security, lifecycle and
i18n, compatibility and weight, product gaps — and every blocking claim was
then checked against the code by a separate reader trying to refute it. Six
claims were refuted and are recorded as such below so nobody re-files them.

Two items in section B were fixed while the audit was running and are marked.

Work through this top to bottom. The order matters: behaviour changes come before the documents that describe them, the test-loader change comes before the guards that would break the suites, and the WordPress version bump comes before the readme field that asserts it.

---

## 0. Where NOT to spend time

Verified good. Nothing to do here.

- **Document validation is a real security boundary.** `src/document.php` whitelists every field, rejects non-finite coordinates, duplicate node ids and cyclic parents, and caps at `MAX_NODES = 10000` (document.php:33) *before* per-node work. Node text is Markdown painted to `<canvas>`; PHP never emits it as HTML. The one hole is `stroke` (item 4).
- **The CPT is registered correctly for what it is.** `public:false, publicly_queryable:false, show_in_rest:false, show_ui:false`, `map_meta_cap:true`, meta never exposed to core REST. Core's endpoints genuinely cannot write `_mindmap_content`.
- **Every REST route has real capability logic.** Six routes, six named permission callbacks, no `__return_true` anywhere in `src/` (rest.php:44-101). The *non*-publish branch of `can_read_map()` is correct end to end: contributor drafts, `private` and `pending` all fall through to the ownership rule and are test-pinned (`tests/integration/RestRoutesTest.php:317`). Only the `publish` early-return is wrong (item 1).
- **The contributor/`map_meta_cap` trap is genuinely handled** and documented at repository.php:108-117. Don't "fix" `create_status()` by switching to `post_status = private` — see item 1.
- **`Requires at least: 6.3` and `Requires PHP: 8.1` are accurate and load-bearing.** 6.3 is forced by block `api_version => 3` (render.php:211) and the `wp_register_script()` `$args` array with `'strategy' => 'defer'` (assets.php:228). Do not lower either.
- **mind-maps.php already has its `ABSPATH` guard** (line 20) — only `src/*.php` is missing them.
- **Asset loading is already conditional.** A front-end page with no map enqueues neither the script nor the stylesheet; the admin path gates on `toplevel_page_mind-maps`.
- **Embedding is discoverable through the block** — it's in the inserter with a title and description and picks maps by title. No "how do I embed this" gap worth engineering.
- **Bundled-library licensing is compatible.** React 19, react-reconciler, six Radix packages, lucide (ISC), Tailwind, tailwind-merge — all MIT/ISC; `class-variance-authority` is Apache-2.0, which is fine under the plugin's *or-later* GPL. No licence audit is needed; a credits file is hygiene only (item 20).
- **`== Screenshots ==` in readme.txt:85-88 is correct as written.** Screenshot/icon/banner PNGs belong in the SVN `/assets` directory, never in the ZIP. Leave the captions; ship the files after approval (item 24).
- **No `uninstall.php` is a defensible choice.** Keeping user content on delete is normal. Don't write one; just document it (item 15).
- **The test harness is sound** (73 unit / 59 integration / 204 JS) apart from the loader issue in item 6.

---

## A. Cannot submit without this

wordpress.org will reject or bounce the submission over these.

### 6. Split the src loading out of Composer's `files` autoloader
**Do this before item 7 or you break all 132 PHP tests.**

`services/wordpress/composer.json` lists all eight `src/*.php` files under `autoload.files`, and `tests/bootstrap.php:57` requires the autoloader *unconditionally*, before the `wants_integration()` branch — so both suites execute the src files before WordPress exists.

- Remove the eight entries from `composer.json` `autoload.files`.
- Unit: in `tests/bootstrap.php`, before requiring the autoloader, `define( 'ABSPATH', dirname( __DIR__ ) . '/' );` then `require_once` the eight src files explicitly.
- Integration: nothing to add. `tests/bootstrap-integration.php:40-42` already hooks `load_plugin()` to `muplugins_loaded`, which requires `mind-maps.php` after real WordPress has defined `ABSPATH`. This also removes the double-load that mind-maps.php:27-29 currently comments around.

Do **not** define `ABSPATH` globally in `tests/bootstrap.php` — WordPress locates core through it, and a bogus value breaks the integration suite worse than the problem it solves.

*Effort: 1 hour, including re-running both suites.*

### 7. Add `defined( 'ABSPATH' ) || exit;` to all eight `src/*.php`
Plugin Check reports this as an ERROR. Today a direct hit is inert only by luck — the files contain nothing but declarations.

Placement is **immediately after the `namespace X;` line**, not after `declare(strict_types=1);`. All eight files declare a namespace, and an expression statement between `declare` and `namespace` is a fatal parse error ("Namespace declaration statement has to be the very first statement or after any declare call"). Resulting lines: plugin.php ~16, render.php ~16, post-type.php ~17, admin.php ~18, repository.php ~18, assets.php ~19, document.php ~20, rest.php ~22 — all inside Plugin Check's 50-line scan window.

Ship the **plain** form. `defined('ABSPATH') || defined('MIND_MAPS_TESTS') || exit;` does not match Plugin Check's regex and fails its AST check too, leaving all eight files still flagged. (The AST detector never recurses into `Stmt\Namespace_`, so detection of a post-namespace guard rests entirely on the regex fallback — keep it byte-exact.)

*Effort: 20 minutes after item 6.*

### 8. Run WPCS/PHPCS for the first time, and stop passing `$_GET` whole
`src/admin.php:181` passes `\wp_unslash( $_GET )` — the entire superglobal — into `requested_map_id()`. PHPCS's WordPress standard reports an unsanitized superglobal as an error, and the auto-scan runs before a human looks at the submission. The file already carries `phpcs:ignore` annotations for a linter that has never executed, so nobody knows what else it would say.

- Add `wp-coding-standards/wpcs` and `dealerdirect/phpcodesniffer-composer-installer` (already in `allow-plugins`) to `require-dev`, plus a `phpcs.xml` on the WordPress standard.
- Read the single key: `sanitize_text_field( wp_unslash( $_GET[ MAP_QUERY_ARG ] ?? '' ) )`, same for `NEW_QUERY_ARG`, keeping the `NonceVerification.Recommended` ignore.
- Fix whatever else the first run reports.

*Effort: half a day, mostly unknown-unknowns from the first clean run.*

### 9. Bump the WordPress version everywhere, then re-run everything
Current stable is **7.1** (verified against api.wordpress.org). `Tested up to: 6.7` is four majors stale — Plugin Check raises it as an ERROR in initial-submission mode with no version tolerance, and once listed the directory shows the "hasn't been tested with the latest 3 major releases" banner and suppresses the plugin in search.

- `services/wordpress/docker-compose.yml:37` — `wordpress:6.7-php8.2-apache` → `wordpress:7.1-php8.2-apache`. This is almost certainly where the 6.7 came from. Dev-only stack, but leaving it stale reintroduces the drift.
- `.wp-env.json:3` — currently `"core": null` (= latest), so the integration suite already runs against current core, but the assertion isn't reproducible. Pin it to the exact version the readme will claim.
- Run all 132 PHP tests and 204 JS tests against 7.1.
- Only then set readme.txt:5 (item 12).

*Effort: 1-2 hours including a full test run.*

### 10. Fix the plugin header URIs
`mind-maps.php:4` reads `Plugin URI: https://github.com/eugen/mind-maps`. Verified: that URL 404s, `github.com/eugen` is a live third-party account, and the actual remote is `git@github.com:theguriev/mindmaps.git` (public, 200). WordPress renders this as the "Visit plugin site" link on every user's Plugins screen.

- `Plugin URI: https://github.com/theguriev/mindmaps`
- Add `Author URI:` — the file currently has no author URL field at all.

The dead URI is not by itself a documented rejection reason. It matters because it is the *only* pointer in the artefact, which is what closes off the escape hatch in item 11.

*Effort: 2 minutes.*

### 11. Add a source-code section to readme.txt — the actual guideline-4 blocker
Six auditors landed on this; it is the one finding that stops acceptance outright.

Detailed Plugin Guidelines **#4** ("Code must be (mostly) human readable") requires public, maintained access to source *and build tools*, satisfied by either shipping the source or **a link in the readme to the development location**. As shipped: `assets/index.js` is 636 KB minified, `assets/block.js` 29 KB minified, `assets/index.css` minified, no sourcemaps, no source, and no link. That is 665 KB of the 714 KB the plugin weighs.

Add a section to readme.txt after `== Description ==`:

```
== Source Code ==
```

naming, concretely:
- the repository: `https://github.com/theguriev/mindmaps` (same URL as item 10; verified public), and the tag each release is built from;
- the unminified source: `apps/wordpress/`, `packages/engine/`, `packages/storage/`;
- the two entry points: `apps/wordpress/src/main.tsx` → `assets/index.js`, `apps/wordpress/src/block.ts` → `assets/block.js`;
- the toolchain: Node 22+, pnpm, Vite, `apps/wordpress/vite.config.ts` **and `vite.block.config.ts`** — it is two Vite invocations, and a build doc that omits the second does not reproduce `block.js`;
- the command chain, **verified working**: `pnpm install && pnpm wp:package` (turbo's `package` task `dependsOn: ["build"]`, which `dependsOn: ["^build"]`, so it builds `@mindmaps/wordpress-app` first), or explicitly `pnpm install && pnpm build && pnpm --filter @mindmaps/wordpress run package`.

Do **not** document `pnpm --filter @mindmaps/wordpress run build` — that script is `node scripts/collect-assets.mjs`, which only *copies* `apps/wordpress/dist`; run from a clean checkout it exits 1 with "no built bundle at apps/wordpress/dist" and the reviewer's first attempt fails.

Do **not** ship sourcemaps as the remedy. `collect-assets.mjs` copies all of `apps/wordpress/dist` verbatim, so enabling `build.sourcemap` would silently push ~2 MB of `.map` files into the ZIP for no compliance benefit — the rule asks for source *and build tools*, which only the readme link provides.

*Effort: 30 minutes to write, plus one clean-checkout dry run of the documented command. Do the dry run.*

### 12. `Tested up to: 7.1` (readme.txt:5)
One line, but only after item 9 has actually run. Add this field to whatever release checklist already keeps `mind-maps.php` header Version, `MIND_MAPS_VERSION` and readme `Stable tag` in agreement — it is now a fourth thing that has to be maintained.

*Effort: 1 minute.*

### 13. Rewrite the Permissions paragraph — it currently states the opposite of the code
`readme.txt:33-36` says "Reading a map requires `read` plus ownership (or `edit_others_posts`)… Nothing is public by default — an embedded map is only visible to a visitor who may read it." The code (rest.php:209) returns `true` for any `publish` map to any anonymous caller. A readme that contradicts the code is the kind of inaccuracy the review team does bounce.

**Depends on item 1.** Write this paragraph after the privacy model is settled, and make it describe what actually ships. Also update the "Can visitors edit an embedded map?" FAQ, which is written from the same false premise.

*Effort: 20 minutes.*

### 14. Make `Contributors:` match a real wordpress.org account
`readme.txt:2` reads `Contributors: eugenguriev`; `profiles.wordpress.org/eugenguriev/` 404s. Not itself a rejection — the directory silently drops the name and the readme validator warns "The following contributors listed were ignored" — but the published plugin page would show an empty author list. You need a registered .org account with 2FA to submit at all, so: register it, and set line 2 to that account's exact username (case-sensitive). If the username you get differs from `eugenguriev`, this line must change with it. Correctable via SVN later.

*Effort: 10 minutes, plus account registration.*

### 15. Add a data-retention line to the readme FAQ
Not a blocker on its own, but it's the cheapest half of the uninstall question and it belongs in this pass. State that maps are user content stored as `mind_map` posts; deleting the plugin leaves them in place (reactivating brings them all back); anyone who wants them gone should delete them in the Mind Maps screen first or take them out via Tools → Export (the CPT already sets `can_export => true`, so "Mind Maps" appears there).

*Effort: 10 minutes.*

### 16. Run Plugin Check against the built ZIP and clear it
The final gate. Install the Plugin Check plugin, run it against the output of `scripts/package.mjs`, and fix everything it reports. Items 7, 8, 9 and 12 exist specifically to make this pass; run it anyway, because it will find things this list doesn't.

*Effort: 1-2 hours including fixes.*

---

## B. Would ship broken or unsafe

wordpress.org will not catch these. Real users will.

### 1. ~~Every published map is an unauthenticated JSON endpoint~~ — CHANGED DELIBERATELY

**This is now the intended behaviour**, added after the audit started: a map
embedded in a post has to be readable by the people the post was written for.
What the auditor found is real and worth keeping in mind — a published map is
readable by anyone who knows its post id — so the item below is left in as the
record of that trade. The list endpoint still refuses a signed-out caller, so
maps cannot be enumerated.

Original finding:
**`src/rest.php:190-218`.** The early return at line 209 grants any anonymous caller a full `GET /maps/<id>` for any `publish` map. `publish` is just the status `create_status()` picks for anyone with `publish_posts` — it is not a statement by the user that the map should be world-readable. The CPT declares `public:false, publicly_queryable:false, exclude_from_search:true`; there is no UI anywhere that says otherwise; the readme says the opposite. An admin's half-finished strategy map becomes a public document the moment it is saved.

This is deliberate, documented, test-pinned behaviour (commit 064cb07, `RestRoutesTest.php:303`), not a stray edit — it is what makes the shortcode and block work for readers. The defect is that it was applied to the whole post type instead of to the maps someone actually chose to embed.

**Recommended fix — a `_mindmap_public` post meta, opt-in, off by default:**
- Write it through a narrow route modelled on the existing `PUT /maps/<id>/template` (which exists precisely because a list row holds a flag, not a document).
- In `can_read_map()`, grant the anonymous branch only when that flag is set; leave the `read` + `owns_or_supervises()` fall-through exactly as it is.
- Add a list-row toggle in the app so publishing is a visible decision.

**Do not** implement this by flipping `post_status` to `private`. Under `map_meta_cap`, `edit_post`/`delete_post` on a *private* post resolve to `edit_private_posts`/`delete_private_posts`, which the Author role does not have — an Author's own map would become uneditable and undeletable by its own author, the mirror image of the contributor problem repository.php:108-117 already exists to avoid.

**The upgrade hazard is the hard part.** `get_post_meta()` returns `''` for pre-existing maps, so every already-embedded map on a 1.1.0 install reads as `public = 0` and silently breaks. Ship a version-stamped backfill setting `_mindmap_public = 1` on existing `publish` maps, or apply the new default only to newly created maps.

**Also correct the internal contract**, not just the readme: `docs/wordpress-contract.md:97` asserts "no one can enumerate a site's maps", justified solely by `GET /maps` returning 403 — reasoning that omits the id-guessing path. The row at :86 and the rationale at :91-105 describe the current behaviour accurately and will need rewriting to match whatever ships. Two integration tests pin the current rule (`RestRoutesTest.php:303`, `:624`).

*Effort: 1-2 days including the migration, the toggle UI, and reworking the pinned tests. Everything in item 13 waits on the decision here.*

### 2. The REST nonce is baked into cacheable HTML
**`src/assets.php:279`** prints `\wp_create_nonce( 'wp_rest' )` into the boot payload unconditionally, including for logged-out visitors. On any site whose page cache outlives the nonce window (~12-24 h), every anonymous visitor to a page with an embedded map downloads the 636 KB bundle and then sees "Your session has expired. Reload the page and sign in again." (`apps/wordpress/src/errors.ts:55`). Reloading cannot help — the cache serves the same stale nonce.

Scope it honestly: the three most common caching plugins' defaults sit under the floor (WP Rocket 10 h, W3TC 1 h, WP Super Cache 30 min). What does trip it: **LiteSpeed Cache** (default public TTL one week, and among the most-installed), **Cloudflare APO**, **Varnish/edge caches on managed hosts** that purge on content change rather than on a clock (Kinsta, WP Engine, Pressable), and **static exports** (Simply Static, WP2Static), where it is permanent. On those, failure is total and unrecoverable for every anonymous reader.

**Fix:** `\is_user_logged_in() ? \wp_create_nonce( 'wp_rest' ) : ''`. Nothing is lost — `BootConfig.nonce` is already `string | undefined` (`apps/wordpress/src/boot.ts:20`) and `packages/storage/src/wp.ts:44` only sets the header when truthy, and reading a public map needs no nonce.

**Pair it with** a client-side retry in `packages/storage/src/wp.ts`: on a 403 with code `rest_cookie_invalid_nonce`, retry once without the `X-WP-Nonce` header. That covers the residual case of a logged-in-user page being cached and served to anonymous visitors, which both LiteSpeed and WP Rocket permit per-role.

**While you're there,** correct the two comments that encode the false premise — `src/rest.php:205` and `docs/wordpress-contract.md:95` both claim a signed-out visitor "has no usable nonce". That only becomes true after this fix.

**Test note:** add the payload assertion for user 0, but know that `RestRoutesTest::request()` (tests/integration/RestRoutesTest.php:102-109) dispatches through `$this->server->dispatch()`, which never runs `check_authentication()` — no current integration test can catch any nonce-layer regression. End-to-end nonce behaviour is untested.

*Effort: 30 min for the PHP line + test; 2 hours with the client retry.*

### 3. Stop the unvalidated `stroke` at the boundary
**`src/document.php:200`** accepts `stroke` as any string whatsoever: `if ( \is_string( member( $value, 'stroke' ) ) )`. Every other malformed optional field is dropped (see `lineStyle` at line 206). A Contributor — the lowest role that can call `POST /maps` — can store `#000" /><script>…</script><path d="`.

Fix in this order:
1. **`src/document.php:200`** — accept `stroke` only against a colour pattern (`/^#[0-9a-f]{3,8}$/i` plus the `rgb()`/`rgba()`/named forms the editor actually emits), dropping it otherwise. This is the boundary and the plugin is the artefact under review.
2. **`packages/storage/src/document.ts:34`** — mirror it exactly. document.php:6-8 requires it ("when the schema changes, change both files").

*Effort: 1-2 hours across both validators plus tests.*

### 4. Escape every colour interpolation in the SVG exporter
**`packages/engine/src/renderer/svgExport.ts`.** An `esc()` helper sits at line 19 and is used at exactly one site (line 181, for `font` and `text`). Every colour goes in raw. Verified unescaped: line 45 (`fill="${background}"`), **line 88** (`stroke="${p.stroke}"` in `boxToSvg`), line 86/95/142 (`fill="${p.fill}"`), **line ~107** (`stroke="${stroke}"` in `bezierToSvg`, bound at ~104 — this is the actually-attacker-controlled one), line 132 (`fill="${stroke}"`), line 169 (`fill="${d.color}"`), line 181 (`fill="${run.color}"`).

An Editor or Admin who can read everyone's maps opens a poisoned map and hits Download → SVG; the attacker's markup lands in the file verbatim.

Impact, accurately: `useDownload.ts:36` triggers `link.download`, so the file opens as `file://` — `document.cookie` is empty there and cross-origin `fetch` is blocked, so this is **not** cookie theft on the WordPress origin. Script in a top-level SVG document does still execute, and an image beacon or navigation still exfiltrates. Media Library upload is not a path either: core blocks SVG uploads, and the popular enabling plugin (Safe SVG) sanitizes. The realistic worst case is a poisoned SVG a site owner exports and hands to any host that serves SVG raw.

It is still a plain output-encoding defect, cross-user, with the correct helper already in the file and a fix of a handful of characters. Wrap **all** of the sites above, not just the two attacker-reachable ones today, so escaping is a property of the serializer rather than of today's prop sources.

**Add the first test for this file** — `svgExport.ts` currently has zero coverage. Assert a `stroke` containing `" />` round-trips escaped.

*Effort: 1 hour including the test.*

### 5. Scope the stylesheet — 211 bare class selectors, ~30 of them ordinary English words, all `!important`
**`apps/wordpress/src/index.css:42`**, built into `assets/index.css` and loaded on **every front-end page carrying a map**. Verified in the shipped file:

```
.container{width:100%!important}   .collapse{visibility:collapse!important}
.hidden{display:none!important}    .table{display:table!important}
.flex{display:flex!important}      .border{border-style:…!important;border-width:1px!important}
.grid{display:grid!important}      .visible{visibility:visible!important}
.block{display:block!important}    .invisible{visibility:hidden!important}
.fixed{position:fixed!important}
```

plus `.filter`, `.outline`, `.ring`, `.shadow`, `.rounded`, `.resize`, `.inline`, `.absolute`, `.relative`, `.sticky`, `.transform`, `.truncate`, `.underline`, `.italic`, `.isolate`, `.list-item`, `.antialiased`, `.ordinal`, `.running`. A Bootstrap-derived theme breaks on any page with a map, and because of `!important` on a single-class selector the site owner cannot win without `!important` of their own.

Correct the mechanism when writing this up: `.container{width:100%}` does not remove a theme's max-width — the damage comes from the seven `@media (width>=…)` companions that set `max-width:…!important` at each breakpoint.

**The natural home for the fix is an existing test.** `apps/wordpress/src/styles.test.ts:197` has `it('styles nothing outside the embed')`, which passes only because its helper `ownedByTheEmbed()` (styles.test.ts:169-176) returns true for *any* selector containing a class token, on the stated assumption that "every utility and component class is the embed's". That assumption is the defect. Tighten the predicate to reject bare single-word class selectors and the existing test fails and drives the change.

Both proposed fixes need correcting before you use them:
- A PostCSS rewrite must be **scope-or-descendant**, not scope-descendant: `:where(.mind-maps-app, [data-slot=popover-content], …, .mind-maps-app *, …) .foo` fails on the portal roots themselves — `packages/engine/src/components/ui/popover.tsx:38` puts `z-50 w-72 rounded-md border p-4 shadow-md` directly on the `[data-slot="popover-content"]` element, which a descendant combinator never matches.
- Tailwind v4 `prefix(mm)` is **not** a drop-in: it requires rewriting every `className` string in `packages/engine/src` (`z-50` → `mm:z-50`) and desyncs the engine's other consumer, which imports plain `@import 'tailwindcss'` unprefixed.

**Token spill — fix alongside, but it does not carry the severity on its own.** The build emits `:root` *and* a `:root,:host` block defining `--font-sans --color-black --color-white --spacing --container-* --text-* --font-weight-* --tracking-widest --leading-normal --radius-* --drop-shadow-xl --animate-spin --default-transition-*` in addition to `--primary`/`--background`/`--border`/`--radius`. Broader than first claimed, but the highest-traffic collisions don't actually occur: Bootstrap namespaces to `--bs-*` and WP core to `--wp--*`. Move the token blocks onto the same scope selector list as the utilities (the portal roots need them anyway).

*Effort: 1 day, most of it verifying the scoped output against the existing style tests.*

### 17. Put a confirmation on delete
**`src/repository.php:165`** — `wp_delete_post( $id, true )`. Force delete. No trash, no undo. The trash and star buttons are adjacent icon buttons with `gap-1` in the same hover-reveal group, and `pointer-coarse:opacity-100` makes both permanently visible on touch, so the hover reveal isn't even a speed bump on a tablet.

Nothing recovers from a misclick. `post-type.php:67` does declare `'supports' => array( 'title', 'author', 'revisions' )` — but map content lives in the `_mindmap_content` post meta, which WordPress does not revision, and `wp_delete_post( $id, true )` deletes a post's revisions with it. So revisions exist and restore nothing but the title. And `packages/engine/src/hooks/useDownload.ts` exports PNG/JPEG/SVG — a picture of the map, not a file that can recreate it.

**Ship the confirm dialog now.** It is the part that actually stops the misclick, and it is small: `MapItem.tsx` plus the existing `dialog.tsx`.

**Treat trash+restore as separate, larger work.** The obvious "route DELETE through `wp_trash_post()`" is incomplete: because the CPT is `show_ui => false`, WordPress' own Trash view never lists `mind_map`, so a trashed map is unreachable through any UI and `EMPTY_TRASH_DAYS` purges it after 30 days. It needs a restore screen in the app. And both `Rest\can_delete_map()` (rest.php:243-252) and `Repository\delete_map()` (repository.php:162) gate on `find_map_post()`, which filters by `readable_statuses()` — so a follow-up `?force=true` DELETE would 404 unless the trash status is threaded through both call sites.

*Effort: 2 hours for the dialog. 2-3 days for real trash+restore — schedule separately.*

### 18. Two tabs on one map silently destroy each other's work
**`src/rest.php:308`** — `handle_update()` is a full-replace PUT with no conflict check, and the editor autosaves (`MindMapEditor.tsx:898-902`, unmount flush at `:904-910`). Open the same map in two tabs, edit in A, nudge one node in B: B's stale document overwrites A within a second, with no warning in either tab. With an Editor who can edit everyone's maps, it happens across users. There is nothing to recover from — see item 17 on why `supports 'revisions'` doesn't help.

**The cheap version does not work.** Comparing the submitted `modified` against `get_post_modified_time()` catches nothing: `MindMapEditor.tsx:843` sets `modified: new Date().toISOString()` on *every* save — the browser clock, not the base version the tab loaded — so a stale tab still submits "now", which is ahead of the stored time. And `App.tsx:198-200` does `await store.save(id, next)` and discards the response, so the editor never adopts the server's value either.

A real fix needs a **server-minted token** — `post_modified_gmt`, or a hash of `_mindmap_content` — returned by GET and PUT, echoed by the client on the next PUT, rejected with 409 when stale, and refreshed from every save response. That means changes in `wp.ts`, `App.tsx` and the editor, not just `rest.php`, plus a "your copy is behind, reload?" affordance.

*Effort: 2-3 days end to end.*

---

## C. Should do before real users arrive

Ordered roughly by ratio of user pain to work.

### 19. `GET /maps` returns up to 100 complete documents
**`src/rest.php:263-269`** — `handle_list()` maps `to_wire()` over every map. The admin list screen *and* every block-inserter open pull the full node graph of up to 100 maps, then the browser projects each into a 96px thumbnail. At a few hundred nodes each that is multiple megabytes and a visible freeze, on top of the 636 KB bundle. The client already knows how to consume the cheaper shape — the summary refactor never reached PHP.

Add a `to_summary()` beside `to_wire()` emitting `id`, `title`, `modified`, `meta`, node count, and the compact `{width,height,points,parents}` preview `packages/engine/src/preview` already defines (capped at 200 nodes, the shape `block.ts` validates). Use it in `handle_list()`; keep the full document on `GET /maps/<id>`. Update the `GET /maps` row in `docs/wordpress-contract.md`. *Effort: 1 day.*

### 20. The map list stops at 100 with nothing to say so
**`src/rest.php:31`** — `LIST_LIMIT = 100`, no pagination, no count, no search. A team crosses 100 maps and the 101st simply ceases to exist: not in the list, not in the block picker, reachable only by typing `?map=<id>` by hand. Add `page`/`per_page` args with `found_posts` in `X-WP-Total`/`X-WP-TotalPages` (core's convention) and a server-side `search` arg on `post_title`; paginate the list and let the block picker search rather than enumerate. Pairs naturally with item 19. *Effort: 1 day.*

### 21. Bound the size of strings, not just the count of nodes
**`src/document.php:174-229`.** `MAX_NODES` caps at 10,000 nodes; nothing caps the length of any string in one. A Contributor can store 10,000 nodes each carrying a multi-megabyte `name` in a single meta row, and `POST /maps` has no per-user map limit. Every read re-decodes and re-validates the whole blob, and `handle_list()` does it for up to 100 maps at once — so the cost lands on editors' `GET /maps`, not only on the attacker. Add a per-string ceiling (64 KB `name`; 512 bytes `title`, `stroke`, `reaction`) and a total encoded-size ceiling in `parse_content()` alongside `MAX_NODES`, mirrored in `packages/storage/src/document.ts`. Over the limit returns null, which handlers already surface as `mindmap_invalid_document` (400). *Effort: half a day.*

### 22. No i18n path in the editor bundle at all
`assets/index.js` is hardcoded English. A German site gets a translated admin menu and an untranslated product, while the eight strings in the tiny block script *are* translatable. The header claims `Text Domain` and `Domain Path`. Not a guideline violation — the directory has no i18n requirement and Plugin Check reports i18n as warnings — but it cannot be fixed by translators after the fact.

The obvious fix is incomplete as usually written. Adding `wp-i18n` to the `mind-maps-app` deps (assets.php:223-232) and calling `wp_set_script_translations( 'mind-maps-app', 'mind-maps', … )` **silently loads nothing**: WordPress resolves the JSON translation file by `md5()` of the script's registered relative path (`assets/index.js`), while `wp i18n make-json` derives that filename from the PO's source references. With the `__()` calls living in `apps/wordpress/src/main.tsx` — outside the plugin directory — the emitted file is keyed to `md5('apps/wordpress/src/main.tsx')` and is never found. You must either extract against the built `assets/index.js` or rewrite the POT's source references before `make-json`. Note also that `wp i18n make-pot` scans the plugin directory only, so engine/app defaults won't be picked up by a default run.

Keep the engine host-agnostic: give it an injected string table with English defaults, fill it from `wp.i18n.__` in `apps/wordpress/src/main.tsx`. While in there, add `wp_set_script_translations( 'mind-maps-block', 'mind-maps', … )` after the `wp_register_script()` that ends at render.php:207, and soften render.php:200-201, which claims "every string it shows goes through `wp.i18n`" — true of the block, not of the product. *Effort: 2-3 days.*

**Cheaper alternative if i18n is out of scope for 1.1.0:** accept English-only, drop the unused `Domain Path` header and `Plugin\load_textdomain()` (plugin.php:42-51, hooked at :23) — a .org-hosted plugin gets language packs regardless — and say so. *Effort: 20 minutes.* Pick one; do not leave the current half-state.

### 23. A front-end visitor waits on 213 KB gzip before anything appears
**`src/render.php:110`** emits a mount div and one sentence. With JS off — a crawler, an RSS reader (`the_content_feed` runs shortcodes), a print view — that is all that survives, so embedded maps are invisible to search engines and Reader modes. The building blocks are already in the repo: port `previewPaths()` to PHP (~40 lines; it only walks the adjacency list the repository already validated) and emit the SVG inside the mount div — visible immediately, correct without JS, replaced when React mounts. Then make the heavy bundle load-on-demand for front-end embeds (IntersectionObserver on the mount), keeping the eager load for the admin screen. If the eager path stays, at least split editor from viewer: `@mindmaps/engine/editor` is already a separate subpath import (`apps/wordpress/src/App.tsx:23`) and only `canEdit` mounts need it. *Effort: 2-4 days; do the server-rendered still first, it is the cheapest half.*

### 24. Stylesheet arrives in the footer for embeds outside the queried post's content
**`src/assets.php:319`** — `maybe_enqueue_front()` returns early unless `is_singular()`. `.mind-maps-app { min-height: 420px }` lives in `assets/index.css`, so the container has no size until the footer stylesheet lands: the page renders, reflows on the stylesheet, reflows again on mount. On a block theme, a map in a template part is the normal case, not an edge case. Cheapest correct fix: enqueue **only the stylesheet** unconditionally on the front end (7.5 KB gzip) and keep the 213 KB script conditional. *Effort: 1 hour.*

### 25. Admin screen uses `100vh`; on a phone the bottom strip is under the browser chrome
**`css/admin.css:38`** — `height: calc(100vh - var(--wp-admin--admin-bar--height, 32px))`, and the container clips overflow, so the read-only badge and the editor's bottom islands cannot be scrolled to. Add `height: calc(100dvh - …)` directly below the existing `100vh` line as a progressive override. While there: when a site hides the admin bar, `--wp-admin--admin-bar--height` is undefined and `html` has no `.wp-toolbar` padding, so the 32px fallback leaves a 32px dead strip — default to `0` and let core's variable supply the real height. *Effort: 30 minutes.*

### 26. A tall third-party notice can shrink the canvas to zero with no way to scroll
**`css/admin.css:58`.** The comment above accepts that "a chatty plugin costs canvas", but the arithmetic has no floor: two or three 600-800px upsell banners consume the whole fixed height and the editor renders at 0px, unscrollable. A plugin printing a bare `<div class="my-banner">` isn't matched by the notice rules at all. Add `#wpbody-content { overflow-y: auto }` plus `.mind-maps-admin-root { min-height: 420px }` (matching the app's own floor), and broaden the selector to `#wpbody-content > :not(.mind-maps-admin-root):not(.wp-header-end):not(h1) { flex: 0 0 auto }`. *Effort: 1 hour.*

### 27. RTL sites get left-aligned text inside the embed
**`apps/wordpress/src/index.css:253`** forces `text-align: left`, overriding the inherited `direction: rtl` an Arabic or Hebrew theme sets on `<body>`. Every label, dialog and node-editor field is aligned against the reading direction, visible on first paint, in two large WordPress locales. Change to `text-align: start` and audit the engine's components for other physical `left`/`right`/`margin-left` usages a logical property would cover. If genuinely direction-specific rules remain, register `index-rtl.css` and call `wp_style_add_data( style_handle( $index ), 'rtl', 'replace' )` in `register_assets()`. *Effort: half a day including the audit.*

### 28. `delete_with_user => true` destroys maps silently when a user is deleted
**`src/post-type.php`** (in the `register()` args). An admin offboarding an employee picks "delete all content" thinking about two draft posts and permanently destroys every mind map that person made — no warning, no listing, no trash, no export. Set `'delete_with_user' => false` so maps survive as orphans an Editor or Administrator can still reach through `list_maps()` and deal with deliberately. *Effort: 5 minutes.*

### 29. Drop `'revisions'` from `supports`, or implement it
**`src/post-type.php:67`.** It promises history that does not exist: map content is in post meta, which WordPress does not revision and the plugin registers no `wp_post_revision_meta_keys` for, so restoring a revision restores only the title and desyncs it from the map it names — while costing rows and hook traffic on a write path that runs several times a minute during editing. Either drop it, or implement it properly (`_wp_post_revision_fields` + `wp_save_post_revision`/`_wp_put_post_revision`/`wp_restore_post_revision` copying `_mindmap_content`) and expose a version-history affordance. Dropping it is the honest cheap move; implementing it is the real answer to items 17 and 18. *Effort: 5 minutes to drop; 3-4 days to implement.*

### 30. No document export or import
**`src/rest.php:36`.** A user moving a map from staging to production, handing one to a colleague, or wanting a backup before a risky edit has nothing to click — the image export is a picture, not a map. Given permanent deletes and no usable revision history, "take a copy first" is the only safety net available and it isn't offered. Add a `MapDoc` JSON download from the list row and the editor, and a "New → Import" that POSTs a validated document (`parse_document()` is already the gate). *Effort: 1-2 days.* Minimum viable: document the Tools → Export route in readme.txt (covered by item 15).

### 31. `_mindmap_version` is write-only
**`src/repository.php:297`.** The field exists to make schema evolution safe and currently provides none of it: the first schema change destroys data on any downgrade, and there is no scaffolding to migrate forward. Read `_mindmap_version` in `post_to_document()`; when it exceeds `DOC_VERSION`, return the document but mark it read-only and have `update_map()` refuse the write with a distinct error code rather than silently truncating. Separately, store a `mind_maps_db_version` option and compare it on `plugins_loaded` so future migrations — including item 1's backfill — have a hook to run in. **Consider doing this before item 1**, since item 1 needs exactly this mechanism. *Effort: half a day.*

### 32. kses filtering makes the list title diverge from the root node
**`src/repository.php:141`.** The map list shows one title, the canvas another, for the same node, with no way for the user to tell why. Worst on multisite, where it hits administrators too. Stop treating `post_title` as the document's title of record: keep the verbatim title inside the stored document (or its own meta key), read it from there in `post_to_document()`, and leave `post_title` as a sanitized display mirror for the export/search surfaces that need one. *Effort: half a day.*

### 33. A built-in template ships a personal domain and email address
**`packages/engine/src/templates/markdown.ts:272`** publishes `beagl.in` and `eg@beagl.in` into every install, and two obvious dev fixtures are presented to users as product templates. (The canvas renders Markdown to text and loads no images, so no outbound request is made today — but any future image support would turn this into an undisclosed external request the directory requires be declared.) Replace `markdown.ts` and `emojis.ts` with real starter content, or exclude them from `BUILTIN_BY_KEY` in the WordPress build. At minimum strip the address. *Effort: 1 hour to strip; 1 day for real starter templates.*

### 34. Small, cheap, do them in one pass
- **`src/rest.php:349`** — `handle_set_template()` re-validates with `\get_post( $id )` instead of `Repository\find_map_post( $id )`. It is the only handler whose own guard is weaker than its route's; if the callback is ever relaxed or reused, it writes `_mindmap_template` onto an arbitrary client-supplied post id. One-word change, same behaviour on every reachable path. *5 min.*
- **`src/plugin.php:27`** — delete the `wp_enqueue_scripts → register_assets` hook. `enqueue()` calls `register_assets()` itself (assets.php:263), so this only costs a stat, an open, a read and a JSON decode of the manifest on every uncached front-end page view of the whole site, to register handles that are then never enqueued. *5 min.*
- **`img/logo.png`** — shipped in the ZIP, referenced by nothing (admin.php:96 uses `img/menu-icon.svg`). It is 256×256 RGBA, which is exactly the icon source you need — move it to the SVN assets source and drop it from the plugin. *10 min.*
- **Plugin action link** — add a `plugin_action_links_` filter pointing at `admin.php?page=mind-maps`, and a `plugin_row_meta` docs entry. After activating, the user is currently left on the Plugins screen with no link anywhere. *30 min.*
- **Show the map id in the list row** — `packages/engine/src/components/MapItem.tsx:104` renders `{nodes} nodes · Updated {updated}`; make it `123 · 12 nodes · Updated …`. The block covers embedding for block-editor users, but anyone writing `[mind_map id="…"]` for Classic Editor, a theme template or a text widget has to read the id off the admin address bar. *20 min.*
- **`Failure` has no way back** — `apps/wordpress/src/App.tsx:69`. Open a stale `?map=<someone else's draft>` link and the only escape is editing the URL. Give `Failure` an optional `onBack` and pass it from `MapView`. Also add a list-specific string: it currently says "You do not have permission to open this mind map" when it was the *list* request that failed. *1 hour.*
- **`Requires PHP: 8.0` is one line away** — `src/document.php:91` is the only 8.1-only call (`array_is_list()`). Replace with `\is_array( $value ) && ( array() === $value || \array_keys( $value ) === \range( 0, \count( $value ) - 1 ) )` or a `function_exists` polyfill, then set 8.0 in mind-maps.php:8 and readme.txt:6. Keep CI on 8.1+ with an 8.0 lint job. 7.4 is genuinely out of reach (`mixed` and union return types everywhere). *30 min.* Optional — the current header is honest.
- **`LICENSE` + credits** — add the GPLv2 text as `LICENSE` in the plugin directory and at the repo root (once readme.txt links the repo as the source location, a reviewer following that link currently finds an unlicensed repository, which undercuts the GPL claim in the header), and a `== Third-Party Libraries ==` section listing each bundled package with its licence. Worth calling out `class-variance-authority` (Apache-2.0, GPLv3-compatible but not GPLv2-alone — the plugin's "or later" is what makes the combination distributable). Also restore an `@license` banner for the bundled React via the bundler's `legalComments` setting; `index.css` already carries Tailwind's. Good practice, satisfies MIT's notice-retention terms — not a rejection risk. *2 hours.*
- **Read-only badge on public embeds** — `apps/wordpress/src/App.tsx:205`. On a published post it reads to a visitor as a limitation or an error. Show the resting badge only when a nonce is present (i.e. the viewer could plausibly have expected write access) and keep the after-a-failed-save escalation for everyone. *30 min.*

### 35. After approval, when SVN access is granted
Commit to the SVN `/assets` directory (sibling of `trunk/` and `tags/`, **never** inside the ZIP): `icon-128x128.png` + `icon-256x256.png` (source from `img/logo.png`, already 256×256 RGBA — without these the listing falls back to the auto-generated geometric icon), `banner-772x250.png` + `banner-1544x500.png`, and `screenshot-1.png` / `screenshot-2.png` matching readme.txt:85-88 **in that order**. *Effort: 2 hours with the screenshots.*

---

## Dependency summary

- **1 → 13** — the Permissions paragraph must describe the privacy model that ships.
- **31 → 1** — item 1's backfill needs a migration hook; building it first is cheaper.
- **6 → 7** — remove the Composer `files` autoloading before adding `ABSPATH` guards, or all 132 PHP tests stop running.
- **3 → 4** — validate `stroke` at the boundary first, then escape at the serializer; the test in item 4 should pass for both reasons.
- **9 → 12** — run against 7.1 before asserting `Tested up to: 7.1`.
- **all → 16** — Plugin Check against the built ZIP is the last gate.