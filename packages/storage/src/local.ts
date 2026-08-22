/**
 * localStorage-backed store — the standalone editor's default backend.
 *
 * Keys keep the historical `map-<id>` shape, so maps saved by earlier builds
 * (including the pre-monorepo Vue app) still load; anything that fails
 * validation is skipped rather than crashing the list.
 */
import type { MapDoc } from '@mindmaps/engine'
import { guid } from '@mindmaps/engine'
import { parseMapDoc } from './document'
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
      const docs: MapDoc[] = []
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i)
        if (key === null || !key.startsWith(PREFIX)) continue
        const doc = read(key.slice(PREFIX.length))
        if (doc) docs.push(doc)
      }
      return docs.sort((a, b) => (b.modified ?? '').localeCompare(a.modified ?? ''))
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

    async remove (ids) {
      const storage = storageOf()
      for (const id of ids) storage.removeItem(PREFIX + id)
    }
  }
}
