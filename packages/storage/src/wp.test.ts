import { describe, expect, it, vi } from 'vitest'
import { createWpStore } from './wp'
import { MapStoreError } from './types'

const ROOT = 'https://site.test/wp-json/mindmaps/v1'

function jsonResponse (body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

const wireDoc = (id: string) => ({ id, title: 'T', content: [], version: 1 })

describe('createWpStore', () => {
  it('sends the nonce and same-origin credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]))
    await createWpStore({ root: ROOT, nonce: 'abc123', fetch: fetchMock }).list()

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${ROOT}/maps`)
    expect(init.credentials).toBe('same-origin')
    expect(init.headers['X-WP-Nonce']).toBe('abc123')
  })

  it('tolerates a trailing slash in the root', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]))
    await createWpStore({ root: ROOT + '/', fetch: fetchMock }).list()
    expect(fetchMock.mock.calls[0][0]).toBe(`${ROOT}/maps`)
  })

  it('skips malformed entries in a list instead of failing the screen', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse([wireDoc('1'), { id: '2', content: 'nope' }, null]))
    const maps = await createWpStore({ root: ROOT, fetch: fetchMock }).list()
    expect(maps.map((m) => m.id)).toEqual(['1'])
  })

  it('PUTs the wire document and returns what the server stored', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(wireDoc('7')))
    const saved = await createWpStore({ root: ROOT, fetch: fetchMock }).save('7', {
      id: '7',
      title: 'T',
      content: []
    })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${ROOT}/maps/7`)
    expect(init.method).toBe('PUT')
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(init.body)).toMatchObject({ id: '7', version: 1 })
    expect(saved.id).toBe('7')
  })

  it('encodes ids into the path', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ deleted: true }))
    await createWpStore({ root: ROOT, fetch: fetchMock }).remove(['a b/c'])
    expect(fetchMock.mock.calls[0][0]).toBe(`${ROOT}/maps/a%20b%2Fc`)
  })

  it('ignores an id that is already gone, as the MapStore contract says', async () => {
    // Two editors with the list open, both deleting the same map: the second
    // DELETE 404s, and "it is not there any more" is what was asked for.
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ code: 'mindmap_not_found' }, 404))
    await expect(
      createWpStore({ root: ROOT, fetch: fetchMock }).remove(['9'])
    ).resolves.toBeUndefined()
  })

  it('settles every id before reporting a failure', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ code: 'mindmap_forbidden' }, 403))
      .mockResolvedValueOnce(jsonResponse({ code: 'mindmap_not_found' }, 404))
      .mockResolvedValueOnce(jsonResponse({ deleted: true, id: '3' }))

    const error = await createWpStore({ root: ROOT, fetch: fetchMock })
      .remove(['1', '2', '3'])
      .catch((e: unknown) => e)

    // The map nobody could touch is reported, and the deletable one is still
    // deleted rather than abandoned at the first rejection.
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      `${ROOT}/maps/1`,
      `${ROOT}/maps/2`,
      `${ROOT}/maps/3`
    ])
    expect(error).toBeInstanceOf(MapStoreError)
    expect(error).toMatchObject({ code: 'mindmap_forbidden', status: 403 })
  })

  it('maps a 404 to null on get', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ code: 'mindmap_not_found' }, 404))
    expect(await createWpStore({ root: ROOT, fetch: fetchMock }).get('9')).toBeNull()
  })

  it('raises the WordPress error code and status', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ code: 'mindmap_forbidden', message: 'Nope' }, 403)
      )
    const error = await createWpStore({ root: ROOT, fetch: fetchMock })
      .get('9')
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(MapStoreError)
    expect(error).toMatchObject({ code: 'mindmap_forbidden', status: 403, message: 'Nope' })
  })

  it('reports a transport failure as a network error', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('offline'))
    const error = await createWpStore({ root: ROOT, fetch: fetchMock })
      .list()
      .catch((e: unknown) => e)
    expect(error).toMatchObject({ code: 'network_error' })
  })

  it('rejects a malformed document from the server', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: '1', content: 'nope' }))
    const error = await createWpStore({ root: ROOT, fetch: fetchMock })
      .get('1')
      .catch((e: unknown) => e)
    expect(error).toMatchObject({ code: 'invalid_response' })
  })
})
