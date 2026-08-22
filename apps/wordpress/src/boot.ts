/**
 * The handshake with the PHP plugin, per `docs/wordpress-contract.md`:
 *
 *   window.mindMapsBoot = {
 *     root: 'https://site.test/wp-json/mindmaps/v1',
 *     nonce: 'a1b2c3d4e5',
 *     mapId: '42',    // absent → the app shows the map list
 *     canEdit: true,  // false → read-only embed
 *     locale: 'en_US'
 *   }
 *
 * Everything here is pure so it can be unit-tested without a DOM: `main.tsx`
 * reads `window` and the mount element's attributes and passes the values in.
 */

export interface BootConfig {
  /** REST root for the `mindmaps/v1` namespace, without a trailing slash. */
  root: string
  /** `wp_create_nonce('wp_rest')`, sent as `X-WP-Nonce`. */
  nonce?: string
  /** Map to open. Absent → the app shows the list. */
  mapId?: string
  /** Whether the current user may write. Only an explicit `true` grants it. */
  canEdit: boolean
  /** WordPress locale (`en_US`), for date formatting. */
  locale?: string
}

/** Thrown when the plugin did not print a usable payload. */
export class BootError extends Error {
  constructor (message: string) {
    super(message)
    this.name = 'BootError'
  }
}

const PREFIX = '[mind-maps] window.mindMapsBoot'

/** A value that reads as a WordPress id: `'42'` or `42`, never `''` or `0`. */
function optionalId (value: unknown): string | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value !== 0 ? String(value) : undefined
  }
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed === '' || trimmed === '0' ? undefined : trimmed
}

function optionalString (value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}

/**
 * Validates the printed payload. Throws `BootError` with a message that names
 * the culprit — a broken payload is a plugin bug, and a silent blank embed
 * would send whoever hits it hunting through JavaScript instead of PHP.
 */
export function parseBoot (raw: unknown): BootConfig {
  if (raw === undefined || raw === null) {
    throw new BootError(
      `${PREFIX} is missing — the plugin did not print its boot payload before this script.`
    )
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new BootError(`${PREFIX} must be an object, got ${typeof raw}.`)
  }

  const value = raw as Record<string, unknown>
  const root = optionalString(value.root)
  if (root === undefined) {
    throw new BootError(`${PREFIX}.root must be the REST root URL of the mindmaps/v1 namespace.`)
  }

  return {
    // The store re-strips this, but a normalized value keeps the type honest.
    root: root.replace(/\/+$/, ''),
    nonce: optionalString(value.nonce),
    mapId: optionalId(value.mapId),
    // Fail closed: anything other than a literal `true` is read-only. A payload
    // that lost its shape must not be the reason somebody gets write access.
    canEdit: value.canEdit === true,
    locale: optionalString(value.locale)
  }
}

/**
 * The map a single mount point shows.
 *
 * Several embeds may sit on one page — `[mind_map id="42"]` next to a bare
 * `[mind_map]` — so the mount point's own `data-map-id` decides, including
 * when it is empty: the plugin prints the attribute on every mount, and an
 * empty one is a deliberate "show the list", not a missing value. Only an
 * attribute that is absent entirely (a page rendered by an older plugin, which
 * printed it only for a pinned map) falls back to the page-wide payload.
 */
export function resolveMapId (
  attribute: string | null | undefined,
  boot: BootConfig
): string | undefined {
  if (attribute === undefined || attribute === null) return boot.mapId
  return optionalId(attribute)
}

/**
 * Whether a single mount point may write.
 *
 * Permission is per map, not per page: one post can carry a map the visitor
 * owns next to somebody else's, so the plugin prints `data-can-edit` on every
 * mount and it wins over the payload's page-wide `canEdit`. An attribute that
 * is absent entirely (an older plugin) falls back to the payload.
 *
 * The nonce is the other half. WordPress rejects every cookie-authenticated
 * POST/PUT/DELETE that arrives without `X-WP-Nonce`, so a payload without one
 * cannot write whatever the attribute says. Deciding both here, once, is what
 * keeps the UI and the store in agreement: read-only means the store is never
 * called for a mutation, not that a button is hidden.
 */
export function resolveCanEdit (
  attribute: string | null | undefined,
  boot: BootConfig
): boolean {
  const granted =
    attribute === undefined || attribute === null
      ? boot.canEdit
      : // Fail closed, like `parseBoot` does with the payload: only the values
        // the plugin documents grant write access; anything else is read-only.
        ['1', 'true'].includes(attribute.trim().toLowerCase())

  return granted && boot.nonce !== undefined
}

/**
 * Whether the page-wide payload allows editing, for a mount point that carries
 * no `data-can-edit` of its own.
 */
export function editingAllowed (boot: BootConfig): boolean {
  return resolveCanEdit(undefined, boot)
}

/** WordPress locales are `en_US`; `Intl` wants BCP-47 `en-US`. */
export function intlLocale (boot: BootConfig): string | undefined {
  return boot.locale?.replace(/_/g, '-')
}
