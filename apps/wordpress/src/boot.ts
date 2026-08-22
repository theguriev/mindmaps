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
 * The map a single mount point shows. Several embeds may sit on one page, so
 * the element's own `data-map-id` wins over the page-wide payload.
 */
export function resolveMapId (
  attribute: string | null | undefined,
  boot: BootConfig
): string | undefined {
  return optionalId(attribute) ?? boot.mapId
}

/**
 * Whether this embed may write.
 *
 * `canEdit` is the server's answer, but a payload without a nonce cannot write
 * either — WordPress rejects every cookie-authenticated POST/PUT/DELETE that
 * arrives without `X-WP-Nonce`. Deciding it here, once, is what keeps the UI
 * and the store in agreement: read-only means the store is never called for a
 * mutation, not that a button is hidden.
 */
export function editingAllowed (boot: BootConfig): boolean {
  return boot.canEdit && boot.nonce !== undefined
}

/** WordPress locales are `en_US`; `Intl` wants BCP-47 `en-US`. */
export function intlLocale (boot: BootConfig): string | undefined {
  return boot.locale?.replace(/_/g, '-')
}
