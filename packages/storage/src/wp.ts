/**
 * WordPress REST store — talks to the `mindmaps/v1` namespace exposed by the
 * plugin in `services/wordpress`.
 *
 *   GET    {root}/maps          → MapSummary[]
 *   POST   {root}/maps          → MapDoc
 *   GET    {root}/maps/{id}     → MapDoc
 *   PUT    {root}/maps/{id}     → MapDoc
 *   PUT    {root}/maps/{id}/template → { id, template }
 *   DELETE {root}/maps/{id}     → { deleted: true, id }
 *
 * Authentication is WordPress's own cookie + nonce scheme: the plugin prints
 * the nonce into the page and it travels in `X-WP-Nonce`.
 */
import type { MapDoc, MapSummary } from '@mindmaps/engine'
import { parseMapDoc, parseMapSummary, toWire } from './document'
import { MapStoreError, type MapStore } from './types'

export interface WpStoreOptions {
  /** REST root for the namespace, e.g. `https://site.test/wp-json/mindmaps/v1`. */
  root: string
  /** `wp_create_nonce('wp_rest')` value; sent as the `X-WP-Nonce` header. */
  nonce?: string
  /** Injectable fetch (tests, or a host with its own transport). */
  fetch?: typeof globalThis.fetch
}

interface WpErrorBody {
  code?: string
  message?: string
}

export function createWpStore (options: WpStoreOptions): MapStore {
  const root = options.root.replace(/\/+$/, '')
  const doFetch = options.fetch ?? globalThis.fetch

  const request = async (
    path: string,
    init: RequestInit = {}
  ): Promise<unknown> => {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.nonce ? { 'X-WP-Nonce': options.nonce } : {})
    }

    let response: Response
    try {
      response = await doFetch(root + path, {
        credentials: 'same-origin',
        ...init,
        headers: { ...headers, ...(init.headers as Record<string, string>) }
      })
    } catch (error) {
      throw new MapStoreError(
        error instanceof Error ? error.message : 'Network request failed',
        'network_error'
      )
    }

    if (response.status === 204) return null

    let body: unknown
    try {
      body = await response.json()
    } catch {
      // A body-less or non-JSON response is fine for DELETE and for errors.
      body = null
    }

    if (!response.ok) {
      const wpError = (body ?? {}) as WpErrorBody
      throw new MapStoreError(
        wpError.message ?? `Request failed with ${response.status}`,
        wpError.code ?? 'http_error',
        response.status
      )
    }
    return body
  }

  /** A response that isn't a valid document is a backend contract violation. */
  const expectDoc = (body: unknown): MapDoc => {
    const doc = parseMapDoc(body)
    if (!doc) {
      throw new MapStoreError(
        'The server returned a malformed map document',
        'invalid_response'
      )
    }
    return doc
  }

  return {
    async list () {
      const body = await request('/maps')
      if (!Array.isArray(body)) {
        throw new MapStoreError(
          'The server returned a malformed map list',
          'invalid_response'
        )
      }
      // Skip unreadable entries instead of failing the whole screen.
      return body
        .map((item) => parseMapSummary(item))
        .filter((summary): summary is MapSummary => summary !== null)
    },

    async get (id) {
      try {
        return expectDoc(await request(`/maps/${encodeURIComponent(id)}`))
      } catch (error) {
        if (error instanceof MapStoreError && error.status === 404) return null
        throw error
      }
    },

    async create (doc) {
      const body = JSON.stringify(toWire({ ...doc, id: '' } as MapDoc))
      return expectDoc(await request('/maps', { method: 'POST', body }))
    },

    async save (id, doc) {
      const body = JSON.stringify(toWire({ ...doc, id }))
      return expectDoc(
        await request(`/maps/${encodeURIComponent(id)}`, { method: 'PUT', body })
      )
    },

    async setTemplate (id, template) {
      // A route of its own rather than a PUT of the whole map: the flag is one
      // bit, the row holding it has no document to send, and the map's own
      // modified time has no business moving because somebody starred it.
      await request(`/maps/${encodeURIComponent(id)}/template`, {
        method: 'PUT',
        body: JSON.stringify({ template })
      })
    },

    async remove (ids) {
      // The contract is "missing ids are ignored": a map that is already gone
      // is the state the caller asked for, and two people deleting the same
      // map from two open lists is the ordinary way to reach a 404 here.
      //
      // Every id is settled before anything is thrown, so one failure cannot
      // leave the rest of a batch undeleted. The first real failure is what
      // surfaces — the UI branches on `MapStoreError`'s code and status, which
      // an aggregate would hide.
      const failures: unknown[] = []
      for (const id of ids) {
        try {
          await request(`/maps/${encodeURIComponent(id)}`, { method: 'DELETE' })
        } catch (error) {
          if (error instanceof MapStoreError && error.status === 404) continue
          failures.push(error)
        }
      }
      if (failures.length > 0) throw failures[0]
    }
  }
}
