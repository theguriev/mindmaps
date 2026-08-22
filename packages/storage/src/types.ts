/**
 * The storage contract every backend implements. The engine never talks to a
 * backend directly — a host loads a document through a `MapStore` and hands it
 * to `<MindMapEditor/>`.
 */
import type { MapDoc } from '@mindmaps/engine'

export interface MapStore {
  /** Every map the current user can see, newest first. */
  list: () => Promise<MapDoc[]>
  /** One map, or null when it does not exist (or is not readable). */
  get: (id: string) => Promise<MapDoc | null>
  /** Create a map; the backend assigns the id. */
  create: (doc: Omit<MapDoc, 'id'>) => Promise<MapDoc>
  /** Overwrite a map. Returns what the backend stored (ids/timestamps applied). */
  save: (id: string, doc: MapDoc) => Promise<MapDoc>
  /** Delete maps. Missing ids are ignored. */
  remove: (ids: string[]) => Promise<void>
}

/** Thrown by stores for backend failures the UI may want to distinguish. */
export class MapStoreError extends Error {
  readonly code: string
  readonly status?: number

  constructor (message: string, code: string, status?: number) {
    super(message)
    this.name = 'MapStoreError'
    this.code = code
    this.status = status
  }
}
