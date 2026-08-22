/**
 * localStorage-backed store — the standalone editor's default backend.
 *
 * Keys keep the historical `map-<id>` shape, so maps saved by earlier builds
 * (including the pre-monorepo Vue app) still load; anything that fails
 * validation is skipped rather than crashing the list.
 */
import type { MapDoc, MapSummary } from '@mindmaps/engine'
import { guid } from '@mindmaps/engine'
import { parseMapDoc, parseMapSummary } from './document'
import { MapStoreError, type MapStore } from './types'

export const PREFIX = 'map-'

export interface LocalStoreOptions {
  /** Storage to use. Defaults to `window.localStorage`. */
  storage?: Storage
  /** Id factory (tests inject a deterministic one). */
  makeId?: () => string
}

export function createLocalStore (options: LocalStoreOptions = {}): MapStore {
  const makeId = options.makeId ?? guid
  const storageOf = (): Storage => {
    const storage = options.storage ?? globalThis.localStorage
    if (!storage) {
      throw new MapStoreError('localStorage is unavailable', 'storage_unavailable')
    }
    return storage
  }

  const write = (doc: MapDoc): MapDoc => {
    try {
      storageOf().setItem(PREFIX + doc.id, JSON.stringify(doc))
    } catch (error) {
      // A full quota fails the write — surfacing it keeps "saved" honest.
      throw new MapStoreError(
        error instanceof Error ? error.message : 'Could not write to localStorage',
        'quota_exceeded'
      )
    }
    return doc
  }

  const read = (id: string): MapDoc | null => {
    const raw = storageOf().getItem(PREFIX + id)
    if (raw === null) return null
    try {
      return parseMapDoc(JSON.parse(raw), id)
    } catch {
      return null
    }
  }

  return {
    async list () {
      const storage = storageOf()
      const summaries: MapSummary[] = []
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i)
        if (key === null || !key.startsWith(PREFIX)) continue
        const id = key.slice(PREFIX.length)
        const raw = storage.getItem(key)
        if (raw === null) continue
        try {
          // Nothing is transferred here, so the saving is not in bytes: it is
          // that a hundred whole documents stop living in the screen's state
          // for as long as it is open.
          const summary = parseMapSummary(JSON.parse(raw), id)
          if (summary) summaries.push(summary)
        } catch {
          /* an entry that is not JSON is skipped, like an invalid one */
        }
      }
      return summaries.sort((a, b) => (b.modified ?? '').localeCompare(a.modified ?? ''))
    },

    async get (id) {
      return read(id)
    },

    async create (doc) {
      return write({
        ...doc,
        id: makeId(),
        modified: doc.modified ?? new Date().toISOString()
      })
    },

    async save (id, doc) {
      return write({ ...doc, id, modified: doc.modified ?? new Date().toISOString() })
    },

    async setTemplate (id, template) {
      // Read-modify-write of the stored entry rather than of whatever the list
      // is holding, so the flag lands on the map as it is now.
      const doc = read(id)
      if (doc === null) {
        throw new MapStoreError(`No map ${id}`, 'not_found')
      }
      write({ ...doc, meta: { ...doc.meta, template: template ? '1' : '0' } })
    },

    async remove (ids) {
      const storage = storageOf()
      for (const id of ids) storage.removeItem(PREFIX + id)
    }
  }
}
