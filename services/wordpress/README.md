# @mindmaps/wordpress

The Mind Maps **WordPress plugin** — the PHP half of the WordPress
integration. It owns the data model (`mind_map` post type + post meta), the
`mindmaps/v1` REST namespace, the shortcode, the block and the admin editor
screen. The front-end bundle it mounts is built by
[`apps/wordpress`](../../apps/wordpress) (`@mindmaps/wordpress-app`) and copied
in at build time.

The authoritative contract between the three pieces —
plugin, embedded app and [`@mindmaps/storage`](../../packages/storage)'s
`createWpStore()` — is [`docs/wordpress-contract.md`](../../docs/wordpress-contract.md).
Change it in all three places at once, or not at all.

## How the pieces fit

```
apps/wordpress            packages/storage            services/wordpress
   (React app)     ──▶   createWpStore({root,nonce})  ──▶  mindmaps/v1
        │                                                       │
        │  built by vite                                        │  reads/writes
        ▼                                                       ▼
  dist/index.js  ──── collect-assets.mjs ───▶  plugin/mind-maps/assets/
  dist/block.js
                                                        │
                                              mind_map post + post meta
```

* `plugin/mind-maps/` is the distributable plugin directory — the thing that
  ships. It has no build step of its own; `assets/` is filled by
  `scripts/collect-assets.mjs`.
* Everything else in this package is development scaffolding: Composer, the two
  PHPUnit suites, wp-env, docker-compose and the packaging script.

### Inside the plugin

| File | Role |
| --- | --- |
| `mind-maps.php` | Plugin header, constants, `require_once` of `src/*`, one call to `bootstrap()`. |
| `src/plugin.php` | `bootstrap()` — every `add_action()` in the plugin lives here and nowhere else. |
| `src/document.php` | **Pure.** Validation and normalization of a map document. No WordPress. |
| `src/post-type.php` | The `mind_map` post type and its three meta keys. |
| `src/repository.php` | Post/meta reads and writes, always through `parse_document()`. |
| `src/rest.php` | Route registration, permission callbacks, thin handlers. |
| `src/assets.php` | Bundle enqueueing and the `window.mindMapsBoot` payload. |
| `src/render.php` | `mount_markup()`, plus the shortcode and block that share it. |
| `src/admin.php` | The "Mind Maps" admin screen. |

The plugin is written in **functional PHP**: plain namespaced functions,
`declare(strict_types=1)` everywhere, no classes, interfaces or traits. The only
`new` is `new WP_Error(…)`, which WordPress leaves no way around. Pure functions
are separated from the WordPress-touching shell in every file, which is what
lets the unit suite run with no WordPress at all.

`src/document.php` is the security boundary. It mirrors
`packages/storage/src/document.ts` rule for rule — non-finite coordinates
rejected, duplicate node ids rejected, dangling parents dropped, parent cycles
rejected, optional node fields whitelisted — and everything read from or written
to the database passes through it. Stored JSON is never trusted: a corrupt map
degrades to an empty one instead of breaking the editor.

## Running things

Everything below is run from `services/wordpress/` (or through
`pnpm --filter @mindmaps/wordpress run <script>` from anywhere in the repo).

### Unit tests — no Docker, no WordPress

```sh
composer install
./vendor/bin/phpunit --testsuite unit
# or
pnpm --filter @mindmaps/wordpress run test
```

61 tests covering `src/document.php` (every case from
`packages/storage/src/document.test.ts`, plus NAN/INF coordinates, 500-deep
parent cycles, 5000-node documents and unicode round trips) and the plugin's
other WordPress-free helpers.

No PHP on the machine? Run the suite in a container:

```sh
docker run --rm -v "$PWD":/app -w /app composer:2 install
docker run --rm -v "$PWD":/app -w /app php:8.2-cli ./vendor/bin/phpunit --testsuite unit
```

### Integration tests — wp-env

These load a real WordPress with a real database and exercise the REST routes
end to end: unauthenticated rejection, capability checks, create/read/update/
delete, cross-user isolation, invalid payloads, missing maps, exact document
round trips and graceful degradation of a corrupted row.

```sh
pnpm --filter @mindmaps/wordpress run env:start      # first run pulls images
pnpm --filter @mindmaps/wordpress run test:integration
pnpm --filter @mindmaps/wordpress run env:stop
```

`test:integration` needs `vendor/` on the host (it is bind-mounted into the
container) — `env:start` and the script both take care of it.

The site is at <http://localhost:8879> (`admin` / `password`); the tests
instance runs on port 8880. `env:clean` wipes both databases.

This is the one place in the codebase that uses objects: `WP_UnitTestCase`,
`WP_REST_Server` and `WP_REST_Request` are WordPress' own API and have no
functional equivalent. That is fine in tests; the plugin itself stays
functional.

> The bootstrap picks its suite from the command line: `--testsuite integration`
> (or `MINDMAPS_TESTS=integration`) loads WordPress, anything else does not.
> PHPUnit only supports one `bootstrap` per config file, and the unit suite must
> not see WordPress.

### A plain WordPress to click around in — docker-compose

`.wp-env.json` is for automated tests; `docker-compose.yml` is for poking at the
plugin by hand with a stack you fully control.

```sh
pnpm --filter @mindmaps/wordpress run build   # fill plugin/mind-maps/assets first
docker compose up -d                          # → http://localhost:8878
docker compose --profile cli run --rm cli plugin activate mind-maps
docker compose down                           # keep the database
docker compose down -v                        # wipe it
```

`plugin/mind-maps` is bind-mounted, so PHP edits are live on the next request.

### Building and packaging

```sh
pnpm --filter @mindmaps/wordpress run build     # copy apps/wordpress/dist → plugin/mind-maps/assets
pnpm --filter @mindmaps/wordpress run package   # → dist/mind-maps.zip
```

`build` depends on `@mindmaps/wordpress-app`, so `pnpm build` at the repo root
orders the bundle before the copy through turbo. If the bundle is missing the
script fails with instructions rather than shipping an empty plugin.

`package` needs `zip` on `PATH` (macOS ships it; `apt-get install zip` on
Debian).

### Linting

```sh
pnpm --filter @mindmaps/wordpress run lint:php
```

Uses PHPCS when `vendor/bin/phpcs` exists, otherwise falls back to `php -l` over
every PHP file in `plugin/` and `tests/`.

## REST API

Namespace `mindmaps/v1`. Cookie authentication plus the standard `X-WP-Nonce`
header; the plugin prints the nonce in the boot payload.

| Method | Route | Capability | Response |
| --- | --- | --- | --- |
| GET | `/maps` | `read` (scoped to what the caller may see) | `MapDoc[]`, newest first, max 100 |
| POST | `/maps` | `edit_posts` | `MapDoc`, **201** |
| GET | `/maps/<id>` | `read` + own map or `edit_others_posts` | `MapDoc` |
| PUT | `/maps/<id>` | `edit_post` for that map | `MapDoc` |
| DELETE | `/maps/<id>` | `delete_post` for that map | `{ "deleted": true, "id": "<id>" }` |

Errors carry a stable code the client branches on:

| Code | Status |
| --- | --- |
| `mindmap_invalid_document` | 400 |
| `mindmap_forbidden` | 403 |
| `mindmap_not_found` | 404 |

No route uses `__return_true`; an integration test asserts it.

## Requirements

* PHP 8.1+ (the plugin), 8.2 in CI and the containers
* WordPress 6.3+
* Composer 2 and Node 22+ for the development scripts
* Docker for the integration suite and the compose stack
