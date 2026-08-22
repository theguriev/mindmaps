import { describe, expect, it } from 'vitest'
import {
  BootError,
  editingAllowed,
  intlLocale,
  mapIdFromUrl,
  mapUrl,
  parseBoot,
  resolveCanEdit,
  resolveMapId,
  resolveMapParam,
  type BootConfig
} from './boot'

/** The payload exactly as `docs/wordpress-contract.md` documents it. */
const VALID = {
  root: 'https://site.test/wp-json/mindmaps/v1',
  nonce: 'a1b2c3d4e5',
  mapId: '42',
  canEdit: true,
  locale: 'en_US'
}

describe('parseBoot', () => {
  it('accepts the documented payload', () => {
    expect(parseBoot(VALID)).toEqual({
      root: 'https://site.test/wp-json/mindmaps/v1',
      nonce: 'a1b2c3d4e5',
      mapId: '42',
      canEdit: true,
      locale: 'en_US'
    })
  })

  it('drops a trailing slash from the REST root', () => {
    expect(parseBoot({ ...VALID, root: 'https://site.test/wp-json/mindmaps/v1/' }).root)
      .toBe('https://site.test/wp-json/mindmaps/v1')
  })

  it('reports a missing payload by name', () => {
    expect(() => parseBoot(undefined)).toThrow(BootError)
    expect(() => parseBoot(undefined)).toThrow(/window\.mindMapsBoot is missing/)
    expect(() => parseBoot(null)).toThrow(BootError)
  })

  it('rejects a payload that is not an object', () => {
    expect(() => parseBoot('nope')).toThrow(/must be an object/)
    expect(() => parseBoot(['nope'])).toThrow(/must be an object/)
  })

  it('rejects a payload without a usable REST root', () => {
    expect(() => parseBoot({ canEdit: true })).toThrow(/root must be the REST root URL/)
    expect(() => parseBoot({ ...VALID, root: '   ' })).toThrow(/root must be/)
    expect(() => parseBoot({ ...VALID, root: 42 })).toThrow(/root must be/)
  })

  it('treats an absent, empty or zero mapId as "show the list"', () => {
    expect(parseBoot({ root: VALID.root, canEdit: true }).mapId).toBeUndefined()
    expect(parseBoot({ ...VALID, mapId: '' }).mapId).toBeUndefined()
    expect(parseBoot({ ...VALID, mapId: '0' }).mapId).toBeUndefined()
    expect(parseBoot({ ...VALID, mapId: 0 }).mapId).toBeUndefined()
    expect(parseBoot({ ...VALID, mapId: null }).mapId).toBeUndefined()
  })

  it('normalizes a numeric post id to a string', () => {
    expect(parseBoot({ ...VALID, mapId: 42 }).mapId).toBe('42')
    expect(parseBoot({ ...VALID, mapId: ' 42 ' }).mapId).toBe('42')
  })

  it('fails closed on anything but a literal canEdit: true', () => {
    expect(parseBoot({ ...VALID, canEdit: false }).canEdit).toBe(false)
    expect(parseBoot({ ...VALID, canEdit: 'true' }).canEdit).toBe(false)
    expect(parseBoot({ ...VALID, canEdit: 1 }).canEdit).toBe(false)
    expect(parseBoot({ root: VALID.root }).canEdit).toBe(false)
  })

  it('treats a blank nonce or locale as absent', () => {
    const boot = parseBoot({ ...VALID, nonce: '', locale: '' })
    expect(boot.nonce).toBeUndefined()
    expect(boot.locale).toBeUndefined()
  })
})

describe('resolveMapId', () => {
  const boot = parseBoot(VALID)

  it('prefers the mount point\'s own data-map-id', () => {
    expect(resolveMapId('7', boot)).toBe('7')
    expect(resolveMapId(' 7 ', boot)).toBe('7')
  })

  it('reads an empty data-map-id as "show the list", not as "no opinion"', () => {
    // `[mind_map]` on a page that also carries `[mind_map id="42"]`: the plugin
    // prints the attribute on every mount, so an empty one is the list — the
    // payload's pinned id must not leak into it and render map 42 twice.
    expect(resolveMapId('', boot)).toBeUndefined()
    expect(resolveMapId('   ', boot)).toBeUndefined()
    expect(resolveMapId('0', boot)).toBeUndefined()
  })

  it('falls back to the payload only when the attribute is absent', () => {
    // A page rendered by an older plugin, which printed `data-map-id` for a
    // pinned map and nothing at all for the list.
    expect(resolveMapId(undefined, boot)).toBe('42')
    expect(resolveMapId(null, boot)).toBe('42')
  })

  it('yields nothing when neither side names a map', () => {
    const listBoot = parseBoot({ root: VALID.root, canEdit: true })
    expect(resolveMapId(undefined, listBoot)).toBeUndefined()
    expect(resolveMapId('', listBoot)).toBeUndefined()
  })
})

describe('resolveCanEdit', () => {
  const boot = parseBoot(VALID)
  const readOnlyBoot = parseBoot({ ...VALID, canEdit: false })

  it('prefers the mount point\'s own data-can-edit', () => {
    // Two maps on one page: the visitor may edit one of them and not the other.
    expect(resolveCanEdit('1', readOnlyBoot)).toBe(true)
    expect(resolveCanEdit('0', boot)).toBe(false)
  })

  it('falls back to the payload when the attribute is absent', () => {
    expect(resolveCanEdit(undefined, boot)).toBe(true)
    expect(resolveCanEdit(null, boot)).toBe(true)
    expect(resolveCanEdit(undefined, readOnlyBoot)).toBe(false)
  })

  it('fails closed on an attribute it does not recognize', () => {
    expect(resolveCanEdit('', boot)).toBe(false)
    expect(resolveCanEdit('yes', boot)).toBe(false)
    expect(resolveCanEdit('2', boot)).toBe(false)
  })

  it('refuses without a nonce, which every write would need anyway', () => {
    const noNonce = parseBoot({ ...VALID, nonce: '' })
    expect(resolveCanEdit('1', noNonce)).toBe(false)
    expect(resolveCanEdit(undefined, noNonce)).toBe(false)
  })
})

describe('editingAllowed', () => {
  const withBoot = (over: Partial<BootConfig>): BootConfig => ({
    ...parseBoot(VALID),
    ...over
  })

  it('allows editing when the server says so and a nonce is present', () => {
    expect(editingAllowed(withBoot({}))).toBe(true)
  })

  it('refuses when the server says the user may not edit', () => {
    expect(editingAllowed(withBoot({ canEdit: false }))).toBe(false)
  })

  it('refuses without a nonce, which every write would need anyway', () => {
    expect(editingAllowed(withBoot({ nonce: undefined }))).toBe(false)
  })

  it('is read-only for every malformed payload that still parses', () => {
    expect(editingAllowed(parseBoot({ root: VALID.root }))).toBe(false)
    expect(editingAllowed(parseBoot({ root: VALID.root, canEdit: 'yes' }))).toBe(false)
    expect(editingAllowed(parseBoot({ root: VALID.root, canEdit: true }))).toBe(false)
  })
})

describe('intlLocale', () => {
  it('turns a WordPress locale into a BCP-47 tag', () => {
    expect(intlLocale(parseBoot(VALID))).toBe('en-US')
    expect(intlLocale(parseBoot({ ...VALID, locale: 'pt_BR' }))).toBe('pt-BR')
  })

  it('is undefined when the payload has no locale, so Intl uses the browser\'s', () => {
    expect(intlLocale(parseBoot({ root: VALID.root }))).toBeUndefined()
  })
})

describe('resolveMapParam', () => {
  it('names the parameter only for a mount that owns its URL', () => {
    // The admin screen states one; a shortcode inside somebody's post does not,
    // and must never rewrite that post's address.
    expect(resolveMapParam('map')).toBe('map')
    expect(resolveMapParam(undefined)).toBeUndefined()
    expect(resolveMapParam(null)).toBeUndefined()
    expect(resolveMapParam('  ')).toBeUndefined()
  })
})

describe('mapUrl', () => {
  const ADMIN = 'http://site.test/wp-admin/admin.php?page=mind-maps'

  it('writes the open map into the parameter, keeping the rest of the address', () => {
    // `page=mind-maps` is what makes it *this* screen — only the map may move.
    expect(mapUrl(ADMIN, 'map', '42')).toBe('/wp-admin/admin.php?page=mind-maps&map=42')
  })

  it('replaces a map already in the address rather than appending', () => {
    expect(mapUrl(`${ADMIN}&map=7`, 'map', '42')).toBe(
      '/wp-admin/admin.php?page=mind-maps&map=42'
    )
  })

  it('drops the parameter for the list', () => {
    expect(mapUrl(`${ADMIN}&map=7`, 'map', undefined)).toBe(
      '/wp-admin/admin.php?page=mind-maps'
    )
  })

  it('returns a relative URL and keeps any fragment', () => {
    // `history.pushState` wants a relative URL, and the placeholder origin the
    // parser needs must never reach the address bar.
    const result = mapUrl('/wp-admin/admin.php?page=mind-maps#top', 'map', '42')
    expect(result).toBe('/wp-admin/admin.php?page=mind-maps&map=42#top')
    expect(result).not.toContain('invalid')
  })
})

describe('mapIdFromUrl', () => {
  it('reads the map the address points at', () => {
    expect(mapIdFromUrl('/wp-admin/admin.php?page=mind-maps&map=42', 'map')).toBe('42')
  })

  it('reads the list as no map', () => {
    expect(mapIdFromUrl('/wp-admin/admin.php?page=mind-maps', 'map')).toBeUndefined()
    // A leftover empty or zero parameter is the list too, not map "0".
    expect(mapIdFromUrl('/wp-admin/admin.php?map=', 'map')).toBeUndefined()
    expect(mapIdFromUrl('/wp-admin/admin.php?map=0', 'map')).toBeUndefined()
  })

  it('round-trips with mapUrl', () => {
    const url = mapUrl('/wp-admin/admin.php?page=mind-maps', 'map', '13')
    expect(mapIdFromUrl(url, 'map')).toBe('13')
  })
})
